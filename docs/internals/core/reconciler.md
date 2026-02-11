# Reconciliation — `_reconcile`

## 개요

`_reconcile`은 AEUI의 핵심 알고리즘으로, **새 VNode과 이전 VNode을 비교하여 실제 DOM에 최소한의 변경만 적용**한다.

매 tick마다 컴포넌트의 렌더 함수가 실행되면 **새로운 VNode 트리**가 생성된다. `_reconcile`은 이 새 트리를 이전 tick에서 저장해둔 VNode 트리와 비교하여, 실제로 변경된 부분만 실제 DOM에 반영한다. 전체 DOM을 다시 그리는 것보다 훨씬 효율적이다.

```
tick N에서 저장된 VNode   →  ─┐
                              ├── _reconcile이 비교 → 차이점만 DOM에 적용
tick N+1에서 생성된 VNode  →  ─┘
```

---

## 함수 시그니처

```javascript
_reconcile(parentElement, newVNode, prevVNode, index, parentInstance)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `parentElement` | `HTMLElement` | 이 VNode이 렌더링될 DOM 부모 요소. 예: `<div id="root">` |
| `newVNode` | `VNode \| Array \| string \| number \| null` | 이번 tick에서 렌더 함수가 반환한 새 결과 |
| `prevVNode` | `VNode \| Array \| string \| number \| null` | 이전 tick에서 저장된 결과 |
| `index` | `number` | `parentElement.childNodes` 배열에서 이 VNode에 해당하는 DOM 노드의 위치. 예를 들어 `parentElement`의 3번째 자식이면 `index = 2` |
| `parentInstance` | `Instance \| null` | 부모 컴포넌트의 인스턴스. 자식 컴포넌트 인스턴스를 관리(`_childCursor`)하는 데 사용된다. 루트에서 호출될 때는 `null` |

---

## 5단계 처리 흐름

`_reconcile`은 `newVNode`의 타입을 순서대로 판별하여 5가지 분기 중 하나로 처리한다.

```
newVNode 타입 판별 (순서대로):
├── 1. Array.isArray(newVNode)          → 배열 처리
├── 2. newVNode == null                 → 제거 처리
├── 3. typeof newVNode !== "object"     → 텍스트 노드 처리
├── 4. typeof newVNode.tag === "function" → 컴포넌트 처리
└── 5. (나머지: tag가 문자열)             → DOM 요소 처리
```

---

### 1단계: 배열 처리 (Array / Fragment)

```javascript
if (Array.isArray(newVNode)) {
  const prevArr = Array.isArray(prevVNode) ? prevVNode : [];
  const maxLen = Math.max(newVNode.length, prevArr.length);
  for (let i = 0; i < maxLen; i++) {
    this._reconcile(
      parentElement,
      i < newVNode.length ? newVNode[i] : null,
      i < prevArr.length ? prevArr[i] : null,
      index + i,
      parentInstance
    );
  }
  return;
}
```

**언제 발생하는가**: Fragment가 children 배열을 반환할 때, 또는 `{items.map(...)}`의 결과가 배열일 때.

**`Math.max`를 사용하는 이유**: 배열 길이가 줄어든 경우를 처리하기 위함이다. 이전에 3개 아이템이 있었는데 지금 2개로 줄었다면, 3번째 요소는 `newVNode[2]`가 없으므로 `null`이 전달되어 2단계(제거)에서 DOM 노드가 제거된다.

```
이전: ["A", "B", "C"]    maxLen = 3
이후: ["A", "B"]

i=0: "A" vs "A"  → 변경 없음
i=1: "B" vs "B"  → 변경 없음  
i=2: null vs "C" → 2단계로 가서 "C" DOM 노드 제거
```

---

### 2단계: 제거 (Remove)

```javascript
if (newVNode == null) {
  if (prevVNode) {
    if (parentElement.childNodes[index]) {
      parentElement.removeChild(parentElement.childNodes[index]);
    }
  }
  return;
}
```

`newVNode`이 `null`이면 "이 위치에는 더 이상 아무것도 없어야 한다"는 뜻이다.

**이전 VNode이 있고(`prevVNode`) 해당 위치에 DOM 노드가 존재할 때**: 그 DOM 노드를 제거한다.

**`prevVNode`이 없으면**: 이전에도 없었고 지금도 없으므로 아무 동작도 하지 않는다.

---

### 3단계: 텍스트 노드 (Text)

```javascript
if (typeof newVNode !== "object") {
  const domNode = parentElement.childNodes[index];
  if (domNode && domNode.nodeType === Node.TEXT_NODE) {
    // 같은 위치에 이미 텍스트 노드가 있는 경우: 값만 변경
    if (domNode.nodeValue !== String(newVNode)) {
      domNode.nodeValue = String(newVNode);
    }
  } else {
    // 텍스트 노드가 아닌 다른 노드가 있거나, 아무것도 없는 경우
    const newDomNode = document.createTextNode(String(newVNode));
    if (domNode) {
      parentElement.replaceChild(newDomNode, domNode);
    } else {
      parentElement.appendChild(newDomNode);
    }
  }
  return;
}
```

문자열, 숫자 등 원시값은 텍스트 노드로 처리한다.

**최적화**: 같은 위치에 이미 텍스트 노드가 있으면 `nodeValue`만 변경한다. 이렇게 하면 DOM 노드를 새로 생성/삭제하지 않으므로 브라우저의 레이아웃 재계산이 최소화된다.

**타입이 달라진 경우**: 이전에 DOM 요소(`<div>`)가 있던 위치에 텍스트가 온 경우, `replaceChild`로 교체한다.

---

### 4단계: 컴포넌트 노드 (Component)

`newVNode.tag`가 함수인 경우이다. 이 단계에서는 **컴포넌트 인스턴스를 찾거나 생성**하고, **렌더 함수를 호출**한 뒤, 그 결과를 다시 `_reconcile`에 재귀적으로 넘긴다.

#### 4-1. 기존 인스턴스 찾기

`parentInstance`가 있는 경우 (부모 컴포넌트 안에서 렌더링될 때):

```javascript
if (parentInstance) {
  instance = parentInstance.children[parentInstance._childCursor];

  if (instance && instance.vnode.tag === newVNode.tag) {
    // 같은 컴포넌트 함수 → 기존 인스턴스 재사용
    parentInstance._childCursor++;
    instance.vnode = newVNode;
    instance.props = newVNode.props || {};
  } else {
    // 다른 컴포넌트 함수 → 이전 인스턴스 제거, 새로 생성
    instance = this.createInstance(newVNode, parentInstance);
    if (parentInstance.children[parentInstance._childCursor]) {
      this._unmount(parentInstance.children[parentInstance._childCursor]);
      parentInstance.children[parentInstance._childCursor] = instance;
    } else {
      parentInstance.children.push(instance);
    }
    parentInstance._childCursor++;
  }
}
```

**재사용 조건**: `instance.vnode.tag === newVNode.tag`, 즉 **같은 함수 참조**인 경우에만 재사용한다. 다른 컴포넌트 함수가 같은 위치에 오면 이전 인스턴스의 모든 상태(let 변수, watcher, cleanup 등)가 파괴되고 새로 생성된다.

`parentInstance`가 없는 경우 (루트 컴포넌트):

```javascript
if (this._rootInstance && this._rootInstance.vnode.tag === newVNode.tag) {
  instance = this._rootInstance;
  // 재사용, props 갱신
} else {
  if (this._rootInstance) this._unmount(this._rootInstance);
  instance = this.createInstance(newVNode, null);
  this._rootInstance = instance;
}
```

#### 4-2. 렌더 실행

```javascript
instance.parentElement = parentElement;
instance._childCursor = 0;

AEUI._currentInstance = instance;
AEUI._runComponentWatchers(instance);    // watcher 먼저 실행
const componentRenderedVNode = instance.render(newVNode.props);  // 렌더 함수 호출
AEUI._currentInstance = null;
```

**watcher가 render보다 먼저 실행되는 이유**: watch callback이 상태를 변경할 수 있고, 그 변경이 render 결과(JSX)에 반영되어야 하기 때문이다. render를 먼저 실행하면 watch에 의한 상태 변경이 이번 tick에 반영되지 않는다.

#### 4-3. 재귀 reconcile

```javascript
this._reconcile(
  parentElement,
  componentRenderedVNode,     // 렌더 함수가 반환한 VNode
  instance.prevRenderedVNode, // 이전 렌더 결과
  index,
  instance                    // 이 인스턴스가 자식의 parentInstance가 됨
);
instance.prevRenderedVNode = componentRenderedVNode;
```

컴포넌트의 렌더 결과 VNode은 결국 DOM 요소(5단계) 또는 다른 컴포넌트(4단계 재귀)이므로, 최종적으로 실제 DOM 조작이 이루어진다.

#### 4-4. 초과 자식 정리

```javascript
if (instance._childCursor < instance.children.length) {
  const removed = instance.children.splice(instance._childCursor);
  removed.forEach(child => this._unmount(child));
}
```

이번 렌더에서 이전보다 적은 수의 자식 컴포넌트를 사용한 경우, 남은 인스턴스를 정리한다.

---

### 5단계: DOM 요소 (Element)

`newVNode.tag`가 문자열(`"div"`, `"p"` 등)인 경우이다.

```javascript
const domNode = parentElement.childNodes[index];

if (domNode && prevVNode && prevVNode.tag === newVNode.tag) {
  // 같은 태그의 DOM 노드가 이미 있음 → 속성과 자식만 업데이트
  this._updateDomProps(domNode, newVNode.props, prevVNode.props);

  const newChildren = newVNode.children || [];
  const oldChildren = prevVNode.children || [];
  const maxLength = Math.max(newChildren.length, oldChildren.length);

  for (let i = 0; i < maxLength; i++) {
    this._reconcile(domNode, newChildren[i], oldChildren[i], i, parentInstance);
  }
} else {
  // 태그가 다르거나 새로 생성해야 함
  const newDomNode = this._createDomNode(newVNode);
  if (newVNode.children) {
    newVNode.children.forEach((child, i) => {
      this._reconcile(newDomNode, child, null, i, parentInstance);
    });
  }

  if (domNode) {
    parentElement.replaceChild(newDomNode, domNode);
  } else {
    parentElement.appendChild(newDomNode);
  }
}
```

**같은 태그일 때**: DOM 노드를 재사용한다. `_updateDomProps`로 변경된 속성만 업데이트하고, children을 순회하며 재귀적으로 `_reconcile`을 호출한다.

**다른 태그이거나 새로운 위치일 때**: 새 DOM 노드를 `_createDomNode`로 생성하고, children을 재귀적으로 처리한 뒤, 기존 노드가 있으면 교체하고 없으면 추가한다.

---

## `_getDomNodeCount(vnode)`

인스턴스의 `update()` 메서드에서 **DOM 시작 인덱스를 계산**할 때 사용된다.

### 왜 필요한가

`parentElement.childNodes`는 flat한 배열이고, `_reconcile`의 `index` 파라미터는 이 배열에서의 위치이다. 한 부모 안에 여러 형제 컴포넌트가 있을 때, 두 번째 컴포넌트의 시작 인덱스는 첫 번째 컴포넌트가 차지하는 DOM 노드 수만큼 밀려야 한다.

```
부모 DOM: [ChildA의 DOM 노드들..., ChildB의 DOM 노드들...]
                                     ↑
                                     ChildB의 startIndex = ChildA의 DOM 노드 수
```

### 현재 구현

```javascript
_getDomNodeCount(vnode) {
  if (vnode == null) return 0;
  if (typeof vnode !== 'object') return 1;    // 텍스트 → 1개
  if (Array.isArray(vnode)) {
    return vnode.reduce((acc, c) => acc + this._getDomNodeCount(c), 0);
  }
  if (typeof vnode.tag === 'function') {
    return 1; // ⚠️ 단순화: 컴포넌트는 항상 1개의 DOM 노드로 가정
  }
  return 1; // DOM 요소 → 1개
}
```

### 현재 제한 사항 (향후 수정 예정)

컴포넌트가 Fragment나 배열을 반환하면 실제 DOM 노드 수는 1이 아닐 수 있다. 예를 들어 Fragment로 3개의 `<p>`를 반환하는 컴포넌트의 실제 DOM 노드 수는 3이지만, 현재는 1로 계산한다. 이로 인해 형제 컴포넌트의 startIndex가 틀어져 DOM 업데이트가 잘못된 위치에 적용될 수 있다.

---

## 인덱스 기반 비교의 특성

`_reconcile`은 `parentElement.childNodes[index]`로 DOM 노드에 직접 접근한다. 이는 O(1) 접근이지만, 리스트의 중간에 아이템을 삽입/삭제하면 이후 모든 인덱스가 밀려서 불필요한 업데이트가 발생한다.

```
이전: [A, B, C]     인덱스: 0, 1, 2
이후: [A, X, B, C]   인덱스: 0, 1, 2, 3

인덱스 0: A vs A → 변경 없음 ✓
인덱스 1: X vs B → 변경됨   (실제로는 X가 새로 삽입됨)
인덱스 2: B vs C → 변경됨   (실제로는 B가 한 칸 밀렸을 뿐) ← 불필요
인덱스 3: C vs null → 새로 생성 (실제로는 C가 한 칸 밀렸을 뿐) ← 불필요
```

key 기반 비교가 도입되면 노드를 key로 식별하여 이동/삽입/삭제를 정확히 판별할 수 있다. 이 기능은 향후 구현 예정이다.

---

## 관련 코드 위치

- `_reconcile`: `packages/core/src/core.js` L303-L455
- `_getDomNodeCount`: `packages/core/src/core.js` L69-L80
