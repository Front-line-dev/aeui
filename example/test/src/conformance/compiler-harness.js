import { transformSync } from '@babel/core';
import babelJsx from '@babel/plugin-transform-react-jsx';
import babelJsxDev from '@babel/plugin-transform-react-jsx-development';
import { transformSync as swc } from '@swc/core';
import compiler from 'aeui/babel-plugin';
import nativeSwc from 'aeui/swc';
import * as api from 'aeui';
import * as runtime from 'aeui/jsx-runtime';
import * as devRuntime from 'aeui/jsx-dev-runtime';

export function compile(source, backend) {
  if (backend.startsWith('swc')) return nativeSwc(source, { filename: 'contract.jsx', development: backend === 'swc-dev' }).code;
  const prepared = transformSync(source, {
    filename: 'contract.jsx', configFile: false, babelrc: false,
    parserOpts: { plugins: ['jsx'] }, plugins: [compiler],
  }).code;
  return transformSync(prepared, {
    filename: 'contract.jsx', configFile: false, babelrc: false,
    plugins: [[backend === 'babel-dev' ? babelJsxDev : babelJsx, backend === 'classic'
      ? { runtime: 'classic', pragma: 'AEUI.createElement', pragmaFrag: 'AEUI.Fragment' }
      : { runtime: 'automatic', importSource: 'aeui' }]],
  }).code;
}

export function execute(code, bindings = {}, imports = {}) {
  const modules = { aeui: api, 'aeui/jsx-runtime': runtime, 'aeui/jsx-dev-runtime': devRuntime, ...imports };
  // Only module syntax is lowered here. Actual package resolution is tested in extra.
  const commonjs = swc(code, { swcrc: false, configFile: false,
    jsc: { target: 'es2022' }, module: { type: 'commonjs' } }).code;
  const exports = {};
  new Function('exports', 'require', ...Object.keys(bindings), commonjs)(exports, name => {
    if (!Object.hasOwn(modules, name)) throw new Error(`Unexpected fixture import: ${name}`);
    return modules[name];
  }, ...Object.values(bindings));
  return exports;
}

