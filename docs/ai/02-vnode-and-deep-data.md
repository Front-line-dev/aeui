# 02. VNode와 깊은 데이터 연산 명세

이 문서는 현재 `packages/core/src` 구현을 다른 코드베이스에서 동일하게 재현하기 위한 규범적 명세다. 여기서 “해야 한다”는 호환 구현이 지켜야 하는 동작을 뜻한다. React의 VNode나 일반적인 deep-equal 구현을 유추해서 빈 부분을 채우지 말고, 아래에 적힌 AEUI 고유 규칙을 그대로 따른다.

## 1. 책임과 모듈 경계

| 모듈 | 책임 |
| --- | --- |
| `core.js` | `createVNode`, `createElement`, `Fragment`를 만들고 앱 런타임에 주입 |
| `vnode-marker.js` | VNode 식별용 전역 Symbol 정의 |
| `vnode-helpers.js` | key 추출, Fragment 판별, Fragment children 추출 |
| `deep-compare.js` | `_deepEqual`, `_deepClone` 구현 |
| `node-factory.js` | VNode/렌더 값을 장기 생명주기의 RuntimeNode shell로 분류 |

공개 진입점은 `AEUI.createVNode`, 그 동일 함수 객체인 `AEUI.createElement`, `AEUI.Fragment`다. `_deepEqual`, `_deepClone`, VNode helper는 런타임 내부 구현이며 최상위 공개 API가 아니다.

## 2. VNode 데이터 모델

### 2.1 식별 marker

marker는 반드시 다음 값이어야 한다.

```js
export const VNODE_MARKER = Symbol.for('aeui.vnode');
```

VNode에는 `Object.defineProperty`로 marker를 설정한다.

```js
Object.defineProperty(vnode, VNODE_MARKER, {
  value: true,
  enumerable: false,
});
```

따라서 기본 descriptor 규칙에 의해 marker는 writable/configurable도 `false`다. `Object.keys(vnode)`에는 marker가 나타나지 않고 `tag`, `props`, `children`만 나타나야 한다. deep-data 연산은 `{ tag, props, children }`라는 모양이 아니라 이 marker로만 VNode를 판별한다.

### 2.2 VNode 구조

정상적으로 생성된 VNode는 다음 구조다.

```js
{
  tag,                 // 문자열 host tag, 컴포넌트 함수, 또는 Fragment 함수
  props: { ... },      // 항상 새 객체이며 children을 포함
  children: [ ... ],   // 정규화된 children 배열
  [VNODE_MARKER]: true // non-enumerable
}
```

`props.children`과 최상위 `children`은 같은 배열 객체를 참조해야 한다. `props` 인자가 `null`이어도 결과 `props`는 `null`이 아니라 `{ children: [...] }`다.

## 3. `createVNode(tag, props, ...children)`

### 3.1 정확한 알고리즘

호환 구현은 다음 순서를 따라야 한다.

```js
function createVNode(tag, props, ...children) {
  const validChildren = children
    .flat()
    .filter((child) => child != null && typeof child !== 'boolean');

  const finalProps = { ...(props || {}), children: validChildren };
  const vnode = { tag, props: finalProps, children: validChildren };

  Object.defineProperty(vnode, VNODE_MARKER, {
    value: true,
    enumerable: false,
  });

  return vnode;
}
```

세부 계약은 다음과 같다.

1. `children.flat()`은 인자 없는 표준 호출이므로 정확히 한 단계만 평탄화한다.
2. `null`과 `undefined`는 `child != null` 검사로 제거한다.
3. `true`와 `false`를 포함한 모든 boolean은 제거한다.
4. 문자열, 숫자, bigint, 객체, 함수, Symbol, VNode는 별도 변환 없이 유지한다. 실제 text 변환은 RuntimeNode 생성 단계에서 한다.
5. 두 단계 이상 중첩된 배열은 일부 배열이 남을 수 있다. 남은 배열은 이후 Fragment 렌더 값으로 처리된다.
6. `props || {}`를 object spread한 새 객체를 만들어야 한다. 호출자가 준 객체를 직접 수정하면 안 된다.
7. 호출자가 `props.children`을 전달했더라도 정규화한 `validChildren`으로 덮어쓴다.
8. shallow copy만 수행한다. props 내부 객체의 참조는 이 단계에서 복제하지 않는다.

원본 props 비변이는 현재 계약의 일부다. 같은 props 객체를 여러 VNode에 재사용해도 각 VNode가 독립된 props 객체를 가져야 하며, frozen props를 전달해도 `children` 주입 때문에 예외가 나면 안 된다.

### 3.2 `createElement`

`createElement`는 wrapper가 아니라 `createVNode`와 같은 함수 객체여야 한다.

```js
AEUI.createElement === AEUI.createVNode; // true
```

## 4. Fragment

`Fragment`는 초기 props를 캡처하지 않고, 다음 render props의 children을 그대로 반환하는 컴포넌트다.

```js
function Fragment(initialProps) {
  return (props) => props.children;
}
```

런타임에서는 다음 두 입력을 모두 fragment로 본다.

- 렌더 결과가 배열인 경우
- 객체 VNode의 `tag`가 현재 런타임의 Fragment 함수와 같은 경우

Fragment는 실제 wrapper DOM을 만들지 않는다. children RuntimeNode의 첫 DOM부터 마지막 DOM까지를 자신의 DOM range로 소유한다. 빈 Fragment의 `firstDom`과 `lastDom`은 모두 `null`이다.

reconciler는 Fragment VNode을 일반 component로 setup/render하지 않는다. `node-factory`가 `vnode.tag === state.Fragment`를 먼저 fragment kind로 분류하고, mount/update는 `getFragmentChildren(..., vnode)`로 VNode의 `children` 배열을 직접 읽는다. 위 `Fragment(initialProps) -> render(props)` 함수는 공개 direct-call 결과와 Fragment identity를 정의하지만 정상 Fragment VNode reconciliation 중에는 호출되지 않는다.

## 5. VNode helper 계약

### 5.1 `getVNodeKey(vnode)`

```text
vnode가 null, 비객체, 또는 배열이면 null
그 외에는 vnode.props?.key를 읽음
key가 null 또는 undefined이면 null
그 외 값은 변환하지 않고 그대로 반환
```

따라서 `0`, `false`, `''`는 유효한 key다. 비교 단계에서는 `!==`를 사용하므로 `NaN` key는 다음 렌더의 `NaN`과 같은 key로 취급되지 않고, `0`과 `-0`은 같은 key로 취급된다.

### 5.2 `isFragmentVNode(FragmentComponent, vnode)`

`FragmentComponent`가 함수면 그 함수를 사용한다. 객체면 객체의 `.Fragment`를 사용하고, 둘 다 아니면 `null`을 사용한다. 다음 중 하나면 `true`다.

- `Array.isArray(vnode)`
- `vnode`가 truthy object이고 `vnode.tag === resolvedFragmentComponent`

### 5.3 `getFragmentChildren(FragmentComponent, vnode)`

- 배열이면 그 배열 자체를 반환한다.
- Fragment VNode이면 `vnode.children || []`를 반환한다.
- 나머지는 빈 배열을 반환한다.

## 6. 렌더 값에서 RuntimeNode로의 1차 분류

`createNode(state, vnode, parentNode, parentDom)`는 다음 순서로 분류한다.

```text
null 또는 boolean                 -> null
typeof vnode !== 'object'         -> text
배열 또는 Fragment VNode          -> fragment
typeof vnode.tag === 'string'     -> host
그 외 object                     -> component shell
```

text 값은 `String(vnode)`로 즉시 문자열화한다. 이 분류는 엄격한 VNode validation을 하지 않는다. 예를 들어 marker가 없는 `{ tag: 'div', props: {} }`도 host 입력으로 처리하며, object이지만 문자열 tag/Fragment가 아닌 값은 component shell로 넘어가 setup 시점에 실패할 수 있다.

이 runtime 수용 범위는 `types/index.d.ts`의 public `Renderable`보다 의도적으로 넓다. 타입은 string/number/bigint/VNode/boolean/nullish/배열만 선언하지만 JavaScript 직접 호출은 함수나 Symbol 같은 값을 text 분기로 보내 `String(...)`을 시도하고 marker 없는 VNode-like object도 받아들인다. 타입 선언은 권장 public 입력이고 runtime 분류는 실제 방어 경계이므로 둘을 같은 allowlist로 좁히지 않는다.

## 7. `_deepEqual(a, b, seen = new Map())`

### 7.1 공통 순서

비교는 아래 순서를 정확히 따른다.

```text
1. Object.is(a, b)이면 true
2. 어느 한쪽이라도 null이거나 object가 아니면 false
3. 어느 한쪽이라도 VNode marker를 가지면 false
4. seen에 a가 있으면 seen.get(a) === b 반환
5. seen.set(a, b)
6. a의 타입에 따라 Array -> Date -> RegExp -> Map -> Set 순서로 분기
7. 나머지는 일반 object의 enumerable own string key 비교
```

이 순서 때문에 같은 VNode 참조만 1단계에서 같고, 구조가 같은 별도 VNode는 3단계에서 다르다. 함수도 같은 참조만 `Object.is`에서 같고 서로 다른 함수는 2단계에서 다르다. `NaN`은 같고 `0`과 `-0`은 다르다.

`seen`은 `a -> b` 방향의 Map이다. 이미 본 `a`가 다시 나오면 이전에 대응시킨 정확히 같은 `b`인지 확인해 순환 참조를 끝낸다.

### 7.2 타입별 규칙

| 타입 | 비교 규칙 |
| --- | --- |
| Array | `b`도 Array이고 길이가 같아야 하며, 인덱스 `0..length-1`을 순서대로 재귀 비교 |
| Date | `b instanceof Date`이고 `getTime()`이 `===` |
| RegExp | `b instanceof RegExp`, `source`와 `flags`가 모두 `===` |
| Map | `b`도 Map이고 size가 같아야 함. `a`의 각 key는 `b.has(key)`로 참조/원시 key 일치해야 하고 value만 재귀 비교 |
| Set | size 확인 후 아래의 1:1, 순서 비의존 매칭 알고리즘 사용 |
| 일반 object | `Object.keys` 개수와 key 집합이 같고 각 값을 재귀 비교 |

Array의 hole과 명시적 `undefined`는 인덱스 접근 결과가 같으므로 구별하지 않는다. Array의 추가 enumerable property는 비교하지 않는다. Map key는 deep compare하지 않는다. 일반 object는 prototype, constructor, Symbol key, non-enumerable property를 비교하지 않는다. 분기는 첫 번째 인자 `a`의 타입을 기준으로 하므로 일반 object fallback에서 두 객체의 prototype/내장 타입 동일성도 추가 검사하지 않는다.

일반 object의 key 존재 확인은 반드시 다음과 같이 enumerable own property인지 확인해야 한다.

```js
Object.prototype.propertyIsEnumerable.call(b, key)
```

단순히 `key in b`를 사용하면 상속 property를 잘못 같은 것으로 판정한다.

### 7.3 Set의 정확한 매칭 알고리즘

Set은 값의 순서와 무관하지만 deep-equal 객체 중복을 1:1로 소비해야 한다.

1. `remainingB = new Set(b)`를 만든다.
2. `a`의 각 값 `valA`를 순회한다.
3. `remainingB.delete(valA)`가 성공하면 SameValueZero 기준 직접 일치로 소비하고 다음 값으로 간다.
4. 직접 일치하지 않은 값이 원시값 또는 VNode면 즉시 `false`다.
5. 초기에는 현재 `remainingB`의 첫 후보를 별도 signature 검사 없이 한 번 시도한다. 성공하면 소비하고 이 빠른 경로를 유지한다. 한 번 실패하면 이후에는 signature 필터 경로만 사용한다.
6. 값 종류/모양으로 만든 signature가 같은 후보만 순회한다.
7. 후보마다 현재 cycle map을 복사한 `trialSeen`으로 `_deepEqual`을 수행한다. 실패한 후보의 cycle 기록이 다음 후보를 오염시키면 안 된다.
8. 첫 성공 후보를 `remainingB`에서 제거하고 그 `trialSeen`을 active cycle map으로 채택한다.
9. 후보가 없으면 `false`, 모두 끝난 뒤 `remainingB.size === 0`이면 `true`다.
10. 성공한 active cycle map의 엔트리를 원래 `seen`에 합친다.

signature는 primitive/VNode/Array 길이/Date 값/RegExp source와 flags/Map size/Set size/일반 객체의 정렬된 key 및 own data-property shape를 사용한다. signature는 일치 가능성이 없는 후보를 거르는 최적화일 뿐 최종 동일성 판정이 아니다.

## 8. `_deepClone(v, seen = new WeakMap())`

복제 순서는 다음과 같다.

```text
1. null 또는 object가 아닌 값 -> 그대로 반환
2. Date -> 같은 timestamp의 새 Date
3. RegExp -> 같은 source/flags의 새 RegExp
4. VNode -> 같은 참조 반환
5. seen에 있으면 기존 clone 반환
6. Array -> 새 배열 등록 후 각 인덱스 값을 재귀 clone
7. Map -> 새 Map 등록 후 key는 유지하고 value만 재귀 clone
8. Set -> 새 Set 등록 후 각 value를 재귀 clone
9. 일반 object -> {} 등록 후 Object.entries의 값을 재귀 clone
```

중요한 결과는 다음과 같다.

- VNode는 복제하지 않는다. watcher deps 안의 VNode도 원래 참조를 유지한다.
- 함수, Symbol, bigint 등 object가 아닌 값은 그대로 유지한다.
- Map key는 복제하지 않고 value만 복제한다.
- Array hole은 인덱스 루프와 `push` 때문에 명시적 `undefined` 원소가 된다. 추가 property는 복제하지 않는다.
- 일반 object는 `{}`로 만들어 원본 prototype을 보존하지 않는다.
- `Object.entries`가 반환하는 enumerable own string key만 순회한다. Symbol key와 non-enumerable key는 순회하지 않는다. accessor는 descriptor를 복제하지 않고 getter를 한 번 읽어 그 반환값을 재귀 복제한 뒤 일반 대입한다.
- 단, key가 정확히 `"__proto__"`이면 `{}`에 대한 `cloned[key] = value`가 own data property를 만드는 대신 상속된 `Object.prototype.__proto__` setter를 호출할 수 있다. 이 경우 clone에는 `"__proto__"` own property가 생기지 않으며, 복제된 값이 object 또는 `null`이면 clone의 prototype이 그 값으로 바뀐다. 따라서 현재 구현은 **모든** enumerable own string property를 보존한다고 규정할 수 없다.
- WeakMap, WeakSet처럼 `Object.entries`에 값이 나오지 않는 내장 객체는 빈 일반 객체가 된다.
- `seen` 덕분에 Array, Map, Set, 일반 객체의 순환 참조를 보존한다.

`"__proto__"` 예외는 현재 코드의 실제 복제 의미를 정확히 기록하기 위한 것이다. 이 문서 작업에서는 clone 구현을 바꾸지 않는다. 재구현도 현재 동작을 그대로 따라야 한다는 뜻이 아니라, 안전한 own data-property 복제가 필요할 때 별도의 명세 변경과 회귀 테스트를 먼저 추가해야 한다는 뜻이다.

## 9. 깊은 연산의 런타임 사용처

| 사용처 | 필요한 의미 |
| --- | --- |
| host prop diff | 이전 props를 deep clone해 두므로 같은 객체를 제자리 수정해도 다음 렌더에서 감지 |
| watcher deps | 등록 직후와 callback 완료 직후 deps를 deep clone해 다음 비교 기준으로 사용 |
| event handler prop | 함수는 참조 비교되며 최신 함수가 달라지면 handler 저장소만 교체 |
| VNode가 포함된 데이터 | VNode는 identity-only이므로 매 렌더 새 VNode면 변경으로 판정 |

## 10. 검증 계약

재구현 시 최소한 다음 성질을 테스트해야 한다.

- `Object.keys(vnode)`에는 세 공개 필드만 있고 marker Symbol은 별도로 존재한다.
- `props.children === vnode.children`이며 원본/frozen props를 수정하지 않는다.
- null/undefined/boolean child가 제거되고 한 단계 배열만 평탄화된다.
- Array/Date/RegExp/Map/Set/순환 object 비교가 위 규칙과 일치한다.
- Set 내부 deep-equal 객체는 순서와 무관하되 1:1로 매칭된다.
- 별도 생성된 동형 VNode는 다르고 같은 VNode 참조는 같다.
- deep clone은 순환 구조를 보존하고 VNode/Map key 참조를 유지한다.
- 일반 object clone은 Symbol/non-enumerable/accessor descriptor를 보존하지 않으며, enumerable own `"__proto__"` key를 일반 own property로 보존하지 못하는 **현재 구현** 예외를 조사한다.

현재 구현의 참고 근거는 `example/test/src/__tests__/unit.test.js`와 `example/test/src/__tests__/vnode-helpers.test.js`다. 이 기존 테스트는 새 문서 우선 적합성 suite가 아니며, §10의 항목은 새 suite를 처음부터 작성할 때 독립적으로 검증해야 한다.
