import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AEUI, watch } from 'aeui';

describe('_updateDomProps', () => {
  let div;

  beforeEach(() => {
    div = document.createElement('div');
  });

  it('children prop을 DOM에 설정하지 않음', () => {
    AEUI._updateDomProps(div, { children: ['child1', 'child2'] });
    expect(div.hasAttribute('children')).toBe(false);
  });

  it('key, ref prop을 DOM에 설정하지 않음', () => {
    AEUI._updateDomProps(div, { key: 'k1', ref: {} });
    expect(div.hasAttribute('key')).toBe(false);
    expect(div.hasAttribute('ref')).toBe(false);
  });

  it('className을 class attribute로 설정', () => {
    AEUI._updateDomProps(div, { className: 'my-class' });
    expect(div.className).toBe('my-class');
  });

  it('className 제거 시 빈 문자열로 설정', () => {
    AEUI._updateDomProps(div, { className: 'my-class' });
    AEUI._updateDomProps(div, { className: undefined }, { className: 'my-class' });
    expect(div.className).toBe('');
  });

  it('style 문자열 처리', () => {
    AEUI._updateDomProps(div, { style: 'color: red' });
    expect(div.style.cssText).toContain('color');
  });

  it('style 객체 처리', () => {
    AEUI._updateDomProps(div, { style: { color: 'red', fontSize: '16px' } });
    expect(div.style.color).toBe('red');
    expect(div.style.fontSize).toBe('16px');
  });

  it('boolean attribute true 설정', () => {
    AEUI._updateDomProps(div, { disabled: true });
    expect(div.disabled).toBe(true);
    expect(div.hasAttribute('disabled')).toBe(true);
  });

  it('boolean attribute false 설정 (attribute 제거)', () => {
    AEUI._updateDomProps(div, { disabled: true });
    AEUI._updateDomProps(div, { disabled: false }, { disabled: true });
    expect(div.disabled).toBe(false);
    expect(div.hasAttribute('disabled')).toBe(false);
  });

  it('일반 attribute 설정', () => {
    AEUI._updateDomProps(div, { id: 'test', 'data-value': '42' });
    expect(div.getAttribute('id')).toBe('test');
    expect(div.getAttribute('data-value')).toBe('42');
  });

  it('attribute 제거 (undefined)', () => {
    AEUI._updateDomProps(div, { id: 'test' });
    AEUI._updateDomProps(div, { id: undefined }, { id: 'test' });
    expect(div.hasAttribute('id')).toBe(false);
  });

  it('이벤트 핸들러 등록 및 교체', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    AEUI._updateDomProps(div, { onClick: handler1 });
    div.click();
    expect(handler1).toHaveBeenCalledTimes(1);

    AEUI._updateDomProps(div, { onClick: handler2 }, { onClick: handler1 });
    div.click();
    expect(handler1).toHaveBeenCalledTimes(1); // 이전 핸들러 미호출
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('이벤트 핸들러 제거 시 기존 리스너 해제', () => {
    const handler = vi.fn();

    AEUI._updateDomProps(div, { onClick: handler });
    div.click();
    expect(handler).toHaveBeenCalledTimes(1);

    AEUI._updateDomProps(div, { onClick: undefined }, { onClick: handler });
    div.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('이벤트 핸들러가 truthy 비함수로 바뀌면 기존 리스너 해제', () => {
    const handler = vi.fn();

    AEUI._updateDomProps(div, { onClick: handler });
    div.click();
    expect(handler).toHaveBeenCalledTimes(1);

    AEUI._updateDomProps(div, { onClick: 'invalid-handler' }, { onClick: handler });
    div.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('이벤트 핸들러의 this는 현재 DOM 노드', () => {
    let boundThis = null;
    function handler() {
      boundThis = this;
    }

    AEUI._updateDomProps(div, { onClick: handler });
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
    // 초기: 3개 아이템
    const prev = ['A', 'B', 'C'];
    prev.forEach(text => {
      container.appendChild(document.createTextNode(text));
    });

    // 업데이트: 2개로 줄어듦
    const next = ['A', 'B'];
    AEUI._reconcile(container, next, prev, 0, null);

    expect(container.childNodes.length).toBe(2);
    expect(container.childNodes[0].nodeValue).toBe('A');
    expect(container.childNodes[1].nodeValue).toBe('B');
  });

  it('배열 길이 증가 시 새 노드 추가', () => {
    // 초기: 2개
    const prev = ['A', 'B'];
    prev.forEach(text => {
      container.appendChild(document.createTextNode(text));
    });

    const next = ['A', 'B', 'C'];
    AEUI._reconcile(container, next, prev, 0, null);

    expect(container.childNodes.length).toBe(3);
    expect(container.childNodes[2].nodeValue).toBe('C');
  });
});

describe('_unmount', () => {
  it('isMounted를 false로 설정하고 _domNodeCount를 0으로 초기화', () => {
    const instance = {
      isMounted: true,
      _domNodeCount: 3,
      cleanups: [],
      children: [],
      watchStates: [{ callback: () => { }, getDeps: () => [], oldDeps: [] }],
    };

    AEUI._unmount(instance);

    expect(instance.isMounted).toBe(false);
    expect(instance._domNodeCount).toBe(0);
  });

  it('watchStates를 비움', () => {
    const instance = {
      isMounted: true,
      _domNodeCount: 1,
      cleanups: [],
      children: [],
      watchStates: [{ callback: () => { }, getDeps: () => [], oldDeps: [] }],
    };

    AEUI._unmount(instance);

    expect(instance.watchStates).toEqual([]);
  });

  it('cleanup 함수 실행', () => {
    const cleanup = vi.fn();
    const instance = {
      isMounted: true,
      _domNodeCount: 1,
      cleanups: [cleanup],
      children: [],
      watchStates: [],
    };

    AEUI._unmount(instance);

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('cleanup 에러가 다른 정리작업을 차단하지 않음', () => {
    const errorCleanup = () => { throw new Error('cleanup error'); };
    const goodCleanup = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const instance = {
      isMounted: true,
      _domNodeCount: 1,
      cleanups: [errorCleanup, goodCleanup],
      children: [],
      watchStates: [],
    };

    AEUI._unmount(instance);

    expect(goodCleanup).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('자식 인스턴스도 재귀적으로 unmount', () => {
    const childCleanup = vi.fn();
    const child = {
      isMounted: true,
      _domNodeCount: 1,
      cleanups: [childCleanup],
      children: [],
      watchStates: [],
    };
    const parent = {
      isMounted: true,
      _domNodeCount: 2,
      cleanups: [],
      children: [child],
      watchStates: [],
    };

    AEUI._unmount(parent);

    expect(child.isMounted).toBe(false);
    expect(child._domNodeCount).toBe(0);
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
    AEUI._stopScheduler();
    AEUI._rafId = null;
    AEUI._frameDelay = 1;
    AEUI._framesUntilNextTick = 0;
    AEUI._rootInstance = null;
    AEUI._previousVNode = null;
    AEUI._RootComponent = null;
    AEUI._containerElement = null;
    container.remove();
  });

  it('init 호출 시 RAF 스케줄러가 설정됨', () => {
    const App = () => () => AEUI.createVNode('div', null, 'hello');
    AEUI.init(App, container);
    expect(AEUI._rafId).not.toBeNull();
  });

  it('init 재호출 시 새 RAF 요청이 등록됨', () => {
    const App = () => () => AEUI.createVNode('div', null, 'hello');
    AEUI.init(App, container);
    const firstTimer = AEUI._rafId;

    AEUI.init(App, container);
    const secondTimer = AEUI._rafId;

    expect(secondTimer).not.toBe(firstTimer);
  });
});

describe('스케줄러 프레임 백오프', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    AEUI._stopScheduler();
    AEUI._rafId = null;
    AEUI._frameDelay = 1;
    AEUI._framesUntilNextTick = 0;
    AEUI._rootInstance = null;
    AEUI._previousVNode = null;
    AEUI._RootComponent = null;
    AEUI._containerElement = null;
  });

  it('변화가 없으면 1 -> 2 -> 4 프레임으로 간격이 늘어남', () => {
    const tickSpy = vi.spyOn(AEUI, '_tick').mockReturnValue(false);
    const startSpy = vi.spyOn(AEUI, '_startScheduler').mockImplementation(() => { });

    AEUI._RootComponent = () => { };
    AEUI._containerElement = document.createElement('div');
    AEUI._frameDelay = 1;
    AEUI._framesUntilNextTick = 0;

    AEUI._onAnimationFrame();
    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(AEUI._frameDelay).toBe(2);
    expect(AEUI._framesUntilNextTick).toBe(1);

    AEUI._onAnimationFrame();
    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(AEUI._frameDelay).toBe(2);
    expect(AEUI._framesUntilNextTick).toBe(0);

    AEUI._onAnimationFrame();
    expect(tickSpy).toHaveBeenCalledTimes(2);
    expect(AEUI._frameDelay).toBe(4);
    expect(AEUI._framesUntilNextTick).toBe(3);
    expect(startSpy).toHaveBeenCalledTimes(3);
  });

  it('변화가 생기면 프레임 간격이 1로 즉시 리셋됨', () => {
    vi.spyOn(AEUI, '_startScheduler').mockImplementation(() => { });
    vi.spyOn(AEUI, '_tick').mockReturnValue(true);

    AEUI._RootComponent = () => { };
    AEUI._containerElement = document.createElement('div');
    AEUI._frameDelay = 16;
    AEUI._framesUntilNextTick = 0;

    AEUI._onAnimationFrame();

    expect(AEUI._frameDelay).toBe(1);
    expect(AEUI._framesUntilNextTick).toBe(0);
  });

  it('프레임 간격은 최대 60까지 증가함', () => {
    vi.spyOn(AEUI, '_startScheduler').mockImplementation(() => { });
    vi.spyOn(AEUI, '_tick').mockReturnValue(false);

    AEUI._RootComponent = () => { };
    AEUI._containerElement = document.createElement('div');
    AEUI._frameDelay = 48;
    AEUI._framesUntilNextTick = 0;

    AEUI._onAnimationFrame();

    expect(AEUI._frameDelay).toBe(60);
    expect(AEUI._framesUntilNextTick).toBe(59);
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
    AEUI._stopScheduler();
    AEUI._rafId = null;
    AEUI._frameDelay = 1;
    AEUI._framesUntilNextTick = 0;
    AEUI._rootInstance = null;
    AEUI._previousVNode = null;
    AEUI._RootComponent = null;
    AEUI._containerElement = null;
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
    expect(AEUI._frameDelay).toBe(1);
  });
});

describe('에러 처리', () => {
  it('createInstance setup 에러가 발생해도 _currentInstance가 복구됨', () => {
    let leakedInstance = null;
    const BrokenComponent = () => {
      leakedInstance = AEUI._currentInstance;
      throw new Error('setup boom');
    };

    expect(() => {
      AEUI.createInstance({ tag: BrokenComponent, props: {} }, null);
    }).toThrow('setup boom');

    expect(AEUI._currentInstance).toBeNull();

    // setup 밖 watch 호출은 등록되지 않아야 함
    watch(() => { }, []);
    expect(leakedInstance.watchStates.length).toBe(0);
  });

  it('reconcile 중 render 에러가 발생해도 _currentInstance가 복구됨', () => {
    const parent = document.createElement('div');
    const vnode = {
      tag: () => () => { throw new Error('render boom'); },
      props: {}
    };

    expect(() => {
      AEUI._reconcile(parent, vnode, null, 0, null);
    }).toThrow('render boom');

    expect(AEUI._currentInstance).toBeNull();
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

    AEUI._runComponentWatchers(instance);

    expect(watcherResults).toEqual(['ok']); // 두 번째 watcher 정상 실행
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
