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
    }

    // --- Watch & Return transformation (always runs) ---
    // 4. Transform watch() and Return
    path.traverse({
      CallExpression(callPath) {
        if (!t.isIdentifier(callPath.node.callee, { name: "watch" })) return;

        const args = callPath.node.arguments;
        if (args.length < 2) return;

        // Transform deps: [] -> () => []
        if (t.isArrayExpression(args[1])) {
          const depsPath = callPath.get('arguments.1');
          depsPath.replaceWith(t.arrowFunctionExpression([], t.cloneNode(args[1], true)));
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

        // Replace in Callback (only if has destructured prop names)
        if (args[0] && destructuredNames.size > 0 && propsId) {
          const callbackPath = callPath.get('arguments.0');
          replaceIdentifiers(callbackPath);
        }

        // Replace in Deps (if it's a function now and has destructured prop names)
        if (args[1] && destructuredNames.size > 0 && propsId && (t.isArrowFunctionExpression(args[1]) || t.isFunctionExpression(args[1]))) {
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
                  [t.memberExpression(t.identifier("AEUI"), t.identifier("_currentInstance"))]
                )
              )
            );

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

                    // Replace with __props.name
                    idPath.replaceWith(t.memberExpression(propsId, t.identifier(name)));
                  }
                });
              }

              // Apply replacement to the render function body (whether block or expression)
              // We traverse the function itself to cover parameters and body, but we filter by scope/shadowing
              const fnPath = returnPath.get("argument");
              replaceInRender(fnPath);
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
