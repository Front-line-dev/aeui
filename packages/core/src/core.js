/**
 * AEUI Framework Core
 */
export const AEUI = {
  _rootInstance: null,
  _containerElement: null,
  _RootComponent: null,
  _currentInstance: null,
  _isRendering: false,

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

        this._childCursor = 0; // Fix: Reset cursor for reuse
        AEUI._currentInstance = this;
        // AEUI._runComponentWatchers(this); // Moved to component render
        const newVNode = this.render(this.props);
        AEUI._currentInstance = null;

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
    instance.render = vnode.tag(vnode.props);
    AEUI._currentInstance = null;

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
    return { tag, props: props || {}, children: children.flat().filter(c => c != null) };
  },

  init(RootComponent, containerElement) {
    this._RootComponent = RootComponent;
    this._containerElement = containerElement;

    // Initial Render
    this._tick();

    // Start Loop
    setInterval(() => {
      this._tick();
    }, 1000);
  },

  _tick() {
    if (this._isRendering) return;
    this._isRendering = true;

    if (this._rootInstance) {
      // Force root update for immediate mode behavior
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

    this._isRendering = false;
  },

  _runComponentWatchers(instance) {
    if (!instance.watchStates) return;
    instance.watchStates.forEach((watcher) => {
      const newDeps = watcher.getDeps();
      const hasChanged =
        !watcher.oldDeps ||
        newDeps.some((d, i) => d !== watcher.oldDeps[i]);

      if (hasChanged) {
        watcher.callback();
        watcher.oldDeps = newDeps;
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
      const newValue = props ? props[key] : undefined;
      const oldValue = oldProps ? oldProps[key] : undefined;

      if (newValue === oldValue) continue;

      if (key.startsWith("on") && typeof newValue === "function") {
        const eventName = key.substring(2).toLowerCase();
        if (oldValue) domNode.removeEventListener(eventName, oldValue);
        if (newValue) domNode.addEventListener(eventName, newValue);
      } else if (key === "style" && typeof newValue === "string") {
        domNode.style.cssText = newValue;
      } else if (newValue === undefined) {
        domNode.removeAttribute(key);
      } else {
        domNode.setAttribute(key, newValue);
      }
    }
  },

  _unmount(instance) {
    if (instance) {
      instance.cleanups.forEach((cleanup) => cleanup());
      instance.children.forEach(child => this._unmount(child));
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
      newVNode.forEach((child, i) => {
        this._reconcile(parentElement, child, prevVNode ? prevVNode[i] : null, index + i, parentInstance);
      });
      return;
    }

    // 2. Remove
    if (newVNode == null) {
      if (prevVNode) {
        if (parentElement.childNodes[index]) {
          parentElement.removeChild(parentElement.childNodes[index]);
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
        }
      } else {
        const newDomNode = document.createTextNode(String(newVNode));
        if (domNode) {
          parentElement.replaceChild(newDomNode, domNode);
        } else {
          parentElement.appendChild(newDomNode);
        }
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

      AEUI._currentInstance = instance;
      // AEUI._runComponentWatchers(instance); // Moved to component render
      const componentRenderedVNode = instance.render(newVNode.props);
      AEUI._currentInstance = null;

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
    }
  },
};

AEUI.createElement = AEUI.createVNode;
