# 03. 컴포넌트 내부

이 문서는 AEUI 컴포넌트의 내부 실행 흐름 — RuntimeNode 구조, setup/render 과정, context 스택, commit과 cleanup을 설명한다.

---

## RuntimeNode 구조

VNode은 매 렌더의 **설계도**(입력)이고, RuntimeNode는 렌더 사이에 **유지되는** 실행 상태이다.

### 공통 필드

```js
{
  kind: null,          // 'text', 'host', 'fragment', 'component', 'root'
  key: null,           // sibling 매칭용
  vnode,               // 현재 렌더의 VNode
  parent: parentNode,  // 논리적 부모
  parentDom,           // DOM 부모
  children: [],
  firstDom: null,
  lastDom: null,
  isMounted: true,
}
```

### kind별 추가 필드

```js
// text
{ kind: 'text', value: String(vnode), dom: null }

// host
{ kind: 'host', tag: vnode.tag, dom: null, props: vnode.props || {} }

// fragment
{ kind: 'fragment' }

// component — 핵심
{
  kind: 'component',
  component: vnode.tag,        // 컴포넌트 함수
  props: vnode.props || {},
  watchStates: [],             // 등록된 watcher 목록
  cleanups: [],                // 등록된 cleanup 함수 목록
  renderedNode: null,          // 렌더 결과 RuntimeNode
  renderFactory: null,         // setup이 반환한 렌더 함수
  render: null,                // renderFactory alias
}
```

---

## Runtime Context 스택

`watch()`와 `clean()`은 호출 시점에 **어떤 컴포넌트의 setup 안에서 실행 중인지** 알아야 한다. 이를 위해 모듈 전역 스택을 사용한다:

```js
const runtimeContextStack = [];
```

### withComponentContext

```
입력: state, node, phase, callback
1. 이전 currentComponentNode/phase 저장
2. 스택에 state push
3. state.currentComponentNode = node, phase 설정
4. callback 실행
5. finally: 스택 pop, 이전 상태 복원
```

phase 값은 `'setup'`과 `'render'` 두 가지. **훅 등록은 `'setup'` phase에서만 가능**하다.

스택 구조이므로 서로 다른 앱의 context가 중첩되어도 복원이 보장된다. callback이 throw해도 `finally`에서 복원된다.

---

## Setup — 최초 마운트 시

```js
function setupComponentNode(state, node) {
  if (node.renderFactory) return node.renderFactory;  // 캐시

  return withComponentContext(state, node, 'setup', () => {
    const renderFactory = node.component(node.props);
    node.renderFactory = renderFactory;
    node.render = renderFactory;
    return renderFactory;
  });
}
```

정상적인 Babel 변환 컴포넌트는 **함수**인 렌더 팩토리를 반환한다.

| 반환값 | 결과 |
|---|---|
| 함수 (정상) | 캐시, 이후 매 렌더마다 호출 |
| falsy (`null`, `0`, `''`) | 캐시 안 됨 → 다음 렌더에서 setup 재실행 |
| truthy + 비함수 (VNode 등) | 캐시되지만 render 결과 항상 null |

**캐시 조건:** `if (node.renderFactory)` — boolean이 아니라 truthy 여부로 판단.

---

## Render — 매 tick마다

```
renderComponentNode(state, parentDom, node, nextProps, beforeDom)
  1. node.props = nextProps || {}
  2. setupComponentNode()          ← setup (캐시면 건너뜀)
  3. invokeComponentRenderFactory  ← 렌더 함수 호출
  4. state.reconcile()             ← 결과로 DOM 갱신
  5. commitRenderedNode()          ← bookkeeping
  6. node 반환
```

### Babel Bridge를 통한 렌더 실행 경로

```
invokeComponentRenderFactory
  → render context 설정
  → compiled render factory
  → runRenderPhaseBridge
  → runComponentRenderPhase
       1. node.props 최신화
       2. propsTarget 동기화 (delete-then-assign)
       3. watcher 실행
       4. innerRender(node.props) 호출
```

**propsTarget 동기화가 watcher보다 먼저** 일어나므로, watcher와 render는 같은 tick의 **최신 props**를 본다.

### propsTarget 동기화 방식

```js
for (const key in propsTarget) delete propsTarget[key];
if (nextProps) Object.assign(propsTarget, nextProps);
```

**객체 identity 유지** — 새 객체를 만들지 않고 기존 객체의 내용만 교체한다. setup에서 캡처한 참조가 항상 최신 props를 볼 수 있다.

---

## Commit — 렌더 성공 후 bookkeeping

subtree reconcile이 **성공한 후에만** 실행:

```js
node.renderedNode = renderedNode;
node.children = renderedNode ? [renderedNode] : [];
node.firstDom = renderedNode ? renderedNode.firstDom : null;
node.lastDom = renderedNode ? renderedNode.lastDom : null;
```

reconcile이 throw하면 commit에 도달하지 않는다. 단, 이미 변경된 `node.props`나 subtree는 자동 rollback되지 않는다.

---

## Cleanup — 컴포넌트 제거 시

```
cleanupComponentNode(state, node, options)
  각 cleanup:
    try: cleanup()
    catch: console.error('[AEUI] Cleanup error:', error)
  
  항상:
    watchStates = []
    cleanups = []
    renderedNode = null
    renderFactory = null
    render = null
```

`unmountNode`는 **부모 cleanup → 자식 cleanup** 순서 (전위 순회). 하나가 실패해도 나머지 cleanup과 자식 재귀 unmount를 계속한다.

---

## 생명주기 규칙 요약

| 규칙 | 설명 |
|---|---|
| setup 1회 | RuntimeNode 유지 동안 한 번 |
| render 매 tick | renderFactory 반복 호출 |
| 같은 함수+key = 재사용 | RuntimeNode와 closure 상태 보존 |
| 다른 함수/key = 새로 시작 | unmount → 새 setup |
| 인스턴스 격리 | 각 인스턴스의 node/watchStates/cleanups 독립 |
| context 복원 | throw 후에도 context 스택 복원 |
| cleanup 순서 | 등록 순서대로, 실패해도 나머지 계속 |

---

## 관련 문서

- Watcher 실행 상세: [04. 스케줄러와 Dirty Checking](04-scheduler-and-dirty-checking.md)
- 원본 명세: [spec 03](../spec/03-component-runtime.md)
