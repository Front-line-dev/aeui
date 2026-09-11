import { it, expect, vi } from 'vitest';
import transform from 'aeui/swc';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { compile, execute } from './compiler-harness.js';
import { useRuntime } from './runtime-harness.js';

const app = useRuntime();

it.each(['babel', 'swc'])('[SWC-COMPILER.10] %s는 nested/default/rest props와 shadow된 변수·JSX 태그를 구분한다', async backend => {
  const seen = [];
  const { App } = execute(compile(`
    import { watch as observe } from 'aeui';
    function Child({ title: label = 'default', nested: { count }, View, ...rest }) {
      const initial = label;
      observe(() => seen.push([label, count, rest.extra]), [label, count, rest.extra]);
      return <section>
        <View text={label} />
        <b>{initial}:{count}:{rest.extra}</b>
        {['shadow'].map(label => <i>{label}</i>)}
      </section>;
    }
    function Label({text}) { return <u>{text}</u>; }
    export function App() {
      let title, nested = {count: 1}, extra = 'a';
      return <main><Child title={title} nested={nested} View={Label} extra={extra}/>
        <button onClick={() => {title='next'; nested.count=2; extra='b';}}>change</button></main>;
    }
  `, backend), { seen });
  const root = app.mount(App), section = root.querySelector('section');
  expect(section.textContent).toBe('defaultdefault:1:ashadow');
  root.querySelector('button').click(); await app.frame();
  expect(root.querySelector('section')).toBe(section);
  expect(section.textContent).toBe('nextdefault:2:bshadow');
  expect(seen).toEqual([['next', 2, 'b']]);
});

it.each(['babel', 'swc'])('[SWC-COMPILER.11] %s는 일반 호출의 this·arguments·재귀 이름·추론된 이름을 보존한다', backend => {
  const module = execute(compile(`
    export function make(prefix) {
      const Named = function self({value}) { return <b>{this.tag}:{arguments[0].value}:{self === Named ? 'same' : 'wrong'}</b>; };
      const Arrow = () => <i>{this.tag}:{arguments[0]}</i>;
      return {Named, Arrow};
    }
    export const Inferred = () => <u/>;
    export default () => <s/>;
  `, backend));
  const {Named, Arrow} = module.make.call({tag:'outer'}, 'prefix');
  expect(Named.name).toBe('self');
  expect(module.Inferred.name).toBe('Inferred');
  expect(module.default.name).toBe('default');
  expect(Named.call({tag:'inner'}, {value:'value'}).children.join('')).toBe('inner:value:same');
  expect(Arrow.call({tag:'ignored'}).children.join('')).toBe('outer:prefix');
});

it.each(['babel', 'swc'])('[SWC-COMPILER.12] %s는 별칭·재할당·객체 속성의 함수와 수동 render를 등록한다', async backend => {
  const { App } = execute(compile(`
    const content = 'resolved';
    function hidden() { return content; }
    const registry = { View: hidden };
    const Alias = registry.View;
    function Manual({title}) {
      const render = ({suffix = title}) => <b>{title}:{suffix}</b>;
      return render;
    }
    export function App() {
      let View = Alias, title='initial';
      return <main><View/><Manual title={title}/><button onClick={() => {View=Other; title='next';}}>change</button></main>;
    }
    function Other() { return 'other'; }
  `, backend));
  const root = app.mount(App);
  expect(root.textContent).toBe('resolvedinitial:initialchange');
  root.querySelector('button').click(); await app.frame();
  // A named render helper keeps the values captured during setup.
  expect(root.textContent).toBe('otherinitial:initialchange');
});

it.each(['babel', 'swc'])('[SWC-COMPILER.13] %s는 hook 별칭을 인식하고 동명의 지역 함수를 보존한다', async backend => {
  const seen = [];
  const { App } = execute(compile(`
    import {watch as observe, clean as dispose} from 'aeui';
    export function App() {
      let count=0;
      const deps=()=>[count];
      function watch(value) { seen.push(value); }
      watch('local'); observe(()=>seen.push(count),deps); dispose(()=>seen.push('clean'));
      return <button onClick={()=>count++}>{count}</button>;
    }
  `, backend), {seen});
  const root = app.mount(App);
  root.querySelector('button').click(); await app.frame();
  expect(seen).toEqual(['local',1]);
  app.mount(() => () => null);
  expect(seen).toEqual(['local',1,'clean']);
});

it.each(['babel', 'swc'])('[SWC-COMPILER.14] %s는 모호한 watch deps를 진단하고 비동기 컴포넌트 본문을 실행하지 않는다', backend => {
  for (const declaration of ['import {deps} from "external";', 'let deps=[1]; deps=[2];']) {
    expect(() => compile(`${declaration} import {watch} from 'aeui'; export function App(){watch(()=>{},deps);return <p/>;}`, backend)).toThrow(/explicit getter/);
  }
  const body = vi.fn(), error = vi.spyOn(console,'error').mockImplementation(()=>{});
  for (const declaration of ['async function', 'function*']) {
    const { App } = execute(compile(`export ${declaration} App(){body();return <p/>;}`, backend),{body});
    app.mount(App);
  }
  expect(body).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalled();
});

it('[SWC-COMPILER.15] SWC TSX의 인접 Fragment와 한글·emoji source map은 원본 위치를 가리킨다', async () => {
  const source = `const text: string = '한글😀';
export default function App() {
  let count: number = 0;
  return <button onClick={() => count++}>{text}:{count}</button>/* 주석 */<b>끝</b>;
}`;
  const result = transform(source, {filename:'unicode.tsx'});
  const root = app.mount(execute(result.code).default);
  expect(root.textContent).toBe('한글😀:0끝');
  root.querySelector('button').click(); await app.frame();
  expect(root.textContent).toBe('한글😀:1끝');
  const map = new TraceMap(result.map);
  expect(map.sourcesContent).toEqual([source]);
  const lines=result.code.split('\n');
  const line=lines.findIndex(value=>value.includes('한글'));
  const original=originalPositionFor(map,{line:line+1,column:lines[line].indexOf('한글')});
  expect(original).toMatchObject({source:'unicode.tsx',line:1});
});

it('[SWC-COMPILER.16] SWC Fragment 보정은 문자열·정규식·주석을 바꾸지 않고 잘못된 문법을 거부한다', () => {
  const {values, view} = execute(transform(String.raw`
    export const values=['<i/><b/>', /<i\/><b\/>/.source, '한글😀'];
    export const view = <main>{true ? <i>a</i>/* <x/><y/> */<b>b</b> : <u>c</u><s>d</s>}</main>;
  `).code);
  expect(values).toEqual(['<i/><b/>',new RegExp('<i/><b/>').source,'한글😀']);
  expect(view.children[0].children.map(child=>child.children[0])).toEqual(['a','b']);
  for (const source of ['const view=<i/><b/>; const = 1;', 'const view=<i/><b value={}/>;', 'const view=<i/><b></wrong>;']) expect(()=>transform(source)).toThrow();
});
