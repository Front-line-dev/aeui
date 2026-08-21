# 14. 훅 레지스트리 — `watch`와 `clean`

## 개요

이 문서는 AEUI의 두 훅(`watch`, `clean`)의 등록 로직과 사용법을 통합하여 설명한다.

- `hook-registry.js`: 등록 로직 담당
- `hooks.js`: public API (`watch` compile guard, `clean` fallback wrapper)
- `component-watchers.js`: watch 실행 엔진
- `component-lifecycle.js`: clean 실행 (unmount 시)

---

## watch 훅

`watch`는 특정 값의 변경을 감시하거나, 매 render마다 콜백을 실행하는 훅이다. 두 가지 모드가 있다.

| 모드 | 호출 | 실행 시점 |
|---|---|---|
| **항상 실행** | `watch(cb)` | 매 render마다 렌더 직전에 callback 실행 |
| **deps 기반** | `watch(cb, deps)` | 처음 등록 시는 실행하지 않고, 이후 deps 변경 시만 실행 |

- React `useEffect`처럼 보이지만, 실행 타이밍은 AEUI의 render phase와 dirty checking 루프에 맞춰져 있다.
- deps 비교는 참조 비교가 아니라 `deepEqual` 기반 값 비교다.
- 등록은 component setup에서 1회만 일어난다.

```javascript
let count = 0;

watch(() => {
  console.log('count 변경됨:', count);
}, [count]);
```

### 함수 시그니처

```javascript
watch(callback)         // 항상 실행 모드
watch(callback, deps)   // deps 기반 모드
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `callback` | `Function` | 변경 시(또는 매 render시) 실행할 함수 |
| `deps` | `Array` 또는 `() => Array` (선택) | 감시할 값 배열 또는 배열을 반환하는 함수. 생략하면 매 render마다 실행 |

Babel 플러그인은 `watch(callback, [count])`의 deps 배열을 getter 형태로 바꾸고, 호출 지점도 `AEUI.__runtime.watch(...)` helper로 옮긴다.

### 등록 규칙

`watch()`는 **setup phase에서만 등록**된다.

compiled main path에서는 `AEUI.__runtime.watch(...)`가 현재 runtime state를 직접 사용한다. `hooks.js`의 public `watch()` export는 import 호환을 위해 남아 있지만, Babel 변환 없이 직접 실행되면 명시적으로 실패한다.

유효한 경우:
- 컴포넌트 setup 본문 최상위에서 호출
- compiled path에서는 현재 runtime state가 setup phase

무시되는 경우:
- 이벤트 핸들러 내부
- 타이머/Promise 콜백 내부
- render 함수 내부

### 내부 동작

#### 등록 — `registerWatch(runtime, callback, deps)`

`hook-registry.js`가 callback-first 인자를 검증하고 watcher 객체를 등록한다.

```text
1. getSetupComponentNode(runtime) → setup phase의 component node
2. node가 없으면 리턴 (render phase이거나 컴포넌트 밖)
3. callback이 함수가 아니면 TypeError
4-a. deps가 없으면 → 항상 실행 모드 watcher 등록 (getDeps: null)
4-b. deps가 있으면 배열/배열 getter 검증 후 deps 기반 watcher 등록
5. node.watchStates에 watcher 객체 push
```

등록되는 watcher 객체:

**deps 기반 모드:**

```javascript
{
  callback,
  getDeps,
  oldDeps: runtime.deepClone(getDeps()),
}
```

**항상 실행 모드 (deps 없음):**

```javascript
{
  callback,
  getDeps: null,
  oldDeps: null,
}
```

`getDeps`가 `null`이면 deps 비교를 건너뛰고 매 render에서 callback을 실행한다.

deps 기반 모드에서 `deepClone`을 쓰는 이유는 배열/객체 deps의 mutation도 감지하기 위해서다.

#### 실행 경로

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

#### deps snapshot 갱신

watch callback이 deps를 다시 바꿀 수 있으므로, callback 뒤에 `getDeps()`를 한 번 더 호출해 최종 deps를 `oldDeps`로 저장한다.

### 사용 시 주의사항

**render 안에서 watch를 호출하면 등록되지 않는다:**

```jsx
function BadCase() {
  let count = 0;

  return () => {
    watch(() => console.log(count), [count]); // 무시됨
    return <button>{count}</button>;
  };
}
```

**deps getter는 현재 값을 읽을 수 있어야 한다.** 배열 자체를 한번 계산해서 넘기면 값이 고정될 수 있으므로, Babel 플러그인이 deps를 함수로 감싸 준다.

**에러는 격리된다.** watcher 하나가 실패해도 나머지 watcher와 render는 계속 진행된다.

---

## clean 훅

`clean`은 컴포넌트가 언마운트될 때 실행할 정리 함수를 등록하는 훅이다.

```javascript
function Timer() {
  const id = setInterval(() => console.log('tick'), 1000);
  clean(() => clearInterval(id));
  return <div>타이머 동작 중</div>;
}
```

타이머, 이벤트 리스너, 소켓 연결처럼 컴포넌트 수명과 함께 정리돼야 하는 리소스를 여기 등록한다.

### 함수 시그니처

```javascript
clean(callback)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `callback` | `Function` | 언마운트 시 실행할 정리 함수 |

### 등록 규칙

`clean()`도 `watch()`와 동일하게 **setup phase에서만 등록**된다.

compiled main path에서는 Babel 플러그인이 `clean(...)`을 `AEUI.__runtime.clean(...)`으로 바꾼다.

허용:
- 컴포넌트 setup 본문 최상위
- compiled path에서는 현재 runtime state가 setup phase
- fallback path에서는 `withComponentContext(..., 'setup')` 안

render 함수나 이벤트 핸들러 안에서 호출한 `clean()`은 등록되지 않는다.

### 내부 동작 — `registerCleanup(runtime, callback)`

```javascript
export function registerCleanup(runtime, callback) {
  if (!runtime) return;

  const node = getSetupComponentNode(runtime);
  if (!node) return;
  node.cleanups.push(callback);
}
```

### 실행

언마운트 경로:

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

현재 구현 기준 cleanup 순서는 **부모 component cleanup 먼저, 그 다음 자식 subtree unmount**다.

### 에러 격리

cleanup 하나가 실패해도 나머지 cleanup과 unmount 흐름은 계속 진행된다.

### 사용 시 주의사항

- **한 번 등록되면 component lifetime 동안 유지된다.** 매 render마다 교체되거나 diff되지 않는다.
- setup 밖 호출은 무시된다.

---

## Phase 가드

```javascript
function getSetupComponentNode(runtime) {
  const node = runtime.currentComponentNode;
  if (!node) return null;
  if (runtime.currentComponentPhase !== 'setup') return null;
  return node;
}
```

`currentComponentPhase`가 `'setup'`일 때만 node를 반환한다. render phase에서 호출된 `watch()`/`clean()`은 `null`을 받아 등록이 무시된다.

---

## 관련 코드 위치

- `packages/core/src/hook-registry.js`
- `packages/core/src/hooks.js`
- `packages/core/src/runtime-context.js`
- `packages/core/src/app-runtime.js`
- `packages/core/src/component-watchers.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/compiler-runtime.js`
- `packages/core/src/reconciler.js`
- `packages/core/src/babel-plugin.js`

## 관련 문서

- Watcher 실행 엔진: [15. Watcher 실행](15-watcher.md)
- 컴포넌트 생명주기: [05. 컴포넌트 생명주기](05-component-lifecycle.md)
- 런타임 컨텍스트: [13. 런타임 컨텍스트](13-runtime-context.md)
- Unmount 상세: [09. Unmount](09-unmount.md)
