import { _runComponentWatchers } from './runtime.js';
import { getVNodeKey } from './vnode-helpers.js';

function withCurrentComponent(state, node, callback) {
  state.currentComponentNode = node;
  state.currentInstance = node;

  try {
    return callback();
  } finally {
    state.currentComponentNode = null;
    state.currentInstance = null;
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

  return withCurrentComponent(state, node, () => {
    const renderFactory = node.component(node.props);
    node.renderFactory = renderFactory;
    node.render = renderFactory;
    return renderFactory;
  });
}

export function runComponentRenderPhase(state, node, nextProps, render = node.renderFactory || node.render) {
  node.props = nextProps || {};
  _runComponentWatchers(state, node);

  if (typeof render !== 'function') {
    return null;
  }

  return withCurrentComponent(state, node, () => render(node.props));
}

export function commitRenderedNode(node, renderedNode) {
  node.renderedNode = renderedNode;
  node.children = renderedNode ? [renderedNode] : [];
  node.firstDom = renderedNode ? renderedNode.firstDom : null;
  node.lastDom = renderedNode ? renderedNode.lastDom : null;
}

export function cleanupComponentNode(state, node) {
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
  node.children = [];
  node.firstDom = null;
  node.lastDom = null;
}
