import { describe, expect, it } from 'vitest';
import {
  createRuntimeState,
  resetRuntimeState,
} from '../../../../packages/core/src/runtime-state.js';

describe('runtime-state', () => {
  it('creates the default mutable runtime state shape', () => {
    const state = createRuntimeState({
      deepEqual: Object.is,
      deepClone: (value) => structuredClone(value),
    });

    expect(state.rootNode).toBeNull();
    expect(state.containerElement).toBeNull();
    expect(state.RootComponent).toBeNull();
    expect(state.currentComponentPhase).toBeNull();
    expect(state.didMutate).toBe(false);
    expect(state.frameDelay).toBe(1);
    expect(state.domEventDepth).toBe(0);
    expect(state.interactiveRenderRequested).toBe(false);
  });

  it('resets scheduling and render flags without dropping helpers', () => {
    const state = createRuntimeState({
      deepEqual: Object.is,
      deepClone: (value) => structuredClone(value),
    });

    state.didMutate = true;
    state.isRendering = true;
    state.frameDelay = 8;
    state.domEventDepth = 2;
    state.currentComponentPhase = 'render';
    state.interactiveRenderRequested = true;

    resetRuntimeState(state);

    expect(state.didMutate).toBe(false);
    expect(state.isRendering).toBe(false);
    expect(state.frameDelay).toBe(1);
    expect(state.domEventDepth).toBe(0);
    expect(state.currentComponentPhase).toBeNull();
    expect(state.interactiveRenderRequested).toBe(false);
    expect(typeof state.deepClone).toBe('function');
  });
});
