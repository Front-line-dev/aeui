import { getRuntimeContext } from './runtime-context.js';
import { registerCleanup } from './hook-registry.js';

export function watch() {
  throw new Error('[AEUI] watch(callback, deps) must be compiled by the AEUI Babel plugin.');
}

export function clean(callback) {
  registerCleanup(getRuntimeContext(), callback);
}
