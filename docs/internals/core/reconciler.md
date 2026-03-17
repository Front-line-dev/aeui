# Reconciliation — `_reconcile`

## 개요

현재 `reconciler.js`는 AEUI 코어에서 **DOM diff와 RuntimeNode 연결**만 담당한다. 컴포넌트의 setup, render phase, cleanup 자체는 여기서 직접 구현하지 않고 `component-lifecycle.js`에 위임한다.

이번 구조 단순화 이후 책임 분리는 다음과 같다.

- `runtime.js`: scheduler와 root reconcile 진입점
- `reconciler.js`: node type 판별, child diff, DOM 배치, host/text/fragment 업데이트
- `component-lifecycle.js`: component node setup, render phase 진입, cleanup
- `vnode-helpers.js`: key / fragment 관련 공통 판별

즉, `_reconcile`은 "무엇을 재사용할지"와 "DOM을 어떻게 바꿀지"에 집중하고, 컴포넌트 실행 자체는 별도 계층으로 분리되었다.

---

## 함수 시그니처

```javascript
_reconcile(parentDom, oldNode, newVNode, beforeDom, parentNode)
```

| 파라미터 | 설명 |
|----------|------|
| `parentDom` | 실제 DOM 부모 |
| `oldNode` | 이전 RuntimeNode |
| `newVNode` | 이번 render phase가 만든 새 VNode |
| `beforeDom` | 삽입 anchor DOM |
| `parentNode` | 부모 RuntimeNode |

반환값은 새 상태를 반영한 RuntimeNode 또는 `null`이다.

---

## 핵심 처리 흐름

```text
1. newVNode가 null/boolean이면 oldNode를 unmount하고 종료
2. oldNode와 newVNode가 호환되지 않으면 oldNode를 unmount
3. oldNode가 없으면 createNode + mount
4. oldNode가 있으면 kind별 update
```

호환성 판단은 `isSameNodeType()`이 담당하고, key 비교가 항상 먼저 수행된다.

```javascript
function isSameNodeType(AEUI, oldNode, newVNode) {
  if (!oldNode) return false;
  if (oldNode.key !== getVNodeKey(newVNode)) return false;

  switch (oldNode.kind) {
    case 'text':
      return typeof newVNode !== 'object' || newVNode == null;
    case 'fragment':
      return isFragmentVNode(AEUI, newVNode);
    case 'host':
      return !!newVNode && typeof newVNode === 'object' && !Array.isArray(newVNode)
        && oldNode.tag === newVNode.tag;
    case 'component':
      return !!newVNode && typeof newVNode === 'object'
        && typeof newVNode.tag === 'function'
        && newVNode.tag !== AEUI.Fragment
        && oldNode.component === newVNode.tag;
    default:
      return false;
  }
}
```

---

## Component 처리의 단순화

이전에는 reconciler가 직접 `currentComponentNode`를 세팅하고 render를 호출하는 흐름을 더 많이 알고 있었다. 지금은 다음 두 단계만 수행한다.

### 마운트

```javascript
function mountComponentNode(parentDom, node, beforeDom) {
  setupComponentNode(this, node);
  const renderedVNode = invokeComponentRenderFactory(this, node, node.vnode.props || {});
  const renderedNode = this._reconcile(parentDom, null, renderedVNode, beforeDom, node);
  commitRenderedNode(node, renderedNode);
  return node;
}
```

### 업데이트

```javascript
function updateComponentNode(parentDom, node, newVNode, beforeDom) {
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  node.component = newVNode.tag;

  const renderedVNode = invokeComponentRenderFactory(this, node, newVNode.props || {});
  const renderedNode = this._reconcile(
    parentDom,
    node.renderedNode,
    renderedVNode,
    beforeDom,
    node
  );

  commitRenderedNode(node, renderedNode);
  return node;
}
```

여기서 watcher 실행, props 동기화, current component context 진입은 `renderFactory` 내부의 `AEUI._runRenderPhase(...)`와 `component-lifecycle.js`가 처리한다. 그래서 reconciler는 subtree 연결만 알면 된다.

---

## Child Diff

형제 목록 diff는 `reconcileChildren()` 하나로 통일된다.

```text
1. 이전 children에서 keyed child를 Map으로 수집
2. 새 VNode 목록을 순회하며 key 우선 매칭
3. key가 없으면 남은 old child를 순서 기반으로 매칭
4. 각 항목에 대해 _reconcile(...) 실행
5. 매칭 실패한 old child는 _unmountNode()
6. nextChildren을 오른쪽에서 왼쪽으로 재배치
```

핵심 helper:

- `getVNodeKey(vnode)`
- `isFragmentVNode(FragmentLike, vnode)`
- `getFragmentChildren(FragmentLike, vnode)`

이 helper들은 `runtime.js`와 `reconciler.js`에서 공용으로 사용되므로 fragment/key semantics가 한 곳으로 모였다.

---

## DOM 배치

DOM 재배치는 `placeNode()`가 담당한다. node의 `firstDom..lastDom` 범위를 찾아서 필요한 경우에만 이동한다.

```javascript
function placeNode(parentDom, node, beforeDom) {
  const nodes = getDomNodesInRange(parentDom, node);
  if (nodes.length === 0) return;

  const lastNode = nodes[nodes.length - 1];
  if (lastNode.nextSibling === beforeDom) return;

  nodes.forEach((domNode) => {
    parentDom.insertBefore(domNode, beforeDom);
  });
  this._didMutate = true;
}
```

이미 올바른 위치면 skip하므로, keyed reorder에서도 불필요한 DOM write를 줄인다.

---

## Host Controlled Props

host node는 children reconcile 후 `syncHostControlledProps()`로 `value`/`checked`를 다시 맞춘다.

- `select.value`
- `textarea.value`
- `input[type!="file"].value`
- `input.checked`

`input[type="file"]`은 브라우저 제약 때문에 `value` property를 강제로 쓰지 않는다. 대신 value attribute를 제거하고 DOM 예외를 피한다.

```javascript
if (node.tag === 'input' && node.props.type === 'file') {
  node.dom.removeAttribute('value');
  this._didMutate = true;
}
```

이 예외를 두지 않으면 file input에 프로그램적으로 값을 쓰는 과정에서 브라우저 에러가 날 수 있다.

---

## Unmount

component unmount도 reconciler가 cleanup 세부 사항을 직접 다루지 않는다.

```javascript
cleanupComponentNode(this, node, {
  preserveChildren: true,
  preserveDomRange: true,
});
```

그 뒤 실제 child subtree 제거와 DOM range 제거는 `_unmountNode()`가 계속 담당한다. 즉 "component 내부 정리"와 "subtree/DOM 제거"가 분리되었다.

---

## 관련 코드 위치

- `packages/core/src/reconciler.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/vnode-helpers.js`
