# 앱 런타임 — `app-runtime.js`

## 개요

`app-runtime.js`는 AEUI 런타임 인스턴스의 **팩토리**다. `createAppRuntime()`이 격리된 런타임을 하나 만들어 반환한다.

이전에는 글로벌 싱글턴 state 객체에 함수를 직접 바인딩했지만, 이 모듈이 도입된 뒤에는 모든 런타임 함수가 하나의 state 객체에 묶여서 독립적으로 동작한다. 테스트나 다중 앱 시나리오에서 인스턴스 간 간섭이 발생하지 않는다.

---

## `createAppRuntime(config)`

### 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `deepEqual` | `Function` | 두 값의 구조적 동등성 비교 |
| `deepClone` | `Function` | 값의 독립적 복사본 생성 |
| `createVNode` | `Function` | JSX → VNode 변환 |
| `createElement` | `Function` | `createVNode`의 alias. 기본값은 `createVNode` |
| `Fragment` | `Function` | Fragment 컴포넌트 |

### 반환값

```javascript
{
  createVNode,
  createElement,
  Fragment,
  init: (RootComponent, containerElement) => ...,
  render: () => ...,
  __runtime: internalRuntime,
}
```

| 필드 | 설명 |
|------|------|
| `init` | 루트 컴포넌트를 마운트하고 스케줄러를 시작하는 public API |
| `render` | 즉시 동기 렌더를 실행하는 public API |
| `__runtime` | Babel 플러그인과 테스트가 사용하는 internal API 묶음 |

---

## 내부 구조

`createAppRuntime`은 내부적으로 세 가지를 생성한다.

### 1. runtime state

`createRuntimeState()`가 반환하는 mutable 상태 객체다. 스케줄러, 렌더링, 컴포넌트 컨텍스트 관련 값이 여기에 저장된다.

### 2. internalRuntime

각 모듈의 순수 함수를 state에 바인딩한 메서드 집합이다. Babel 플러그인이 `AEUI.__runtime.watch()`, `AEUI.__runtime.runRenderPhase()` 같은 형태로 접근한다.

```javascript
const internalRuntime = {
  state,
  createNode: (...args) => createNode(state, ...args),
  reconcile: (...args) => reconcile(state, ...args),
  watch: (...args) => registerWatch(state, ...args),
  clean: (...args) => registerCleanup(state, ...args),
  // ... 나머지 바인딩
};
```

### 3. state 바인딩

`bindRuntimeState()`가 `internalRuntime`의 메서드를 state 객체에 연결한다. 이렇게 하면 각 모듈 함수가 `state.reconcile()`, `state.unmountNode()` 같은 형태로 다른 모듈의 기능을 호출할 수 있다.

```javascript
state.reconcile = (...args) => ir.reconcile(...args);
state.unmountNode = (...args) => ir.unmountNode(...args);
```

`bindRuntimeState`는 `internalRuntime`의 메서드를 참조하므로, 동일한 클로저가 두 번 생성되지 않는다.

---

## 의존성 흐름

```text
core.js
  └── createAppRuntime(config)
        ├── createRuntimeState()          → state
        ├── 각 모듈 함수를 state에 바인딩  → internalRuntime
        ├── bindRuntimeState(state, ir)    → state에 메서드 부착
        └── { init, render, __runtime }   → public surface
```

`core.js`는 `createAppRuntime`에 `deepEqual`, `deepClone`, `createVNode`, `Fragment`를 주입한다. 이 의존성 주입 덕분에 각 모듈은 비교/복사 로직의 구체적 구현을 알 필요가 없다.

---

## `__runtime`에 포함되는 메서드

| 메서드 | 원본 모듈 | 용도 |
|--------|-----------|------|
| `createNode` | `node-factory.js` | RuntimeNode shell 생성 |
| `reconcile` | `reconciler.js` | tree diff |
| `unmountNode` | `reconciler.js` | subtree 정리 |
| `watch` | `hook-registry.js` | watcher 등록 |
| `clean` | `hook-registry.js` | cleanup 등록 |
| `runRenderPhase` | `compiler-runtime.js` | Babel 변환된 render wrapper |
| `dispatchDomEvent` | `runtime.js` | DOM 이벤트 브리지 |
| `requestRender` | `runtime.js` | interactive render 요청 |
| `tick` | `runtime.js` | 렌더 사이클 1회 |
| `startScheduler` | `runtime.js` | RAF 루프 시작 |
| `stopScheduler` | `runtime.js` | RAF 루프 중지 |
| `createDomNode` | `dom-host.js` | DOM 요소 생성 |
| `updateDomProps` | `dom-host.js` | DOM 속성 패치 |
| `updateProps` | `dom-host.js` | 컴포넌트 props 객체 갱신 |

---

## 관련 코드 위치

- `packages/core/src/app-runtime.js`
- `packages/core/src/core.js`
- `packages/core/src/runtime-state.js`
