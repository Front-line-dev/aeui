export function createRuntimeState({ deepEqual, deepClone }) {
  const state = {
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

  Object.defineProperties(state, {
    _deepEqual: {
      get: () => state.deepEqual,
    },
    _deepClone: {
      get: () => state.deepClone,
    },
    _rootNode: {
      get: () => state.rootNode,
      set: (value) => { state.rootNode = value; },
    },
    _containerElement: {
      get: () => state.containerElement,
      set: (value) => { state.containerElement = value; },
    },
    _RootComponent: {
      get: () => state.RootComponent,
      set: (value) => { state.RootComponent = value; },
    },
    _currentComponentNode: {
      get: () => state.currentComponentNode,
      set: (value) => { state.currentComponentNode = value; },
    },
    _currentInstance: {
      get: () => state.currentInstance,
      set: (value) => { state.currentInstance = value; },
    },
    _isRendering: {
      get: () => state.isRendering,
      set: (value) => { state.isRendering = value; },
    },
    _rafId: {
      get: () => state.rafId,
      set: (value) => { state.rafId = value; },
    },
    _frameDelay: {
      get: () => state.frameDelay,
      set: (value) => { state.frameDelay = value; },
    },
    _framesUntilNextTick: {
      get: () => state.framesUntilNextTick,
      set: (value) => { state.framesUntilNextTick = value; },
    },
    _didMutate: {
      get: () => state.didMutate,
      set: (value) => { state.didMutate = value; },
    },
  });

  return state;
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
