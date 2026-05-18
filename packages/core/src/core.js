/**
 * AEUI Framework Core
 */
import { createAppRuntime } from './app-runtime.js';
import { _deepEqual, _deepClone } from './deep-compare.js';
import { VNODE_MARKER } from './vnode-marker.js';

function createVNode(tag, props, ...children) {
  const validChildren = children.flat().filter((child) => child != null && typeof child !== 'boolean');
  const finalProps = props || {};
  finalProps.children = validChildren;
  const vnode = { tag, props: finalProps, children: validChildren };
  Object.defineProperty(vnode, VNODE_MARKER, {
    value: true,
    enumerable: false,
  });
  return vnode;
}

function Fragment(initialProps) {
  return (props) => props.children;
}

export const AEUI = createAppRuntime({
  deepEqual: _deepEqual,
  deepClone: _deepClone,
  createVNode,
  createElement: createVNode,
  Fragment,
});
