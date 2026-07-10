# 03. 컴포넌트 런타임과 RuntimeNode 명세

이 문서는 VNode 입력을 생명주기를 가진 RuntimeNode 트리로 바꾸고, 컴포넌트의 setup/render/props/cleanup을 실행하는 현재 구현을 규정한다. 컴포넌트 함수가 매 렌더마다 호출되는 React식 모델이 아니라, 컴파일러가 만든 render factory를 장기 보관하는 모델임을 전제로 한다.

## 1. 모듈별 책임

| 모듈 | 책임 |
| --- | --- |
| `app-runtime.js` | 독립 runtime state 생성, 공개 API와 compiler-private API 조립 |
| `runtime-state.js` | 앱별 mutable state의 초기 shape와 reset |
| `node-factory.js` | root 및 일반 RuntimeNode shell 생성 |
| `component-lifecycle.js` | component setup, render, commit, cleanup |
| `runtime-context.js` | 현재 runtime/component/phase를 stack으로 관리 |
| `compiler-runtime.js` | Babel 생성 코드와 component lifecycle 사이의 bridge |
| `component-watchers.js` | component watcher 실행 |
| `hook-registry.js` | setup 중 watch/clean 등록 |
| `reconciler.js` | RuntimeNode 재사용/교체 및 subtree 연결 |

## 2. 앱 런타임 인스턴스

`createAppRuntime(config)`는 호출할 때마다 새 state 객체를 만들어 앱 간 mutable 상태를 격리한다.

```js
createAppRuntime({
  deepEqual,
  deepClone,
  createVNode,
  createElement = createVNode,
  Fragment,
})
```

반환되는 공개 객체의 정확한 shape는 다음과 같다.

```js
{
  createVNode,
  createElement,
  Fragment,
  init: (...args) => init(state, ...args),
  render: (...args) => render(state, ...args),
  __runtime: internalRuntime,
}
```

`AEUI` 최상위에는 과거의 `_tick`, `_didMutate` 같은 underscore helper를 노출하지 않는다. `__runtime`은 Babel 출력, router, 테스트가 사용하는 compiler/private surface다.

### 2.1 `__runtime` 메서드 집합

현재 internal runtime에는 다음 항목이 있다.

```text
state, deepEqual, deepClone,
createRootNode, createNode,
requestRender, tick, reconcileRoot,
stopScheduler, startScheduler, onAnimationFrame,
runComponentWatchers, runRenderPhase,
initDirectoryRouter,
createDomNode, updateProps, updateDomProps,
watch, clean,
unmountNode, reconcile, dispatchDomEvent
```

각 함수는 공용 모듈 함수에 이 앱의 `state`를 첫 인자로 바인딩한다. state에도 렌더 경로가 요구하는 helper를 연결한다. 이때 일부 state helper는 `internalRuntime` 메서드를 다시 호출하도록 만든다. 따라서 테스트에서 `internalRuntime.tick` 등을 교체하면 state 경유 호출에도 반영된다.

## 3. RuntimeNode 공통 모델

VNode는 매 render의 입력이고 RuntimeNode는 render 사이에 유지되는 실행 상태다. root를 제외한 기본 shell은 다음 공통 필드를 가진다.

```js
{
  kind: null,
  key: getVNodeKey(vnode),
  vnode,
  parent: parentNode,
  parentDom,
  children: [],
  firstDom: null,
  lastDom: null,
  isMounted: true,
}
```

| 필드 | 계약 |
| --- | --- |
| `kind` | `text`, `host`, `fragment`, `component`; root wrapper만 `root` |
| `key` | sibling matching용 원본 값; nullish key만 `null`로 정규화 |
| `vnode` | 현재 render 입력 |
| `parent` | 논리 RuntimeNode 부모 |
| `parentDom` | 이 node의 DOM range가 직접 속한 DOM 부모 |
| `children` | 논리 자식 RuntimeNode 목록 |
| `firstDom`, `lastDom` | 이 node가 차지하는 직접 형제 DOM 범위 |
| `isMounted` | 생성 시 `true`, unmount 시 `false`; 현재 업데이트 경로가 이 값을 가드로 검사하지는 않음 |

### 3.1 kind별 추가 필드

```js
// text
{ kind: 'text', value: String(vnode), dom: null }

// host
{ kind: 'host', tag: vnode.tag, dom: null, props: vnode.props || {} }

// fragment
{ kind: 'fragment' }

// component
{
  kind: 'component',
  component: vnode.tag,
  props: vnode.props || {},
  watchStates: [],
  cleanups: [],
  renderedNode: null,
  renderFactory: null,
  render: null,
}
```

`render`는 `renderFactory`와 같은 값을 저장하는 호환 alias다. component/fragment는 자체 DOM이 없고 자식 subtree의 range를 전달받는다.

### 3.2 root node

`createRootNode(containerElement)`는 다음 wrapper를 만든다.

```js
{
  kind: 'root',
  key: null,
  vnode: null,
  parent: null,
  parentDom: containerElement,
  children: [],
  firstDom: null,
  lastDom: null,
  isMounted: true,
}
```

root의 `children[0]`만 앱의 루트 component RuntimeNode로 사용한다.

## 4. `createNode` 분류와 지연 setup

`createNode(state, vnode, parentNode, parentDom)`는 shell만 만들며 컴포넌트 함수를 호출하지 않아야 한다.

```text
null/boolean                  -> null
비객체                        -> text node
배열 또는 현재 Fragment VNode -> fragment node
문자열 tag VNode              -> host node
그 외 object                  -> component node
```

마지막 분기는 `typeof vnode.tag === 'function'`을 선검증하지 않는다. 따라서 malformed object도 component shell이 될 수 있고 실제 setup에서 `node.component(...)` 호출이 실패한다.

컴포넌트 shell 생성과 setup 실행을 분리해야 하는 이유는 다음과 같다.

- parent/DOM 위치가 확정된 mount 단계에서 context를 설정할 수 있다.
- node 생성 자체는 사용자 코드를 실행하지 않는다.
- setup/render 예외가 reconcile 호출자에게 자연스럽게 전파된다.

## 5. runtime context와 phase

모듈 전역에는 active runtime state를 담는 stack 하나가 있다.

```js
const runtimeContextStack = [];
```

`getRuntimeContext()`는 stack 마지막 state 또는 `null`을 반환한다.

### 5.1 `withComponentContext`

```text
입력: state, node, phase, callback
1. state의 이전 currentComponentNode/currentComponentPhase 저장
2. stack에 state push
3. state.currentComponentNode = node
4. state.currentComponentPhase = phase
5. callback 실행 및 반환값 전달
6. finally에서 stack pop, 이전 node/phase 복원
```

phase 값은 런타임이 실제로 사용하는 `'setup'`과 `'render'`다. 훅 등록은 node 존재뿐 아니라 phase가 정확히 `'setup'`인지도 확인한다.

stack은 서로 다른 앱 runtime의 context가 중첩되어도 바깥 runtime을 복원해야 한다. callback이 throw해도 `finally`에서 stack과 state 포인터를 반드시 복원한다.

## 6. 컴포넌트 setup

`setupComponentNode(state, node)`의 계약은 다음과 같다.

```js
if (node.renderFactory) return node.renderFactory;

return withComponentContext(state, node, 'setup', () => {
  const renderFactory = node.component(node.props);
  node.renderFactory = renderFactory;
  node.render = renderFactory;
  return renderFactory;
});
```

정상적인 Babel 변환 컴포넌트는 setup 함수 본문을 실행한 뒤 함수인 render factory를 반환하므로 이후 render에서는 setup이 재실행되지 않는다. 컴포넌트의 local `let`, 등록된 watcher/cleanup, 기타 setup closure가 이 함수 객체에 유지된다.

현재 cache 가드는 별도 boolean이 아니라 `if (node.renderFactory)`다. 따라서 아래 경계 동작도 그대로 재현해야 한다.

- 함수 또는 다른 truthy 값을 반환하면 setup은 한 번만 실행된다.
- `null`, `undefined`, `false`, `0`, `''`를 반환하면 다음 render에서 setup이 다시 실행된다.
- truthy지만 함수가 아닌 VNode/object를 반환하면 값은 cache되지만 render 결과는 항상 `null`이 된다.
- 컴파일되지 않은 `return <div />`가 VNode를 직접 반환하는 경우도 마지막 경우에 해당한다. 정상 사용자 경로는 Babel이 이를 render factory로 변환한다.

## 7. 컴포넌트 render의 전체 호출 순서

component mount와 update는 모두 `renderComponentNode`를 사용한다.

```text
renderComponentNode(state, parentDom, node, nextProps, beforeDom)
1. node.props = nextProps || {}
2. setupComponentNode(state, node)
3. invokeComponentRenderFactory(state, node, node.props)
4. state.reconcile(parentDom, node.renderedNode, renderedVNode, beforeDom, node)
5. commitRenderedNode(node, renderedNode)
6. node 반환
```

### 7.1 render factory 호출

`invokeComponentRenderFactory`는 props를 다시 저장하고 다음을 수행한다.

```text
renderFactory와 render 중 truthy 함수를 선택
함수가 아니면 null 반환
함수면 withComponentContext(state, node, 'render', () => render(node.props))
```

즉 render factory에는 항상 현재 props 객체가 첫 인자로 전달된다.

### 7.2 Babel bridge가 포함된 정상 경로

Babel이 만든 render factory는 내부 render를 직접 호출하지 않고 다음 형태의 helper를 호출한다.

```js
AEUI.__runtime.runRenderPhase(nextProps, propsTarget, innerRender)
```

호출 흐름은 다음과 같다.

```text
invokeComponentRenderFactory
  -> render context 설정
  -> compiled render factory
  -> runRenderPhaseBridge
  -> runComponentRenderPhase
       1. node.props 최신화
       2. compiler가 만든 propsTarget의 enumerable string key 삭제 후 nextProps 할당
       3. watcher 실행
       4. innerRender(node.props)
```

`runComponentRenderPhase`가 이미 같은 node의 render context 안에서 실행 중임을 확인하면 context를 다시 push하지 않고 inner render를 직접 호출한다. 다른 context이거나 context가 없으면 새 render context로 감싼다.

### 7.3 props target 동기화

compiler가 setup closure에 만든 `__props` 같은 object를 `propsTarget`이라 한다. 동기화는 객체 identity를 유지하지만, 모든 own key와 descriptor를 완전히 교체하는 연산은 아니다. 현재 구현은 아래 두 JavaScript 연산의 의미를 그대로 가진다.

```js
for (const key in propsTarget) delete propsTarget[key];
if (nextProps) Object.assign(propsTarget, nextProps);
```

삭제 단계의 정확한 의미는 다음과 같다.

- `for...in`은 `propsTarget`에서 보이는 enumerable string key를 순회한다. Symbol key와 non-enumerable own string key는 순회하지 않는다.
- 순회된 own configurable property는 삭제된다. 상속된 enumerable key도 순회될 수 있지만 `delete propsTarget[key]`는 prototype의 property를 삭제하지 않으므로 계속 상속되어 보인다.
- ES module의 strict mode에서 순회된 own property가 non-configurable이면 `delete`가 `TypeError`를 throw할 수 있다.

할당 단계의 정확한 의미는 다음과 같다.

- `nextProps`가 truthy일 때만 `Object.assign`을 실행한다.
- `Object.assign`은 `nextProps`의 enumerable own string key와 enumerable own Symbol key를 읽어 target에 할당한다. descriptor 자체는 복제하지 않으며 getter와 setter가 실행될 수 있다.
- 삭제 단계에서 제외된 기존 Symbol key와 non-enumerable own key는 같은 key가 할당 단계에서 덮어써지지 않는 한 남는다. 특히 이전 enumerable Symbol prop이 다음 props에서 빠져도 현재 코드만으로는 삭제되지 않는다.

`propsTarget`이 null이거나 `typeof !== 'object'`면 아무 일도 하지 않는다. compiler가 정상적으로 만드는 plain object와 일반 JSX string-key props 경로에서는 결과적으로 이전 enumerable own string props가 제거되고 다음 props가 채워진다. 하지만 이를 일반적인 의미의 “내용 완전 교체”로 확대해서는 안 된다. 이 동기화가 watcher보다 먼저 일어나므로 watcher와 render는 같은 tick의 최신 일반 props를 본다.

### 7.4 bridge fallback

`runRenderPhaseBridge` 호출 시 `state.currentComponentNode`가 없으면 다음 fallback만 수행한다.

```js
typeof render === 'function' ? render(nextProps || {}) : null
```

이 경로는 `propsTarget`을 동기화하지 않고 watcher도 실행하지 않는다.

## 8. render 결과 commit

subtree reconcile이 성공한 뒤에만 다음 bookkeeping을 commit한다.

```js
node.renderedNode = renderedNode;
node.children = renderedNode ? [renderedNode] : [];
node.firstDom = renderedNode ? renderedNode.firstDom : null;
node.lastDom = renderedNode ? renderedNode.lastDom : null;
```

컴포넌트가 `null`/boolean을 렌더하면 `renderedNode`와 children은 비고 DOM range도 `null`이다. Fragment나 여러 DOM을 렌더하면 component의 range는 subtree의 첫/마지막 DOM을 그대로 사용한다.

reconcile 또는 render가 throw하면 commit 단계에 도달하지 않는다. 다만 함수 앞부분에서 갱신한 `node.props`나 호출 중 이미 변경된 기존 subtree까지 자동 rollback하지는 않는다. root-level 실패 정리는 새로 남은 DOM을 제거하는 제한된 방어이며 전체 상태 트랜잭션이 아니다.

## 9. cleanup

`cleanupComponentNode(state, node, options)`는 component가 소유한 cleanup을 등록 순서대로 실행한다.

```text
각 cleanup:
  try cleanup()
  catch -> console.error('[AEUI] Cleanup error:', error)

그 뒤 항상:
  watchStates = []
  cleanups = []
  renderedNode = null
  renderFactory = null
  render = null

preserveChildren !== true 이면 children = []
preserveDomRange !== true 이면 firstDom = lastDom = null
```

cleanup 하나가 실패해도 나머지 cleanup은 계속 실행한다. 별도 callback 타입 검증은 등록 시점에 하지 않으므로 비함수 값이 등록되면 unmount 때 호출 오류로 기록되고 정리는 계속된다.

`unmountNode`는 component cleanup을 먼저 실행하되 `{ preserveChildren: true, preserveDomRange: true }`를 넘긴다. 그 뒤 자식들을 재귀 unmount하고 DOM range를 제거한 다음 공통 필드를 비운다. 따라서 cleanup 순서는 부모 component가 자식 component보다 먼저인 전위 순회다.

## 10. 생명주기 불변식과 경계

- 정상 compiled component의 setup은 RuntimeNode가 유지되는 동안 한 번, render factory는 매 tick마다 실행된다.
- 같은 component 함수와 같은 key가 매칭되면 RuntimeNode와 closure state를 재사용한다.
- component 함수 또는 key가 달라지면 이전 node를 unmount하고 새 setup을 실행한다.
- component instance별 node/render factory/watchStates/cleanups가 독립되어야 한다.
- setup/render 예외가 나도 context stack과 `currentComponentNode/currentComponentPhase`는 복원되어야 한다.
- `isMounted`는 현재 관찰 상태일 뿐 render/update를 차단하는 독립 가드는 아니다.
- host/text node를 일반 unmount해도 `node.dom` 필드 자체는 null로 지우지 않는다. DOM range와 children은 지우며, 실패한 host mount 경로만 추가로 `node.dom = null`을 수행한다.

## 11. 검증 계약

재구현은 적어도 다음을 입증해야 한다.

- 두 `createAppRuntime` 호출의 state가 서로 다르다.
- `createNode`는 component shell만 만들고 setup을 즉시 실행하지 않는다.
- 정상 component setup은 반복 tick에도 한 번만 실행된다.
- 최신 props가 watcher보다 먼저 동기화되고 같은 render에 반영된다.
- keyed component reorder가 closure state를 유지한다.
- 중첩된 서로 다른 runtime context가 바깥 context를 복원한다.
- setup/render throw 뒤 current context가 남지 않는다.
- cleanup은 교체/조건부 제거/root 재초기화에서 한 번 실행되고, 하나가 throw해도 나머지와 자식 정리가 계속된다.

현재 구현의 참고 근거는 `component-lifecycle.test.js`, `runtime-context.test.js`, `runtime-state.test.js`, `app-runtime.test.js`, `component.test.jsx`, `dom.test.js`다. 이 기존 테스트들은 새 문서 우선 적합성 suite가 아니며, 이 장의 계약은 새 suite에서 처음부터 다시 검증한다.
