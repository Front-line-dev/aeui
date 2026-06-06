function getSetupComponentNode(runtime) {
  const node = runtime.currentComponentNode;
  if (!node) return null;
  if (runtime.currentComponentPhase !== 'setup') return null;
  return node;
}

function readDeps(deps) {
  const value = typeof deps === 'function' ? deps() : deps;
  if (!Array.isArray(value)) {
    throw new TypeError('[AEUI] watch(callback, deps) requires deps to be an array or a function that returns an array.');
  }
  return value;
}

export function registerWatch(runtime, callback, deps) {
  if (!runtime) return;

  const node = getSetupComponentNode(runtime);
  if (!node) return;

  if (typeof callback !== 'function') {
    throw new TypeError('[AEUI] watch(callback, deps) requires callback to be a function.');
  }

  if (deps === undefined) {
    throw new TypeError('[AEUI] watch(callback, deps) requires deps.');
  }

  const getDeps = () => readDeps(deps);

  node.watchStates.push({
    callback,
    getDeps,
    oldDeps: runtime.deepClone(getDeps()),
  });
}

export function registerCleanup(runtime, callback) {
  if (!runtime) return;

  const node = getSetupComponentNode(runtime);
  if (!node) return;
  node.cleanups.push(callback);
}
