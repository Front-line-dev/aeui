# watch 훅

## 개요

`watch`는 특정 값의 변경을 감시하고, 값이 바뀌면 콜백을 실행하는 훅이다.

- React `useEffect`처럼 보이지만, 실행 타이밍은 AEUI의 render phase와 dirty checking 루프에 맞춰져 있다.
- deps 비교는 참조 비교가 아니라 `deepEqual` 기반 값 비교다.
- 등록은 component setup에서 1회만 일어난다.

```javascript
let count = 0;

watch(() => {
  console.log('count 변경됨:', count);
}, [count]);
```

---

## 함수 시그니처

```javascript
watch(callback, deps)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `callback` | `Function` | 변경 시 실행할 함수 |
| `deps` | `Array` 또는 `() => Array` | 감시할 값 배열 또는 배열을 반환하는 함수 |

Babel 플러그인은 `watch(callback, [count])`의 deps 배열을 getter 형태로 바꾸고, 호출 지점도 `AEUI.__runtime.watch(...)` helper로 옮긴다.

---

## 등록 규칙

`watch()`는 **setup phase에서만 등록**된다.

compiled main path에서는 `AEUI.__runtime.watch(...)`가 현재 runtime state를 직접 사용한다. `hooks.js`의 public `watch()` export는 import 호환을 위해 남아 있지만, Babel 변환 없이 직접 실행되면 명시적으로 실패한다.

즉 다음 경우만 유효하다.

- 컴포넌트 setup 본문 최상위에서 호출
- compiled path에서는 현재 runtime state가 setup phase

다음 경우는 무시된다.

- 이벤트 핸들러 내부
- 타이머/Promise 콜백 내부
- render 함수 내부

이 제약은 "등록은 setup, 실행은 render"라는 계약을 명시적으로 강제하기 위해 들어갔다.

---

## 내부 동작

### 1. 등록

`hook-registry.js`가 callback-first 인자를 검증하고 watcher 객체를 등록한다. compiled code는 `AEUI.__runtime.watch()`를 통해 여기로 들어온다.

```javascript
{
  callback,
  getDeps,
  oldDeps: runtime.deepClone(getDeps()),
}
```

각 필드의 의미:

- `callback`: 변경 시 실행할 사용자 함수
- `getDeps`: 현재 deps를 다시 읽는 함수
- `oldDeps`: 마지막 스냅샷

`deepClone`을 쓰는 이유는 배열/객체 deps의 mutation도 감지하기 위해서다.

### 2. 실행

실행 경로는 다음과 같다.

```text
Babel plugin
  → AEUI.__runtime.runRenderPhase(...)
    → core.js bridge
      → compiler-runtime.js
        → component-lifecycle.js: runComponentRenderPhase(...)
          → component-watchers.js: runComponentWatchers(...)
```

`runComponentRenderPhase()`는:

1. 최신 props를 동기화하고
2. watcher를 실행한 뒤
3. 실제 render 함수를 호출한다

따라서 watcher callback이 같은 tick 안에서 local state를 바꿔도, 그 결과가 바로 이어지는 JSX 계산에 반영된다.

### 3. deps snapshot 갱신

watch callback이 deps를 다시 바꿀 수 있으므로, callback 뒤에 `getDeps()`를 한 번 더 호출해 최종 deps를 `oldDeps`로 저장한다.

---

## 사용 시 주의사항

### render 안에서 watch를 호출하면 등록되지 않는다

```jsx
function BadCase() {
  let count = 0;

  return () => {
    watch(() => console.log(count), [count]); // 무시됨
    return <button>{count}</button>;
  };
}
```

이는 버그가 아니라 계약이다. watcher 등록은 setup 한 번으로 끝나야 한다.

### deps getter는 현재 값을 읽을 수 있어야 한다

배열 자체를 한번 계산해서 넘기면 값이 고정될 수 있으므로, Babel 플러그인이 deps를 함수로 감싸 준다. 내부 runtime helper는 배열과 deps getter를 모두 받지만, getter가 반환하는 값은 배열이어야 한다.

### 에러는 격리된다

watcher 하나가 실패해도 나머지 watcher와 render는 계속 진행된다. 에러는 `console.error`로만 기록된다.

---

## 관련 코드 위치

- `packages/core/src/hook-registry.js`
- `packages/core/src/hooks.js`
- `packages/core/src/runtime-context.js`
- `packages/core/src/app-runtime.js`
- `packages/core/src/component-watchers.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/compiler-runtime.js`
- `packages/core/src/babel-plugin.js`
