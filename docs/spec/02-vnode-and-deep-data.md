# 02. VNode와 깊은 데이터 연산

이 장은 AEUI의 두 가지 기반 기술을 다룬다:
- **VNode**: 화면 구조를 JavaScript 객체로 표현하는 방법
- **깊은 데이터 연산** (`_deepEqual`, `_deepClone`): 값이 바뀌었는지 판별하고, 비교 기준값을 복사하는 알고리즘

이 둘이 한 장에 있는 이유는 **watch가 변경을 감지하는 방식**과 직결되기 때문이다. watch는 `_deepEqual`로 이전 값과 현재 값을 비교하고, `_deepClone`으로 다음 비교를 위한 기준값을 만든다.

---

## 1. 관련 모듈

| 모듈 | 역할 |
|---|---|
| `core.js` | `createVNode`, `createElement`, `Fragment`를 만들어 AEUI 객체에 주입 |
| `vnode-marker.js` | VNode 식별용 전역 Symbol 정의 |
| `vnode-helpers.js` | key 추출, Fragment 판별 헬퍼 |
| `deep-compare.js` | `_deepEqual`, `_deepClone` 구현 |
| `node-factory.js` | VNode을 런타임 노드(RuntimeNode)로 분류 |

공개 API는 `AEUI.createVNode`, `AEUI.createElement`(같은 함수), `AEUI.Fragment`이다. `_deepEqual`과 `_deepClone`은 내부 구현이며 공개 API가 아니다.

---

## 2. VNode — 화면 구조의 객체 표현

### 2.1 VNode이란?

JSX를 쓰면 Babel이 `AEUI.createElement()` 호출로 변환하고, 이 호출이 반환하는 **가벼운 JavaScript 객체**가 VNode이다. VNode은 실제 DOM이 아니라 "화면이 이렇게 생겨야 한다"는 **설계도**다.

```jsx
// JSX
<div className="card">{title}</div>

// → Babel 변환 →
AEUI.createElement('div', { className: 'card' }, title)

// → VNode 객체
{
  tag: 'div',
  props: { className: 'card', children: [title] },
  children: [title],
  [Symbol.for('aeui.vnode')]: true  // 비열거 속성
}
```

### 2.2 VNode의 식별 마커

AEUI는 **특정 Symbol**로 VNode을 식별한다:

```js
export const VNODE_MARKER = Symbol.for('aeui.vnode');
```

VNode에는 `Object.defineProperty`로 이 마커를 설정한다:

```js
Object.defineProperty(vnode, VNODE_MARKER, {
  value: true,
  enumerable: false,
});
```

`enumerable: false`이므로 `Object.keys(vnode)`에는 `tag`, `props`, `children`만 나타난다. 깊은 데이터 연산은 `{ tag, props, children }`이라는 구조가 아니라 **이 마커의 존재 여부**로만 VNode을 판별한다.

### 2.3 VNode 구조

정상적으로 생성된 VNode:

```js
{
  tag,                 // 'div' 같은 문자열, 컴포넌트 함수, 또는 Fragment
  props: { ... },      // 항상 새 객체 (원본 props를 수정하지 않음)
  children: [ ... ],   // 정규화된 자식 배열
  [VNODE_MARKER]: true  // 비열거
}
```

**중요한 규칙:**
- `props.children`과 최상위 `children`은 **같은 배열 객체**를 참조해야 한다
- props 인자가 `null`이어도 결과 props는 `{ children: [...] }`이다 (null이 아님)

---

## 3. `createVNode(tag, props, ...children)`

### 3.1 알고리즘

```js
function createVNode(tag, props, ...children) {
  // 1. 자식 배열을 1단계만 펼침
  // 2. null, undefined, boolean 자식 제거
  const validChildren = children
    .flat()
    .filter((child) => child != null && typeof child !== 'boolean');

  // 3. 원본 props를 수정하지 않고 새 객체 생성
  const finalProps = { ...(props || {}), children: validChildren };
  const vnode = { tag, props: finalProps, children: validChildren };

  // 4. VNode 마커 추가
  Object.defineProperty(vnode, VNODE_MARKER, {
    value: true,
    enumerable: false,
  });

  return vnode;
}
```

### 3.2 세부 규칙

| 규칙 | 설명 |
|---|---|
| `flat()` 깊이 | 인자 없는 표준 호출이므로 **1단계만** 평탄화 |
| null/undefined 제거 | `child != null` 검사로 제거 |
| boolean 제거 | `true`, `false` 모두 제거 (`{isVisible && <Comp />}` 패턴 지원) |
| 문자열/숫자/bigint | 별도 변환 없이 유지 (text 변환은 RuntimeNode 생성 단계에서) |
| 2단계 이상 중첩 배열 | 일부 배열이 남을 수 있음 (Fragment로 처리) |
| props 복사 | **얕은 복사만** 수행. 내부 객체의 참조는 그대로 |
| `props.children` 덮어쓰기 | 호출자가 `props.children`을 전달해도 정규화된 배열로 교체 |

**원본 props 비변이 보장:** 같은 props 객체를 여러 VNode에 재사용해도, 각 VNode이 독립된 props 객체를 가진다. frozen 객체를 전달해도 오류가 나지 않는다.

### 3.3 `createElement`

`createElement`는 별도 래퍼가 아니라 `createVNode`과 **같은 함수 객체**다:

```js
AEUI.createElement === AEUI.createVNode; // true
```

---

## 4. Fragment

Fragment는 실제 HTML 요소를 만들지 않고 자식들을 한 묶음으로 다루는 컴포넌트다:

```js
function Fragment(initialProps) {
  return (props) => props.children;
}
```

런타임에서는 다음 두 가지를 모두 Fragment로 본다:

- 렌더 결과가 **배열**인 경우
- VNode의 `tag`가 현재 런타임의 `Fragment` 함수와 같은 경우

Fragment는 별도 DOM 요소를 만들지 않으며, 자식 RuntimeNode들의 첫 DOM부터 마지막 DOM까지를 자신의 DOM 범위로 소유한다. 빈 Fragment의 `firstDom`과 `lastDom`은 모두 `null`이다.

> **참고:** Reconciler는 Fragment VNode을 일반 컴포넌트처럼 setup/render하지 않는다. `node-factory`가 `vnode.tag === state.Fragment`를 확인해 먼저 fragment로 분류하고, VNode의 `children` 배열을 직접 읽는다.

---

## 5. VNode 헬퍼 함수

### 5.1 `getVNodeKey(vnode)`

VNode의 key를 읽는다. `0`, `false`, `''`도 유효한 key다.

- vnode가 null, 비객체, 배열이면 → `null`
- `vnode.props?.key`가 null 또는 undefined이면 → `null`
- 그 외 → 값을 그대로 반환

key 비교는 `!==`를 사용하므로 `NaN` key는 다음 렌더의 `NaN`과 매칭되지 않는다.

### 5.2 `isFragmentVNode(FragmentComponent, vnode)`

다음 중 하나면 `true`:
- `Array.isArray(vnode)`
- `vnode`가 truthy 객체이고 `vnode.tag === resolvedFragmentComponent`

### 5.3 `getFragmentChildren(FragmentComponent, vnode)`

- 배열이면 그 배열 자체 반환
- Fragment VNode이면 `vnode.children || []` 반환
- 나머지는 빈 배열 반환

---

## 6. 렌더 값에서 RuntimeNode로의 분류

`createNode(state, vnode, parentNode, parentDom)`는 렌더 결과를 다음 규칙으로 분류한다:

| 입력 | RuntimeNode 종류 |
|---|---|
| `null` 또는 boolean | → `null` (표시하지 않음) |
| 문자열, 숫자, bigint 등 비객체 | → `text` (문자열로 변환) |
| 배열 또는 Fragment VNode | → `fragment` |
| `tag`가 문자열인 객체 | → `host` (HTML 요소) |
| 그 외 객체 | → `component` (컴포넌트) |

text 값은 `String(vnode)`로 즉시 문자열화한다. 이 분류는 엄격한 VNode 검증을 하지 않는다 — 마커가 없는 `{ tag: 'div', props: {} }`도 host로 처리된다.

> **타입 선언과 런타임의 차이:** `types/index.d.ts`의 `Renderable` 타입은 string/number/bigint/VNode/boolean/nullish/배열만 선언한다. 하지만 런타임은 함수나 Symbol 같은 값도 text 분기로 보내 `String(...)`을 시도한다. 타입은 **권장 입력**, 런타임 분류는 **실제 방어선**이다.

---

## 7. `_deepEqual` — 깊은 비교

`_deepEqual`은 **watch가 값의 변경을 감지하는 핵심 함수**다. 이전 deps와 현재 deps를 비교해 "바뀌었는가?"를 판정한다.

### 7.1 기본 규칙

- **원시값과 함수:** `Object.is`로 비교 → `NaN === NaN`(같음), `0 !== -0`(다름), 함수는 같은 참조만 같음
- **대칭성:** 모든 지원 값에 대해 `_deepEqual(a, b) === _deepEqual(b, a)`
- **VNode:** Identity 비교만 — 같은 VNode 참조만 같고, 구조가 같은 별도 VNode은 다름

### 7.2 객체 그래프 대응 (순환/공유 참조 처리)

같은 객체가 여러 곳에서 참조되거나 순환 구조일 때, 양방향 1:1 대응을 유지해야 한다:

```js
const pairs = {
  forward: new Map(),  // a → b
  reverse: new Map(),  // b → a
};
```

- 이미 본 `a`가 **다른** `b`와 대응 → `false`
- 같은 순환 구조 → 무한 재귀 없이 `true`
- 한쪽만 참조를 공유하는 구조 → `false`

### 7.3 타입별 비교 규칙

양쪽의 타입(Array/Date/RegExp/Map/Set/일반 객체)이 다르면, enumerable key가 같아도 `false`다.

| 타입 | 비교 방법 |
|---|---|
| **Array** | 길이가 같고, 각 인덱스를 재귀 비교 |
| **Date** | `getTime()` 결과를 `===`로 비교 |
| **RegExp** | `source`와 `flags`가 모두 같아야 함 |
| **Map** | size가 같고, 각 key는 identity로 확인, value만 재귀 비교 |
| **Set** | size가 같고, 순서 무관 1:1 매칭 (아래 상세) |
| **일반 객체** | enumerable own string key 집합이 같고, 각 값을 재귀 비교 |

> **비교하지 않는 것:** Array의 추가 property, prototype, constructor, Symbol key, non-enumerable property

### 7.4 Set의 순서 무관 1:1 매칭

Set은 원소의 순서와 상관없이 각 값을 정확히 한 번씩 대응시킨다:

1. 두 Set의 size가 다르면 `false`
2. 원시값과 VNode은 identity 규칙으로만 대응
3. 객체는 양방향 대응 기록을 **복제한 독립 시도 상태**에서 비교
4. 시도 실패 시 기록을 폐기하고 다음 후보로
5. 모든 값이 1:1 소비되면 `true`

---

## 8. `_deepClone` — 깊은 복사

`_deepClone`은 **watch가 비교 기준값을 만드는 함수**다. 등록 직후와 콜백 완료 직후에 deps를 복사해 다음 비교에 사용한다.

### 8.1 복제 규칙

| 입력 | 결과 |
|---|---|
| null 또는 비객체 (함수, Symbol, bigint 등) | 그대로 반환 |
| Date | 같은 timestamp의 **새** Date |
| RegExp | 같은 source/flags의 **새** RegExp |
| VNode | **같은 참조** 반환 (복제하지 않음!) |
| Array | 새 배열, 각 원소를 재귀 복제 |
| Map | 새 Map, key는 유지, value만 재귀 복제 |
| Set | 새 Set, 각 value를 재귀 복제 |
| 일반 객체 | `{}`로 만들어 enumerable own string key의 값을 재귀 복제 |

**주요 특징:**
- VNode은 복제하지 않는다 — 매 렌더마다 새 VNode이 만들어지므로 복제할 필요가 없다
- `seen` Map으로 순환 참조를 보존한다
- 일반 객체의 prototype은 보존하지 않는다 (`{}`로 만듦)
- `Object.entries`가 반환하는 key만 순회하므로 Symbol key와 non-enumerable key는 무시

### 8.2 `__proto__` key의 안전한 처리

일반 대입(`obj[key] = value`)은 `__proto__` key에서 prototype을 바꿀 수 있으므로, `Object.defineProperty`를 사용해 own data property로 정의한다:

```js
Object.defineProperty(cloned, key, {
  value: _deepClone(value, seen),
  enumerable: true,
  writable: true,
  configurable: true,
});
```

---

## 9. 깊은 연산이 사용되는 곳

| 사용처 | 역할 |
|---|---|
| host prop diff | 이전 props를 deep clone해 두므로, 같은 객체를 직접 수정해도 다음 렌더에서 변경 감지 |
| watcher deps | 등록 직후와 콜백 직후에 deps를 deep clone해 다음 비교 기준으로 사용 |
| 이벤트 핸들러 prop | 함수는 참조 비교 — 최신 함수가 달라지면 핸들러 저장소만 교체 |
| VNode 포함 데이터 | VNode은 identity 비교이므로 매 렌더 새 VNode이면 변경으로 판정 |

---

## 10. 검증 요약

- `Object.keys(vnode)`에는 `tag`, `props`, `children`만 있고 마커 Symbol은 별도 존재
- `props.children === vnode.children`이며 원본/frozen props를 수정하지 않음
- null/undefined/boolean 자식이 제거되고 1단계 배열만 평탄화됨
- 별도 생성된 동형 VNode은 다르고, 같은 VNode 참조는 같음
- `_deepEqual(a, b) === _deepEqual(b, a)` 대칭성
- 공유 참조/순환 구조의 1:1 대응 유지
- `_deepClone`에서 `__proto__` key가 prototype을 바꾸지 않음
