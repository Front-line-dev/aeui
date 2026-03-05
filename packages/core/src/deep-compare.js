/**
 * Deep comparison & cloning utilities
 */

export function _deepEqual(a, b, seen = new Map()) {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

    // 순환 참조 방어: 이미 비교 중인 (a, b) 쌍이면 동일한 순환 구조로 간주
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

        const bValues = [...b];
        const used = new Array(bValues.length).fill(false);
        let activeSeen = seen;

        for (const val of a) {
            let matchedIndex = -1;
            let matchedSeen = null;

            for (let i = 0; i < bValues.length; i++) {
                if (used[i]) continue;

                // Set 후보 매칭은 백트래킹이 필요하므로 seen 상태를 분리한다.
                const trialSeen = new Map(activeSeen);
                if (_deepEqual(val, bValues[i], trialSeen)) {
                    matchedIndex = i;
                    matchedSeen = trialSeen;
                    break;
                }
            }

            if (matchedIndex === -1) return false;

            used[matchedIndex] = true;
            activeSeen = matchedSeen;
        }
        return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key) || !_deepEqual(a[key], b[key], seen)) return false;
    }

    return true;
}

export function _deepClone(v, seen = new WeakMap()) {
    if (v === null || typeof v !== 'object') return v;

    // 순환 참조 방어: 이미 복제한 객체면 그 복제본을 반환
    if (seen.has(v)) return seen.get(v);

    if (Array.isArray(v)) {
        const cloned = [];
        seen.set(v, cloned);
        v.forEach(item => cloned.push(_deepClone(item, seen)));
        return cloned;
    }

    if (v instanceof Date) return new Date(v.getTime());
    if (v instanceof RegExp) return new RegExp(v.source, v.flags);

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
