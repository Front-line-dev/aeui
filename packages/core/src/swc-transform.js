import { Compiler } from '@swc/core';
import remapping from '@jridgewell/remapping';
import parseFragments from './swc-fragments.js';
import transformComponents from './swc-components.js';

export default function transform(source, options = {}) {
  const { filename = 'module.jsx', development = false, sourceMaps = true } = options;
  const typescript = /\.tsx?$/.test(filename);
  const parser = typescript ? { syntax: 'typescript', tsx: filename.endsWith('.tsx') }
    : { syntax: 'ecmascript', jsx: true };
  // One compiler owns parsing and emission, including source positions.
  const compiler = new Compiler();
  const parsed = parseFragments(source, code => compiler.parseSync(code, { ...parser, target: 'es2022' }, filename), filename);
  const result = compiler.transformSync(transformComponents(parsed.program), {
    filename, swcrc: false, configFile: false, sourceMaps,
    jsc: { parser, target: 'es2022', transform: { react: { runtime: 'automatic', importSource: 'aeui', development } } },
  });
  if (result.map && parsed.map) result.map = JSON.stringify(remapping([JSON.parse(result.map), parsed.map], () => null));
  return result;
}
