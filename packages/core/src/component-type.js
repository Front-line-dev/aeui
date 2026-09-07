// Shared by every app in this runtime module; function properties are never read.
const componentSetups = new WeakMap();

export function registerComponent(type, setup) {
  if (typeof type !== 'function' || typeof setup !== 'function') {
    throw new TypeError('[AEUI] Component type and setup must be functions.');
  }
  const previous = componentSetups.get(type);
  if (previous && previous !== setup) {
    throw new TypeError('[AEUI] Conflicting component setup registration.');
  }
  componentSetups.set(type, setup);
  return type;
}

export function resolveComponentSetup(type) {
  assertElementType(type);
  return componentSetups.get(type) || type;
}

export function assertElementType(type) {
  if (typeof type !== 'string' && typeof type !== 'function') {
    throw new TypeError('[AEUI] Invalid element type: expected a host string or component function.');
  }
}
