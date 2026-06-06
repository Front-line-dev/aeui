# Watcher 실행 — `component-watchers.js`

## 개요

watcher는 `watch()` 훅으로 등록된 의존성 감시 엔트리다. 실제 실행 엔진은 `component-watchers.js`와 `component-lifecycle.js`가 맡고, 등록은 Babel 플러그인이 만든 compiled helper 경로로 들어온다.

책임 분리는 다음과 같다.

- `app-runtime.js` / `AEUI.__runtime.watch`: compiled path watcher 등록
- `hooks.js`: public `watch()` compile guard
- `hook-registry.js`: watcher 등록 helper
- `component-watchers.js`: deps 비교와 callback 실행
- `component-lifecycle.js`: render phase 안에서 watcher 실행 순서 보장
- `compiler-runtime.js`: Babel plugin이 호출하는 얇은 bridge

---

## 실행 엔진

```javascript
runComponentWatchers(state, node)
```

| 파라미터 | 설명 |
|----------|------|
| `state` | `deepEqual`, `deepClone`을 가진 runtime state |
| `node` | watcher를 실행할 component RuntimeNode |

핵심 로직은 단순하다.

```javascript
node.watchStates.forEach((watcher) => {
  const newDeps = watcher.getDeps();
  const hasChanged = !watcher.oldDeps || !state.deepEqual(newDeps, watcher.oldDeps);

  if (hasChanged) {
    watcher.callback();
    watcher.oldDeps = state.deepClone(watcher.getDeps());
  }
});
```

---

## 호출 경로

render wrapper는 Babel plugin이 만든 `AEUI.__runtime.runRenderPhase()` 호출로 시작된다.

```text
AEUI.__runtime.runRenderPhase(...)
  → core.js
  → compiler-runtime.js: runRenderPhaseBridge(...)
  → component-lifecycle.js: runComponentRenderPhase(...)
  → component-watchers.js: runComponentWatchers(...)
```

이 흐름 덕분에 watcher는 항상:

1. 최신 props가 동기화된 뒤
2. 실제 JSX render 직전에
3. 같은 component context 안에서

실행된다.

---

## 왜 render 직전에 실행하는가

watch callback이 같은 tick 안에서 local state를 바꿀 수 있기 때문이다.

```javascript
let count = 0;
let label = '';

watch(() => {
  label = `카운트: ${count}`;
}, [count]);

return <p>{label}</p>;
```

watcher를 render 전에 실행해야 `label` 변경이 같은 render 결과에 바로 반영된다.

---

## 에러 격리

각 watcher는 개별 `try-catch`로 감싸진다. 하나가 실패해도 나머지 watcher와 render는 계속된다.

---

## 관련 코드 위치

- `packages/core/src/hooks.js`
- `packages/core/src/component-watchers.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/compiler-runtime.js`
- `packages/core/src/core.js`
