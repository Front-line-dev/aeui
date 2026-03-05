import { getRuntimeContext } from "./runtime.js";

export function watch(callback, depsGetter) {
  const runtime = getRuntimeContext();
  if (!runtime) return;

  const instance = runtime.getCurrentInstance();
  if (instance) {
    const initialDeps =
      typeof depsGetter === "function" ? depsGetter() : depsGetter;
    instance.watchStates.push({
      callback,
      getDeps:
        typeof depsGetter === "function" ? depsGetter : () => depsGetter,
      oldDeps: runtime.deepClone(initialDeps),
    });
  }
}

export function clean(callback) {
  const runtime = getRuntimeContext();
  if (!runtime) return;

  const instance = runtime.getCurrentInstance();
  if (!instance) return;
  instance.cleanups.push(callback);
}
