import {
  runComponentWatchersBridge,
  runRenderPhaseBridge,
} from './compiler-runtime.js';
import {
  createDomNode,
  updateDomProps,
  updateProps,
} from './dom-host.js';
import { createNode, createRootNode } from './node-factory.js';
import { reconcile, unmountNode } from './reconciler.js';
import { createRuntimeState } from './runtime-state.js';
import { createDirectoryRouter } from './router.js';
import {
  dispatchDomEvent,
  init,
  onAnimationFrame,
  render,
  reconcileRoot,
  requestRender,
  startScheduler,
  stopScheduler,
  tick,
} from './runtime.js';
import { registerCleanup, registerWatch } from './hook-registry.js';

function bindRuntimeState(state, internalRuntime, shared) {
  state.Fragment = shared.Fragment;
  state.createVNode = shared.createVNode;
  state.createElement = shared.createElement;
  state.createRootNode = createRootNode;
  state.updateProps = updateProps;
  state.createNode = (...args) => internalRuntime.createNode(...args);
  state.reconcile = (...args) => internalRuntime.reconcile(...args);
  state.unmountNode = (...args) => internalRuntime.unmountNode(...args);
  state.dispatchDomEvent = (...args) => internalRuntime.dispatchDomEvent(...args);
  state.requestRender = (...args) => internalRuntime.requestRender(...args);
  state.runRenderPhase = (...args) => internalRuntime.runRenderPhase(...args);
  state.stopScheduler = (...args) => internalRuntime.stopScheduler(...args);
  state.startScheduler = (...args) => internalRuntime.startScheduler(...args);
  state.onAnimationFrame = (...args) => internalRuntime.onAnimationFrame(...args);
  state.tick = (...args) => internalRuntime.tick(...args);
}

export function createAppRuntime({
  deepEqual,
  deepClone,
  createVNode,
  createElement = createVNode,
  Fragment,
}) {
  const state = createRuntimeState({ deepEqual, deepClone });

  const internalRuntime = {
    state,
    deepEqual,
    deepClone,
    createRootNode,
    createNode: (...args) => createNode(state, ...args),
    requestRender: (...args) => requestRender(state, ...args),
    tick: (...args) => tick(state, ...args),
    reconcileRoot: (...args) => reconcileRoot(state, ...args),
    stopScheduler: (...args) => stopScheduler(state, ...args),
    startScheduler: (...args) => startScheduler(state, ...args),
    onAnimationFrame: (...args) => onAnimationFrame(state, ...args),
    runComponentWatchers: (...args) => runComponentWatchersBridge(state, ...args),
    runRenderPhase: (...args) => runRenderPhaseBridge(state, ...args),
    initDirectoryRouter: (routeModules, containerElement, options) => {
      const { Root, attach } = createDirectoryRouter(state, routeModules, options);
      init(state, Root, containerElement);
      attach(containerElement);
    },
    createDomNode: (...args) => createDomNode(state, ...args),
    watch: (...args) => registerWatch(state, ...args),
    clean: (...args) => registerCleanup(state, ...args),
    updateProps,
    updateDomProps: (...args) => updateDomProps(state, ...args),
    unmountNode: (...args) => unmountNode(state, ...args),
    reconcile: (...args) => reconcile(state, ...args),
    dispatchDomEvent: (...args) => dispatchDomEvent(state, ...args),
  };

  bindRuntimeState(state, internalRuntime, {
    createVNode,
    createElement,
    Fragment,
  });

  return {
    createVNode,
    createElement,
    Fragment,
    init: (...args) => init(state, ...args),
    render: (...args) => render(state, ...args),
    __runtime: internalRuntime,
  };
}
