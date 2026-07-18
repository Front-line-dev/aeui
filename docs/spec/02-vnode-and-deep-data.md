# 02. VNode와 깊은 데이터 연산 명세

이 문서는 VNode와 깊은 데이터 연산의 AEUI 고유 규칙을 규범적 스펙으로 정의한다. React의 VNode나 일반적인 deep-equal 구현에서 동작을 유추하지 않고 아래 계약을 따른다.

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

원본 props 비변이는 이 계약의 일부다. 같은 props 객체를 여러 VNode에 재사용해도 각 VNode가 독립된 props 객체를 가져야 하며, frozen props를 전달해도 `children` 주입 때문에 예외가 나면 안 된다.

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

## 7. `_deepEqual`

### 7.1 공통 비교와 객체 그래프 대응

`_deepEqual`은 지원하는 모든 값 `a`, `b`에 대해 `_deepEqual(a, b) === _deepEqual(b, a)`를 만족해야 한다.

원시값과 함수는 `Object.is`로 비교한다. 따라서 `NaN`은 같고 `0`과 `-0`은 다르며, 함수는 같은 참조일 때만 같다. 두 값 중 하나만 `null`이거나 객체가 아니면 `false`다.

객체 비교는 양방향 1:1 대응을 유지해야 한다.

```js
const pairs = {
  forward: new Map(), // a -> b
  reverse: new Map(), // b -> a
};
```

- 이미 본 `a`가 다른 `b`와 대응하거나 이미 본 `b`가 다른 `a`와 대응하면 `false`다.
- 객체인 두 값이 같은 참조여도 기존 대응과 충돌하는지 확인하고 대응을 등록한 뒤 `true`를 반환한다.
- 같은 순환 구조와 공유 참조 구조는 종료 가능하게 비교해 `true`로 판정한다.
- 한쪽만 참조를 공유하거나 순환 연결 위치가 다르면 `false`다.
- Map key는 identity로만 비교하므로 재귀 객체 그래프 대응에 등록하지 않는다.

VNode는 identity-only 값이다. 같은 VNode 참조만 같고 구조가 같은 별도 VNode는 다르다.

### 7.2 타입별 비교

Array, Date, RegExp, Map, Set, 일반 object를 양쪽에서 먼저 분류한다. 분류가 다르면 enumerable key가 같아도 `false`다.

| 분류 | 비교 계약 |
| --- | --- |
| Array | 길이가 같아야 하며 인덱스 `0..length-1`을 순서대로 재귀 비교한다. |
| Date | 양쪽 `getTime()` 결과를 `===`로 비교한다. |
| RegExp | `source`와 `flags`가 모두 같아야 한다. |
| Map | size가 같아야 한다. 각 key는 `b.has(key)`로 identity/원시값 일치를 확인하고 value만 재귀 비교한다. |
| Set | size가 같아야 하며 §7.3의 순서 비의존 1:1 매칭을 사용한다. |
| 일반 object | enumerable own string key 집합이 같아야 하며 각 값을 재귀 비교한다. |

Array의 hole과 명시적 `undefined`는 구별하지 않으며 추가 enumerable property는 비교하지 않는다. 일반 object는 prototype, constructor, Symbol key, non-enumerable property를 비교하지 않는다. key 존재 확인은 다음과 같이 enumerable own property 여부를 검사해야 한다.

```js
Object.prototype.propertyIsEnumerable.call(b, key)
```

### 7.3 Set 후보 매칭

Set은 값의 순서와 무관하게 각 값을 정확히 한 번씩 대응시킨다.

1. 두 Set의 size가 다르면 `false`다.
2. `b`의 아직 소비하지 않은 값 집합을 만든다.
3. `a`의 각 값에 대해 대응 가능한 후보를 찾는다.
4. 원시값과 VNode는 identity 규칙으로만 대응한다.
5. 객체 후보는 양방향 대응 기록을 복제한 독립 trial 상태에서 비교한다.
6. 실패한 후보의 대응 기록은 폐기하고 성공한 후보의 양방향 기록만 active 상태에 반영한다.
7. 같은 객체 참조를 빠르게 소비하는 경로도 기존 대응 충돌 확인과 양방향 등록을 생략하면 안 된다.
8. 모든 값이 1:1로 소비되었을 때만 `true`다.

후보 signature 같은 사전 필터를 사용할 수 있지만, 필터는 최종 동일성 판정을 대신할 수 없다.

### 7.4 적합성 요구사항

공식 적합성 suite는 최소한 다음을 검증해야 한다.

- `{}`와 `new Date(0)`, `{}`와 `/x/`, `{}`와 빈 `Map`, `{}`와 빈 `Set`, `[]`와 일반 객체를 양쪽 순서로 비교하면 모두 `false`다.
- 지원 타입과 중첩 구조를 생성해 `_deepEqual(a, b) === _deepEqual(b, a)`를 확인하는 대칭성 property test를 수행한다.
- `{ left: shared, right: shared }`와 `{ left: {}, right: {} }`는 양쪽 비교 순서에서 모두 `false`다.
- 한쪽의 서로 다른 두 객체가 다른 쪽의 같은 공유 객체에 대응하는 반대 alias 불일치도 양쪽 순서에서 모두 `false`다.
- 각각 자기 자신을 가리키는 동형 cycle은 `true`이고, one-node cycle과 연결 위치가 다른 cycle은 `false`이며 비교가 무한 재귀에 빠지지 않는다.
- 동일 object 참조가 일부 경로에 직접 등장해도 다른 경로의 alias 불일치를 숨기지 않는다.
- Set 양쪽에 같은 object 참조가 직접 들어 있는 경우에도 그 빠른 일치가 Set 안팎의 alias 불일치를 숨기지 않는다.
- Set의 첫 후보가 실패한 뒤 두 번째 후보가 성공하는 경우, 실패 후보의 양방향 cycle 기록이 최종 결과에 남지 않는다.
- watcher 통합 테스트에서 이전 deps가 `Date`이고 새 deps가 일반 object인 변경과 그 반대 변경을 모두 감지해 callback을 실행한다.

## 8. `_deepClone`

### 8.1 복제 순서

복제는 다음 순서를 따른다.

```text
1. null 또는 object가 아닌 값 -> 그대로 반환
2. Date -> 같은 timestamp의 새 Date
3. RegExp -> 같은 source/flags의 새 RegExp
4. VNode -> 같은 참조 반환
5. seen에 있으면 기존 clone 반환
6. Array -> 새 배열 등록 후 각 인덱스 값을 재귀 clone
7. Map -> 새 Map 등록 후 key는 유지하고 value만 재귀 clone
8. Set -> 새 Set 등록 후 각 value를 재귀 clone
9. 일반 object -> {} 등록 후 Object.entries의 값을 재귀 clone해 own data property로 정의
```

세부 계약은 다음과 같다.

- VNode는 복제하지 않는다. watcher deps 안의 VNode도 원래 참조를 유지한다.
- 함수, Symbol, bigint 등 object가 아닌 값은 그대로 유지한다.
- Map key는 복제하지 않고 value만 복제한다.
- Array hole은 인덱스 루프와 `push` 때문에 명시적 `undefined` 원소가 된다. 추가 property는 복제하지 않는다.
- 일반 object는 `{}`로 만들어 원본 prototype을 보존하지 않는다.
- `Object.entries`가 반환하는 enumerable own string key만 순회한다. Symbol key와 non-enumerable key는 순회하지 않는다. accessor는 descriptor를 복제하지 않고 getter를 한 번 읽어 그 반환값을 재귀 복제한다.
- WeakMap, WeakSet처럼 `Object.entries`에 값이 나오지 않는 내장 객체는 빈 일반 객체가 된다.
- `seen` 덕분에 Array, Map, Set, 일반 객체의 순환 참조를 보존한다.

### 8.2 일반 object property 정의

1. `Object.entries(source)`로 관찰되는 모든 key를 clone의 enumerable own data property로 생성해야 하며, `"__proto__"`도 예외가 아니다.
2. property를 기록할 때 prototype setter를 호출할 수 있는 일반 대입에 의존해서는 안 된다. 다음과 같은 own-property 정의를 사용할 수 있다.

   ```js
   Object.defineProperty(cloned, key, {
     value: _deepClone(value, seen),
     enumerable: true,
     writable: true,
     configurable: true,
   });
   ```

3. 일반 object clone은 `{}`로 만들며, `"__proto__"` 데이터가 있어도 `Object.getPrototypeOf(cloned) === Object.prototype`이어야 한다.
4. `"__proto__"` value도 다른 value와 같은 규칙으로 재귀 복제해야 한다. object 값은 원본과 다른 clone이어야 하고, cycle이면 이미 등록한 clone을 참조해야 한다.
5. Symbol/non-enumerable key는 제외하고 accessor 반환값은 일반 data property로 만든다.

### 8.3 적합성 요구사항

공식 적합성 suite는 최소한 다음을 검증해야 한다.

- enumerable own `"__proto__"`를 가진 입력을 복제하면 `Object.hasOwn(cloned, '__proto__')`가 `true`다.
- 해당 property descriptor는 enumerable/writable/configurable인 own data descriptor이고, 값은 재귀 복제되어 원본과 같은 참조가 아니다.
- `"__proto__"` 값이 object 또는 `null`이어도 clone의 prototype은 `Object.prototype`에서 바뀌지 않는다.
- 중첩된 일반 object 안의 `"__proto__"` key도 같은 방식으로 안전하게 보존된다.
- `source.__proto__` own value가 `source` 자신을 가리키는 cycle은 `cloned.__proto__ === cloned`로 보존되며, 이 property 접근이 clone의 실제 prototype을 뜻하지 않는다.
- 일반 key, VNode, Map key, Symbol/non-enumerable key, accessor 처리의 위 계약이 함께 유지된다.

## 9. 깊은 연산의 런타임 사용처

| 사용처 | 필요한 의미 |
| --- | --- |
| host prop diff | 이전 props를 deep clone해 두므로 같은 객체를 제자리 수정해도 다음 렌더에서 감지 |
| watcher deps | 등록 직후와 callback 완료 직후 deps를 deep clone해 다음 비교 기준으로 사용 |
| event handler prop | 함수는 참조 비교되며 최신 함수가 달라지면 handler 저장소만 교체 |
| VNode가 포함된 데이터 | VNode는 identity-only이므로 매 렌더 새 VNode면 변경으로 판정 |

## 10. VNode 적합성 요구사항

공식 적합성 suite는 최소한 다음 성질을 검증해야 한다.

- `Object.keys(vnode)`에는 세 공개 필드만 있고 marker Symbol은 별도로 존재한다.
- `props.children === vnode.children`이며 원본/frozen props를 수정하지 않는다.
- null/undefined/boolean child가 제거되고 한 단계 배열만 평탄화된다.
- 별도 생성된 동형 VNode는 다르고 같은 VNode 참조는 같다.
