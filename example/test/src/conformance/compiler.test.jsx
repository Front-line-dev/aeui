import { it, expect, vi } from 'vitest';
import { transformSync, parseSync, traverse } from '@babel/core';
import jsx from '@babel/plugin-transform-react-jsx';
import compiler from 'aeui/babel-plugin';
import { AEUI, watch as observe } from 'aeui';
import Imported, { aliasView, history, Empty, Text, Children } from './fixtures/reexport.js';
import { useRuntime } from './runtime-harness.js';

const app = useRuntime();
function transform(source) {
  return transformSync(source, {
    filename: 'contract.jsx', configFile: false, babelrc: false,
    plugins: [compiler, [jsx, { pragma: 'AEUI.createElement', pragmaFrag: 'AEUI.Fragment' }]],
  });
}

it('[CMP-TYPE.10] import·re-export·props를 통과한 같은 함수는 상태를 보존하고 타입 교체 때만 정리한다', async () => {
  history.length = 0;
  function Other() { return <p>other</p>; }
  function Slot({ View }) { return <View label="current" />; }
  function App() {
    let View = Imported;
    return <main><Slot View={View} /><a onClick={() => View = aliasView}>alias</a><b onClick={() => View = Other}>replace</b></main>;
  }
  const root = app.mount(App), button = root.querySelector('button');
  button.click(); await app.frame();
  root.querySelector('a').click(); await app.frame();
  expect(root.querySelector('button')).toBe(button);
  expect(button.textContent).toBe('current:1');
  expect(history).toEqual(['setup']);
  root.querySelector('b').click(); await app.frame();
  expect(root.querySelector('button')).toBeNull();
  expect(root.querySelector('p').textContent).toBe('other');
  expect(history).toEqual(['setup', 'cleanup']);
});

it('[CMP-CALL.10] JSX helper의 일반 호출은 VNode를 반환하고 callback props를 판별 목적으로 실행하지 않는다', () => {
  const callback = vi.fn();
  function helper({ text }) { return <b>{text}</b>; }
  const plain = helper({ text: 'plain' });
  function App() { const Host = 'section'; return <Host onClick={callback}>{helper({ text: 'nested' })}</Host>; }
  const root = app.mount(App);
  expect(plain.tag).toBe('b');
  expect(typeof plain).not.toBe('function');
  expect(root.querySelector('section').textContent).toBe('nested');
  expect(callback).not.toHaveBeenCalled();
});

it('[CMP-PREPARE.10] JSX 없는 import와 팩토리 반환·수동 render가 유효한 자식만 표시한다', () => {
  function make(value) { return () => <i>{value}</i>; }
  const Made = make('made');
  function Manual({ value }) { return ({ suffix }) => <b>{value}:{suffix}</b>; }
  function App() { return <main><Empty /><Text /><Children><u>child</u></Children><Made /><Manual value="manual" suffix="render" /></main>; }
  const root = app.mount(App);
  expect(root.textContent).toBe('textchildmademanual:render');
  expect(root.querySelectorAll('main > *')).toHaveLength(3);
});

it.each(['async function', 'function*'])('[CMP-PREPARE.11] %s 컴포넌트는 본문 부작용 없이 거부된다', declaration => {
  const body = vi.fn(), error = vi.spyOn(console, 'error').mockImplementation(() => {});
  // 함수 형태의 지원 경계를 검증한다. 사용자 함수는 변환·판별 중 실행하면 안 된다.
  const source = `${declaration} Unsupported() { body(); return AEUI.createElement('p', null, 'bad'); } AEUI.init(Unsupported, container);`;
  run(source, { body, container: app.mount(() => () => null) });
  expect(body).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalled();
});

it.each([null, 0, {}, true])('[CMP-TYPE.11] 잘못된 태그 %s는 VNode로 받아들이지 않는다', value => {
  expect(() => AEUI.createElement(value, null)).toThrow();
});

it('[WATCH-GETTER.10] import 별칭과 재할당 없는 getter는 최신 local 상태를 관찰하며 최초 실행하지 않는다', async () => {
  const values = [];
  function App() {
    let value = 0;
    const deps = () => [value];
    observe(() => values.push(value), deps);
    return <button onClick={() => value++}>{value}</button>;
  }
  const root = app.mount(App);
  expect(values).toEqual([]);
  root.querySelector('button').click(); await app.frame();
  expect(values).toEqual([1]);
  AEUI.render();
  expect(values).toEqual([1]);
});

it.each([
  'import { deps } from "external";',
  'let deps = [1]; deps = [2];',
])('[WATCH-GETTER.11] 모호한 deps는 getter 진단을 내고 변환 성공으로 처리하지 않는다: %s', declaration => {
  expect(() => transform(`import { watch } from 'aeui'; ${declaration} export function View() { watch(() => {}, deps); return <p />; }`)).toThrow(/getter|=>/i);
});

it.each([
  ['true && <i>a</i><b>b</b>', 'ab'],
  ['false && <i>a</i><b>b</b>', ''],
  ['false ? <i>a</i><b>b</b> : <u>c</u><s>d</s>', 'cd'],
  ['[1, 2].map(n => <i>{n}</i><b>{n}</b>)', '1122'],
])('[JSX-AUTO.10] 인접 JSX %s는 같은 분기만 표시하고 wrapper·주석을 삽입하지 않는다', (expression, expected) => {
  const container = app.mount(() => () => null);
  run(`function App() { return <main>{${expression}}</main>; } AEUI.init(App, container);`, { container });
  expect(container.textContent).toBe(expected);
  expect([...container.querySelector('main').childNodes].every(node => node.nodeType === 1)).toBe(true);
  expect(container.querySelector('main > div')).toBeNull();
});

it('[CONFIG-BABEL.10] 문서의 Babel 조합이 일반 호출·문자열·비교식과 다른 모듈의 훅을 보존한다', () => {
  const sink = [];
  const container = app.mount(() => () => null);
  run(`
    function watch(value) { sink.push(value); }
    function helper() { return <i>helper</i>; }
    sink.push('<i/><b/>', 1 < 2, helper().tag);
    function App() { watch('foreign'); return <main>{['a', 'b'].map(value => <span>{value}</span>)}</main>; }
    AEUI.init(App, container);
  `, { sink, container });
  expect(sink).toEqual(['<i/><b/>', true, 'i', 'foreign']);
  expect(container.textContent).toBe('ab');
});

it('[INTERNAL-COMPILER.10] 두 번째 변환에서도 import와 사용자 binding을 보존하고 setup을 한 번만 실행한다', () => {
  const source = `import { AEUI as Framework } from 'aeui';
    const _props = 'user';
    function App() { sink.push(_props); let n = 0; return <button onClick={() => n++}>{n}</button>; }
    Framework.init(App, container);`;
  const once = transform(source).code, twice = transform(once).code;
  const imports = [];
  traverse(parseSync(twice, { configFile: false, babelrc: false }), {
    ImportDeclaration(p) { imports.push(...p.node.specifiers.map(s => s.local.name)); },
  });
  expect(imports).toContain('Framework');
  expect(new Set(imports).size).toBe(imports.length);
  const container = app.mount(() => () => null), sink = [];
  run(twice, { container, sink, Framework: AEUI });
  container.querySelector('button').click();
  AEUI.render();
  expect(container.textContent).toBe('1');
  expect(sink).toEqual(['user']);
});

// 표현식 실행 fixture의 runtime import만 연결한다. 실제 모듈 로딩은 Vite fixture와 extra가 검증한다.
function run(source, bindings) {
  const code = transformSync(transform(source).code, {
    configFile: false, babelrc: false,
    plugins: [() => ({ visitor: { ImportDeclaration(p) {
      if (p.node.source.value !== 'aeui') throw new Error('Unexpected fixture import');
      p.remove();
    } } })],
  }).code;
  new Function('AEUI', ...Object.keys(bindings), code)(AEUI, ...Object.values(bindings));
}
