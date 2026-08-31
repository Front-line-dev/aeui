/**
 * Deep comparison & cloning utilities
 */

import { VNODE_MARKER } from './vnode-marker.js';

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

function isVNode(v) {
  return v !== null && typeof v === 'object' && v[VNODE_MARKER] === true;
}

function createPairs() {
  return {
    forward: new Map(),
    reverse: new Map(),
  };
}

function clonePairs(pairs) {
  return {
    forward: new Map(pairs.forward),
    reverse: new Map(pairs.reverse),
  };
}

function replacePairs(target, source) {
  target.forward.clear();
  target.reverse.clear();

  for (const [valueA, valueB] of source.forward) {
    target.forward.set(valueA, valueB);
  }

  for (const [valueB, valueA] of source.reverse) {
    target.reverse.set(valueB, valueA);
  }
}

function classify(value) {
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof RegExp) return 'regexp';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  return 'object';
}

function compareSet(a, b, pairs) {
  if (a.size !== b.size) return false;

  const remainingB = new Set(b);
  let activePairs = clonePairs(pairs);

  for (const valueA of a) {
    let match = null;

    for (const valueB of remainingB) {
      const trialPairs = clonePairs(activePairs);

      if (_deepEqual(valueA, valueB, trialPairs)) {
        match = { valueB, pairs: trialPairs };
        break;
      }
    }

    if (match === null) return false;

    remainingB.delete(match.valueB);
    activePairs = match.pairs;
  }

  replacePairs(pairs, activePairs);
  return remainingB.size === 0;
}

export function _deepEqual(a, b, pairs = createPairs()) {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return Object.is(a, b);
  }

  if (pairs.forward.has(a)) {
    return pairs.forward.get(a) === b && pairs.reverse.get(b) === a;
  }

  if (pairs.reverse.has(b)) return false;

  pairs.forward.set(a, b);
  pairs.reverse.set(b, a);

  if (Object.is(a, b)) return true;

  // VNodes are render-time framework objects. Same reference is handled above.
  if (isVNode(a) || isVNode(b)) return false;

  const typeA = classify(a);
  const typeB = classify(b);
  if (typeA !== typeB) return false;

  if (typeA === 'array') {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!_deepEqual(a[i], b[i], pairs)) return false;
    }
    return true;
  }

  if (typeA === 'date') {
    return a.getTime() === b.getTime();
  }

  if (typeA === 'regexp') {
    return a.source === b.source && a.flags === b.flags;
  }

  if (typeA === 'map') {
    if (a.size !== b.size) return false;
    for (const [key, val] of a) {
      if (!b.has(key) || !_deepEqual(val, b.get(key), pairs)) return false;
    }
    return true;
  }

  if (typeA === 'set') {
    return compareSet(a, b, pairs);
  }

  const keysA = Object.keys(a);

  if (keysA.length !== Object.keys(b).length) return false;

  for (const key of keysA) {
    if (!propertyIsEnumerable.call(b, key) || !_deepEqual(a[key], b[key], pairs)) return false;
  }

  return true;
}

export function _deepClone(v, seen = new WeakMap()) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof RegExp) return new RegExp(v.source, v.flags);

  // VNode 보호 로직: VNode는 깊은 복제 대상에서 제외합니다. (메모리 폭증 오류 방지)
  // VNode는 매 렌더링마다 새로 생성되는 일시적인 객체이므로 참조를 유지해도 안전합니다.
  if (isVNode(v)) return v;

  if (seen.has(v)) return seen.get(v);

  if (Array.isArray(v)) {
    const cloned = [];
    seen.set(v, cloned);
    for (let i = 0; i < v.length; i++) {
      cloned.push(_deepClone(v[i], seen));
    }
    return cloned;
  }

  if (v instanceof Map) {
    const cloned = new Map();
    seen.set(v, cloned);
    v.forEach((val, k) => cloned.set(k, _deepClone(val, seen)));
    return cloned;
  }

  if (v instanceof Set) {
    const cloned = new Set();
    seen.set(v, cloned);
    v.forEach(item => cloned.add(_deepClone(item, seen)));
    return cloned;
  }

  const cloned = {};
  seen.set(v, cloned);
  for (const [k, val] of Object.entries(v)) {
    Object.defineProperty(cloned, k, {
      value: _deepClone(val, seen),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return cloned;
}
