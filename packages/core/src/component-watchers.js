export function runComponentWatchers(state, node) {
  if (!node || !node.watchStates) return;

  node.watchStates.forEach((watcher) => {
    try {
      const newDeps = watcher.getDeps();
      const hasChanged =
        !watcher.oldDeps ||
        !state.deepEqual(newDeps, watcher.oldDeps);

      if (hasChanged) {
        watcher.callback();
        const finalDeps = watcher.getDeps();
        watcher.oldDeps = state.deepClone(finalDeps);
      }
    } catch (error) {
      console.error('[AEUI] Watcher error:', error);
    }
  });
}
