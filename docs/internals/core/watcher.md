# Watcher 실행 — `runComponentWatchers`, `_runRenderPhase`

## 개요

watcher 실행 경로도 이번 단순화에서 분리되었다.

- watcher 등록: `hooks.js`
- watcher 실행 엔진: `component-watchers.js`
- render phase orchestration: `component-lifecycle.js`
- public 진입점: `AEUI._runRenderPhase()`

즉, watcher는 더 이상 Babel이 `updateProps()`와 `_runComponentWatchers()`를 각각 직접 호출하는 방식에 의존하지 않는다. 이제 Babel은 **단일 helper인 `AEUI._runRenderPhase(...)`만 호출**하고, 그 안에서 props sync와 watcher 실행이 함께 처리된다.

---

## Watcher 구조

`watch()`로 등록된 항목은 컴포넌트 node의 `watchStates` 배열에 저장된다.

```javascript
{
  callback: Function,
  getDeps: () => Array,
  oldDeps: Array | null
}
```

여기서 `getDeps`는 Babel이 `watch([a, b], cb)`를 `watch(() => [a, b], cb)`로 바꿔 주기 때문에 항상 현재 값을 다시 읽을 수 있다.

---

## 실행 엔진

실제 비교와 실행은 `component-watchers.js`의 `runComponentWatchers(state, node)`가 담당한다.

```javascript
export function runComponentWatchers(state, node) {
  if (!node || !node.watchStates) return;

  node.watchStates.forEach((watcher) => {
    try {
      const newDeps = watcher.getDeps();
      const hasChanged = !watcher.oldDeps || !state.deepEqual(newDeps, watcher.oldDeps);

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

핵심 차이:

- deps 비교는 element 단위 루프가 아니라 `state.deepEqual(newDeps, oldDeps)`에 위임된다
- callback 이후 deps를 다시 읽어 최종 상태를 snapshot으로 저장한다
- watcher 하나가 실패해도 나머지는 계속 실행한다

---

## Render Phase와의 연결

watcher는 현재 `runComponentRenderPhase()` 안에서 실행된다.

```javascript
export function runComponentRenderPhase(state, node, nextProps, render, options = {}) {
  const { propsTarget = null, runWatchers = true } = options;
  node.props = nextProps || {};
  syncPropsTarget(propsTarget, node.props);

  if (runWatchers) {
    runComponentWatchers(state, node);
  }

  return withCurrentComponent(state, node, () => render(node.props));
}
```

따라서 render phase의 순서는 다음과 같다.

```text
1. 새 props를 node.props에 반영
2. 필요하면 propsTarget(__props)을 동기화
3. watcher 실행
4. 현재 component context로 render 함수 실행
```

watcher가 state를 바꾸더라도 같은 render phase 안에서 바로 다음 JSX 계산에 반영될 수 있다.

---

## `AEUI._runRenderPhase()`

`core.js`는 Babel과 runtime 사이의 안정적인 단일 진입점으로 `_runRenderPhase()`를 노출한다.

```javascript
_runRenderPhase: (nextProps, propsTarget, render) => {
  const node = runtimeState.currentComponentNode;
  if (!node) {
    return typeof render === 'function' ? render(nextProps || {}) : null;
  }

  return runComponentRenderPhase(runtimeState, node, nextProps, render, {
    propsTarget,
    runWatchers: true,
  });
}
```

이 구조 덕분에 Babel은 더 이상 runtime 내부 세부 구현을 알 필요가 없다. "render phase 실행"이라는 계약 하나만 알면 된다.

`AEUI._runComponentWatchers(node)`는 여전히 남아 있지만, 현재는 호환성과 테스트 편의를 위한 wrapper에 가깝다. 주 경로는 `_runRenderPhase()`다.

---

## 왜 이 구조가 단순한가

이전 경로:

```text
Babel wrapper
  -> updateProps(__props, _newProps)
  -> _runComponentWatchers(currentNode)
  -> inner render()
```

현재 경로:

```text
Babel wrapper
  -> _runRenderPhase(_newProps, __props, innerRender)
```

watcher 실행 책임이 한 함수 안으로 모였기 때문에:

- Babel contract가 줄어들고
- runtime의 내부 helper 조합이 외부에 노출되지 않고
- watcher ordering을 한 곳에서 테스트할 수 있다

---

## 관련 코드 위치

- `packages/core/src/hooks.js`
- `packages/core/src/component-watchers.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/core.js`
