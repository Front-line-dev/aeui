import Babel from '@babel/standalone';
import aeuiTransform from '../../packages/core/src/babel-plugin.js';

// Keep editable snippets bounded: an accidental infinite loop must be stoppable.
function playgroundGuards({ types: t }) {
  const check = () => t.expressionStatement(t.callExpression(t.identifier('__aeuiCheckBudget'), []));
  return {
    visitor: {
      ImportDeclaration(path) {
        if (path.node.source.value !== 'aeui') {
          throw path.buildCodeFrameError("이 예제에서는 'aeui' import만 사용할 수 있습니다.");
        }
      },
      'WhileStatement|DoWhileStatement|ForStatement|ForInStatement|ForOfStatement'(path) {
        if (!t.isBlockStatement(path.node.body)) path.node.body = t.blockStatement([path.node.body]);
        path.node.body.body.unshift(check());
      },
    },
  };
}

export function compile(source) {
  if (source.length > 30000) throw new Error('예제 코드는 30,000자 이내로 작성해 주세요.');
  return Babel.transform(source, {
    filename: 'Playground.jsx',
    sourceType: 'module',
    plugins: [
      aeuiTransform,
      playgroundGuards,
      ['transform-react-jsx', { pragma: 'AEUI.createElement', pragmaFrag: 'AEUI.Fragment' }],
      'transform-modules-commonjs',
    ],
  }).code;
}
