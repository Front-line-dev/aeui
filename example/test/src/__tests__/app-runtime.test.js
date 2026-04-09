import { describe, expect, it, vi } from 'vitest';
import { createAppRuntime } from '../../../../packages/core/src/app-runtime.js';

function createVNode(tag, props, ...children) {
  const validChildren = children.flat().filter((child) => child != null && typeof child !== 'boolean');
  const finalProps = props || {};
  finalProps.children = validChildren;
  return { tag, props: finalProps, children: validChildren };
}

function Fragment() {
  return (props) => props.children;
}

function createTestRuntime() {
  return createAppRuntime({
    deepEqual: Object.is,
    deepClone: (value) => structuredClone(value),
    createVNode,
    createElement: createVNode,
    Fragment,
  });
}

describe('app-runtime', () => {
  it('creates isolated runtime instances', () => {
    const runtimeA = createTestRuntime();
    const runtimeB = createTestRuntime();

    runtimeA.__runtime.state.frameDelay = 8;
    runtimeB.__runtime.state.frameDelay = 2;

    expect(runtimeA.__runtime.state).not.toBe(runtimeB.__runtime.state);
    expect(runtimeA.__runtime.state.frameDelay).toBe(8);
    expect(runtimeB.__runtime.state.frameDelay).toBe(2);
  });

  it('requestRender uses the interactive lane even when polling backoff is pending', () => {
    const runtime = createTestRuntime();
    const internalRuntime = runtime.__runtime;
    internalRuntime.state.RootComponent = () => {};
    internalRuntime.state.containerElement = document.createElement('div');
    internalRuntime.state.rootNode = internalRuntime.createRootNode(internalRuntime.state.containerElement);
    internalRuntime.state.frameDelay = 8;
    internalRuntime.state.framesUntilNextTick = 7;
    vi.spyOn(internalRuntime, 'tick').mockReturnValue(false);
    vi.spyOn(internalRuntime, 'startScheduler').mockImplementation(() => {});

    internalRuntime.requestRender();
    internalRuntime.onAnimationFrame();

    expect(internalRuntime.tick).toHaveBeenCalledTimes(1);
    expect(internalRuntime.state.interactiveRenderRequested).toBe(false);
  });
});
