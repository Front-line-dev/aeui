# 03. 컴포넌트 런타임

이 장은 AEUI 컴포넌트의 **생명주기**를 다룬다. AEUI 컴포넌트는 React와 근본적으로 다르다:

- React: 함수 전체가 **매 렌더마다** 다시 실행된다
- AEUI: 함수 본문은 **최초 마운트 시 한 번만** 실행(setup)되고, 반환된 **렌더 함수만** 반복 실행된다

이 구조를 Babel 컴파일러가 자동으로 만들어주며, 덕분에 일반 `let` 변수가 상태처럼 동작한다.

```jsx
function Counter() {
  // ↓ setup: 마운트 시 한 번만 실행
  let count = 0;
  watch(() => console.log(count), [count]);
  clean(() => console.log('정리'));
  
  // ↓ render: 매번 실행 (Babel이 자동으로 분리)
  return <button onClick={() => count++}>{count}</button>;
}
```

---

## 1. 관련 모듈

| 모듈 | 역할 |
|---|---|
| `app-runtime.js` | 독립 runtime state 생성, 공개/내부 API 조립 |
| `runtime-state.js` | 앱별 mutable state의 초기 구조 |
| `node-factory.js` | root 및 일반 RuntimeNode 생성 |
| `component-lifecycle.js` | 컴포넌트 setup, render, commit, cleanup |
| `runtime-context.js` | 현재 활성 컴포넌트/phase를 스택으로 관리 |
| `compiler-runtime.js` | Babel 생성 코드와 컴포넌트 생명주기 사이의 다리 |
| `component-watchers.js` | 컴포넌트별 watcher 실행 |
| `hook-registry.js` | setup 중 watch/clean 등록 |
| `reconciler.js` | RuntimeNode 재사용/교체 및 subtree 연결 |

---

## 2. VNode과 RuntimeNode의 차이

| | VNode | RuntimeNode |
|---|---|---|
| **역할** | 매 렌더의 **입력** (설계도) | 렌더 사이에 **유지되는** 실행 상태 |
| **수명** | 매 렌더마다 새로 생성 | 컴포넌트가 살아있는 동안 유지 |
| **내용** | `{ tag, props, children }` | 위 + DOM 참조, watcher, cleanup 등 |

### RuntimeNode 공통 필드

```js
{
  kind: null,          // 'text', 'host', 'fragment', 'component', 'root'
  key: null,           // sibling 매칭용 (nullish는 null로 정규화)
  vnode,               // 현재 렌더의 VNode 입력
  parent: parentNode,  // 논리적 부모 RuntimeNode
  parentDom,           // 이 노드의 DOM이 직접 속하는 DOM 부모
  children: [],        // 자식 RuntimeNode 목록
  firstDom: null,      // 이 노드가 차지하는 DOM 범위의 시작
  lastDom: null,       // DOM 범위의 끝
  isMounted: true,     // 생성 시 true, unmount 시 false
}
```

### kind별 추가 필드

```js
// text
{ kind: 'text', value: String(vnode), dom: null }

// host (HTML 요소)
{ kind: 'host', tag: vnode.tag, dom: null, props: vnode.props || {} }

// fragment (감싸는 DOM 없음)
{ kind: 'fragment' }

// component
{
  kind: 'component',
  component: vnode.tag,        // 컴포넌트 함수
  props: vnode.props || {},
  watchStates: [],             // 등록된 watcher 목록
  cleanups: [],                // 등록된 cleanup 함수 목록
  renderedNode: null,          // 렌더 결과로 만들어진 RuntimeNode
  renderFactory: null,         // setup이 반환한 렌더 함수
  render: null,                // renderFactory의 호환 alias
}
```

### root node

`createRootNode(containerElement)`는 앱 전체를 감싸는 최상위 노드를 만든다. `children[0]`이 앱의 루트 컴포넌트 RuntimeNode다.

---

## 3. `createNode` — shell만 만들고 setup은 하지 않음

`createNode(state, vnode, parentNode, parentDom)`는 **RuntimeNode의 껍데기만** 만든다. 컴포넌트 함수를 호출하지 않는다.

```
null/boolean                    → null
비객체 (문자열, 숫자 등)         → text node
배열 또는 Fragment VNode        → fragment node
tag가 문자열인 VNode            → host node
그 외 객체                      → component node (shell)
```

마지막 분기는 `typeof vnode.tag === 'function'`을 **미리 검사하지 않는다**. 따라서 잘못된 객체도 component shell이 될 수 있고, 실제 setup 시점에 실패한다.

**왜 shell과 setup을 분리하는가?**
- parent/DOM 위치가 확정된 mount 단계에서 context를 설정할 수 있다
- node 생성 자체는 사용자 코드를 실행하지 않아 안전하다
- setup/render 예외가 reconcile 호출자에게 자연스럽게 전파된다

---

## 4. runtime context와 phase

### 왜 context가 필요한가?

`watch()`와 `clean()`은 호출된 시점에 **어떤 컴포넌트의 setup 안에서 실행되고 있는지** 알아야 한다. 이를 위해 모듈 전역 스택을 사용한다:

```js
const runtimeContextStack = [];
```

### `withComponentContext`

```
입력: state, node, phase, callback
1. 이전 currentComponentNode/currentComponentPhase 저장
2. 스택에 state push
3. state.currentComponentNode = node, phase 설정
4. callback 실행
5. finally: 스택 pop, 이전 상태 복원
```

phase 값은 `'setup'`과 `'render'` 두 가지다. **훅 등록은 phase가 `'setup'`일 때만 가능하다.**

스택 구조이므로 서로 다른 앱의 context가 중첩되어도 바깥 context를 올바르게 복원한다. callback이 throw해도 `finally`에서 반드시 복원된다.

---

## 5. 컴포넌트 생명주기

### 5.1 Setup — 최초 마운트 시 한 번

`setupComponentNode(state, node)`의 핵심 동작:

```js
// 이미 setup이 완료되었으면 건너뜀
if (node.renderFactory) return node.renderFactory;

// setup phase context 안에서 컴포넌트 함수 호출
return withComponentContext(state, node, 'setup', () => {
  const renderFactory = node.component(node.props);
  node.renderFactory = renderFactory;
  node.render = renderFactory;
  return renderFactory;
});
```

정상적인 Babel 변환 컴포넌트는 **함수**인 렌더 팩토리를 반환한다. 이 함수 안에 컴포넌트의 local `let` 변수, 등록된 watcher/cleanup, 기타 closure가 유지된다.

**setup 캐시 조건:** `if (node.renderFactory)` — 별도 boolean이 아니라 renderFactory의 truthy 여부로 판단한다.

| 반환값 | 결과 |
|---|---|
| 함수 (정상) | setup 한 번만, 이후 이 함수가 매 렌더마다 호출됨 |
| `null`, `undefined`, `false`, `0`, `''` | 다음 렌더에서 **setup이 다시 실행됨** |
| truthy이지만 함수가 아닌 값 (VNode 등) | 캐시되지만 렌더 결과는 항상 `null` |

### 5.2 Render — 매 tick마다

컴포넌트의 mount와 update 모두 `renderComponentNode`를 사용한다:

```
renderComponentNode(state, parentDom, node, nextProps, beforeDom)
  1. node.props = nextProps || {}
  2. setupComponentNode(state, node)         ← setup (캐시되면 건너뜀)
  3. invokeComponentRenderFactory(...)        ← 렌더 함수 호출
  4. state.reconcile(...)                     ← 결과로 DOM 갱신
  5. commitRenderedNode(node, renderedNode)   ← bookkeeping
  6. node 반환
```

### 5.3 Babel bridge를 통한 정상 렌더 경로

Babel이 만든 렌더 팩토리는 직접 렌더하지 않고, runtime bridge를 호출한다:

```
invokeComponentRenderFactory
  → render context 설정
  → compiled render factory
  → runRenderPhaseBridge
  → runComponentRenderPhase
       1. node.props 최신화
       2. propsTarget의 key를 삭제하고 새 props 할당
       3. watcher 실행
       4. innerRender(node.props) 호출
```

**핵심:** propsTarget 동기화가 watcher보다 먼저 일어나므로, watcher와 render는 **같은 tick의 최신 props**를 본다.

### 5.4 props target 동기화

컴파일러가 만든 props 저장 객체(`propsTarget`)의 동기화 방식:

```js
// 기존 enumerable string key를 모두 삭제
for (const key in propsTarget) delete propsTarget[key];
// 새 props를 복사
if (nextProps) Object.assign(propsTarget, nextProps);
```

**객체의 identity는 유지**된다 — 새 객체를 만드는 것이 아니라 기존 객체의 내용만 교체한다. 이렇게 해야 setup에서 캡처한 참조가 항상 최신 props를 볼 수 있다.

---

## 6. 렌더 결과 commit

subtree reconcile이 **성공한 후에만** 다음 bookkeeping을 수행한다:

```js
node.renderedNode = renderedNode;
node.children = renderedNode ? [renderedNode] : [];
node.firstDom = renderedNode ? renderedNode.firstDom : null;
node.lastDom = renderedNode ? renderedNode.lastDom : null;
```

reconcile이나 render가 throw하면 commit에 도달하지 않는다. 다만 함수 초반에 갱신한 `node.props`나, 이미 변경된 subtree까지 자동 rollback하지는 않는다.

---

## 7. Cleanup — 컴포넌트 제거 시

`cleanupComponentNode(state, node, options)`는 등록된 cleanup을 **등록 순서대로** 실행한다:

```
각 cleanup:
  try: cleanup()
  catch: console.error('[AEUI] Cleanup error:', error)
    → 실패해도 나머지 cleanup 계속 실행

그 뒤 항상:
  watchStates = []
  cleanups = []
  renderedNode = null
  renderFactory = null
  render = null
```

`unmountNode`는 먼저 부모의 cleanup을 실행하고, 그 다음 자식을 재귀적으로 unmount한다. 따라서 **부모 cleanup이 자식 cleanup보다 먼저** 실행된다 (전위 순회).

---

## 8. 생명주기 규칙 요약

| 규칙 | 설명 |
|---|---|
| setup은 한 번 | 정상 컴파일 컴포넌트의 setup은 RuntimeNode가 유지되는 동안 한 번 실행 |
| render는 매 tick | renderFactory는 매 tick마다 실행 |
| 같은 함수+key = 재사용 | 같은 컴포넌트 함수와 같은 key면 RuntimeNode와 closure 상태를 재사용 |
| 다른 함수/key = 새로 시작 | 이전 node를 unmount하고 새 setup 실행 |
| 인스턴스 격리 | 각 컴포넌트 인스턴스의 node/renderFactory/watchStates/cleanups는 독립 |
| context 복원 | setup/render 예외가 나도 context 스택과 currentComponent는 복원됨 |
| cleanup 순서 | 등록 순서대로, 하나가 실패해도 나머지와 자식 정리 계속 |

---

## 9. 검증 요약

- 두 `createAppRuntime` 호출의 state가 서로 독립적
- `createNode`는 component shell만 만들고 setup을 즉시 실행하지 않음
- 정상 컴포넌트의 setup은 반복 tick에도 한 번만 실행됨
- 최신 props가 watcher보다 먼저 동기화됨
- keyed 컴포넌트 reorder가 closure state를 유지함
- setup/render throw 후 current context가 복원됨
- cleanup은 교체/제거/재초기화에서 한 번 실행, 실패해도 나머지 계속
