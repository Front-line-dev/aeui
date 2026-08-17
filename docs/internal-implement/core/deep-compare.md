# Deep Compare — `_deepEqual`, `_deepClone`

## 개요

AEUI의 Dirty Checking은 값을 주기적으로 확인하면서 **이전 값과 새 값의 내용**을 비교해 변경을 찾는 방식이다. 이때 두 내부 함수가 함께 사용된다.

- `_deepEqual`: 두 값이 같은 내용과 같은 참조 관계를 가지는지 비교한다.
- `_deepClone`: 다음 비교에 사용할 독립적인 이전 값 스냅샷을 만든다.

예를 들어 다음 코드는 배열 객체 자체를 바꾸지 않고 그 안의 내용만 바꾼다.

```js
let items = [1, 2, 3];
items.push(4);
```

`items === items`만 확인하면 이런 변경을 찾을 수 없다. AEUI는 이전에 복제해 둔 `[1, 2, 3]`과 새 값 `[1, 2, 3, 4]`를 깊게 비교한다.

---

## `_deepEqual(a, b, pairs?)` — 깊은 비교

`_deepEqual`은 값의 내용뿐 아니라 객체 사이의 공유 참조와 순환 연결도 비교한다. 비교 결과는 인자 순서에 영향을 받지 않아야 한다.

```js
_deepEqual(a, b) === _deepEqual(b, a);
```

### 비교 흐름

비교는 다음 순서로 진행된다.

```text
1. 원시값·함수는 Object.is로 비교
2. 객체라면 기존의 양방향 대응 관계를 확인
3. 새로운 객체 쌍을 양방향 대응표에 등록
4. 같은 객체 참조면 true
5. VNode가 포함되면 false
6. 양쪽 객체의 종류를 각각 분류하고, 종류가 다르면 false
7. 같은 종류의 Array, Date, RegExp, Map, Set, 일반 object 규칙으로 비교
```

`null`은 객체처럼 보일 수 있지만 별도로 처리한다. 두 값 중 하나만 `null`이거나 하나만 객체이면 `false`다.

### 원시값과 함수

원시값과 함수는 `Object.is`로만 비교한다.

```js
Object.is(NaN, NaN); // true
Object.is(+0, -0);   // false
```

함수도 같은 함수 객체를 가리킬 때만 같다. 내용이 같은 두 함수 표현식은 서로 다른 함수 객체이므로 같지 않다.

### 객체 연결 관계를 양쪽으로 기록하기

깊은 비교에서는 개별 속성값만 같아서는 충분하지 않다. 객체들이 서로 연결된 방식도 같아야 한다.

```js
const shared = {};

const a = { left: shared, right: shared };
const b = { left: {}, right: {} };

_deepEqual(a, b); // false
```

`a.left`와 `a.right`는 같은 객체지만 `b.left`와 `b.right`는 서로 다른 객체다. 이 차이를 찾기 위해 비교 중인 객체 쌍을 두 방향으로 기록한다.

```js
const pairs = {
  forward: new Map(), // a 쪽 객체 -> b 쪽 객체
  reverse: new Map(), // b 쪽 객체 -> a 쪽 객체
};
```

새 객체 쌍 `(valueA, valueB)`을 비교할 때는 다음 규칙을 적용한다.

```js
if (pairs.forward.has(valueA)) {
  return pairs.forward.get(valueA) === valueB
    && pairs.reverse.get(valueB) === valueA;
}

if (pairs.reverse.has(valueB)) return false;

pairs.forward.set(valueA, valueB);
pairs.reverse.set(valueB, valueA);
```

한쪽 객체가 이미 다른 객체와 연결되어 있으면 `false`다. 양쪽 대응표를 함께 사용하므로 다음 두 불일치를 모두 찾는다.

- 하나의 `a` 객체가 서로 다른 두 `b` 객체에 연결되는 경우
- 서로 다른 두 `a` 객체가 하나의 `b` 객체에 연결되는 경우

대응 관계를 재귀 전에 등록하면 자기 자신을 가리키는 객체도 무한 반복 없이 비교할 수 있다.

```js
const a = {};
a.self = a;

const b = {};
b.self = b;

_deepEqual(a, b); // true
```

같은 객체 참조를 만났을 때도 바로 `true`를 반환하기 전에 기존 양방향 대응과 충돌하는지 확인한다. 그래야 동일 참조가 중간에 나타나도 다른 경로의 공유 참조 불일치를 숨기지 않는다.

### VNode

VNode는 내용이 아니라 객체의 동일성만 비교한다.

```js
if (isVNode(a) || isVNode(b)) return false;
```

같은 VNode 참조는 앞 단계의 객체 대응과 동일 참조 검사에서 `true`가 된다. 구조가 같은 별도 VNode 객체는 `false`다. VNode를 일반 사용자 데이터처럼 재귀 비교하지 않기 위한 규칙이다.

### 양쪽 객체의 종류를 먼저 확인하기

객체는 양쪽 값을 각각 분류한 뒤 같은 종류끼리만 비교한다.

```js
function classify(value) {
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof RegExp) return 'regexp';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  return 'object';
}

if (classify(a) !== classify(b)) return false;
```

따라서 빈 일반 객체와 빈 `Map`, 빈 `Set`, `Date`, `RegExp`, 배열은 enumerable key가 우연히 같아도 서로 같지 않다. `a`만 검사해 분기를 고르면 인자 순서에 따라 결과가 달라질 수 있으므로 반드시 양쪽을 분류한다.

### 타입별 비교

#### Array

길이가 같고 `0`부터 `length - 1`까지 모든 값이 순서대로 같아야 한다.

```js
if (a.length !== b.length) return false;

for (let i = 0; i < a.length; i += 1) {
  if (!_deepEqual(a[i], b[i], pairs)) return false;
}

return true;
```

배열의 hole과 명시적인 `undefined`는 구별하지 않는다. 숫자 인덱스가 아닌 추가 enumerable property도 비교하지 않는다.

#### Date

양쪽의 timestamp를 `===`로 비교한다.

```js
return a.getTime() === b.getTime();
```

#### RegExp

패턴과 플래그가 모두 같아야 한다.

```js
return a.source === b.source && a.flags === b.flags;
```

#### Map

크기가 같고, `a`의 모든 key가 `b`에도 있어야 하며, 그 key에 연결된 value가 깊게 같아야 한다.

```js
if (a.size !== b.size) return false;

for (const [key, valueA] of a) {
  if (!b.has(key)) return false;
  if (!_deepEqual(valueA, b.get(key), pairs)) return false;
}

return true;
```

Map key에는 깊은 비교를 사용하지 않는다. 객체 key는 같은 객체 참조여야 하며, 원시 key는 `Map.prototype.has`의 표준 규칙을 따른다. key 객체는 양방향 객체 대응표에도 등록하지 않는다.

#### Set

Set은 순서가 없으므로 같은 위치끼리 비교할 수 없다. `a`의 각 값을 `b`의 아직 사용하지 않은 값 하나와 대응시킨다.

```js
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

function compareSet(a, b, pairs) {
  if (a.size !== b.size) return false;

  const remainingB = new Set(b);
  let activePairs = clonePairs(pairs);

  for (const valueA of a) {
    let match = null;

    for (const valueB of remainingB) {
      // 후보 하나의 실패가 다음 후보에 영향을 주지 않게 두 Map을 모두 복제한다.
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
```

여기서 `clonePairs`는 `forward`와 `reverse`를 모두 새 `Map`으로 복사한다. 실패한 후보의 순환·공유 참조 기록은 버리고, 성공한 후보의 기록만 다음 값 비교에 사용한다.

원시값과 VNode 후보도 별도 구조 비교를 하지 않고 앞에서 정의한 동일성 규칙으로 비교한다. `remainingB`에서 성공한 값을 삭제하므로 같은 후보를 두 번 사용할 수 없다. 같은 객체 참조를 빠르게 찾는 최적화를 추가하더라도 양방향 대응 충돌 확인과 등록은 생략할 수 없다. 값의 종류나 크기로 만든 후보 분류값(signature)도 후보 수만 줄일 뿐, 최종 깊은 비교를 대신하지 않는다.

#### 일반 object

양쪽의 enumerable own string key 개수가 같고, 각 key가 `b`에도 enumerable own property로 존재하며, 모든 value가 깊게 같아야 한다. 여기서 enumerable own string key는 `Object.keys(object)`로 확인할 수 있는, 객체 자체에 저장된 문자열 key를 뜻한다.

```js
const keysA = Object.keys(a);
const keysB = Object.keys(b);

if (keysA.length !== keysB.length) return false;

for (const key of keysA) {
  if (!Object.prototype.propertyIsEnumerable.call(b, key)) return false;
  if (!_deepEqual(a[key], b[key], pairs)) return false;
}

return true;
```

key 순서는 무시한다. Symbol key, non-enumerable property, prototype과 constructor는 비교하지 않는다.

---

## `_deepClone(v, seen?)` — 깊은 복사

`_deepClone`은 다음 변경 검사에 사용할 독립적인 스냅샷을 만든다. 원본 배열이나 객체를 나중에 직접 수정해도 이미 만든 스냅샷은 바뀌지 않는다.

### 복제 순서

```text
1. null 또는 object가 아닌 값 -> 그대로 반환
2. Date -> 같은 timestamp의 새 Date
3. RegExp -> 같은 source와 flags의 새 RegExp
4. VNode -> 같은 참조 반환
5. 이미 복제한 객체 -> seen에 저장된 복제본 반환
6. Array -> 새 배열을 등록한 뒤 각 인덱스 값을 재귀 복제
7. Map -> 새 Map을 등록한 뒤 key는 유지하고 value만 재귀 복제
8. Set -> 새 Set을 등록한 뒤 각 value를 재귀 복제
9. 일반 object -> {}를 등록한 뒤 enumerable own string property의 값을 재귀 복제
```

### 전체 흐름

```js
function _deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (isVNode(value)) return value;

  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const cloned = [];
    seen.set(value, cloned);

    for (let i = 0; i < value.length; i += 1) {
      cloned.push(_deepClone(value[i], seen));
    }

    return cloned;
  }

  if (value instanceof Map) {
    const cloned = new Map();
    seen.set(value, cloned);

    for (const [key, item] of value) {
      cloned.set(key, _deepClone(item, seen));
    }

    return cloned;
  }

  if (value instanceof Set) {
    const cloned = new Set();
    seen.set(value, cloned);

    for (const item of value) {
      cloned.add(_deepClone(item, seen));
    }

    return cloned;
  }

  const cloned = {};
  seen.set(value, cloned);

  for (const [key, item] of Object.entries(value)) {
    Object.defineProperty(cloned, key, {
      value: _deepClone(item, seen),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  return cloned;
}
```

### 순환 참조와 공유 참조

Array, Map, Set, 일반 object는 빈 복제본을 먼저 만들고 `seen`에 등록한 다음 내용을 채운다. 이 순서가 순환 참조와 공유 참조를 보존한다.

```js
const source = { name: 'test' };
source.self = source;

const cloned = _deepClone(source);

cloned !== source;          // true
cloned.self === cloned;     // true
```

VNode는 복제하지 않으므로 원래 참조를 유지한다. Map key도 복제하지 않고 원래 key를 유지하며 value만 복제한다.

### `__proto__`를 객체 자체의 데이터 속성으로 복제하기

일반 객체를 `cloned[key] = value`로 채우면 `key`가 `"__proto__"`일 때 상속된 setter가 실행되어 복제본의 prototype이 바뀔 수 있다. 따라서 일반 대입 대신 `Object.defineProperty`를 사용한다. 이 방법은 복제본 객체 자체에 값을 직접 저장하는 enumerable data property를 만든다.

```js
Object.defineProperty(cloned, key, {
  value: _deepClone(item, seen),
  enumerable: true,
  writable: true,
  configurable: true,
});
```

이 규칙에 따라 `"__proto__"`도 다른 key와 똑같이 복제된다.

```js
Object.hasOwn(cloned, '__proto__');              // true
Object.getPrototypeOf(cloned) === Object.prototype; // true
```

`"__proto__"`의 값이 객체이거나 원본 자신을 가리키는 순환 참조여도 value는 재귀 복제되고, 복제본의 실제 prototype은 `Object.prototype`으로 유지된다.

### 특수 처리하지 않는 값

깊은 연산이 별도 의미를 정의하는 객체 종류는 Array, Date, RegExp, Map, Set, VNode다. 그 밖의 객체에는 일반 object 규칙이 적용된다.

| 값 | `_deepEqual` | `_deepClone` |
| --- | --- | --- |
| Function | 같은 함수 참조인지 `Object.is`로 비교 | object가 아니므로 참조 그대로 반환 |
| WeakMap, WeakSet, WeakRef | 내부 슬롯이 아니라 enumerable own string property만 비교 | enumerable own string property를 가진 일반 `{}`로 복제 |
| DOM 객체와 그 밖의 내장 객체 | enumerable own string property만 비교 | enumerable own string property를 가진 일반 `{}`로 복제 |

따라서 이 값들의 플랫폼 내부 상태, prototype, constructor, Symbol key, non-enumerable property는 깊은 연산의 대상이 아니다. 일반 object의 accessor는 값을 읽어 비교하며, 복제할 때는 getter 반환값을 일반 data property로 저장한다.

---

## 사용 위치

### `_deepEqual` 사용처

| 사용처 | 용도 |
| --- | --- |
| `runComponentWatchers` | `getDeps()`의 새 결과와 저장된 `oldDeps`를 비교해 watcher 실행 여부 결정 |
| `updateDomProps` | 새 prop과 이전 prop을 비교해 실제로 달라진 DOM 속성만 갱신 |

함수형 event handler prop은 함수 참조로 비교한다. 새 함수로 바뀌면 event handler 저장소의 값이 갱신된다.

### `_deepClone` 사용처

| 사용처 | 용도 |
| --- | --- |
| `registerWatch` | watcher를 등록할 때 최초 의존성 스냅샷 저장 |
| `runComponentWatchers` | callback 실행 뒤 다음 비교에 사용할 의존성 스냅샷 저장 |
| host prop 처리 | 객체 prop을 제자리에서 수정해도 다음 렌더에서 차이를 찾을 수 있도록 이전 값 저장 |

---

## 관련 코드와 스펙

- 구현: `packages/core/src/deep-compare.js`
- VNode marker: `packages/core/src/vnode-marker.js`
- 규범적 계약: `docs/spec/02-vnode-and-deep-data.md` §7~8
