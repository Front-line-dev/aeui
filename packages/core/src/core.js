/**
 * AEUI Framework Core
 */
export const AEUI = {
  // _componentInstanceMap: new Map(), // REMOVED
  _rootInstance: null, // NEW: Track root instance
  _containerElement: null,
  _RootComponent: null,
  _currentInstance: null, // Context for hooks (watching)
  _isRendering: false,

  createInstance(vnode, parentInstance = null) {
    const instance = {
      vnode: vnode,
      render: null,
      prevRenderedVNode: null,
      watchStates: [],
      cleanups: [],
      props: vnode.props || {},
      parent: parentInstance, // Parent Component Instance
      children: [], // Child Component Instances
      parentElement: null, // Assigned during reconcile (stable)
      isMounted: true,
      
      // Method to trigger local update
      update() {
        if (!this.isMounted) return;
        
        // Context: "this" is the instance
        // 1. Calculate Index (position among siblings)
        let startIndex = 0;
        if (this.parent) {
          // Look at parent's rendered content (prevRenderedVNode) to find self
          // This requires parent.prevRenderedVNode to be the structure containing us.
          // Note: Logic simplification needed. 
          // If we are in parent.children, we can determine DOM index by summing nodes of previous siblings.
          
          // Simplified: We assume we can pass the correct context or derive it.
          // For this implementation, we will try to find "where we are" relative to parentElement.
          // A safer bet without full VDOM parent pointer is hard.
          // However, the Plan says: "Using this.parent... Find this.vnode... Sum nodes"
          
          const siblings = this.parent.children; // These are Instances. VDOM siblings are in parent.prevRenderedVNode.
          // Use instances order? instances order matches appearance order usually.
          const instanceIndex = siblings.indexOf(this);
          
          // We need DOM nodes count of previous instances?
          // This is getting complex. 
          // FALLBACK: For V1 Tree Optimization, let's rely on finding the DOM container.
          // But `parentElement` is usually shared.
          
          // Let's implement the recursive search from parent's rendered VNode if possible
          // OR: Just rely on `this.parentElement` and let `_reconcile` append/replace?
          // `_reconcile` needs index. 
          
          // CRITICAL: We need the index.
          // Let's iterate parent.children instances up to us.
          // For each sibling instance < us, count their DOM nodes.
          // How to count DOM nodes of an instance? 
          // An instance might render a Fragment or Array.
          // We need a helper `getDomNodeCount(instance)`.
          
          for (let i = 0; i < instanceIndex; i++) {
             startIndex += AEUI._getDomNodeCount(siblings[i].prevRenderedVNode);
          }
        }
        
        // 2. Render & Reconcile
        AEUI._currentInstance = this;
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

    // Setup runs once
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
          // It's a component VNode, we need its *Rendered* VNode.
          // But we don't have the instance link here on the VNode trivially unless we store it.
          // Wait, `createVNode` doesn't link instance.
          // Only `reconcile` links instance.
          // WE NEED TO LINK VNODE <-> INSTANCE or store RenderedVNode on the ComponentVNode?
          // Actually, `instance.prevRenderedVNode` is what we need. 
          // But traversing VNode tree...
          // If we look at `parentInstance.children`, we have instances.
          return 1; // Assuming single root for now to survive? 
          // Correct implementation: The instance should track its DOM nodes count or we recurse instance children.
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

    // Start Loop (1s)
    setInterval(() => {
      this._tick();
    }, 1000);
  },

  _tick() {
    if (this._isRendering) return;
    this._isRendering = true;

    // 1. Run Watchers (Recursive Check)
    if (this._rootInstance) {
        this._runWatchers(this._rootInstance);
    } else {
        // First mount
        const newVNode = this.createVNode(this._RootComponent);
        this._reconcile(
          this._containerElement,
          newVNode,
          this._previousVNode || null,
          0,
          null // No parent instance for Root
        );
        this._previousVNode = newVNode;
    }

    this._isRendering = false;
  },
  
  _runWatchers(instance) {
      // Check self
      instance.watchStates.forEach((watcher) => {
        const newDeps = watcher.getDeps();
        const hasChanged =
          !watcher.oldDeps ||
          newDeps.some((d, i) => d !== watcher.oldDeps[i]);

        if (hasChanged) {
          watcher.callback();
          watcher.oldDeps = newDeps;
          // Trigger update on change
          instance.update();
        }
      });
      
      // Recurse children
      instance.children.forEach(child => this._runWatchers(child));
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
      // Recurse
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
            // Need to track accumulated index for siblings?
            // Simple approach: each child gets index relative to parentElement
            // But if siblings are DOM nodes, index increments.
            // For now, assuming standard flow.
            this._reconcile(parentElement, child, prevVNode ? prevVNode[i] : null, index + i, parentInstance);
        });
        return;
    }

    // 2. Remove
    if (newVNode == null) {
      if (prevVNode) {
          // If prevVNode was associated with a component instance, unmount it.
          // But VNode doesn't have instance link directly.
          // relies on parentInstance.children.
          // Limitation: We need to know IF this VNode corresponds to a child Instance.
          // Simplification: Not handling complex removal in this step without VNode->Instance map or Key.
          
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
      // Find existing instance in parentInstance.children
      // Heuristic: matching tag and order (index in children array).
      // We need a cursor for children reconciliation?
      // parentInstance.children is a LIST of active instances.
      
      let instance;
      // We need to know WHICH child index this is conceptualy for the parent.
      // But _reconcile is called recursively.
      // We will try to find a child instance that matches this VNode.
      // PROVISIONAL: We assume order is preserved (no keys yet).
      // We need a way to track "current child cursor" in parentInstance.
      
      if (parentInstance) {
          if (!parentInstance._childCursor) parentInstance._childCursor = 0;
          instance = parentInstance.children[parentInstance._childCursor];
          
          // Check match
          if (instance && instance.vnode.tag === newVNode.tag) {
             // Reuse
             parentInstance._childCursor++;
             instance.vnode = newVNode; // Update vnode
             instance.props = newVNode.props || {};
          } else {
             // Mismatch or New
             instance = this.createInstance(newVNode, parentInstance);
             if (parentInstance.children[parentInstance._childCursor]) {
                 // Replace existing at this cursor
                 this._unmount(parentInstance.children[parentInstance._childCursor]);
                 parentInstance.children[parentInstance._childCursor] = instance;
             } else {
                 // Push new
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
      
      // Link & Render
      instance.parentElement = parentElement;
      
      // Reset cursor for this instance's children before rendering
      instance._childCursor = 0;
      
      AEUI._currentInstance = instance;
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
      
      // Cleanup extra children if list shrank?
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
           parentInstance // Pass through
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
