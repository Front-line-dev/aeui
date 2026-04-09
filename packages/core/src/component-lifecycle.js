import { runComponentWatchers } from './component-watchers.js';
import { withComponentContext } from './runtime-context.js';
import { getVNodeKey } from './vnode-helpers.js';

function syncPropsTarget(propsTarget, nextProps) {
  if (!propsTarget || typeof propsTarget !== 'object') return;

  for (const key in propsTarget) {
    delete propsTarget[key];
  }

  if (nextProps) {
    Object.assign(propsTarget, nextProps);
  }
}

export function createComponentNode(vnode, parentNode = null, parentDom = null) {
  return {
    kind: 'component',
    key: getVNodeKey(vnode),
    vnode,
    component: vnode.tag,
    props: vnode.props || {},
    parent: parentNode,
    parentDom,
    children: [],
    firstDom: null,
    lastDom: null,
    isMounted: true,
    watchStates: [],
    cleanups: [],
    renderedNode: null,
    renderFactory: null,
    render: null,
  };
}

export function setupComponentNode(state, node) {
  if (node.renderFactory) return node.renderFactory;

  return withComponentContext(state, node, 'setup', () => {
    const renderFactory = node.component(node.props);
    node.renderFactory = renderFactory;
    node.render = renderFactory;
    return renderFactory;
  });
}

export function runComponentRenderPhase(
  state,
  node,
  nextProps,
  render = node.renderFactory || node.render,
  options = {}
) {
  const { propsTarget = null, runWatchers = true } = options;
  node.props = nextProps || {};
  syncPropsTarget(propsTarget, node.props);

  if (runWatchers) {
    runComponentWatchers(state, node);
  }

  if (typeof render !== 'function') {
    return null;
  }

  if (state.currentComponentNode === node && state.currentComponentPhase === 'render') {
    return render(node.props);
  }

  return withComponentContext(state, node, 'render', () => render(node.props));
}

export function invokeComponentRenderFactory(state, node, nextProps) {
  node.props = nextProps || {};

  if (typeof (node.renderFactory || node.render) !== 'function') {
    return null;
  }

  return withComponentContext(state, node, 'render', () => (
    (node.renderFactory || node.render)(node.props)
  ));
}

export function renderComponentNode(state, parentDom, node, nextProps, beforeDom) {
  node.props = nextProps || {};
  setupComponentNode(state, node);

  const renderedVNode = invokeComponentRenderFactory(state, node, node.props);
  const renderedNode = state.reconcile(
    parentDom,
    node.renderedNode,
    renderedVNode,
    beforeDom,
    node
  );

  commitRenderedNode(node, renderedNode);
  return node;
}

export function commitRenderedNode(node, renderedNode) {
  node.renderedNode = renderedNode;
  node.children = renderedNode ? [renderedNode] : [];
  node.firstDom = renderedNode ? renderedNode.firstDom : null;
  node.lastDom = renderedNode ? renderedNode.lastDom : null;
}

export function cleanupComponentNode(state, node, options = {}) {
  const { preserveChildren = false, preserveDomRange = false } = options;

  node.cleanups.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      console.error('[AEUI] Cleanup error:', error);
    }
  });

  node.watchStates = [];
  node.cleanups = [];
  node.renderedNode = null;
  node.renderFactory = null;
  node.render = null;

  if (!preserveChildren) {
    node.children = [];
  }

  if (!preserveDomRange) {
    node.firstDom = null;
    node.lastDom = null;
  }
}
