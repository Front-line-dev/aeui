import { getRuntimeContext } from './runtime-context.js';
import { registerCleanup, registerWatch } from './hook-registry.js';

export function watch(firstArg, secondArg) {
  registerWatch(getRuntimeContext(), firstArg, secondArg);
}

export function clean(callback) {
  registerCleanup(getRuntimeContext(), callback);
}
