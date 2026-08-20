# 컴파일러 런타임 — `compiler-runtime.js`

## 개요

`compiler-runtime.js`는 Babel 플러그인이 생성한 코드와 프레임워크 내부 모듈 사이의 **얇은 브리지**다.

Babel 플러그인은 컴포넌트의 render wrapper를 `AEUI.__runtime.runRenderPhase()`로 변환한다. 이 호출이 `compiler-runtime.js`를 거쳐 `component-lifecycle.js`의 실제 로직으로 전달된다.

---

## `runRenderPhaseBridge(state, nextProps, propsTarget, render)`

Babel 플러그인이 변환한 렌더 함수에서 호출되는 진입점이다.

### 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `state` | `Object` | runtime state |
| `nextProps` | `Object` | 이번 render의 props |
| `propsTarget` | `Object` | 컴파일러가 만든 props 저장 객체. 클로저에서 같은 참조를 유지한다. |
| `render` | `Function` | 실제 render 함수 |

### 동작

```text
1. state.currentComponentNode가 없으면 → render(nextProps) 직접 호출 (fallback)
2. 있으면 → runComponentRenderPhase(state, node, nextProps, render, options) 호출
   options: { propsTarget, runWatchers: true }
```

fallback 경로는 Babel 변환을 거쳤지만 컴포넌트 컨텍스트 밖에서 실행되는 드문 경우를 위한 안전망이다.

### 코드

```javascript
export function runRenderPhaseBridge(state, nextProps, propsTarget, render) {
  const node = state.currentComponentNode;
  if (!node) {
    return typeof render === 'function' ? render(nextProps || {}) : null;
  }

  return runComponentRenderPhase(state, node, nextProps, render, {
    propsTarget,
    runWatchers: true,
  });
}
```

---

## `runComponentWatchersBridge(state, node)`

component watcher 실행을 `component-watchers.js`로 위임한다.

```javascript
export function runComponentWatchersBridge(state, node) {
  runComponentWatchers(state, node);
}
```

이 함수는 값을 가공하거나 오류를 처리하지 않고 watcher 실행을 그대로 위임한다.

---

## Babel 플러그인과의 관계

Babel 플러그인이 생성하는 코드와 이 모듈의 대응:

| Babel 생성 코드 | bridge 함수 | 최종 목적지 |
|-----------------|-------------|-------------|
| `AEUI.__runtime.runRenderPhase(...)` | `runRenderPhaseBridge` | `component-lifecycle.js:runComponentRenderPhase` |
| `AEUI.__runtime.watch(...)` | (직접) | `hook-registry.js:registerWatch` |
| `AEUI.__runtime.clean(...)` | (직접) | `hook-registry.js:registerCleanup` |

`watch`와 `clean`은 bridge 없이 `hook-registry.js`로 직접 연결된다. `runRenderPhase`만 bridge가 필요한 이유는 props 동기화, watcher 실행, render 호출이 하나의 트랜잭션으로 묶여야 하기 때문이다.

---

## 관련 코드 위치

- `packages/core/src/compiler-runtime.js`
- `packages/core/src/component-lifecycle.js`
- `packages/core/src/component-watchers.js`
- `packages/core/src/babel-plugin.js`
