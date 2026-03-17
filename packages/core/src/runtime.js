/**
 * Stateful runtime internals: hooks bridge, node creation,
 * watcher execution, root reconciliation, and scheduler loop.
 */
import { runComponentWatchers } from './component-watchers.js';
import { createComponentNode, setupComponentNode } from './component-lifecycle.js';
import { getVNodeKey, isFragmentVNode } from './vnode-helpers.js';

const MAX_FRAME_DELAY = 60;

let runtimeContext = null;

export function setRuntimeContext(context) {
  runtimeContext = context;
}

export function getRuntimeContext() {
  return runtimeContext;
}

export function createRootNode(containerElement) {
  return {
    kind: 'root',
    key: null,
    vnode: null,
    parent: null,
    parentDom: containerElement,
    children: [],
    firstDom: null,
    lastDom: null,
    isMounted: true,
  };
}

export function _runComponentWatchers(state, node) {
  runComponentWatchers(state, node);
}

export function createNode(state, vnode, parentNode = null, parentDom = null) {
  const node = {
    kind: null,
    key: getVNodeKey(vnode),
    vnode,
    parent: parentNode,
    parentDom,
    children: [],
    firstDom: null,
    lastDom: null,
    isMounted: true,
  };

  if (vnode == null || typeof vnode === 'boolean') {
    return null;
  }

  if (typeof vnode !== 'object') {
    node.kind = 'text';
    node.value = String(vnode);
    node.dom = null;
    return node;
  }

  if (isFragmentVNode(state.Fragment, vnode)) {
    node.kind = 'fragment';
    return node;
  }

  if (typeof vnode.tag === 'string') {
    node.kind = 'host';
    node.tag = vnode.tag;
    node.dom = null;
    node.props = vnode.props || {};
    return node;
  }

  const componentNode = createComponentNode(vnode, parentNode, parentDom);
  setupComponentNode(state, componentNode);
  return componentNode;
}

export function _reconcileRoot(state) {
  if (!state.rootNode || !state.containerElement || !state.RootComponent) return;

  const rootVNode = state.createVNode(state.RootComponent);
  const previousRootChild = state.rootNode.children[0] || null;
  const nextRootChild = state._reconcile(
    state.containerElement,
    previousRootChild,
    rootVNode,
    null,
    state.rootNode
  );

  state.rootNode.children = nextRootChild ? [nextRootChild] : [];
  state.rootNode.firstDom = nextRootChild ? nextRootChild.firstDom : null;
  state.rootNode.lastDom = nextRootChild ? nextRootChild.lastDom : null;
}

export function init(state, RootComponent, containerElement) {
  state._stopScheduler();
  if (state.rootNode && state.rootNode.children[0]) {
    state._unmountNode(state.rootNode.children[0]);
  }

  state.RootComponent = RootComponent;
  state.containerElement = containerElement;
  state.rootNode = createRootNode(containerElement);
  containerElement.innerHTML = '';

  const didMutate = state._tick();
  state.frameDelay = didMutate ? 1 : 2;
  state.framesUntilNextTick = state.frameDelay - 1;

  state._startScheduler();
}

export function render(state) {
  if (!state.RootComponent || !state.containerElement) return false;

  const didMutate = state._tick();
  state.frameDelay = didMutate ? 1 : Math.min(state.frameDelay * 2, MAX_FRAME_DELAY);
  state.framesUntilNextTick = state.frameDelay - 1;
  state._startScheduler();
  return didMutate;
}

export function _stopScheduler(state) {
  if (state.rafId != null) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(state.rafId);
    } else {
      clearTimeout(state.rafId);
    }
  }

  state.rafId = null;
}

export function _startScheduler(state) {
  if (state.rafId != null) return;

  if (typeof requestAnimationFrame === 'function') {
    state.rafId = requestAnimationFrame(() => _onAnimationFrame(state));
  } else {
    state.rafId = setTimeout(() => _onAnimationFrame(state), 16);
  }
}

export function _onAnimationFrame(state) {
  state.rafId = null;
  if (!state.RootComponent || !state.containerElement) return;

  if (state.framesUntilNextTick <= 0) {
    const didMutate = state._tick();
    const hasManualRequestDuringTick = state.rafId != null;

    if (hasManualRequestDuringTick) {
      state.framesUntilNextTick = 0;
    } else {
      state.frameDelay = didMutate
        ? 1
        : Math.min(state.frameDelay * 2, MAX_FRAME_DELAY);
      state.framesUntilNextTick = state.frameDelay - 1;
    }
  } else {
    state.framesUntilNextTick -= 1;
  }

  state._startScheduler();
}

export function _tick(state) {
  if (!state.RootComponent || !state.containerElement || !state.rootNode) return false;
  if (state.isRendering) return false;

  state.isRendering = true;
  state.didMutate = false;

  try {
    _reconcileRoot(state);
  } catch (e) {
    console.error('[AEUI] Render error:', e);
  } finally {
    state.isRendering = false;
  }

  return state.didMutate;
}
