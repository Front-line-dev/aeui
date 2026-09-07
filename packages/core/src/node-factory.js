import { assertElementType } from './component-type.js';
import { createComponentNode } from './component-lifecycle.js';
import { getVNodeKey, isFragmentVNode } from './vnode-helpers.js';

export function createRootNode(containerElement) {
  return {
    kind: 'root',
    key: null,
    vnode: null,
    parent: null,
    parentDom: containerElement,
    children: [],
    firstDom: null,
    lastDom: null,
    isMounted: true,
  };
}

export function createNode(state, vnode, parentNode = null, parentDom = null) {
  const node = {
    kind: null,
    key: getVNodeKey(vnode),
    vnode,
    parent: parentNode,
    parentDom,
    children: [],
    firstDom: null,
    lastDom: null,
    isMounted: true,
  };

  if (vnode == null || typeof vnode === 'boolean') {
    return null;
  }

  if (typeof vnode !== 'object') {
    node.kind = 'text';
    node.value = String(vnode);
    node.dom = null;
    return node;
  }

  if (isFragmentVNode(state.Fragment, vnode)) {
    node.kind = 'fragment';
    return node;
  }

  if (typeof vnode.tag === 'string') {
    node.kind = 'host';
    node.tag = vnode.tag;
    node.dom = null;
    node.props = vnode.props || {};
    return node;
  }

  assertElementType(vnode.tag);
  return createComponentNode(vnode, parentNode, parentDom);
}
