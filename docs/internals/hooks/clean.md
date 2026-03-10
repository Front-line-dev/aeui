# clean 훅

## 개요

`clean`은 컴포넌트가 **화면에서 제거(unmount)될 때 실행할 정리 함수를 등록**하는 훅이다. React의 `useEffect` 반환 함수(cleanup)와 유사한 역할이다.

컴포넌트가 외부 리소스(타이머, 이벤트 리스너, 네트워크 연결 등)를 생성한 경우, 컴포넌트가 사라질 때 이 리소스를 해제하지 않으면 **메모리 누수**가 발생한다. `clean`은 이를 방지한다.

```javascript
function Timer() {
  const id = setInterval(() => console.log("tick"), 1000);
  clean(() => clearInterval(id));  // 컴포넌트 제거 시 타이머 해제

  return <div>타이머 동작 중</div>;
}
```

---

## 함수 시그니처

```javascript
clean(callback)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `callback` | `Function` | 컴포넌트가 언마운트될 때 실행할 정리 함수 |

---

## 사용자 관점 사용법

### setInterval 해제

```jsx
function Clock() {
  let time = new Date().toLocaleTimeString();

  const timerId = setInterval(() => {
    time = new Date().toLocaleTimeString();
  }, 1000);

  clean(() => clearInterval(timerId));

  return <p>{time}</p>;
}
```

`Clock` 컴포넌트가 화면에서 제거되면 `clearInterval`이 자동으로 호출된다. 이 코드가 없으면 컴포넌트가 사라진 후에도 타이머가 계속 실행되어 메모리와 CPU를 낭비한다.

### 이벤트 리스너 해제

```jsx
function WindowSize() {
  let width = window.innerWidth;

  const handleResize = () => {
    width = window.innerWidth;
  };

  window.addEventListener('resize', handleResize);
  clean(() => window.removeEventListener('resize', handleResize));

  return <p>너비: {width}px</p>;
}
```

### WebSocket 연결 종료

```jsx
function Chat() {
  const ws = new WebSocket('ws://localhost:8080');

  ws.onmessage = (e) => { /* 메시지 처리 */ };

  clean(() => ws.close());

  return <div>채팅 중...</div>;
}
```

### 여러 개의 clean 등록

한 컴포넌트에서 `clean`을 여러 번 호출할 수 있다. 등록된 순서대로 실행된다.

```jsx
function MultiResource() {
  const timer = setInterval(() => {}, 1000);
  clean(() => clearInterval(timer));

  window.addEventListener('resize', handleResize);
  clean(() => window.removeEventListener('resize', handleResize));

  // 언마운트 시: clearInterval → removeEventListener 순서로 실행
  return <div>...</div>;
}
```

---

## 내부 동작 원리

### 등록 과정

```javascript
export function clean(callback) {
  const runtime = getRuntimeContext();
  if (!runtime) return;

  const node = runtime.getCurrentComponentNode(); // 현재 처리 중인 컴포넌트 node
  if (!node) return;                              // setup 밖에서 호출되면 무시
  node.cleanups.push(callback);                   // cleanups 배열에 추가
}
```

`watch`와 동일하게, `runtime.js`를 통해 "현재 어떤 component node의 setup에서 호출되고 있는지"를 판단한다.

`node.cleanups`는 단순한 함수 배열이다. 새 callback이 호출될 때마다 배열 끝에 추가된다.

### 실행 과정 (unmount 시)

`_unmountNode(node)`가 호출될 때 cleanups가 실행된다:

```javascript
_unmountNode(node) {
  node.isMounted = false;
  node.cleanups.forEach((cleanup) => {
    try { cleanup(); } catch (e) { console.error('[AEUI] Cleanup error:', e); }
  });
  node.children.forEach(child => this._unmountNode(child));
  node.cleanups = [];
}
```

**실행 순서**:
1. 부모의 cleanups가 **등록 순서대로** 실행
2. 자식 컴포넌트의 `_unmount`가 재귀적으로 호출
3. cleanups 배열을 비워 참조 해제

### 에러 격리

각 cleanup 함수는 개별 `try-catch`로 감싸져 있다. 하나의 cleanup에서 에러가 발생해도 나머지 cleanup과 자식 unmount는 정상 진행된다.

```jsx
clean(() => { throw new Error("에러1"); });  // 에러 출력 후 계속
clean(() => clearInterval(id));              // 정상 실행됨
```

---

## 주의사항

### clean은 setup에서만 호출 가능

`watch`와 마찬가지로, 컴포넌트의 setup 단계에서만 호출해야 한다. 이벤트 핸들러나 타이머 콜백 안에서 호출하면 `_currentComponentNode`가 `null`이므로 등록되지 않는다.

```jsx
function Example() {
  // ✅ setup에서 호출 — 정상 등록
  clean(() => console.log("정리됨"));

  return (
    <button onClick={() => {
      // ❌ 이벤트 핸들러에서 호출 — 등록되지 않음 (무시됨)
      clean(() => console.log("이건 등록 안 됨"));
    }}>
      클릭
    </button>
  );
}
```

### clean은 한 번만 실행된다

cleanup 함수는 컴포넌트가 언마운트될 때 **딱 한 번** 실행된다. React의 `useEffect` cleanup처럼 매 렌더마다 실행되지 않는다.

AEUI에서는 컴포넌트 함수(setup)가 한 번만 실행되므로, clean도 한 번만 등록되고 한 번만 실행된다.

### clean vs React useEffect return

| | AEUI `clean` | React `useEffect` return |
|---|---|---|
| 실행 시점 | 컴포넌트 unmount 시만 | 매 렌더 시 + unmount 시 |
| 등록 방식 | `clean(() => ...)` 별도 호출 | `useEffect` 내부에서 `return () => ...` |
| 등록 횟수 | 여러 번 가능 | effect당 1개 |
| watch와의 관계 | 독립적 | 동일 함수 안에서 관리 |

---

## 관련 코드 위치

- `clean` 함수: `packages/core/src/hooks.js`
- runtime bridge: `packages/core/src/runtime.js`
- cleanup 실행: `packages/core/src/reconciler.js` `_unmount`
