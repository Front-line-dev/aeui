/**
 * AEUI Framework Core
 */
import { _deepEqual, _deepClone } from './deep-compare.js';
import {
  setRuntimeContext,
  _runComponentWatchers,
  createInstance, _getDomNodeCountForInstance, _getDomNodeCount,
  init, render, _tick,
  _stopScheduler, _startScheduler, _onAnimationFrame,
} from './runtime.js';
import {
  _createDomNode, updateProps, _updateDomProps,
  _unmount, _countComponentNodes, _removeComponentInstances,
  _alignComponentInstances, _unmountVNode, _reconcile,
} from './reconciler.js';

export const AEUI = {
  _rootInstance: null,
  _containerElement: null,
  _RootComponent: null,
  _currentInstance: null,
  _isRendering: false,
  _rafId: null,
  _frameDelay: 1,
  _framesUntilNextTick: 0,
  _didMutate: false,

  // VNode
  createVNode(tag, props, ...children) {
    const validChildren = children.flat().filter(c => c != null && typeof c !== 'boolean');
    const finalProps = props || {};
    finalProps.children = validChildren;
    return { tag, props: finalProps, children: validChildren };
  },

  // Deep compare
  _deepEqual,
  _deepClone,

  // Instance & Scheduler
  createInstance,
  _getDomNodeCountForInstance,
  _getDomNodeCount,
  init,
  render,
  _tick,
  _stopScheduler,
  _startScheduler,
  _onAnimationFrame,

  // Runtime
  _runComponentWatchers,

  // DOM & Reconciler
  _createDomNode,
  updateProps,
  _updateDomProps,
  _unmount,
  _countComponentNodes,
  _removeComponentInstances,
  _alignComponentInstances,
  _unmountVNode,
  _reconcile,
};

setRuntimeContext({
  getCurrentInstance: () => AEUI._currentInstance,
  deepClone: (value) => AEUI._deepClone(value),
});

AEUI.createElement = AEUI.createVNode;
AEUI.Fragment = (initialProps) => (props) => props.children;
