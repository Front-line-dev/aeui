# Watcher 실행 — `_runComponentWatchers`

## 개요

watcher는 컴포넌트에 등록된 **의존성 감시 로직**이다. `watch()` 훅으로 등록되며, 특정 값이 변경되면 콜백을 실행한다. React의 `useEffect`와 비슷한 역할이지만, AEUI에서는 render phase와 dirty checking 루프에 맞춰 동작한다.

```javascript
let count = 0;
watch([count], () => {
  console.log("count가 변경됨:", count);
});
```

현재 구조에서는 watcher 실행 책임이 세 층으로 나뉜다.

- `hooks.js`: watcher 등록
- `component-watchers.js`: 의존성 비교와 callback 실행
- `component-lifecycle.js`: render phase 안에서 watcher 호출 순서 관리

호환성을 위해 `AEUI._runComponentWatchers()` wrapper도 남아 있지만, 실제 주 경로는 `AEUI._runRenderPhase()`가 render phase 안에서 watcher를 실행하는 방식이다.

---

## 함수 시그니처

실제 실행 엔진은 현재 다음 형태다.

```javascript
runComponentWatchers(state, node)
```

| 파라미터 | 설명 |
|----------|------|
| `state` | `deepEqual`, `deepClone` 등을 제공하는 runtime state |
| `node` | watcher를 실행할 컴포넌트 RuntimeNode |

`runtime.js`의 `_runComponentWatchers(state, node)`와 `core.js`의 `AEUI._runComponentWatchers(node)`는 이 엔진을 감싸는 wrapper이다.

---

## 동작 과정

```text
node.watchStates 배열을 순회:
  각 watcher에 대해:
    1. getDeps() 호출 → 현재 의존성 값 배열 획득
    2. oldDeps와 비교
       ├── oldDeps가 null → 변경됨
       └── state.deepEqual(newDeps, oldDeps)가 false → 변경됨
    3. 변경된 경우:
       ├── callback() 실행
       ├── getDeps()를 다시 호출해 callback 이후 최종 deps 획득
       └── oldDeps = state.deepClone(finalDeps)
    4. try-catch로 감싸 에러를 격리
```

### 코드

```javascript
export function runComponentWatchers(state, node) {
  if (!node || !node.watchStates) return;

  node.watchStates.forEach((watcher) => {
    try {
      const newDeps = watcher.getDeps();
      const hasChanged =
        !watcher.oldDeps ||
        !state.deepEqual(newDeps, watcher.oldDeps);

      if (hasChanged) {
        watcher.callback();
        const finalDeps = watcher.getDeps();
        watcher.oldDeps = state.deepClone(finalDeps);
      }
    } catch (error) {
      console.error('[AEUI] Watcher error:', error);
    }
  });
}
```

---

## Watcher 구조

`watch()` 훅으로 등록되는 각 watcher 객체의 형태:

```javascript
{
  callback: Function,
  getDeps: () => Array,
  oldDeps: Array | null
}
```

각 필드의 역할:

| 필드 | 설명 |
|------|------|
| `callback` | 의존성이 변경되었을 때 실행할 사용자 정의 함수 |
| `getDeps` | 호출될 때마다 현재 의존성 값을 반환하는 함수 |
| `oldDeps` | 마지막 실행 시점의 의존성 스냅샷 |

### getDeps가 함수인 이유

사용자는 `watch([count], cb)`처럼 배열을 직접 전달하지만, Babel 플러그인이 이를 `watch(() => [count], cb)`로 변환한다. 그래야 매 호출 시 클로저에서 **현재 값**을 다시 읽을 수 있다.

### oldDeps에 `deepClone`을 사용하는 이유

의존성에 객체나 배열이 포함되면 참조 공유로는 변경 감지가 불안정해질 수 있다. 따라서 watcher는 callback 이후 deps를 다시 읽고, 그 최종 상태를 깊은 복사본으로 보관한다.

---

## 호출 시점

이전 구조에서는 Babel이 render wrapper 안에서 `updateProps()`와 `_runComponentWatchers()`를 직접 호출했다. 현재 구조에서는 render wrapper가 `AEUI._runRenderPhase()` 하나만 호출하고, 그 안에서 `runComponentRenderPhase()`가 watcher를 render 전에 실행한다.

| 호출 위치 | 현재 역할 |
|-----------|-----------|
| `packages/core/src/babel-plugin.js` | render wrapper에서 `AEUI._runRenderPhase()` 호출 |
| `packages/core/src/core.js` | `_runRenderPhase()` public/runtime bridge |
| `packages/core/src/component-lifecycle.js` | props 동기화 후 `runComponentWatchers()` 호출 |

### 왜 render 전에 실행하는가

watch callback이 state를 변경할 수 있기 때문이다.

```javascript
let count = 0;
let displayText = "";

watch([count], () => {
  displayText = `카운트: ${count}`;
});

return <p>{displayText}</p>;
```

watcher를 render보다 먼저 실행하면, 같은 render phase 안에서 최신 `displayText`로 JSX를 계산할 수 있다.

### callback 이후 최종 deps를 다시 저장하는 이유

watch callback이 deps를 다시 변경할 수 있기 때문이다.

```javascript
let count = 0;

watch([count], () => {
  if (count > 10) count = 10;
});
```

callback 종료 후 deps를 다시 읽어야 다음 tick에서 불필요한 재실행을 막을 수 있다.

---

## 에러 격리

각 watcher는 개별 `try-catch`로 감싸진다. 하나의 watcher에서 에러가 나도 나머지 watcher와 component render flow는 계속 진행된다.

---

## 관련 코드 위치

- `packages/core/src/hooks.js`
- `packages/core/src/component-watchers.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/runtime.js`
- `packages/core/src/core.js`
