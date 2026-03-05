# 스케줄러 — `init`, `_tick`, `render`

## 개요

AEUI 스케줄러는 `requestAnimationFrame` 기반으로 동작한다. 핵심 목표는 다음 두 가지다.

- 변경이 계속 발생할 때는 빠르게 렌더링
- 변경이 없을 때는 tick 간격을 점진적으로 늘려 불필요한 렌더링 비용 감소

AEUI는 `setState` 트리거 방식이 아니라 Polling(Dirty Checking) 기반이므로, scheduler가 주기적으로 렌더를 시도한다.

---

## `init(RootComponent, containerElement)`

앱 시작 시점에서 루트 컴포넌트를 마운트하고 RAF 루프를 시작한다.

동작 순서:

1. 기존 scheduler 중지 (`_stopScheduler`)
2. 기존 루트 인스턴스 unmount
3. 내부 상태 초기화 (`_RootComponent`, `_containerElement`, `_previousVNode` 등)
4. 초기 렌더 1회 실행 (`_tick`)
5. 초기 렌더 결과에 따라 프레임 간격 설정
6. RAF 루프 시작 (`_startScheduler`)

---

## 적응형 프레임 간격

스케줄러는 `_frameDelay`를 프레임 단위로 관리한다.

- 변화 있음: 다음 tick을 **1프레임 뒤** 실행
- 변화 없음: `1 -> 2 -> 4 -> 8 -> ...` 식으로 증가
- 최대값: **60프레임**

즉, 렌더 결과에 실제 DOM 변화가 없으면 점점 드물게 tick을 실행하고, 변화가 다시 생기면 즉시 빠른 주기로 복귀한다.

---

## `_onAnimationFrame()`

RAF 콜백에서 실행되는 루프 본체다.

1. `_framesUntilNextTick`가 0 이하이면 `_tick()` 실행
2. `_tick()` 결과(`didMutate`)로 `_frameDelay` 계산
3. `_framesUntilNextTick = _frameDelay - 1`로 재설정
4. 다음 RAF 예약

`_framesUntilNextTick`가 0보다 크면 tick 대신 카운터만 1 감소시키고 다음 RAF를 예약한다.

---

## `_tick()`

한 번의 렌더 사이클을 수행하고, 실제 변화 여부(boolean)를 반환한다.

- 재진입 방지: `_isRendering` 가드
- 루트 존재 시 `instance.update()`, 최초 렌더 시 `_reconcile(...)`
- 변화 감지: `_reconcile` / `_updateDomProps` 내부 DOM 쓰기 시 `_didMutate` 플래그 설정

반환값:

- `true`: 이번 tick에서 실제 변경이 있었음
- `false`: 변경 없음 (다음 tick 간격이 늘어날 수 있음)

---

## 수동 렌더 API

### `AEUI.render()`

사용자가 즉시 렌더를 실행할 수 있는 public API다.

- 내부적으로 `_tick()`을 즉시 수행
- 결과에 따라 `_frameDelay`를 갱신
- scheduler 루프가 꺼져 있으면 다시 시작

```javascript
import { AEUI } from "aeui";

AEUI.render(); // 즉시 1회 렌더 시도
```

## 전역 상태

스케줄러 관련 주요 필드:

```javascript
AEUI = {
  _rafId: null,             // 현재 예약된 RAF id
  _frameDelay: 1,           // 다음 tick까지의 프레임 간격
  _framesUntilNextTick: 0,  // 남은 프레임 카운터
  _didMutate: false,        // 이번 tick의 실제 DOM 변경 여부
  _isRendering: false,      // 렌더 재진입 방지
}
```

---

## 관련 코드

- `packages/core/src/runtime.js`
  - `init`
  - `render`
  - `_startScheduler`, `_stopScheduler`, `_onAnimationFrame`
  - `_tick`
