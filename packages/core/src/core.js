/**
 * AEUI Framework Core
 */
import { _deepEqual, _deepClone } from './deep-compare.js';
import { runComponentRenderPhase } from './component-lifecycle.js';
import { createRuntimeState } from './runtime-state.js';
import {
  setRuntimeContext,
  _runComponentWatchers,
  createRootNode,
  createNode,
  init,
  render,
  _tick,
  _reconcileRoot,
  _stopScheduler,
  _startScheduler,
  _onAnimationFrame,
} from './runtime.js';
import {
  _createDomNode,
  updateProps,
  _updateDomProps,
  _unmountNode,
  _reconcile,
} from './reconciler.js';

function createVNode(tag, props, ...children) {
  const validChildren = children.flat().filter((child) => child != null && typeof child !== 'boolean');
  const finalProps = props || {};
  finalProps.children = validChildren;
  return { tag, props: finalProps, children: validChildren };
}

function Fragment(initialProps) {
  return (props) => props.children;
}

const runtimeState = createRuntimeState({
  deepEqual: _deepEqual,
  deepClone: _deepClone,
});

runtimeState.Fragment = Fragment;
runtimeState.createVNode = createVNode;
runtimeState.createElement = createVNode;
runtimeState.createRootNode = createRootNode;
runtimeState.updateProps = updateProps;

export const AEUI = {
  createVNode,
  createElement: createVNode,
  Fragment,

  _deepEqual,
  _deepClone,

  createRootNode,
  createNode: (...args) => createNode(runtimeState, ...args),
  init: (...args) => init(runtimeState, ...args),
  render: (...args) => render(runtimeState, ...args),
  _tick: (...args) => _tick(runtimeState, ...args),
  _reconcileRoot: (...args) => _reconcileRoot(runtimeState, ...args),
  _stopScheduler: (...args) => _stopScheduler(runtimeState, ...args),
  _startScheduler: (...args) => _startScheduler(runtimeState, ...args),
  _onAnimationFrame: (...args) => _onAnimationFrame(runtimeState, ...args),

  _runComponentWatchers: (node) => _runComponentWatchers(runtimeState, node),
  _runRenderPhase: (nextProps, propsTarget, render) => {
    const node = runtimeState.currentComponentNode;
    if (!node) {
      return typeof render === 'function' ? render(nextProps || {}) : null;
    }

    return runComponentRenderPhase(runtimeState, node, nextProps, render, {
      propsTarget,
      runWatchers: true,
    });
  },

  _createDomNode: (...args) => _createDomNode.call(runtimeState, ...args),
  updateProps,
  _updateDomProps: (...args) => _updateDomProps.call(runtimeState, ...args),
  _unmountNode: (...args) => _unmountNode.call(runtimeState, ...args),
  _reconcile: (...args) => _reconcile.call(runtimeState, ...args),
};

runtimeState.createNode = (...args) => AEUI.createNode(...args);
runtimeState._reconcileRoot = (...args) => AEUI._reconcileRoot(...args);
runtimeState._runComponentWatchers = (node) => AEUI._runComponentWatchers(node);
runtimeState._runRenderPhase = (...args) => AEUI._runRenderPhase(...args);
runtimeState._stopScheduler = (...args) => AEUI._stopScheduler(...args);
runtimeState._startScheduler = (...args) => AEUI._startScheduler(...args);
runtimeState._onAnimationFrame = (...args) => AEUI._onAnimationFrame(...args);
runtimeState._tick = (...args) => AEUI._tick(...args);
runtimeState._createDomNode = (...args) => AEUI._createDomNode(...args);
runtimeState._updateDomProps = (...args) => AEUI._updateDomProps(...args);
runtimeState._unmountNode = (...args) => AEUI._unmountNode(...args);
runtimeState._reconcile = (...args) => AEUI._reconcile(...args);

for (const [legacyKey, stateKey] of [
  ['_rootNode', 'rootNode'],
  ['_containerElement', 'containerElement'],
  ['_RootComponent', 'RootComponent'],
  ['_currentComponentNode', 'currentComponentNode'],
  ['_currentInstance', 'currentInstance'],
  ['_isRendering', 'isRendering'],
  ['_rafId', 'rafId'],
  ['_frameDelay', 'frameDelay'],
  ['_framesUntilNextTick', 'framesUntilNextTick'],
  ['_didMutate', 'didMutate'],
]) {
  Object.defineProperty(AEUI, legacyKey, {
    get: () => runtimeState[stateKey],
    set: (value) => {
      runtimeState[stateKey] = value;
    },
  });
}

setRuntimeContext({
  getCurrentComponentNode: () => runtimeState.currentComponentNode,
  deepClone: (value) => runtimeState.deepClone(value),
});
