/**
 * Stateful runtime internals: root reconciliation, DOM event dispatch,
 * and scheduler loop.
 */

const MAX_FRAME_DELAY = 60;

function computeNextPollingDelay(state, didMutate) {
  state.frameDelay = didMutate ? 1 : Math.min(state.frameDelay * 2, MAX_FRAME_DELAY);
  state.framesUntilNextTick = state.frameDelay - 1;
}

export function reconcileRoot(state) {
  if (!state.rootNode || !state.containerElement || !state.RootComponent) return;

  const rootVNode = state.createVNode(state.RootComponent);
  const previousRootChild = state.rootNode.children[0] || null;
  const nextRootChild = state.reconcile(
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
  state.stopScheduler();
  if (state.rootNode && state.rootNode.children[0]) {
    state.unmountNode(state.rootNode.children[0]);
  }

  state.RootComponent = RootComponent;
  state.containerElement = containerElement;
  state.rootNode = state.createRootNode(containerElement);
  containerElement.innerHTML = '';
  state.interactiveRenderRequested = false;

  const didMutate = state.tick();
  computeNextPollingDelay(state, didMutate);

  state.startScheduler();
}

export function render(state) {
  if (!state.RootComponent || !state.containerElement) return false;

  state.interactiveRenderRequested = false;
  const didMutate = state.tick();
  computeNextPollingDelay(state, didMutate);
  state.startScheduler();
  return didMutate;
}

export function requestRender(state) {
  if (!state.RootComponent || !state.containerElement || !state.rootNode) {
    return false;
  }

  state.interactiveRenderRequested = true;
  state.startScheduler();
  return true;
}

export function dispatchDomEvent(state, domNode, eventName, event) {
  state.domEventDepth += 1;

  try {
    const currentHandler = domNode?._aeuiHandlers?.[eventName];
    if (typeof currentHandler === 'function') {
      return currentHandler.call(domNode, event);
    }

    return undefined;
  } finally {
    state.domEventDepth -= 1;

    if (state.domEventDepth === 0) {
      requestRender(state);
    }
  }
}

export function stopScheduler(state) {
  if (state.rafId != null) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(state.rafId);
    } else {
      clearTimeout(state.rafId);
    }
  }

  state.rafId = null;
}

export function startScheduler(state) {
  if (state.rafId != null) return;

  if (typeof requestAnimationFrame === 'function') {
    state.rafId = requestAnimationFrame(() => onAnimationFrame(state));
  } else {
    state.rafId = setTimeout(() => onAnimationFrame(state), 16);
  }
}

export function onAnimationFrame(state) {
  state.rafId = null;
  if (!state.RootComponent || !state.containerElement) return;

  if (state.interactiveRenderRequested) {
    state.interactiveRenderRequested = false;
    const didMutate = state.tick();
    if (state.interactiveRenderRequested) {
      state.frameDelay = 1;
      state.framesUntilNextTick = 0;
    } else {
      computeNextPollingDelay(state, didMutate);
    }
    state.startScheduler();
    return;
  }

  if (state.framesUntilNextTick <= 0) {
    const didMutate = state.tick();

    if (state.interactiveRenderRequested) {
      state.frameDelay = 1;
      state.framesUntilNextTick = 0;
    } else {
      computeNextPollingDelay(state, didMutate);
    }
  } else {
    state.framesUntilNextTick -= 1;
  }

  state.startScheduler();
}

export function tick(state) {
  if (!state.RootComponent || !state.containerElement || !state.rootNode) return false;
  if (state.isRendering) return false;

  state.isRendering = true;
  state.didMutate = false;

  try {
    reconcileRoot(state);
  } catch (e) {
    console.error('[AEUI] Render error:', e);
  } finally {
    state.isRendering = false;
  }

  return state.didMutate;
}
