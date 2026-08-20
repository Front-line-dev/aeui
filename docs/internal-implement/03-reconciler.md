# 03. Reconciliation — `reconciler.js`

## 개요

`reconciler.js`는 **old RuntimeNode + new VNode**를 비교해 DOM range를 재사용, 이동, 제거하는 엔진이다.

이번 구조에서는 책임이 다음처럼 분리된다.

- `node-factory.js`: 새 RuntimeNode shell 생성
- `component-lifecycle.js`: component setup/render/cleanup orchestration
- `dom-host.js`: DOM 생성과 prop patching
- `reconciler.js`: tree diff, placement, unmount

즉, reconciler는 더 이상 component setup이나 DOM prop patching의 세부 구현을 직접 들고 있지 않는다.

---

## 관련 모듈

| 모듈 | 역할 |
|---|---|
| `vnode-marker.js` | VNode 식별용 전역 Symbol |
| `vnode-helpers.js` | key 추출, Fragment 판별 |
| `node-factory.js` | VNode → RuntimeNode 분류/생성 |
| `reconciler.js` | 노드 비교, mount/update/unmount, children diff |
| `dom-host.js` | DOM 생성, props diff |

---

## 함수 시그니처

내부 엔진은 상태 객체를 첫 인자로 받는다.

```javascript
reconcile(state, parentDom, oldNode, newVNode, beforeDom, parentNode)
```

실제 실행에서는 `app-runtime.js`가 runtime state를 바인딩해 `state.reconcile(...)`로 연결하고, 테스트나 compiler-private 경로에서만 `AEUI.__runtime.reconcile(...)`를 사용한다.

| 파라미터 | 설명 |
|----------|------|
| `state` | runtime state |
| `parentDom` | DOM 부모 요소 |
| `oldNode` | 이전 RuntimeNode |
| `newVNode` | 이번 render 결과 |
| `beforeDom` | 삽입 anchor |
| `parentNode` | 부모 RuntimeNode |

---

## 핵심 처리 흐름

```text
reconcile(state, parentDom, oldNode, newVNode, beforeDom, parentNode)
  
  1. 새 값이 null/boolean? → oldNode unmount → null 반환
  2. oldNode 있는데 타입이 다르면? → oldNode unmount → oldNode = null
  3. oldNode 없음? → 새 RuntimeNode 생성 → kind별 mount
  4. oldNode 있음? → kind별 update
```

구현상 분기는 다음과 같다.

```javascript
if (!oldNode) {
  const node = state.createNode(newVNode, parentNode, parentDom);
  return mountNode(state, parentDom, node, beforeDom);
}

switch (oldNode.kind) {
  case 'text':
    return updateTextNode(state, oldNode, newVNode);
  case 'host':
    return updateHostNode(state, oldNode, newVNode);
  case 'fragment':
    return updateFragmentNode(state, parentDom, oldNode, newVNode, beforeDom);
  case 'component':
    return updateComponentNode(state, parentDom, oldNode, newVNode, beforeDom);
}
```

---

## createNode — VNode에서 RuntimeNode로

`createNode(state, vnode, parentNode, parentDom)`는 렌더 결과를 다음 규칙으로 **분류만** 한다 (컴포넌트 함수를 호출하지는 않음):

| 입력 | RuntimeNode kind |
|---|---|
| `null` 또는 boolean | → `null` (표시 안 함) |
| 비객체 (문자열, 숫자, bigint) | → `text` |
| 배열 또는 Fragment VNode | → `fragment` |
| `tag`가 문자열인 객체 | → `host` (HTML 요소) |
| 그 외 객체 | → `component` |

text는 `String(vnode)`으로 즉시 변환한다. 엄격한 VNode 검증은 하지 않으므로, 마커 없는 `{ tag: 'div', props: {} }`도 host로 처리된다.

---

## 노드 identity 판정 — "같은 노드인가?"

모든 kind에서 **key가 다르면 다른 노드**로 판정. key가 같을 때:

| 이전 kind | 같은 타입 조건 |
|---|---|
| `text` | 새 값이 비객체 |
| `fragment` | 새 값이 배열이거나 Fragment VNode |
| `host` | `oldNode.tag === newVNode.tag` |
| `component` | `oldNode.component === newVNode.tag` (같은 함수 참조) |

**props는 identity에 관여하지 않는다.** 같은 tag/component + 같은 key면 RuntimeNode를 재사용하고 props만 갱신한다.

---

## mount 단계

### text

- `TextNode` 생성
- `firstDom` / `lastDom`를 같은 노드로 설정

### host

- `dom-host.js:createDomNode()`로 DOM 생성
- `cloneHostPropsSnapshot()`으로 props snapshot 저장
- 자식은 `reconcileChildren()`으로 재귀 mount
- 마지막에 `syncHostControlledProps()`로 `value/checked`를 다시 맞춤

### fragment

- 자체 DOM 없이 자식 목록만 mount
- 자식의 DOM range로 `firstDom` / `lastDom` 계산

### component

- `component-lifecycle.js:renderComponentNode()`에 위임
- 이 함수가 setup, render, subtree reconcile, bookkeeping을 한 번에 처리

---

## update 단계

### text

- 기존 `TextNode`를 재사용
- 값이 바뀌면 `nodeValue`만 갱신

### host

- DOM 요소 재사용
- `dom-host.js:updateDomProps()`로 prop diff
- 자식 subtree는 `reconcileChildren()`으로 재귀 diff
- `syncHostControlledProps()`로 controlled prop 복구

### fragment

- 자식 목록만 재귀 diff
- 자식 기준으로 DOM range 재계산

### component

- `vnode`, `key`, `component` 참조 갱신
- 실제 렌더는 다시 `renderComponentNode()`로 위임
- setup은 재실행하지 않고 저장된 `renderFactory`를 사용

---

## DOM Range

모든 non-empty RuntimeNode는 `firstDom`~`lastDom`으로 parent DOM의 연속된 직접 자식 범위를 나타낸다.

| kind | DOM range |
|---|---|
| text | TextNode 1개 |
| host | Element 1개 |
| fragment | 첫 child.firstDom ~ 마지막 child.lastDom |
| component | 렌더된 subtree의 range |

### placeNode — 위치 이동

```
1. range가 비면 → 아무것도 안 함
2. range 끝의 nextSibling === beforeDom → 이미 올바른 위치
3. 아니면 → range의 각 DOM을 parentDom.insertBefore(dom, beforeDom)
```

이미 올바른 순서면 `insertBefore`를 호출하지 않는다 (불필요한 DOM 조작 방지).

---

## 형제 diff — `reconcileChildren`

형제 목록은 RuntimeNode 기준으로 diff한다.

### 1. 인덱싱

```
각 old child에 _matched = false 설정
key 있는 child → Map에 저장 (중복 key 경고)
```

### 2. 매칭

```
keyed 새 값 → Map에서 같은 key의 old child 찾기
unkeyed 새 값 → old children에서 순서대로 미매칭 unkeyed child 찾기
```

**핵심:** keyed child는 위치 무관하게 key로 찾고, unkeyed child는 순차적으로 매칭한다.

### 3. 제거와 재배치

1. 매칭 안 된 old child를 unmount
2. `_matched` property 삭제
3. `nextChildren`을 **오른쪽에서 왼쪽**으로 순회하며 `placeNode`
4. `parentNode.children = nextChildren`

**오른쪽→왼쪽 배치 이유:** 각 child를 `anchor`(다음 child의 firstDom) 앞에 배치하면, keyed reorder 시 DOM node와 component state가 보존된다.

### key 규칙

- key가 있으면 sibling 범위에서 key가 최우선 식별자다.
- key 중복은 `console.warn`으로 경고하고 best-effort로 진행한다.

---

## 실패한 Mount의 DOM 정리

### Host mount 실패

DOM 요소 삽입 후 children reconcile에서 throw하면:
- node를 unmount (DOM 제거 없이)
- host DOM이 parent 자식이면 `removeChild`
- `node.dom/firstDom/lastDom = null`
- 원래 오류 rethrow

### Fragment mount 실패

mount 전 sibling 위치를 기억해두고, 실패 시 새로 삽입된 DOM을 제거한다.

mount 중 자식 reconcile이나 component setup/render에서 에러가 나면, 이미 삽입된 host/fragment DOM은 해당 mount 경계에서 제거한다. 실패한 subtree가 RuntimeNode tree에 커밋되지 않은 상태로 DOM에 남으면 다음 렌더에서 중복 삽입될 수 있기 때문이다.

---

## host controlled props

`value` / `checked` 같은 controlled prop은 `dom-host.js`로 분리됐다.

특히:

- `<select>` value는 option children이 모두 렌더된 뒤 다시 맞춘다.
- `<input type="file">` value는 DOM property에 직접 쓰지 않는다.
- DOM 이벤트 등록과 proxy listener 생성도 `dom-host.js`가 담당한다.

즉 reconciler는 이제 "무엇을 바꾸는가"만 결정하고, "DOM에 어떻게 쓰는가"는 host 계층에 위임한다.

---

## 관련 코드 위치

- `packages/core/src/reconciler.js`
- `packages/core/src/node-factory.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/dom-host.js`
- `packages/core/src/vnode-helpers.js`

## 관련 문서

- VNode 생성: [02. VNode 생성](02-vdom.md)
- DOM 조작: [08. DOM 조작](08-dom.md)
- Unmount 상세: [09. Unmount](09-unmount.md)
- RuntimeNode 구조: [04. RuntimeNode 관리](04-instance.md)
