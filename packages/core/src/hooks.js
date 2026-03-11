import { getRuntimeContext } from "./runtime.js";

function normalizeWatchArgs(firstArg, secondArg) {
  if (typeof firstArg === "function" && typeof secondArg !== "function") {
    return { callback: firstArg, depsGetter: secondArg };
  }

  if (typeof firstArg !== "function" && typeof secondArg === "function") {
    return { depsGetter: firstArg, callback: secondArg };
  }

  if (typeof firstArg === "function" && typeof secondArg === "function") {
    return { depsGetter: firstArg, callback: secondArg };
  }

  return { depsGetter: firstArg, callback: secondArg };
}

function normalizeDepsValue(depsValue) {
  if (Array.isArray(depsValue)) return depsValue;
  if (depsValue == null) return [];
  return [depsValue];
}

export function watch(firstArg, secondArg) {
  const runtime = getRuntimeContext();
  if (!runtime) return;

  const { depsGetter, callback } = normalizeWatchArgs(firstArg, secondArg);
  if (typeof callback !== "function") return;

  const getDeps = () => normalizeDepsValue(
    typeof depsGetter === "function" ? depsGetter() : depsGetter
  );

  const node = runtime.getCurrentComponentNode();
  if (node) {
    node.watchStates.push({
      callback,
      getDeps,
      oldDeps: runtime.deepClone(getDeps()),
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
