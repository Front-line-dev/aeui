# 04. Reconciliation과 DOM 호스트 명세

이 문서는 `old RuntimeNode + new render value`를 비교해 RuntimeNode를 재사용하고 실제 DOM을 배치하는 알고리즘을 규정한다. DOM diff는 React 호환을 목표로 하지 않으며, 아래 key 매칭, DOM range, prop 처리 및 오류 정리 계약을 따른다.

## 1. 모듈 경계

| 모듈 | 책임 |
| --- | --- |
| `reconciler.js` | node identity 판정, mount/update, children diff, DOM range 배치, unmount |
| `node-factory.js` | 새 RuntimeNode shell 생성 |
| `component-lifecycle.js` | component subtree render와 cleanup |
| `dom-host.js` | DOM 생성, prop snapshot/diff, controlled property 재동기화 |
| `vnode-helpers.js` | key와 Fragment 판별 |

reconciler는 host prop의 의미를 직접 구현하지 않고 DOM 호스트 함수에 위임한다. DOM 호스트는 어떤 RuntimeNode를 재사용할지 결정하지 않는다.

## 2. `reconcile`의 규범적 흐름

내부 시그니처는 다음과 같다.

```js
reconcile(state, parentDom, oldNode, newVNode, beforeDom = null, parentNode = null)
```

여기서 `newVNode`라는 이름은 VNode 객체뿐 아니라 원시 text 값, 배열, null, boolean도 포함하는 render value를 뜻한다.

```text
1. newVNode가 null 또는 boolean인가?
   - oldNode가 있으면 unmountNode(oldNode)
   - null 반환

2. oldNode가 있고 isSameNodeType(oldNode, newVNode)가 false인가?
   - oldNode를 DOM 포함 unmount
   - oldNode = null

3. oldNode가 없는가?
   - createNode(newVNode, parentNode, parentDom)
   - kind별 mount

4. oldNode가 있는가?
   - oldNode.parent/parentDom을 현재 값으로 갱신
   - kind별 update
```

null/boolean은 placeholder RuntimeNode를 만들지 않는다. 따라서 조건부 child가 사라지면 old node가 실제로 제거되고, 나머지 unkeyed sibling은 다음 children diff의 순차 규칙으로 다시 매칭된다.

## 3. node identity 판정

모든 kind는 먼저 `oldNode.key !== getVNodeKey(newVNode)`이면 다른 node로 판정한다. key가 같을 때 kind별 조건은 다음과 같다.

| old kind | 같은 타입 조건 |
| --- | --- |
| `text` | `typeof newVNode !== 'object' || newVNode == null` |
| `fragment` | 새 값이 배열이거나 `newVNode.tag === state.Fragment`인 VNode |
| `host` | 새 값이 non-array object이고 `oldNode.tag === newVNode.tag` |
| `component` | 새 값이 object이고 tag가 함수이며 Fragment가 아니고 `oldNode.component === newVNode.tag` |

host props나 component props는 identity에 관여하지 않는다. 같은 host tag/component 함수와 같은 key면 RuntimeNode를 재사용하고 props만 갱신한다. raw 함수 render value는 object가 아니므로 text identity 조건에 들어가며, 정상 component는 반드시 `{ tag: Component }` VNode 형태로 전달된다.

## 4. DOM range 모델

모든 non-empty RuntimeNode는 `firstDom`과 `lastDom`으로 parent DOM의 연속된 직접 자식 범위를 나타낸다.

| kind | range |
| --- | --- |
| text | 같은 TextNode 한 개 |
| host | 같은 Element 한 개; host 내부 children은 range에 포함하지 않음 |
| fragment | 첫 non-empty child의 `firstDom`부터 마지막 non-empty child의 `lastDom` |
| component | rendered subtree의 range |
| root | root child의 range |

`updateRangeFromChildren`은 children을 왼쪽부터 순회해 첫 `firstDom`과 마지막 `lastDom`을 선택한다. DOM이 없는 child는 건너뛴다.

### 4.1 range 수집

`getDomNodesInRange(parentDom, node)`는 다음 조건에서 빈 배열을 반환한다.

- node/firstDom/lastDom 중 하나가 없음
- `node.firstDom.parentNode !== parentDom`

그 외에는 firstDom부터 `nextSibling`을 따라 lastDom을 포함할 때까지 수집한다.

### 4.2 `placeNode`

node의 range를 `beforeDom` 바로 앞으로 옮긴다.

1. range가 비면 아무 일도 하지 않는다.
2. range 마지막 DOM의 `nextSibling === beforeDom`이면 이미 올바른 위치이므로 아무 일도 하지 않는다.
3. 아니면 range의 각 DOM을 순서대로 `parentDom.insertBefore(domNode, beforeDom)`한다.
4. 실제 이동 경로를 탔으면 `state.didMutate = true`다.

여러 DOM으로 된 Fragment/component도 이 방식으로 순서를 유지한 채 이동한다.

## 5. sibling diff: `reconcileChildren`

입력은 `(state, parentDom, parentNode, newVNodes, beforeDom = null)`이다. 알고리즘은 key 우선과 unkeyed 순차 fallback을 결합한다.

### 5.1 이전 children 인덱싱

```text
keyedOld = new Map()
각 old child:
  child._matched = false
  key가 null이면 map에 넣지 않음
  같은 key가 map에 이미 있으면 duplicate 경고 후 그 child는 map에 넣지 않음
  아니면 keyedOld.set(key, child)
```

경고 문자열은 다음과 같다.

```text
[AEUI] Duplicate key detected in sibling list: <String(key)>
```

### 5.2 새 children 매칭

새 값들을 왼쪽부터 순회한다.

```text
key가 있는 새 값:
  새 목록에서도 같은 key를 이미 봤으면 경고
  keyedOld의 candidate가 있고 아직 미매칭이면 사용

key가 없는 새 값:
  oldChildren의 단조 증가 cursor에서 시작
  이미 매칭된 child와 keyed child를 건너뜀
  다음 미매칭 unkeyed child 하나를 사용

candidate가 있으면 candidate._matched = true
reconcile(parentDom, candidate, newVNode, beforeDom, parentNode)
null이 아닌 결과만 nextChildren에 push
```

새 목록의 duplicate key는 첫 항목만 이전 keyed node를 재사용할 수 있다. 뒤 duplicate는 경고 후 새 node로 mount되며 렌더 자체는 계속된다.

keyed child는 새 위치가 어디든 key로 찾는다. unkeyed child는 keyed 위치를 건너뛰면서 이전 unkeyed 순서대로 identity를 받는다. 매칭된 RuntimeNode의 kind가 실제로 다르면 안쪽 `reconcile`이 그 node를 unmount하고 새 node를 만든다.

### 5.3 제거와 최종 배치

1. 모든 새 값을 reconcile한 뒤 `_matched`가 false인 old child를 unmount한다.
2. 모든 old child에서 임시 `_matched` property를 삭제한다.
3. `anchor = beforeDom`으로 시작해 `nextChildren`을 오른쪽에서 왼쪽으로 순회한다.
4. 각 child를 `placeNode(..., anchor)`하고, child가 non-empty이면 `anchor = child.firstDom`으로 갱신한다.
5. `parentNode.children = nextChildren`으로 commit한다.
6. parent kind가 fragment/root이면 children 기준 range를 다시 계산한다.

이 오른쪽-왼쪽 배치 때문에 keyed reorder는 DOM node와 component state를 보존한다. 이미 올바른 순서면 `insertBefore`를 호출하지 않는다.

## 6. kind별 mount

### 6.1 text

```text
document.createTextNode(node.value)
parentDom.insertBefore(dom, beforeDom)
dom/firstDom/lastDom에 같은 TextNode 저장
didMutate = true
```

### 6.2 host

```text
1. createDomNode(state, node.vnode)
2. parentDom.insertBefore(dom, beforeDom)
3. node.dom = dom
4. cloneHostPropsSnapshot으로 node.props 저장
5. firstDom = lastDom = dom
6. didMutate = true
7. host DOM을 parent로 children reconcile
8. syncHostControlledProps
9. range를 다시 dom 한 개로 고정
```

### 6.3 fragment

자체 DOM을 만들지 않는다. parent DOM에 Fragment children을 직접 reconcile하고 children으로 range를 계산한다.

### 6.4 component

`renderComponentNode(state, parentDom, node, node.vnode.props || {}, beforeDom)`에 위임한다. setup, render factory 실행, rendered subtree reconcile, range commit은 component lifecycle이 담당한다.

## 7. kind별 update

### 7.1 text

새 값을 `String(newVNode)`로 만든다. 이전 `node.value !== nextValue`일 때만 `nodeValue`를 쓰고 `didMutate = true`로 한다. DOM과 range는 재사용한다.

### 7.2 host

순서는 반드시 다음과 같아야 한다.

```text
1. updateDomProps(dom, newVNode.props, 이전 snapshot)
2. vnode/key/tag 갱신
3. 새 props deep snapshot 저장
4. children reconcile
5. syncHostControlledProps
6. range를 host dom 한 개로 고정
```

props diff가 children보다 먼저지만 controlled value의 최종 property 동기화는 children 뒤다.

### 7.3 fragment

vnode/key를 갱신하고 Fragment children을 reconcile한 뒤 range를 다시 계산한다.

### 7.4 component

vnode/key/component 참조를 갱신하고 `renderComponentNode`를 호출한다. 기존 render factory와 closure state는 component identity가 같으면 유지된다.

## 8. unmount

`unmountNode(state, node, removeDom = true)`는 다음 순서를 따른다.

```text
1. node가 없으면 return
2. node.isMounted = false
3. component면 cleanupComponentNode(..., {
     preserveChildren: true,
     preserveDomRange: true
   })
4. 현재 children 각각을 unmountNode(child, false)로 재귀 정리
5. removeDom이고 node.parentDom이 있으면 node range 제거
6. node.children = []
7. node.firstDom = node.lastDom = null
```

부모 cleanup이 자식 cleanup보다 먼저 실행된다. 자식에는 `removeDom=false`를 전달하고 최상위 제거 node의 연속 range를 한 번만 DOM에서 뺀다. 실제로 하나 이상의 DOM을 제거했으면 `didMutate = true`다.

일반 unmount는 text/host의 `node.dom`, vnode, props 필드까지 지우지 않는다. RuntimeNode를 트리에서 떼고 lifecycle/range 참조를 정리하는 범위만 보장한다.

## 9. 실패한 mount의 국소 DOM 정리

### 9.1 host mount 실패

host mount의 local `try`는 `createDomNode`, parent 삽입, `node.dom` 설정, props deep snapshot, range 및 `didMutate` 설정이 모두 끝난 **뒤** 시작한다. 그 try 안의 child reconcile 또는 controlled sync가 throw하면 다음을 수행한다.

```text
state.unmountNode(node, false)
host dom이 아직 parentDom의 자식이면 removeChild
node.dom/firstDom/lastDom = null
원래 error rethrow
```

host element 제거로 그 안에 삽입된 DOM도 함께 제거된다.

따라서 `createDomNode` 자체의 오류는 아직 insert 전이지만, insert 뒤 실행되는 `cloneHostPropsSnapshot`/`deepClone` 오류는 local catch 밖이다. direct `AEUI.__runtime.reconcile` 호출에서는 이 경우 삽입 host가 남을 수 있다. root-level `reconcileRoot` 경로에서는 committed-DOM scan이 그 미커밋 host를 제거하며, 이 경로는 public tick뿐 아니라 internal `reconcileRoot` 직접 호출로도 실행할 수 있다. local host 정리와 root-level 실패 정리를 같은 보장으로 합치지 않는다.

### 9.2 fragment mount 실패

mount 전에 `beforeDom` 직전 sibling(없으면 parent의 현재 lastChild)을 기억한다. 실패하면 fragment node를 `removeDom=false`로 unmount한 뒤, 기억한 지점 다음부터 `beforeDom` 직전까지 새로 삽입된 모든 sibling을 제거하고 error를 다시 던진다.

## 10. DOM node 생성과 props snapshot

### 10.1 `createDomNode`

```js
if (typeof vnode !== 'object') {
  return document.createTextNode(String(vnode));
}

const domNode = document.createElement(vnode.tag);
updateDomProps(state, domNode, vnode.props);
return domNode;
```

host children은 여기서 만들지 않는다. namespace별 `createElementNS` 분기도 없다.

### 10.2 `cloneHostPropsSnapshot`

`Object.entries(props)`를 순회해 각 값을 `state.deepClone`한다. 다음 key는 snapshot에서 제외한다.

```text
children, key, ref, __self, __source
```

snapshot은 같은 style/data object를 호출자가 제자리 수정해도 다음 render에서 이전 값과 비교하기 위해 필요하다. `__self`는 RuntimeNode/DOM까지 이어지는 순환 구조일 수 있으므로 반드시 제외한다.

### 10.3 `updateProps(target, newProps)`

이 helper는 `dom-host.js`에서 export되고 `AEUI.__runtime.updateProps`와 `state.updateProps`에 같은 함수 참조로 노출된다. 주 component render 경로는 `component-lifecycle.js`의 별도 `syncPropsTarget`을 사용하며, internal ABI는 아래 알고리즘도 포함한다.

```js
export function updateProps(target, newProps) {
  for (const key in target) delete target[key];
  if (newProps) Object.assign(target, newProps);
}
```

target identity는 유지하고 enumerable key를 먼저 지운 뒤 truthy `newProps`의 own enumerable property를 복사한다. 명시적인 target 타입 가드는 없다. nullish target의 `for...in` 자체는 항목 없이 끝나지만 truthy `newProps`까지 주면 `Object.assign(nullish, ...)`이 TypeError를 던진다. primitive target은 표준 coercion 규칙을 따르고, strict module에서 삭제할 수 없는 own property를 지우는 경우도 오류가 날 수 있으며 이 함수는 그런 오류를 catch하지 않는다. `for...in`은 상속된 enumerable key도 방문하지만 inherited property의 delete는 prototype property를 제거하지 못한다.

## 11. `updateDomProps` 전체 알고리즘

```js
const allProps = { ...oldProps, ...props };
```

old/new 모든 enumerable own key를 합쳐 삭제된 prop도 순회한다. 각 key에서 `newValue`, `oldValue`를 읽고 아래 순서를 적용한다.

1. `children`, `key`, `ref`, `__self`, `__source`면 skip한다.
2. file-input value 특례를 먼저 계산한다.
3. `deepEqual(newValue, oldValue)`이고 file-input value 특례가 아니면 skip한다.
4. 아래 branch 표의 첫 일치 항목을 실행한다.

### 11.1 branch 표

| 조건 | 동작 |
| --- | --- |
| `key.startsWith('on')` | event handler 저장/프록시 listener 관리 |
| `key === 'className'` | `domNode.className = newValue ?? ''` |
| `key === 'style'`이고 non-null object | `cssText=''` 후 `Object.assign(domNode.style, newValue)` |
| `key === 'style'`이고 string | `domNode.style.cssText = newValue` |
| `key === 'value'` | file 특례 또는 property+attribute 동기화 |
| `key.startsWith('aria-')` | boolean은 문자열 attribute로 설정하고, nullish는 제거하며, 나머지는 `setAttribute`로 전달 |
| `typeof newValue === 'boolean'` | 같은 이름의 DOM property 설정 후 true면 빈 attribute, false면 제거 |
| `newValue == null` | 필요 시 boolean property를 false로 하고 attribute 제거 |
| 나머지 | `setAttribute(key, newValue)` |

event branch 외의 실행 branch는 `state.didMutate = true`로 설정한다. deep-equal skip 전에 실제 DOM 상태를 다시 읽지는 않으므로 일반 prop은 외부 DOM 수정이 있어도 같은 props만으로 복구하지 않는다. `value`/`checked`의 controlled 경로만 별도로 복구한다.

### 11.2 class와 style

- `className`은 DOM property로 쓰며 nullish 값은 빈 문자열이다. 별도의 `class -> className` alias 변환은 없고, `class`를 직접 주면 일반 attribute branch가 처리한다.
- object style은 `cssText`를 전부 비운 뒤 property를 assign하므로 새 객체에서 사라진 style도 제거된다.
- string style은 `cssText`를 통째로 바꾼다.
- style이 null이면 별도 style branch가 아니라 일반 attribute 제거 branch로 간다.

### 11.3 boolean과 일반 attribute

```text
key가 aria-*이고 newValue === true  -> setAttribute(key, 'true')
key가 aria-*이고 newValue === false -> setAttribute(key, 'false')
key가 aria-*이고 newValue가 nullish -> attribute 제거
```

`aria-*` boolean 처리에서는 같은 이름의 DOM expando property를 만들거나 수정하지 않는다. `disabled`, `checked` 같은 HTML boolean property/attribute는 일반 boolean branch로 처리한다. 따라서 `aria-*` 판정은 일반 boolean branch보다 먼저 실행해야 한다.

null/undefined 제거 시 `typeof oldValue === 'boolean' || typeof domNode[key] === 'boolean'`이면 property도 `false`로 만든다. 일반 문자열/숫자/object는 `setAttribute`의 브라우저 문자열 변환에 맡긴다. `htmlFor -> for`, `dangerouslySetInnerHTML`, ref lifecycle 같은 별도 의미는 없다.

## 12. 이벤트 prop 처리

문자열 key에 대소문자를 구분해 `key.startsWith('on')`을 적용하고 결과가 `true`이면 event prop이다. 등록 가능한 DOM event 이름 목록과 대조하지 않으며 새 값의 타입도 분류 조건에 포함하지 않는다. 따라서 `onClick`, `onclick`, `once`는 각각 event prop이고 `OnClick`은 event prop이 아니다.

event prop의 이름은 앞 두 글자를 제거하고 전체 소문자로 바꾼다.

```text
onClick -> click
onInput -> input
once -> ce
```

DOM node에는 두 저장소를 둔다.

```js
domNode._aeuiHandlers[eventName]       // 최신 사용자 함수
domNode._aeuiProxyListeners[eventName] // 실제 addEventListener에 준 고정 proxy
```

새 값이 함수가 아니면 기존 proxy를 `removeEventListener`하고 두 저장소의 해당 entry를 삭제한다. 함수면 최신 handler 참조를 교체하고 proxy가 없을 때만 한 번 등록한다. 인라인 함수가 매 render 새로 만들어져도 실제 DOM listener를 반복 등록하지 않아야 한다.

proxy는 `state.dispatchDomEvent`가 함수면 그 bridge를 호출한다. 없으면 저장소의 최신 handler를 `handler.call(domNode, event)`로 직접 호출한다. 따라서 handler의 `this`는 DOM node다.

event handler 추가/교체/제거 branch는 `didMutate`를 true로 만들지 않는다. handler 동작은 바뀌지만 polling backoff의 DOM write로 세지 않는다.

## 13. value와 checked

### 13.1 `updateDomProps`의 value

다음 render의 input type은 props가 own `type` key를 가지면 `props.type`, 아니면 `domNode.type`에서 얻는다. 이를 `String(...).toLowerCase()`한 값이 `file`이고 대상 tagName이 `INPUT`이면 file-input value 특례다.

- file 특례: `value` attribute만 제거하고 property에는 쓰지 않는다. old/new value가 deep-equal이어도 이 branch를 실행한다.
- 나머지: nullish는 `''`, 그 외는 `String(newValue)`로 정규화해 `domNode.value`에 쓴다. nullish면 attribute를 제거하고, 그 외에는 같은 문자열을 value attribute에도 쓴다.

다음 type을 props에서 직접 읽으므로 `{ value, type: 'file' }`의 property 열거 순서와 무관하게 value 쓰기를 피한다. text에서 file로 바뀔 때 이전 value attribute도 제거해야 한다.

### 13.2 `syncHostControlledProps`

host tag와 input type은 두 DOM 갱신 경로에서 같은 case-insensitive 규칙으로 판정해야 한다.

```text
tag = String(node.tag).toLowerCase()
type = node.props가 own type을 가지면 node.props.type, 아니면 dom.type
isFileInput = tag === 'input' && String(type).toLowerCase() === 'file'

node.props가 own value를 가짐:
  tag가 select 또는 textarea이거나, tag가 input이고 isFileInput이 아님
  -> normalized String value와 dom.value가 다르면 property 갱신

tag가 input이고 own checked를 가짐:
  -> !!checked와 dom.checked가 다르면 property 갱신
```

정규화한 type이 `file`이면 `updateDomProps`와 `syncHostControlledProps` 모두 `value` property에 사용자 값을 쓰지 않는다. `file`, `FILE`, `File`처럼 대소문자만 다른 표기는 같은 결과를 내야 한다. 두 경로는 공통 helper 또는 의미상 동일한 단일 규칙을 사용해야 한다.

사용자가 input/textarea/select value나 checkbox checked를 직접 바꿔도 같은 props로 다음 reconcile하면 controlled 값으로 돌아온다. select value는 option children이 mount된 후 설정된다.

## 14. 적합성 요구사항

공식 적합성 suite는 다음 항목을 검증해야 한다.

- 배열 길이 증감, null/boolean 제거가 정확한 DOM 수를 만든다.
- keyed reorder/중간 삽입이 기존 DOM과 component state를 재사용한다.
- mixed keyed/unkeyed 목록이 key 우선 + unkeyed 순차 규칙을 따른다.
- duplicate key는 경고하지만 렌더를 중단하지 않는다.
- 순서가 이미 맞으면 `insertBefore`를 호출하지 않는다.
- host type 교체와 subtree 제거가 모든 component cleanup을 재귀 실행한다.
- mutable style 객체를 같은 참조로 수정해도 snapshot 비교로 반영한다.
- boolean `aria-*`는 `"true"`/`"false"` 문자열 attribute가 되며 임의 expando property를 만들지 않는다.
- event prop은 대소문자를 구분하는 `startsWith('on')` 규칙으로 분류하며 `once` 같은 key도 이 규칙에 따라 event branch로 들어간다.
- handler 교체는 proxy를 유지하고, 제거/비함수 전환은 listener를 해제하며, handler `this`는 DOM node다.
- select value는 option 뒤에 동기화되고 input/textarea value와 checked는 같은 props render에서 복구된다.
- file input에 value를 강제로 쓰지 않으며 text에서 file로 전환할 때 이전 value attribute가 남지 않는다. 이 계약은 type 대소문자와 무관하다.
- host child reconcile/controlled sync 실패와 fragment mount 실패는 local 정리로 삽입 DOM을 제거한다. host props snapshot 실패는 root-level `reconcileRoot` 경로가 미커밋 DOM을 정리한다. lower-level `reconcile` 직접 호출에는 이 정리가 없다.
