import { runComponentWatchers } from './component-watchers.js';
import { runComponentRenderPhase } from './component-lifecycle.js';

export function runComponentWatchersBridge(state, node) {
  runComponentWatchers(state, node);
}

export function runRenderPhaseBridge(state, nextProps, propsTarget, render) {
  const node = state.currentComponentNode;
  if (!node) {
    return typeof render === 'function' ? render(nextProps || {}) : null;
  }

  return runComponentRenderPhase(state, node, nextProps, render, {
    propsTarget,
    runWatchers: true,
  });
}
