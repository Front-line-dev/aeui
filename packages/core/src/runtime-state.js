export function createRuntimeState({ deepEqual, deepClone }) {
  return {
    deepEqual,
    deepClone,
    rootNode: null,
    containerElement: null,
    RootComponent: null,
    currentComponentNode: null,
    currentComponentPhase: null,
    isRendering: false,
    rafId: null,
    frameDelay: 1,
    framesUntilNextTick: 0,
    didMutate: false,
    domEventDepth: 0,
    interactiveRenderRequested: false,
    routerTeardown: null,
  };
}

export function resetRuntimeState(state) {
  if (typeof state.routerTeardown === 'function') {
    state.routerTeardown();
  }

  state.rootNode = null;
  state.containerElement = null;
  state.RootComponent = null;
  state.currentComponentNode = null;
  state.currentComponentPhase = null;
  state.isRendering = false;
  state.rafId = null;
  state.frameDelay = 1;
  state.framesUntilNextTick = 0;
  state.didMutate = false;
  state.domEventDepth = 0;
  state.interactiveRenderRequested = false;
  state.routerTeardown = null;
}
