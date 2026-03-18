# 스케줄러 — `init`, `_tick`, `render`, `_reconcileRoot`

## 개요

AEUI 스케줄러는 `requestAnimationFrame` 기반으로 동작한다. 핵심 목표는 다음 두 가지다.

- 변경이 계속 발생할 때는 빠르게 렌더링
- 변경이 없을 때는 tick 간격을 점진적으로 늘려 불필요한 렌더링 비용 감소

AEUI는 `setState` 트리거 방식이 아니라 Polling(Dirty Checking) 기반이므로, scheduler가 주기적으로 렌더를 시도한다.

최근 구조 정리 이후 public API는 여전히 `AEUI.init()`, `AEUI.render()`, `AEUI._tick()` 형태를 유지하지만, 실제 mutable 값은 `runtime-state.js`의 explicit `runtimeState` 객체에 저장된다. 즉 외부에서 보는 스케줄러 모델은 동일하지만, 내부 구현은 `AEUI` facade와 상태 저장소가 분리된 형태다.

---

## `init(RootComponent, containerElement)`

앱 시작 시점에서 루트 컴포넌트를 마운트하고 RAF 루프를 시작한다.

public surface는 `AEUI.init(RootComponent, containerElement)`이지만, 실제 구현 함수는 내부적으로 `init(state, RootComponent, containerElement)` 형태로 실행된다.

### 동작 순서

```text
1. 기존 scheduler 중지 (_stopScheduler)
2. 기존 루트 node의 자식이 있으면 unmount (_unmountNode)
3. 내부 상태 초기화:
   - state.RootComponent = RootComponent
   - state.containerElement = containerElement
   - state.rootNode = createRootNode(containerElement)
4. containerElement.innerHTML = ''
5. 초기 렌더 1회 실행 (_tick)
6. 초기 렌더 결과에 따라 프레임 간격 설정
7. RAF 루프 시작 (_startScheduler)
```

### 코드

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

---

## `_reconcileRoot()`

`_tick()`에서 호출되는 내부 함수로, **루트 RuntimeNode의 자식을 새 VNode와 비교**한다.

### 동작 순서

```text
1. RootComponent로부터 VNode 생성: createVNode(RootComponent)
2. 현재 root wrapper의 children[0] (이전 루트 child node) 획득
3. _reconcile(containerElement, previousRootChild, rootVNode, null, rootNode) 호출
4. root wrapper의 children, firstDom, lastDom 갱신
```

### 코드

```javascript
export function _reconcileRoot(state) {
  if (!state.rootNode || !state.containerElement || !state.RootComponent) return;

  const rootVNode = state.createVNode(state.RootComponent);
  const previousRootChild = state.rootNode.children[0] || null;
  const nextRootChild = state._reconcile(
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

이전 모델에서는 `_rootInstance.update()`를 호출하여 컴포넌트별로 start index를 계산했지만, 현재 모델에서는 root wrapper node가 루트 child node를 소유하고, `_reconcile`이 `firstDom`/`lastDom` 범위로 DOM 위치를 관리하므로, 인덱스 계산이나 `_getDomNodeCount` 합산이 불필요하다.

---

## `_tick()`

한 번의 렌더 사이클을 수행하고, 실제 변화 여부(`boolean`)를 반환한다.

### 동작

```text
1. 루트 컴포넌트, 컨테이너, root node 존재 여부 확인
2. 재진입 방지: isRendering 가드
3. isRendering = true, didMutate = false 설정
4. _reconcileRoot() 호출
5. 에러 시 console.error 로깅 (렌더링은 중단)
6. isRendering = false 해제
7. didMutate 반환
```

### 코드

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

### 반환값

- `true`: 이번 tick에서 실제 DOM 변경이 있었음
- `false`: 변경 없음

`didMutate` 플래그는 `_reconcile`, `placeNode`, `_updateDomProps` 등의 DOM write 시점에서 설정된다.

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

---

## `_onAnimationFrame()`

RAF 콜백에서 실행되는 루프 본체이다.

### 동작

```text
1. rafId = null
2. 루트 컴포넌트/컨테이너 존재 확인

3. framesUntilNextTick <= 0 이면:
   ├── _tick() 실행
   ├── _tick 중 수동 render() 호출로 rafId가 설정되었으면
   │   → framesUntilNextTick = 0
   └── 아니면:
       ├── didMutate? → frameDelay = 1
       └── !didMutate? → frameDelay = min(frameDelay * 2, 60)
       └── framesUntilNextTick = frameDelay - 1

4. framesUntilNextTick > 0 이면:
   → framesUntilNextTick -= 1

5. _startScheduler() → 다음 RAF 예약
```

### 코드

```javascript
export function _onAnimationFrame(state) {
  state.rafId = null;
  if (!state.RootComponent || !state.containerElement) return;

  if (state.framesUntilNextTick <= 0) {
    const didMutate = state._tick();
    const hasManualRequestDuringTick = state.rafId != null;

    if (hasManualRequestDuringTick) {
      state.framesUntilNextTick = 0;
    } else {
      state.frameDelay = didMutate
        ? 1
        : Math.min(state.frameDelay * 2, MAX_FRAME_DELAY);
      state.framesUntilNextTick = state.frameDelay - 1;
    }
  } else {
    state.framesUntilNextTick -= 1;
  }

  state._startScheduler();
}
```

---

## 수동 렌더 API

### `AEUI.render()`

사용자가 즉시 렌더를 실행할 수 있는 public API이다.

- 내부적으로 `_tick()`을 즉시 수행
- 결과에 따라 프레임 간격을 갱신
- scheduler 루프가 꺼져 있으면 다시 시작

```javascript
export function render(state) {
  if (!state.RootComponent || !state.containerElement) return false;

  const didMutate = state._tick();
  state.frameDelay = didMutate ? 1 : Math.min(state.frameDelay * 2, MAX_FRAME_DELAY);
  state.framesUntilNextTick = state.frameDelay - 1;
  state._startScheduler();
  return didMutate;
}
```

사용 예:

```javascript
import { AEUI } from "aeui";

AEUI.render();
```

---

## runtime state

현재 스케줄러 관련 값은 `runtimeState`에 저장된다.

```javascript
{
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
}
```

호환성을 위해 `AEUI._rootNode`, `AEUI._frameDelay`, `AEUI._didMutate` 같은 legacy underscore accessor는 여전히 존재하지만, 실제 저장소는 `AEUI` object 자체가 아니라 `runtimeState`다.

---

## 관련 코드 위치

- `packages/core/src/runtime.js`
- `packages/core/src/runtime-state.js`
- `packages/core/src/core.js`
