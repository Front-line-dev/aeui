# 스케줄러 — `init`, `tick`, `render`, `requestRender`, `reconcileRoot`

## 개요

AEUI 스케줄러는 `requestAnimationFrame` 기반으로 동작한다. 핵심 목표는 다음 두 가지다.

- 변경이 계속 발생할 때는 빠르게 렌더링
- 변경이 없을 때는 tick 간격을 점진적으로 늘려 불필요한 렌더링 비용 감소

AEUI는 `setState` 트리거 방식이 아니라 Dirty Checking 기반이므로, 스케줄러는 두 경로를 함께 사용한다.

- **DOM 이벤트 fast path**: AEUI가 등록한 DOM 이벤트가 끝나면 `requestRender()`가 다음 프레임 렌더를 앞당긴다.
- **polling fallback**: DOM 이벤트 밖에서 일어난 변경은 RAF 루프가 주기적으로 `tick()`을 실행하며 감지한다.

public API는 `AEUI.init()`과 `AEUI.render()`만 노출하고, compiler/private 진입점은 `AEUI.__runtime` 아래에 둔다. mutable 값은 `runtime-state.js`의 explicit runtime state 객체에 저장된다.

---

## `init(RootComponent, containerElement)`

앱 시작 시점에서 루트 컴포넌트를 마운트하고 RAF 루프를 시작한다.

public surface는 `AEUI.init(RootComponent, containerElement)`이지만, 실제 구현 함수는 내부적으로 `init(state, RootComponent, containerElement)` 형태로 실행된다.

### 동작 순서

```text
1. 기존 scheduler 중지 (stopScheduler)
2. 기존 루트 node의 자식이 있으면 unmount (unmountNode)
3. 내부 상태 초기화:
   - state.RootComponent = RootComponent
   - state.containerElement = containerElement
   - state.rootNode = createRootNode(containerElement)
4. containerElement.innerHTML = ''
5. 초기 렌더 1회 실행 (tick)
6. 초기 렌더 결과에 따라 프레임 간격 설정
7. RAF 루프 시작 (startScheduler)
```

### 코드

```javascript
export function init(state, RootComponent, containerElement) {
  state.stopScheduler();
  if (state.rootNode && state.rootNode.children[0]) {
    state.unmountNode(state.rootNode.children[0]);
  }

  state.RootComponent = RootComponent;
  state.containerElement = containerElement;
  state.rootNode = state.createRootNode(containerElement);
  containerElement.innerHTML = '';
  state.interactiveRenderRequested = false;

  const didMutate = state.tick();
  computeNextPollingDelay(state, didMutate);

  state.startScheduler();
}
```

---

## `reconcileRoot()`

`tick()`에서 호출되는 내부 함수로, **루트 RuntimeNode의 자식을 새 VNode와 비교**한다.

### 동작 순서

```text
1. RootComponent로부터 VNode 생성: createVNode(RootComponent)
2. 현재 root wrapper의 children[0] (이전 루트 child node) 획득
3. reconcile(containerElement, previousRootChild, rootVNode, null, rootNode) 호출
4. root wrapper의 children, firstDom, lastDom 갱신
```

### 코드

```javascript
export function reconcileRoot(state) {
  if (!state.rootNode || !state.containerElement || !state.RootComponent) return;

  const rootVNode = state.createVNode(state.RootComponent);
  const previousRootChild = state.rootNode.children[0] || null;
  const nextRootChild = state.reconcile(
    state.containerElement,
    previousRootChild,
    rootVNode,
    null,
    state.rootNode
  );

  state.rootNode.children = nextRootChild ? [nextRootChild] : [];
  state.rootNode.firstDom = nextRootChild ? nextRootChild.firstDom : null;
  state.rootNode.lastDom = nextRootChild ? nextRootChild.lastDom : null;
}
```

root wrapper node가 루트 child node를 소유하고, `reconcile`이 `firstDom`/`lastDom` 범위로 DOM 위치를 관리하므로, 인덱스 계산이나 `_getDomNodeCount` 합산이 필요하지 않다.

---

## `tick()`

한 번의 렌더 사이클을 수행하고, 실제 변화 여부(`boolean`)를 반환한다.

### 동작

```text
1. 루트 컴포넌트, 컨테이너, root node 존재 여부 확인
2. 재진입 방지: isRendering 가드
3. isRendering = true, didMutate = false 설정
4. reconcileRoot() 호출
5. 에러 시 console.error 로깅 (렌더링은 중단)
6. isRendering = false 해제
7. didMutate 반환
```

### 코드

```javascript
export function tick(state) {
  if (!state.RootComponent || !state.containerElement || !state.rootNode) return false;
  if (state.isRendering) return false;

  state.isRendering = true;
  state.didMutate = false;

  try {
    reconcileRoot(state);
  } catch (e) {
    console.error('[AEUI] Render error:', e);
  } finally {
    state.isRendering = false;
  }

  return state.didMutate;
}
```

### 반환값

- `true`: 이번 tick에서 실제 DOM 변경이 있었음
- `false`: 변경 없음

`didMutate` 플래그는 `reconcile`, `placeNode`, `updateDomProps` 등의 DOM write 시점에서 설정된다.

---

## 적응형 프레임 간격

스케줄러는 `frameDelay`를 프레임 단위로 관리한다.

- 변화 있음: 다음 tick을 **1프레임 뒤** 실행
- 변화 없음: `1 -> 2 -> 4 -> 8 -> ...` 식으로 증가
- 최대값: **60프레임** (`MAX_FRAME_DELAY`)

즉, 렌더 결과에 실제 DOM 변화가 없으면 점점 드물게 tick을 실행하고, 변화가 다시 생기면 즉시 빠른 주기로 복귀한다.

```text
프레임:  1   2   3   4   5   6   7   8   9   10  ...
         T   T   _   T   _   _   _   T   _   _   ...
         ↑       ↑       ↑               ↑
         변화O   변화X   변화X             변화X
         간격1   간격2   간격4             간격8
```

DOM 이벤트 fast path는 이 backoff를 없애지 않고, 다음 예정 렌더를 **1프레임 뒤로 앞당기는** 역할만 한다. 따라서 이벤트 후 렌더도 여전히 RAF 경계에서 실행된다.

---

## `requestRender()`

`requestRender()`는 internal helper로, 다음 렌더를 빠른 경로로 예약한다. DOM 이벤트 핸들러가 끝난 뒤 호출되는 표준 진입점이며, polling backoff와 분리된 **interactive render 요청**을 남긴다.

### 동작

```text
1. 루트 컴포넌트/컨테이너/root node 존재 여부 확인
2. `interactiveRenderRequested = true`
3. `startScheduler()` 호출
```

### 코드

```javascript
export function requestRender(state) {
  if (!state.RootComponent || !state.containerElement || !state.rootNode) {
    return false;
  }

  state.interactiveRenderRequested = true;
  state.startScheduler();
  return true;
}
```

이 함수는 `tick()`을 즉시 실행하지 않는다. 이벤트 핸들러의 동기 실행이 끝난 뒤, 다음 animation frame에서 안전하게 전체 루트 렌더를 다시 돌리는 것이 목적이다.

---

## `onAnimationFrame()`

RAF 콜백에서 실행되는 루프 본체이다.

### 동작

```text
1. rafId = null
2. 루트 컴포넌트/컨테이너 존재 확인

3. interactiveRenderRequested 이면:
   ├── flag를 내리고 tick() 실행
   ├── tick 중 다시 requestRender()가 들어오면 → framesUntilNextTick = 0
   └── 아니면 polling backoff를 다시 계산

4. interactiveRenderRequested 가 아니고 framesUntilNextTick <= 0 이면:
   ├── polling 경로의 tick() 실행
   ├── tick 중 requestRender()가 들어오면 → framesUntilNextTick = 0
   └── 아니면 polling backoff를 다시 계산

5. framesUntilNextTick > 0 이면:
   → framesUntilNextTick -= 1

6. startScheduler() → 다음 RAF 예약
```

### 코드

```javascript
export function onAnimationFrame(state) {
  state.rafId = null;
  if (!state.RootComponent || !state.containerElement) return;

  if (state.interactiveRenderRequested) {
    state.interactiveRenderRequested = false;
    const didMutate = state.tick();
    if (state.interactiveRenderRequested) {
      state.frameDelay = 1;
      state.framesUntilNextTick = 0;
    } else {
      computeNextPollingDelay(state, didMutate);
    }
    state.startScheduler();
    return;
  }

  if (state.framesUntilNextTick <= 0) {
    const didMutate = state.tick();
    if (state.interactiveRenderRequested) {
      state.frameDelay = 1;
      state.framesUntilNextTick = 0;
    } else {
      computeNextPollingDelay(state, didMutate);
    }
  } else {
    state.framesUntilNextTick -= 1;
  }

  state.startScheduler();
}
```

---

## 수동 렌더 API

### `AEUI.render()`

사용자가 즉시 렌더를 실행할 수 있는 public API이다.

- 내부적으로 `tick()`을 즉시 수행
- 결과에 따라 프레임 간격을 갱신
- scheduler 루프가 꺼져 있으면 다시 시작

```javascript
export function render(state) {
  if (!state.RootComponent || !state.containerElement) return false;

  state.interactiveRenderRequested = false;
  const didMutate = state.tick();
  computeNextPollingDelay(state, didMutate);
  state.startScheduler();
  return didMutate;
}
```

사용 예:

```javascript
import { AEUI } from "aeui";

AEUI.render();
```

`AEUI.render()`는 사용자가 **즉시 동기 렌더**를 강제하는 API이고, `requestRender()`는 DOM 이벤트 종료 후 **다음 프레임 렌더**를 예약하는 내부 API라는 차이가 있다.

---

## runtime state

스케줄러 관련 값은 `runtimeState`에 저장된다.

```javascript
{
  rootNode: null,
  containerElement: null,
  RootComponent: null,
  currentComponentNode: null,
  currentComponentPhase: null,
  isRendering: false,
  rafId: null,
  frameDelay: 1,
  framesUntilNextTick: 0,
  didMutate: false,
  domEventDepth: 0,
  interactiveRenderRequested: false,
}
```

이 값들은 public `AEUI` top level에 proxy로 복제되지 않는다. 내부 상태를 직접 봐야 하는 경우에만 `AEUI.__runtime.state`를 사용한다.

---

## 관련 코드 위치

- `packages/core/src/runtime.js`
- `packages/core/src/runtime-state.js`
- `packages/core/src/core.js`
