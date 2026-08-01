# 05. 스케줄러, 훅, 오류 처리

AEUI에는 `setState`가 없다. 일반 `let` 변수를 상태로 쓴다. 그렇다면 **변수가 바뀐 것을 어떻게 아는가?**

답은 **Dirty Checking**이다. AEUI는 주기적으로 값을 확인해서 바뀌었으면 화면을 갱신한다. 여기에 **DOM 이벤트 시 즉시 확인하는 fast path**를 더해, 반응성과 효율의 균형을 맞춘다.

이 장은 이 변경 감지 루프, `watch`/`clean` 훅의 동작, 그리고 오류 격리 규칙을 다룬다.

---

## 1. 관련 모듈

| 모듈 | 역할 |
|---|---|
| `runtime-state.js` | 앱별 mutable state 생성/reset |
| `runtime.js` | init, tick, render, RAF loop, DOM 이벤트 dispatch |
| `app-runtime.js` | state와 함수를 앱 인스턴스 메서드로 바인딩 |
| `hooks.js` | public `watch` (compile guard)와 `clean` (fallback) |
| `hook-registry.js` | setup phase에서 watcher/cleanup 등록 |
| `component-watchers.js` | deps 비교, callback 실행, snapshot 갱신 |
| `component-lifecycle.js` | props 동기화 후 watcher 실행, unmount 시 cleanup |

---

## 2. 변경 감지의 이중 전략

### 2.1 Polling — 주기적 확인

AEUI는 `requestAnimationFrame`(또는 16ms `setTimeout`)을 사용해 주기적으로 화면을 확인한다. 변화가 없으면 확인 간격을 점점 늘린다:

```js
frameDelay = didMutate
  ? 1                              // 변화 있음 → 다음 프레임에서 바로 다시 확인
  : Math.min(frameDelay * 2, 60);  // 변화 없음 → 1→2→4→8→...→60 프레임 뒤
```

> **단위는 프레임 수**이다 (밀리초가 아님). 60fps에서 최대 60프레임 = 약 1초.

### 2.2 DOM 이벤트 fast path — 즉시 응답

버튼 클릭 같은 DOM 이벤트가 발생하면, polling을 기다리지 않고 **다음 animation frame에 바로** 화면을 갱신한다:

```
사용자 클릭 → event handler 실행 → count++
  → requestRender() → 다음 프레임에서 tick() → 화면 갱신
```

여러 이벤트가 연속으로 와도 **하나의 boolean 값과 하나의 RAF 예약**으로 합쳐진다.

### 2.3 fast path가 적용되지 않는 경우

AEUI proxy를 거치지 않는 변경은 polling에 의존한다:

- `setTimeout`, `setInterval` 안의 변경
- Promise/async 안의 변경
- 외부 store 변경
- 직접 등록한 native event listener의 변경

이런 경우 수동으로 `AEUI.render()`를 호출하면 즉시 갱신할 수 있다.

---

## 3. 한 번의 render cycle: `tick()`

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

**핵심 특징:**
- 재진입 tick은 실행하지 않고 `false` 반환
- 렌더 오류는 **로그만 남기고 삼킨다** → 스케줄러가 다음 tick에서 재시도 가능
- `didMutate`는 "상태 변경" 여부가 아니라 **이번 cycle에서 DOM 쓰기가 있었는지**를 나타냄

---

## 4. `AEUI.init()` — 앱 초기화

```
1. stopScheduler()                 ← 기존 예약 취소
2. routerTeardown()                ← 기존 라우터 리스너 제거
3. unmountNode(previousRootChild)  ← 이전 앱 트리 정리
4. state에 RootComponent, containerElement 저장
5. createRootNode(containerElement)
6. containerElement.innerHTML = '' ← DOM 초기화
7. interactiveRenderRequested = false
8. tick()                          ← 첫 화면 동기 렌더
9. polling delay 계산
10. startScheduler()               ← 정기 확인 시작
```

초기 render 오류는 `tick()`이 로그로 삼키므로, `init()`은 스케줄러를 계속 시작한다.

---

## 5. 스케줄러 제어

### `startScheduler()`

이미 예약이 있으면 (`rafId != null`) 중복 예약하지 않는다. `requestAnimationFrame`이 있으면 사용, 없으면 `setTimeout(..., 16)`.

### `stopScheduler()`

`rafId`가 있으면 취소하고 `rafId = null`.

### `onAnimationFrame()` — 매 프레임의 판단

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

**interactive lane:** polling countdown이 59처럼 길어도, interactive 요청이 있으면 **즉시 다음 RAF에서 tick**을 실행한다.

---

## 6. `AEUI.render()` vs `requestRender()`

| | `AEUI.render()` | `requestRender()` |
|---|---|---|
| 접근 | 공개 API | 내부 전용 |
| 실행 | **즉시** (동기) | **다음 프레임** (비동기) |
| 반환값 | `didMutate` boolean | `true`/`false` |
| 용도 | 수동 갱신 | DOM 이벤트, 라우터에서 사용 |

---

## 7. DOM 이벤트 dispatch

DOM host proxy가 `dispatchDomEvent(state, domNode, eventName, event)`를 호출한다:

```
1. domEventDepth += 1
2. 최신 handler 조회
3. 함수면 handler.call(domNode, event) 호출
4. finally:
   domEventDepth -= 1
   depth가 0이면 requestRender()  ← 가장 바깥 이벤트가 끝날 때 한 번
```

**중첩 이벤트:** 여러 이벤트가 중첩되어도, 가장 바깥 dispatch가 끝날 때 **한 번만** render를 요청한다.

**오류 처리:** handler가 throw해도 `finally`에서 render 요청은 남고, 원래 오류는 catch하지 않고 바깥으로 전파한다.

---

## 8. `watch` — 값 변화 감시

### 8.1 public `watch()`는 컴파일 가드

`hooks.js`에서 export하는 `watch()` 함수를 직접 호출하면 항상 오류를 던진다:

```
[AEUI] watch(callback, deps) must be compiled by the AEUI Babel plugin.
```

Babel이 `watch(callback, deps)` → `AEUI.__runtime.watch(callback, () => [deps])` 로 변환한다.

### 8.2 등록 조건

watch와 clean 등록은 다음 조건을 **모두** 만족해야 한다:

1. runtime이 활성 상태
2. `currentComponentNode`가 있음
3. `currentComponentPhase === 'setup'`

> **render phase에서 호출된 watch/clean은 조용히 무시된다.** 오류가 아니라 아무 일도 하지 않는다.

### 8.3 watcher 등록 시 검증

| 검증 | 오류 |
|---|---|
| callback이 함수가 아님 | `TypeError: ... requires callback to be a function.` |
| deps가 undefined | `TypeError: ... requires deps.` |
| deps가 배열도 함수도 아님 | `TypeError: ... requires deps to be an array or ...` |

등록되는 entry:

```js
{
  callback,
  getDeps,                             // deps 함수 또는 배열 값을 읽는 closure
  oldDeps: state.deepClone(getDeps()), // 첫 비교 기준
}
```

**초기 callback은 실행하지 않는다.** 처음 등록할 때는 현재 값을 snapshot으로만 저장한다.

### 8.4 watcher 실행 — 매 render 시

compiled render bridge의 `runComponentRenderPhase`는 다음 순서를 보장한다:

```
1. node.props = nextProps || {}
2. compiler propsTarget 동기화
3. runComponentWatchers(state, node)    ← watcher 실행
4. 실제 render 함수 호출
```

각 watcher는 독립된 try/catch 안에서 실행:

```
newDeps = watcher.getDeps()
changed = !watcher.oldDeps || !deepEqual(newDeps, watcher.oldDeps)

changed이면:
  watcher.callback()
  finalDeps = watcher.getDeps()        ← callback 후 deps를 다시 읽음!
  watcher.oldDeps = deepClone(finalDeps)
```

> **왜 callback 후 deps를 다시 읽는가?** callback이 값을 clamp/normalize했다면, 그 최종 값을 snapshot으로 저장해야 다음 render에서 같은 callback이 불필요하게 다시 실행되지 않는다.

**watcher 오류:** 하나가 실패해도 `[AEUI] Watcher error:` 로그를 남기고 다음 watcher와 render를 계속한다. 실패한 watcher는 `oldDeps`가 갱신되지 않아 다음 render에서 같은 변경을 다시 시도한다.

---

## 9. `clean` — 정리 작업 등록

### 9.1 등록

public fallback은 active runtime context를 읽어 `registerCleanup`을 호출한다. compiled path는 `AEUI.__runtime.clean(callback)`으로 직접 등록.

setup node의 `cleanups` 배열에 callback을 그대로 push한다. **타입 검증은 등록 시점에 하지 않는다.**

### 9.2 실행 — 컴포넌트 unmount 시

등록 순서대로 각 cleanup을 호출한다. 각 호출은 독립 try/catch:

```
[AEUI] Cleanup error: <error>
```

하나가 실패해도 나머지 cleanup, watcher 해제, 자식 재귀 unmount, DOM 제거를 모두 계속한다.

---

## 10. runtime state와 reset

### state 초기값

```js
{
  deepEqual, deepClone,
  rootNode: null, containerElement: null, RootComponent: null,
  currentComponentNode: null, currentComponentPhase: null,
  isRendering: false,
  rafId: null, frameDelay: 1, framesUntilNextTick: 0,
  didMutate: false, domEventDepth: 0,
  interactiveRenderRequested: false,
  routerTeardown: null,
}
```

### `resetRuntimeState`

router teardown을 호출한 뒤 mutable 필드를 초기값으로 되돌린다. 단:
- `deepEqual`, `deepClone`, helper property는 유지
- **RAF 취소는 하지 않는다** (`rafId`만 null로)
- component tree unmount, DOM 정리도 하지 않는다

> **주의:** `reset`은 일반 teardown API가 아니다. 호출자가 먼저 `stopScheduler()`와 명시적 unmount를 수행해야 한다.

---

## 11. 오류 처리 정책

| 오류 위치 | 처리 방식 | 후속 동작 |
|---|---|---|
| 컴파일 안 된 `watch` 호출 | 즉시 throw | — |
| watch 등록 시 인자 검증 | setup으로 throw | reconcile 오류 경로 |
| **watcher 실행** | `Watcher error` 로그, 삼킴 | 다음 watcher와 render 계속 |
| **cleanup 콜백** | `Cleanup error` 로그, 삼킴 | 다음 cleanup과 자식 정리 계속 |
| 컴포넌트 setup/render | reconcile에서 throw | context는 finally로 복원 |
| root reconcile | 새 DOM 정리 후 rethrow | tick이 받음 |
| **tick 내부 render** | `Render error` 로그, 삼킴 | `isRendering=false`, 스케줄러 계속 |
| DOM 이벤트 핸들러 | 원래 오류 전파 | finally에서 render 요청 |
| router teardown 등 | 별도 catch 없음 | 호출자에게 전파 |

**AEUI는 Error Boundary나 이전 UI의 완전한 복원을 제공하지 않는다.** render 실패 후 스케줄러가 살아있으므로 같은 실패가 이후 polling마다 다시 로그될 수 있다.

---

## 12. 검증 요약

- 무변화 polling은 1/2/4 프레임으로 backoff, 변화 시 1로 복귀, 최대 60
- interactive 요청은 남은 countdown과 무관하게 다음 RAF에서 tick
- `AEUI.render()`는 동기 렌더 결과 boolean 반환
- DOM 이벤트 후 다음 프레임 자동 렌더, 여러 이벤트의 한 프레임 coalescing
- watcher는 초기 실행 안 함, deps 변경 시 callback 후 최종 deps 저장
- watcher 오류가 다음 watcher/render를 막지 않음
- render phase 훅은 등록되지 않음
- cleanup 오류가 나머지 cleanup과 재귀 unmount를 막지 않음
- setup/render 오류 후 context와 `isRendering`이 복원됨
