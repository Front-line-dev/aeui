# Reconciliation — `_reconcile`

## 개요

`_reconcile`은 AEUI의 핵심 알고리즘으로, **이전 RuntimeNode와 새 VNode을 비교하여 실제 DOM에 최소한의 변경만 적용**한다.

매 tick마다 컴포넌트의 렌더 함수가 실행되면 **새로운 VNode**이 생성된다. `_reconcile`은 이 새 VNode을 이전 tick에서 보관해둔 RuntimeNode와 비교하여, node를 재사용하거나 교체하고, 실제로 변경된 부분만 DOM에 반영한다.

```text
tick N에서 저장된 RuntimeNode  →  ─┐
                                   ├── _reconcile이 비교 → 차이점만 DOM에 적용
tick N+1에서 생성된 VNode      →  ─┘
```

핵심 비교 단위는 **old RuntimeNode + new VNode**이다.

component setup/render/cleanup 세부 실행은 `component-lifecycle.js` helper가 담당한다. 따라서 이 문서의 중심은 "RuntimeNode 재사용과 DOM 반영"이며, 컴포넌트 실행 자체는 별도 계층으로 다룬다.

---

## 함수 시그니처

```javascript
_reconcile(parentDom, oldNode, newVNode, beforeDom, parentNode)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `parentDom` | `HTMLElement` | 이 node가 렌더링될 DOM 부모 요소. 예: `<div id="root">` |
| `oldNode` | `RuntimeNode \| null` | 이전 tick에서 보관된 RuntimeNode. 최초 마운트 시 `null` |
| `newVNode` | `VNode \| Array \| string \| number \| null` | 이번 tick에서 렌더 함수가 반환한 새 결과 |
| `beforeDom` | `Node \| null` | 삽입 위치를 나타내는 DOM anchor. `null`이면 부모의 맨 끝에 배치 |
| `parentNode` | `RuntimeNode \| null` | 부모 RuntimeNode. 새로 생성되는 node의 `parent`가 된다 |

### 반환값

업데이트되거나 새로 생성된 RuntimeNode를 반환한다. `newVNode`이 `null`/`boolean`이면 `null`을 반환한다.

---

## 핵심 처리 흐름

`_reconcile`은 3단계 분기로 동작한다:

```text
1. newVNode이 null/boolean?
   → oldNode를 unmount하고 null 반환

2. oldNode의 kind/key/tag와 newVNode이 호환되는가? (isSameNodeType)
   → 호환 안 되면 oldNode를 unmount하고 oldNode = null로 리셋

3. oldNode가 있는가?
   ├── 없다 (null) → 새 node 생성 (createNode) + 마운트 (mountNode)
   └── 있다        → 기존 node 업데이트 (updateXxxNode)
```

### 코드

```javascript
export function _reconcile(parentDom, oldNode, newVNode, beforeDom = null, parentNode = null) {
  if (newVNode == null || typeof newVNode === 'boolean') {
    if (oldNode) {
      this._unmountNode(oldNode);
    }
    return null;
  }

  if (oldNode && !isSameNodeType(this, oldNode, newVNode)) {
    this._unmountNode(oldNode);
    oldNode = null;
  }

  if (!oldNode) {
    const node = this.createNode(newVNode, parentNode, parentDom);
    return mountNode.call(this, parentDom, node, beforeDom);
  }

  oldNode.parent = parentNode;
  oldNode.parentDom = parentDom;

  switch (oldNode.kind) {
    case 'text':
      return updateTextNode.call(this, oldNode, newVNode);
    case 'host':
      return updateHostNode.call(this, oldNode, newVNode);
    case 'fragment':
      return updateFragmentNode.call(this, parentDom, oldNode, newVNode, beforeDom);
    case 'component':
      return updateComponentNode.call(this, parentDom, oldNode, newVNode, beforeDom);
    default:
      return oldNode;
  }
}
```

---

## `isSameNodeType` — 타입 호환 판단

old RuntimeNode와 new VNode이 같은 종류인지 판별한다. 호환되면 기존 node를 재사용하고, 호환되지 않으면 old node를 unmount하고 새로 만든다.

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
      return !!newVNode && typeof newVNode === 'object' && typeof newVNode.tag === 'function'
        && newVNode.tag !== AEUI.Fragment
        && oldNode.component === newVNode.tag;
    default:
      return false;
  }
}
```

`key` 비교가 먼저 수행되므로, key가 있는 형제 목록에서 node 식별 기준이 항상 우선된다. key/fragment 판별 로직은 `vnode-helpers.js`가 제공하며, `runtime.js`와 `reconciler.js`가 같은 규칙을 공유한다.

---

## Node별 마운트/업데이트

### mountNode — 새 node를 DOM에 삽입

```text
mountNode(parentDom, node, beforeDom):
  switch node.kind:
    text      → TextNode 생성, insertBefore로 삽입
    host      → HTMLElement 생성, props 설정, insertBefore로 삽입, children 재귀 reconcile
    fragment  → children 재귀 reconcile (DOM 요소 생성 없음)
    component → setup helper 실행, render 결과를 재귀 reconcile
```

#### mountHostNode

```javascript
function mountHostNode(parentDom, node, beforeDom) {
  const dom = this._createDomNode(node.vnode);
  parentDom.insertBefore(dom, beforeDom);
  node.dom = dom;
  node.props = cloneHostPropsSnapshot(this, node.vnode.props || {});
  node.firstDom = dom;
  node.lastDom = dom;
  this._didMutate = true;

  reconcileChildren.call(this, dom, node, node.vnode.children || [], null);
  syncHostControlledProps.call(this, node);
  node.firstDom = dom;
  node.lastDom = dom;
  return node;
}
```

#### mountComponentNode

```javascript
function mountComponentNode(parentDom, node, beforeDom) {
  setupComponentNode(this, node);
  const renderedVNode = invokeComponentRenderFactory(this, node, node.vnode.props || {});
  const renderedNode = this._reconcile(parentDom, null, renderedVNode, beforeDom, node);
  commitRenderedNode(node, renderedNode);
  return node;
}
```

watcher 실행과 props 동기화는 `reconciler`가 직접 수행하지 않는다. Babel 플러그인이 만든 render wrapper는 `AEUI._runRenderPhase()`를 호출하고, render phase 내부에서 `component-lifecycle.js`가 props 동기화와 watcher 실행 순서를 관리한다.

### updateXxxNode — 기존 node 갱신

#### updateTextNode

```javascript
function updateTextNode(node, newVNode) {
  const nextValue = String(newVNode);
  node.vnode = newVNode;
  node.key = null;

  if (node.value !== nextValue) {
    node.value = nextValue;
    node.dom.nodeValue = nextValue;
    this._didMutate = true;
  }

  node.firstDom = node.dom;
  node.lastDom = node.dom;
  return node;
}
```

text node는 기존 `TextNode`를 재사용하고, `nodeValue`만 갱신한다.

#### updateHostNode

```javascript
function updateHostNode(node, newVNode) {
  this._updateDomProps(node.dom, newVNode.props, node.props || {});
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  node.tag = newVNode.tag;
  node.props = cloneHostPropsSnapshot(this, newVNode.props || {});
  reconcileChildren.call(this, node.dom, node, newVNode.children || [], null);
  syncHostControlledProps.call(this, node);
  node.firstDom = node.dom;
  node.lastDom = node.dom;
  return node;
}
```

같은 태그의 host node는 DOM 요소를 재사용한다. `_updateDomProps`로 변경된 속성만 업데이트하고, children을 `reconcileChildren`으로 재귀적으로 diff한다.

#### updateComponentNode

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

같은 컴포넌트 함수 + 같은 key면 node를 재사용한다. setup은 재실행하지 않고 render factory만 다시 호출하므로, 컴포넌트의 **로컬 상태가 보존**된다.

#### updateFragmentNode

```javascript
function updateFragmentNode(parentDom, node, newVNode, beforeDom) {
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  reconcileChildren.call(this, parentDom, node, getFragmentChildren(this, newVNode), beforeDom);
  updateRangeFromChildren(node);
  return node;
}
```

fragment는 DOM 요소 없이 child list만 diff하고, `firstDom`/`lastDom`을 자식으로부터 재계산한다.

---

## Child Diff — `reconcileChildren`

형제 목록의 diff는 RuntimeNode 배열 기준으로 통일된다. key 기반 매칭과 순서 기반 fallback을 결합한다.

### 알고리즘

```text
1. 이전 children 배열(oldChildren)에서:
   - keyed child → Map에 등록
   - unkeyed child → 순서 기반 매칭 대기

2. 새 VNode 목록(newVNodes)을 순회:
   각 newVNode에 대해:
   ├── key가 있으면 → keyedOld Map에서 매칭
   ├── key가 없으면 → 남은 unkeyed old child를 순서대로 매칭
   └── 매칭된 old child가 있으면 재사용, 없으면 새로 생성
   → _reconcile(parentDom, matchedChild, newVNode, ...) 호출
   → 결과를 nextChildren에 추가

3. 매칭되지 않은 old children → _unmountNode로 제거

4. DOM 재배치:
   오른쪽에서 왼쪽으로 순회하며, 각 child의 firstDom..lastDom 범위를
   beforeDom anchor 앞으로 insertBefore
   (이미 올바른 위치에 있으면 이동하지 않음)

5. parentNode.children = nextChildren
   range 업데이트 (fragment/root인 경우)
```

### Duplicate key 처리

같은 부모 내에 동일한 key가 중복되면 `console.warn`을 출력한다. 첫 번째 매칭이 우선이며, 렌더링은 best-effort로 계속 진행한다.

### DOM 재배치 최적화

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

`lastNode.nextSibling === beforeDom` 체크로, 이미 올바른 위치에 있는 node는 `insertBefore`를 호출하지 않는다.

---

## `beforeDom` — 삽입 위치 anchor

`beforeDom`은 삽입 위치를 나타내는 실제 DOM anchor이다.

- `null`이면 부모의 맨 끝에 배치
- 특정 DOM node이면 그 노드 바로 앞에 배치

comment anchor는 사용하지 않는다. 빈 fragment나 빈 subtree는 `firstDom = lastDom = null`이며, 다음 sibling의 `firstDom` 또는 부모의 trailing anchor를 기준으로 새 range를 삽입한다.

---

## host controlled props — `syncHostControlledProps`

`syncHostControlledProps`는 host node의 children reconcile이 끝난 후 호출되어, DOM이 사용자 입력 등으로 바뀌었더라도 controlled prop 상태를 다시 맞춘다.

- `<select>`, `<textarea>`, `<input type!="file">`의 `value`
- `<input>`의 `checked`

특히 `<select>`의 `value`는 option children이 모두 마운트된 뒤 다시 설정해야 올바르게 동작한다.

```javascript
function syncHostControlledProps(node) {
  if (!node || node.kind !== 'host' || !node.dom || !node.props) return;

  if (Object.prototype.hasOwnProperty.call(node.props, 'value')) {
    const normalizedValue = node.props.value == null ? '' : String(node.props.value);

    if (
      node.tag === 'select' ||
      node.tag === 'textarea' ||
      (node.tag === 'input' && node.props.type !== 'file')
    ) {
      if (node.dom.value !== normalizedValue) {
        node.dom.value = normalizedValue;
        this._didMutate = true;
      }
    }
  }

  if (node.tag === 'input' && Object.prototype.hasOwnProperty.call(node.props, 'checked')) {
    const normalizedChecked = !!node.props.checked;
    if (node.dom.checked !== normalizedChecked) {
      node.dom.checked = normalizedChecked;
      this._didMutate = true;
    }
  }
}
```

또한 `_updateDomProps` 단계에서도 `<input type="file">`의 `value`는 DOM property에 직접 쓰지 않는다. 브라우저가 file input value의 programmatic set을 제한하기 때문에, `value` attribute를 제거하는 방식으로 예외를 피한다.

---

## 관련 코드 위치

- `packages/core/src/reconciler.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/vnode-helpers.js`
