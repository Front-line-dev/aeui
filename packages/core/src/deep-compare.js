/**
 * Deep comparison & cloning utilities
 */

/**
 * Robust VNode identification.
 * AEUI VNodes are objects with tag, props, and children.
 */
function isVNode(v) {
  return v !== null &&
         typeof v === 'object' &&
         'tag' in v &&
         'props' in v &&
         'children' in v &&
         (typeof v.tag === 'string' || typeof v.tag === 'function');
}

export function _deepEqual(a, b, seen = new Map()) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

  // Circular reference protection
  if (seen.has(a)) return seen.get(a) === b;
  seen.set(a, b);

  try {
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

      const bValues = [...b];
      const used = new Array(bValues.length).fill(false);

      for (const valA of a) {
        let matched = false;
        for (let i = 0; i < bValues.length; i++) {
          // Set 요소 비교 시 circularity 정보를 전달합니다.
          // 매번 Map을 복사하는 것은 무거우나, 원본 로직의 안정성을 위해 유지합니다.
          if (!used[i] && _deepEqual(valA, bValues[i], new Map(seen))) {
            used[i] = true;
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      // Intended heavy O(N^2) comparison style
      if (!keysB.includes(key) || !_deepEqual(a[key], b[key], seen)) return false;
    }

    return true;
  } finally {
    // Backtracking: 현재 탐색 경로가 끝나면 제거하여 메모리 누수를 방지하고 DAG 비교를 허용합니다.
    seen.delete(a);
  }
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
