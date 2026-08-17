# RuntimeNode 관리 — `node-factory`, `runtime-context`, `component-lifecycle`

## 개요

AEUI에서 **RuntimeNode**는 VNode가 실제 렌더 트리에 들어온 뒤의 실행 중 상태 객체다.

- VNode는 매 렌더마다 새로 만들어지는 입력 명세다.
- RuntimeNode는 DOM 참조, lifecycle 상태, 자식 관계를 보관하는 장기 객체다.
- reconcile은 `old RuntimeNode + new VNode`를 비교해 RuntimeNode를 재사용하거나 교체한다.

```jsx
<Counter name="A" />
<Counter name="B" />
```

위 JSX는 같은 컴포넌트 함수를 두 번 사용하지만, 런타임에서는 서로 다른 component RuntimeNode 두 개를 가진다.

---

## Node 종류

AEUI 내부 RuntimeNode는 다음 다섯 종류를 가진다.

| kind | 설명 | 자체 DOM | hook state |
|------|------|----------|------------|
| `text` | 문자열/숫자 같은 원시 렌더 결과 | TextNode 1개 | 없음 |
| `host` | 실제 DOM 요소 (`div`, `span` 등) | HTMLElement 1개 | 없음 |
| `component` | setup/render/watch/clean 상태를 가지는 컴포넌트 | 없음 | 있음 |
| `fragment` | DOM 요소 없이 여러 자식을 묶는 그룹 | 없음 | 없음 |
| `root` | 루트 컨테이너 wrapper | 없음 | 없음 |

사용자 관점의 핵심 node 종류는 `text | host | component | fragment`이고, `root`는 내부 wrapper다.

---

## 공통 필드

모든 RuntimeNode는 최소한 아래 필드를 가진다.

```javascript
{
  kind,
  key,
  vnode,
  parent,
  parentDom,
  children,
  firstDom,
  lastDom,
  isMounted,
}
```

| 필드 | 설명 |
|------|------|
| `kind` | node 종류 |
| `key` | sibling diff용 식별자 (`props.key`) |
| `vnode` | 이 node를 만든 현재 입력 VNode |
| `parent` | 부모 RuntimeNode |
| `parentDom` | 이 node의 DOM range가 속한 실제 DOM 부모 |
| `children` | 자식 RuntimeNode 목록 |
| `firstDom` | 이 node가 차지하는 DOM 범위의 시작 |
| `lastDom` | 이 node가 차지하는 DOM 범위의 끝 |
| `isMounted` | 언마운트 여부를 나타내는 상태 |

---

## kind별 추가 필드

### text node

```javascript
{
  kind: 'text',
  value,
  dom,
}
```

### host node

```javascript
{
  kind: 'host',
  tag,
  dom,
  props,
}
```

### component node

```javascript
{
  kind: 'component',
  component,
  props,
  watchStates,
  cleanups,
  renderedNode,
  renderFactory,
  render,
}
```

| 필드 | 설명 |
|------|------|
| `component` | 원본 컴포넌트 함수 (`vnode.tag`) |
| `props` | 현재 props |
| `watchStates` | `watch()` 등록 목록 |
| `cleanups` | `clean()` 등록 목록 |
| `renderedNode` | render 결과 subtree 루트 |
| `renderFactory` | setup이 반환한 render 함수 |
| `render` | 기존 호환성을 위한 alias |

component node만 hook state를 가진다.

### fragment node

fragment node는 별도 DOM 없이 `children`과 DOM range만 관리한다.

---

## `createNode(state, vnode, parentNode, parentDom)`

`node-factory.js`의 `createNode()`는 RuntimeNode **shell만 생성**한다. component setup은 여기서 실행하지 않는다.

### 처리 규칙

```text
1. 공통 필드가 있는 기본 node shell 생성
2. vnode 타입 분기
   ├── null / boolean         → null
   ├── 원시값                 → text node
   ├── 배열 / Fragment        → fragment node
   ├── tag가 문자열           → host node
   └── tag가 함수             → component node shell
```

component의 경우 `createComponentNode()`가 `watchStates`, `cleanups`, `renderFactory` 등을 가진 shell을 만든다. 실제 setup 실행은 `component-lifecycle.js`의 `setupComponentNode()`가 맡는다.

이 분리 덕분에:

- `createNode()`는 더 이상 훅 컨텍스트와 setup 실행을 직접 들고 있지 않다.
- component mount/update 흐름은 `renderComponentNode()`로 한곳에 모인다.
- 테스트에서 "node 생성"과 "setup 실행"을 분리해서 검증할 수 있다.

---

## 컴포넌트 컨텍스트와 phase

`runtime-context.js`는 현재 실행 중인 컴포넌트와 phase를 관리한다. 구현은 단일 글로벌 포인터가 아니라 active runtime stack이다.

```javascript
withComponentContext(state, node, 'setup', () => {
  // watch/clean 등록 가능
});

withComponentContext(state, node, 'render', () => {
  // render 실행
});
```

관리되는 값은 다음 세 가지다.

| 필드 | 의미 |
|------|------|
| `currentComponentNode` | 현재 실행 중인 component node |
| `currentComponentPhase` | `setup` 또는 `render` |

### 왜 phase가 필요한가

과거에는 "현재 component가 있는가"만으로 hook 등록 여부를 판단했다. 이제는 phase까지 함께 검사한다.

- `watch()`와 `clean()`은 `setup` phase에서만 등록된다.
- render 중에 호출된 `watch()`는 무시된다.
- 예외가 발생해도 `finally`에서 컨텍스트가 복구된다.
- 중첩된 component setup/render가 생겨도 바깥 runtime 컨텍스트가 stack으로 복원된다.

---

## component lifecycle

component node는 `component-lifecycle.js`가 관리한다.

### setup

```javascript
setupComponentNode(state, node)
```

- `renderFactory`가 없을 때만 setup을 실행한다.
- setup은 `withComponentContext(..., 'setup')` 안에서 실행된다.
- 결과로 받은 render 함수를 `renderFactory`에 저장한다.

### render

```javascript
renderComponentNode(state, parentDom, node, nextProps, beforeDom)
```

이 함수가 component mount/update 공통 진입점이다.

1. props 동기화
2. 필요하면 setup 실행
3. render factory 호출
4. render 결과 VNode를 `state.reconcile()`로 subtree diff
5. `renderedNode`, `children`, `firstDom`, `lastDom` 갱신

---

## DOM ownership — `firstDom` / `lastDom`

`fragment`와 `component`는 자체 DOM이 없을 수 있으므로, AEUI는 단일 `dom` 대신 DOM range를 관리한다.

| kind | firstDom | lastDom |
|------|----------|---------|
| `text` | TextNode | TextNode |
| `host` | HTMLElement | HTMLElement |
| `fragment` | 첫 자식의 `firstDom` | 마지막 자식의 `lastDom` |
| `component` | `renderedNode.firstDom` | `renderedNode.lastDom` |

이 range 모델 덕분에 fragment, 배열, component subtree를 같은 이동/삭제 로직으로 처리할 수 있다.

---

## Root node

루트 wrapper는 `createRootNode(containerElement)`가 만든다.

```javascript
{
  kind: 'root',
  parentDom: containerElement,
  children: [],
  firstDom: null,
  lastDom: null,
}
```

`runtime.js:reconcileRoot()`는 root wrapper의 첫 child를 실제 루트 component subtree로 관리한다.

---

## 관련 코드 위치

- `packages/core/src/node-factory.js`
- `packages/core/src/runtime-context.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/runtime-state.js`
