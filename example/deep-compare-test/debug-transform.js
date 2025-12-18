import { transformSync } from '@babel/core';
import fs from 'fs';
import path from 'path';
import aeuiTransform from '../../packages/core/src/babel-plugin.js';
import jsxPlugin from '@babel/plugin-transform-react-jsx';

const appCode = fs.readFileSync(path.resolve('src/App.jsx'), 'utf-8');

console.log('Transpiling src/App.jsx...');

try {
  const { code } = transformSync(appCode, {
    plugins: [
      aeuiTransform,
      [jsxPlugin, { pragma: 'AEUI.createElement', pragmaFrag: 'AEUI.Fragment' }]
    ],
    filename: 'App.jsx',
    babelrc: false,
    configFile: false
  });

  fs.writeFileSync('debug-output.js', code);
  console.log('Successfully wrote transpiled code to debug-output.js');
} catch (error) {
  console.error('Error during transpilation:', error);
  process.exit(1);
}
