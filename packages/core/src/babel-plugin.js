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
    // Handle Expression Body: () => <div />
    if (isJSX(path.node.body)) {
      path.node.body = t.arrowFunctionExpression([], path.node.body);
    }
    // Handle Block Statement Body: () => { return <div />; }
    else if (t.isBlockStatement(path.node.body)) {
      path.traverse({
        ReturnStatement(returnPath) {
          // Ensure we are transforming the return of the component, not a nested function
          if (returnPath.getFunctionParent().node === path.node) {
            if (isJSX(returnPath.node.argument)) {
              // Avoid double wrapping
              if (t.isArrowFunctionExpression(returnPath.node.argument) || t.isFunctionExpression(returnPath.node.argument)) {
                return;
              }
              returnPath.node.argument = t.arrowFunctionExpression([], returnPath.node.argument);
            }
          }
        }
      });
    }
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

    let propsId = null;
    let destructuredNames = new Set();
    let resolvePropsId = null;

    const isFunctionLike = (node) => (
      t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)
    );

    const looksLikeDepsGetter = (node) => {
      if (!isFunctionLike(node)) return false;
      if (t.isArrayExpression(node.body)) return true;
      if (!t.isBlockStatement(node.body)) return false;

      const bodyStatements = node.body.body.filter((statement) => !t.isDirective(statement));
      if (bodyStatements.length !== 1) return false;

      return t.isReturnStatement(bodyStatements[0]) && t.isArrayExpression(bodyStatements[0].argument);
    };

    const ensureBlockBody = (functionPath) => {
      if (!isFunctionLike(functionPath.node)) return null;
      if (t.isBlockStatement(functionPath.node.body)) {
        return functionPath.get('body');
      }

      functionPath.node.body = t.blockStatement([
        t.returnStatement(functionPath.node.body)
      ]);
      return functionPath.get('body');
    };

    const injectResolvedProps = (functionPath) => {
      if (!resolvePropsId || destructuredNames.size === 0 || !isFunctionLike(functionPath.node)) {
        return;
      }

      const bodyPath = ensureBlockBody(functionPath);
      const resolvedPropsId = functionPath.scope.generateUidIdentifier('resolvedProps');

      bodyPath.unshiftContainer('body', t.variableDeclaration('const', [
        t.variableDeclarator(
          resolvedPropsId,
          t.callExpression(t.cloneNode(resolvePropsId), [])
        )
      ]));

      functionPath.traverse({
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

        if (t.isBlockStatement(path.node.body)) {
          path.node.body.body.unshift(resolvePropsSetup);
        }
      }

      // Insert setup code
      if (t.isBlockStatement(path.node.body)) {
        path.node.body.body.unshift(propsSetup, restoreVars);
      }
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
          } else {
            callbackArg = firstArg;
            depsArg = secondArg;
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

          injectResolvedProps(depsPath);
          injectResolvedProps(callbackPath);
        }
      },

      ReturnStatement(returnPath) {
        if (returnPath.getFunctionParent().node === path.node) {
          const arg = returnPath.node.argument;
          if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
            const renderFn = arg;
            if (renderFn.params.length > 0 && renderFn.params[0].name.startsWith("_newProps")) return;

            const newPropsParam = path.scope.generateUidIdentifier("newProps");
            renderFn.params = [newPropsParam];

            // Inline Update Logic (only when props exist)
            const updateLogic = [];
            if (propsId) {
              updateLogic.push(
                t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(t.identifier("AEUI"), t.identifier("updateProps")),
                    [propsId, newPropsParam]
                  )
                )
              );
            }
            updateLogic.push(
              t.expressionStatement(
                t.callExpression(
                  t.memberExpression(t.identifier("AEUI"), t.identifier("_runComponentWatchers")),
                  [t.memberExpression(t.identifier("AEUI"), t.identifier("_currentComponentNode"))]
                )
              )
            );

            injectResolvedProps(returnPath.get("argument"));

            if (t.isBlockStatement(renderFn.body)) {
              renderFn.body.body.unshift(...updateLogic);
            } else {
              renderFn.body = t.blockStatement([
                ...updateLogic,
                t.returnStatement(renderFn.body)
              ]);
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
