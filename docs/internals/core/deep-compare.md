# Deep Compare — `_deepEqual`, `_deepClone`

## 개요

AEUI의 반응성 시스템(Dirty Checking)의 **핵심 유틸리티** 함수 두 개이다.

AEUI는 `setState` 같은 명시적 상태 변경 알림 없이, **현재 값과 이전 값을 비교**하여 변경을 감지한다. 이 비교에 `_deepEqual`이 사용되고, 이전 값의 **독립적 스냅샷**을 저장하는 데 `_deepClone`이 사용된다.

- `_deepEqual`: "이 두 값이 같은 내용인가?" → watcher 의존성 비교, DOM 속성 비교에 사용
- `_deepClone`: "이 값의 독립적 복사본을 만들어라" → watcher의 이전 의존성 스냅샷 저장에 사용

---

## `_deepEqual(a, b)` — 깊은 비교

두 값이 **구조적으로 동일한지** 비교한다. 참조(메모리 주소)가 아닌 **내용(값)**을 비교한다.

### 왜 참조 비교가 아닌 깊은 비교인가

AEUI는 사용자가 객체나 배열을 직접 수정(mutate)하는 것을 허용한다:

```javascript
let items = [1, 2, 3];
items.push(4);  // ← 같은 배열 참조를 직접 수정

let user = { name: "A", age: 20 };
user.name = "B";  // ← 같은 객체 참조를 직접 수정
```

참조 비교(`===`, `Object.is`)로는 같은 객체가 수정되었는지 알 수 없다 (`items === items`는 항상 `true`). 내용을 깊이 비교해야 `[1,2,3]`에서 `[1,2,3,4]`로의 변경을 감지할 수 있다.

### 비교 순서

`_deepEqual`은 타입을 순서대로 확인하여, 첫 번째로 매칭되는 분기에서 처리한다:

```
1. Object.is(a, b)         → 같은 참조이거나 같은 원시값이면 바로 true
2. 둘 다 object 타입인지   → 아니면 false (타입이 다름)
3. Array.isArray(a)        → 배열 비교
4. a instanceof Date       → Date 비교
5. a instanceof RegExp     → RegExp 비교
6. a instanceof Map        → Map 비교
7. a instanceof Set        → Set 비교
8. (나머지)                → 일반 Object 비교
```

### 타입별 비교 전략

#### 원시값 (number, string, boolean, null, undefined, Symbol, BigInt)

```javascript
if (Object.is(a, b)) return true;
```

`Object.is`는 `===`와 거의 같지만 두 가지 차이가 있다:
- `Object.is(NaN, NaN)` → `true` (`===`는 `false`)
- `Object.is(+0, -0)` → `false` (`===`는 `true`)

#### 배열

```javascript
if (Array.isArray(a)) {
  if (!Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!this._deepEqual(a[i], b[i])) return false;  // 각 요소를 재귀 비교
  }
  return true;
}
```

길이가 같고 모든 요소가 같으면 동일하다고 판단한다. 요소 하나라도 다르면 즉시 `false`를 반환한다.

#### Date

```javascript
if (a instanceof Date) {
  return b instanceof Date && a.getTime() === b.getTime();
}
```

`getTime()`은 1970년 1월 1일부터의 밀리초를 반환한다. 이 숫자가 같으면 같은 시각을 나타낸다.

#### RegExp

```javascript
if (a instanceof RegExp) {
  return b instanceof RegExp && a.source === b.source && a.flags === b.flags;
}
```

정규식의 패턴(`source`)과 플래그(`flags`, 예: `gi`)가 모두 같으면 동일하다.

#### Map

```javascript
if (a instanceof Map) {
  if (!(b instanceof Map) || a.size !== b.size) return false;
  for (const [key, val] of a) {
    if (!b.has(key) || !this._deepEqual(val, b.get(key))) return false;
  }
  return true;
}
```

크기가 같고, 모든 key-value 쌍이 같으면 동일하다. value는 재귀적으로 깊은 비교한다.

#### Set

```javascript
if (a instanceof Set) {
  if (!(b instanceof Set) || a.size !== b.size) return false;
  for (const val of a) {
    let hasMatch = false;
    for (const bVal of b) {          // ← 이중 루프
      if (this._deepEqual(val, bVal)) {
        hasMatch = true;
        break;
      }
    }
    if (!hasMatch) return false;
  }
  return true;
}
```

Set의 요소가 **객체일 수 있으므로**, `Set.has()`로 찾을 수 없다 (`has`는 참조 비교를 사용하므로). 따라서 모든 요소 쌍을 `_deepEqual`로 비교하는 **O(n²)** 방식을 사용한다.

예: `Set([{a:1}])` vs `Set([{a:1}])` — 다른 참조의 같은 내용 객체를 정확히 비교하려면 이중 루프가 필요하다.

#### 일반 Object

```javascript
const keysA = Object.keys(a);
const keysB = Object.keys(b);

if (keysA.length !== keysB.length) return false;

for (const key of keysA) {
  if (!keysB.includes(key) || !this._deepEqual(a[key], b[key])) return false;
}
return true;
```

key 수가 같고, 모든 key에 대해 value가 같으면 동일하다.

**key 순서는 무시**한다: `{a:1, b:2}`와 `{b:2, a:1}`은 동일하다고 판단한다.

`Object.keys()`는 `enumerable` 속성만 반환하므로, `Symbol` 키, non-enumerable 속성, prototype chain의 속성은 비교하지 않는다.

#### 함수

함수는 1단계의 `Object.is(a, b)`에서 **참조 비교만** 수행된다. 같은 함수 객체를 가리키면 `true`, 아니면 `false`이다.

인라인 함수(`() => ...`)는 매번 새 객체가 생성되므로 항상 "다름"으로 판단된다.  
현재 이벤트 시스템은 이 차이를 감지하더라도 프록시 리스너를 재등록하지 않고 내부 핸들러 참조만 갱신한다.

---

## `_deepClone(v)` — 깊은 복사

값의 **독립적인 복사본**을 생성한다. 원본과 복사본은 **별도의 메모리**를 차지하므로, 한쪽을 수정해도 다른 쪽에 영향을 주지 않는다.

### 왜 깊은 복사가 필요한가

watcher의 `oldDeps`에 이전 의존성 값을 저장할 때, 참조 복사(얕은 복사)를 하면 원본이 수정될 때 oldDeps도 함께 변경되어 변화를 감지하지 못한다. `_deepEqual`에서의 설명을 참조.

### 복제 순서

```
1. null 또는 원시값       → 그대로 반환 (원시값은 복사가 불필요)
2. Array                 → map으로 각 요소를 재귀 복사한 새 배열
3. Date                  → new Date(getTime())으로 같은 시각의 새 Date
4. RegExp                → new RegExp(source, flags)으로 같은 패턴의 새 RegExp
5. Map                   → 각 key-value를 재귀 복사한 새 Map
6. Set                   → 각 요소를 재귀 복사한 새 Set
7. 일반 Object           → 각 key-value를 재귀 복사한 새 Object
```

### 코드

```javascript
_deepClone(v) {
  if (v === null || typeof v !== 'object') return v;   // 원시값

  if (Array.isArray(v)) {
    return v.map(item => this._deepClone(item));       // 각 요소 재귀 복사
  }

  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof RegExp) return new RegExp(v.source, v.flags);

  if (v instanceof Map) {
    return new Map([...v].map(([k, val]) => [k, this._deepClone(val)]));
  }

  if (v instanceof Set) {
    return new Set([...v].map(item => this._deepClone(item)));
  }

  // 일반 Object
  return Object.fromEntries(
    Object.entries(v).map(([k, val]) => [k, this._deepClone(val)])
  );
}
```

### 복제되지 않는/잘못 처리되는 타입

| 타입 | 동작 | 이유 |
|------|------|------|
| Function | 참조 그대로 반환 | 함수는 복제할 수 없다 (1단계에서 원시값으로 간주되어 그대로 반환) |
| WeakMap, WeakRef | 일반 Object 분기로 처리 → 잘못된 복사 | `instanceof` 체크가 없어 7단계(Object)로 빠짐 |
| DOM 요소 | 일반 Object 분기로 처리 → 에러 가능 | DOM 요소를 `Object.entries`로 처리하면 예상치 못한 동작 발생 |

이 타입들을 watcher의 의존성으로 사용하는 것은 권장하지 않는다.

### 현재 제한 사항: 순환 참조

순환 참조를 가진 객체를 복제하면 **무한 재귀**가 발생한다:

```javascript
const obj = { name: "test" };
obj.self = obj;             // ← 순환 참조
AEUI._deepClone(obj);       // ❌ Maximum call stack size exceeded

// 현재 순환 참조 보호가 없음. 향후 WeakSet으로 방문 추적 추가 가능
```

순환 참조를 가진 객체를 상태로 사용하면 브라우저가 멈출 수 있다.

---

## 사용 위치

### `_deepEqual` 사용처

| 사용처 | 용도 | 설명 |
|--------|------|------|
| `_runComponentWatchers` | watcher 의존성 변경 감지 | `getDeps()` 결과와 `oldDeps`를 비교 |
| `_updateDomProps` | DOM 속성 변경 감지 | 새 props와 이전 props의 각 속성을 비교하여, 실제로 변경된 속성만 DOM에 적용 |

### `_deepClone` 사용처

| 사용처 | 용도 | 설명 |
|--------|------|------|
| `_runComponentWatchers` | oldDeps 스냅샷 저장 | callback 실행 후, 현재 deps 값의 독립적 복사본을 oldDeps에 저장 |
| `watch` 훅 (hooks.js) | 초기 deps 스냅샷 | watcher 등록 시 초기 의존성 값의 복사본을 oldDeps에 저장 |

---

## 관련 코드 위치

- `_deepEqual`: `packages/core/src/core.js` L238-L291
- `_deepClone`: `packages/core/src/core.js` L293-L314
