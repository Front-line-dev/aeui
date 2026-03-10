import { getRuntimeContext } from "./runtime.js";

export function watch(callback, depsGetter) {
  const runtime = getRuntimeContext();
  if (!runtime) return;

  const node = runtime.getCurrentComponentNode();
  if (node) {
    const initialDeps =
      typeof depsGetter === "function" ? depsGetter() : depsGetter;
    node.watchStates.push({
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

  const node = runtime.getCurrentComponentNode();
  if (!node) return;
  node.cleanups.push(callback);
}
