/**
 * Deep comparison & cloning utilities
 */

import { VNODE_MARKER } from './vnode-marker.js';

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

function isVNode(v) {
  return v !== null && typeof v === 'object' && v[VNODE_MARKER] === true;
}

function canDeepMatchSetValue(v) {
  return v !== null && typeof v === 'object' && !isVNode(v);
}

function primitiveSignature(value) {
  if (value === null) return 'null';

  const type = typeof value;
  if (type === 'number') {
    if (Number.isNaN(value)) return 'number:NaN';
    if (Object.is(value, -0)) return 'number:-0';
  }

  return `${type}:${String(value)}`;
}

function getValueShape(v) {
  if (v === null || typeof v !== 'object') return primitiveSignature(v);
  if (isVNode(v)) return 'vnode';
  if (Array.isArray(v)) return `array:${v.length}`;
  if (v instanceof Date) return `date:${primitiveSignature(v.getTime())}`;
  if (v instanceof RegExp) return `regexp:${v.source}/${v.flags}`;
  if (v instanceof Map) return `map:${v.size}`;
  if (v instanceof Set) return `set:${v.size}`;
  return `object:${Object.keys(v).sort().join('\u001f')}`;
}

function getOwnDataPropertyShape(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !descriptor.enumerable) return 'missing';
  if (!('value' in descriptor)) return 'accessor';
  return getValueShape(descriptor.value);
}

function getSetMatchSignature(value) {
  if (value === null || typeof value !== 'object') return primitiveSignature(value);
  if (isVNode(value)) return 'vnode';
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value instanceof Date) return `date:${primitiveSignature(value.getTime())}`;
  if (value instanceof RegExp) return `regexp:${value.source}/${value.flags}`;
  if (value instanceof Map) return `map:${value.size}`;
  if (value instanceof Set) return `set:${value.size}`;

  const keys = Object.keys(value).sort();
  return `object:${keys.map((key) => `${key}:${getOwnDataPropertyShape(value, key)}`).join('\u001e')}`;
}

function getCachedSetMatchSignature(cache, value) {
  if (!cache.has(value)) {
    cache.set(value, getSetMatchSignature(value));
  }
  return cache.get(value);
}

function mergeSeen(target, source) {
  if (source === target) return;

  for (const [key, val] of source) {
    target.set(key, val);
  }
}

export function _deepEqual(a, b, seen = new Map()) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

  // VNodes are render-time framework objects. Same reference is handled by Object.is above.
  if (isVNode(a) || isVNode(b)) return false;

  if (seen.has(a)) return seen.get(a) === b;
  seen.set(a, b);

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!_deepEqual(a[i], b[i], seen)) return false;
    }
    return true;
  }

  if (a instanceof Date) {
    return b instanceof Date && a.getTime() === b.getTime();
  }

  if (a instanceof RegExp) {
    return b instanceof RegExp && a.source === b.source && a.flags === b.flags;
  }

  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false;
    for (const [key, val] of a) {
      if (!b.has(key) || !_deepEqual(val, b.get(key), seen)) return false;
    }
    return true;
  }

  if (a instanceof Set) {
    if (!(b instanceof Set) || a.size !== b.size) return false;

    const remainingB = new Set(b);
    const signatureCache = new Map();
    let activeSeen = seen;
    let preferFirstCandidate = true;

    for (const valA of a) {
      if (remainingB.delete(valA)) continue;
      if (!canDeepMatchSetValue(valA)) return false;

      if (preferFirstCandidate) {
        const firstCandidate = remainingB.values().next();
        const trialSeen = new Map(activeSeen);
        if (!firstCandidate.done && _deepEqual(valA, firstCandidate.value, trialSeen)) {
          remainingB.delete(firstCandidate.value);
          activeSeen = trialSeen;
          continue;
        }
        preferFirstCandidate = false;
      }

      const signatureA = getCachedSetMatchSignature(signatureCache, valA);
      let matchedValue = null;
      let matchedSeen = null;

      for (const valB of remainingB) {
        if (signatureA !== getCachedSetMatchSignature(signatureCache, valB)) continue;

        const trialSeen = new Map(activeSeen);
        if (_deepEqual(valA, valB, trialSeen)) {
          matchedValue = valB;
          matchedSeen = trialSeen;
          break;
        }
      }

      if (!matchedSeen) return false;

      remainingB.delete(matchedValue);
      activeSeen = matchedSeen;
    }

    mergeSeen(seen, activeSeen);
    return remainingB.size === 0;
  }

  const keysA = Object.keys(a);

  if (keysA.length !== Object.keys(b).length) return false;

  for (const key of keysA) {
    if (!propertyIsEnumerable.call(b, key) || !_deepEqual(a[key], b[key], seen)) return false;
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
    cloned[k] = _deepClone(val, seen);
  }
  return cloned;
}
