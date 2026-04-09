function normalizeWatchArgs(firstArg, secondArg) {
  if (typeof firstArg === 'function' && typeof secondArg !== 'function') {
    return { callback: firstArg, depsGetter: secondArg };
  }

  if (typeof firstArg !== 'function' && typeof secondArg === 'function') {
    return { depsGetter: firstArg, callback: secondArg };
  }

  if (typeof firstArg === 'function' && typeof secondArg === 'function') {
    return { depsGetter: firstArg, callback: secondArg };
  }

  return { depsGetter: firstArg, callback: secondArg };
}

function normalizeDepsValue(depsValue) {
  if (Array.isArray(depsValue)) return depsValue;
  if (depsValue == null) return [];
  return [depsValue];
}

function getSetupComponentNode(runtime) {
  const node = runtime.currentComponentNode;
  if (!node) return null;
  if (runtime.currentComponentPhase !== 'setup') return null;
  return node;
}

export function registerWatch(runtime, firstArg, secondArg) {
  if (!runtime) return;

  const { depsGetter, callback } = normalizeWatchArgs(firstArg, secondArg);
  if (typeof callback !== 'function') return;

  const getDeps = () => normalizeDepsValue(
    typeof depsGetter === 'function' ? depsGetter() : depsGetter
  );

  const node = getSetupComponentNode(runtime);
  if (!node) return;

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
