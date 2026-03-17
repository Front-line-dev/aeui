export default function aeuiTransform({ types: t }) {
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

  /**
   * Determines if an ArrowFunctionExpression is an AEUI component.
   * Strategies:
   * 1. Check if it's exported and PascalCase.
   * 2. Check if it's used as a JSX tag (e.g. <MyComp />) in the same scope.
   */
  const shouldTransformComponent = (path) => {
    let varName = null;
    let isExported = false;
    let isUsedAsComponent = false;

    const isAnonymousDefaultExport =
      path.parentPath &&
      path.parentPath.isExportDefaultDeclaration() &&
      (
        t.isArrowFunctionExpression(path.node) ||
        ((t.isFunctionDeclaration(path.node) || t.isFunctionExpression(path.node)) && !path.node.id)
      );

    if (isAnonymousDefaultExport && returnsRenderableValue(path)) {
      return true;
    }

    // 1. Identify Variable Name & Export Status
    if (t.isFunctionDeclaration(path.node) && path.node.id) {
      varName = path.node.id.name;
      const binding = path.scope.getBinding(varName);
      if (binding) {
        const parent = binding.path.parentPath; // Should be Program or Export
        isExported = (parent && (parent.isExportNamedDeclaration() || parent.isExportDefaultDeclaration()));

        binding.referencePaths.forEach(refPath => {
          if (t.isJSXOpeningElement(refPath.parent) && refPath.parent.name === refPath.node) {
            isUsedAsComponent = true;
          } else if (
            t.isCallExpression(refPath.parent) &&
            refPath.parent.arguments.length > 0 &&
            refPath.parent.arguments[0] === refPath.node
          ) {
            isUsedAsComponent = true;
          }
        });
      }
    }
    else if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
      varName = path.parent.id.name;
      const binding = path.scope.getBinding(varName);

      if (binding) {
        // Check if exported
        const parent = binding.path.parentPath;
        const grandParent = parent.parentPath;
        isExported = (grandParent && (grandParent.isExportNamedDeclaration() || grandParent.isExportDefaultDeclaration())) ||
          (parent.isExportNamedDeclaration() || parent.isExportDefaultDeclaration());

        // Check Usage: Used as JSX Tag? <MyComp />
        binding.referencePaths.forEach(refPath => {
          if (t.isJSXOpeningElement(refPath.parent) && refPath.parent.name === refPath.node) {
            isUsedAsComponent = true;
          }
          // Check for transformed JSX usage: React.createElement(MyComp, ...)
          else if (
            t.isCallExpression(refPath.parent) &&
            refPath.parent.arguments.length > 0 &&
            refPath.parent.arguments[0] === refPath.node
          ) {
            isUsedAsComponent = true;
          }
        });
      }
    } else if (t.isAssignmentExpression(path.parent) && t.isMemberExpression(path.parent.left) && !path.parent.left.computed && t.isIdentifier(path.parent.left.property)) {
      varName = path.parent.left.property.name;
      isExported = true;
    } else if (t.isObjectProperty(path.parent) && t.isIdentifier(path.parent.key)) {
      varName = path.parent.key.name;
      isExported = true;
    }

    // 2. Apply Heuristics
    if (isUsedAsComponent) {
      return true;
    }

    if (varName && /^[A-Z]/.test(varName)) {
      return true;
    }

    return false;
  };

  /**
   * Transforms `return JSX` to `return () => JSX`.
   * Handles both expression bodies and block bodies.
   */
  const transformToFactory = (path) => {
    ensureBlockBody(path);

    path.traverse({
      ReturnStatement(returnPath) {
        if (returnPath.getFunctionParent().node !== path.node) return;

        const arg = returnPath.node.argument;
        if (!arg || isFunctionLike(arg) || !containsRenderableExpression(arg)) {
          return;
        }

        returnPath.node.argument = t.arrowFunctionExpression([], t.cloneNode(arg, true));
      }
    });
  };

  /**
   * Injects props destructuring and reactive update logic.
   * Handles:
   * 1. (props) -> (_initialProps)
   * 2. const __props = { ..._initialProps };
   * 3. const props = __props; (or let { x } = _initialProps;)
   * 4. watch() dependency transformation
   * 5. return factory transformation with update logic
   */
  const injectReactiveProps = (path) => {
    const params = path.node.params;
    const bodyPath = ensureBlockBody(path);

    let propsId = null;
    let destructuredNames = new Set();
    let resolvePropsId = null;

    const looksLikeDepsGetter = (node) => {
      if (!isFunctionLike(node)) return false;
      if (t.isArrayExpression(node.body)) return true;
      if (!t.isBlockStatement(node.body)) return false;

      const bodyStatements = node.body.body.filter((statement) => !t.isDirective(statement));
      if (bodyStatements.length !== 1) return false;

      return t.isReturnStatement(bodyStatements[0]) && t.isArrayExpression(bodyStatements[0].argument);
    };

    const rewriteResolvedPropsReferences = (targetPath, resolvedPropsId) => {
      if (!resolvedPropsId) return;

      targetPath.traverse({
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

    // --- Props-specific setup (only when params exist) ---
    if (params.length > 0 && (t.isIdentifier(params[0]) || t.isObjectPattern(params[0]))) {
      const originalParam = params[0];
      const initialPropsId = path.scope.generateUidIdentifier("initialProps");
      propsId = t.identifier("__props");

      // 1. Rename Param: (props) -> (_initialProps)
      path.node.params[0] = initialPropsId;

      // 2. Setup __props
      const propsSetup = t.variableDeclaration("const", [
        t.variableDeclarator(
          propsId,
          t.objectExpression([t.spreadElement(initialPropsId)])
        )
      ]);

      let restoreVars;

      // 3. Restore User Variables
      if (t.isIdentifier(originalParam)) {
        restoreVars = t.variableDeclaration("const", [
          t.variableDeclarator(originalParam, propsId)
        ]);
      } else if (t.isObjectPattern(originalParam)) {
        const bindingIdentifiers = t.getBindingIdentifiers(originalParam);
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
                  t.cloneNode(originalParam, true),
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
          t.variableDeclarator(originalParam, initialPropsId)
        ]);
        bodyPath.unshiftContainer('body', [resolvePropsSetup]);
      }

      bodyPath.unshiftContainer('body', [propsSetup, restoreVars]);
    }

    // --- Watch & Return transformation (always runs) ---
    // 4. Transform watch() and Return
    path.traverse({
      CallExpression(callPath) {
        if (!t.isIdentifier(callPath.node.callee, { name: "watch" })) return;

        const args = callPath.node.arguments;
        if (args.length < 2) return;

        const [firstArg, secondArg] = args;
        let depsArg = null;
        let callbackArg = null;

        const firstLooksLikeDeps = t.isArrayExpression(firstArg) || looksLikeDepsGetter(firstArg);
        const secondLooksLikeDeps = t.isArrayExpression(secondArg) || looksLikeDepsGetter(secondArg);

        if (firstLooksLikeDeps && !secondLooksLikeDeps) {
          depsArg = firstArg;
          callbackArg = secondArg;
        } else if (!firstLooksLikeDeps && secondLooksLikeDeps) {
          callbackArg = firstArg;
          depsArg = secondArg;
        } else if (isFunctionLike(firstArg) && !isFunctionLike(secondArg)) {
          callbackArg = firstArg;
          depsArg = secondArg;
        } else if (!isFunctionLike(firstArg) && isFunctionLike(secondArg)) {
          depsArg = firstArg;
          callbackArg = secondArg;
        } else if (isFunctionLike(firstArg) && isFunctionLike(secondArg)) {
          if (firstLooksLikeDeps && !secondLooksLikeDeps) {
            depsArg = firstArg;
            callbackArg = secondArg;
          } else if (!firstLooksLikeDeps && secondLooksLikeDeps) {
            callbackArg = firstArg;
            depsArg = secondArg;
          } else {
            depsArg = firstArg;
            callbackArg = secondArg;
          }
        } else {
          return;
        }

        if (!isFunctionLike(depsArg)) {
          depsArg = t.arrowFunctionExpression([], t.cloneNode(depsArg, true));
        }

        callPath.node.arguments = [depsArg, callbackArg];

        if (destructuredNames.size > 0 && propsId) {
          const depsPath = callPath.get('arguments.0');
          const callbackPath = callPath.get('arguments.1');

          const preparedDeps = prepareResolvedProps(depsPath);
          if (preparedDeps) {
            ensureBlockBody(depsPath).unshiftContainer('body', preparedDeps.declaration);
          }

          const preparedCallback = prepareResolvedProps(callbackPath);
          if (preparedCallback) {
            ensureBlockBody(callbackPath).unshiftContainer('body', preparedCallback.declaration);
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
            if (t.isIdentifier(originalParam) && originalParam.name.startsWith("_newProps")) return;

            const newPropsParam = path.scope.generateUidIdentifier("newProps");
            const renderParamBindings = createRenderParamBindings(originalParam, newPropsParam);
            renderFn.params = [newPropsParam];

            // Inline Update Logic (only when props exist)
            const preWatchLogic = [];
            if (propsId) {
              preWatchLogic.push(
                t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(t.identifier("AEUI"), t.identifier("updateProps")),
                    [propsId, newPropsParam]
                  )
                )
              );
            }
            const watcherLogic = t.expressionStatement(
              t.callExpression(
                t.memberExpression(t.identifier("AEUI"), t.identifier("_runComponentWatchers")),
                [t.memberExpression(t.identifier("AEUI"), t.identifier("_currentComponentNode"))]
              )
            );

            const renderBodyPath = ensureBlockBody(renderFnPath);
            const preparedRenderProps = prepareResolvedProps(renderFnPath);
            const setupStatements = [
              ...preWatchLogic,
              ...(preparedRenderProps ? [preparedRenderProps.declaration] : []),
              ...renderParamBindings,
              watcherLogic
            ];
            const insertedPaths = renderBodyPath.unshiftContainer('body', setupStatements);

            if (preparedRenderProps) {
              insertedPaths.forEach((insertedPath) => {
                rewriteResolvedPropsReferences(insertedPath, preparedRenderProps.resolvedPropsId);
              });
            }
          }
        }
      }
    });
  };

  return {
    visitor: {
      "ArrowFunctionExpression|FunctionDeclaration|FunctionExpression"(path) {
        if (!shouldTransformComponent(path)) {
          return;
        }

        // 1. Transform Return: Return (JSX) -> Return () => (JSX)
        transformToFactory(path);

        // 2. Props Destructuring & Updates
        injectReactiveProps(path);
      }
    }
  };
}
