# 스케줄러 — `init`, `_tick`

## 개요

스케줄러는 AEUI의 **렌더링 루프**를 관리한다. `init()`으로 프레임워크를 시작하면, `_tick()`이 주기적으로 호출되어 현재 상태를 읽고, VNode을 생성하고, 이전 결과와 비교하여 DOM에 반영한다.

AEUI는 React처럼 `setState`가 호출될 때 렌더링을 트리거하는 방식이 아니다. 대신 **일정 주기(현재 1초)마다** 자동으로 전체 상태를 확인하고 변경사항이 있으면 DOM을 업데이트하는 **Polling(Dirty Checking)** 방식을 사용한다. 이 덕분에 `let count = 0; count++;` 처럼 일반 변수를 직접 수정해도 다음 tick에서 자동으로 화면에 반영된다.

---

## `init(RootComponent, containerElement)`

AEUI 애플리케이션의 **진입점**이다. HTML에서 지정한 DOM 컨테이너에 루트 컴포넌트를 렌더링하고, 렌더링 루프를 시작한다.

### 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `RootComponent` | `Function` | 앱의 최상위 컴포넌트 함수. 예: `App` |
| `containerElement` | `HTMLElement` | 컴포넌트가 렌더링될 DOM 요소. 예: `document.getElementById('root')` |

### 사용 예시

```javascript
import { AEUI } from 'aeui';

function App() {
  return <div>Hello AEUI</div>;
}

AEUI.init(App, document.getElementById('root'));
```

### 동작 과정

```
1. 중복 호출 방어
   ├── 기존 _tickTimer가 있으면 clearInterval로 해제
   │   (이전 렌더링 루프가 계속 돌지 않도록)
   └── 기존 _rootInstance가 있으면 _unmount로 정리
       (이전 컴포넌트의 cleanup 콜백 실행, watcher 해제)

2. 내부 상태 초기화
   ├── _RootComponent = RootComponent   (루트 컴포넌트 함수 저장)
   ├── _containerElement = containerElement (DOM 컨테이너 저장)
   ├── _rootInstance = null   (이전 인스턴스 참조 해제)
   ├── _previousVNode = null  (이전 렌더 결과 해제)
   └── containerElement.innerHTML = ''  (컨테이너의 기존 HTML 내용 전부 제거)

3. 최초 렌더링
   └── this._tick()   (첫 번째 tick 즉시 실행 → 화면에 최초 렌더링)

4. 렌더링 루프 시작
   └── this._tickTimer = setInterval(() => this._tick(), 1000)
       (1초마다 _tick 반복 호출)
```

### 중복 호출 방어

`init()`은 여러 번 호출될 수 있다:
- 테스트에서 각 테스트마다 새 컴포넌트로 `init` 호출
- 런타임에서 루트 컴포넌트를 동적으로 교체

이전 인터벌을 정리하지 않으면 `setInterval`이 누적되어 여러 렌더링 루프가 동시에 실행된다. 이전 인스턴스를 `_unmount`하지 않으면 cleanup 콜백(예: `clearInterval`)이 실행되지 않아 메모리 누수가 발생한다.

```javascript
if (this._tickTimer) {
  clearInterval(this._tickTimer);
  this._tickTimer = null;
}
if (this._rootInstance) {
  this._unmount(this._rootInstance);
}
```

### `containerElement.innerHTML = ''` 의 의미

컨테이너의 기존 HTML 내용을 전부 삭제한다. 현재 코어 런타임은 하이드레이션(Hydration)을 지원하지 않으며, 마운트 시 기존 DOM을 재사용하지 않고 처음부터 다시 생성한다.

---

## `_tick()`

**하나의 렌더링 사이클**을 실행한다. 현재 상태를 읽어 VNode을 생성하고, 이전 결과와 비교하여 DOM을 업데이트한다.

### 동작 과정

```
1. _isRendering 가드 체크
   └── true면 즉시 return (이미 렌더링 중이면 중복 실행 방지)

2. _isRendering = true (렌더링 시작 표시)

3. try:
   ├── _rootInstance가 있는 경우 (2번째 tick 이후)
   │   └── _rootInstance.update()
   │       이 메서드 내부에서:
   │       watcher 체크 → render 함수 호출 → _reconcile로 DOM 업데이트
   │
   └── _rootInstance가 없는 경우 (최초 tick)
       ├── createVNode(RootComponent)으로 루트 VNode 생성
       │   (tag = RootComponent 함수, props = {})
       └── _reconcile(container, newVNode, null, 0, null)
           이 _reconcile 호출 안에서:
           → 4단계(Component Node) 진입
           → createInstance 호출로 _rootInstance 생성
           → setup 실행, render 호출, DOM 생성

4. catch:
   └── console.error('[AEUI] Render error:', e)
       에러를 로깅하고, 렌더링 루프를 중단하지 않도록 함

5. finally:
   └── _isRendering = false (렌더링 종료 표시)
       에러가 발생해도 반드시 false로 복구되어 다음 tick이 실행 가능
```

### `_isRendering` 가드

```javascript
if (this._isRendering) return;
```

tick이 진행 중인 동안 또 다른 tick이 실행되는 것을 방지한다. 이런 상황이 발생할 수 있는 경우:
- 이벤트 핸들러 내부에서 직접 `_tick()`을 호출하는 경우
- `setInterval`에 의해 이전 tick이 끝나기 전에 다음 tick이 시작되는 경우 (렌더링이 1초 이상 걸릴 때)

### 에러 처리

```javascript
try {
  // 렌더링
} catch (e) {
  console.error('[AEUI] Render error:', e);
} finally {
  this._isRendering = false;
}
```

렌더링 중 에러가 발생해도 `_isRendering`이 `finally`에서 `false`로 복구되어 다음 tick이 정상 실행된다. 에러가 발생한 tick의 DOM은 불완전한 상태일 수 있지만, 다음 tick에서 다시 전체 렌더링을 시도한다.

### 최초 tick과 이후 tick의 차이

| | 최초 tick | 이후 tick |
|---|---|---|
| `_rootInstance` | `null` → 새로 생성됨 | 이미 존재 |
| 실행 경로 | `createVNode` → `_reconcile` | `_rootInstance.update()` |
| 인스턴스 생성 | `_reconcile` 4단계에서 `createInstance` | 불필요 (재사용) |
| `_previousVNode` | `null` | 이전 결과 |

최초 tick에서 `_rootInstance`가 없으므로 `createVNode → _reconcile` 경로를 타고, `_reconcile` 내부에서 `createInstance`가 호출되어 `_rootInstance`가 설정된다. 이후 tick부터는 이미 존재하는 `_rootInstance.update()`를 직접 호출한다.

---

## 현재 타이밍 특성

### 고정 1초 interval

```javascript
this._tickTimer = setInterval(() => this._tick(), 1000);
```

모든 상태 변경은 최대 1초 후에 DOM에 반영된다. 버튼 클릭 등의 이벤트 핸들러가 실행되면 상태(let 변수)는 즉시 변경되지만, DOM 반영은 다음 tick까지 대기한다.

### 일괄 처리 (Batching)

한 tick 사이에 여러 번 상태가 변경되어도 **한 번만 렌더링**된다. 자동으로 batching이 이루어진다.

```javascript
// 1초 사이에 버튼을 3번 빠르게 클릭하면
// count가 0→1→2→3으로 변경되지만
// 렌더링은 count=3 상태로 1번만 실행됨
```

---

## AEUI 전역 상태

`init`과 `_tick`이 의존하는 전역 상태들:

```javascript
AEUI = {
  _rootInstance: null,       // 루트 컴포넌트 인스턴스 (최초 tick까지 null)
  _containerElement: null,   // DOM 컨테이너 요소
  _RootComponent: null,      // 루트 컴포넌트 함수
  _currentInstance: null,     // 현재 처리 중인 인스턴스 (훅 컨텍스트용)
  _isRendering: false,       // 렌더링 중 가드
  _tickTimer: null,          // setInterval이 반환한 타이머 ID
  _previousVNode: null,      // 이전 렌더링 VNode (최초 tick에서만 사용)
}
```

---

## 관련 코드 위치

- `init`: `packages/core/src/core.js` L89-L112
- `_tick`: `packages/core/src/core.js` L114-L137
