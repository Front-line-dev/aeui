import { it, expect, vi } from 'vitest';
import { AEUI, clean } from 'aeui';
import { useRuntime } from './runtime-harness.js';

const app = useRuntime();

it.each([null, undefined, true, false])('[JSX-HIDDEN.10] %s 자식은 숨기되 0과 문자열은 지우지 않는다', value => {
  function App() { return <main>{value}{0}{'visible'}</main>; }
  const root = app.mount(App);
  expect(root.querySelector('main').textContent).toBe('0visible');
  expect(root.querySelector('main').children).toHaveLength(0);
});

it('[JSX-CONDITIONAL.10] 조건과 리스트 제거가 DOM에서 사라지고 다른 항목을 삭제하지 않는다', async () => {
  const removed = vi.fn();
  function Notice() { clean(removed); return <strong>notice</strong>; }
  function App() {
    let show = true, values = ['one', 'two'];
    return <main>{show && <Notice />}{values.map(value => <p key={value}>{value}</p>)}
      <button onClick={() => { show = false; values.splice(0, 1); }}>remove</button></main>;
  }
  const root = app.mount(App), two = root.querySelectorAll('p')[1];
  root.querySelector('button').click(); await app.frame();
  expect(root.querySelector('strong')).toBeNull();
  expect([...root.querySelectorAll('p')]).toEqual([two]);
  expect(removed).toHaveBeenCalledTimes(1);
  AEUI.render();
  expect(removed).toHaveBeenCalledTimes(1);
});

it('[JSX-DUPLICATE.10] 고유 key는 경고하지 않고 중복 key는 문서의 경고를 출력한다', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  function App() {
    let keys = ['a', 'b'];
    return <main>{keys.map(key => <i key={key}>{key}</i>)}<button onClick={() => keys = ['a', 'a']}>duplicate</button></main>;
  }
  const root = app.mount(App);
  expect(warn).not.toHaveBeenCalled();
  root.querySelector('button').click(); await app.frame();
  expect(warn).toHaveBeenCalledWith('[AEUI] Duplicate key detected in sibling list: a');
});

it('[JSX-STYLE.10] className과 문자열·객체 style을 갱신하고 빠진 스타일을 남기지 않는다', async () => {
  function App() {
    let props = { className: 'before', style: 'color: red; margin-top: 9px' };
    return <main><p {...props}>style</p><button onClick={() => props = { className: 'after', style: { color: 'blue' } }}>change</button></main>;
  }
  const root = app.mount(App), p = root.querySelector('p');
  expect(p.className).toBe('before');
  expect(p.style.marginTop).toBe('9px');
  root.querySelector('button').click(); await app.frame();
  expect(p.className).toBe('after');
  expect(p.style.color).toBe('blue');
  expect(p.style.marginTop).toBe('');
});

it.each(['text', 'checkbox', 'textarea', 'select'])('[DOM-CONTROL.10] %s DOM 변조를 다음 렌더에서 복구하며 node를 교체하지 않는다', type => {
  function App() {
    return <main>{type === 'select' ? <select value="b"><option value="a">A</option><option value="b">B</option></select>
      : type === 'textarea' ? <textarea value="saved" /> : <input type={type} value="saved" checked={true} />}</main>;
  }
  const root = app.mount(App), input = root.querySelector('input, textarea, select');
  if (type === 'checkbox') input.checked = false;
  else input.value = type === 'select' ? 'a' : 'tampered';
  AEUI.render();
  expect(root.querySelector('input, textarea, select')).toBe(input);
  if (type === 'checkbox') expect(input.checked).toBe(true);
  else expect(input.value).toBe(type === 'select' ? 'b' : 'saved');
});

it('[DOM-FILE.10] file input value를 강제하지 않으며 text에서 전환한 이전 value도 남기지 않는다', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  function App() {
    let type = 'text';
    return <main><input type={type} value="saved" /><button onClick={() => type = 'file'}>file</button></main>;
  }
  const root = app.mount(App), input = root.querySelector('input');
  root.querySelector('button').click(); await app.frame();
  AEUI.render();
  expect(input.type).toBe('file');
  expect(input.value).toBe('');
  expect(input.hasAttribute('value')).toBe(false);
  expect(errors).not.toHaveBeenCalled();
});

it('[INTERNAL-DOM.11] 이벤트 객체를 현재 handler에만 전달하고 제거한 handler를 호출하지 않는다', async () => {
  const old = vi.fn(), current = vi.fn();
  function App() {
    let handler = old;
    return <main><button onClick={handler}>target</button><a onClick={() => handler = current}>replace</a><b onClick={() => handler = null}>remove</b></main>;
  }
  const root = app.mount(App), target = root.querySelector('button');
  expect(old).not.toHaveBeenCalled();
  root.querySelector('a').click(); await app.frame();
  const event = new MouseEvent('click', { bubbles: true });
  target.dispatchEvent(event);
  expect(current).toHaveBeenCalledWith(event);
  expect(old).not.toHaveBeenCalled();
  root.querySelector('b').click(); await app.frame();
  target.click();
  expect(current).toHaveBeenCalledTimes(1);
});

it.each([
  ['onClick', 'click'], ['onInput', 'input'], ['onChange', 'change'], ['onSubmit', 'submit'],
  ['onKeyDown', 'keydown'], ['onMouseEnter', 'mouseenter'], ['onFocus', 'focus'], ['onBlur', 'blur'],
])('[DOM-EVENT.10] %s는 %s 이벤트 객체를 한 번 전달하고 다른 이벤트에는 실행하지 않는다', (prop, type) => {
  const handler = vi.fn();
  function App() { return <input {...{ [prop]: handler }} />; }
  const root = app.mount(App), input = root.querySelector('input');
  input.dispatchEvent(new Event('unrelated'));
  expect(handler).not.toHaveBeenCalled();
  const event = type === 'keydown' ? new KeyboardEvent(type, { key: 'Enter' }) : new Event(type);
  input.dispatchEvent(event);
  expect(handler).toHaveBeenCalledExactlyOnceWith(event);
  if (type === 'keydown') expect(handler.mock.calls[0][0].key).toBe('Enter');
});

it('[DOM-FORM.10] 입력값과 checkbox를 submit에 반영하며 기본 submit을 취소한다', async () => {
  const submitted = vi.fn();
  function App() {
    let text = '', checked = false;
    return <form onSubmit={event => { event.preventDefault(); submitted(text, checked); }}>
      <input value={text} onInput={event => text = event.target.value} />
      <input type="checkbox" checked={checked} onChange={event => checked = event.target.checked} />
    </form>;
  }
  const root = app.mount(App), [text, checkbox] = root.querySelectorAll('input');
  text.value = 'hello'; text.dispatchEvent(new Event('input', { bubbles: true }));
  checkbox.checked = true; checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  await app.frame();
  const event = new Event('submit', { bubbles: true, cancelable: true });
  expect(root.querySelector('form').dispatchEvent(event)).toBe(false);
  expect(event.defaultPrevented).toBe(true);
  expect(submitted).toHaveBeenCalledExactlyOnceWith('hello', true);
});
