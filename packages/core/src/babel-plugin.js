import { parseWithAutomaticFragments } from './jsx-fragments.js';

export default function aeuiTransform({ types: t }) {
  const isAeuiImportDeclaration = (node) => (
    t.isImportDeclaration(node) && node.source.value === 'aeui'
  );

  const hasAeuiImportSpecifier = (importDeclaration) => (
    importDeclaration.specifiers.some((specifier) => (
      t.isImportSpecifier(specifier) &&
      t.isIdentifier(specifier.imported, { name: 'AEUI' }) &&
      t.isIdentifier(specifier.local, { name: 'AEUI' })
    ))
  );

  const bindingIsAeuiImport = (binding) => (
    binding &&
    binding.path.isImportSpecifier() &&
    t.isIdentifier(binding.path.node.imported, { name: 'AEUI' }) &&
    binding.path.parentPath.isImportDeclaration() &&
    binding.path.parentPath.node.source.value === 'aeui'
  );

  const ensureAeuiImport = (programPath) => {
    const existingBinding = programPath.scope.getBinding('AEUI');
    if (bindingIsAeuiImport(existingBinding)) return;
    if (existingBinding) {
      throw programPath.buildCodeFrameError(
        '[AEUI] Local AEUI bindings conflict with the JSX runtime import. Rename the local binding or import { AEUI } from "aeui".'
      );
    }

    const existingImport = programPath.node.body.find((statement) => (
      isAeuiImportDeclaration(statement) &&
      !statement.specifiers.some((specifier) => t.isImportNamespaceSpecifier(specifier))
    ));

    if (existingImport) {
      if (!hasAeuiImportSpecifier(existingImport)) {
        const index = t.isImportDefaultSpecifier(existingImport.specifiers[0]) ? 1 : 0;
        existingImport.specifiers.splice(index, 0,
          t.importSpecifier(t.identifier('AEUI'), t.identifier('AEUI'))
        );
      }
      return;
    }

    programPath.unshiftContainer('body', t.importDeclaration(
      [t.importSpecifier(t.identifier('AEUI'), t.identifier('AEUI'))],
      t.stringLiteral('aeui')
    ));
  };

  const needsAeuiRuntimeBinding = (programPath) => {
    let needsBinding = false;

    const isAeuiRuntimeReference = (path) => {
      const parent = path.parentPath;
      if (!parent || !parent.isMemberExpression() || parent.node.object !== path.node) {
        return false;
      }

      if (parent.node.computed || !t.isIdentifier(parent.node.property)) {
        return false;
      }

      return (
        parent.node.property.name === 'createElement' ||
        parent.node.property.name === 'createVNode' ||
        parent.node.property.name === 'Fragment' ||
        parent.node.property.name === '__runtime'
      );
    };

    programPath.traverse({
      JSXElement(path) {
        needsBinding = true;
        path.stop();
      },
      JSXFragment(path) {
        needsBinding = true;
        path.stop();
      },
      Identifier(path) {
        if (!path.isReferencedIdentifier({ name: 'AEUI' })) return;

        const binding = path.scope.getBinding('AEUI');
        if (!binding) {
          needsBinding = true;
          path.stop();
          return;
        }

        if (!bindingIsAeuiImport(binding) && isAeuiRuntimeReference(path)) {
          needsBinding = true;
          path.stop();
        }
      },
    });

    return needsBinding;
  };

  /**
   * Checks if a node is a JSX element, fragment, or a transformed VNode call.
   */
  const isJSX = (node) => {
    if (!node) return false;
    if (t.isJSXElement(node) || t.isJSXFragment(node)) return true;
    if (t.isParenthesizedExpression(node)) return isJSX(node.expression);

    // Check for AEUI.createVNode or AEUI.createElement calls (transformed JSX)
    if (t.isCallExpression(node)) {
      const callee = node.callee;
      return (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object, { name: 'AEUI' }) &&
        (t.isIdentifier(callee.property, { name: 'createVNode' }) ||
          t.isIdentifier(callee.property, { name: 'createElement' }))
      );
    }
    return false;
  };

  const isFunctionLike = (node) => (
    t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)
  );

  const ensureBlockBody = (functionPath) => {
    if (!t.isBlockStatement(functionPath.node.body)) {
      functionPath.node.body = t.blockStatement([
        t.returnStatement(functionPath.node.body)
      ]);
    }

    return functionPath.get('body');
  };

  const createAeuiRuntimeMember = (name) => (
    t.memberExpression(
      t.memberExpression(t.identifier('AEUI'), t.identifier('__runtime')),
      t.identifier(name)
    )
  );

  const isAeuiHookCall = (callPath, hookName) => {
    const callee = callPath.node.callee;
    if (!t.isIdentifier(callee)) return false;
    const binding = callPath.scope.getBinding(callee.name);
    if (!binding) return callee.name === hookName;
    return binding.path.isImportSpecifier() &&
      t.isIdentifier(binding.path.node.imported, { name: hookName }) &&
      binding.path.parentPath.node.source.value === 'aeui';
  };

  const createDependencyGetter = (depsPath) => {
    const node = depsPath.node;
    if (isFunctionLike(node)) return node;
    if (depsPath.isIdentifier()) {
      const binding = depsPath.scope.getBinding(node.name);
      if (binding?.constant) {
        if (binding.path.isFunctionDeclaration()) return node;
        if (binding.path.isVariableDeclarator()) {
          const init = binding.path.get('init');
          if (isFunctionLike(init.node)) return node;
          if (init.isArrayExpression() || init.isLiteral() || init.isObjectExpression()) {
            return t.arrowFunctionExpression([], t.cloneNode(node));
          }
        }
      }
    } else if (depsPath.isArrayExpression() || depsPath.isLiteral() || depsPath.isObjectExpression()) {
      return t.arrowFunctionExpression([], t.cloneNode(node, true));
    }
    throw depsPath.buildCodeFrameError(
      '[AEUI] Ambiguous watch dependency. Use an explicit getter: () => [value] or () => getDeps().'
    );
  };

  const isRuntimeReference = (refPath, methods) => {
    const call = refPath.parentPath;
    if (!call.isCallExpression() || call.node.arguments[0] !== refPath.node) return false;
    const callee = call.node.callee;
    if (!t.isMemberExpression(callee) || callee.computed ||
        !t.isIdentifier(callee.object) || !t.isIdentifier(callee.property) ||
        !methods.includes(callee.property.name)) return false;
    const binding = call.scope.getBinding(callee.object.name);
    return bindingIsAeuiImport(binding) || (!binding && callee.object.name === 'AEUI');
  };

  // Recognize serialized compiler output by its complete render bridge structure.
  const hasRenderBridge = (functionPath) => {
    let found = false;
    functionPath.traverse({
      ReturnStatement(returnPath) {
        if (returnPath.getFunctionParent() !== functionPath) return;
        const wrapper = returnPath.node.argument;
        if (!t.isArrowFunctionExpression(wrapper) || wrapper.params.length !== 1 ||
            !t.isIdentifier(wrapper.params[0]) || !t.isCallExpression(wrapper.body)) return;
        const { callee, arguments: args } = wrapper.body;
        if (!t.isMemberExpression(callee) || callee.computed ||
            !t.isIdentifier(callee.property, { name: 'runRenderPhase' }) ||
            !t.isMemberExpression(callee.object) || callee.object.computed ||
            !t.isIdentifier(callee.object.property, { name: '__runtime' }) ||
            !t.isIdentifier(callee.object.object, { name: 'AEUI' }) ||
            !bindingIsAeuiImport(returnPath.scope.getBinding('AEUI')) ||
            args.length !== 3 || !t.isIdentifier(args[0], { name: wrapper.params[0].name }) ||
            !isFunctionLike(args[2]) || args[2].params.length !== 1) return;
        if (t.isNullLiteral(args[1]) && functionPath.node.params.length === 0) found = true;
        if (t.isIdentifier(args[1])) {
          const binding = functionPath.scope.getBinding(args[1].name);
          const init = binding?.path.node.init;
          if (binding?.scope === functionPath.scope && binding.constant &&
              t.isObjectExpression(init) && init.properties.length === 1 &&
              t.isSpreadElement(init.properties[0])) found = true;
        }
      },
    });
    return found;
  };

  const containsRenderableExpression = (node) => {
    if (!node) return false;
    if (isJSX(node)) return true;
    if (t.isParenthesizedExpression(node)) return containsRenderableExpression(node.expression);
    if (t.isConditionalExpression(node)) {
      return (
        containsRenderableExpression(node.consequent) ||
        containsRenderableExpression(node.alternate)
      );
    }
    if (t.isLogicalExpression(node)) {
      return (
        containsRenderableExpression(node.left) ||
        containsRenderableExpression(node.right)
      );
    }
    if (t.isSequenceExpression(node)) {
      return node.expressions.some((expression) => containsRenderableExpression(expression));
    }
    if (t.isArrayExpression(node)) {
      return node.elements.some((element) => {
        if (!element) return false;
        if (t.isSpreadElement(element)) {
          return containsRenderableExpression(element.argument);
        }
        return containsRenderableExpression(element);
      });
    }
    return false;
  };

  const functionReturnsRenderableExpression = (functionPath) => {
    if (!functionPath || !isFunctionLike(functionPath.node)) return false;

    if (t.isArrowFunctionExpression(functionPath.node) && !t.isBlockStatement(functionPath.node.body)) {
      return containsRenderableExpression(functionPath.node.body);
    }

    let found = false;
    functionPath.traverse({
      ReturnStatement(returnPath) {
        if (returnPath.getFunctionParent().node !== functionPath.node) return;

        if (containsRenderableExpression(returnPath.node.argument)) {
          found = true;
          returnPath.stop();
        }
      }
    });

    return found;
  };

  const returnsRenderableValue = (path) => {
    if (t.isArrowFunctionExpression(path.node) && !t.isBlockStatement(path.node.body)) {
      const bodyPath = path.get('body');
      return (
        containsRenderableExpression(path.node.body) ||
        functionReturnsRenderableExpression(bodyPath)
      );
    }

    let found = false;
    path.traverse({
      ReturnStatement(returnPath) {
        if (returnPath.getFunctionParent().node !== path.node) return;

        const arg = returnPath.node.argument;
        const argPath = returnPath.get('argument');
        if (
          containsRenderableExpression(arg) ||
          functionReturnsRenderableExpression(argPath)
        ) {
          found = true;
          returnPath.stop();
        }
      }
    });

    return found;
  };

  const isExportedFunction = (path) => {
    if (path.parentPath.isExportDefaultDeclaration()) return true;
    const name = path.parentPath.isVariableDeclarator() ? path.parent.id.name : path.node.id?.name;
    const binding = name && path.scope.getBinding(name);
    return !!binding && (binding.path.parentPath.isExportDeclaration() ||
      binding.path.parentPath.parentPath?.isExportDeclaration() ||
      binding.referencePaths.some((ref) => ref.parentPath.isExportSpecifier() || ref.parentPath.isExportDefaultDeclaration()));
  };

  const returnsSimpleRenderable = (path) => {
    const params = new Set(path.node.params.flatMap((param) => Object.keys(t.getBindingIdentifiers(param))));
    const simple = (node) => {
      if (t.isNullLiteral(node) || t.isStringLiteral(node) || t.isNumericLiteral(node) ||
          t.isBooleanLiteral(node) || t.isBigIntLiteral(node)) return true;
      if (t.isIdentifier(node)) return params.has(node.name);
      if (t.isMemberExpression(node)) return simple(node.object);
      if (t.isArrayExpression(node)) return node.elements.every((item) => !item || simple(item));
      if (t.isConditionalExpression(node)) return simple(node.consequent) && simple(node.alternate);
      if (t.isLogicalExpression(node)) return simple(node.left) && simple(node.right);
      return false;
    };
    if (!t.isBlockStatement(path.node.body)) return simple(path.node.body);
    let found = false;
    path.traverse({ ReturnStatement(returnPath) {
      if (returnPath.getFunctionParent() === path && simple(returnPath.node.argument)) found = true;
    } });
    return found;
  };

  const unwrapRegisteredFunction = (node) => {
    if (!t.isCallExpression(node) || !t.isArrowFunctionExpression(node.callee) ||
        node.callee.params.length !== 1 || node.arguments.length !== 1) return null;
    const call = node.callee.body;
    if (!t.isCallExpression(call) || !t.isNodesEquivalent(call.callee, createAeuiRuntimeMember('registerComponent')) ||
        !t.isNodesEquivalent(call.arguments[0], node.callee.params[0])) return null;
    const value = node.arguments[0];
    if (isFunctionLike(value)) return value;
    if (t.isMemberExpression(value) && t.isObjectExpression(value.object) &&
        value.object.properties.length === 1 && t.isObjectProperty(value.object.properties[0])) {
      const original = value.object.properties[0].value;
      if (isFunctionLike(original)) return original;
    }
    return null;
  };

  /**
   * Transforms component return values to render functions.
   * Handles both expression bodies and block bodies.
   */
  const transformToFactory = (path) => {
    const body = ensureBlockBody(path);
    const last = body.node.body.at(-1);
    if (!t.isReturnStatement(last) && !t.isThrowStatement(last)) {
      body.pushContainer('body', t.returnStatement());
    }

    path.traverse({
      ReturnStatement(returnPath) {
        if (returnPath.getFunctionParent().node !== path.node) return;

        const arg = returnPath.node.argument;
        const registeredRender = unwrapRegisteredFunction(arg);
        if (registeredRender) {
          returnPath.node.argument = t.cloneNode(registeredRender, true);
          return;
        }
        if (isFunctionLike(arg)) return;
        if (t.isIdentifier(arg)) {
          const binding = returnPath.scope.getBinding(arg.name);
          const init = binding?.path.isVariableDeclarator() ? binding.path.node.init : null;
          if (binding?.path.isFunctionDeclaration() || isFunctionLike(init) || unwrapRegisteredFunction(init)) {
            const renderId = path.scope.generateUidIdentifier('render');
            const propsId = path.scope.generateUidIdentifier('renderProps');
            returnPath.insertBefore(t.variableDeclaration('const', [t.variableDeclarator(renderId, t.cloneNode(arg))]));
            returnPath.node.argument = t.arrowFunctionExpression([propsId], t.callExpression(renderId, [propsId]));
            return;
          }
        }

        returnPath.node.argument = t.arrowFunctionExpression([], arg ? t.cloneNode(arg, true) : t.unaryExpression('void', t.numericLiteral(0)));
      }
    });
  };

  /**
   * Injects props destructuring and reactive update logic.
   * Handles:
   * 1. (props) -> (_initialProps)
   * 2. const _props = { ..._initialProps };
   * 3. const props = _props; (or let { x } = _initialProps;)
   * 4. watch() dependency transformation
   * 5. return factory transformation with update logic
   */
  const injectReactiveProps = (path) => {
    const params = path.node.params;
    const bodyPath = ensureBlockBody(path);

    let propsId = null;
    let destructuredNames = new Set();
    let resolvePropsId = null;

    const rewriteResolvedPropsReferences = (targetPath, resolvedPropsId) => {
      if (!resolvedPropsId) return;

      targetPath.traverse({
        JSXIdentifier(idPath) {
          const name = idPath.node.name;
          if (!destructuredNames.has(name) ||
              idPath.scope.getBinding(name)?.scope !== path.scope) return;
          const parent = idPath.parentPath;
          const isTag = (parent.isJSXOpeningElement() || parent.isJSXClosingElement()) &&
            parent.node.name === idPath.node && /^[A-Z]/.test(name);
          const isObject = parent.isJSXMemberExpression() && parent.node.object === idPath.node;
          if (!isTag && !isObject) return;
          idPath.replaceWith(t.jsxMemberExpression(
            t.jsxIdentifier(resolvedPropsId.name), t.jsxIdentifier(name)
          ));
          idPath.skip();
        },
        Identifier(idPath) {
          const name = idPath.node.name;

          if (!idPath.isReferencedIdentifier() || !destructuredNames.has(name)) {
            return;
          }

          if (idPath.scope.hasBinding(name) && idPath.scope.getBinding(name).scope !== path.scope) {
            return;
          }

          idPath.replaceWith(
            t.memberExpression(t.cloneNode(resolvedPropsId), t.identifier(name))
          );
        }
      });
    };

    const prepareResolvedProps = (functionPath) => {
      if (!resolvePropsId || destructuredNames.size === 0 || !isFunctionLike(functionPath.node)) {
        return null;
      }

      const resolvedPropsId = functionPath.scope.generateUidIdentifier('resolvedProps');
      rewriteResolvedPropsReferences(functionPath, resolvedPropsId);

      return {
        resolvedPropsId,
        declaration: t.variableDeclaration('const', [
          t.variableDeclarator(
            t.cloneNode(resolvedPropsId),
            t.callExpression(t.cloneNode(resolvePropsId), [])
          )
        ])
      };
    };

    const createRenderParamBindings = (param, sourceId) => {
      if (!param) return [];

      if (t.isIdentifier(param)) {
        return [
          t.variableDeclaration('const', [
            t.variableDeclarator(t.cloneNode(param, true), t.cloneNode(sourceId))
          ])
        ];
      }

      if (t.isObjectPattern(param) || t.isArrayPattern(param)) {
        return [
          t.variableDeclaration('const', [
            t.variableDeclarator(t.cloneNode(param, true), t.cloneNode(sourceId))
          ])
        ];
      }

      if (t.isAssignmentPattern(param)) {
        if (!(t.isIdentifier(param.left) || t.isObjectPattern(param.left) || t.isArrayPattern(param.left))) {
          return [];
        }

        return [
          t.variableDeclaration('const', [
            t.variableDeclarator(
              t.cloneNode(param.left, true),
              t.conditionalExpression(
                t.binaryExpression('===', t.cloneNode(sourceId), t.identifier('undefined')),
                t.cloneNode(param.right, true),
                t.cloneNode(sourceId)
              )
            )
          ])
        ];
      }

      return [];
    };

    const isSupportedPropsParam = (param) => {
      if (!param) return false;
      if (t.isIdentifier(param) || t.isObjectPattern(param) || t.isArrayPattern(param)) {
        return true;
      }
      if (!t.isAssignmentPattern(param)) return false;
      return t.isIdentifier(param.left) || t.isObjectPattern(param.left) || t.isArrayPattern(param.left);
    };

    const getPropsBindingPattern = (param) => (
      t.isAssignmentPattern(param) ? param.left : param
    );

    const createInitialPropsSource = (param, initialPropsId) => {
      if (!t.isAssignmentPattern(param)) {
        return {
          statements: [],
          sourceId: initialPropsId,
        };
      }

      const sourceId = path.scope.generateUidIdentifier('initialPropsValue');
      return {
        statements: [
          t.variableDeclaration('const', [
            t.variableDeclarator(
              sourceId,
              t.conditionalExpression(
                t.binaryExpression('===', t.cloneNode(initialPropsId), t.identifier('undefined')),
                t.cloneNode(param.right, true),
                t.cloneNode(initialPropsId)
              )
            )
          ])
        ],
        sourceId,
      };
    };

    // --- Props-specific setup (only when params exist) ---
    if (params.length > 0 && isSupportedPropsParam(params[0])) {
      const originalParam = params[0];
      const bindingPattern = getPropsBindingPattern(originalParam);
      const initialPropsId = path.scope.generateUidIdentifier("initialProps");
      const initialPropsSource = createInitialPropsSource(originalParam, initialPropsId);
      propsId = path.scope.generateUidIdentifier("props");

      // 1. Rename Param: (props) -> (_initialProps)
      path.node.params[0] = initialPropsId;

      // 2. Setup props snapshot
      const propsSetup = t.variableDeclaration("const", [
        t.variableDeclarator(
          propsId,
          t.objectExpression([t.spreadElement(t.cloneNode(initialPropsSource.sourceId))])
        )
      ]);

      let restoreVars;
      const setupStatements = [
        ...initialPropsSource.statements,
        propsSetup,
      ];

      // 3. Restore User Variables
      if (t.isIdentifier(bindingPattern)) {
        restoreVars = t.variableDeclaration("const", [
          t.variableDeclarator(t.cloneNode(bindingPattern, true), propsId)
        ]);
      } else if (t.isObjectPattern(bindingPattern) || t.isArrayPattern(bindingPattern)) {
        const bindingIdentifiers = t.getBindingIdentifiers(bindingPattern);
        Object.keys(bindingIdentifiers).forEach((name) => {
          destructuredNames.add(name);
        });

        resolvePropsId = path.scope.generateUidIdentifier('resolveProps');
        const resolvePropsSetup = t.variableDeclaration('const', [
          t.variableDeclarator(
            resolvePropsId,
            t.arrowFunctionExpression([], t.blockStatement([
              t.variableDeclaration('const', [
                t.variableDeclarator(
                  t.cloneNode(bindingPattern, true),
                  t.cloneNode(propsId)
                )
              ]),
              t.returnStatement(
                t.objectExpression(
                  Object.keys(bindingIdentifiers).map((name) => (
                    t.objectProperty(t.identifier(name), t.identifier(name), false, true)
                  ))
                )
              )
            ]))
          )
        ]);

        restoreVars = t.variableDeclaration("let", [
          t.variableDeclarator(
            t.cloneNode(bindingPattern, true),
            t.cloneNode(initialPropsSource.sourceId)
          )
        ]);
        setupStatements.push(resolvePropsSetup);
      }

      bodyPath.unshiftContainer('body', [...setupStatements, restoreVars]);
    }

    // --- Watch & Return transformation (always runs) ---
    // 4. Transform watch() and Return
    path.traverse({
      CallExpression(callPath) {
        if (isAeuiHookCall(callPath, 'clean')) {
          callPath.node.callee = createAeuiRuntimeMember('clean');
          return;
        }

        if (!isAeuiHookCall(callPath, 'watch')) return;

        const args = callPath.node.arguments;
        if (args.length !== 1 && args.length !== 2) return;

        const [callbackArg] = args;
        if (t.isArrayExpression(callbackArg)) {
          return;
        }

        if (args.length === 2) {
          const depsArg = createDependencyGetter(callPath.get('arguments.1'));

          callPath.node.arguments = [callbackArg, depsArg];
        }

        callPath.node.callee = createAeuiRuntimeMember('watch');

        if (destructuredNames.size > 0 && propsId) {
          const callbackPath = callPath.get('arguments.0');

          const preparedCallback = prepareResolvedProps(callbackPath);
          if (preparedCallback) {
            ensureBlockBody(callbackPath).unshiftContainer('body', preparedCallback.declaration);
          }

          if (args.length === 2) {
            const depsPath = callPath.get('arguments.1');
            const preparedDeps = prepareResolvedProps(depsPath);
            if (preparedDeps) {
              ensureBlockBody(depsPath).unshiftContainer('body', preparedDeps.declaration);
            }
          }
        }
      },

      ReturnStatement(returnPath) {
        if (returnPath.getFunctionParent().node === path.node) {
          const arg = returnPath.node.argument;
          if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
            const renderFnPath = returnPath.get("argument");
            const renderFn = renderFnPath.node;
            const originalParam = renderFn.params[0];

            const renderPhaseParam = path.scope.generateUidIdentifier("newProps");
            const innerRenderParam = path.scope.generateUidIdentifier("renderProps");
            const renderParamBindings = createRenderParamBindings(originalParam, innerRenderParam);
            renderFn.params = [innerRenderParam];

            const renderBodyPath = ensureBlockBody(renderFnPath);
            const preparedRenderProps = prepareResolvedProps(renderFnPath);
            const setupStatements = [
              ...(preparedRenderProps ? [preparedRenderProps.declaration] : []),
              ...renderParamBindings
            ];
            const insertedPaths = setupStatements.length > 0
              ? renderBodyPath.unshiftContainer('body', setupStatements)
              : [];

            if (preparedRenderProps) {
              insertedPaths.forEach((insertedPath) => {
                rewriteResolvedPropsReferences(insertedPath, preparedRenderProps.resolvedPropsId);
              });
            }

            const innerRenderFn = t.cloneNode(renderFn, true);
            returnPath.node.argument = t.arrowFunctionExpression(
              [renderPhaseParam],
              t.callExpression(
                createAeuiRuntimeMember("runRenderPhase"),
                [
                  t.cloneNode(renderPhaseParam),
                  propsId ? t.cloneNode(propsId) : t.nullLiteral(),
                  innerRenderFn
                ]
              )
            );
          }
        }
      }
    });
  };

  // Follow local aliases and every assignment source without evaluating user code.
  const collectTypeFunctions = (programPath) => {
    const used = new Set();
    const visited = new Set();
    const resolve = (valuePath) => {
      if (!valuePath?.node || visited.has(valuePath.node)) return;
      visited.add(valuePath.node);
      if (valuePath.isFunction()) {
        used.add(valuePath.node);
      } else if (valuePath.isIdentifier() || valuePath.isJSXIdentifier()) {
        const binding = valuePath.scope.getBinding(valuePath.node.name);
        if (!binding) return;
        if (binding.path.isFunctionDeclaration()) resolve(binding.path);
        if (binding.path.isVariableDeclarator()) resolve(binding.path.get('init'));
        for (const violation of binding.constantViolations) {
          if (violation.isAssignmentExpression()) resolve(violation.get('right'));
        }
      } else if (valuePath.isConditionalExpression()) {
        resolve(valuePath.get('consequent'));
        resolve(valuePath.get('alternate'));
      } else if (valuePath.isLogicalExpression()) {
        resolve(valuePath.get('left'));
        resolve(valuePath.get('right'));
      } else if (valuePath.isSequenceExpression()) {
        resolve(valuePath.get('expressions').at(-1));
      } else if (valuePath.isMemberExpression() || valuePath.isJSXMemberExpression()) {
        const object = valuePath.get('object');
        const binding = object.isIdentifier() || object.isJSXIdentifier()
          ? object.scope.getBinding(object.node.name) : null;
        const init = binding?.path.isVariableDeclarator() ? binding.path.get('init') : object;
        if (!init?.isObjectExpression()) return;
        const property = valuePath.node.property;
        const key = valuePath.node.computed ? property.value : property.name;
        if (key === undefined) return;
        for (const prop of init.get('properties')) {
          if (prop.isObjectProperty() && !prop.node.computed &&
              (prop.node.key.name ?? prop.node.key.value) === key) resolve(prop.get('value'));
        }
      }
    };
    programPath.traverse({
      JSXOpeningElement(path) {
        const name = path.get('name');
        if (!name.isJSXIdentifier() || /^[A-Z]/.test(name.node.name)) resolve(name);
      },
      JSXAttribute(path) {
        const value = path.get('value');
        if (value.isJSXExpressionContainer()) resolve(value.get('expression'));
      },
      CallExpression(path) {
        const first = path.get('arguments.0');
        if (first?.node && isRuntimeReference(first, ['createElement', 'createVNode', 'init'])) resolve(first);
      },
    });
    return used;
  };

  const isRegistration = (path) => {
    const callee = path.node.callee;
    return t.isMemberExpression(callee) && !callee.computed &&
      t.isIdentifier(callee.property, { name: 'registerComponent' }) &&
      t.isMemberExpression(callee.object) && !callee.object.computed &&
      t.isIdentifier(callee.object.property, { name: '__runtime' }) &&
      t.isIdentifier(callee.object.object, { name: 'AEUI' }) &&
      bindingIsAeuiImport(path.scope.getBinding('AEUI'));
  };

  const createComponentEntry = (path) => {
    const original = t.cloneNode(path.node, true);
    const isDeclaration = path.isFunctionDeclaration();
    // A private name in a function expression must still refer to the original
    // callable when the setup clone makes a recursive ordinary call.
    const privateName = !isDeclaration && path.node.id;
    if (isDeclaration && !path.node.id) {
      path.node.id = path.scope.generateUidIdentifier('component');
      original.id = t.cloneNode(path.node.id);
    }
    const typeId = isDeclaration ? t.cloneNode(path.node.id)
      : privateName ? t.cloneNode(privateName) : path.scope.generateUidIdentifier('component');

    if (path.node.async || path.node.generator) {
      path.node.async = false;
      path.node.generator = false;
      path.node.params = [];
      path.node.body = t.blockStatement([t.throwStatement(t.newExpression(t.identifier('TypeError'), [
        t.stringLiteral('[AEUI] Component setup must be synchronous; async and generator functions cannot be element types.'),
      ]))]);
    } else {
      transformToFactory(path);
      injectReactiveProps(path);
    }
    const setup = t.toExpression(t.cloneNode(path.node, true));
    setup.id = null;
    const registration = t.callExpression(createAeuiRuntimeMember('registerComponent'), [typeId, setup]);

    if (isDeclaration) {
      const declarationPath = path.parentPath.isExportDeclaration() ? path.parentPath : path;
      const block = declarationPath.parentPath;
      if (!block.isProgram() && !block.isBlockStatement()) {
        throw path.buildCodeFrameError('[AEUI] Component function declarations need a block scope.');
      }
      path.replaceWith(original);
      block.unshiftContainer('body', t.expressionStatement(registration));
    } else {
      // Preserve inferred function names without introducing a self binding.
      const parent = path.parentPath;
      let inferredName = null;
      if (!original.id && parent.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
        inferredName = parent.node.id.name;
      } else if (!original.id && parent.isObjectProperty() && !parent.node.computed) {
        inferredName = parent.node.key.name ?? parent.node.key.value;
      } else if (!original.id && (parent.isAssignmentExpression() || parent.isAssignmentPattern()) &&
                 t.isIdentifier(parent.node.left)) {
        inferredName = parent.node.left.name;
      } else if (!original.id && parent.isExportDefaultDeclaration()) {
        inferredName = 'default';
      }
      const value = inferredName ? t.memberExpression(t.objectExpression([
        t.objectProperty(t.stringLiteral(inferredName), original),
      ]), t.stringLiteral(inferredName), true) : original;
      path.replaceWith(t.callExpression(t.arrowFunctionExpression([typeId], registration), [value]));
    }
  };

  return {
    parserOverride: parseWithAutomaticFragments,
    visitor: {
      Program: {
        enter(path) {
          const registered = new Set();
          // Serialized compiler output retains both entry points. Do not compile
          // their bodies again, including generated render closures.
          path.traverse({
            CallExpression(call) {
              if (!isRegistration(call)) return;
              for (const arg of call.get('arguments')) {
                if (arg.isFunction()) registered.add(arg.node);
                if (arg.isIdentifier()) {
                  const binding = arg.scope.getBinding(arg.node.name);
                  if (binding?.path.isFunctionDeclaration()) registered.add(binding.path.node);
                  if (binding?.kind === 'param') {
                    const wrapper = binding.scope.path;
                    const invocation = wrapper.parentPath;
                    if (invocation.isCallExpression() && invocation.node.callee === wrapper.node) {
                      registered.add(wrapper.node);
                      const value = invocation.get('arguments.0');
                      if (value?.node) {
                        value.traverse({ Function(inner) { registered.add(inner.node); } });
                        if (value.isFunction()) registered.add(value.node);
                      }
                    }
                  }
                }
              }
            },
          });
          const used = collectTypeFunctions(path);
          const candidates = [];
          path.traverse({
            'ArrowFunctionExpression|FunctionDeclaration|FunctionExpression'(candidate) {
              if (registered.has(candidate.node) || hasRenderBridge(candidate)) {
                candidate.skip();
                return;
              }
              if (used.has(candidate.node) || returnsRenderableValue(candidate) ||
                  (isExportedFunction(candidate) && returnsSimpleRenderable(candidate))) {
                candidates.push(candidate);
              }
            },
          });
          // Prepare nested definitions in their lexical scope before cloning an
          // enclosing component, so both entry points keep those registrations.
          for (const candidate of candidates.reverse()) createComponentEntry(candidate);
          path.scope.crawl();
        },
        exit(path) {
          if (needsAeuiRuntimeBinding(path)) ensureAeuiImport(path);
        },
      },
    },
  };
}
