# 스케줄러 — `init`, `_tick`, `render`, `_reconcileRoot`

## 개요

AEUI 스케줄러는 `requestAnimationFrame` 기반으로 동작한다. 핵심 목표는 다음 두 가지다.

- 변경이 계속 발생할 때는 빠르게 렌더링
- 변경이 없을 때는 tick 간격을 점진적으로 늘려 불필요한 렌더링 비용 감소

AEUI는 `setState` 트리거 방식이 아니라 Polling(Dirty Checking) 기반이므로, scheduler가 주기적으로 렌더를 시도한다.

---

## `init(RootComponent, containerElement)`

앱 시작 시점에서 루트 컴포넌트를 마운트하고 RAF 루프를 시작한다.

### 동작 순서

```
1. 기존 scheduler 중지 (_stopScheduler)
2. 기존 루트 node의 자식이 있으면 unmount (_unmountNode)
3. 내부 상태 초기화:
   - _RootComponent = RootComponent
   - _containerElement = containerElement
   - _rootNode = createRootNode(containerElement)  ← root wrapper 생성
4. containerElement.innerHTML = ''  (기존 DOM 제거)
5. 초기 렌더 1회 실행 (_tick)
6. 초기 렌더 결과에 따라 프레임 간격 설정
7. RAF 루프 시작 (_startScheduler)
```

### 코드

```javascript
export function init(RootComponent, containerElement) {
  this._stopScheduler();
  if (this._rootNode && this._rootNode.children[0]) {
    this._unmountNode(this._rootNode.children[0]);
  }

  this._RootComponent = RootComponent;
  this._containerElement = containerElement;
  this._rootNode = createRootNode(containerElement);
  containerElement.innerHTML = '';

  const didMutate = this._tick();
  this._frameDelay = didMutate ? 1 : 2;
  this._framesUntilNextTick = this._frameDelay - 1;

  this._startScheduler();
}
```

---

## `_reconcileRoot()`

`_tick()`에서 호출되는 내부 함수로, **루트 RuntimeNode의 자식을 새 VNode과 비교**한다.

### 동작 순서

```
1. RootComponent로부터 VNode 생성: createVNode(RootComponent)
2. 현재 root wrapper의 children[0] (이전 루트 child node) 획득
3. _reconcile(containerElement, previousRootChild, rootVNode, null, rootNode) 호출
4. root wrapper의 children, firstDom, lastDom 갱신
```

### 코드

```javascript
export function _reconcileRoot() {
  if (!this._rootNode || !this._containerElement || !this._RootComponent) return;

  const rootVNode = this.createVNode(this._RootComponent);
  const previousRootChild = this._rootNode.children[0] || null;
  const nextRootChild = this._reconcile(
    this._containerElement,
    previousRootChild,
    rootVNode,
    null,
    this._rootNode
  );

  this._rootNode.children = nextRootChild ? [nextRootChild] : [];
  this._rootNode.firstDom = nextRootChild ? nextRootChild.firstDom : null;
  this._rootNode.lastDom = nextRootChild ? nextRootChild.lastDom : null;
}
```

이전 모델에서는 `_rootInstance.update()`를 호출하여 컴포넌트별로 start index를 계산했지만, 현재 모델에서는 root wrapper node가 루트 child node를 소유하고, `_reconcile`이 `firstDom`/`lastDom` 범위로 DOM 위치를 관리하므로, 인덱스 계산이나 `_getDomNodeCount` 합산이 불필요하다.

---

## `_tick()`

한 번의 렌더 사이클을 수행하고, 실제 변화 여부(`boolean`)를 반환한다.

### 동작

```
1. 루트 컴포넌트, 컨테이너, root node 존재 여부 확인
2. 재진입 방지: _isRendering 가드
3. _isRendering = true, _didMutate = false 설정
4. _reconcileRoot() 호출
5. 에러 시 console.error 로깅 (렌더링은 중단)
6. _isRendering = false 해제
7. _didMutate 반환
```

### 코드

```javascript
export function _tick() {
  if (!this._RootComponent || !this._containerElement || !this._rootNode) return false;
  if (this._isRendering) return false;

  this._isRendering = true;
  this._didMutate = false;

  try {
    this._reconcileRoot();
  } catch (e) {
    console.error('[AEUI] Render error:', e);
  } finally {
    this._isRendering = false;
  }

  return this._didMutate;
}
```

### 반환값

- `true`: 이번 tick에서 실제 DOM 변경이 있었음
- `false`: 변경 없음 (다음 tick 간격이 늘어날 수 있음)

`_didMutate` 플래그는 `_reconcile` / `_updateDomProps` 내부에서 DOM 쓰기가 발생할 때 `true`로 설정된다.

---

## 적응형 프레임 간격

스케줄러는 `_frameDelay`를 프레임 단위로 관리한다.

- 변화 있음: 다음 tick을 **1프레임 뒤** 실행
- 변화 없음: `1 -> 2 -> 4 -> 8 -> ...` 식으로 증가
- 최대값: **60프레임** (`MAX_FRAME_DELAY`)

즉, 렌더 결과에 실제 DOM 변화가 없으면 점점 드물게 tick을 실행하고, 변화가 다시 생기면 즉시 빠른 주기로 복귀한다.

```
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

```
1. _rafId = null (현재 RAF 소비됨)
2. 루트 컴포넌트/컨테이너 존재 확인

3. _framesUntilNextTick <= 0 이면:
   ├── _tick() 실행
   ├── _tick 중 수동 render() 호출로 _rafId가 설정되었으면
   │   → _framesUntilNextTick = 0 (즉시 다음 tick)
   └── 아니면:
       ├── didMutate? → _frameDelay = 1
       └── !didMutate? → _frameDelay = min(_frameDelay * 2, 60)
       └── _framesUntilNextTick = _frameDelay - 1

4. _framesUntilNextTick > 0 이면:
   → _framesUntilNextTick -= 1 (tick 대신 카운터만 감소)

5. _startScheduler() → 다음 RAF 예약
```

### 코드

```javascript
export function _onAnimationFrame() {
  this._rafId = null;
  if (!this._RootComponent || !this._containerElement) return;

  if (this._framesUntilNextTick <= 0) {
    const didMutate = this._tick();
    const hasManualRequestDuringTick = this._rafId != null;

    if (hasManualRequestDuringTick) {
      this._framesUntilNextTick = 0;
    } else {
      this._frameDelay = didMutate
        ? 1
        : Math.min(this._frameDelay * 2, MAX_FRAME_DELAY);
      this._framesUntilNextTick = this._frameDelay - 1;
    }
  } else {
    this._framesUntilNextTick -= 1;
  }

  this._startScheduler();
}
```

---

## 수동 렌더 API

### `AEUI.render()`

사용자가 즉시 렌더를 실행할 수 있는 public API이다.

- 내부적으로 `_tick()`을 즉시 수행
- 결과에 따라 `_frameDelay`를 갱신
- scheduler 루프가 꺼져 있으면 다시 시작

```javascript
export function render() {
  if (!this._RootComponent || !this._containerElement) return false;

  const didMutate = this._tick();
  this._frameDelay = didMutate ? 1 : Math.min(this._frameDelay * 2, MAX_FRAME_DELAY);
  this._framesUntilNextTick = this._frameDelay - 1;
  this._startScheduler();
  return didMutate;
}
```

사용 예:

```javascript
import { AEUI } from "aeui";

AEUI.render(); // 즉시 1회 렌더 시도
```

---

## 전역 상태

스케줄러 관련 주요 필드:

```javascript
AEUI = {
  _rootNode: null,            // createRootNode으로 생성된 root wrapper node
  _containerElement: null,    // init에 전달된 DOM 컨테이너
  _RootComponent: null,       // init에 전달된 루트 컴포넌트 함수
  _rafId: null,               // 현재 예약된 RAF id
  _frameDelay: 1,             // 다음 tick까지의 프레임 간격
  _framesUntilNextTick: 0,    // 남은 프레임 카운터
  _didMutate: false,          // 이번 tick의 실제 DOM 변경 여부
  _isRendering: false,        // 렌더 재진입 방지
}
```

---

## 관련 코드 위치

- `init`: `packages/core/src/runtime.js` L139-L155
- `_reconcileRoot`: `packages/core/src/runtime.js` L121-L137
- `_tick`: `packages/core/src/runtime.js` L212-L229
- `render`: `packages/core/src/runtime.js` L157-L165
- `_onAnimationFrame`: `packages/core/src/runtime.js` L189-L210
- `_startScheduler`, `_stopScheduler`: `packages/core/src/runtime.js` L167-L187
- `createRootNode`: `packages/core/src/runtime.js` L28-L40
