/**
 * AEUI Framework Core
 */
import { createAppRuntime } from './app-runtime.js';
import { _deepEqual, _deepClone } from './deep-compare.js';

function createVNode(tag, props, ...children) {
  const validChildren = children.flat().filter((child) => child != null && typeof child !== 'boolean');
  const finalProps = props || {};
  finalProps.children = validChildren;
  return { tag, props: finalProps, children: validChildren };
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
