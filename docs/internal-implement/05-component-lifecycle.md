# 05. 컴포넌트 생명주기

이 문서는 AEUI 컴포넌트의 내부 실행 흐름 — setup/render 과정, context 스택, commit과 cleanup을 설명한다.

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

`setupStatus`는 `new → running → done`으로 전이한다. 실패하면 `failed`가 된다. `done`일 때만 캐시한 render 함수를 반환하며, 같은 노드의 setup 재진입과 실패 후 재시도는 거부한다.

1. `component-type.js`에서 원본 함수 값에 연결된 setup을 조회한다.
2. 등록이 없으면 기존 수동 setup으로 간주하고 원본을 호출한다.
3. setup context에서 props를 전달하고 render 함수 반환을 검증한다.
4. VNode·null·Promise 등 비함수 반환은 컴파일 안내 오류로 처리하고 등록된 cleanup을 실행한다. 미컴파일 async setup의 거절된 native Promise도 관찰하여 별도의 unhandled rejection을 남기지 않는다.

최초 render 또는 자식 mount 실패는 reconciler의 mount 경계에서 정리한다. 앞에서 생성했으나 아직 parent children에 commit되지 않은 형제도 정리 대상이다. cleanup 배열은 호출 전에 분리하고 unmount는 `isMounted`로 재진입을 막아 같은 정리를 반복하지 않는다.

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

## 관련 코드 위치

- `packages/core/src/component-lifecycle.js`
- `packages/core/src/runtime-context.js`
- `packages/core/src/compiler-runtime.js`

## 관련 문서

- RuntimeNode 구조: [04. RuntimeNode 관리](04-instance.md)
- Watcher 실행 상세: [15. Watcher 실행](15-watcher.md)
- 스케줄러: [06. 스케줄러](06-scheduler.md)
- 런타임 컨텍스트 상세: [13. 런타임 컨텍스트](13-runtime-context.md)
