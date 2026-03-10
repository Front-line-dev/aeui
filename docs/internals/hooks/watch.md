# watch 훅

## 개요

`watch`는 **특정 값의 변경을 감시하고, 변경 시 콜백을 실행**하는 훅이다. React의 `useEffect`와 유사한 역할을 하지만, 동작 방식이 근본적으로 다르다.

- React `useEffect`: 렌더링 후에 실행되며, deps 배열의 참조가 변경되면 트리거
- AEUI `watch`: 매 tick(1초)마다 deps의 **값(내용)**을 깊은 비교하여 변경 시 트리거

```javascript
let count = 0;

watch(() => {
  console.log("count 변경됨:", count);
}, [count]);
```

위 코드는 "매 tick마다 `count`의 현재 값을 이전 값과 비교하고, 다르면 콜백을 실행해라"라는 의미이다.

---

## 함수 시그니처

```javascript
watch(callback, depsGetter)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `callback` | `Function` | 의존성이 변경되었을 때 실행할 함수 |
| `depsGetter` | `Array` 또는 `() => Array` | 감시할 값들의 배열. Babel 플러그인이 함수로 변환해 주므로 사용자는 배열만 전달하면 된다 |

---

## 사용자 관점 사용법

### 기본 사용

```jsx
function Counter() {
  let count = 0;

  watch(() => {
    document.title = `카운트: ${count}`;
  }, [count]);

  return <button onClick={() => count++}>{count}</button>;
}
```

`count`가 변경되면 다음 tick에서 `document.title`이 업데이트된다.

### 여러 의존성 감시

```jsx
let firstName = "홍";
let lastName = "길동";

watch(() => {
  console.log(`이름: ${firstName} ${lastName}`);
}, [firstName, lastName]);
```

`firstName` 또는 `lastName` 중 **하나라도** 변경되면 콜백이 실행된다.

### 객체/배열 감시

```jsx
let items = [1, 2, 3];

watch(() => {
  console.log("목록 변경:", items.length);
}, [items]);
```

`items.push(4)`처럼 **직접 수정(mutation)**해도 변경이 감지된다. AEUI는 `_deepEqual`로 이전 스냅샷과 내용을 비교하므로, 참조가 같아도 내용이 다르면 변경으로 판단한다.

### 의존성 없는 watch (매 tick 실행)

```jsx
watch(() => {
  console.log("매 tick마다 실행");
}, [Date.now()]);
```

`Date.now()`는 호출될 때마다 항상 다른 값을 반환하므로, 매 tick마다 콜백이 실행된다.

---

## 내부 동작 원리

### 1단계: 등록 (setup 시 1회)

`watch()`는 컴포넌트의 setup 단계에서 호출되어, 현재 component node의 `watchStates` 배열에 watcher 객체를 등록한다.

```javascript
export function watch(callback, depsGetter) {
  const runtime = getRuntimeContext();
  if (!runtime) return;

  const node = runtime.getCurrentComponentNode();  // 현재 처리 중인 컴포넌트 node
  if (node) {
    // depsGetter가 이미 함수이면 그대로, 배열이면 함수로 감싸기
    const initialDeps =
      typeof depsGetter === "function" ? depsGetter() : depsGetter;

    node.watchStates.push({
      callback,
      getDeps:
        typeof depsGetter === "function" ? depsGetter : () => depsGetter,
      oldDeps: runtime.deepClone(initialDeps),  // 초기 값의 깊은 복사 스냅샷
    });
  }
}
```

#### `runtime.js`를 통한 component node 접근

`watch()`가 호출되는 시점에는 `createNode()`가 component node를 생성하는 중이며, 그 안에서 `AEUI._currentComponentNode`가 현재 node로 설정되어 있다. `hooks.js`는 `runtime.js`를 통해 이 값에 간접 접근하므로, `core.js`를 직접 import하지 않아 순환 참조를 피한다.

```
createNode(component) 시작
  → _currentComponentNode = node
  → 컴포넌트 함수(setup) 실행
    → watch() 호출 → node.watchStates.push(...)  ← 여기
    → clean() 호출 → node.cleanups.push(...)
  → _currentComponentNode = null
```

#### `depsGetter`가 배열과 함수 양쪽을 처리하는 이유

사용자는 `watch(cb, [count])`로 **배열**을 전달하지만, Babel 플러그인이 이를 `watch(cb, () => [count])`로 **함수**로 변환한다. 함수로 감싸야 하는 이유:

```javascript
// 배열을 직접 전달하면
let count = 0;
watch(cb, [count]);    // ← 이 시점에 [count]는 [0]으로 평가되어 고정됨

// 이후 count = 5가 되어도 getDeps()는 항상 [0]을 반환
// → 변경 감지 불가능

// 함수로 감싸면
let count = 0;
watch(cb, () => [count]);  // ← 매 호출 시 클로저에서 현재 count 값을 읽음

// count = 5가 되면 getDeps()는 [5]를 반환
// → [0] vs [5] 비교로 변경 감지 성공
```

그런데 Babel 변환 없이 직접 `watch`를 호출하는 경우(테스트 등)를 위해, 배열이 직접 전달되면 `() => depsGetter`로 감싸서 함수 형태로 통일한다.

#### `oldDeps` 초기화에 `_deepClone`을 사용하는 이유

의존성 값이 객체나 배열이면 참조를 저장하면 원본이 수정될 때 oldDeps도 함께 변경되어 변화를 감지하지 못한다. `_deepClone`으로 **독립적 복사본**을 만들어 이 문제를 방지한다.

### 2단계: 실행 (매 tick)

등록된 watcher는 매 tick마다 `_runComponentWatchers`에 의해 실행된다. 상세 동작은 `docs/internals/core/watcher.md` 참조.

요약:
1. `getDeps()` 호출 → 현재 의존성 값 배열 획득
2. `oldDeps`와 `_deepEqual`로 요소별 비교
3. 변경 감지 시 → `callback()` 실행 → `oldDeps = _deepClone(newDeps)`

### 실행 타이밍: render보다 먼저

watcher는 렌더 함수보다 **먼저** 실행된다. watch callback이 상태를 변경할 수 있고, 그 변경이 렌더 결과(JSX)에 즉시 반영되어야 하기 때문이다.

```
tick 시작
  → _runComponentWatchers(instance)  ← watch callback이 상태를 변경할 수 있음
  → instance.render(props)            ← 변경된 상태가 JSX에 반영됨
  → _reconcile(...)                   ← DOM 업데이트
```

---

## 주의사항

### watch는 setup에서만 호출 가능

`watch()`는 컴포넌트의 setup 단계(함수 본문의 최상위)에서만 호출해야 한다. 이벤트 핸들러나 조건문 안에서 호출하면 `_currentComponentNode`가 `null`이므로 등록되지 않는다.

```jsx
function Counter() {
  let count = 0;

  // ✅ setup에서 호출 — 정상 등록
  watch(() => console.log(count), [count]);

  return (
    <button onClick={() => {
      count++;
      // ❌ 이벤트 핸들러에서 호출 — 등록되지 않음
      watch(() => console.log("이건 실행 안 됨"), [count]);
    }}>
      {count}
    </button>
  );
}
```

### watch는 해제할 수 없다

한번 등록된 watcher는 컴포넌트가 언마운트될 때까지 유지된다. 동적으로 watcher를 추가/제거하는 기능은 없다.

### 콜백 내 에러는 격리된다

하나의 watch callback에서 에러가 발생해도, 나머지 watcher와 렌더링은 정상 진행된다. 에러는 `console.error`로 로깅된다.

---

## 관련 코드 위치

- `watch` 함수: `packages/core/src/hooks.js` L3-L15
- runtime bridge: `packages/core/src/runtime.js`
- watcher 실행 로직: `packages/core/src/runtime.js` (`AEUI._runComponentWatchers` 통해 호출)
- Babel 변환 (deps 함수 래핑): `packages/core/src/babel-plugin.js`
