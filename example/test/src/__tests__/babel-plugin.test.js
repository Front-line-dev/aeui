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
  it('JSX를 사용하는 파일에 AEUI import를 자동 주입한다', () => {
    const code = transform(`
      export default () => <div>hi</div>;
    `);

    expect(code).toMatch(/import\s+\{\s*AEUI\s*\}\s+from\s+["']aeui["']/);
    expect(code).toMatch(/AEUI\.createElement\("div"/);
  });

  it('기존 aeui import가 있으면 AEUI specifier를 추가한다', () => {
    const code = transform(`
      import { watch } from 'aeui';
      export function App() {
        let count = 0;
        watch(() => {}, [count]);
        return <div>{count}</div>;
      }
    `);

    expect(code).toMatch(/import\s+\{\s*AEUI,\s*watch\s*\}\s+from\s+["']aeui["']/);
    expect(code).toMatch(/AEUI\.__runtime\.watch\(/);
  });

  it('JSX와 compiled helper가 없으면 AEUI import를 주입하지 않는다', () => {
    const code = transform(`
      export default function helper() {
        return 42;
      }
    `);

    expect(code).not.toMatch(/from\s+["']aeui["']/);
  });

  it('JSX를 반환하지 않는 PascalCase 유틸 함수는 컴포넌트로 변환하지 않는다', () => {
    const code = transform(`
      function User(name) {
        return name.toUpperCase();
      }

      console.log(User('kim'));
    `);

    expect(code).toMatch(/function User\(name\)/);
    expect(code).toMatch(/return name\.toUpperCase\(\);/);
    expect(code).not.toMatch(/__props/);
    expect(code).not.toMatch(/runRenderPhase/);
  });

  it('로컬 AEUI binding이 JSX runtime import를 가리면 compile error를 낸다', () => {
    expect(() => transform(`
      const AEUI = { custom: true };
      export default () => <div />;
    `)).toThrow(/Local AEUI bindings conflict/);
  });

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
      export const Greeting = ({ name }) => <p>{name}</p>;
    `);

    expect(code).toMatch(/return _newProps => AEUI\.__runtime\.runRenderPhase\(/);
    expect(code).toMatch(/resolvedProps\.name/);
  });

  it('default parameter를 가진 구조분해 props도 최신 props target을 사용한다', () => {
    const code = transform(`
      import { AEUI } from 'aeui';
      export const Greeting = ({ name } = { name: 'Guest' }) => <p>{name}</p>;
    `);

    expect(code).toMatch(/const _props = \{/);
    expect(code).toMatch(/runRenderPhase\(_newProps, _props,/);
    expect(code).toMatch(/resolvedProps\.name/);
    expect(code).not.toMatch(/runRenderPhase\([^,]+, null,/);
  });

  it('구조분해된 수동 render param을 사용하는 컴포넌트도 변환된다', () => {
    expect(() => transform(`
      import { AEUI } from 'aeui';
      export function App() {
        return ({ value }) => <div>{value}</div>;
      }
    `)).not.toThrow();

    const code = transform(`
      import { AEUI } from 'aeui';
      export function App() {
        return ({ value }) => <div>{value}</div>;
      }
    `);

    expect(code).toMatch(/AEUI\.__runtime\.runRenderPhase\(/);
    expect(code).not.toMatch(/_runComponentWatchers/);
  });

  it('watch와 clean 호출은 runtime hook helper로 변환된다', () => {
    const code = transform(`
      import { AEUI, watch, clean } from 'aeui';
      export function App() {
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
      export function App() {
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
      export function App() {
        let count = 0;
        watch(() => [count], [count]);
        return <div>{count}</div>;
      }
    `);

    expect(code).toMatch(/AEUI\.__runtime\.watch\(\(\) => \[count\], \(\) => \[count\]\)/);
  });

  it('watch(callback)은 deps 없이 runtime helper로 변환한다', () => {
    const withoutDeps = transform(`
      import { AEUI, watch } from 'aeui';
      export function App() {
        watch(() => {});
        return <div />;
      }
    `);

    expect(withoutDeps).toMatch(/AEUI\.__runtime\.watch\(\(\) => \{\}\)/);
    expect(withoutDeps).not.toMatch(/\n\s*watch\(/);
  });

  it('options 인자가 있는 watch 호출은 runtime helper로 변환하지 않는다', () => {
    const withOptions = transform(`
      import { AEUI, watch } from 'aeui';
      export function App() {
        let count = 0;
        watch(() => {}, [count], { immediate: true });
        return <div>{count}</div>;
      }
    `);

    expect(withOptions).not.toMatch(/AEUI\.__runtime\.watch\(/);
  });

  it('watch(callback)의 구조분해 props 참조를 최신값 조회로 변환한다', () => {
    const code = transform(`
      import { AEUI, watch } from 'aeui';
      export function App({ value }) {
        watch(() => console.log(value));
        return <div>{value}</div>;
      }
    `);

    expect(code).toMatch(/AEUI\.__runtime\.watch\(\(\) => \{/);
    expect(code).toMatch(/const _resolvedProps\d* = _resolveProps\d*\(\)/);
    expect(code).toMatch(/console\.log\(_resolvedProps\d*\.value\)/);
  });
});
