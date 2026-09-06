import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AEUI, watch } from 'aeui';
import { resetRuntimeState } from '../../../../packages/core/src/runtime-state.js';

const runtime = AEUI.__runtime;

function resetAeuiRuntime() {
  runtime.stopScheduler();
  resetRuntimeState(runtime.state);
}

function createRoot(container) {
  return runtime.createRootNode(container);
}

function reconcileRoot(container, root, previousNode, nextVNode) {
  const nextNode = runtime.reconcile(container, previousNode, nextVNode, null, root);
  root.children = nextNode ? [nextNode] : [];
  root.firstDom = nextNode ? nextNode.firstDom : null;
  root.lastDom = nextNode ? nextNode.lastDom : null;
  return nextNode;
}

describe('_updateDomProps', () => {
  let div;

  beforeEach(() => {
    div = document.createElement('div');
  });

  it('children, key, ref와 JSX 개발 metadata를 DOM에 설정하지 않음', () => {
    runtime.updateDomProps(div, {
      children: ['child'], key: 'item', ref: () => {},
      __self: { component: 'node' },
      __source: { fileName: 'App.jsx', lineNumber: 1, columnNumber: 1 },
    });

    expect(div.hasAttribute('__self')).toBe(false);
    expect(div.hasAttribute('__source')).toBe(false);
    expect(div.hasAttribute('children')).toBe(false);
    expect(div.hasAttribute('key')).toBe(false);
    expect(div.hasAttribute('ref')).toBe(false);
  });

  it('className 제거 시 빈 문자열로 설정', () => {
    runtime.updateDomProps(div, { className: 'my-class' });
    expect(div.className).toBe('my-class');
    runtime.updateDomProps(div, { className: undefined }, { className: 'my-class' });
    expect(div.className).toBe('');
  });

  it('style 문자열을 객체로 교체하고 이전 속성을 제거', () => {
    runtime.updateDomProps(div, { style: 'color: red' });
    expect(div.style.color).toBe('red');
    runtime.updateDomProps(div, { style: { fontSize: '16px' } }, { style: 'color: red' });
    expect(div.style.color).toBe('');
    expect(div.style.fontSize).toBe('16px');
    runtime.updateDomProps(div, {}, { style: { fontSize: '16px' } });
    expect(div.style.cssText).toBe('');
  });

  it('boolean attribute false 설정 (attribute 제거)', () => {
    const button = document.createElement('button');
    runtime.updateDomProps(button, { disabled: true });
    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('disabled')).toBe(true);
    runtime.updateDomProps(button, { disabled: false }, { disabled: true });
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('ARIA 속성의 false를 문자열로 유지하고 생략 시 제거', () => {
    const enabled = { 'aria-expanded': true };
    const disabled = { 'aria-expanded': false };
    runtime.updateDomProps(div, enabled);
    expect(div.getAttribute('aria-expanded')).toBe('true');
    runtime.updateDomProps(div, disabled, enabled);
    expect(div.getAttribute('aria-expanded')).toBe('false');
    runtime.updateDomProps(div, {}, disabled);
    expect(div.hasAttribute('aria-expanded')).toBe(false);
  });

  it('boolean attribute가 undefined로 제거되면 DOM property도 false로 리셋', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';

    runtime.updateDomProps(checkbox, { checked: true });
    runtime.updateDomProps(checkbox, { checked: undefined }, { checked: true });

    expect(checkbox.checked).toBe(false);
    expect(checkbox.hasAttribute('checked')).toBe(false);
  });

  it('일반 attribute 설정', () => {
    runtime.updateDomProps(div, { id: 'test', 'data-value': '42' });
    expect(div.getAttribute('id')).toBe('test');
    expect(div.getAttribute('data-value')).toBe('42');
  });

  it('value prop은 DOM property와 attribute를 함께 갱신', () => {
    const select = document.createElement('select');
    select.innerHTML = '<option value="PAID">결제 완료</option><option value="DELIVERED">배송 완료</option>';

    runtime.updateDomProps(select, { value: 'PAID' });
    expect(select.value).toBe('PAID');

    runtime.updateDomProps(select, { value: 'DELIVERED' }, { value: 'PAID' });
    expect(select.value).toBe('DELIVERED');
    expect(select.getAttribute('value')).toBe('DELIVERED');
  });

  it('file input은 마운트와 재렌더링 모두 value를 강제로 쓰지 않음', () => {
    for (const type of ['file', 'FILE', 'File']) {
      const container = document.createElement('div');
      const root = createRoot(container);
      let node = reconcileRoot(container, root, null,
        AEUI.createVNode('input', { type, value: 'fake-path' }));
      const input = container.firstChild;
      node = reconcileRoot(container, root, node,
        AEUI.createVNode('input', { type, value: 'next-path' }));
      expect(container.firstChild).toBe(input);
      expect(input.type).toBe('file');
      expect(input.value).toBe('');
      expect(input.getAttribute('value')).toBeNull();
      runtime.unmountNode(node);
    }
  });

  it('input이 text에서 file로 바뀌면 이전 value attribute를 제거함', () => {
    const input = document.createElement('input');
    const oldProps = { value: 'old-path', type: 'text' };

    runtime.updateDomProps(input, oldProps, {});
    expect(input.getAttribute('value')).toBe('old-path');

    runtime.updateDomProps(input, { value: 'fake-path', type: 'file' }, oldProps);

    expect(input.type).toBe('file');
    expect(input.value).toBe('');
    expect(input.getAttribute('value')).toBeNull();
  });

  it('attribute 제거 (undefined)', () => {
    runtime.updateDomProps(div, { id: 'test' });
    runtime.updateDomProps(div, { id: undefined }, { id: 'test' });
    expect(div.hasAttribute('id')).toBe(false);
  });

  it('이벤트 핸들러 등록 및 교체', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    runtime.updateDomProps(div, { onClick: handler1 });
    div.click();
    expect(handler1).toHaveBeenCalledTimes(1);

    runtime.updateDomProps(div, { onClick: handler2 }, { onClick: handler1 });
    div.click();
    expect(handler1).toHaveBeenCalledTimes(1); // 이전 핸들러 미호출
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('이벤트 핸들러 제거 시 기존 리스너 해제', () => {
    const handler = vi.fn();

    runtime.updateDomProps(div, { onClick: handler });
    div.click();
    expect(handler).toHaveBeenCalledTimes(1);

    runtime.updateDomProps(div, { onClick: undefined }, { onClick: handler });
    div.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('이벤트 핸들러가 truthy 비함수로 바뀌면 기존 리스너 해제', () => {
    const handler = vi.fn();

    runtime.updateDomProps(div, { onClick: handler });
    div.click();
    expect(handler).toHaveBeenCalledTimes(1);

    runtime.updateDomProps(div, { onClick: 'invalid-handler' }, { onClick: handler });
    div.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('이벤트 핸들러의 this는 현재 DOM 노드', () => {
    let boundThis = null;
    function handler() {
      boundThis = this;
    }

    runtime.updateDomProps(div, { onClick: handler });
    div.click();

    expect(boundThis).toBe(div);
  });
});

describe('_reconcile 배열 처리', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('배열 길이 감소 시 초과 노드 제거', () => {
    const root = createRoot(container);
    let node = reconcileRoot(container, root, null, ['A', 'B', 'C']);
    const next = ['A', 'B'];
    node = reconcileRoot(container, root, node, next);

    expect(container.childNodes.length).toBe(2);
    expect(container.childNodes[0].nodeValue).toBe('A');
    expect(container.childNodes[1].nodeValue).toBe('B');
  });

  it('배열 길이 증가 시 새 노드 추가', () => {
    const root = createRoot(container);
    let node = reconcileRoot(container, root, null, ['A', 'B']);
    const next = ['A', 'B', 'C'];
    node = reconcileRoot(container, root, node, next);

    expect(container.childNodes.length).toBe(3);
    expect(container.childNodes[2].nodeValue).toBe('C');
  });
});

describe('_reconcile host controlled props', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('select value는 option children mount 이후에도 올바르게 동기화됨', () => {
    const root = createRoot(container);
    const vnode = AEUI.createVNode(
      'select',
      { value: 'DELIVERED' },
      AEUI.createVNode('option', { value: 'PAID' }, '결제 완료'),
      AEUI.createVNode('option', { value: 'DELIVERED' }, '배송 완료')
    );

    reconcileRoot(container, root, null, vnode);

    expect(container.querySelector('select').value).toBe('DELIVERED');
  });

  it('input value는 DOM이 바뀌어도 동일 props로 다시 렌더링하면 복구됨', () => {
    const root = createRoot(container);
    const vnode = AEUI.createVNode('input', { value: 'hello' });

    let node = reconcileRoot(container, root, null, vnode);
    const input = container.querySelector('input');
    input.value = 'user-edit';

    node = reconcileRoot(container, root, node, vnode);

    expect(input.value).toBe('hello');
  });

  it('textarea value는 DOM이 바뀌어도 동일 props로 다시 렌더링하면 복구됨', () => {
    const root = createRoot(container);
    const vnode = AEUI.createVNode('textarea', { value: 'memo' });

    let node = reconcileRoot(container, root, null, vnode);
    const textarea = container.querySelector('textarea');
    textarea.value = 'changed';

    node = reconcileRoot(container, root, node, vnode);

    expect(textarea.value).toBe('memo');
  });

  it('checkbox checked는 DOM이 바뀌어도 동일 props로 다시 렌더링하면 복구됨', () => {
    const root = createRoot(container);
    const vnode = AEUI.createVNode('input', { type: 'checkbox', checked: true });

    let node = reconcileRoot(container, root, null, vnode);
    const input = container.querySelector('input');
    input.checked = false;

    node = reconcileRoot(container, root, node, vnode);

    expect(input.checked).toBe(true);
  });
});

describe('_reconcile mutable host props', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('같은 style 객체를 직접 변이해도 다음 reconcile에서 DOM에 반영됨', () => {
    const root = createRoot(container);
    const style = { color: 'red' };

    let node = reconcileRoot(
      container,
      root,
      null,
      AEUI.createVNode('p', { style }, 'hello')
    );

    expect(container.querySelector('p').style.color).toBe('red');

    style.color = 'blue';
    node = reconcileRoot(
      container,
      root,
      node,
      AEUI.createVNode('p', { style }, 'hello')
    );

    expect(container.querySelector('p').style.color).toBe('blue');
  });
});

describe('_reconcile key 기반 child matching', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  function keyedList(items) {
    return AEUI.createVNode(
      'ul',
      { id: 'list' },
      ...items.map((item) => (
        AEUI.createVNode('li', item.props || {}, item.text)
      ))
    );
  }

  it('keyed DOM 리스트 재정렬 시 기존 DOM 노드를 재사용함', () => {
    const root = createRoot(container);
    const prev = keyedList([
      { text: 'A', props: { key: 'a', 'data-key': 'a' } },
      { text: 'B', props: { key: 'b', 'data-key': 'b' } },
      { text: 'C', props: { key: 'c', 'data-key': 'c' } },
    ]);

    let node = reconcileRoot(container, root, null, prev);
    const beforeNodes = Array.from(container.querySelectorAll('li'));
    const bNode = container.querySelector('[data-key="b"]');

    const next = keyedList([
      { text: 'B', props: { key: 'b', 'data-key': 'b' } },
      { text: 'A', props: { key: 'a', 'data-key': 'a' } },
      { text: 'C', props: { key: 'c', 'data-key': 'c' } },
    ]);

    node = reconcileRoot(container, root, node, next);

    expect(Array.from(container.querySelectorAll('li')).map(node => node.textContent)).toEqual(['B', 'A', 'C']);
    expect(container.querySelector('[data-key="b"]')).toBe(bNode);
    expect(Array.from(container.querySelectorAll('li'))[1]).toBe(beforeNodes[0]);
  });

  it('keyed DOM 리스트 중간 삽입 시 기존 형제 노드를 유지함', () => {
    const root = createRoot(container);
    const prev = keyedList([
      { text: 'A', props: { key: 'a', 'data-key': 'a' } },
      { text: 'B', props: { key: 'b', 'data-key': 'b' } },
      { text: 'C', props: { key: 'c', 'data-key': 'c' } },
    ]);

    let node = reconcileRoot(container, root, null, prev);
    const bNode = container.querySelector('[data-key="b"]');
    const cNode = container.querySelector('[data-key="c"]');

    const next = keyedList([
      { text: 'A', props: { key: 'a', 'data-key': 'a' } },
      { text: 'X', props: { key: 'x', 'data-key': 'x' } },
      { text: 'B', props: { key: 'b', 'data-key': 'b' } },
      { text: 'C', props: { key: 'c', 'data-key': 'c' } },
    ]);

    node = reconcileRoot(container, root, node, next);

    expect(Array.from(container.querySelectorAll('li')).map(node => node.textContent)).toEqual(['A', 'X', 'B', 'C']);
    expect(container.querySelector('[data-key="b"]')).toBe(bNode);
    expect(container.querySelector('[data-key="c"]')).toBe(cNode);
  });

  it('mixed keyed/unkeyed 형제는 key 우선, 나머지는 순차 fallback으로 매칭함', () => {
    const root = createRoot(container);
    const prev = keyedList([
      { text: 'A', props: { key: 'a', 'data-key': 'a' } },
      { text: 'X', props: { className: 'free first' } },
      { text: 'Y', props: { className: 'free second' } },
      { text: 'C', props: { key: 'c', 'data-key': 'c' } },
    ]);

    let node = reconcileRoot(container, root, null, prev);
    const keyedA = container.querySelector('[data-key="a"]');
    const firstFree = container.querySelector('.free.first');
    const secondFree = container.querySelector('.free.second');

    const next = keyedList([
      { text: 'C', props: { key: 'c', 'data-key': 'c' } },
      { text: 'Y', props: { className: 'free first' } },
      { text: 'X', props: { className: 'free second' } },
      { text: 'A', props: { key: 'a', 'data-key': 'a' } },
    ]);

    node = reconcileRoot(container, root, node, next);

    expect(Array.from(container.querySelectorAll('li')).map(node => node.textContent)).toEqual(['C', 'Y', 'X', 'A']);
    expect(container.querySelector('[data-key="a"]')).toBe(keyedA);
    expect(container.querySelector('.free.first')).toBe(firstFree);
    expect(container.querySelector('.free.second')).toBe(secondFree);
  });

  it('duplicate key가 있으면 경고하고 렌더는 계속함', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = createRoot(container);

    const prev = keyedList([
      { text: 'A', props: { key: 'a', 'data-key': 'a' } },
    ]);

    const next = keyedList([
      { text: 'A1', props: { key: 'dup', 'data-key': 'dup-1' } },
      { text: 'A2', props: { key: 'dup', 'data-key': 'dup-2' } },
    ]);

    let node = reconcileRoot(container, root, null, prev);
    node = reconcileRoot(container, root, node, next);

    expect(warnSpy).toHaveBeenCalled();
    expect(Array.from(container.querySelectorAll('li')).map(node => node.textContent)).toEqual(['A1', 'A2']);

    warnSpy.mockRestore();
  });

  it('같은 children으로 다시 렌더링해도 insertBefore로 DOM을 재배치하지 않음', () => {
    const insertBeforeSpy = vi.spyOn(Element.prototype, 'insertBefore');
    const root = createRoot(container);
    const vnode = AEUI.createVNode(
      'div',
      null,
      AEUI.createVNode('span', null, 'A'),
      AEUI.createVNode('span', null, 'B')
    );

    const mounted = reconcileRoot(container, root, null, vnode);
    insertBeforeSpy.mockClear();

    reconcileRoot(container, root, mounted, vnode);

    expect(insertBeforeSpy).not.toHaveBeenCalled();
    insertBeforeSpy.mockRestore();
  });
});

describe('수동 렌더 API', () => {
  let container;
  let increment;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    resetAeuiRuntime();
    container.remove();
  });

  it('AEUI.render()로 즉시 렌더를 트리거할 수 있음', () => {
    function App() {
      let count = 0;
      increment = () => {
        count += 1;
      };
      return () => AEUI.createVNode('div', { id: 'count' }, count);
    }

    AEUI.init(App, container);
    expect(container.querySelector('#count').textContent).toBe('0');

    increment();
    const didMutate = AEUI.render();

    expect(didMutate).toBe(true);
    expect(container.querySelector('#count').textContent).toBe('1');
    expect(runtime.state.frameDelay).toBe(1);
  });
});

describe('에러 처리', () => {

  it('component setup 에러가 발생해도 현재 컴포넌트 컨텍스트가 복구됨', () => {
    let leakedNode = null;
    const BrokenComponent = () => {
      leakedNode = runtime.state.currentComponentNode;
      throw new Error('setup boom');
    };
    const parent = document.createElement('div');
    const root = createRoot(parent);

    expect(() => {
      runtime.reconcile(parent, null, { tag: BrokenComponent, props: {} }, null, root);
    }).toThrow('setup boom');

    expect(runtime.state.currentComponentNode).toBeNull();

    expect(() => {
      watch(() => { }, []);
    }).toThrow(/must be compiled by the AEUI Babel plugin/);
    expect(leakedNode.watchStates.length).toBe(0);
  });

  it('reconcile 중 render 에러가 발생해도 현재 컴포넌트 컨텍스트가 복구됨', () => {
    const parent = document.createElement('div');
    const root = createRoot(parent);
    const vnode = {
      tag: () => () => { throw new Error('render boom'); },
      props: {}
    };

    expect(() => {
      runtime.reconcile(parent, null, vnode, null, root);
    }).toThrow('render boom');

    expect(runtime.state.currentComponentNode).toBeNull();
  });

  it('렌더 실패 중 삽입된 미커밋 DOM은 다음 렌더에 누적되지 않음', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    const container = document.createElement('div');
    document.body.appendChild(container);

    function Broken() {
      throw new Error('setup boom');
    }

    function App() {
      return () => AEUI.createVNode(
        'div',
        { className: 'wrap' },
        AEUI.createVNode('span', null, 'ok'),
        AEUI.createVNode(Broken, null)
      );
    }

    AEUI.init(App, container);
    expect(container.querySelectorAll('.wrap')).toHaveLength(0);
    expect(container.innerHTML).toBe('');

    AEUI.render();
    expect(container.querySelectorAll('.wrap')).toHaveLength(0);
    expect(container.innerHTML).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[AEUI] Render error:',
      expect.objectContaining({ message: 'setup boom' })
    );

    consoleSpy.mockRestore();
    resetAeuiRuntime();
    container.remove();
  });

});
