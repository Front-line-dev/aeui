export default function aeuiTransform({ types: t }) {
  /**
   * Checks if a node is a JSX element, fragment, or a transformed VNode call.
   */
  const isJSX = (node) => {
    if (!node) return false;
    if (t.isJSXElement(node) || t.isJSXFragment(node)) return true;
    if (t.isParenthesizedExpression(node)) return isJSX(node.expression);

    // Check for React.createElement or AEUI.createVNode calls (transformed JSX)
    if (t.isCallExpression(node)) {
      return true;
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
    if (params.length === 0) return;

    // We only care if the first param is Identifier or ObjectPattern
    if (!t.isIdentifier(params[0]) && !t.isObjectPattern(params[0])) return;

    const originalParam = params[0];
    const initialPropsId = path.scope.generateUidIdentifier("initialProps");
    const propsId = t.identifier("__props");

    // 1. Rename Param: (props) -> (_initialProps)
    path.node.params[0] = initialPropsId;

    // 2. Setup __props
    // const __props = { ..._initialProps };
    const propsSetup = t.variableDeclaration("const", [
      t.variableDeclarator(
        propsId,
        t.objectExpression([t.spreadElement(initialPropsId)])
      )
    ]);

    const destructuredNames = new Set();
    let restoreVars;

    // 3. Restore User Variables
    if (t.isIdentifier(originalParam)) {
      // Case: function Component(p) {}
      // Inject: const p = __props;
      restoreVars = t.variableDeclaration("const", [
        t.variableDeclarator(originalParam, propsId)
      ]);
    } else if (t.isObjectPattern(originalParam)) {
      // Case: function Component({ count }) {}
      // Inject: let { count } = _initialProps;
      // Note: We use _initialProps for the destructuring to get the initial values (snapshot).

      // Track destructured names for replacement in watch
      originalParam.properties.forEach(prop => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.value)) {
          destructuredNames.add(prop.value.name);
        }
      });

      restoreVars = t.variableDeclaration("let", [
        t.variableDeclarator(originalParam, initialPropsId)
      ]);
    }

    // Insert setup code
    if (t.isBlockStatement(path.node.body)) {
      path.node.body.body.unshift(propsSetup, restoreVars);
    }

    // 4. Transform watch() and Return
    path.traverse({
      CallExpression(callPath) {
        if (!t.isIdentifier(callPath.node.callee, { name: "watch" })) return;

        const args = callPath.node.arguments;
        if (args.length < 2) return;

        // Transform deps: [] -> () => []
        if (t.isArrayExpression(args[1])) {
          args[1] = t.arrowFunctionExpression([], args[1]);
        }

        // Helper to replace identifiers in a path (callback or deps)
        const replaceIdentifiers = (targetPath) => {
          targetPath.traverse({
            Identifier(idPath) {
              const name = idPath.node.name;
              // Only replace usage, not declarations or property keys
              // Use idPath.isReferencedIdentifier() which works in Babel 7
              if (
                !idPath.isReferencedIdentifier() ||
                !destructuredNames.has(name)
              ) {
                return;
              }

              // Shadowing Check
              // If the identifier is bound in a scope *inside* the component but *outside* the current usage
              // it means it's shadowed.
              if (idPath.scope.hasBinding(name) && idPath.scope.getBinding(name).scope !== path.scope) {
                return;
              }

              idPath.replaceWith(
                t.memberExpression(propsId, t.identifier(name))
              );
            }
          });
        };

        // Replace in Callback
        if (args[0]) {
          const callbackPath = callPath.get('arguments.0');
          replaceIdentifiers(callbackPath);
        }

        // Replace in Deps (if it's a function now)
        if (args[1] && (t.isArrowFunctionExpression(args[1]) || t.isFunctionExpression(args[1]))) {
          const depsPath = callPath.get('arguments.1');
          replaceIdentifiers(depsPath);
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

            // Inline Update Logic:
            // AEUI.updateProps(__props, _newProps);
            // AEUI._runComponentWatchers(AEUI._currentInstance);
            const updateLogic = [
              t.expressionStatement(
                t.callExpression(
                  t.memberExpression(t.identifier("AEUI"), t.identifier("updateProps")),
                  [propsId, newPropsParam]
                )
              ),
              t.expressionStatement(
                t.callExpression(
                  t.memberExpression(t.identifier("AEUI"), t.identifier("_runComponentWatchers")),
                  [t.memberExpression(t.identifier("AEUI"), t.identifier("_currentInstance"))]
                )
              )
            ];

            // Replace destructured usage in render body
            if (destructuredNames.size > 0) {
              const renderBodyPath = returnPath.get("argument").get("body");

              // Helper to traverse and replace
              const replaceInRender = (bodyPath) => {
                bodyPath.traverse({
                  Identifier(idPath) {
                    const name = idPath.node.name;
                    if (!idPath.isReferencedIdentifier() || !destructuredNames.has(name)) return;

                    // Shadowing check
                    if (idPath.scope.hasBinding(name) && idPath.scope.getBinding(name).scope !== path.scope) return;

                    // Don't replace if it's inside the updateLogic we just added (though we haven't added it to body yet)

                    idPath.replaceWith(t.memberExpression(propsId, t.identifier(name)));
                  }
                });
              }

              // Handle both BlockStatement and Expression (JSX)
              if (t.isBlockStatement(renderFn.body)) {
                // We need to traverse the body path, but we can't easily get the path of the body node itself if we just have the node.
                // We can traverse the `returnPath` again or use the visitor pattern on the function path.
                // Actually `returnPath.get("argument")` gives the function path.
                const fnPath = returnPath.get("argument");
                fnPath.traverse({
                  Identifier(idPath) {
                    const name = idPath.node.name;
                    if (!idPath.isReferencedIdentifier() || !destructuredNames.has(name)) return;
                    if (idPath.scope.hasBinding(name) && idPath.scope.getBinding(name).scope !== path.scope) return;
                    idPath.replaceWith(t.memberExpression(propsId, t.identifier(name)));
                  }
                });
              } else {
                // Expression body (JSX)
                const fnPath = returnPath.get("argument");
                fnPath.traverse({
                  Identifier(idPath) {
                    const name = idPath.node.name;
                    if (!idPath.isReferencedIdentifier() || !destructuredNames.has(name)) return;
                    if (idPath.scope.hasBinding(name) && idPath.scope.getBinding(name).scope !== path.scope) return;
                    idPath.replaceWith(t.memberExpression(propsId, t.identifier(name)));
                  }
                });
              }
            }


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
