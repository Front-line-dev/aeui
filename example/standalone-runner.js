import aeuiTransform from '../packages/core/src/babel-plugin.js';

// Babel이 생성한 ESM을 브라우저 모듈로 실행한다. watch/clean도 정식 import로 변환한다.
export async function runStandalone(source) {
  if (!window.Babel) throw new Error('Babel Standalone을 불러오지 못했습니다.');
  const runtimeUrl = new URL('../packages/core/src/index.js', import.meta.url).href;
  const compiled = Babel.transform(`import { AEUI, watch, clean } from 'aeui';\n${source}`, {
    presets: ['react'], plugins: [aeuiTransform], ast: true,
  });
  const linked = Babel.transformFromAst(compiled.ast, compiled.code, {
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) {
        if (path.node.source.value === 'aeui') path.node.source.value = runtimeUrl;
      },
    } })],
  });
  const url = URL.createObjectURL(new Blob([linked.code], { type: 'text/javascript' }));
  try { await import(/* @vite-ignore */ url); }
  finally { URL.revokeObjectURL(url); }
}
