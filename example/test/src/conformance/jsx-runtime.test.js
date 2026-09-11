import { it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import { transformSync as swc } from '@swc/core';
import compiler from 'aeui/babel-plugin';
import * as api from 'aeui';
import * as runtime from 'aeui/jsx-runtime';
import * as devRuntime from 'aeui/jsx-dev-runtime';
import { useRuntime } from './runtime-harness.js';
import { compile, execute } from './compiler-harness.js';

const app = useRuntime();
const automatic = ['babel', 'babel-dev', 'swc', 'swc-dev'];

it.each([...automatic, 'classic'])('[JSX-RUNTIME.10] %s 변환은 keyed 상태·최신 props·watch·cleanup을 보존한다', async backend => {
  const history = [];
  const { App } = execute(compile(`
    import { watch, clean } from 'aeui';
    function Item({ row }) {
      history.push('setup:' + row.id);
      let count = 0;
      watch(() => history.push('watch:' + row.label), [row.label]);
      clean(() => history.push('clean:' + row.id));
      return <button data-id={row.id} onClick={() => count++}>{row.label}:{count}</button>;
    }
    export function App() {
      let rows = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
      return <main>
        {rows.map(row => <Item key={row.id} row={row} />)}
        <a onClick={() => rows.reverse()}>reverse</a>
        <i onClick={() => rows[0].label = 'changed'}>label</i>
        <b onClick={() => rows = []}>remove</b>
      </main>;
    }
  `, backend), { history });
  const root = app.mount(App);
  const [a, b] = root.querySelectorAll('button');
  a.click(); await app.frame();
  expect(a.textContent).toBe('A:1');
  root.querySelector('a').click(); await app.frame();
  expect([...root.querySelectorAll('button')]).toEqual([b, a]);
  expect(a.textContent).toBe('A:1');
  root.querySelector('i').click(); await app.frame();
  expect(b.textContent).toBe('changed:0');
  expect(history).toEqual(['setup:a', 'setup:b', 'watch:changed']);
  root.querySelector('b').click(); await app.frame();
  expect(root.querySelectorAll('button')).toHaveLength(0);
  expect(history).toEqual(['setup:a', 'setup:b', 'watch:changed', 'clean:b', 'clean:a']);
});

it.each(automatic)('[JSX-RUNTIME.11] %s의 단일·다중 자식과 자동 Fragment는 classic과 같은 VNode를 만든다', backend => {
  const source = `export const views = [
    <section>{[0, null, false, [1, 2]]}</section>,
    <section>{[0, null, false, [1, 2]]}<b>end</b></section>,
    <><i>a</i><b>b</b></>,
    true && <i>a</i><b>b</b>
  ];`;
  const expected = execute(compile(source, 'classic')).views;
  const actual = execute(compile(source, backend)).views;
  expect(actual).toEqual(expected);
  expect(actual[2].tag).toBe(api.AEUI.Fragment);
  expect(actual[3].tag).toBe(api.AEUI.Fragment);
});

it.each(automatic)('[JSX-RUNTIME.12] %s는 spread 위치와 nullish·숫자 key를 보존하고 입력 props를 수정하지 않는다', backend => {
  const source = `export const before = <i key="first" {...props} />;
    export const after = <i {...props} key="last" />;`;
  for (const key of [undefined, null, 0, '', 'spread']) {
    const props = Object.freeze({ key, title: 'kept' });
    const result = execute(compile(source, backend), { props });
    expect(result.before.props.key).toBe(key);
    expect(result.after.props.key).toBe('last');
    expect(result.before.props).not.toBe(props);
    expect(props).toEqual({ key, title: 'kept' });
  }
  expect(execute(compile(source, backend), { props: {} }).before.props.key).toBe('first');
});

it.each(automatic)('[JSX-RUNTIME.13] %s는 children prop을 표시하고 JSX 자식을 우선하며 개발 metadata를 DOM에 넣지 않는다', backend => {
  const { App } = execute(compile(`export function App() {
    return <>
      <section children="prop" />
      <section {...{ children: 'spread' }} key="fallback" />
      <section {...{ children: 'ignored' }} key="last">child</section>
    </>;
  }`, backend));
  const root = app.mount(App);
  expect([...root.children].map(node => node.textContent)).toEqual(['prop', 'spread', 'child']);
  expect([...root.children].map(node => node.getAttributeNames())).toEqual([[], [], []]);
  expect([...root.childNodes].every(node => node.nodeType === 1)).toBe(true);
});

it.each(automatic)('[JSX-RUNTIME.14] %s 결과를 AEUI로 다시 변환해도 setup을 중복 등록하거나 상태를 초기화하지 않는다', async backend => {
  const history = [];
  const once = compile(`export function App() {
    history.push('setup'); let count = 0;
    return <button onClick={() => count++}>{count}</button>;
  }`, backend);
  const { App } = execute(compile(once, backend), { history });
  const root = app.mount(App);
  root.querySelector('button').click(); await app.frame();
  expect(root.textContent).toBe('1');
  expect(history).toEqual(['setup']);
});

it('[JSX-RUNTIME.15] 공개 runtime은 frozen children을 복사하고 잘못된 태그를 거부한다', () => {
  const children = Object.freeze([0, false, null, 'text']);
  const props = Object.freeze({ children, key: 0 });
  const source = Object.freeze({ fileName: 'source.jsx', lineNumber: 1 });
  for (const create of [runtime.jsx, runtime.jsxs, (tag, input) => devRuntime.jsxDEV(tag, input, undefined, true, source, {})]) {
    const vnode = create('section', props);
    expect(vnode.children).toEqual([0, 'text']);
    expect(vnode.props.children).toBe(vnode.children);
    expect(vnode.children).not.toBe(children);
    expect(vnode.props.key).toBe(0);
    expect(vnode.props).not.toHaveProperty('__source');
    for (const invalid of [null, 42, {}, true]) expect(() => create(invalid, props)).toThrow(/Invalid element type/);
  }
  expect(children).toEqual([0, false, null, 'text']);
  expect(devRuntime.Fragment).toBe(runtime.Fragment);
  expect(() => api.createElement(null, props)).toThrow(/Invalid element type/);
});

it('[JSX-RUNTIME.16] Babel 다음의 SWC TSX 변환은 상태 갱신과 원본 source map을 유지한다', async () => {
  const source = `export function App() {
    let count: number = 0;
    return <button onClick={() => count++}>{count}</button>;
  }`;
  const prepared = transformSync(source, {
    filename: 'contract.tsx', configFile: false, babelrc: false, sourceMaps: true,
    parserOpts: { plugins: ['jsx', 'typescript'] }, plugins: [compiler],
  });
  const result = swc(prepared.code, {
    filename: 'contract.tsx', swcrc: false, configFile: false,
    inputSourceMap: JSON.stringify(prepared.map), sourceMaps: true,
    jsc: { target: 'es2022', parser: { syntax: 'typescript', tsx: true },
      transform: { react: { runtime: 'automatic', importSource: 'aeui' } } },
  });
  const map = JSON.parse(result.map);
  expect(map.sources).toContain('contract.tsx');
  expect(map.sourcesContent).toContain(source);
  const root = app.mount(execute(result.code).App);
  root.querySelector('button').click(); await app.frame();
  expect(root.textContent).toBe('1');
});
