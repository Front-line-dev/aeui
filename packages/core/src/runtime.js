/**
 * Stateful runtime internals: hooks bridge, watcher execution,
 * instance lifecycle, DOM node counting, and scheduler loop.
 */

const MAX_FRAME_DELAY = 60;

let runtimeContext = null;

export function setRuntimeContext(context) {
  runtimeContext = context;
}

export function getRuntimeContext() {
  return runtimeContext;
}

export function _runComponentWatchers(instance) {
  if (!instance.watchStates) return;

  instance.watchStates.forEach((watcher) => {
    try {
      const newDeps = watcher.getDeps();
      const hasChanged =
        !watcher.oldDeps ||
        newDeps.some((dependency, index) => (
          !this._deepEqual(dependency, watcher.oldDeps[index])
        ));

      if (hasChanged) {
        watcher.callback();
        watcher.oldDeps = this._deepClone(newDeps);
      }
    } catch (e) {
      console.error('[AEUI] Watcher error:', e);
    }
  });
}

export function createInstance(vnode, parentInstance = null) {
  const AEUI = this;
  const instance = {
    vnode,
    render: null,
    prevRenderedVNode: null,
    watchStates: [],
    cleanups: [],
    props: vnode.props || {},
    parent: parentInstance,
    children: [],
    _domNodeCount: 0,
    parentElement: null,
    isMounted: true,

    update() {
      if (!this.isMounted) return;

      let startIndex = 0;
      if (this.parent) {
        const siblings = this.parent.children;
        const instanceIndex = siblings.indexOf(this);

        for (let i = 0; i < instanceIndex; i++) {
          startIndex += AEUI._getDomNodeCountForInstance(siblings[i]);
        }
      }

      this._childCursor = 0;

      let newVNode;
      AEUI._currentInstance = this;
      try {
        AEUI._runComponentWatchers(this);
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

      if (this._childCursor < this.children.length) {
        const removed = this.children.splice(this._childCursor);
        removed.forEach((child) => AEUI._unmount(child));
      }
    },
  };

  AEUI._currentInstance = instance;
  try {
    instance.render = vnode.tag(vnode.props);
  } finally {
    AEUI._currentInstance = null;
  }

  return instance;
}

export function _getDomNodeCountForInstance(instance) {
  if (!instance) return 0;
  return this._getDomNodeCount(instance.prevRenderedVNode, instance, { value: 0 });
}

export function _getDomNodeCount(vnode, ownerInstance = null, cursor = null) {
  if (vnode == null || typeof vnode === 'boolean') return 0;
  if (typeof vnode !== 'object') return 1;

  if (Array.isArray(vnode)) {
    return vnode.reduce((count, child) => (
      count + this._getDomNodeCount(child, ownerInstance, cursor)
    ), 0);
  }

  if (typeof vnode.tag === 'function') {
    if (!ownerInstance || !cursor) return 1;

    const childInstance = ownerInstance.children[cursor.value++];
    if (!childInstance) return 0;

    if (typeof childInstance._domNodeCount === 'number') {
      return childInstance._domNodeCount;
    }

    return this._getDomNodeCount(
      childInstance.prevRenderedVNode,
      childInstance,
      { value: 0 }
    );
  }

  const children = vnode.children || [];
  for (let i = 0; i < children.length; i++) {
    this._getDomNodeCount(children[i], ownerInstance, cursor);
  }

  return 1;
}

export function init(RootComponent, containerElement) {
  this._stopScheduler();
  if (this._rootInstance) {
    this._unmount(this._rootInstance);
  }

  this._RootComponent = RootComponent;
  this._containerElement = containerElement;
  this._rootInstance = null;
  this._previousVNode = null;
  containerElement.innerHTML = '';

  const didMutate = this._tick();
  this._frameDelay = didMutate ? 1 : 2;
  this._framesUntilNextTick = this._frameDelay - 1;

  this._startScheduler();
}

export function render() {
  if (!this._RootComponent || !this._containerElement) return false;

  const didMutate = this._tick();
  this._frameDelay = didMutate ? 1 : Math.min(this._frameDelay * 2, MAX_FRAME_DELAY);
  this._framesUntilNextTick = this._frameDelay - 1;
  this._startScheduler();
  return didMutate;
}

export function _stopScheduler() {
  if (this._rafId != null) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    } else {
      clearTimeout(this._rafId);
    }
  }

  this._rafId = null;
}

export function _startScheduler() {
  if (this._rafId != null) return;

  if (typeof requestAnimationFrame === 'function') {
    this._rafId = requestAnimationFrame(() => this._onAnimationFrame());
  } else {
    this._rafId = setTimeout(() => this._onAnimationFrame(), 16);
  }
}

export function _onAnimationFrame() {
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
}

export function _tick() {
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
}
