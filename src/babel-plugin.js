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
        // 0. Safety Check: Only transform components (assigned to variables/props), not callbacks (like map).
        // We assume components are defined as const Comp = ... or obj.Comp = ...
        if (
          !t.isVariableDeclarator(path.parent) &&
          !t.isAssignmentExpression(path.parent) &&
          !t.isObjectProperty(path.parent)
        ) {
          return;
        }

        // 1. Component Return: return (JSX) -> return () => (JSX)
        // We do this for ALL arrow functions that return JSX, regardless of params.
        if (t.isBlockStatement(path.node.body)) {
           const returnStmt = path.node.body.body.find(node => t.isReturnStatement(node));
           
           if (returnStmt) {
               // Check if returning JSX directly (or parenthesized JSX)
               let isJSX = t.isJSXElement(returnStmt.argument) || t.isJSXFragment(returnStmt.argument);
               if (!isJSX && t.isParenthesizedExpression(returnStmt.argument)) {
                   isJSX = t.isJSXElement(returnStmt.argument.expression) || t.isJSXFragment(returnStmt.argument.expression);
               }

               if (isJSX) {
                   returnStmt.argument = t.arrowFunctionExpression([], returnStmt.argument);
               }
           }
        }

        // 2. Props Destructuring & Updates
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
           
           const returnStmt = path.node.body.body.find(node => t.isReturnStatement(node));
           
           if (returnStmt) {
               // Now apply the prop update logic if it's a function (which it is now if it was JSX)
               if (t.isArrowFunctionExpression(returnStmt.argument) || t.isFunctionExpression(returnStmt.argument)) {
                   const renderFn = returnStmt.argument;
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
      }
    }
  };
}
