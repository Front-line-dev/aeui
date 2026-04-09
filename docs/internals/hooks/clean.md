# clean 훅

## 개요

`clean`은 컴포넌트가 언마운트될 때 실행할 정리 함수를 등록하는 훅이다.

```javascript
function Timer() {
  const id = setInterval(() => console.log('tick'), 1000);
  clean(() => clearInterval(id));
  return <div>타이머 동작 중</div>;
}
```

타이머, 이벤트 리스너, 소켓 연결처럼 컴포넌트 수명과 함께 정리돼야 하는 리소스를 여기 등록한다.

---

## 함수 시그니처

```javascript
clean(callback)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `callback` | `Function` | 언마운트 시 실행할 정리 함수 |

---

## 등록 규칙

`clean()`도 `watch()`와 동일하게 **setup phase에서만 등록**된다.

compiled main path에서는 Babel 플러그인이 `clean(...)`을 `AEUI.__runtime.clean(...)`으로 바꾼다. 이 helper는 현재 runtime state를 직접 보고 cleanup을 등록한다. `hooks.js`의 `clean()`은 fallback wrapper다.

즉 다음만 허용된다.

- 컴포넌트 setup 본문 최상위
- compiled path에서는 현재 runtime state가 setup phase
- fallback path에서는 `withComponentContext(..., 'setup')` 안

render 함수나 이벤트 핸들러 안에서 호출한 `clean()`은 등록되지 않는다.

---

## 내부 동작

### 등록

등록된 cleanup은 component node의 `cleanups` 배열에 쌓인다.

```javascript
node.cleanups.push(callback);
```

### 실행

언마운트 경로는 다음과 같다.

```text
reconciler.js:unmountNode(state, node)
  → component node면 cleanupComponentNode(state, node)
  → 자식 subtree 재귀 unmount
  → DOM range 제거
```

`cleanupComponentNode()`는:

1. `cleanups`를 등록 순서대로 실행
2. `watchStates`, `cleanups`, `renderedNode`, `renderFactory`를 비움
3. 필요 시 children / DOM range bookkeeping을 정리

현재 구현 기준 cleanup 순서는 **부모 component cleanup 먼저, 그 다음 자식 subtree unmount**다. 문서를 읽을 때 React의 effect cleanup 순서와 동일하다고 가정하면 안 된다.

### 에러 격리

cleanup 하나가 실패해도 나머지 cleanup과 unmount 흐름은 계속 진행된다.

---

## 사용 시 주의사항

### 한 번 등록되면 component lifetime 동안 유지된다

AEUI는 setup이 한 번만 실행되므로 cleanup도 한 번만 등록된다. 매 render마다 교체되거나 diff되지 않는다.

### cleanup 안에서 DOM이나 외부 리소스를 정리해도 된다

주요 용도:

- `clearInterval`
- `removeEventListener`
- `WebSocket.close()`
- 외부 store unsubscribe

### setup 밖 호출은 무시된다

```jsx
function Example() {
  clean(() => console.log('정리됨')); // 정상 등록

  return (
    <button
      onClick={() => {
        clean(() => console.log('무시됨'));
      }}
    >
      클릭
    </button>
  );
}
```

---

## 관련 코드 위치

- `packages/core/src/hook-registry.js`
- `packages/core/src/hooks.js`
- `packages/core/src/runtime-context.js`
- `packages/core/src/app-runtime.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/reconciler.js`
