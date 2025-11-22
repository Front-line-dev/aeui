/**
 * AEUI Framework Core
 */
export const AEUI = {
  _componentInstanceMap: new Map(),
  _containerElement: null,
  _RootComponent: null,
  _currentInstance: null,
  _isRendering: false,
  _previousVNode: null,

  createInstance(instanceKey, newVNode) {
    const instance = {
      vnode: newVNode,
      render: null,
      prevRenderedVNode: null,
      watchStates: [],
      cleanups: [],
      props: newVNode.props || {}, 
    };

    this._currentInstance = instance;
    // Setup runs once
    // Pass initial props to Setup
    instance.render = newVNode.tag(newVNode.props);
    this._currentInstance = null;

    return instance;
  },

  createVNode(tag, props, ...children) {
    // console.log("createVNode", tag, typeof tag);
    return { tag, props: props || {}, children: children.flat().filter(c => c != null) };
  },

  init(RootComponent, containerElement) {
    this._RootComponent = RootComponent;
    this._containerElement = containerElement;

    // Initial Render
    this._tick();

    // Start Loop (1s)
    setInterval(() => {
      this._tick();
    }, 1000);
  },

  _tick() {
    if (this._isRendering) return;
    this._isRendering = true;

    // 1. Run Watchers
    this._componentInstanceMap.forEach((instance) => {
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
    });

    // 2. Reconcile
    const newVNode = this.createVNode(this._RootComponent);
    this._reconcile(
      this._containerElement,
      newVNode,
      this._previousVNode
    );
    this._previousVNode = newVNode;

    this._isRendering = false;
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

    // FIXED: Do not recursively create children here.
    // Let _reconcile handle them to support Components.

    return domNode;
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

  _unmount(instanceKey) {
    const instance = this._componentInstanceMap.get(instanceKey);
    if (instance) {
      instance.cleanups.forEach((cleanup) => cleanup());
      this._componentInstanceMap.delete(instanceKey);
    }
  },

  _reconcile(
    parentElement,
    newVNode,
    prevVNode,
    index = 0,
    instanceKey = "root"
  ) {
    // Debug Log
    // console.log("_reconcile", { tag: newVNode?.tag, type: typeof newVNode?.tag });

    // 1. Remove
    if (newVNode == null) {
      if (prevVNode) {
        this._unmount(instanceKey);
        if (parentElement.childNodes[index]) {
          parentElement.removeChild(parentElement.childNodes[index]);
        }
      }
      return;
    }

    // 2. Text Node (Primitive)
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

    // 3. Component Node
    if (typeof newVNode.tag === "function") {
      let instance = this._componentInstanceMap.get(instanceKey);

      if (!instance) {
        instance = this.createInstance(instanceKey, newVNode);
        this._componentInstanceMap.set(instanceKey, instance);
      }

      // Render component
      this._currentInstance = instance;
      
      // PASS PROPS TO RENDER FUNCTION
      const componentRenderedVNode = instance.render(newVNode.props);
      
      this._currentInstance = null;

      this._reconcile(
        parentElement,
        componentRenderedVNode,
        instance.prevRenderedVNode,
        index,
        instanceKey
      );

      instance.prevRenderedVNode = componentRenderedVNode;
      return;
    }

    // 4. DOM Node
    // Debug if tag is weird
    if (typeof newVNode.tag !== "string") {
       console.error("Invalid Tag for DOM Node:", newVNode.tag, typeof newVNode.tag);
    }

    const domNode = parentElement.childNodes[index];
    const prevRenderedVNode = prevVNode;

    if (
      domNode &&
      prevRenderedVNode &&
      prevRenderedVNode.tag === newVNode.tag
    ) {
      this._updateDomProps(domNode, newVNode.props, prevRenderedVNode.props);
      const newChildren = newVNode.children;
      const oldChildren = prevRenderedVNode.children || [];
      const maxLength = Math.max(newChildren.length, oldChildren.length);

      for (let i = 0; i < maxLength; i++) {
        this._reconcile(
          domNode,
          newChildren[i],
          oldChildren[i],
          i,
          `${instanceKey}.${i}`
        );
      }
    } else {
      const newDomNode = this._createDomNode(newVNode);
      if (
        typeof newVNode === "object" &&
        newVNode !== null &&
        newVNode.children
      ) {
        newVNode.children.forEach((child, i) => {
          this._reconcile(newDomNode, child, null, i, `${instanceKey}.${i}`);
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
