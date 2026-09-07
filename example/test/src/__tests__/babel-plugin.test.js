import { describe, it, expect, afterEach } from 'vitest';
import { parseSync, transformSync, types as t } from '@babel/core';
import * as aeui from 'aeui';
import aeuiPlugin from '../../../../packages/core/src/babel-plugin.js';
import { resetRuntimeState } from '../../../../packages/core/src/runtime-state.js';

function transform(code) {
  return transformSync(code, {
    filename: 'sample.jsx', configFile: false, babelrc: false,
    plugins: [aeuiPlugin, ['@babel/plugin-transform-react-jsx', {
      pragma: 'AEUI.createElement', pragmaFrag: 'AEUI.Fragment',
    }]],
  }).code;
}

// 변환된 모듈을 실제 AEUI와 실행한다. import/export만 테스트 실행 환경에 연결한다.
function evaluate(code) {
  const result = transformSync(code, {
    configFile: false, babelrc: false,
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) {
        if (path.node.source.value !== 'aeui') throw new Error('Unexpected test import');
        path.replaceWithMultiple(path.node.specifiers.map((specifier) => t.variableDeclaration('const', [
          t.variableDeclarator(specifier.local, t.isImportNamespaceSpecifier(specifier)
            ? t.identifier('__module')
            : t.memberExpression(t.identifier('__module'), t.isImportDefaultSpecifier(specifier)
              ? t.identifier('default') : specifier.imported)),
        ])));
      },
      ExportDefaultDeclaration(path) {
        path.replaceWith(t.expressionStatement(t.assignmentExpression('=',
          t.memberExpression(t.identifier('__exports'), t.identifier('default')),
          t.toExpression(path.node.declaration))));
      },
      ExportNamedDeclaration(path) {
        const declaration = path.node.declaration;
        const names = Object.keys(t.getOuterBindingIdentifiers(declaration));
        path.replaceWithMultiple([declaration, ...names.map((name) => t.expressionStatement(
          t.assignmentExpression('=', t.memberExpression(t.identifier('__exports'), t.identifier(name)), t.identifier(name))
        ))]);
      },
    } })],
  });
  return new Function('__module', `const __exports = {};\n${result.code}\nreturn __exports;`)(aeui);
}

afterEach(() => {
  const runtime = aeui.AEUI.__runtime;
  runtime.stopScheduler();
  for (const child of runtime.state.rootNode?.children || []) runtime.unmountNode(child);
  resetRuntimeState(runtime.state);
});

describe('AEUI Babel Plugin', () => {
  it('기존 import binding을 보존하면서 필요한 AEUI import를 한 번만 주입', () => {
    for (const original of [
      '',
      "import { watch as observe } from 'aeui';",
      "import DefaultRuntime, { clean } from 'aeui';",
      "import * as framework from 'aeui';",
    ]) {
      const code = transform(`${original}\nexport default () => <div />;`);
      const imports = parseSync(code).program.body.filter(t.isImportDeclaration);
      const specifiers = imports.flatMap((declaration) => declaration.specifiers);
      expect(specifiers.filter((specifier) => specifier.local.name === 'AEUI')).toHaveLength(1);
      const originalBindings = parseSync(original).program.body.flatMap((declaration) =>
        declaration.specifiers.map((specifier) => specifier.local.name));
      expect(specifiers.map((specifier) => specifier.local.name)).toEqual(expect.arrayContaining(originalBindings));
    }
  });

  it('일반 함수와 콜백의 반환값을 컴포넌트로 오인하지 않음', () => {
    const code = transform(`
      export function User(name) { return name.toUpperCase(); }
      export const doubled = [1, 2].map(value => value * 2);
      export default () => () => 42;
    `);
    expect(parseSync(code).program.body.some(t.isImportDeclaration)).toBe(false);
    const result = evaluate(code);
    expect(result.User('kim')).toBe('KIM');
    expect(result.doubled).toEqual([2, 4]);
    expect(result.default()()).toBe(42);
  });

  it('익명 default 컴포넌트의 setup은 한 번 실행되고 이벤트 이후 상태가 반영됨', () => {
    const result = evaluate(transform(`
      export const setups = [];
      export default () => {
        setups.push('setup');
        let count = 0;
        return <button onClick={() => count++}>{count}</button>;
      };
    `));
    const container = document.createElement('div');
    aeui.AEUI.init(result.default, container);
    container.querySelector('button').click();
    aeui.AEUI.render();
    aeui.AEUI.render();
    expect(container.textContent).toBe('1');
    expect(result.setups).toEqual(['setup']);
  });

  it('두 번 변환해도 사용자 변수와 수동 render 인자를 보존하고 최신 props를 반영', () => {
    const source = `
      export function Child({ value }) {
        const _props = 'local';
        const _newProps = 'kept';
        return ({ suffix }) => <span>{_props}:{_newProps}:{value}:{suffix}</span>;
      }
      export function App() {
        let value = 1;
        return <div><Child value={value} suffix="ok" /><button onClick={() => value++}>+</button></div>;
      }
    `;
    const { App } = evaluate(transform(transform(source)));
    const container = document.createElement('div');
    aeui.AEUI.init(App, container);
    expect(container.querySelector('span').textContent).toBe('local:kept:1:ok');
    container.querySelector('button').click();
    aeui.AEUI.render();
    expect(container.querySelector('span').textContent).toBe('local:kept:2:ok');
  });

  it('다른 모듈과 지역 함수의 watch/clean 호출은 AEUI 훅으로 바꾸지 않음', () => {
    const code = transform(`
      import { watch, clean } from 'other-library';
      export function App() {
        watch(() => {}, [1]); clean(() => {});
        function local(watch) { watch('local'); }
        local(value => value);
        return <div />;
      }
    `);
    const calls = [];
    transformSync(code, { configFile: false, babelrc: false, plugins: [() => ({ visitor: {
      CallExpression(path) {
        const callee = path.node.callee;
        if (t.isIdentifier(callee, { name: 'watch' }) || t.isIdentifier(callee, { name: 'clean' })) {
          calls.push(callee.name);
        }
      },
    } })] });
    // Both the ordinary callable and its setup entry retain foreign/local hooks.
    expect(calls).toEqual(['watch', 'clean', 'watch', 'watch', 'clean', 'watch']);
  });

  it('정적으로 판별할 수 없는 watch deps는 명시적 getter 안내와 함께 거부', () => {
    for (const declaration of [
      "import { deps } from './state.js';",
      'let deps = [1]; deps = [2];',
    ]) {
      expect(() => transform(`
        import { watch } from 'aeui';
        ${declaration}
        export function App() { watch(() => {}, deps); return <div />; }
      `)).toThrow(/Ambiguous watch dependency.*explicit getter/);
    }
  });

  it('로컬 AEUI binding이 JSX runtime import를 가리면 compile error를 냄', () => {
    expect(() => transform(`
      const AEUI = { custom: true };
      export default () => <div />;
    `)).toThrow(/Local AEUI bindings conflict/);
  });
});
