/**
 * AEUI Framework Core
 */
import { _deepEqual, _deepClone } from './deep-compare.js';
import {
  setRuntimeContext,
  _runComponentWatchers,
  createRootNode, createNode,
  init, render, _tick, _reconcileRoot,
  _stopScheduler, _startScheduler, _onAnimationFrame,
} from './runtime.js';
import {
  _createDomNode, updateProps, _updateDomProps,
  _unmountNode, _reconcile,
} from './reconciler.js';

export const AEUI = {
  _rootNode: null,
  _containerElement: null,
  _RootComponent: null,
  _currentComponentNode: null,
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

  // Runtime & Scheduler
  createRootNode,
  createNode,
  init,
  render,
  _tick,
  _reconcileRoot,
  _stopScheduler,
  _startScheduler,
  _onAnimationFrame,

  // Runtime
  _runComponentWatchers,

  // DOM & Reconciler
  _createDomNode,
  updateProps,
  _updateDomProps,
  _unmountNode,
  _reconcile,
};

setRuntimeContext({
  getCurrentComponentNode: () => AEUI._currentComponentNode,
  deepClone: (value) => AEUI._deepClone(value),
});

AEUI.createElement = AEUI.createVNode;
AEUI.Fragment = (initialProps) => (props) => props.children;
