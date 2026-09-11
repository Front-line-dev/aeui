import { it, expect, vi } from 'vitest';
import { AEUI } from 'aeui';
import { createRuntimeState } from '../../../../packages/core/src/runtime-state.js';
import { withComponentContext, getRuntimeContext } from '../../../../packages/core/src/runtime-context.js';
import { createAppRuntime } from '../../../../packages/core/src/app-runtime.js';
import { registerWatch } from '../../../../packages/core/src/hook-registry.js';
import { useRuntime } from './runtime-harness.js';

const app = useRuntime();

it('[INTERNAL-CONTEXT.10] 중첩 render의 예외 후 바깥 setup context를 복원하고 다른 앱에 누출하지 않는다', () => {
  const outer = createRuntimeState({}), inner = createRuntimeState({});
  const parent = {}, child = {};
  withComponentContext(outer, parent, 'setup', () => {
    expect(() => withComponentContext(inner, child, 'render', () => { throw new Error('nested'); })).toThrow('nested');
    expect(getRuntimeContext()).toBe(outer);
    expect(outer.currentComponentNode).toBe(parent);
    expect(outer.currentComponentPhase).toBe('setup');
    expect(inner.currentComponentNode).toBeNull();
  });
  expect(getRuntimeContext()).toBeNull();
  expect(outer.currentComponentNode).toBeNull();
  expect(inner.currentComponentPhase).toBeNull();
});

it.each([null, 3, 'bad', {}])('[INTERNAL-HOOK.10] callback=%s 등록을 거부하고 watcher 목록을 변경하지 않는다', callback => {
  const runtime = createRuntimeState({}), node = { kind: 'component', watchStates: [] };
  withComponentContext(runtime, node, 'setup', () => {
    expect(() => registerWatch(runtime, callback)).toThrow(TypeError);
    expect(node.watchStates).toEqual([]);
  });
});

it('[INTERNAL-RUNTIME.10] 한 앱을 교체해도 다른 앱의 이벤트·상태·scheduler·cleanup을 변경하지 않는다', async () => {
  const apps = [0, 1].map(() => createAppRuntime({
    createVNode: AEUI.createVNode, Fragment: AEUI.Fragment,
    deepEqual: AEUI.__runtime.deepEqual, deepClone: AEUI.__runtime.deepClone,
  }));
  const containers = apps.map(() => document.createElement('div')), cleanups = [];
  try {
    apps.forEach((runtime, index) => runtime.init(() => {
      let value = 0;
      runtime.__runtime.clean(() => cleanups.push(index));
      return () => runtime.createVNode('button', { onClick: () => value++ }, value);
    }, containers[index]));
    const other = containers[1].firstChild;
    other.click(); await app.frame();
    apps[0].init(() => () => null, containers[0]);
    expect(cleanups).toEqual([0]);
    expect(containers[1].firstChild).toBe(other);
    expect(other.textContent).toBe('1');
    other.click(); await app.frame();
    expect(other.textContent).toBe('2');
    expect(containers[0].childNodes).toHaveLength(0);
  } finally {
    for (const runtime of apps) {
      for (const child of runtime.__runtime.state.rootNode?.children || []) runtime.__runtime.unmountNode(child);
      runtime.__runtime.stopScheduler();
    }
  }
});

it('[INTERNAL-SCHEDULER.10] 같은 프레임의 이벤트를 한 렌더로 합치고 render 재진입을 허용하지 않는다', async () => {
  let renders = 0;
  const reentrant = [];
  function App() {
    let count = 0;
    return () => {
      renders++;
      reentrant.push(AEUI.render());
      return AEUI.createVNode('button', { onClick: () => count++ }, count);
    };
  }
  const root = app.mount(App), initial = renders;
  for (let i = 0; i < 3; i++) root.firstChild.click();
  await app.frame();
  expect(root.textContent).toBe('3');
  expect(renders).toBe(initial + 1);
  expect(reentrant.every(value => value === false)).toBe(true);
});

it('[INTERNAL-LIFECYCLE.10] 미컴파일 VNode 반환을 진단하고 등록된 cleanup을 남기지 않는다', () => {
  const cleanup = vi.fn(), error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const Uncompiled = new Function('AEUI', 'cleanup', 'return function () { AEUI.__runtime.clean(cleanup); return AEUI.createVNode("p", null, "bad"); };')(AEUI, cleanup);
  const root = app.mount(Uncompiled);
  expect(error).toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(root.childNodes).toHaveLength(0);
});

it('[CMP-SETUP.10] 같은 컴포넌트의 각 인스턴스는 한 번 setup하고 다른 인스턴스의 상태를 공유하지 않는다', async () => {
  const setup = vi.fn();
  function Item() {
    setup();
    let count = 0;
    return () => AEUI.createVNode('button', { onClick: () => count++ }, count);
  }
  function App() { return () => AEUI.createVNode('main', null, AEUI.createVNode(Item), AEUI.createVNode(Item)); }
  const root = app.mount(App), [first, second] = root.querySelectorAll('button');
  first.click(); await app.frame();
  AEUI.render();
  expect(first.textContent).toBe('1');
  expect(second.textContent).toBe('0');
  expect(setup).toHaveBeenCalledTimes(2);
});

it('[INTERNAL-DOM.10] ARIA false는 문자열로 남기고 boolean false와 metadata는 attribute로 남기지 않는다', () => {
  let props = { disabled: true, 'aria-hidden': false, key: 'button', ref: 'metadata' };
  const root = app.mount(() => () => AEUI.createVNode('button', props));
  expect(root.firstChild.getAttribute('aria-hidden')).toBe('false');
  expect(root.firstChild.disabled).toBe(true);
  expect(root.firstChild.hasAttribute('key')).toBe(false);
  expect(root.firstChild.hasAttribute('ref')).toBe(false);
  props = { disabled: false, key: 'button' };
  AEUI.render();
  expect(root.firstChild.disabled).toBe(false);
  expect(root.firstChild.hasAttribute('disabled')).toBe(false);
  expect(root.firstChild.hasAttribute('aria-hidden')).toBe(false);
});
