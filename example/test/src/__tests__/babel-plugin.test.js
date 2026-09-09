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

// 계약: docs/user-scenario/04-jsx-and-rendering.md — Fragment 자동 처리
describe('Fragment 자동 처리', () => {
  it.each([
    ['<i>A</i><b>B</b><u>C</u>', '<><i>A</i><b>B</b><u>C</u></>'],
    ['true && <i>A</i><b>B</b>', 'true && <><i>A</i><b>B</b></>'],
    ['false && <i>A</i><b>B</b>', 'false && <><i>A</i><b>B</b></>'],
    ['true ? <i>A</i><b>B</b> : <u>C</u><s>D</s>', 'true ? <><i>A</i><b>B</b></> : <><u>C</u><s>D</s></>'],
    ['false ? <i>A</i><b>B</b> : <u>C</u><s>D</s>', 'false ? <><i>A</i><b>B</b></> : <><u>C</u><s>D</s></>'],
    ['<div>{true && <i>A</i><b>B</b>}</div><u>C</u>', '<><div>{true && <><i>A</i><b>B</b></>}</div><u>C</u></>'],
    ['<><i>A</i></><b>B</b>', '<><><i>A</i></><b>B</b></>'],
    ['[1, 2].map(n => <i>{n}</i><b>{n}</b>)', '[1, 2].map(n => <><i>{n}</i><b>{n}</b></>)'],
    ['<i>A</i> /* <fake/> */ <b>B</b>', '<><i>A</i><b>B</b></>'],
    ['<i>A</i> // <fake/>\n <b>B</b>', '<><i>A</i><b>B</b></>'],
    ['(<i>A</i><b>B</b>).children.length', '(<><i>A</i><b>B</b></>).children.length'],
    ['<i>A</i><b>B</b>.children.length', '(<><i>A</i><b>B</b></>).children.length'],
    ['[<i>A</i><b>B</b>, <u>C</u><s>D</s>]', '[<><i>A</i><b>B</b></>, <><u>C</u><s>D</s></>]'],
    ['<div item={<i>A</i><b>B</b>} /><u>C</u>', '<><div item={<><i>A</i><b>B</b></>} /><u>C</u></>'],
  ])('명시적 Fragment와 같은 값을 반환한다: %s', (automatic, explicit) => {
    const run = (expression) => evaluate(transform(`export function value() { return (${expression}); }`)).value();
    expect(run(automatic)).toEqual(run(explicit));
  });

  it('setup 1回、イベント更新、条件分岐と兄弟DOMの削除・再挿入を保つ', () => {
    const { App, setups } = evaluate(transform(`
      export const setups = [];
      export function App() {
        setups.push('setup');
        let count = 0;
        let visible = true;
        return (
          <button onClick={() => { count++; visible = !visible; }}>{count}</button>
          <main>{visible && <i>{count}</i><b>shown</b>}</main>
          <footer>end</footer>
        );
      }
    `));
    const container = document.createElement('div');
    aeui.AEUI.init(App, container);
    const button = container.querySelector('button');
    const footer = container.querySelector('footer');
    expect([...container.children].map((node) => node.tagName)).toEqual(['BUTTON', 'MAIN', 'FOOTER']);
    expect(container.querySelector('main').innerHTML).toBe('<i>0</i><b>shown</b>');
    button.click();
    aeui.AEUI.render();
    expect(container.querySelector('main').innerHTML).toBe('');
    button.click();
    aeui.AEUI.render();
    expect(container.querySelector('main').innerHTML).toBe('<i>2</i><b>shown</b>');
    expect(container.querySelector('button')).toBe(button);
    expect(container.querySelector('footer')).toBe(footer);
    expect(setups).toEqual(['setup']);
  });

  it('일반 JSX 자식, 배열, 문자열, 템플릿과 비교식은 그대로 유지한다', () => {
    const { values } = evaluate(transform(`
      export const values = [
        <div><i>A</i><b>B</b></div>, [<i>A</i>, <b>B</b>],
        '<i/><b/>', \`<i/><b/>\`, 1 < 2, /<i\\/><b\\/>/.source,
      ];
    `));
    expect(values[0].tag).toBe('div');
    expect(values[0].children.map((child) => child.tag)).toEqual(['i', 'b']);
    expect(values[1].map((child) => child.tag)).toEqual(['i', 'b']);
    expect(values.slice(2)).toEqual(['<i/><b/>', '<i/><b/>', true, '<i\\/><b\\/>']);
  });

  it('자동 Fragment가 포함된 결과도 재변환할 수 있다', () => {
    const once = transform('export function App() { return <i>A</i><b>B</b>; }');
    const twice = transform(once);
    expect(evaluate(twice).App()).toEqual(evaluate(once).App());
  });

  it('AST와 source map은 삽입 전 원본 위치를 가리킨다', () => {
    const source = 'const view = <i>A</i><b>B</b>;\nconst next = <u>C</u><s>D</s>;';
    const ast = parseSync(source, {
      configFile: false, babelrc: false, plugins: [aeuiPlugin],
      parserOpts: { plugins: ['jsx'], ranges: true },
    });
    const fragment = ast.program.body[0].declarations[0].init;
    const second = fragment.children[1].expression;
    expect(second.start).toBe(source.indexOf('<b>'));
    expect(second.end).toBe(source.indexOf('</b>') + 4);
    expect(second.range).toEqual([second.start, second.end]);
    expect(second.loc.start).toMatchObject({ line: 1, column: second.start, index: second.start });
    expect(ast.program.body[1].loc.start).toMatchObject({ line: 2, column: 0 });
    const result = transformSync(source, {
      filename: 'sample.jsx', configFile: false, babelrc: false, sourceMaps: true,
      plugins: [aeuiPlugin, ['@babel/plugin-transform-react-jsx', {
        pragma: 'AEUI.createElement', pragmaFrag: 'AEUI.Fragment',
      }]],
    });
    expect(result.map.sourcesContent).toEqual([source]);
  });

  it.each([
    'const view = <i/><b/>; const = 1;',
    'const view = <i/><b wrong={}/>;',
    'const view = <i/><b></wrong>;',
    'const view = <i/><b>;',
  ])('잘못된 문법은 계속 오류로 보고한다: %s', (source) => {
    expect(() => transform(source)).toThrow(SyntaxError);
  });

  it('Fragment 다음 문법 오류의 열 위치가 밀리지 않는다', () => {
    const source = 'const view = <i/><b/>; const = 1;';
    try {
      transform(source);
      expect.unreachable('문법 오류가 필요하다');
    } catch (error) {
      expect(error.loc).toMatchObject({ line: 1, column: source.lastIndexOf('=') });
    }
  });
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
