# 04. Reconciliation과 DOM

화면이 바뀌어야 할 때, AEUI는 **이전 화면**(old RuntimeNode)과 **새 화면**(new VNode)을 비교해서 **실제로 바뀐 부분의 DOM만** 수정한다. 이 과정을 **Reconciliation**이라 한다.

이 장은 그 알고리즘 — 어떤 노드를 재사용하고, 어떤 DOM을 추가/이동/제거하고, props를 어떻게 적용하는지를 설명한다.

---

## 1. 관련 모듈

| 모듈 | 역할 |
|---|---|
| `reconciler.js` | 노드 identity 판정, mount/update, children diff, DOM 배치, unmount |
| `node-factory.js` | 새 RuntimeNode shell 생성 |
| `component-lifecycle.js` | 컴포넌트 subtree render와 cleanup |
| `dom-host.js` | DOM 생성, prop diff, controlled property 동기화 |
| `vnode-helpers.js` | key와 Fragment 판별 |

**역할 분리:** reconciler는 "어떤 노드를 재사용할지" 결정하고, dom-host는 "DOM에 어떤 속성을 적용할지" 담당한다.

---

## 2. reconcile의 전체 흐름

```js
reconcile(state, parentDom, oldNode, newVNode, beforeDom, parentNode)
```

여기서 `newVNode`은 VNode뿐 아니라 원시값, 배열, null, boolean도 포함하는 **렌더 결과**를 뜻한다.

```
1. 새 값이 null 또는 boolean?
   → oldNode가 있으면 unmount → null 반환

2. oldNode가 있지만 타입이 다른가? (isSameNodeType = false)
   → oldNode를 unmount → oldNode = null

3. oldNode가 없는가?
   → 새 RuntimeNode 생성 → kind별 mount

4. oldNode가 있는가?
   → parent/parentDom 갱신 → kind별 update
```

> **null/boolean은 placeholder를 만들지 않는다.** 조건부로 사라진 자식은 실제로 제거되고, 나머지 unkeyed sibling은 순차 규칙으로 다시 매칭된다.

---

## 3. 노드 identity 판정 — "같은 노드인가?"

모든 kind에서 먼저 **key가 다르면 다른 노드**로 판정한다. key가 같을 때:

| 이전 kind | 같은 타입 조건 |
|---|---|
| `text` | 새 값이 비객체이거나 null |
| `fragment` | 새 값이 배열이거나 Fragment VNode |
| `host` | 새 값이 객체이고 `oldNode.tag === newVNode.tag` |
| `component` | 새 값이 객체, tag가 함수, Fragment 아님, `oldNode.component === newVNode.tag` |

**props는 identity에 관여하지 않는다.** 같은 HTML 태그 또는 같은 컴포넌트 함수 + 같은 key면 RuntimeNode를 재사용하고 props만 갱신한다.

---

## 4. DOM range — 노드가 차지하는 DOM 영역

모든 non-empty RuntimeNode는 `firstDom`과 `lastDom`으로 **parent DOM의 연속된 직접 자식 범위**를 나타낸다:

| kind | DOM range |
|---|---|
| text | TextNode 한 개 |
| host | Element 한 개 (내부 children은 포함 안 함) |
| fragment | 첫 child의 firstDom ~ 마지막 child의 lastDom |
| component | 렌더된 subtree의 range |
| root | root child의 range |

### `placeNode` — 노드를 올바른 위치로 이동

```
1. range가 비면 → 아무것도 안 함
2. range 끝의 nextSibling === beforeDom → 이미 올바른 위치, 아무것도 안 함
3. 아니면 → range의 각 DOM을 parentDom.insertBefore(dom, beforeDom)
```

이미 올바른 순서면 `insertBefore`를 호출하지 않는다.

---

## 5. children diff — 형제 노드의 비교와 재배치

`reconcileChildren(state, parentDom, parentNode, newVNodes, beforeDom)`

### 5.1 이전 children 인덱싱

```
각 old child에 _matched = false 설정
key가 있는 child → Map에 저장 (중복 key는 경고 후 무시)
```

중복 key 경고: `[AEUI] Duplicate key detected in sibling list: <key>`

### 5.2 새 children 매칭

```
keyed 새 값 → Map에서 같은 key의 old child 찾기
unkeyed 새 값 → old children에서 순서대로 미매칭 unkeyed child 찾기
```

**핵심 규칙:**
- keyed child는 위치와 무관하게 **key로** 찾는다
- unkeyed child는 **순차적으로** identity를 받는다
- keyed 위치는 unkeyed 순회에서 건너뛴다

### 5.3 제거와 재배치

1. 매칭되지 않은 old child를 **unmount**
2. 임시 `_matched` property 삭제
3. `nextChildren`을 **오른쪽에서 왼쪽**으로 순회하며 `placeNode`
4. `parentNode.children = nextChildren`으로 commit
5. fragment/root면 range 재계산

> **오른쪽→왼쪽 배치의 이유:** 각 child를 `anchor`(다음 child의 firstDom) 앞에 배치하면, keyed reorder 시 DOM node와 component state가 보존된다.

---

## 6. kind별 mount (새로 생성)

### text

```
document.createTextNode(value) → parentDom에 삽입
```

### host (HTML 요소)

```
1. createDomNode(vnode) → DOM 요소 생성
2. parentDom에 삽입
3. props snapshot 저장
4. children reconcile (host DOM 내부)
5. controlled props 동기화 (value, checked)
```

### fragment

자체 DOM 없음. parent DOM에 Fragment children을 직접 reconcile.

### component

`renderComponentNode`에 위임 — setup, render, subtree reconcile, range commit은 컴포넌트 생명주기가 담당.

---

## 7. kind별 update (재사용)

### text

새 값을 `String()`으로 만들어, 달라졌을 때만 `nodeValue` 갱신.

### host

```
1. updateDomProps(dom, newProps, 이전 snapshot)  ← props diff 먼저
2. vnode/key/tag 갱신
3. 새 props snapshot 저장
4. children reconcile
5. controlled props 동기화                       ← children 뒤에
```

> **순서가 중요:** props diff가 children보다 먼저이지만, controlled value(select의 value 등)의 최종 동기화는 option children이 mount된 후에 수행된다.

### fragment

vnode/key 갱신 → children reconcile → range 재계산.

### component

vnode/key/component 참조 갱신 → `renderComponentNode` 호출. 기존 renderFactory와 closure state는 identity가 같으면 유지.

---

## 8. unmount (제거)

`unmountNode(state, node, removeDom = true)`:

```
1. node가 없으면 return
2. node.isMounted = false
3. component면 cleanup 실행 (children/range는 보존)
4. 현재 children을 재귀 unmount (removeDom=false)
5. removeDom이면 node range를 DOM에서 제거
6. children = [], firstDom = lastDom = null
```

**부모 cleanup → 자식 cleanup** 순서 (전위 순회). 최상위 node만 DOM을 실제로 제거하고, 자식에는 `removeDom=false`를 전달한다.

---

## 9. 실패한 mount의 DOM 정리

### host mount 실패

DOM 요소가 이미 삽입된 후 children reconcile이나 controlled sync에서 throw하면:

```
→ node를 unmount (DOM 제거 없이)
→ host DOM이 아직 parent의 자식이면 removeChild
→ node.dom/firstDom/lastDom = null
→ 원래 오류 rethrow
```

### fragment mount 실패

mount 전의 sibling 위치를 기억해두고, 실패 시 그 이후에 새로 삽입된 DOM을 모두 제거한다.

---

## 10. DOM props 적용 알고리즘 (`updateDomProps`)

이전/새 props의 모든 key를 합쳐 순회하며, `deepEqual`로 변화를 감지한다.

### skip하는 key

`children`, `key`, `ref`, `__self`, `__source`

### props 적용 규칙

| 조건 | 동작 |
|---|---|
| `key.startsWith('on')` | 이벤트 핸들러 (§11 참고) |
| `className` | `domNode.className = value ?? ''` |
| `style` (객체) | `cssText=''` 후 `Object.assign(style, value)` |
| `style` (문자열) | `domNode.style.cssText = value` |
| `value` | file input 특례 또는 property+attribute 동기화 |
| `aria-*` | boolean은 문자열 attribute로, nullish는 제거 |
| boolean 값 | DOM property 설정 + true면 빈 attribute / false면 제거 |
| null/undefined | attribute 제거 (boolean property도 false로) |
| 나머지 | `setAttribute(key, value)` |

### class와 style 상세

- `className`은 DOM property로 직접 설정. `class`를 쓰면 일반 attribute로 처리됨 (별도 변환 없음)
- 객체 style은 `cssText`를 비운 후 assign → 빠진 style도 제거됨
- null style은 attribute 제거 branch로 처리

---

## 11. 이벤트 처리

`key.startsWith('on')` → 이벤트 prop. 대소문자 구분.

| 예시 | 이벤트 이름 |
|---|---|
| `onClick` | `click` |
| `onInput` | `input` |
| `once` | `ce` (앞 두 글자 제거 + 소문자) |

### 프록시 패턴

```js
domNode._aeuiHandlers[eventName]       // 최신 사용자 함수
domNode._aeuiProxyListeners[eventName] // addEventListener에 등록된 고정 proxy
```

**핵심:** 인라인 함수가 매 렌더마다 새로 만들어져도, 실제 DOM listener는 **한 번만** 등록한다. proxy가 항상 저장소의 **최신 핸들러**를 조회해 호출하기 때문이다.

- 새 값이 함수 → 핸들러 저장소 교체 (proxy는 유지)
- 새 값이 함수가 아님 → proxy를 `removeEventListener`하고 저장소 삭제
- handler의 `this`는 DOM node

> **이벤트 핸들러 변경은 `didMutate`를 true로 만들지 않는다.** DOM write가 아니므로 polling backoff에 영향을 주지 않는다.

---

## 12. controlled input: value와 checked

### `updateDomProps`의 value 처리

input type이 `file`이면(**대소문자 무시** — `String(type).toLowerCase() === 'file'`):
- `value` **attribute만** 제거, property에는 쓰지 않음 (보안)

그 외:
- nullish → `''`, 아니면 `String(value)` → `domNode.value`에 설정
- attribute도 동기화

### `syncHostControlledProps` — children 뒤에 실행

```
input/textarea/select의 value → props의 값으로 복구
input의 checked → props의 값으로 복구
```

value 복구에서 input type이 `file`이면(**대소문자 무시** — `props.type !== 'file'` 비교가 아니라 대소문자 무시 비교) controlled sync를 건너뛴다.

**왜 children 뒤에?** `<select>`의 value는 `<option>` children이 mount된 후에야 올바르게 설정할 수 있기 때문이다.

사용자가 input 값을 직접 바꿔도, 같은 props로 다음 reconcile하면 **controlled 값으로 돌아온다**.

---

## 13. 검증 요약

- 배열 길이 증감, null/boolean 제거가 정확한 DOM 수를 만듦
- keyed reorder가 기존 DOM과 component state를 재사용
- duplicate key는 경고하지만 렌더를 중단하지 않음
- 순서가 맞으면 `insertBefore`를 호출하지 않음
- mutable style 객체를 같은 참조로 수정해도 snapshot 비교로 감지
- `aria-*` boolean은 `"true"`/`"false"` 문자열 attribute
- event handler 교체는 proxy 유지, 제거는 listener 해제
- select value는 option 뒤에 동기화
- file input에 value를 강제로 쓰지 않음
- file input의 type 판정은 `updateDomProps`와 `syncHostControlledProps` 두 경로 모두 대소문자를 무시
- 실패한 host mount의 DOM은 host 요소를 직접 제거. 실패한 fragment mount는 mount 전 sibling 이후에 삽입된 DOM을 제거. 직접 `reconcile` 경로에서 host props snapshot(`cloneHostPropsSnapshot`)은 `try` 밖에서 실행되므로 이 단계에서 실패하면 DOM이 남을 수 있고, root 경로(`reconcileRoot`)에서는 별도 정리가 미커밋 DOM을 제거한다
