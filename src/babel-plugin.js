export default function aeuiTransform({ types: t }) {
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
      ArrowFunctionExpression(path) {
        // Component Identification Strategy
        let isComponent = false;
        let varName = null;
        let isExported = false;

        // 1. Identify Variable Name & Export Status
        if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
          varName = path.parent.id.name;
          const binding = path.scope.getBinding(varName);
          if (binding) {
             // Check if exported
             // binding.path is VariableDeclarator
             // binding.path.parentPath is VariableDeclaration
             // binding.path.parentPath.parentPath is ExportNamedDeclaration (if exported)
             const parent = binding.path.parentPath;
             const grandParent = parent.parentPath;
             isExported = (grandParent && (grandParent.isExportNamedDeclaration() || grandParent.isExportDefaultDeclaration())) ||
                          (parent.isExportNamedDeclaration() || parent.isExportDefaultDeclaration());
             
             binding.referencePaths.forEach(refPath => {
               if (t.isJSXOpeningElement(refPath.parent) && refPath.parent.name === refPath.node) {
                 isComponent = true;
               }
               else if (
                   t.isCallExpression(refPath.parent) && 
                   refPath.parent.arguments.length > 0 && 
                   refPath.parent.arguments[0] === refPath.node
               ) {
                   isComponent = true;
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
        if (isComponent) {
            // Confirmed
        } else if (isExported && varName && /^[A-Z]/.test(varName)) {
            isComponent = true;
        } else {
            return;
        }

        // Helper to check for JSX or Transformed JSX
        const isJSX = (node) => {
            if (!node) return false;
            if (t.isJSXElement(node) || t.isJSXFragment(node)) return true;
            if (t.isParenthesizedExpression(node)) return isJSX(node.expression);
            
            if (t.isCallExpression(node)) {
                return true; 
            }
            return false;
        };

        // 3. Transform: Return (JSX) -> Return () => (JSX)
        
        // Handle Expression Body
        if (isJSX(path.node.body)) {
          path.node.body = t.arrowFunctionExpression([], path.node.body);
        } 
        // Handle Block Statement Body
        else if (t.isBlockStatement(path.node.body)) {
          path.traverse({
            ReturnStatement(returnPath) {
              if (returnPath.getFunctionParent().node === path.node) { 
                if (isJSX(returnPath.node.argument)) {
                  if (t.isArrowFunctionExpression(returnPath.node.argument) || t.isFunctionExpression(returnPath.node.argument)) {
                      return;
                  }
                  returnPath.node.argument = t.arrowFunctionExpression([], returnPath.node.argument);
                }
              }
            }
          });
        }

        // 4. Props Destructuring & Updates
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
                       if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
                           const renderFn = arg;
                           
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
      }
    }
  };
}
