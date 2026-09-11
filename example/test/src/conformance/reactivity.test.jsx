import { it, expect, vi } from 'vitest';
import { AEUI, watch, clean } from 'aeui';
import { useRuntime } from './runtime-harness.js';

const app = useRuntime();

it.each(['click', 'input', 'change', 'keydown'])('[REACT-EVENT.10] 유휴 뒤 %s 변경은 수동 render 없이 다음 프레임에 반영되며 setup을 반복하지 않는다', async eventName => {
  const setups = vi.fn(), callback = vi.fn();
  function App() {
    setups();
    let value = 0;
    watch(callback, [value]);
    const handlers = { ['on' + eventName[0].toUpperCase() + eventName.slice(1)]: () => value++ };
    return <input {...handlers} value={value} />;
  }
  const root = app.mount(App), input = root.querySelector('input');
  await app.advance(4096);
  expect(callback).not.toHaveBeenCalled();
  input.dispatchEvent(new Event(eventName, { bubbles: true }));
  await app.frame();
  expect(input.value).toBe('1');
  expect(callback).toHaveBeenCalledTimes(1);
  expect(setups).toHaveBeenCalledTimes(1);
  expect(root.querySelector('input')).toBe(input);
});

it('[REACT-POLL.10] 외부 Promise 변경은 유휴 polling에서 감지하고 동일값을 다시 알리지 않는다', async () => {
  const callback = vi.fn();
  let deliver;
  function App() {
    let value = 'waiting';
    deliver = async () => { await Promise.resolve(); value = 'received'; };
    watch(callback, [value]);
    return <p>{value}</p>;
  }
  const root = app.mount(App);
  await app.advance(4096);
  await deliver();
  await app.advance(1008); // 16 ms 가상 프레임에서 약 1초 계약을 관찰한다.
  expect(root.textContent).toBe('received');
  expect(callback).toHaveBeenCalledTimes(1);
  await app.advance(1008);
  expect(callback).toHaveBeenCalledTimes(1);
});

it('[WATCH-DEPS.10] deps는 최초와 동일값에서 조용하고 변경마다 한 번 실행한다', async () => {
  const values = [];
  function App() {
    let value = 'a';
    watch(() => values.push(value), [value]);
    return <><input value={value} onInput={e => value = e.target.value} /><p>{value}</p></>;
  }
  const root = app.mount(App), input = root.querySelector('input');
  expect(values).toEqual([]);
  for (const value of ['a', 'b', 'b', 'c']) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await app.frame();
    expect(root.querySelector('p').textContent).toBe(value);
    expect(values).toEqual(value === 'a' ? [] : value === 'b' ? ['b'] : ['b', 'c']);
  }
});

it('[REACT-DEEP.10] 직접 배열 변경과 중첩 변이를 감지하며 같은 값의 새 객체는 중복 알림을 만들지 않는다', async () => {
  const calls = [];
  function App() {
    let state = { items: [{ amount: 2 }] };
    watch(() => calls.push(state.items.map(item => item.amount)), [state]);
    return <main><p>{state.items.map(item => item.amount).join(',')}</p>
      <button onClick={() => state.items.push({ amount: 3 })}>append</button>
      <button onClick={() => state.items[0].amount++}>mutate</button>
      <button onClick={() => state = { items: state.items.map(item => ({ ...item })) }}>equal copy</button></main>;
  }
  const root = app.mount(App), buttons = root.querySelectorAll('button');
  buttons[0].click(); await app.frame();
  expect(root.querySelector('p').textContent).toBe('2,3');
  buttons[1].click(); await app.frame();
  expect(root.querySelector('p').textContent).toBe('3,3');
  buttons[2].click(); await app.frame();
  expect(calls).toEqual([[2, 3], [3, 3]]);
});

it('[MANUAL.10] 수동 render는 외부 변경을 즉시 반영하고 뒤 polling에서 watch를 중복 실행하지 않는다', async () => {
  let update;
  const callback = vi.fn();
  function App() {
    let count = 0;
    update = () => count = 7;
    watch(callback, [count]);
    return <p>{count}</p>;
  }
  const root = app.mount(App);
  update();
  AEUI.render();
  expect(root.textContent).toBe('7');
  expect(callback).toHaveBeenCalledTimes(1);
  await app.advance(1008);
  expect(callback).toHaveBeenCalledTimes(1);
});

it('[CLEAN.11] cleanup 오류가 있어도 등록 순서대로 한 번 정리하고 형제 상태를 건드리지 않는다', async () => {
  const events = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Removed() {
    clean(() => { events.push(1); throw new Error('cleanup'); });
    clean(() => events.push(2));
    return <i>removed</i>;
  }
  function Retained() {
    let count = 0;
    clean(() => events.push('retained'));
    return <button onClick={() => count++}>retained:{count}</button>;
  }
  function App() {
    let show = true;
    return <main>{show && <Removed key="removed" />}<Retained key="retained" /><a onClick={() => show = false}>remove</a></main>;
  }
  const root = app.mount(App), retained = root.querySelector('button');
  retained.click(); await app.frame();
  root.querySelector('a').click(); await app.frame();
  AEUI.render();
  expect(events).toEqual([1, 2]);
  expect(root.querySelector('i')).toBeNull();
  expect(root.querySelector('button')).toBe(retained);
  expect(retained.textContent).toBe('retained:1');
});

it('[INTERNAL-WATCH.10] watcher는 최신 props로 등록 순서대로 실행하며 오류가 뒤 watcher와 DOM commit을 막지 않는다', async () => {
  const events = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Child({ value }) {
    let computed = 'initial';
    watch(() => { events.push(`first:${value}`); throw new Error('watch'); }, [value]);
    watch(() => { events.push(`second:${value}`); computed = value.toUpperCase(); }, [value]);
    return <p>{computed}</p>;
  }
  function App() {
    let value = 'a';
    return <main><Child value={value} /><button onClick={() => value = 'b'}>change</button></main>;
  }
  const root = app.mount(App);
  root.querySelector('button').click(); await app.frame();
  expect(events).toEqual(['first:b', 'second:b']);
  expect(root.querySelector('p').textContent).toBe('B');
});
