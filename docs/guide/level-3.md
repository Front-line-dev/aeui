# Level 3 — AEUI 내부 구조

> 이 문서는 AEUI 내부 수정자를 위한 요약 가이드다. 현재 코어는 "퍼블릭 API + internal runtime + 세부 엔진 모듈" 구조로 분리되어 있다.

## 코드 구조

```text
packages/core/src/
├── app-runtime.js         runtime state binding / default runtime 조립
├── core.js                default runtime export
├── runtime-state.js       mutable runtime state shape / reset
├── runtime.js             scheduler, root reconcile, DOM event dispatch
├── runtime-context.js     현재 component/phase 컨텍스트
├── node-factory.js        RuntimeNode shell 생성
├── reconciler.js          RuntimeNode diff / DOM range placement / unmount
├── dom-host.js            DOM 생성, prop patch, controlled prop sync
├── component-lifecycle.js component setup / render / cleanup orchestration
├── component-watchers.js  watcher 실행 엔진
├── compiler-runtime.js    Babel plugin이 호출하는 작은 런타임 ABI
├── hooks.js               watch, clean fallback 훅
├── babel-plugin.js        Babel 변환 플러그인
└── index.js               re-export
```

## 핵심 모델

- `createVNode()`는 매 렌더마다 새 입력 명세를 만든다.
- `node-factory.js`는 `text | host | component | fragment | root` RuntimeNode shell을 만든다.
- `component` node의 setup은 `createNode()` 시점이 아니라 `component-lifecycle.js`에서 지연 실행된다.
- `core.js`는 default runtime instance 자체를 `AEUI`로 export한다.
- `app-runtime.js`가 public `AEUI`와 internal `AEUI.__runtime`을 조립한다.
- compiled `watch/clean`은 runtime helper(`AEUI.__runtime.watch`, `AEUI.__runtime.clean`)를 타고, `runtime-context.js`는 fallback 경로에서만 active runtime stack을 제공한다.
- hook state는 component node에만 존재하고, `watch/clean`은 `setup` phase에서만 등록된다.
- 실제 DOM 조작은 `dom-host.js`와 `reconciler.js`가 담당한다.

## 렌더 흐름

```text
AEUI.init()
  └── runtime.js:init()
      └── createRootNode(container)
      └── tick()
          └── reconcileRoot()
              └── createVNode(RootComponent)
              └── reconcile(container, oldRootChild, newRootVNode, null, rootNode)
                  ├── createNode()로 shell 생성
                  ├── host/fragment/text는 즉시 mount/update
                  └── component는 renderComponentNode()로 setup/render/orchestrate
```

컴포넌트 node는 다음 규칙으로 갱신된다.

1. 첫 mount 시 `setupComponentNode()`가 setup을 1회 실행해 render factory를 저장한다.
2. render 시 Babel wrapper가 `AEUI.__runtime.runRenderPhase()`를 호출한다.
3. `compiler-runtime.js`와 `component-lifecycle.js`가 props 동기화, watcher 실행, render 호출 순서를 보장한다.
4. render 결과 VNode subtree는 `reconciler.js`가 이전 `renderedNode`와 diff한다.

## Scheduler와 DOM 이벤트

- polling 루프는 `runtime.js`가 유지한다.
- AEUI가 소유한 DOM 이벤트는 `dom-host.js`의 proxy listener를 거쳐 `runtime.js:dispatchDomEvent()`로 들어간다.
- 가장 바깥 DOM 이벤트가 끝나면 `requestRender()`가 interactive render 요청을 남기고, 다음 프레임에서 polling backoff를 건너뛴다.
- `setTimeout`, `await`, 외부 store mutation 같은 비동기 변경은 계속 polling fallback이 감지한다.

## 문서 인덱스

- [vdom.md](../internals/core/vdom.md)
- [instance.md](../internals/core/instance.md)
- [scheduler.md](../internals/core/scheduler.md)
- [reconciler.md](../internals/core/reconciler.md)
- [dom.md](../internals/core/dom.md)
- [watcher.md](../internals/core/watcher.md)
- [unmount.md](../internals/core/unmount.md)
