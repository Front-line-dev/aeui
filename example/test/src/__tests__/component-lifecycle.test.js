import { describe, expect, it, vi } from 'vitest';
import {
  createComponentNode,
  setupComponentNode,
  runComponentRenderPhase,
  renderComponentNode,
  commitRenderedNode,
  cleanupComponentNode,
} from '../../../../packages/core/src/component-lifecycle.js';
import { createRuntimeState } from '../../../../packages/core/src/runtime-state.js';

describe('component-lifecycle', () => {
  it('runs setup once and stores the render factory', () => {
    const state = createRuntimeState({
      deepEqual: Object.is,
      deepClone: (value) => structuredClone(value),
    });
    const renderFactory = vi.fn(() => 'ok');
    const component = vi.fn(() => renderFactory);
    const vnode = { tag: component, props: { value: 1 } };

    const node = createComponentNode(vnode, null, null);
    setupComponentNode(state, node);
    setupComponentNode(state, node);

    expect(component).toHaveBeenCalledTimes(1);
    expect(node.renderFactory).toBe(renderFactory);
  });

  it('syncs props before watchers and render', () => {
    const state = createRuntimeState({
      deepEqual: Object.is,
      deepClone: (value) => structuredClone(value),
    });
    const callback = vi.fn();
    const node = {
      props: { value: 1 },
      watchStates: [{
        getDeps: () => [node.props.value],
        oldDeps: [1],
        callback,
      }],
      cleanups: [],
      renderedNode: null,
      children: [],
      firstDom: null,
      lastDom: null,
    };

    const render = vi.fn(() => 'done');
    runComponentRenderPhase(state, node, { value: 2 }, render);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith({ value: 2 });
  });

  it('renders component nodes through the shared lifecycle entrypoint', () => {
    const state = createRuntimeState({
      deepEqual: Object.is,
      deepClone: (value) => structuredClone(value),
    });
    const renderedNode = { firstDom: { nodeType: 1 }, lastDom: { nodeType: 1 } };
    const renderFactory = vi.fn(() => 'rendered');
    const component = vi.fn(() => renderFactory);
    const node = createComponentNode({ tag: component, props: { value: 1 } }, null, null);

    state.reconcile = vi.fn(() => renderedNode);

    renderComponentNode(state, document.createElement('div'), node, { value: 2 }, null);

    expect(component).toHaveBeenCalledTimes(1);
    expect(renderFactory).toHaveBeenCalledWith({ value: 2 });
    expect(state.reconcile).toHaveBeenCalledTimes(1);
    expect(node.renderedNode).toBe(renderedNode);
  });

  it('commits rendered node bookkeeping', () => {
    const node = {
      renderedNode: null,
      children: [],
      firstDom: null,
      lastDom: null,
    };
    const renderedNode = {
      firstDom: { nodeType: 1 },
      lastDom: { nodeType: 1 },
    };

    commitRenderedNode(node, renderedNode);

    expect(node.renderedNode).toBe(renderedNode);
    expect(node.children).toEqual([renderedNode]);
    expect(node.firstDom).toBe(renderedNode.firstDom);
    expect(node.lastDom).toBe(renderedNode.lastDom);
  });

  it('runs cleanup once and resets component-owned state', () => {
    const cleanup = vi.fn();
    const node = {
      cleanups: [cleanup],
      watchStates: [{ callback: () => {}, getDeps: () => [], oldDeps: [] }],
      renderedNode: { firstDom: null, lastDom: null },
      children: [],
      firstDom: { nodeType: 1 },
      lastDom: { nodeType: 1 },
    };

    cleanupComponentNode(createRuntimeState({
      deepEqual: Object.is,
      deepClone: (value) => structuredClone(value),
    }), node);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(node.cleanups).toEqual([]);
    expect(node.watchStates).toEqual([]);
    expect(node.renderedNode).toBeNull();
    expect(node.firstDom).toBeNull();
    expect(node.lastDom).toBeNull();
  });
});
