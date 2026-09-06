import { describe, expect, it } from 'vitest';
import { createRuntimeState } from '../../../../packages/core/src/runtime-state.js';
import {
  getRuntimeContext,
  withComponentContext,
} from '../../../../packages/core/src/runtime-context.js';

function createState() {
  return createRuntimeState({
    deepEqual: Object.is,
    deepClone: (value) => structuredClone(value),
  });
}

describe('runtime-context', () => {
  it('restores the outer runtime even when a nested component throws', () => {
    const outerState = createState();
    const innerState = createState();
    const outerNode = { id: 'outer' };
    const innerNode = { id: 'inner' };

    expect(getRuntimeContext()).toBeNull();

    withComponentContext(outerState, outerNode, 'render', () => {
      expect(getRuntimeContext()).toBe(outerState);
      expect(outerState.currentComponentNode).toBe(outerNode);
      expect(outerState.currentComponentPhase).toBe('render');

      expect(() => withComponentContext(innerState, innerNode, 'setup', () => {
        expect(getRuntimeContext()).toBe(innerState);
        expect(innerState.currentComponentNode).toBe(innerNode);
        expect(innerState.currentComponentPhase).toBe('setup');
        throw new Error('nested setup failed');
      })).toThrow('nested setup failed');

      expect(getRuntimeContext()).toBe(outerState);
      expect(outerState.currentComponentNode).toBe(outerNode);
      expect(outerState.currentComponentPhase).toBe('render');
    });

    expect(getRuntimeContext()).toBeNull();
    expect(outerState.currentComponentNode).toBeNull();
    expect(innerState.currentComponentNode).toBeNull();
  });
});
