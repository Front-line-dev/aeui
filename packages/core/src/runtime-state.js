export function createRuntimeState({ deepEqual, deepClone }) {
  return {
    deepEqual,
    deepClone,
    rootNode: null,
    containerElement: null,
    RootComponent: null,
    currentComponentNode: null,
    currentInstance: null,
    isRendering: false,
    rafId: null,
    frameDelay: 1,
    framesUntilNextTick: 0,
    didMutate: false,
  };
}

export function resetRuntimeState(state) {
  state.rootNode = null;
  state.containerElement = null;
  state.RootComponent = null;
  state.currentComponentNode = null;
  state.currentInstance = null;
  state.isRendering = false;
  state.rafId = null;
  state.frameDelay = 1;
  state.framesUntilNextTick = 0;
  state.didMutate = false;
}
