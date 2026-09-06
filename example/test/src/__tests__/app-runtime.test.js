import { describe, expect, it, vi } from 'vitest';
import { AEUI } from 'aeui';
import { createAppRuntime } from '../../../../packages/core/src/app-runtime.js';
import { _deepEqual, _deepClone } from '../../../../packages/core/src/deep-compare.js';

function createTestRuntime() {
  return createAppRuntime({
    deepEqual: _deepEqual, deepClone: _deepClone,
    createVNode: AEUI.createVNode, createElement: AEUI.createElement, Fragment: AEUI.Fragment,
  });
}

describe('app-runtime', () => {
  it('두 앱의 상태, 이벤트와 cleanup을 격리하고 한 앱 재시작 후에도 다른 앱을 갱신', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    const apps = [createTestRuntime(), createTestRuntime()];
    const containers = apps.map(() => document.createElement('div'));
    const cleanups = [];
    try {
      apps.forEach((app, index) => {
        app.init(function Counter() {
          let count = 0;
          app.__runtime.clean(() => cleanups.push(index));
          return () => app.createVNode('button', { onClick: () => count++ }, `${index}:${count}`);
        }, containers[index]);
      });
      containers[0].querySelector('button').click();
      await vi.advanceTimersByTimeAsync(16);
      expect(containers.map((container) => container.textContent)).toEqual(['0:1', '1:0']);
      apps[0].init(() => () => apps[0].createVNode('p', null, 'replaced'), containers[0]);
      expect(cleanups).toEqual([0]);
      expect(vi.getTimerCount()).toBe(2);
      containers[1].querySelector('button').click();
      await vi.advanceTimersByTimeAsync(16);
      expect(containers.map((container) => container.textContent)).toEqual(['replaced', '1:1']);
      expect(cleanups).toEqual([0]);
      expect(vi.getTimerCount()).toBe(2);
    } finally {
      for (const app of apps) {
        app.__runtime.stopScheduler();
        for (const child of app.__runtime.state.rootNode?.children || []) app.__runtime.unmountNode(child);
      }
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
