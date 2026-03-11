/**
 * DOM operations, runtime node reconciliation, and unmounting
 */

function getVNodeKey(vnode) {
  if (vnode == null || typeof vnode !== 'object' || Array.isArray(vnode)) return null;
  const key = vnode.props ? vnode.props.key : undefined;
  return key == null ? null : key;
}

function isFragmentVNode(AEUI, vnode) {
  return Array.isArray(vnode) || (vnode && typeof vnode === 'object' && vnode.tag === AEUI.Fragment);
}

function getFragmentChildren(AEUI, vnode) {
  if (Array.isArray(vnode)) return vnode;
  if (isFragmentVNode(AEUI, vnode)) return vnode.children || [];
  return [];
}

function syncHostControlledProps(node) {
  if (!node || node.kind !== 'host' || !node.dom || !node.props) return;

  if (node.tag === 'select' && Object.prototype.hasOwnProperty.call(node.props, 'value')) {
    const normalizedValue = node.props.value == null ? '' : String(node.props.value);
    node.dom.value = normalizedValue;
  }
}

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

function placeNode(parentDom, node, beforeDom) {
  const nodes = getDomNodesInRange(parentDom, node);
  if (nodes.length === 0) return;
  const lastNode = nodes[nodes.length - 1];
  if (lastNode.nextSibling === beforeDom) return;

  nodes.forEach((domNode) => {
    parentDom.insertBefore(domNode, beforeDom);
  });
  this._didMutate = true;
}

function warnDuplicateKey(key) {
  console.warn(`[AEUI] Duplicate key detected in sibling list: ${String(key)}`);
}

function isSameNodeType(AEUI, oldNode, newVNode) {
  if (!oldNode) return false;
  if (oldNode.key !== getVNodeKey(newVNode)) return false;

  switch (oldNode.kind) {
    case 'text':
      return typeof newVNode !== 'object' || newVNode == null;
    case 'fragment':
      return isFragmentVNode(AEUI, newVNode);
    case 'host':
      return !!newVNode && typeof newVNode === 'object' && !Array.isArray(newVNode) && oldNode.tag === newVNode.tag;
    case 'component':
      return !!newVNode && typeof newVNode === 'object' && typeof newVNode.tag === 'function' &&
        newVNode.tag !== AEUI.Fragment && oldNode.component === newVNode.tag;
    default:
      return false;
  }
}

function reconcileChildren(parentDom, parentNode, newVNodes, beforeDom = null) {
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

    const nextChild = this._reconcile(parentDom, matchedChild, newVNode, beforeDom, parentNode);
    if (nextChild) {
      nextChildren.push(nextChild);
    }
  }

  oldChildren.forEach((child) => {
    if (!child._matched) {
      this._unmountNode(child);
    }
    delete child._matched;
  });

  let anchor = beforeDom;
  for (let i = nextChildren.length - 1; i >= 0; i--) {
    const child = nextChildren[i];
    placeNode.call(this, parentDom, child, anchor);
    if (child.firstDom) {
      anchor = child.firstDom;
    }
  }

  parentNode.children = nextChildren;

  if (parentNode.kind === 'fragment' || parentNode.kind === 'root') {
    updateRangeFromChildren(parentNode);
  }
}

function mountTextNode(parentDom, node, beforeDom) {
  const dom = document.createTextNode(node.value);
  parentDom.insertBefore(dom, beforeDom);
  node.dom = dom;
  node.firstDom = dom;
  node.lastDom = dom;
  this._didMutate = true;
  return node;
}

function mountHostNode(parentDom, node, beforeDom) {
  const dom = this._createDomNode(node.vnode);
  parentDom.insertBefore(dom, beforeDom);
  node.dom = dom;
  node.props = node.vnode.props || {};
  node.firstDom = dom;
  node.lastDom = dom;
  this._didMutate = true;

  reconcileChildren.call(this, dom, node, node.vnode.children || [], null);
  syncHostControlledProps(node);
  node.firstDom = dom;
  node.lastDom = dom;
  return node;
}

function mountFragmentNode(parentDom, node, beforeDom) {
  reconcileChildren.call(this, parentDom, node, getFragmentChildren(this, node.vnode), beforeDom);
  updateRangeFromChildren(node);
  return node;
}

function mountComponentNode(parentDom, node, beforeDom) {
  node.props = node.vnode.props || {};

  let renderedVNode;
  this._currentComponentNode = node;
  this._currentInstance = node;
  try {
    renderedVNode = node.render(node.props);
  } finally {
    this._currentComponentNode = null;
    this._currentInstance = null;
  }

  const renderedNode = this._reconcile(parentDom, null, renderedVNode, beforeDom, node);
  node.renderedNode = renderedNode;
  node.children = renderedNode ? [renderedNode] : [];
  node.firstDom = renderedNode ? renderedNode.firstDom : null;
  node.lastDom = renderedNode ? renderedNode.lastDom : null;
  return node;
}

function mountNode(parentDom, node, beforeDom) {
  switch (node.kind) {
    case 'text':
      return mountTextNode.call(this, parentDom, node, beforeDom);
    case 'host':
      return mountHostNode.call(this, parentDom, node, beforeDom);
    case 'fragment':
      return mountFragmentNode.call(this, parentDom, node, beforeDom);
    case 'component':
      return mountComponentNode.call(this, parentDom, node, beforeDom);
    default:
      return null;
  }
}

function updateTextNode(node, newVNode) {
  const nextValue = String(newVNode);
  node.vnode = newVNode;
  node.key = null;

  if (node.value !== nextValue) {
    node.value = nextValue;
    node.dom.nodeValue = nextValue;
    this._didMutate = true;
  }

  node.firstDom = node.dom;
  node.lastDom = node.dom;
  return node;
}

function updateHostNode(node, newVNode) {
  this._updateDomProps(node.dom, newVNode.props, node.props || {});
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  node.tag = newVNode.tag;
  node.props = newVNode.props || {};
  reconcileChildren.call(this, node.dom, node, newVNode.children || [], null);
  syncHostControlledProps(node);
  node.firstDom = node.dom;
  node.lastDom = node.dom;
  return node;
}

function updateFragmentNode(parentDom, node, newVNode, beforeDom) {
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  reconcileChildren.call(this, parentDom, node, getFragmentChildren(this, newVNode), beforeDom);
  updateRangeFromChildren(node);
  return node;
}

function updateComponentNode(parentDom, node, newVNode, beforeDom) {
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  node.component = newVNode.tag;
  node.props = newVNode.props || {};

  let renderedVNode;
  this._currentComponentNode = node;
  this._currentInstance = node;
  try {
    renderedVNode = node.render(node.props);
  } finally {
    this._currentComponentNode = null;
    this._currentInstance = null;
  }

  const renderedNode = this._reconcile(
    parentDom,
    node.renderedNode,
    renderedVNode,
    beforeDom,
    node
  );

  node.renderedNode = renderedNode;
  node.children = renderedNode ? [renderedNode] : [];
  node.firstDom = renderedNode ? renderedNode.firstDom : null;
  node.lastDom = renderedNode ? renderedNode.lastDom : null;
  return node;
}

function removeDomRange(parentDom, node) {
  const nodes = getDomNodesInRange(parentDom, node);
  nodes.forEach((domNode) => {
    if (domNode.parentNode === parentDom) {
      parentDom.removeChild(domNode);
    }
  });

  if (nodes.length > 0) {
    this._didMutate = true;
  }
}

export function _createDomNode(vnode) {
  if (typeof vnode !== 'object') {
    return document.createTextNode(String(vnode));
  }

  const domNode = document.createElement(vnode.tag);
  this._updateDomProps(domNode, vnode.props);
  return domNode;
}

export function updateProps(target, newProps) {
  for (const key in target) delete target[key];
  if (newProps) Object.assign(target, newProps);
}

export function _updateDomProps(domNode, props, oldProps = {}) {
  const allProps = { ...oldProps, ...props };

  for (const key in allProps) {
    if (key === 'children' || key === 'key' || key === 'ref') continue;

    const newValue = props ? props[key] : undefined;
    const oldValue = oldProps ? oldProps[key] : undefined;

    if (this._deepEqual(newValue, oldValue)) continue;

    if (key.startsWith('on')) {
      const eventName = key.substring(2).toLowerCase();

      if (!domNode._aeuiHandlers) {
        domNode._aeuiHandlers = {};
      }
      if (!domNode._aeuiProxyListeners) {
        domNode._aeuiProxyListeners = {};
      }

      if (typeof newValue !== 'function') {
        if (domNode._aeuiProxyListeners[eventName]) {
          domNode.removeEventListener(eventName, domNode._aeuiProxyListeners[eventName]);
          delete domNode._aeuiProxyListeners[eventName];
        }
        delete domNode._aeuiHandlers[eventName];
        continue;
      }

      domNode._aeuiHandlers[eventName] = newValue;

      if (!domNode._aeuiProxyListeners[eventName]) {
        const proxyListener = (event) => {
          const currentHandler = domNode._aeuiHandlers[eventName];
          if (typeof currentHandler === 'function') {
            currentHandler.call(domNode, event);
          }
        };
        domNode.addEventListener(eventName, proxyListener);
        domNode._aeuiProxyListeners[eventName] = proxyListener;
      }
    } else if (key === 'className') {
      domNode.className = newValue ?? '';
      this._didMutate = true;
    } else if (key === 'style' && typeof newValue === 'object' && newValue !== null) {
      domNode.style.cssText = '';
      Object.assign(domNode.style, newValue);
      this._didMutate = true;
    } else if (key === 'style' && typeof newValue === 'string') {
      domNode.style.cssText = newValue;
      this._didMutate = true;
    } else if (key === 'value') {
      const normalizedValue = newValue == null ? '' : String(newValue);
      domNode.value = normalizedValue;
      if (newValue === undefined || newValue === null) {
        domNode.removeAttribute('value');
      } else {
        domNode.setAttribute('value', normalizedValue);
      }
      this._didMutate = true;
    } else if (typeof newValue === 'boolean') {
      domNode[key] = newValue;
      if (newValue) domNode.setAttribute(key, '');
      else domNode.removeAttribute(key);
      this._didMutate = true;
    } else if (newValue === undefined || newValue === null) {
      domNode.removeAttribute(key);
      this._didMutate = true;
    } else {
      domNode.setAttribute(key, newValue);
      this._didMutate = true;
    }
  }
}

export function _unmountNode(node, removeDom = true) {
  if (!node) return;

  node.isMounted = false;

  if (node.kind === 'component') {
    node.cleanups.forEach((cleanup) => {
      try { cleanup(); } catch (e) { console.error('[AEUI] Cleanup error:', e); }
    });
  }

  (node.children || []).forEach((child) => {
    this._unmountNode(child, false);
  });

  if (removeDom && node.parentDom) {
    removeDomRange.call(this, node.parentDom, node);
  }

  if (node.kind === 'component') {
    node.watchStates = [];
    node.cleanups = [];
    node.renderedNode = null;
  }

  node.children = [];
  node.firstDom = null;
  node.lastDom = null;
}

export function _reconcile(parentDom, oldNode, newVNode, beforeDom = null, parentNode = null) {
  if (newVNode == null || typeof newVNode === 'boolean') {
    if (oldNode) {
      this._unmountNode(oldNode);
    }
    return null;
  }

  if (oldNode && !isSameNodeType(this, oldNode, newVNode)) {
    this._unmountNode(oldNode);
    oldNode = null;
  }

  if (!oldNode) {
    const node = this.createNode(newVNode, parentNode, parentDom);
    return mountNode.call(this, parentDom, node, beforeDom);
  }

  oldNode.parent = parentNode;
  oldNode.parentDom = parentDom;

  switch (oldNode.kind) {
    case 'text':
      return updateTextNode.call(this, oldNode, newVNode);
    case 'host':
      return updateHostNode.call(this, oldNode, newVNode);
    case 'fragment':
      return updateFragmentNode.call(this, parentDom, oldNode, newVNode, beforeDom);
    case 'component':
      return updateComponentNode.call(this, parentDom, oldNode, newVNode, beforeDom);
    default:
      return oldNode;
  }
}
