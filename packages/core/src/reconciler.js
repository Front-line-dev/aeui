/**
 * Runtime node reconciliation, DOM range placement, and unmounting
 */
import { cleanupComponentNode, renderComponentNode } from './component-lifecycle.js';
import {
  cloneHostPropsSnapshot,
  createDomNode,
  syncHostControlledProps,
  updateDomProps,
} from './dom-host.js';
import {
  getFragmentChildren,
  getVNodeKey,
  isFragmentVNode,
} from './vnode-helpers.js';

function updateRangeFromChildren(node) {
  let firstDom = null;
  let lastDom = null;

  for (const child of node.children || []) {
    if (!firstDom && child && child.firstDom) {
      firstDom = child.firstDom;
    }
    if (child && child.lastDom) {
      lastDom = child.lastDom;
    }
  }

  node.firstDom = firstDom;
  node.lastDom = lastDom;
}

function getDomNodesInRange(parentDom, node) {
  if (!node || !node.firstDom || !node.lastDom) return [];
  if (node.firstDom.parentNode !== parentDom) return [];

  const nodes = [];
  let current = node.firstDom;

  while (current) {
    nodes.push(current);
    if (current === node.lastDom) break;
    current = current.nextSibling;
  }

  return nodes;
}

function placeNode(state, parentDom, node, beforeDom) {
  const nodes = getDomNodesInRange(parentDom, node);
  if (nodes.length === 0) return;

  const lastNode = nodes[nodes.length - 1];
  if (lastNode.nextSibling === beforeDom) return;

  nodes.forEach((domNode) => {
    parentDom.insertBefore(domNode, beforeDom);
  });
  state.didMutate = true;
}

function removeInsertedSiblings(state, parentDom, afterDom, beforeDom) {
  let current = afterDom ? afterDom.nextSibling : parentDom.firstChild;

  while (current && current !== beforeDom) {
    const next = current.nextSibling;
    parentDom.removeChild(current);
    state.didMutate = true;
    current = next;
  }
}

function warnDuplicateKey(key) {
  console.warn(`[AEUI] Duplicate key detected in sibling list: ${String(key)}`);
}

function isSameNodeType(state, oldNode, newVNode) {
  if (!oldNode) return false;
  if (oldNode.key !== getVNodeKey(newVNode)) return false;

  switch (oldNode.kind) {
    case 'text':
      return typeof newVNode !== 'object' || newVNode == null;
    case 'fragment':
      return isFragmentVNode(state.Fragment, newVNode);
    case 'host':
      return !!newVNode && typeof newVNode === 'object' && !Array.isArray(newVNode) && oldNode.tag === newVNode.tag;
    case 'component':
      return !!newVNode && typeof newVNode === 'object' && typeof newVNode.tag === 'function' &&
        newVNode.tag !== state.Fragment && oldNode.component === newVNode.tag;
    default:
      return false;
  }
}

function reconcileChildren(state, parentDom, parentNode, newVNodes, beforeDom = null) {
  const oldChildren = parentNode.children || [];
  const keyedOld = new Map();
  const seenNewKeys = new Set();
  const nextChildren = [];
  let nextUnkeyedOld = 0;

  oldChildren.forEach((child) => {
    child._matched = false;
    if (child.key == null) return;
    if (keyedOld.has(child.key)) {
      warnDuplicateKey(child.key);
      return;
    }
    keyedOld.set(child.key, child);
  });

  for (const newVNode of newVNodes) {
    const key = getVNodeKey(newVNode);
    let matchedChild = null;

    if (key != null) {
      if (seenNewKeys.has(key)) {
        warnDuplicateKey(key);
      } else {
        seenNewKeys.add(key);
      }

      const candidate = keyedOld.get(key);
      if (candidate && !candidate._matched) {
        matchedChild = candidate;
      }
    } else {
      while (nextUnkeyedOld < oldChildren.length) {
        const candidate = oldChildren[nextUnkeyedOld++];
        if (!candidate._matched && candidate.key == null) {
          matchedChild = candidate;
          break;
        }
      }
    }

    if (matchedChild) {
      matchedChild._matched = true;
    }

    const nextChild = state.reconcile(parentDom, matchedChild, newVNode, beforeDom, parentNode);
    if (nextChild) {
      nextChildren.push(nextChild);
    }
  }

  oldChildren.forEach((child) => {
    if (!child._matched) {
      state.unmountNode(child);
    }
    delete child._matched;
  });

  let anchor = beforeDom;
  for (let i = nextChildren.length - 1; i >= 0; i--) {
    const child = nextChildren[i];
    placeNode(state, parentDom, child, anchor);
    if (child.firstDom) {
      anchor = child.firstDom;
    }
  }

  parentNode.children = nextChildren;

  if (parentNode.kind === 'fragment' || parentNode.kind === 'root') {
    updateRangeFromChildren(parentNode);
  }
}

function mountTextNode(state, parentDom, node, beforeDom) {
  const dom = document.createTextNode(node.value);
  parentDom.insertBefore(dom, beforeDom);
  node.dom = dom;
  node.firstDom = dom;
  node.lastDom = dom;
  state.didMutate = true;
  return node;
}

function mountHostNode(state, parentDom, node, beforeDom) {
  const dom = createDomNode(state, node.vnode);
  parentDom.insertBefore(dom, beforeDom);
  node.dom = dom;
  node.props = cloneHostPropsSnapshot(state, node.vnode.props || {});
  node.firstDom = dom;
  node.lastDom = dom;
  state.didMutate = true;

  try {
    reconcileChildren(state, dom, node, node.vnode.children || [], null);
    syncHostControlledProps(state, node);
    node.firstDom = dom;
    node.lastDom = dom;
    return node;
  } catch (error) {
    state.unmountNode(node, false);
    if (dom.parentNode === parentDom) {
      parentDom.removeChild(dom);
      state.didMutate = true;
    }
    node.dom = null;
    node.firstDom = null;
    node.lastDom = null;
    throw error;
  }
}

function mountFragmentNode(state, parentDom, node, beforeDom) {
  const afterDom = beforeDom ? beforeDom.previousSibling : parentDom.lastChild;

  try {
    reconcileChildren(state, parentDom, node, getFragmentChildren(state.Fragment, node.vnode), beforeDom);
    updateRangeFromChildren(node);
    return node;
  } catch (error) {
    state.unmountNode(node, false);
    removeInsertedSiblings(state, parentDom, afterDom, beforeDom);
    node.firstDom = null;
    node.lastDom = null;
    throw error;
  }
}

function mountComponentNode(state, parentDom, node, beforeDom) {
  return renderComponentNode(state, parentDom, node, node.vnode.props || {}, beforeDom);
}

function mountNode(state, parentDom, node, beforeDom) {
  switch (node.kind) {
    case 'text':
      return mountTextNode(state, parentDom, node, beforeDom);
    case 'host':
      return mountHostNode(state, parentDom, node, beforeDom);
    case 'fragment':
      return mountFragmentNode(state, parentDom, node, beforeDom);
    case 'component':
      return mountComponentNode(state, parentDom, node, beforeDom);
    default:
      return null;
  }
}

function updateTextNode(state, node, newVNode) {
  const nextValue = String(newVNode);
  node.vnode = newVNode;
  node.key = null;

  if (node.value !== nextValue) {
    node.value = nextValue;
    node.dom.nodeValue = nextValue;
    state.didMutate = true;
  }

  node.firstDom = node.dom;
  node.lastDom = node.dom;
  return node;
}

function updateHostNode(state, node, newVNode) {
  updateDomProps(state, node.dom, newVNode.props, node.props || {});
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  node.tag = newVNode.tag;
  node.props = cloneHostPropsSnapshot(state, newVNode.props || {});
  reconcileChildren(state, node.dom, node, newVNode.children || [], null);
  syncHostControlledProps(state, node);
  node.firstDom = node.dom;
  node.lastDom = node.dom;
  return node;
}

function updateFragmentNode(state, parentDom, node, newVNode, beforeDom) {
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  reconcileChildren(state, parentDom, node, getFragmentChildren(state.Fragment, newVNode), beforeDom);
  updateRangeFromChildren(node);
  return node;
}

function updateComponentNode(state, parentDom, node, newVNode, beforeDom) {
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  node.component = newVNode.tag;
  return renderComponentNode(state, parentDom, node, newVNode.props || {}, beforeDom);
}

function removeDomRange(state, parentDom, node) {
  const nodes = getDomNodesInRange(parentDom, node);
  nodes.forEach((domNode) => {
    if (domNode.parentNode === parentDom) {
      parentDom.removeChild(domNode);
    }
  });

  if (nodes.length > 0) {
    state.didMutate = true;
  }
}

export function unmountNode(state, node, removeDom = true) {
  if (!node) return;

  node.isMounted = false;

  if (node.kind === 'component') {
    cleanupComponentNode(state, node, {
      preserveChildren: true,
      preserveDomRange: true,
    });
  }

  (node.children || []).forEach((child) => {
    state.unmountNode(child, false);
  });

  if (removeDom && node.parentDom) {
    removeDomRange(state, node.parentDom, node);
  }

  node.children = [];
  node.firstDom = null;
  node.lastDom = null;
}

export function reconcile(state, parentDom, oldNode, newVNode, beforeDom = null, parentNode = null) {
  if (newVNode == null || typeof newVNode === 'boolean') {
    if (oldNode) {
      state.unmountNode(oldNode);
    }
    return null;
  }

  if (oldNode && !isSameNodeType(state, oldNode, newVNode)) {
    state.unmountNode(oldNode);
    oldNode = null;
  }

  if (!oldNode) {
    const node = state.createNode(newVNode, parentNode, parentDom);
    return mountNode(state, parentDom, node, beforeDom);
  }

  oldNode.parent = parentNode;
  oldNode.parentDom = parentDom;

  switch (oldNode.kind) {
    case 'text':
      return updateTextNode(state, oldNode, newVNode);
    case 'host':
      return updateHostNode(state, oldNode, newVNode);
    case 'fragment':
      return updateFragmentNode(state, parentDom, oldNode, newVNode, beforeDom);
    case 'component':
      return updateComponentNode(state, parentDom, oldNode, newVNode, beforeDom);
    default:
      return oldNode;
  }
}
