# 05. 깊은 비교

이 문서는 AEUI의 `_deepEqual`과 `_deepClone` — watch가 변경을 감지하고 비교 기준값을 만드는 핵심 알고리즘을 설명한다.

---

## 관련 모듈

| 모듈 | 역할 |
|---|---|
| `deep-compare.js` | `_deepEqual`, `_deepClone` 구현 |
| `vnode-marker.js` | VNode 식별 (비교 시 identity 규칙 적용) |

---

## `_deepEqual` — 깊은 비교

### 기본 규칙

- **원시값과 함수:** `Object.is`로 비교 → `NaN === NaN`(같음), `0 !== -0`(다름)
- **대칭성:** 모든 값에 대해 `_deepEqual(a, b) === _deepEqual(b, a)`
- **VNode:** Identity 비교만 — 같은 참조만 같고, 구조가 같은 별도 VNode은 다름

### 순환/공유 참조 처리

같은 객체가 여러 곳에서 참조되거나 순환 구조일 때, 양방향 1:1 대응을 유지한다:

```js
const pairs = {
  forward: new Map(),  // a → b
  reverse: new Map(),  // b → a
};
```

- 이미 본 `a`가 **다른** `b`와 대응 → `false`
- 같은 순환 구조 → 무한 재귀 없이 `true`
- 한쪽만 참조를 공유하는 구조 → `false`

### 타입별 비교

양쪽 타입이 다르면 `false` (enumerable key가 같아도).

| 타입 | 비교 방법 |
|---|---|
| **Array** | 길이 같고, 각 인덱스 재귀 비교 |
| **Date** | `getTime()` 결과를 `===`로 비교 |
| **RegExp** | `source`와 `flags` 모두 같아야 |
| **Map** | size 같고, key는 identity, value 재귀 비교 |
| **Set** | size 같고, 순서 무관 1:1 매칭 |
| **일반 객체** | enumerable own string key 집합 같고, 값 재귀 비교 |

**비교하지 않는 것:** Array 추가 property, prototype, constructor, Symbol key, non-enumerable property

### Set의 순서 무관 1:1 매칭

1. 두 Set의 size가 다르면 `false`
2. 원시값과 VNode은 identity 규칙으로만 대응
3. 객체는 대응 기록을 **복제한 독립 시도 상태**에서 비교
4. 시도 실패 시 기록 폐기, 다음 후보
5. 모든 값이 1:1 소비되면 `true`

---

## `_deepClone` — 깊은 복사

watch가 비교 기준값을 만드는 함수. 등록 직후와 콜백 완료 직후에 deps를 복사한다.

### 복제 규칙

| 입력 | 결과 |
|---|---|
| null 또는 비객체 | 그대로 반환 |
| Date | 같은 timestamp의 **새** Date |
| RegExp | 같은 source/flags의 **새** RegExp |
| VNode | **같은 참조** 반환 (복제 안 함!) |
| Array | 새 배열, 각 원소 재귀 복제 |
| Map | 새 Map, key 유지, value 재귀 복제 |
| Set | 새 Set, 각 value 재귀 복제 |
| 일반 객체 | `{}`로 생성, enumerable own string key 재귀 복제 |

**주요 특징:**
- **VNode은 복제하지 않음** — 매 렌더마다 새 VNode이 만들어지므로 불필요
- `seen` Map으로 순환 참조 보존
- 일반 객체의 prototype 보존 안 함 (`{}`로 생성)
- Symbol key, non-enumerable key 무시

### `__proto__` key 안전 처리

일반 대입(`obj[key] = value`)은 `__proto__` key에서 prototype을 바꿀 수 있으므로, `Object.defineProperty`로 own data property로 정의한다:

```js
Object.defineProperty(cloned, key, {
  value: _deepClone(value, seen),
  enumerable: true,
  writable: true,
  configurable: true,
});
```

---

## 사용처

| 사용처 | 역할 |
|---|---|
| host prop diff | 이전 props를 clone해 같은 객체 직접 수정도 감지 |
| watcher deps | 등록 직후와 콜백 직후에 clone해 비교 기준 생성 |
| 이벤트 핸들러 prop | 함수는 참조 비교 — 다른 참조면 핸들러 교체 |
| VNode 포함 데이터 | identity 비교이므로 매 렌더 새 VNode = 변경 |

---

## 관련 문서

- watcher 실행 흐름: [04. 스케줄러와 Dirty Checking](04-scheduler-and-dirty-checking.md)
