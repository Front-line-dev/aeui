/**
 * DOM operations, reconciliation, and unmounting
 */

export function _createDomNode(vnode) {
    if (typeof vnode !== "object") {
        return document.createTextNode(String(vnode));
    }

    if (typeof vnode.tag !== "string") {
        console.error("_createDomNode: Invalid Tag", vnode.tag, typeof vnode.tag);
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
}

export function _unmount(instance) {
    if (instance) {
        instance.isMounted = false;
        instance._domNodeCount = 0;
        instance.cleanups.forEach((cleanup) => {
            try { cleanup(); } catch (e) { console.error('[AEUI] Cleanup error:', e); }
        });
        instance.children.forEach(child => this._unmount(child));
        instance.watchStates = [];
        instance.cleanups = [];
    }
}

export function _countComponentNodes(vnode) {
    if (vnode == null || typeof vnode !== 'object') return 0;

    if (Array.isArray(vnode)) {
        return vnode.reduce((count, child) => count + this._countComponentNodes(child), 0);
    }

    // parentInstance.children 에는 해당 위치의 컴포넌트 "루트" 인스턴스만 저장된다.
    if (typeof vnode.tag === 'function') return 1;

    const children = vnode.children || [];
    return children.reduce((count, child) => count + this._countComponentNodes(child), 0);
}

export function _removeComponentInstances(parentInstance, start, count) {
    if (!parentInstance || count <= 0) return;
    if (start >= parentInstance.children.length) return;

    const removed = parentInstance.children.splice(start, count);
    removed.forEach(child => this._unmount(child));
}

/**
 * DOM 타입 교체 전에 old/new 컴포넌트 개수 차이를 맞춰
 * 뒤 형제 인스턴스가 잘못 소비되지 않도록 정렬한다.
 */
export function _alignComponentInstances(prevVNode, newVNode, parentInstance) {
    if (!parentInstance) return;

    const prevCount = this._countComponentNodes(prevVNode);
    const nextCount = this._countComponentNodes(newVNode);
    if (prevCount === nextCount) return;

    const cursor = typeof parentInstance._childCursor === 'number'
        ? parentInstance._childCursor
        : 0;

    if (prevCount > nextCount) {
        this._removeComponentInstances(
            parentInstance,
            cursor + nextCount,
            prevCount - nextCount
        );
        return;
    }

    const insertCount = nextCount - prevCount;
    const placeholders = new Array(insertCount).fill(null);
    parentInstance.children.splice(cursor + prevCount, 0, ...placeholders);
}

/**
 * prevVNode 서브트리에 대응하는 component instance들을 parent cursor 기준으로 unmount한다.
 */
export function _unmountVNode(vnode, parentInstance) {
    if (!parentInstance) return;

    const removeCount = this._countComponentNodes(vnode);
    if (removeCount <= 0) return;

    const start = typeof parentInstance._childCursor === 'number'
        ? parentInstance._childCursor
        : 0;

    this._removeComponentInstances(parentInstance, start, removeCount);
}

export function _reconcile(
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
        let currentIndex = index;
        const childCursor = parentInstance ? { value: parentInstance._childCursor || 0 } : null;

        for (let i = 0; i < maxLen; i++) {
            const nextChild = i < newVNode.length ? newVNode[i] : null;
            const prevChild = i < prevArr.length ? prevArr[i] : null;

            this._reconcile(
                parentElement,
                nextChild,
                prevChild,
                currentIndex,
                parentInstance
            );

            currentIndex += this._getDomNodeCount(nextChild, parentInstance, childCursor);
        }
        return;
    }

    // 2. Remove
    if (newVNode == null) {
        if (prevVNode) {
            // 이전 VNode에 컴포넌트 인스턴스가 있으면 unmount (cleanup 실행)
            this._unmountVNode(prevVNode, parentInstance);

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
        const AEUI = this;

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
                const slotIndex = parentInstance._childCursor;
                instance = this.createInstance(newVNode, parentInstance);
                if (slotIndex < parentInstance.children.length) {
                    const existing = parentInstance.children[slotIndex];
                    if (existing) this._unmount(existing);
                    parentInstance.children[slotIndex] = instance;
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

        instance._domNodeCount = this._getDomNodeCount(
            componentRenderedVNode,
            instance,
            { value: 0 }
        );

        return;
    }

    // 5. DOM Node
    const domNode = parentElement.childNodes[index];
    if (domNode && prevVNode && prevVNode.tag === newVNode.tag) {
        this._updateDomProps(domNode, newVNode.props, prevVNode.props);

        const newChildren = newVNode.children || [];
        const oldChildren = prevVNode.children || [];
        const maxLength = Math.max(newChildren.length, oldChildren.length);
        let childIndex = 0;
        const childCursor = parentInstance ? { value: parentInstance._childCursor || 0 } : null;

        for (let i = 0; i < maxLength; i++) {
            const newChild = newChildren[i];
            const oldChild = oldChildren[i];

            this._reconcile(
                domNode,
                newChild,
                oldChild,
                childIndex,
                parentInstance
            );

            childIndex += this._getDomNodeCount(newChild, parentInstance, childCursor);
        }
    } else {
        // DOM 타입 교체 전에 old/new 컴포넌트 개수 차이를 먼저 정렬한다.
        if (prevVNode) this._alignComponentInstances(prevVNode, newVNode, parentInstance);

        const newDomNode = this._createDomNode(newVNode);
        if (newVNode.children) {
            let childIndex = 0;
            const childCursor = parentInstance ? { value: parentInstance._childCursor || 0 } : null;

            newVNode.children.forEach((child) => {
                this._reconcile(newDomNode, child, null, childIndex, parentInstance);
                childIndex += this._getDomNodeCount(child, parentInstance, childCursor);
            });
        }

        if (domNode) {
            parentElement.replaceChild(newDomNode, domNode);
        } else {
            parentElement.appendChild(newDomNode);
        }
        this._didMutate = true;
    }
}
