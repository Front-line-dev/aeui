import { afterEach, beforeEach, vi } from 'vitest';
import { AEUI } from 'aeui';

// 동작 assertion은 공개 API/DOM에 둔다. __runtime은 테스트 간 자원 정리에만 사용한다.
export function useRuntime() {
  let container;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', callback => setTimeout(() => callback(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', id => clearTimeout(id));
    container = document.createElement('div');
    document.body.append(container);
  });
  afterEach(() => {
    const runtime = AEUI.__runtime;
    try {
      runtime.state.routerTeardown?.();
      for (const child of runtime.state.rootNode?.children || []) runtime.unmountNode(child);
    } finally {
      runtime.stopScheduler();
      runtime.state.rootNode = null;
      runtime.state.containerElement = null;
      runtime.state.RootComponent = null;
      container.remove();
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
  return {
    mount(App) { AEUI.init(App, container); return container; },
    frame: () => vi.advanceTimersByTimeAsync(16),
    advance: ms => vi.advanceTimersByTimeAsync(ms),
  };
}
