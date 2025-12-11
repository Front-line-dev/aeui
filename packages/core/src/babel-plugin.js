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
    
    if (isExported && varName && /^[A-Z]/.test(varName)) {
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
   * Converts `({ count }) => ...` to `(props) => { let { count } = props; ... }`
   * And adds logic to update `props` when `newProps` are received.
   */
  const injectReactiveProps = (path) => {
    const params = path.node.params;
    if (params.length === 0) return;
    if (!t.isObjectPattern(params[0])) return;

    const propsParam = params[0];
    const newParamName = path.scope.generateUidIdentifier("props");
    path.node.params = [newParamName];

    const destructuringDecl = t.variableDeclaration("let", [
      t.variableDeclarator(propsParam, newParamName)
    ]);
    
    if (t.isBlockStatement(path.node.body)) {
       path.node.body.body.unshift(destructuringDecl);
       
       path.traverse({
           ReturnStatement(returnPath) {
               if (returnPath.getFunctionParent().node === path.node) {
                   const arg = returnPath.node.argument;
                   // We expect the return argument to be a function (the factory) by now
                   if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
                       const renderFn = arg;
                       
                       // Avoid re-injecting if already present
                       if (renderFn.params.length > 0 && renderFn.params[0].name.startsWith("_newProps")) {
                           return; 
                       }

                       const newPropsParam = path.scope.generateUidIdentifier("newProps");
                       renderFn.params = [newPropsParam];
                       
                       const updateLogic = t.ifStatement(
                           newPropsParam,
                           t.expressionStatement(
                               t.assignmentExpression(
                                   "=",
                                   propsParam, 
                                   newPropsParam
                               )
                           )
                       );
                       
                       if (t.isBlockStatement(renderFn.body)) {
                           renderFn.body.body.unshift(updateLogic);
                       } else {
                           renderFn.body = t.blockStatement([
                               updateLogic,
                               t.returnStatement(renderFn.body)
                           ]);
                       }
                   }
               }
           }
       });
    }
  };

  return {
    visitor: {
      CallExpression(path) {
        // 1. Watch Dependencies: watch(fn, []) -> watch(fn, () => [])
        if (t.isIdentifier(path.node.callee, { name: "watch" })) {
          const args = path.node.arguments;
          if (args.length >= 2 && t.isArrayExpression(args[1])) {
             args[1] = t.arrowFunctionExpression([], args[1]);
          }
        }
      },
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
