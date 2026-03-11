# Reconciliation — `_reconcile`

## 개요

`_reconcile`은 AEUI의 핵심 알고리즘으로, **이전 RuntimeNode와 새 VNode을 비교하여 실제 DOM에 최소한의 변경만 적용**한다.

매 tick마다 컴포넌트의 렌더 함수가 실행되면 **새로운 VNode**이 생성된다. `_reconcile`은 이 새 VNode을 이전 tick에서 보관해둔 RuntimeNode와 비교하여, node를 재사용하거나 교체하고, 실제로 변경된 부분만 DOM에 반영한다.

```
tick N에서 저장된 RuntimeNode  →  ─┐
                                   ├── _reconcile이 비교 → 차이점만 DOM에 적용
tick N+1에서 생성된 VNode      →  ─┘
```

이전 모델에서는 `prevVNode + index`로 비교했지만, 현재 모델의 핵심 비교 단위는 **old RuntimeNode + new VNode**이다.

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

```
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
  // 1. null/boolean → 제거
  if (newVNode == null || typeof newVNode === 'boolean') {
    if (oldNode) {
      this._unmountNode(oldNode);
    }
    return null;
  }

  // 2. 타입 호환 체크
  if (oldNode && !isSameNodeType(this, oldNode, newVNode)) {
    this._unmountNode(oldNode);
    oldNode = null;
  }

  // 3-a. 새로 마운트
  if (!oldNode) {
    const node = this.createNode(newVNode, parentNode, parentDom);
    return mountNode.call(this, parentDom, node, beforeDom);
  }

  // 3-b. 기존 node 업데이트
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
  if (oldNode.key !== getVNodeKey(newVNode)) return false;  // key가 다르면 불일치

  switch (oldNode.kind) {
    case 'text':
      return typeof newVNode !== 'object' || newVNode == null;
    case 'fragment':
      return isFragmentVNode(AEUI, newVNode);
    case 'host':
      return !!newVNode && typeof newVNode === 'object' && !Array.isArray(newVNode)
        && oldNode.tag === newVNode.tag;                     // 같은 HTML 태그
    case 'component':
      return !!newVNode && typeof newVNode === 'object' && typeof newVNode.tag === 'function'
        && newVNode.tag !== AEUI.Fragment
        && oldNode.component === newVNode.tag;               // 같은 컴포넌트 함수
    default:
      return false;
  }
}
```

**key 비교가 먼저**: key가 다르면 나머지 비교 없이 즉시 불일치로 판단한다. 이를 통해 key가 있는 형제 목록에서 노드를 정확히 식별할 수 있다.

---

## Node별 마운트/업데이트

### mountNode — 새 node를 DOM에 삽입

```
mountNode(parentDom, node, beforeDom):
  switch node.kind:
    text     → TextNode 생성, insertBefore로 삽입
    host     → HTMLElement 생성, props 설정, insertBefore로 삽입, children 재귀 reconcile
    fragment → children 재귀 reconcile (DOM 요소 생성 없음)
    component → setup 후 render 실행, renderedNode 재귀 reconcile
```

#### mountHostNode

```javascript
function mountHostNode(parentDom, node, beforeDom) {
  const dom = this._createDomNode(node.vnode);      // DOM 요소 생성
  parentDom.insertBefore(dom, beforeDom);            // DOM에 삽입
  node.dom = dom;
  node.props = node.vnode.props || {};
  node.firstDom = dom;
  node.lastDom = dom;
  this._didMutate = true;

  // children 재귀 처리
  reconcileChildren.call(this, dom, node, node.vnode.children || [], null);
  syncHostControlledProps(node);                     // select value 동기화 등
  node.firstDom = dom;
  node.lastDom = dom;
  return node;
}
```

#### mountComponentNode

```javascript
function mountComponentNode(parentDom, node, beforeDom) {
  node.props = node.vnode.props || {};

  let renderedVNode;
  this._currentComponentNode = node;
  this._currentInstance = node;
  try {
    renderedVNode = node.render(node.props);     // 렌더 함수 호출
  } finally {
    this._currentComponentNode = null;
    this._currentInstance = null;
  }

  // render 결과를 재귀 reconcile
  const renderedNode = this._reconcile(parentDom, null, renderedVNode, beforeDom, node);
  node.renderedNode = renderedNode;
  node.children = renderedNode ? [renderedNode] : [];
  node.firstDom = renderedNode ? renderedNode.firstDom : null;
  node.lastDom = renderedNode ? renderedNode.lastDom : null;
  return node;
}
```

watcher 실행은 `reconciler`가 직접 하지 않는다. render 함수 시작부에서 Babel 플러그인이 주입한 wrapper가 `updateProps()`와 `_runComponentWatchers()`를 처리한 뒤 JSX를 반환한다.

### updateXxxNode — 기존 node 갱신

#### updateTextNode

```javascript
function updateTextNode(node, newVNode) {
  const nextValue = String(newVNode);
  node.vnode = newVNode;
  node.key = null;

  if (node.value !== nextValue) {
    node.value = nextValue;
    node.dom.nodeValue = nextValue;    // DOM에 반영
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
  this._updateDomProps(node.dom, newVNode.props, node.props || {});  // props 변경분 적용
  node.vnode = newVNode;
  node.key = getVNodeKey(newVNode);
  node.tag = newVNode.tag;
  node.props = newVNode.props || {};
  reconcileChildren.call(this, node.dom, node, newVNode.children || [], null);  // children diff
  syncHostControlledProps(node);
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
  node.props = newVNode.props || {};

  let renderedVNode;
  this._currentComponentNode = node;
  this._currentInstance = node;
  try {
    renderedVNode = node.render(node.props);     // 렌더 함수 호출
  } finally {
    this._currentComponentNode = null;
    this._currentInstance = null;
  }

  // 이전 renderedNode와 새 VNode을 비교
  const renderedNode = this._reconcile(
    parentDom,
    node.renderedNode,
    renderedVNode,
    beforeDom,
    node
  );

  node.renderedNode = renderedNode;
  node.children = renderedNode ? [renderedNode] : [];
  node.firstDom = renderedNode ? renderedNode.firstDom : null;
  node.lastDom = renderedNode ? renderedNode.lastDom : null;
  return node;
}
```

같은 컴포넌트 함수 + 같은 key면 node를 재사용한다. setup은 재실행하지 않고 렌더 함수만 다시 호출하므로, 컴포넌트의 **로컬 상태가 보존**된다.

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

```
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
  if (lastNode.nextSibling === beforeDom) return;   // ← 이미 올바른 위치면 skip

  nodes.forEach((domNode) => {
    parentDom.insertBefore(domNode, beforeDom);
  });
  this._didMutate = true;
}
```

`lastNode.nextSibling === beforeDom` 체크로, 이미 올바른 위치에 있는 node는 `insertBefore`를 호출하지 않는다. 같은 children을 다시 렌더링할 때 불필요한 DOM 조작을 방지한다.

---

## `beforeDom` — 삽입 위치 anchor

`beforeDom`은 삽입 위치를 나타내는 실제 DOM anchor이다.

- `null`이면 부모의 맨 끝에 배치
- 특정 DOM node이면 그 노드 바로 앞에 배치

comment anchor는 사용하지 않는다. 빈 fragment나 빈 subtree는 `firstDom = lastDom = null`이며, 다음 sibling의 `firstDom` 또는 부모의 trailing anchor를 기준으로 새 range를 삽입한다.

---

## host controlled props — `syncHostControlledProps`

`<select>` 요소의 `value`는 option children이 모두 마운트된 후에 설정해야 올바르게 동작한다. `syncHostControlledProps`는 host node의 children reconcile이 끝난 후 호출되어, `select` 요소의 value를 다시 동기화한다.

```javascript
function syncHostControlledProps(node) {
  if (!node || node.kind !== 'host' || !node.dom || !node.props) return;

  if (node.tag === 'select' && Object.prototype.hasOwnProperty.call(node.props, 'value')) {
    const normalizedValue = node.props.value == null ? '' : String(node.props.value);
    node.dom.value = normalizedValue;
  }
}
```

---

## 관련 코드 위치

- `_reconcile`: `packages/core/src/reconciler.js` L445-L478
- `isSameNodeType`: `packages/core/src/reconciler.js` L79-L96
- `reconcileChildren`: `packages/core/src/reconciler.js` L98-L171
- `mountNode` 분기: `packages/core/src/reconciler.js` L227-L240
- `updateTextNode`: `packages/core/src/reconciler.js` L242-L256
- `updateHostNode`: `packages/core/src/reconciler.js` L258-L269
- `updateComponentNode`: `packages/core/src/reconciler.js` L279-L309
- `updateFragmentNode`: `packages/core/src/reconciler.js` L271-L277
- `placeNode`: `packages/core/src/reconciler.js` L63-L73
- `syncHostControlledProps`: `packages/core/src/reconciler.js` L21-L28
