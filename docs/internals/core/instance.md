# RuntimeNode 관리 — `createNode`, `_currentComponentNode`

## 개요

AEUI에서 **RuntimeNode**는 하나의 VNode이 화면에 마운트된 후의 **런타임 상태를 담는 객체**이다.

VNode은 `createVNode`이 매 렌더마다 새로 만드는 입력 명세일 뿐이고, RuntimeNode는 실제 DOM 참조, lifecycle state, 자식 관계를 가진 실행 중 객체이다. reconcile 과정에서 old RuntimeNode와 new VNode을 비교하여, RuntimeNode를 재사용하거나 새로 생성한다.

```jsx
// Counter 함수는 1개, 하지만 RuntimeNode는 2개 생성
<Counter name="A" />   →  component node 1 (count=0, name="A")
<Counter name="B" />   →  component node 2 (count=0, name="B")
```

React의 Fiber Node가 이에 해당한다.

---

## Node 종류

AEUI 내부의 RuntimeNode 종류는 4가지이다.

| kind | 설명 | 자체 DOM | hook state |
|------|------|----------|------------|
| `text` | 문자열/숫자 같은 원시 렌더 결과 | TextNode 1개 | 없음 |
| `host` | 실제 DOM 요소를 가지는 노드 (`div`, `span` 등) | HTMLElement 1개 | 없음 |
| `component` | setup/render/watch/clean state를 가지는 컴포넌트 노드 | 없음 (renderedNode에 위임) | 있음 |
| `fragment` | DOM 요소 없이 여러 자식을 묶는 노드. 배열 반환과 `AEUI.Fragment`를 모두 포함 | 없음 (children에 위임) | 없음 |

루트 컨테이너는 내부적으로 `kind: 'root'`인 별도 wrapper node가 children을 소유하지만, 사용자 의미의 node 종류는 위 4가지이다.

---

## 공통 필드

모든 RuntimeNode는 최소한 아래 필드를 가진다.

```javascript
{
  kind,        // 'text' | 'host' | 'component' | 'fragment'
  key,         // sibling diff에 사용되는 선택적 식별자
  vnode,       // 이 node를 만든 현재 입력 VNode
  parent,      // 부모 RuntimeNode
  parentDom,   // 이 node의 DOM range가 속한 실제 DOM 부모
  children,    // 자식 RuntimeNode 목록
  firstDom,    // 이 node가 차지하는 실제 DOM 범위의 시작
  lastDom,     // 이 node가 차지하는 실제 DOM 범위의 끝
  isMounted    // unmount 이후 재사용을 방지하기 위한 상태
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `kind` | `string` | node의 종류. `'text'`, `'host'`, `'component'`, `'fragment'` 중 하나 |
| `key` | `string \| number \| null` | `props.key`에서 추출된 값. sibling diff에서 같은 부모의 이전 child node를 key로 매칭하는 데 사용된다. key가 없으면 `null` |
| `vnode` | `VNode \| string \| number` | 이 node를 생성하거나 마지막으로 갱신한 입력 VNode. 재렌더링 시 새 VNode으로 갱신된다 |
| `parent` | `RuntimeNode \| null` | 부모 RuntimeNode. 루트 node의 parent는 root wrapper node이다 |
| `parentDom` | `HTMLElement` | 이 node의 DOM range가 삽입된 실제 DOM 부모 요소. host node의 children은 host의 DOM 요소가 parentDom이 되고, fragment/component의 children은 상위의 parentDom을 그대로 사용한다 |
| `children` | `RuntimeNode[]` | 자식 RuntimeNode 목록. host node는 자기 DOM 요소 안의 자식들, component node는 `renderedNode`를 children에 보관한다 |
| `firstDom` | `Node \| null` | 이 node가 차지하는 실제 DOM 범위의 **시작** 노드. text/host는 자기 DOM 노드, fragment/component는 첫 자식의 firstDom |
| `lastDom` | `Node \| null` | 이 node가 차지하는 실제 DOM 범위의 **끝** 노드. text/host는 자기 DOM 노드, fragment/component는 마지막 자식의 lastDom |
| `isMounted` | `boolean` | `true`면 현재 활성 상태. `_unmountNode` 시 `false`로 설정되어 이미 정리된 node의 재사용을 방지한다 |

---

## kind별 추가 필드

### text node

```javascript
{
  kind: 'text',
  value,   // String — TextNode의 현재 문자열 값
  dom      // TextNode — 실제 DOM TextNode 참조
}
```

### host node

```javascript
{
  kind: 'host',
  tag,     // String — 'div', 'span' 등 HTML 태그명
  dom,     // HTMLElement — 실제 DOM 요소 참조
  props    // Object — 현재 적용된 props (이전/새 비교에 사용)
}
```

### component node

컴포넌트 node만 lifecycle state를 가진다.

```javascript
{
  kind: 'component',
  component,     // Function — 컴포넌트 함수 (vnode.tag)
  props,         // Object — 현재 props
  render,        // Function — setup이 반환한 렌더 함수
  watchStates,   // Array — watch 등록 목록
  cleanups,      // Array — clean 등록 목록
  renderedNode   // RuntimeNode — render 결과 subtree의 루트 node
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `component` | `Function` | 컴포넌트 함수. `vnode.tag`와 동일하다. 같은 위치에 같은 함수가 오면 node를 재사용한다 |
| `props` | `Object` | 현재 이 컴포넌트에 전달된 props. 부모가 새 props를 전달하면 갱신된다 |
| `render` | `Function` | 컴포넌트의 **렌더 함수**. 컴포넌트 함수(setup)를 실행하면 반환되는 `(_newProps) => { ... JSX ... }` 형태의 함수. 매 tick마다 이 함수가 호출되어 새 VNode을 생성한다 |
| `watchStates` | `Array` | `watch()` 훅으로 등록된 watcher 객체들의 배열. 각 watcher는 `{ callback, getDeps, oldDeps }` 구조를 가진다. 상세한 동작은 `watcher.md` 참조 |
| `cleanups` | `Array` | `clean()` 훅으로 등록된 정리 함수들의 배열. node가 언마운트될 때 순서대로 실행된다. 예: `clearInterval`, 이벤트 리스너 해제 등 |
| `renderedNode` | `RuntimeNode \| null` | `render(props)`가 반환한 VNode을 reconcile한 결과. component node의 `children`은 `[renderedNode]`이고, `firstDom`/`lastDom`은 `renderedNode`의 범위와 동일하다 |

`host`, `text`, `fragment`는 구조 노드일 뿐이며 hook state를 가지지 않는다.

### fragment node

fragment node는 추가 필드가 없다. `children` 배열과 `firstDom`/`lastDom` 범위만 관리한다.

---

## `createNode(vnode, parentNode, parentDom)`

RuntimeNode를 생성하는 함수이다. VNode의 타입을 판별하여 적절한 kind의 node를 반환한다.

### 파라미터

| 파라미터 | 설명 |
|----------|------|
| `vnode` | VNode 객체, 원시값(문자열/숫자), 또는 배열 |
| `parentNode` | 부모 RuntimeNode. 루트면 root wrapper node |
| `parentDom` | 이 node가 삽입될 실제 DOM 부모 요소 |

### 동작 과정

```
1. 공통 필드로 기본 node 객체 생성 (kind, key, vnode, parent, parentDom, children, firstDom, lastDom, isMounted)

2. VNode 타입 판별:
   ├── null / boolean         → null 반환 (렌더링할 것 없음)
   ├── 원시값 (string/number) → kind='text', value=String(vnode), dom=null
   ├── 배열 또는 Fragment     → kind='fragment'
   ├── tag가 문자열           → kind='host', tag/dom/props 설정
   └── tag가 함수             → kind='component' (아래 상세)

3. component인 경우:
   ├── component, props, watchStates, cleanups, renderedNode, render 필드 추가
   ├── _currentComponentNode = node   ← 전역 컨텍스트 설정
   ├── _currentInstance = node        ← Babel 호환 alias
   ├── node.render = vnode.tag(vnode.props)
   │   └→ 컴포넌트 함수(setup) 실행 — 이 코드는 컴포넌트 생명 동안 딱 1번만 실행됨
   │   └→ 이 실행 중에 watch(), clean() 등의 훅이 호출되면
   │      _currentComponentNode를 통해 이 node에 등록됨
   │   └→ 반환값은 렌더 함수((_newProps) => VNode)
   ├── _currentComponentNode = null   ← 컨텍스트 해제
   └── _currentInstance = null        ← 컨텍스트 해제

4. node 반환
```

### 코드

```javascript
export function createNode(vnode, parentNode = null, parentDom = null) {
  const node = {
    kind: null,
    key: getVNodeKey(vnode),
    vnode,
    parent: parentNode,
    parentDom,
    children: [],
    firstDom: null,
    lastDom: null,
    isMounted: true,
  };

  if (vnode == null || typeof vnode === 'boolean') {
    return null;
  }

  if (typeof vnode !== 'object') {
    node.kind = 'text';
    node.value = String(vnode);
    node.dom = null;
    return node;
  }

  if (isFragmentVNode(this, vnode)) {
    node.kind = 'fragment';
    return node;
  }

  if (typeof vnode.tag === 'string') {
    node.kind = 'host';
    node.tag = vnode.tag;
    node.dom = null;
    node.props = vnode.props || {};
    return node;
  }

  // component
  node.kind = 'component';
  node.component = vnode.tag;
  node.props = vnode.props || {};
  node.watchStates = [];
  node.cleanups = [];
  node.renderedNode = null;
  node.render = null;

  this._currentComponentNode = node;
  this._currentInstance = node;
  try {
    node.render = vnode.tag(vnode.props);
  } finally {
    this._currentComponentNode = null;
    this._currentInstance = null;
  }

  return node;
}
```

### 핵심 원리: Setup 1회 실행

AEUI 컴포넌트의 가장 중요한 특성은, **컴포넌트 함수의 본문(setup)이 마운트 시 딱 한 번만 실행**된다는 것이다. 이후에는 setup이 반환한 **렌더 함수**만 반복 실행된다.

이것이 가능한 이유는 Babel 플러그인이 `return (JSX)`를 `return () => (JSX)` 형태로 변환하기 때문이다:

```javascript
// 사용자가 작성한 코드
function Counter() {
  let count = 0;     // ← setup: 1회만 실행

  return (
    <div>{count}</div>  // ← JSX
  );
}

// Babel 변환 후 실제 실행되는 코드
function Counter() {
  let count = 0;     // ← setup: 1회만 실행

  return (_newProps) => {        // ← 이것이 node.render가 된다
    return AEUI.createVNode("div", null, count);
    // ↑ 이 함수만 매 tick마다 반복 실행됨
    // count는 클로저로 참조되므로, 외부에서 count++ 하면 다음 렌더에서 새 값이 반영됨
  };
}
```

자바스크립트의 **클로저(closure)** 덕분에, setup에서 선언된 `let count = 0`은 렌더 함수가 참조를 유지하고, `count++` 같은 변경이 다음 렌더에서 자동으로 반영된다. React처럼 `useState`를 사용할 필요가 없다.

---

## Hook 컨텍스트 — `_currentComponentNode`

### 역할

`watch()`와 `clean()` 같은 훅 함수는 독립적인 함수이므로, "지금 어떤 컴포넌트의 setup 안에서 호출되고 있는지"를 스스로 알 수 없다. `_currentComponentNode`는 이 정보를 전해주는 전역 변수이다.

```javascript
// hooks.js
export function watch(deps, callback) {
  const runtime = getRuntimeContext();
  if (!runtime) return;

  const node = runtime.getCurrentComponentNode();  // ← "지금 어떤 컴포넌트?"
  if (node) {
    node.watchStates.push({ ... });                // ← 그 컴포넌트의 watcher 목록에 등록
  }
}
```

### 설정 시점

| 시점 | 설정되는 값 | 목적 |
|------|-------------|------|
| `createNode`에서 setup 실행 전 | 새로 생성된 node | `watch()`, `clean()` 훅이 이 node에 등록되도록 |
| `mountComponentNode`에서 render 실행 전 | 해당 component node | 최초 마운트 시 watcher 실행 컨텍스트 제공 |
| `updateComponentNode`에서 render 실행 전 | 해당 component node | 업데이트 시 watcher 실행 컨텍스트 제공 |

각 설정 후, 해당 작업이 끝나면 반드시 `finally` 블록에서 `_currentComponentNode = null`로 해제한다.

### `_currentInstance` alias

Babel 플러그인이 렌더 함수에 `AEUI._runComponentWatchers(AEUI._currentComponentNode)`를 주입하므로, `_currentComponentNode`가 기준 필드이다. `_currentInstance`는 내부 호환성을 위해 같은 값이 설정되지만, 개념적으로는 `_currentComponentNode`가 정확한 모델이다. 장기적으로 `_currentInstance`는 제거 대상이다.

### 동기적 작동 보장

`_currentComponentNode`는 전역 변수 하나이므로, 만약 컴포넌트 A의 setup 중에 컴포넌트 B의 setup이 시작되면 A의 컨텍스트가 덮어씌워질 수 있다. 그러나 현재 AEUI의 모든 코드는 **동기적으로 실행**되므로 (비동기 렌더링 없음), 한 컴포넌트의 setup이 완전히 끝난 후에야 다음 컴포넌트의 setup이 시작된다. 따라서 이 문제는 발생하지 않는다.

---

## DOM Ownership — `firstDom`/`lastDom`

`fragment`와 `component`는 자체 DOM 노드가 없을 수 있으므로, 각 node는 단일 `dom` 대신 `firstDom`/`lastDom` 범위를 가진다.

| kind | firstDom | lastDom |
|------|----------|---------|
| `text` | `TextNode` | `TextNode` (firstDom과 동일) |
| `host` | `HTMLElement` | `HTMLElement` (firstDom과 동일) |
| `fragment` | 첫 자식의 `firstDom` | 마지막 자식의 `lastDom` |
| `component` | `renderedNode.firstDom` | `renderedNode.lastDom` |

### 왜 range 방식인가

이전 모델에서는 `_getDomNodeCount`로 각 컴포넌트가 차지하는 DOM 노드 수를 계산하고, `parentElement.childNodes[index]`로 접근했다. 이 방식은 Fragment나 컴포넌트가 여러 DOM 노드를 생성하는 경우에 노드 수 합산이 복잡했다.

`firstDom`/`lastDom` 범위를 사용하면:
- DOM 이동과 상태 이동을 같은 트리 연산으로 다룰 수 있다
- sibling reorder는 "DOM 개수 계산"이 아니라 **node range 이동**으로 처리할 수 있다
- Fragment/배열/DOM/컴포넌트를 같은 diff 모델에서 처리할 수 있다

### range 갱신

`updateRangeFromChildren` 함수가 fragment/root node의 `firstDom`/`lastDom`을 자식으로부터 재계산한다:

```javascript
function updateRangeFromChildren(node) {
  let firstDom = null;
  let lastDom = null;

  for (const child of node.children || []) {
    if (!firstDom && child && child.firstDom) {
      firstDom = child.firstDom;
    }
    if (child && child.lastDom) {
      lastDom = child.lastDom;
    }
  }

  node.firstDom = firstDom;
  node.lastDom = lastDom;
}
```

---

## Root Node — `createRootNode`

`AEUI.init()` 호출 시 `createRootNode(containerElement)`로 생성되는 최상위 wrapper node이다.

```javascript
export function createRootNode(containerElement) {
  return {
    kind: 'root',
    key: null,
    vnode: null,
    parent: null,
    parentDom: containerElement,
    children: [],
    firstDom: null,
    lastDom: null,
    isMounted: true,
  };
}
```

root node는 사용자 컴포넌트의 부모 역할을 하며, `_reconcileRoot()`에서 root node의 `children[0]`이 실제 루트 컴포넌트의 RuntimeNode를 참조한다.

---

## 관련 코드 위치

- `createNode`: `packages/core/src/runtime.js` L64-L118
- `createRootNode`: `packages/core/src/runtime.js` L28-L40
- `_currentComponentNode` 선언: `packages/core/src/core.js` L21
- `_currentComponentNode` 참조 (hooks): `packages/core/src/hooks.js` (`runtime.js` 경유)
- runtime bridge: `packages/core/src/runtime.js` L20-L26
