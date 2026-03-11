# Unmount — `_unmountNode`

## 개요

`_unmountNode`는 RuntimeNode 서브트리를 **정리(cleanup)**하는 함수이다.

컴포넌트가 화면에서 제거될 때 (조건부 렌더링으로 사라지거나, 같은 위치에 다른 컴포넌트가 올 때, `init()`이 재호출될 때), 이 함수가 호출된다. node와 모든 하위 자식들의 cleanup 콜백을 실행하고, watcher를 해제하여 **메모리 누수를 방지**한다.

---

## 함수 시그니처

```javascript
_unmountNode(node, removeDom = true)
```

| 파라미터 | 설명 |
|----------|------|
| `node` | 정리할 RuntimeNode |
| `removeDom` | `true`이면 이 node의 DOM range를 실제 DOM에서 제거. 자식을 재귀 호출할 때는 `false`를 전달하여 부모가 일괄 제거하도록 한다 |

---

## 동작 과정

```
_unmountNode(node, removeDom = true):
  0. null 체크 (node가 없으면 리턴)

  1. node.isMounted = false
     → 이미 정리된 node의 재사용을 방지

  2. component node인 경우:
     cleanups 배열 순서대로 실행
     각 cleanup 함수를 try-catch로 감싸서 실행
     → 에러가 발생해도 다음 cleanup으로 계속 진행

  3. children 배열 순회 → 각 자식에 대해 _unmountNode(child, false) 재귀 호출
     removeDom=false: 부모가 DOM 범위를 통째로 제거하므로 자식은 개별 제거 불필요

  4. removeDom=true이면 firstDom..lastDom 범위를 실제 DOM에서 제거

  5. component node 정리:
     watchStates = []  (watcher 전부 해제)
     cleanups = []     (cleanup 참조 해제)
     renderedNode = null

  6. 공통 정리:
     children = []
     firstDom = null
     lastDom = null
```

### 코드

```javascript
export function _unmountNode(node, removeDom = true) {
  if (!node) return;

  node.isMounted = false;

  if (node.kind === 'component') {
    node.cleanups.forEach((cleanup) => {
      try { cleanup(); } catch (e) { console.error('[AEUI] Cleanup error:', e); }
    });
  }

  (node.children || []).forEach((child) => {
    this._unmountNode(child, false);
  });

  if (removeDom && node.parentDom) {
    removeDomRange.call(this, node.parentDom, node);
  }

  if (node.kind === 'component') {
    node.watchStates = [];
    node.cleanups = [];
    node.renderedNode = null;
  }

  node.children = [];
  node.firstDom = null;
  node.lastDom = null;
}
```

---

## 각 단계 상세 설명

### `isMounted = false`

모든 종류의 node에 적용된다. 이미 정리된 node가 우연히 다른 곳에서 참조되는 경우를 방지하기 위한 안전 장치이다.

### cleanups 실행 (component node만)

`clean()` 훅으로 등록된 콜백들을 실행한다. 주로 다음과 같은 리소스 정리에 사용된다:

```javascript
// 예시 1: setInterval 해제
const timer = setInterval(() => { /* ... */ }, 1000);
clean(() => clearInterval(timer));

// 예시 2: 이벤트 리스너 해제
window.addEventListener('resize', handleResize);
clean(() => window.removeEventListener('resize', handleResize));

// 예시 3: WebSocket 연결 종료
const ws = new WebSocket('ws://...');
clean(() => ws.close());
```

`text`, `host`, `fragment` node는 lifecycle state가 없으므로 cleanup을 건너뛴다.

### 에러 격리

```javascript
node.cleanups.forEach((cleanup) => {
  try { cleanup(); } catch (e) { console.error('[AEUI] Cleanup error:', e); }
});
```

cleanup 함수에서 에러가 발생해도 나머지 cleanup과 자식 unmount가 **정상적으로 진행**된다. 예를 들어 3개의 cleanup이 등록되어 있고 2번째에서 에러가 발생하면, 1번째와 3번째는 정상 실행되고 에러는 콘솔에 로깅된다.

### 재귀적 자식 unmount

자식 node들도 재귀적으로 unmount된다. 실행 순서는 **부모 cleanup 먼저 → 자식 cleanup 나중** (DFS 전위 순회):

```
ParentApp unmount:
  1. ParentApp.cleanups 실행 (clearInterval 등)
  2. ChildA._unmountNode()
     ├── ChildA.cleanups 실행
     └── GrandchildX._unmountNode()
         └── GrandchildX.cleanups 실행
  3. ChildB._unmountNode()
     └── ChildB.cleanups 실행
```

이 순서는 부모가 만든 리소스를 먼저 정리한 후 자식의 리소스를 정리하는 것이다. 자식이 부모의 리소스에 의존하는 경우 (예: 부모가 만든 WebSocket을 자식이 사용) 이 순서가 올바르다.

### DOM 범위 제거 — `removeDomRange`

`removeDom = true`일 때 실행된다. node가 자기 DOM 범위를 `firstDom`/`lastDom`로 알고 있으므로, unmount 시 DOM 개수 계산 없이 해당 range를 통째로 제거할 수 있다.

```javascript
function removeDomRange(parentDom, node) {
  const nodes = getDomNodesInRange(parentDom, node);
  nodes.forEach((domNode) => {
    if (domNode.parentNode === parentDom) {
      parentDom.removeChild(domNode);
    }
  });

  if (nodes.length > 0) {
    this._didMutate = true;
  }
}
```

`getDomNodesInRange`는 `firstDom`부터 `lastDom`까지 `nextSibling`을 따라가며 DOM 노드를 수집한다.

자식을 재귀 호출할 때 `removeDom = false`를 전달하는 이유: 부모 node가 자기 DOM 범위를 통째로 제거하면, 자식의 DOM도 함께 제거된다. 자식이 다시 개별적으로 `removeChild`를 호출하면 이미 제거된 노드를 찾으려 시도하므로 불필요하다.

### `watchStates`, `cleanups` 배열 비우기, `renderedNode` 해제

```javascript
if (node.kind === 'component') {
  node.watchStates = [];
  node.cleanups = [];
  node.renderedNode = null;
}
```

배열을 빈 배열로 교체하여, watcher의 `callback`, `getDeps` 함수와 cleanup 함수에 대한 **참조를 해제**한다. 이 함수들이 클로저로 참조하는 변수들이 가비지 컬렉션되어 메모리가 회수될 수 있게 한다.

`renderedNode = null`로 설정하여 이전 렌더 결과의 subtree 참조도 해제한다.

---

## 호출 시점

`_unmountNode`가 호출되는 경우들:

| 상황 | 호출 위치 | 설명 |
|------|-----------|------|
| `init()` 재호출 | `init` 내부 | 이전 루트 node를 정리. 예: 테스트에서 매 테스트마다 `init` 호출 |
| newVNode이 null/boolean | `_reconcile` 1단계 | old node가 제거되어야 할 때 |
| 타입 불일치 | `_reconcile` 2단계 | 같은 위치에 다른 종류/태그의 VNode이 올 때, old node를 unmount하고 새로 생성 |
| child diff에서 매칭 실패 | `reconcileChildren` | 이전 children 중 새 VNode과 매칭되지 않은 old child를 제거 |

### DOM 제거와 lifecycle 정리의 통합

이전 모델에서는 DOM 제거(`_reconcile`에서 `removeChild`)와 lifecycle 정리(`_unmount`)가 분리되어 있었다. 현재 모델에서는 `_unmountNode`가 **DOM 제거와 lifecycle 정리를 같은 경로**에서 처리한다. keyed reorder와 subtree replacement에서 이 두 작업이 항상 동기화되므로, 리소스 누수가 발생할 가능성이 줄어든다.

---

## 관련 코드 위치

- `_unmountNode`: `packages/core/src/reconciler.js` L415-L443
- `removeDomRange`: `packages/core/src/reconciler.js` L311-L322
- `getDomNodesInRange`: `packages/core/src/reconciler.js` L47-L61
- `clean` 훅 (cleanup 등록): `packages/core/src/hooks.js`
