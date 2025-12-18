import { AEUI } from "./core.js";

export function watch(callback, depsGetter) {
  const instance = AEUI._currentInstance;
  if (instance) {
    const initialDeps =
      typeof depsGetter === "function" ? depsGetter() : depsGetter;
    instance.watchStates.push({
      callback,
      getDeps:
        typeof depsGetter === "function" ? depsGetter : () => depsGetter,
      oldDeps: AEUI._deepClone(initialDeps),
    });
  }
}

export function clean(callback) {
  const instance = AEUI._currentInstance;
  if (!instance) return;
  instance.cleanups.push(callback);
}
