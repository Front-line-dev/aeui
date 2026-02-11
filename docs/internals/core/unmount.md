# Unmount — `_unmount`

## 개요

`_unmount`는 컴포넌트 인스턴스를 **정리(cleanup)**하는 함수이다.

컴포넌트가 화면에서 제거될 때 (조건부 렌더링으로 사라지거나, 같은 위치에 다른 컴포넌트가 올 때, `init()`이 재호출될 때), 이 함수가 호출된다. 인스턴스와 모든 하위 자식들의 cleanup 콜백을 실행하고, watcher를 해제하여 **메모리 누수를 방지**한다.

---

## 함수 시그니처

```javascript
_unmount(instance)
```

| 파라미터 | 설명 |
|----------|------|
| `instance` | 정리할 컴포넌트 인스턴스 |

---

## 동작 과정

```
_unmount(instance):
  0. null 체크 (instance가 없으면 리턴)

  1. instance.isMounted = false
     → instance.update()에서 첫 줄의 if (!this.isMounted) return;에 의해
       이후 tick에서 이 인스턴스가 업데이트되지 않도록 함

  2. cleanups 배열 순서대로 실행
     각 cleanup 함수를 try-catch로 감싸서 실행
     → 에러가 발생해도 다음 cleanup으로 계속 진행

  3. children 배열 순회 → 각 자식에 대해 _unmount 재귀 호출
     → 자식의 cleanup, 자식의 자식 cleanup... 순서대로 정리

  4. watchStates = []  (watcher 전부 해제)
  5. cleanups = []     (cleanup 참조 해제)
```

### 코드

```javascript
_unmount(instance) {
  if (instance) {
    instance.isMounted = false;
    instance.cleanups.forEach((cleanup) => {
      try { cleanup(); } catch (e) { console.error('[AEUI] Cleanup error:', e); }
    });
    instance.children.forEach(child => this._unmount(child));
    instance.watchStates = [];
    instance.cleanups = [];
  }
}
```

---

## 각 단계 상세 설명

### `isMounted = false`

AEUI의 렌더링 루프(`_tick`)는 1초마다 `_rootInstance.update()`를 호출한다. unmount된 인스턴스가 아직 스케줄링된 tick에 의해 업데이트되면 안 되므로, `isMounted`를 `false`로 설정하여 `update()` 메서드의 첫 줄에서 즉시 반환되도록 한다.

```javascript
// instance.update() 내부
update() {
  if (!this.isMounted) return;  // ← 여기서 차단
  // ...
}
```

### cleanups 실행

`clean()` 훅으로 등록된 콜백들을 실행한다. 주로 다음과 같은 리소스 정리에 사용된다:

```javascript
// 예시 1: setInterval 해제
const timer = setInterval(() => { /* ... */ }, 1000);
clean(() => clearInterval(timer));

// 예시 2: 이벤트 리스너 해제
window.addEventListener('resize', handleResize);
clean(() => window.removeEventListener('resize', handleResize));

// 예시 3: WebSocket 연결 종료
const ws = new WebSocket('ws://...');
clean(() => ws.close());
```

### 에러 격리

```javascript
instance.cleanups.forEach((cleanup) => {
  try { cleanup(); } catch (e) { console.error('[AEUI] Cleanup error:', e); }
});
```

cleanup 함수에서 에러가 발생해도 나머지 cleanup과 자식 unmount가 **정상적으로 진행**된다. 예를 들어 3개의 cleanup이 등록되어 있고 2번째에서 에러가 발생하면, 1번째와 3번째는 정상 실행되고 에러는 콘솔에 로깅된다.

### 재귀적 자식 unmount

자식 인스턴스들도 재귀적으로 unmount된다. 실행 순서는 **부모 cleanup 먼저 → 자식 cleanup 나중** (DFS 전위 순회):

```
ParentApp unmount:
  1. ParentApp.cleanups 실행 (clearInterval 등)
  2. ChildA._unmount()
     ├── ChildA.cleanups 실행
     └── GrandchildX._unmount()
         └── GrandchildX.cleanups 실행
  3. ChildB._unmount()
     └── ChildB.cleanups 실행
```

이 순서는 부모가 만든 리소스를 먼저 정리한 후 자식의 리소스를 정리하는 것이다. 자식이 부모의 리소스에 의존하는 경우 (예: 부모가 만든 WebSocket을 자식이 사용) 이 순서가 올바르다.

### `watchStates`, `cleanups` 배열 비우기

```javascript
instance.watchStates = [];
instance.cleanups = [];
```

배열을 빈 배열로 교체하여, watcher의 `callback`, `getDeps` 함수와 cleanup 함수에 대한 **참조를 해제**한다. 이 함수들이 클로저로 참조하는 변수들이 가비지 컬렉션되어 메모리가 회수될 수 있게 한다.

---

## 호출 시점

`_unmount`가 호출되는 경우들:

| 상황 | 호출 위치 | 설명 |
|------|-----------|------|
| `init()` 재호출 | `init` 내부 | 이전 루트 인스턴스를 정리. 예: 테스트에서 매 테스트마다 `init` 호출 |
| 컴포넌트 교체 | `_reconcile` 4단계 | 같은 위치에 다른 컴포넌트가 올 때 이전 인스턴스 제거 |
| 초과 자식 정리 | `_reconcile` 4단계 | 이전보다 자식 컴포넌트 수가 줄었을 때, `_childCursor` 이후 남은 인스턴스 제거 |

### DOM 노드 제거와의 관계

`_unmount`는 **인스턴스(JavaScript 객체)만 정리**한다. 실제 **DOM 노드 제거는 `_reconcile`에서** 처리한다 (`parentElement.removeChild` 등). 이 두 작업은 분리되어 있다.

- `_reconcile`: "이 위치의 DOM 노드를 제거해야 한다" → `removeChild` 실행
- `_unmount`: "이 컴포넌트의 리소스를 정리해야 한다" → cleanup 실행, watcher 해제

---

## 관련 코드 위치

- `_unmount`: `packages/core/src/core.js` L291-L301
- `clean` 훅 (cleanup 등록): `packages/core/src/hooks.js` L17-L21
