/**
 * Deep comparison & cloning utilities
 */

function isVNode(v) {
  return v !== null && typeof v === 'object' && 'tag' in v && 'props' in v;
}

export function _deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

  // VNode는 프레임워크가 관리하는 특수 객체이므로 깊은 비교 대상에서 제외합니다. (오류 방지)
  if (isVNode(a) || isVNode(b)) return false;

  const stack = [[a, b, new Map()]];

  while (stack.length > 0) {
    const [currA, currB, seen] = stack.pop();

    if (Object.is(currA, currB)) continue;
    if (typeof currA !== 'object' || currA === null || typeof currB !== 'object' || currB === null) return false;

    if (seen.has(currA)) {
      if (seen.get(currA) !== currB) return false;
      continue;
    }
    seen.set(currA, currB);

    if (Array.isArray(currA)) {
      if (!Array.isArray(currB) || currA.length !== currB.length) return false;
      for (let i = currA.length - 1; i >= 0; i--) {
        stack.push([currA[i], currB[i], seen]);
      }
      continue;
    }

    if (currA instanceof Date) {
      if (!(currB instanceof Date) || currA.getTime() !== currB.getTime()) return false;
      continue;
    }

    if (currA instanceof RegExp) {
      if (!(currB instanceof RegExp) || currA.source !== currB.source || currA.flags !== currB.flags) return false;
      continue;
    }

    if (currA instanceof Map) {
      if (!(currB instanceof Map) || currA.size !== currB.size) return false;
      for (const [key, val] of currA) {
        if (!currB.has(key)) return false;
        stack.push([val, currB.get(key), seen]);
      }
      continue;
    }

    if (currA instanceof Set) {
      if (!(currB instanceof Set) || currA.size !== currB.size) return false;
      const bValues = [...currB];
      const matchedB = new Array(bValues.length).fill(false);
      for (const aVal of currA) {
        let found = false;
        for (let i = 0; i < bValues.length; i++) {
          if (!matchedB[i] && _deepEqual(aVal, bValues[i])) {
            matchedB[i] = true;
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      continue;
    }

    const keysA = Object.keys(currA);
    const keysB = Object.keys(currB);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(currB, key)) return false;
      stack.push([currA[key], currB[key], seen]);
    }
  }

  return true;
}

export function _deepClone(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof RegExp) return new RegExp(v.source, v.flags);
  
  // VNode는 매 렌더링마다 새로 생성되므로 깊은 복제 대상에서 제외합니다. (메모리 폭증 오류 방지)
  if (isVNode(v)) return v;

  const seen = new WeakMap();
  const rootClone = Array.isArray(v) ? [] : (v instanceof Map ? new Map() : (v instanceof Set ? new Set() : {}));
  
  const stack = [[v, rootClone]];
  seen.set(v, rootClone);

  while (stack.length > 0) {
    const [curr, clone] = stack.pop();

    if (Array.isArray(curr)) {
      for (let i = 0; i < curr.length; i++) {
        const val = curr[i];
        if (val === null || typeof val !== 'object' || isVNode(val)) {
          clone[i] = val;
        } else if (val instanceof Date) {
          clone[i] = new Date(val.getTime());
        } else if (val instanceof RegExp) {
          clone[i] = new RegExp(val.source, val.flags);
        } else if (seen.has(val)) {
          clone[i] = seen.get(val);
        } else {
          const childClone = Array.isArray(val) ? [] : (val instanceof Map ? new Map() : (val instanceof Set ? new Set() : {}));
          clone[i] = childClone;
          seen.set(val, childClone);
          stack.push([val, childClone]);
        }
      }
    } else if (curr instanceof Map) {
      curr.forEach((val, key) => {
        if (val === null || typeof val !== 'object' || isVNode(val)) {
          clone.set(key, val);
        } else if (val instanceof Date) {
          clone.set(key, new Date(val.getTime()));
        } else if (val instanceof RegExp) {
          clone.set(key, new RegExp(val.source, val.flags));
        } else if (seen.has(val)) {
          clone.set(key, seen.get(val));
        } else {
          const childClone = Array.isArray(val) ? [] : (val instanceof Map ? new Map() : (val instanceof Set ? new Set() : {}));
          clone.set(key, childClone);
          seen.set(val, childClone);
          stack.push([val, childClone]);
        }
      });
    } else if (curr instanceof Set) {
      curr.forEach(val => {
        if (val === null || typeof val !== 'object' || isVNode(val)) {
          clone.add(val);
        } else if (val instanceof Date) {
          clone.add(new Date(val.getTime()));
        } else if (val instanceof RegExp) {
          clone.add(new RegExp(val.source, val.flags));
        } else if (seen.has(val)) {
          clone.add(seen.get(val));
        } else {
          const childClone = Array.isArray(val) ? [] : (val instanceof Map ? new Map() : (val instanceof Set ? new Set() : {}));
          clone.add(childClone);
          seen.set(val, childClone);
          stack.push([val, childClone]);
        }
      });
    } else {
      const keys = Object.keys(curr);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = curr[key];
        if (val === null || typeof val !== 'object' || isVNode(val)) {
          clone[key] = val;
        } else if (val instanceof Date) {
          clone[key] = new Date(val.getTime());
        } else if (val instanceof RegExp) {
          clone[key] = new RegExp(val.source, val.flags);
        } else if (seen.has(val)) {
          clone[key] = seen.get(val);
        } else {
          const childClone = Array.isArray(val) ? [] : (val instanceof Map ? new Map() : (val instanceof Set ? new Set() : {}));
          clone[key] = childClone;
          seen.set(val, childClone);
          stack.push([val, childClone]);
        }
      }
    }
  }

  return rootClone;
}
