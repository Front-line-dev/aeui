/**
 * Stateful runtime internals: hooks bridge, node creation,
 * watcher execution, root reconciliation, and scheduler loop.
 */

const MAX_FRAME_DELAY = 60;

let runtimeContext = null;

function getVNodeKey(vnode) {
  if (vnode == null || typeof vnode !== 'object' || Array.isArray(vnode)) return null;
  const key = vnode.props ? vnode.props.key : undefined;
  return key == null ? null : key;
}

function isFragmentVNode(AEUI, vnode) {
  return Array.isArray(vnode) || (vnode && typeof vnode === 'object' && vnode.tag === AEUI.Fragment);
}

export function setRuntimeContext(context) {
  runtimeContext = context;
}

export function getRuntimeContext() {
  return runtimeContext;
}

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

export function _runComponentWatchers(node) {
  if (!node || !node.watchStates) return;

  node.watchStates.forEach((watcher) => {
    try {
      const newDeps = watcher.getDeps();
      const hasChanged =
        !watcher.oldDeps ||
        !this._deepEqual(newDeps, watcher.oldDeps);

      if (hasChanged) {
        watcher.callback();
        const finalDeps = watcher.getDeps();
        watcher.oldDeps = this._deepClone(finalDeps);
      }
    } catch (e) {
      console.error('[AEUI] Watcher error:', e);
    }
  });
}

export function createNode(vnode, parentNode = null, parentDom = null) {
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

  if (isFragmentVNode(this, vnode)) {
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

  node.kind = 'component';
  node.component = vnode.tag;
  node.props = vnode.props || {};
  node.watchStates = [];
  node.cleanups = [];
  node.renderedNode = null;
  node.render = null;

  this._currentComponentNode = node;
  this._currentInstance = node;
  try {
    node.render = vnode.tag(vnode.props);
  } finally {
    this._currentComponentNode = null;
    this._currentInstance = null;
  }

  return node;
}

export function _reconcileRoot() {
  if (!this._rootNode || !this._containerElement || !this._RootComponent) return;

  const rootVNode = this.createVNode(this._RootComponent);
  const previousRootChild = this._rootNode.children[0] || null;
  const nextRootChild = this._reconcile(
    this._containerElement,
    previousRootChild,
    rootVNode,
    null,
    this._rootNode
  );

  this._rootNode.children = nextRootChild ? [nextRootChild] : [];
  this._rootNode.firstDom = nextRootChild ? nextRootChild.firstDom : null;
  this._rootNode.lastDom = nextRootChild ? nextRootChild.lastDom : null;
}

export function init(RootComponent, containerElement) {
  this._stopScheduler();
  if (this._rootNode && this._rootNode.children[0]) {
    this._unmountNode(this._rootNode.children[0]);
  }

  this._RootComponent = RootComponent;
  this._containerElement = containerElement;
  this._rootNode = createRootNode(containerElement);
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
  if (!this._RootComponent || !this._containerElement || !this._rootNode) return false;
  if (this._isRendering) return false;

  this._isRendering = true;
  this._didMutate = false;

  try {
    this._reconcileRoot();
  } catch (e) {
    console.error('[AEUI] Render error:', e);
  } finally {
    this._isRendering = false;
  }

  return this._didMutate;
}
