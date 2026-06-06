import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import aeuiPlugin from '../../../../packages/core/src/babel-plugin.js';

function transform(code) {
  return transformSync(code, {
    filename: 'sample.jsx',
    configFile: false,
    babelrc: false,
    plugins: [
      aeuiPlugin,
      ['@babel/plugin-transform-react-jsx', {
        pragma: 'AEUI.createElement',
        pragmaFrag: 'AEUI.Fragment',
      }],
    ],
  }).code;
}

describe('AEUI Babel Plugin', () => {
  it('익명 default export 화살표 컴포넌트를 render factory로 변환한다', () => {
    const code = transform(`
      import { AEUI } from 'aeui';
      export default () => <div>hi</div>;
    `);

    expect(code).toMatch(/export default \(\) => \{/);
    expect(code).toMatch(/return _newProps => AEUI\.__runtime\.runRenderPhase\(/);
    expect(code).not.toMatch(/_runComponentWatchers/);
    expect(code).toMatch(/AEUI\.createElement\("div"/);
  });

  it('named default export helper는 컴포넌트로 오인 변환하지 않는다', () => {
    const code = transform(`
      import { AEUI } from 'aeui';
      export default function helper() {
        return () => 42;
      }
    `);

    expect(code).not.toMatch(/_runComponentWatchers/);
    expect(code).not.toMatch(/return _newProps =>/);
    expect(code).toMatch(/return \(\) => 42;/);
  });

  it('anonymous default export helper도 컴포넌트로 오인 변환하지 않는다', () => {
    const code = transform(`
      import { AEUI } from 'aeui';
      export default () => () => 42;
    `);

    expect(code).not.toMatch(/_runComponentWatchers/);
    expect(code).not.toMatch(/return _newProps =>/);
    expect(code).toMatch(/export default \(\) => \(\) => 42;/);
  });

  it('expression-body 구조분해 props가 render 함수에서 최신 props를 참조한다', () => {
    const code = transform(`
      import { AEUI } from 'aeui';
      const Greeting = ({ name }) => <p>{name}</p>;
    `);

    expect(code).toMatch(/return _newProps => AEUI\.__runtime\.runRenderPhase\(/);
    expect(code).toMatch(/resolvedProps\.name/);
  });

  it('구조분해된 수동 render param을 사용하는 컴포넌트도 변환된다', () => {
    expect(() => transform(`
      import { AEUI } from 'aeui';
      function App() {
        return ({ value }) => <div>{value}</div>;
      }
    `)).not.toThrow();

    const code = transform(`
      import { AEUI } from 'aeui';
      function App() {
        return ({ value }) => <div>{value}</div>;
      }
    `);

    expect(code).toMatch(/AEUI\.__runtime\.runRenderPhase\(/);
    expect(code).not.toMatch(/_runComponentWatchers/);
  });

  it('watch와 clean 호출은 runtime hook helper로 변환된다', () => {
    const code = transform(`
      import { AEUI, watch, clean } from 'aeui';
      function App() {
        let count = 0;
        watch(() => {}, [count]);
        clean(() => {});
        return <div>{count}</div>;
      }
    `);

    expect(code).toMatch(/AEUI\.__runtime\.watch\(/);
    expect(code).toMatch(/AEUI\.__runtime\.clean\(/);
    expect(code).not.toMatch(/\n\s*watch\(/);
  });

  it('named callback watch(callback, deps)는 runtime helper로 변환된다', () => {
    const code = transform(`
      import { AEUI, watch } from 'aeui';
      function App() {
        let count = 0;
        const syncCount = () => count;
        watch(syncCount, [count]);
        return <div>{count}</div>;
      }
    `);

    expect(code).toMatch(/AEUI\.__runtime\.watch\(syncCount, \(\) => \[count\]\)/);
  });

  it('배열을 반환하는 callback도 callback-first watch로 변환한다', () => {
    const code = transform(`
      import { AEUI, watch } from 'aeui';
      function App() {
        let count = 0;
        watch(() => [count], [count]);
        return <div>{count}</div>;
      }
    `);

    expect(code).toMatch(/AEUI\.__runtime\.watch\(\(\) => \[count\], \(\) => \[count\]\)/);
  });

  it('deps 생략과 options 인자는 watch helper로 변환하지 않는다', () => {
    const withoutDeps = transform(`
      import { AEUI, watch } from 'aeui';
      function App() {
        watch(() => {});
        return <div />;
      }
    `);

    const withOptions = transform(`
      import { AEUI, watch } from 'aeui';
      function App() {
        let count = 0;
        watch(() => {}, [count], { immediate: true });
        return <div>{count}</div>;
      }
    `);

    expect(withoutDeps).not.toMatch(/AEUI\.__runtime\.watch\(/);
    expect(withOptions).not.toMatch(/AEUI\.__runtime\.watch\(/);
  });
});
