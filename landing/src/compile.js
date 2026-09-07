import { getMessages } from './i18n.js';
import Babel from '@babel/standalone';
import aeuiTransform from '../../packages/core/src/babel-plugin.js';

// Keep editable snippets bounded: an accidental infinite loop must be stoppable.
function playgroundGuards({ types: t }, { locale }) {
  const check = () => t.expressionStatement(t.callExpression(t.identifier('__aeuiCheckBudget'), []));
  return {
    visitor: {
      ImportDeclaration(path) {
        if (path.node.source.value !== 'aeui') {
          throw path.buildCodeFrameError(getMessages(locale).ui.importError);
        }
      },
      'WhileStatement|DoWhileStatement|ForStatement|ForInStatement|ForOfStatement'(path) {
        if (!t.isBlockStatement(path.node.body)) path.node.body = t.blockStatement([path.node.body]);
        path.node.body.body.unshift(check());
      },
    },
  };
}

export function compile(source, locale = 'en') {
  if (source.length > 30000) throw new Error(getMessages(locale).ui.sourceLimit);
  return Babel.transform(source, {
    filename: 'Playground.jsx',
    sourceType: 'module',
    plugins: [
      aeuiTransform,
      [playgroundGuards, { locale }],
      ['transform-react-jsx', { pragma: 'AEUI.createElement', pragmaFrag: 'AEUI.Fragment' }],
      'transform-modules-commonjs',
    ],
  }).code;
}
