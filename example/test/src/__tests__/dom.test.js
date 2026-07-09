import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AEUI, watch } from 'aeui';
import { cloneHostPropsSnapshot } from '../../../../packages/core/src/dom-host.js';
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

  it('children prop을 DOM에 설정하지 않음', () => {
    runtime.updateDomProps(div, { children: ['child1', 'child2'] });
    expect(div.hasAttribute('children')).toBe(false);
  });

  it('key, ref prop을 DOM에 설정하지 않음', () => {
    runtime.updateDomProps(div, { key: 'k1', ref: {} });
    expect(div.hasAttribute('key')).toBe(false);
    expect(div.hasAttribute('ref')).toBe(false);
  });

  it('JSX 개발 metadata prop을 DOM에 설정하지 않음', () => {
    runtime.updateDomProps(div, {
      __self: { component: 'node' },
      __source: { fileName: 'App.jsx', lineNumber: 1, columnNumber: 1 },
    });

    expect(div.hasAttribute('__self')).toBe(false);
    expect(div.hasAttribute('__source')).toBe(false);
  });

  it('JSX 개발 metadata prop은 host props snapshot에서 제외', () => {
    const deepClone = vi.fn((value) => value);
    const self = { kind: 'component' };
    self.parent = self;

    const snapshot = cloneHostPropsSnapshot(
      { deepClone },
      {
        id: 'ok',
        __self: self,
        __source: { fileName: 'App.jsx', lineNumber: 1, columnNumber: 1 },
      }
    );

    expect(snapshot).toEqual({ id: 'ok' });
    expect(deepClone).toHaveBeenCalledTimes(1);
    expect(deepClone).toHaveBeenCalledWith('ok');
  });

  it('className을 class attribute로 설정', () => {
    runtime.updateDomProps(div, { className: 'my-class' });
    expect(div.className).toBe('my-class');
  });

  it('className 제거 시 빈 문자열로 설정', () => {
    runtime.updateDomProps(div, { className: 'my-class' });
    runtime.updateDomProps(div, { className: undefined }, { className: 'my-class' });
    expect(div.className).toBe('');
  });

  it('style 문자열 처리', () => {
    runtime.updateDomProps(div, { style: 'color: red' });
    expect(div.style.cssText).toContain('color');
  });

  it('style 객체 처리', () => {
    runtime.updateDomProps(div, { style: { color: 'red', fontSize: '16px' } });
    expect(div.style.color).toBe('red');
    expect(div.style.fontSize).toBe('16px');
  });

  it('boolean attribute true 설정', () => {
    runtime.updateDomProps(div, { disabled: true });
    expect(div.disabled).toBe(true);
    expect(div.hasAttribute('disabled')).toBe(true);
  });

  it('boolean attribute false 설정 (attribute 제거)', () => {
    runtime.updateDomProps(div, { disabled: true });
    runtime.updateDomProps(div, { disabled: false }, { disabled: true });
    expect(div.disabled).toBe(false);
    expect(div.hasAttribute('disabled')).toBe(false);
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

  it('file input에는 value property를 강제로 쓰지 않음', () => {
    const input = document.createElement('input');
    input.type = 'file';

    expect(() => {
      runtime.updateDomProps(input, { type: 'file', value: 'fake-path' });
    }).not.toThrow();

    expect(input.getAttribute('value')).toBeNull();
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

describe('_unmountNode', () => {
  it('isMounted를 false로 설정하고 _domNodeCount를 0으로 초기화', () => {
    const node = {
      kind: 'component',
      isMounted: true,
      _domNodeCount: 3,
      cleanups: [],
      children: [],
      watchStates: [{ callback: () => { }, getDeps: () => [], oldDeps: [] }],
      parentDom: null,
      firstDom: null,
      lastDom: null,
    };

    runtime.unmountNode(node);

    expect(node.isMounted).toBe(false);
    expect(node.firstDom).toBeNull();
    expect(node.lastDom).toBeNull();
  });

  it('watchStates를 비움', () => {
    const node = {
      kind: 'component',
      isMounted: true,
      cleanups: [],
      children: [],
      watchStates: [{ callback: () => { }, getDeps: () => [], oldDeps: [] }],
      parentDom: null,
      firstDom: null,
      lastDom: null,
    };

    runtime.unmountNode(node);

    expect(node.watchStates).toEqual([]);
  });

  it('cleanup 함수 실행', () => {
    const cleanup = vi.fn();
    const node = {
      kind: 'component',
      isMounted: true,
      cleanups: [cleanup],
      children: [],
      watchStates: [],
      parentDom: null,
      firstDom: null,
      lastDom: null,
    };

    runtime.unmountNode(node);

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('cleanup 에러가 다른 정리작업을 차단하지 않음', () => {
    const errorCleanup = () => { throw new Error('cleanup error'); };
    const goodCleanup = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const node = {
      kind: 'component',
      isMounted: true,
      cleanups: [errorCleanup, goodCleanup],
      children: [],
      watchStates: [],
      parentDom: null,
      firstDom: null,
      lastDom: null,
    };

    runtime.unmountNode(node);

    expect(goodCleanup).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('자식 인스턴스도 재귀적으로 unmount', () => {
    const childCleanup = vi.fn();
    const child = {
      kind: 'component',
      isMounted: true,
      cleanups: [childCleanup],
      children: [],
      watchStates: [],
      parentDom: null,
      firstDom: null,
      lastDom: null,
    };
    const parent = {
      kind: 'component',
      isMounted: true,
      cleanups: [],
      children: [child],
      watchStates: [],
      parentDom: null,
      firstDom: null,
      lastDom: null,
    };

    runtime.unmountNode(parent);

    expect(child.isMounted).toBe(false);
    expect(childCleanup).toHaveBeenCalledTimes(1);
  });
});

describe('init 중복 호출 방어', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    resetAeuiRuntime();
    container.remove();
  });

  it('init 호출 시 RAF 스케줄러가 설정됨', () => {
    const App = () => () => AEUI.createVNode('div', null, 'hello');
    AEUI.init(App, container);
    expect(runtime.state.rafId).not.toBeNull();
  });

  it('init 재호출 시 새 RAF 요청이 등록됨', () => {
    const App = () => () => AEUI.createVNode('div', null, 'hello');
    AEUI.init(App, container);
    const firstTimer = runtime.state.rafId;

    AEUI.init(App, container);
    const secondTimer = runtime.state.rafId;

    expect(secondTimer).not.toBe(firstTimer);
  });
});

describe('스케줄러 프레임 백오프', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetAeuiRuntime();
  });

  it('변화가 없으면 1 -> 2 -> 4 프레임으로 간격이 늘어남', () => {
    const tickSpy = vi.spyOn(runtime, 'tick').mockReturnValue(false);
    const startSpy = vi.spyOn(runtime, 'startScheduler').mockImplementation(() => { });

    runtime.state.RootComponent = () => { };
    runtime.state.containerElement = document.createElement('div');
    runtime.state.frameDelay = 1;
    runtime.state.framesUntilNextTick = 0;

    runtime.onAnimationFrame();
    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(runtime.state.frameDelay).toBe(2);
    expect(runtime.state.framesUntilNextTick).toBe(1);

    runtime.onAnimationFrame();
    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(runtime.state.frameDelay).toBe(2);
    expect(runtime.state.framesUntilNextTick).toBe(0);

    runtime.onAnimationFrame();
    expect(tickSpy).toHaveBeenCalledTimes(2);
    expect(runtime.state.frameDelay).toBe(4);
    expect(runtime.state.framesUntilNextTick).toBe(3);
    expect(startSpy).toHaveBeenCalledTimes(3);
  });

  it('변화가 생기면 프레임 간격이 1로 즉시 리셋됨', () => {
    vi.spyOn(runtime, 'startScheduler').mockImplementation(() => { });
    vi.spyOn(runtime, 'tick').mockReturnValue(true);

    runtime.state.RootComponent = () => { };
    runtime.state.containerElement = document.createElement('div');
    runtime.state.frameDelay = 16;
    runtime.state.framesUntilNextTick = 0;

    runtime.onAnimationFrame();

    expect(runtime.state.frameDelay).toBe(1);
    expect(runtime.state.framesUntilNextTick).toBe(0);
  });

  it('프레임 간격은 최대 60까지 증가함', () => {
    vi.spyOn(runtime, 'startScheduler').mockImplementation(() => { });
    vi.spyOn(runtime, 'tick').mockReturnValue(false);

    runtime.state.RootComponent = () => { };
    runtime.state.containerElement = document.createElement('div');
    runtime.state.frameDelay = 48;
    runtime.state.framesUntilNextTick = 0;

    runtime.onAnimationFrame();

    expect(runtime.state.frameDelay).toBe(60);
    expect(runtime.state.framesUntilNextTick).toBe(59);
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
  it('createNode는 component shell만 만들고 setup은 바로 실행하지 않음', () => {
    const component = vi.fn(() => () => 'ok');

    const node = runtime.createNode({ tag: component, props: { value: 1 } }, null, null);

    expect(component).not.toHaveBeenCalled();
    expect(node.kind).toBe('component');
    expect(node.renderFactory).toBeNull();
  });

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

  it('watcher 에러가 다른 watcher를 차단하지 않음', () => {
    const watcherResults = [];
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const instance = {
      watchStates: [
        {
          callback: () => { throw new Error('watcher error'); },
          getDeps: () => [1],
          oldDeps: [0], // 변경됨 → callback 실행
        },
        {
          callback: () => { watcherResults.push('ok'); },
          getDeps: () => [1],
          oldDeps: [0], // 변경됨 → callback 실행
        },
      ],
    };

    runtime.runComponentWatchers(instance);

    expect(watcherResults).toEqual(['ok']); // 두 번째 watcher 정상 실행
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('watch callback 이후 최종 deps를 oldDeps로 저장함', () => {
    const state = { count: 2 };
    const instance = {
      watchStates: [
        {
          callback: () => {
            state.count = 1;
          },
          getDeps: () => [state.count],
          oldDeps: [0],
        },
      ],
    };

    runtime.runComponentWatchers(instance);

    expect(instance.watchStates[0].oldDeps).toEqual([1]);
  });
});
