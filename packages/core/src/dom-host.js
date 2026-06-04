function isInternalJsxMetadataProp(key) {
  return key === '__self' || key === '__source';
}

export function cloneHostPropsSnapshot(state, props = {}) {
  const snapshot = {};

  Object.entries(props).forEach(([key, value]) => {
    if (key === 'children' || key === 'key' || key === 'ref' || isInternalJsxMetadataProp(key)) return;
    snapshot[key] = state.deepClone(value);
  });

  return snapshot;
}

export function syncHostControlledProps(state, node) {
  if (!node || node.kind !== 'host' || !node.dom || !node.props) return;

  if (Object.prototype.hasOwnProperty.call(node.props, 'value')) {
    const normalizedValue = node.props.value == null ? '' : String(node.props.value);

    if (
      node.tag === 'select' ||
      node.tag === 'textarea' ||
      (node.tag === 'input' && node.props.type !== 'file')
    ) {
      if (node.dom.value !== normalizedValue) {
        node.dom.value = normalizedValue;
        state.didMutate = true;
      }
    }
  }

  if (node.tag === 'input' && Object.prototype.hasOwnProperty.call(node.props, 'checked')) {
    const normalizedChecked = !!node.props.checked;
    if (node.dom.checked !== normalizedChecked) {
      node.dom.checked = normalizedChecked;
      state.didMutate = true;
    }
  }
}

export function createDomNode(state, vnode) {
  if (typeof vnode !== 'object') {
    return document.createTextNode(String(vnode));
  }

  const domNode = document.createElement(vnode.tag);
  updateDomProps(state, domNode, vnode.props);
  return domNode;
}

export function updateProps(target, newProps) {
  for (const key in target) delete target[key];
  if (newProps) Object.assign(target, newProps);
}

export function updateDomProps(state, domNode, props, oldProps = {}) {
  const allProps = { ...oldProps, ...props };

  for (const key in allProps) {
    if (key === 'children' || key === 'key' || key === 'ref' || isInternalJsxMetadataProp(key)) continue;

    const newValue = props ? props[key] : undefined;
    const oldValue = oldProps ? oldProps[key] : undefined;

    if (state.deepEqual(newValue, oldValue)) continue;

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
          if (typeof state.dispatchDomEvent === 'function') {
            state.dispatchDomEvent(domNode, eventName, event);
            return;
          }

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
      state.didMutate = true;
    } else if (key === 'style' && typeof newValue === 'object' && newValue !== null) {
      domNode.style.cssText = '';
      Object.assign(domNode.style, newValue);
      state.didMutate = true;
    } else if (key === 'style' && typeof newValue === 'string') {
      domNode.style.cssText = newValue;
      state.didMutate = true;
    } else if (key === 'value') {
      const isFileInput = domNode.tagName === 'INPUT' && domNode.type === 'file';
      if (isFileInput) {
        domNode.removeAttribute('value');
        state.didMutate = true;
        continue;
      }

      const normalizedValue = newValue == null ? '' : String(newValue);
      domNode.value = normalizedValue;
      if (newValue === undefined || newValue === null) {
        domNode.removeAttribute('value');
      } else {
        domNode.setAttribute('value', normalizedValue);
      }
      state.didMutate = true;
    } else if (typeof newValue === 'boolean') {
      domNode[key] = newValue;
      if (newValue) domNode.setAttribute(key, '');
      else domNode.removeAttribute(key);
      state.didMutate = true;
    } else if (newValue === undefined || newValue === null) {
      if (typeof oldValue === 'boolean' || typeof domNode[key] === 'boolean') {
        domNode[key] = false;
      }
      domNode.removeAttribute(key);
      state.didMutate = true;
    } else {
      domNode.setAttribute(key, newValue);
      state.didMutate = true;
    }
  }
}
