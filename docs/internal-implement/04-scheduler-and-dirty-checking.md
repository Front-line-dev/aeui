# 04. 스케줄러와 Dirty Checking

이 문서는 AEUI의 변경 감지 루프 — polling, backoff, RAF loop, tick의 내부 동작을 설명한다.

---

## 관련 모듈

| 모듈 | 역할 |
|---|---|
| `runtime.js` | init, tick, render, RAF loop, DOM 이벤트 dispatch |
| `runtime-state.js` | 앱별 mutable state 생성/reset |
| `component-watchers.js` | deps 비교, callback 실행, snapshot 갱신 |

---

## 변경 감지의 이중 전략

### Polling — 주기적 확인

AEUI는 `requestAnimationFrame`(또는 16ms `setTimeout`)을 사용해 주기적으로 변경을 확인한다. 변화가 없으면 간격을 점점 늘린다:

```js
frameDelay = didMutate
  ? 1                              // 변화 있음 → 바로 다시
  : Math.min(frameDelay * 2, 60);  // 변화 없음 → 1→2→4→8→...→60
```

**단위는 프레임 수** (밀리초가 아님). 60fps에서 최대 60프레임 ≈ 약 1초.

### DOM 이벤트 Fast Path — 즉시 응답

버튼 클릭 같은 DOM 이벤트 후에는 polling을 기다리지 않고 **다음 animation frame에 바로** tick을 실행한다:

```
사용자 클릭 → handler 실행 → count++
  → requestRender() → 다음 프레임에서 tick()
```

여러 이벤트가 연속으로 와도 **하나의 boolean과 하나의 RAF 예약**으로 합쳐진다.

---

## tick() — 한 번의 render cycle

```js
if (!RootComponent || !containerElement || !rootNode) return false;
if (isRendering) return false;  // 재진입 방지

isRendering = true;
didMutate = false;
try {
  reconcileRoot(state);
} catch (error) {
  console.error('[AEUI] Render error:', error);
} finally {
  isRendering = false;
}
return didMutate;
```

**핵심:**
- 재진입 tick은 `false` 반환
- 렌더 오류는 **로그만 남기고 삼김** → 스케줄러가 다음 tick에서 재시도
- `didMutate`는 "상태 변경" 여부가 아니라 **DOM 쓰기 여부**

---

## onAnimationFrame() — 매 프레임의 판단

```
1. rafId = null
2. 앱이 없으면 종료 (재예약 안 함)

3. interactiveRenderRequested?
   → flag 초기화 → tick() → backoff 계산 → 다음 예약

4. countdown <= 0?
   → tick() → backoff 계산

5. countdown > 0?
   → countdown -= 1

6. 다음 스케줄러 예약
```

**interactive lane:** polling countdown이 59처럼 길어도, interactive 요청이 있으면 **즉시 다음 RAF에서 tick** 실행.

---

## AEUI.render() vs requestRender()

| | `AEUI.render()` | `requestRender()` |
|---|---|---|
| 접근 | 공개 API | 내부 전용 |
| 실행 | **즉시** (동기) | **다음 프레임** (비동기) |
| 반환값 | `didMutate` boolean | `true`/`false` |
| 용도 | 비동기 코드에서 수동 갱신 | DOM 이벤트, 라우터 |

---

## DOM 이벤트 Dispatch

```
dispatchDomEvent(state, domNode, eventName, event)
  1. domEventDepth += 1
  2. 최신 handler 조회
  3. handler.call(domNode, event)
  4. finally:
     domEventDepth -= 1
     depth가 0이면 requestRender()
```

**중첩 이벤트:** 가장 바깥 dispatch 종료 시 **한 번만** render 요청.

**오류 처리:** handler throw 후에도 `finally`에서 render 요청은 유지, 원래 오류는 바깥으로 전파.

---

## Watcher 실행

매 render 시 `runComponentWatchers`가 모든 watcher를 순회한다:

```
각 watcher:
  newDeps = watcher.getDeps()
  changed = !watcher.oldDeps || !deepEqual(newDeps, watcher.oldDeps)
  
  changed이면:
    watcher.callback()
    finalDeps = watcher.getDeps()      ← callback 후 다시 읽기!
    watcher.oldDeps = deepClone(finalDeps)
```

**왜 callback 후 deps를 다시 읽는가?** callback이 값을 clamp/normalize했다면, 최종 값을 snapshot으로 저장해야 다음 render에서 불필요한 재실행을 방지한다.

**watcher 오류:** 하나가 실패해도 `[AEUI] Watcher error:` 로그만 남기고 다음 watcher와 render를 계속한다.

---

## 스케줄러 제어

### startScheduler()

이미 예약이 있으면 (`rafId != null`) 중복 예약하지 않음. `requestAnimationFrame` 없으면 `setTimeout(..., 16)` fallback.

### stopScheduler()

`rafId`가 있으면 취소하고 `rafId = null`.

### resetRuntimeState()

router teardown 호출 후 mutable 필드를 초기값으로 되돌린다. 단:
- `deepEqual`, `deepClone`은 유지
- **RAF 취소는 하지 않음** (`rafId`만 null)
- component tree unmount, DOM 정리도 하지 않음

> `reset`은 teardown API가 아니다. 호출자가 먼저 `stopScheduler()`와 명시적 unmount를 수행해야 한다.

---

## 오류 처리 정책

| 오류 위치 | 처리 | 후속 동작 |
|---|---|---|
| 컴파일 안 된 `watch` 호출 | 즉시 throw | — |
| watch 등록 시 인자 검증 | throw | reconcile 오류 경로 |
| **watcher 실행** | 로그, 삼킴 | 다음 watcher/render 계속 |
| **cleanup 콜백** | 로그, 삼킴 | 다음 cleanup/자식 정리 계속 |
| 컴포넌트 setup/render | throw | context는 finally로 복원 |
| **tick 내부 render** | 로그, 삼킴 | 스케줄러 계속 |
| DOM 이벤트 핸들러 | 전파 | finally에서 render 요청 |

**AEUI는 Error Boundary를 제공하지 않는다.** render 실패 후 스케줄러가 살아있으므로 같은 오류가 반복 로그될 수 있다.

---

## 관련 문서

- 깊은 비교 상세: [05. 깊은 비교](05-deep-compare.md)
