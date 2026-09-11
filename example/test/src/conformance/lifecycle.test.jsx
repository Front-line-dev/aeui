import { it, expect, vi } from 'vitest';
import { AEUI, watch, clean } from 'aeui';
import { useRuntime } from './runtime-harness.js';

const app = useRuntime();

it('[CMP-PROPS.11] 기본값·별칭·rest·children이 최신 props를 읽고 제거한 prop을 남기지 않는다', async () => {
  function Child({ title: label = 'default', children, ...rest }) {
    return <section {...rest}><h1>{label}</h1>{children}</section>;
  }
  function App() {
    let props = { title: 'before', 'data-obsolete': 'remove' }, child = 'old';
    return <main><Child {...props}><b>{child}</b></Child><button onClick={() => { props = {}; child = 'new'; }}>change</button></main>;
  }
  const root = app.mount(App), section = root.querySelector('section');
  expect(section.getAttribute('data-obsolete')).toBe('remove');
  root.querySelector('button').click(); await app.frame();
  expect(root.querySelector('section')).toBe(section);
  expect(section.textContent).toBe('defaultnew');
  expect(section.hasAttribute('data-obsolete')).toBe(false);
  expect(section.textContent).not.toContain('old');
});

it('[JSX-KEY.10] 여러 DOM을 가진 keyed Fragment 재배치가 상태와 node를 보존하고 cleanup을 실행하지 않는다', async () => {
  const setups = [], cleanups = [];
  function Item({ id }) {
    setups.push(id);
    let count = 0;
    clean(() => cleanups.push(id));
    return <><button data-id={id} onClick={() => count++}>{id}:{count}</button><span>{id}</span></>;
  }
  function App() {
    let ids = ['a', 'b', 'c'];
    return <main>{ids.map(id => <AEUI.Fragment key={id}><Item id={id} /></AEUI.Fragment>)}
      <footer><button onClick={() => ids = ['c', 'a', 'b']}>reorder</button></footer></main>;
  }
  const root = app.mount(App);
  const nodes = [...root.querySelector('main').childNodes];
  nodes[0].click();
  await app.frame();
  root.querySelector('footer button').click();
  await app.frame();
  expect([...root.querySelector('main').childNodes]).toEqual([nodes[4], nodes[5], nodes[0], nodes[1], nodes[2], nodes[3], nodes[6]]);
  expect(root.querySelector('[data-id=a]').textContent).toBe('a:1');
  expect(setups).toEqual(['a', 'b', 'c']);
  expect(cleanups).toEqual([]);
  expect(root.querySelectorAll('main > *')).toHaveLength(7);
});

it('[JSX-FRAGMENT.10] 빈 Fragment가 나타났다 사라져도 뒤쪽 형제를 재마운트하지 않는다', async () => {
  const cleanup = vi.fn();
  function Tail() {
    let count = 0;
    clean(cleanup);
    return <button onClick={() => count++}>tail:{count}</button>;
  }
  function App() {
    let visible = false;
    return <main>{visible ? <><i>a</i><b>b</b></> : <></>}<Tail />
      <input type="checkbox" onChange={() => visible = !visible} /></main>;
  }
  const root = app.mount(App), tail = root.querySelector('button');
  tail.click();
  await app.frame();
  for (const visible of [true, false, true]) {
    root.querySelector('input').dispatchEvent(new Event('change', { bubbles: true }));
    await app.frame();
    expect(root.querySelectorAll('i, b')).toHaveLength(visible ? 2 : 0);
    expect(root.querySelector('button')).toBe(tail);
    expect(tail.textContent).toBe('tail:1');
    expect(cleanup).not.toHaveBeenCalled();
  }
});

it('[CMP-PROPS.10] 중첩 구조 분해와 render parameter 기본값이 새 props를 읽고 setup을 반복하지 않는다', async () => {
  const setups = vi.fn();
  function Child({ user: { name = 'anonymous' } = {}, suffix = '!' }) {
    setups();
    let count = 0;
    return ({ label = name + suffix }) => <button onClick={() => count++}>{label}:{count}</button>;
  }
  function App() {
    let props = { user: { name: 'first' }, suffix: '!' };
    return <main><Child {...props} /><a onClick={() => props = { user: {} }}>change</a></main>;
  }
  const root = app.mount(App), button = root.querySelector('button');
  button.click();
  await app.frame();
  root.querySelector('a').click();
  await app.frame();
  expect(button.textContent).toBe('anonymous!:1');
  expect(root.querySelector('button')).toBe(button);
  expect(setups).toHaveBeenCalledTimes(1);
  expect(root.textContent).not.toContain('first');
});

it('[CMP-CAPTURE.01] setup 복사값과 분기는 유지하고 반환 표현식의 props만 갱신한다', async () => {
  function Child(props) {
    const captured = props.value;
    if (props.visible) return <p>{captured}:{props.value}</p>;
    return <b>hidden</b>;
  }
  function App() {
    let value = 'first', visible = true;
    return <main><Child value={value} visible={visible} />
      <button onClick={() => { value = 'second'; visible = false; }}>change</button></main>;
  }
  const root = app.mount(App);
  root.querySelector('button').click();
  await app.frame();
  expect(root.querySelector('p').textContent).toBe('first:second');
  expect(root.querySelector('b')).toBeNull();
});

it('[WATCH-ALWAYS.01] deps 없는 watch가 첫 렌더와 후속 렌더에 실행되며 setup에만 머무르지 않는다', () => {
  const callback = vi.fn();
  function App() { watch(callback); return <p>ready</p>; }
  app.mount(App);
  expect(callback).toHaveBeenCalledTimes(1);
  AEUI.render();
  expect(callback).toHaveBeenCalledTimes(2);
});

it('[HOOK-PHASE.10] 이벤트와 비동기 callback에서 호출한 훅이 등록되거나 나중에 실행되지 않는다', async () => {
  const watched = vi.fn(), cleaned = vi.fn();
  function App() {
    setTimeout(() => { watch(watched); clean(cleaned); }, 32);
    return <button onClick={() => { watch(watched); clean(cleaned); }}>late</button>;
  }
  const root = app.mount(App);
  root.querySelector('button').click();
  await app.advance(64);
  AEUI.render();
  AEUI.init(() => () => null, root);
  expect(watched).not.toHaveBeenCalled();
  expect(cleaned).not.toHaveBeenCalled();
});

it('[HOOK-PHASE.11] render에서 호출한 훅은 등록되지 않으며 setup에서 등록한 훅만 정리한다', () => {
  const wrongWatch = vi.fn(), wrongClean = vi.fn(), setupClean = vi.fn();
  function App() {
    clean(setupClean);
    return () => { watch(wrongWatch); clean(wrongClean); return <p>render</p>; };
  }
  const root = app.mount(App);
  AEUI.render();
  AEUI.init(() => () => null, root);
  expect(wrongWatch).not.toHaveBeenCalled();
  expect(wrongClean).not.toHaveBeenCalled();
  expect(setupClean).toHaveBeenCalledTimes(1);
});

it.each(['setup', 'render', 'sibling'])('[CMP-FAIL.10] %s 실패 뒤 신규 DOM과 자원을 남기지 않고 다음 마운트를 복구한다', stage => {
  const cleaned = [], later = vi.fn();
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  function Good() { clean(() => cleaned.push('good')); return <span>temporary</span>; }
  function Bad() {
    clean(() => cleaned.push('bad'));
    if (stage === 'setup' || stage === 'sibling') throw new Error(stage);
    return () => { throw new Error(stage); };
  }
  function App() {
    clean(() => cleaned.push('app'));
    return <main>{stage === 'sibling' && <Good />}<Bad /><Later /></main>;
  }
  function Later() { later(); return <p>unreachable</p>; }
  const root = app.mount(App);
  expect(root.childNodes).toHaveLength(0);
  expect(cleaned.toSorted()).toEqual(stage === 'sibling' ? ['app', 'bad', 'good'] : ['app', 'bad']);
  expect(later).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledTimes(1);
  const healthyCleanup = vi.fn();
  function Healthy() { clean(healthyCleanup); return <p>recovered</p>; }
  AEUI.init(Healthy, root);
  expect(root.textContent).toBe('recovered');
  AEUI.init(() => () => null, root);
  expect(healthyCleanup).toHaveBeenCalledTimes(1);
  expect(cleaned).toHaveLength(stage === 'sibling' ? 3 : 2);
});

it('[CLEAN.10] 정리한 컴포넌트의 timer와 watch가 이후 프레임에서 다시 실행되지 않는다', async () => {
  const fired = vi.fn(), watched = vi.fn(), cleanup = vi.fn();
  function Child() {
    const timer = setInterval(fired, 32);
    watch(watched);
    clean(() => { clearInterval(timer); cleanup(); });
    return <p>child</p>;
  }
  function App() {
    let show = true;
    return <main>{show && <Child />}<button onClick={() => show = false}>remove</button></main>;
  }
  const root = app.mount(App);
  root.querySelector('button').click();
  await app.frame();
  const calls = watched.mock.calls.length;
  await app.advance(1000);
  expect(root.querySelector('p')).toBeNull();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(fired).not.toHaveBeenCalled();
  expect(watched).toHaveBeenCalledTimes(calls);
});
