# 스케줄러 — `runtimeState`, `init`, `_tick`

## 개요

현재 AEUI 스케줄러의 핵심 변화는 **mutable runtime 상태가 `AEUI` facade 밖으로 분리되었다는 점**이다.

- public facade: `core.js`
- 실제 상태 저장소: `runtime-state.js`
- 스케줄러 구현: `runtime.js`

`AEUI.init()`, `AEUI.render()`, `AEUI._tick()` 같은 public API는 그대로 유지되지만, 실제 값은 모두 `runtimeState`를 통해 읽고 쓴다.

---

## `runtimeState`

`createRuntimeState()`는 스케줄러와 reconcile 루프가 공유하는 명시적 상태 객체를 만든다.

```javascript
const state = {
  deepEqual,
  deepClone,
  rootNode: null,
  containerElement: null,
  RootComponent: null,
  currentComponentNode: null,
  currentInstance: null,
  isRendering: false,
  rafId: null,
  frameDelay: 1,
  framesUntilNextTick: 0,
  didMutate: false,
};
```

호환성을 위해 `_rootNode`, `_frameDelay`, `_didMutate` 같은 legacy underscore accessor도 state와 `AEUI` facade 양쪽에 남겨 두었다. 다만 새 구현은 underscore field를 직접 소유하지 않고 proxy만 제공한다.

---

## `core.js`의 역할

`core.js`는 더 이상 상태를 직접 관리하지 않는다. 지금은 다음 역할만 맡는다.

- `createVNode`, `Fragment` 같은 public API 노출
- `runtimeState` 생성
- `runtime.js`, `reconciler.js`, `component-lifecycle.js` 함수를 state-bound facade로 연결
- Babel이 호출할 `_runRenderPhase()` 진입점 노출

즉, `AEUI`는 "실제 엔진"이라기보다 런타임 모듈들을 묶는 얇은 public facade에 가까워졌다.

---

## `init(state, RootComponent, containerElement)`

초기화 순서는 이전과 비슷하지만 이제 항상 explicit state 인자를 받는다.

```javascript
export function init(state, RootComponent, containerElement) {
  state._stopScheduler();

  if (state.rootNode && state.rootNode.children[0]) {
    state._unmountNode(state.rootNode.children[0]);
  }

  state.RootComponent = RootComponent;
  state.containerElement = containerElement;
  state.rootNode = createRootNode(containerElement);
  containerElement.innerHTML = '';

  const didMutate = state._tick();
  state.frameDelay = didMutate ? 1 : 2;
  state.framesUntilNextTick = state.frameDelay - 1;

  state._startScheduler();
}
```

포인트는 `_tick()`, `_startScheduler()`도 직접 함수 호출이 아니라 `state`에 바인딩된 entrypoint를 통해 호출된다는 점이다. 이 구조 덕분에 facade spy 기반 테스트와 내부 모듈 분리가 동시에 유지된다.

---

## `_reconcileRoot(state)`

루트 reconcile은 단순하다.

```text
1. RootComponent로 rootVNode 생성
2. 기존 root child 조회
3. state._reconcile(...) 실행
4. rootNode.children / firstDom / lastDom 갱신
```

root wrapper는 계속 DOM 범위 anchor 역할만 담당한다.

---

## `_tick(state)`

한 번의 render cycle을 수행하고 DOM mutation 여부를 반환한다.

```javascript
export function _tick(state) {
  if (!state.RootComponent || !state.containerElement || !state.rootNode) return false;
  if (state.isRendering) return false;

  state.isRendering = true;
  state.didMutate = false;

  try {
    _reconcileRoot(state);
  } catch (e) {
    console.error('[AEUI] Render error:', e);
  } finally {
    state.isRendering = false;
  }

  return state.didMutate;
}
```

`isRendering`은 재진입 방지용이고, `didMutate`는 host/text/child placement 단계에서 DOM write가 일어났는지 누적한다.

---

## RAF 루프

적응형 scheduler 정책은 그대로 유지된다.

- mutation 발생: 다음 tick을 1 frame 뒤에 실행
- mutation 없음: `1 -> 2 -> 4 -> ... -> 60` 프레임으로 backoff

핵심 함수:

- `_startScheduler(state)`
- `_stopScheduler(state)`
- `_onAnimationFrame(state)`
- `render(state)`

`render(state)`는 수동 렌더 public API이고, 내부적으로 `_tick()` 후 scheduler 상태를 다시 맞춘다.

---

## 왜 단순해졌는가

이전에는 `AEUI` object가 public API와 internal mutable state를 동시에 소유했다. 지금은:

- 상태: `runtimeState`
- 스케줄러 로직: `runtime.js`
- public 진입점: `AEUI facade`

로 분리되어 각 파일의 책임이 더 명확하다. 특히 테스트에서는 state shape 자체를 별도로 검증할 수 있고, runtime 함수는 mock state로도 이해하기 쉬워졌다.

---

## 관련 코드 위치

- `packages/core/src/runtime-state.js`
- `packages/core/src/runtime.js`
- `packages/core/src/core.js`
