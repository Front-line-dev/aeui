# Reconciliation — `reconciler.js`

## 개요

`reconciler.js`는 **old RuntimeNode + new VNode**를 비교해 DOM range를 재사용, 이동, 제거하는 엔진이다.

이번 구조에서는 책임이 다음처럼 분리된다.

- `node-factory.js`: 새 RuntimeNode shell 생성
- `component-lifecycle.js`: component setup/render/cleanup orchestration
- `dom-host.js`: DOM 생성과 prop patching
- `reconciler.js`: tree diff, placement, unmount

즉, reconciler는 더 이상 component setup이나 DOM prop patching의 세부 구현을 직접 들고 있지 않는다.

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
1. newVNode가 null/boolean이면 oldNode를 unmount하고 null 반환
2. oldNode와 newVNode 타입이 다르면 oldNode를 unmount하고 새로 시작
3. oldNode가 없으면 createNode() + mount
4. oldNode가 있으면 kind별 update
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

## 형제 diff — `reconcileChildren`

형제 목록은 RuntimeNode 기준으로 diff한다.

```text
1. 이전 children을 keyed / unkeyed로 분리
2. 새 VNode를 순회하며 key 우선, 없으면 순서 fallback으로 매칭
3. 매칭 결과를 다시 reconcile(...)
4. 매칭되지 않은 old child는 unmount
5. 오른쪽에서 왼쪽으로 DOM range를 재배치
```

### key 규칙

- key가 있으면 sibling 범위에서 key가 최우선 식별자다.
- key 중복은 `console.warn`으로 경고하고 best-effort로 진행한다.

### 재배치 규칙

`placeNode()`는 node가 소유한 `firstDom..lastDom` range를 `beforeDom` 앞으로 옮긴다.

이미 올바른 위치에 있으면 이동하지 않는다.

---

## unmount

`unmountNode(state, node, removeDom = true)`는 다음 순서로 작동한다.

1. `node.isMounted = false`
2. component면 `cleanupComponentNode()` 호출
3. 자식 subtree 재귀 unmount
4. 필요 시 DOM range 제거
5. children / DOM range bookkeeping 비우기

cleanup과 DOM 제거 규칙이 한곳에 모여 있기 때문에, type mismatch 교체와 `null` 렌더링이 같은 정리 경로를 공유한다.

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
