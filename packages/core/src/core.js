/**
 * AEUI Framework Core
 */
const MAX_FRAME_DELAY = 60;

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

  createInstance(vnode, parentInstance = null) {
    const instance = {
      vnode: vnode,
      render: null,
      prevRenderedVNode: null,
      watchStates: [],
      cleanups: [],
      props: vnode.props || {},
      parent: parentInstance,
      children: [],
      parentElement: null,
      isMounted: true,

      update() {
        if (!this.isMounted) return;

        let startIndex = 0;
        if (this.parent) {
          // Calculate start index based on previous siblings' DOM nodes
          const siblings = this.parent.children;
          const instanceIndex = siblings.indexOf(this);

          for (let i = 0; i < instanceIndex; i++) {
            startIndex += AEUI._getDomNodeCount(siblings[i].prevRenderedVNode);
          }
        }


        this._childCursor = 0;
        let newVNode;
        AEUI._currentInstance = this;
        try {
          // Run watchers before render
          AEUI._runComponentWatchers(this);

          // Render the component
          newVNode = this.render(this.props);
        } finally {
          AEUI._currentInstance = null;
        }


        AEUI._reconcile(
          this.parentElement,
          newVNode,
          this.prevRenderedVNode,
          startIndex,
          this
        );

        this.prevRenderedVNode = newVNode;
      }
    };

    AEUI._currentInstance = instance;
    try {
      instance.render = vnode.tag(vnode.props);
    } finally {
      AEUI._currentInstance = null;
    }

    return instance;
  },

  _getDomNodeCount(vnode) {
    if (vnode == null) return 0;
    if (typeof vnode !== 'object') return 1; // Text
    if (Array.isArray(vnode)) {
      return vnode.reduce((acc, c) => acc + this._getDomNodeCount(c), 0);
    }
    if (typeof vnode.tag === 'function') {
      // For components, we count the nodes of their rendered content
      return 1; // Simplification: assuming single root for now
    }
    return 1; // DOM Node
  },

  createVNode(tag, props, ...children) {
    const validChildren = children.flat().filter(c => c != null && typeof c !== 'boolean');
    const finalProps = props || {};
    finalProps.children = validChildren;
    return { tag, props: finalProps, children: validChildren };
  },

  init(RootComponent, containerElement) {
    // 중복 호출 방어: 이전 루프 해제 및 이전 루트 언마운트
    this._stopScheduler();
    if (this._rootInstance) {
      this._unmount(this._rootInstance);
    }

    this._RootComponent = RootComponent;
    this._containerElement = containerElement;
    this._rootInstance = null;
    this._previousVNode = null;
    containerElement.innerHTML = '';

    // Initial Render
    const didMutate = this._tick();
    this._frameDelay = didMutate ? 1 : 2;
    this._framesUntilNextTick = this._frameDelay - 1;

    // Start Loop
    this._startScheduler();
  },

  // 사용자 수동 렌더: 즉시 한 번 렌더링한다.
  render() {
    if (!this._RootComponent || !this._containerElement) return false;
    const didMutate = this._tick();
    this._frameDelay = didMutate ? 1 : Math.min(this._frameDelay * 2, MAX_FRAME_DELAY);
    this._framesUntilNextTick = this._frameDelay - 1;
    this._startScheduler();
    return didMutate;
  },

  _stopScheduler() {
    if (this._rafId != null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this._rafId);
      } else {
        clearTimeout(this._rafId);
      }
    }
    this._rafId = null;
  },

  _startScheduler() {
    if (this._rafId != null) return;
    if (typeof requestAnimationFrame === "function") {
      this._rafId = requestAnimationFrame(() => this._onAnimationFrame());
    } else {
      this._rafId = setTimeout(() => this._onAnimationFrame(), 16);
    }
  },

  _onAnimationFrame() {
    this._rafId = null;
    if (!this._RootComponent || !this._containerElement) return;

    if (this._framesUntilNextTick <= 0) {
      const didMutate = this._tick();
      const hasManualRequestDuringTick = this._rafId != null;

      if (hasManualRequestDuringTick) {
        this._framesUntilNextTick = 0;
      } else {
        this._frameDelay = didMutate
          ? 1
          : Math.min(this._frameDelay * 2, MAX_FRAME_DELAY);
        this._framesUntilNextTick = this._frameDelay - 1;
      }
    } else {
      this._framesUntilNextTick -= 1;
    }

    this._startScheduler();
  },

  _tick() {
    if (!this._RootComponent || !this._containerElement) return false;
    if (this._isRendering) return false;
    this._isRendering = true;
    this._didMutate = false;

    try {
      if (this._rootInstance) {
        this._rootInstance.update();
      } else {
        const newVNode = this.createVNode(this._RootComponent);
        this._reconcile(
          this._containerElement,
          newVNode,
          this._previousVNode || null,
          0,
          null
        );
        this._previousVNode = newVNode;
      }
    } catch (e) {
      console.error('[AEUI] Render error:', e);
    } finally {
      this._isRendering = false;
    }
    return this._didMutate;
  },

  _deepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this._deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (a instanceof Date) {
      return b instanceof Date && a.getTime() === b.getTime();
    }

    if (a instanceof RegExp) {
      return b instanceof RegExp && a.source === b.source && a.flags === b.flags;
    }

    if (a instanceof Map) {
      if (!(b instanceof Map) || a.size !== b.size) return false;
      for (const [key, val] of a) {
        if (!b.has(key) || !this._deepEqual(val, b.get(key))) return false;
      }
      return true;
    }

    if (a instanceof Set) {
      if (!(b instanceof Set) || a.size !== b.size) return false;
      for (const val of a) {
        let hasMatch = false;
        for (const bVal of b) {
          if (this._deepEqual(val, bVal)) {
            hasMatch = true;
            break;
          }
        }
        if (!hasMatch) return false;
      }
      return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key) || !this._deepEqual(a[key], b[key])) return false;
    }

    return true;
  },

  _deepClone(v) {
    if (v === null || typeof v !== 'object') return v;

    if (Array.isArray(v)) {
      return v.map(item => this._deepClone(item));
    }

    if (v instanceof Date) return new Date(v.getTime());
    if (v instanceof RegExp) return new RegExp(v.source, v.flags);

    if (v instanceof Map) {
      return new Map([...v].map(([k, val]) => [k, this._deepClone(val)]));
    }

    if (v instanceof Set) {
      return new Set([...v].map(item => this._deepClone(item)));
    }

    return Object.fromEntries(
      Object.entries(v).map(([k, val]) => [k, this._deepClone(val)])
    );
  },

  _runComponentWatchers(instance) {
    if (!instance.watchStates) return;
    instance.watchStates.forEach((watcher) => {
      try {
        const newDeps = watcher.getDeps();
        const hasChanged =
          !watcher.oldDeps ||
          newDeps.some((d, i) => !this._deepEqual(d, watcher.oldDeps[i]));

        if (hasChanged) {
          watcher.callback();
          watcher.oldDeps = this._deepClone(newDeps);
        }
      } catch (e) {
        console.error('[AEUI] Watcher error:', e);
      }
    });
  },

  _createDomNode(vnode) {
    if (typeof vnode !== "object") {
      return document.createTextNode(String(vnode));
    }

    if (typeof vnode.tag !== "string") {
      console.error("_createDomNode: Invalid Tag", vnode.tag, typeof vnode.tag);
    }

    const domNode = document.createElement(vnode.tag);
    this._updateDomProps(domNode, vnode.props);

    return domNode;
  },

  updateProps(target, newProps) {
    for (const key in target) delete target[key];
    if (newProps) Object.assign(target, newProps);
  },

  _updateDomProps(domNode, props, oldProps = {}) {
    const allProps = { ...oldProps, ...props };

    for (const key in allProps) {
      // 내부 전용 prop은 DOM에 설정하지 않음
      if (key === 'children' || key === 'key' || key === 'ref') continue;

      const newValue = props ? props[key] : undefined;
      const oldValue = oldProps ? oldProps[key] : undefined;

      if (this._deepEqual(newValue, oldValue)) continue;

      if (key.startsWith("on")) {
        const eventName = key.substring(2).toLowerCase();

        // 1. Initialize proxy storage on the DOM node if it doesn't exist
        if (!domNode._aeuiHandlers) {
          domNode._aeuiHandlers = {};
        }
        if (!domNode._aeuiProxyListeners) {
          domNode._aeuiProxyListeners = {};
        }

        // 2. Detach listener for any non-function value
        if (typeof newValue !== "function") {
          if (domNode._aeuiProxyListeners[eventName]) {
            domNode.removeEventListener(eventName, domNode._aeuiProxyListeners[eventName]);
            delete domNode._aeuiProxyListeners[eventName];
          }
          delete domNode._aeuiHandlers[eventName];
          continue;
        }

        // 3. Update the reference to the latest handler
        domNode._aeuiHandlers[eventName] = newValue;

        // 4. Attach the proxy listener ONLY ONCE per event type
        if (!domNode._aeuiProxyListeners[eventName]) {
          const proxyListener = (event) => {
            // Keep native listener semantics: "this" should be the current DOM node
            const currentHandler = domNode._aeuiHandlers[eventName];
            if (typeof currentHandler === "function") {
              currentHandler.call(domNode, event);
            }
          };
          domNode.addEventListener(eventName, proxyListener);
          domNode._aeuiProxyListeners[eventName] = proxyListener;
        }
      } else if (key === 'className') {
        domNode.className = newValue ?? '';
        this._didMutate = true;
      } else if (key === "style" && typeof newValue === "object" && newValue !== null) {
        domNode.style.cssText = '';
        Object.assign(domNode.style, newValue);
        this._didMutate = true;
      } else if (key === "style" && typeof newValue === "string") {
        domNode.style.cssText = newValue;
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
  },

  _unmount(instance) {
    if (instance) {
      instance.isMounted = false;
      instance.cleanups.forEach((cleanup) => {
        try { cleanup(); } catch (e) { console.error('[AEUI] Cleanup error:', e); }
      });
      instance.children.forEach(child => this._unmount(child));
      instance.watchStates = [];
      instance.cleanups = [];
    }
  },

  _reconcile(
    parentElement,
    newVNode,
    prevVNode,
    index = 0,
    parentInstance = null
  ) {
    // 1. Array / Fragment Handling
    if (Array.isArray(newVNode)) {
      const prevArr = Array.isArray(prevVNode) ? prevVNode : [];
      const maxLen = Math.max(newVNode.length, prevArr.length);
      for (let i = 0; i < maxLen; i++) {
        this._reconcile(
          parentElement,
          i < newVNode.length ? newVNode[i] : null,
          i < prevArr.length ? prevArr[i] : null,
          index + i,
          parentInstance
        );
      }
      return;
    }

    // 2. Remove
    if (newVNode == null) {
      if (prevVNode) {
        if (parentElement.childNodes[index]) {
          parentElement.removeChild(parentElement.childNodes[index]);
          this._didMutate = true;
        }
      }
      return;
    }

    // 3. Text Node
    if (typeof newVNode !== "object") {
      const domNode = parentElement.childNodes[index];
      if (domNode && domNode.nodeType === Node.TEXT_NODE) {
        if (domNode.nodeValue !== String(newVNode)) {
          domNode.nodeValue = String(newVNode);
          this._didMutate = true;
        }
      } else {
        const newDomNode = document.createTextNode(String(newVNode));
        if (domNode) {
          parentElement.replaceChild(newDomNode, domNode);
        } else {
          parentElement.appendChild(newDomNode);
        }
        this._didMutate = true;
      }
      return;
    }

    // 4. Component Node
    if (typeof newVNode.tag === "function") {
      let instance;

      if (parentInstance) {
        if (!parentInstance._childCursor) parentInstance._childCursor = 0;
        instance = parentInstance.children[parentInstance._childCursor];

        if (instance && instance.vnode.tag === newVNode.tag) {
          // Reuse existing instance
          parentInstance._childCursor++;
          instance.vnode = newVNode;
          instance.props = newVNode.props || {};
        } else {
          // Create new instance
          instance = this.createInstance(newVNode, parentInstance);
          if (parentInstance.children[parentInstance._childCursor]) {
            this._unmount(parentInstance.children[parentInstance._childCursor]);
            parentInstance.children[parentInstance._childCursor] = instance;
          } else {
            parentInstance.children.push(instance);
          }
          parentInstance._childCursor++;
        }
      } else {
        // Root Case
        if (this._rootInstance && this._rootInstance.vnode.tag === newVNode.tag) {
          instance = this._rootInstance;
          instance.vnode = newVNode;
          instance.props = newVNode.props || {};
        } else {
          if (this._rootInstance) this._unmount(this._rootInstance);
          instance = this.createInstance(newVNode, null);
          this._rootInstance = instance;
        }
      }

      instance.parentElement = parentElement;
      instance._childCursor = 0;

      let componentRenderedVNode;
      AEUI._currentInstance = instance;
      try {
        // Run watchers before render
        AEUI._runComponentWatchers(instance);

        // Note: _runComponentWatchers is called inside the component's render function
        // (injected by babel-plugin) to ensure prop updates are visible to watchers.
        componentRenderedVNode = instance.render(newVNode.props);
      } finally {
        AEUI._currentInstance = null;
      }

      this._reconcile(
        parentElement,
        componentRenderedVNode,
        instance.prevRenderedVNode,
        index,
        instance
      );

      instance.prevRenderedVNode = componentRenderedVNode;

      // Cleanup extra children
      if (instance._childCursor < instance.children.length) {
        const removed = instance.children.splice(instance._childCursor);
        removed.forEach(child => this._unmount(child));
      }

      return;
    }

    // 5. DOM Node
    const domNode = parentElement.childNodes[index];
    if (domNode && prevVNode && prevVNode.tag === newVNode.tag) {
      this._updateDomProps(domNode, newVNode.props, prevVNode.props);

      const newChildren = newVNode.children || [];
      const oldChildren = prevVNode.children || [];
      const maxLength = Math.max(newChildren.length, oldChildren.length);

      for (let i = 0; i < maxLength; i++) {
        this._reconcile(
          domNode,
          newChildren[i],
          oldChildren[i],
          i,
          parentInstance
        );
      }
    } else {
      const newDomNode = this._createDomNode(newVNode);
      if (newVNode.children) {
        newVNode.children.forEach((child, i) => {
          this._reconcile(newDomNode, child, null, i, parentInstance);
        });
      }

      if (domNode) {
        parentElement.replaceChild(newDomNode, domNode);
      } else {
        parentElement.appendChild(newDomNode);
      }
      this._didMutate = true;
    }
  },
};

AEUI.createElement = AEUI.createVNode;
AEUI.Fragment = (initialProps) => (props) => props.children;
