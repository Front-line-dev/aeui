# 01. 아키텍처

이 문서는 AEUI 프레임워크의 전체 구조와 핵심 설계를 설명한다.

---

## 전체 구조 개요

AEUI는 크게 세 계층으로 구성된다:

```
┌─────────────────────────────────────────┐
│              앱 코드 (사용자)            │
│   AEUI, watch, clean                    │
├─────────────────────────────────────────┤
│            컴파일 계층                   │
│   babel-plugin.js, vite-plugin.js       │
├─────────────────────────────────────────┤
│             런타임 계층                  │
│   core.js, app-runtime.js,             │
│   reconciler.js, component-lifecycle.js,│
│   runtime.js, hooks.js, router.js, ... │
└─────────────────────────────────────────┘
```

- **앱 코드**: `AEUI`, `watch`, `clean` 세 가지만 사용
- **컴파일 계층**: Babel 플러그인이 컴포넌트를 setup/render 구조로 변환
- **런타임 계층**: VDOM diffing, 스케줄러, 반응성 시스템 등 핵심 로직

---

## `createAppRuntime(config)` — 앱 인스턴스 팩토리

모든 AEUI 앱의 핵심은 `createAppRuntime()`이 만드는 **독립된 런타임 인스턴스**이다.

### 설계 목적

한 페이지에 여러 AEUI 앱을 띄울 때, 각 앱의 상태가 서로 영향을 주지 않아야 한다. `createAppRuntime()`은 호출할 때마다 완전히 격리된 `state` 객체를 만들어 이 문제를 해결한다.

### config 입력

```js
createAppRuntime({
  deepEqual,      // 값 비교 함수 (watcher deps 비교)
  deepClone,      // 값 복사 함수 (비교 기준값 생성)
  createVNode,    // VNode 생성 함수
  createElement,  // createVNode의 별칭 (생략 가능)
  Fragment,       // Fragment 컴포넌트
})
```

### state 객체

각 앱의 모든 실행 상태를 담는다:

```js
{
  // 비교 함수
  deepEqual, deepClone,
  
  // 앱 트리
  rootNode: null,
  containerElement: null,
  RootComponent: null,
  
  // 현재 실행 컨텍스트
  currentComponentNode: null,
  currentComponentPhase: null,   // 'setup' | 'render'
  
  // 스케줄러
  isRendering: false,
  rafId: null,
  frameDelay: 1,
  framesUntilNextTick: 0,
  didMutate: false,
  domEventDepth: 0,
  interactiveRenderRequested: false,
  
  // 라우터
  routerTeardown: null,
}
```

### 내부 함수 바인딩 (`__runtime`)

AEUI의 내부 함수들은 첫 번째 인자로 `state`를 받는 순수 함수이다. `createAppRuntime()`은 이 함수들을 **현재 앱의 state를 자동으로 전달하는 래퍼**로 감싸서 `__runtime` 객체에 모은다:

```js
// 실제 함수 시그니처
function reconcile(state, parentDom, oldNode, newVNode, ...) { ... }

// __runtime 래퍼
__runtime.reconcile = (...args) => reconcile(state, ...args);
```

이 패턴으로 각 모듈은 singleton에 의존하지 않고 state를 인자로 받아 **테스트와 격리가 용이**하다.

### 반환 객체

```js
{
  createVNode,
  createElement,
  Fragment,
  init: (...args) => init(state, ...args),
  render: (...args) => render(state, ...args),
  __runtime: { ... },  // Babel/내부 코드 전용
}
```

---

## 기본 `AEUI` 객체의 생성

`core.js`에서 기본 인스턴스를 만들어 export한다:

```js
export const AEUI = createAppRuntime({
  deepEqual: _deepEqual,
  deepClone: _deepClone,
  createVNode,
  createElement: createVNode,
  Fragment,
});
```

`import { AEUI } from 'aeui'`로 가져오는 모든 코드는 이 **하나의 인스턴스**를 공유한다.

---

## 공개 진입점

`src/index.js`는 단 두 줄로 구성:

```js
export * from './core.js';    // AEUI 객체
export * from './hooks.js';   // watch, clean
```

`createAppRuntime`, `createRouteTable` 등 내부 함수는 package root에서 re-export하지 않는다.

---

## `AEUI.init()` 실행 흐름

```
AEUI.init(App, container)
  1. stopScheduler()               ← 기존 예약 취소
  2. routerTeardown()              ← 기존 라우터 리스너 제거
  3. unmountNode(previousRootChild) ← 이전 앱 트리 정리
  4. state에 RootComponent, containerElement 저장
  5. createRootNode(containerElement)
  6. containerElement.innerHTML = '' ← DOM 초기화
  7. tick()                         ← 첫 화면 동기 렌더
  8. backoff 계산
  9. startScheduler()               ← 정기 확인 시작
```

**핵심:** `init()`은 반환하기 전에 첫 화면을 **동기적으로** 렌더한다.

---

## 라우터 앱의 초기화

```
aeui/vite 가상 진입 코드
  → AEUI.__runtime.initDirectoryRouter(routeModules, container, options)
     → createDirectoryRouter(state, routeModules, options)
        → route table 생성 + 현재 URL 매칭
     → init(state, Root, container)
        → 첫 화면 렌더링
     → attach(container)
        → click/popstate 리스너 등록
```

라우터도 일반 앱과 **같은 스케줄러와 렌더 함수**를 사용한다.

---

## 모듈 의존 그래프

```
index
├─ core
│  ├─ app-runtime
│  │  ├─ compiler-runtime ─ component-watchers / component-lifecycle
│  │  ├─ dom-host
│  │  ├─ node-factory ─ component-lifecycle / vnode-helpers
│  │  ├─ reconciler ─ component-lifecycle / dom-host / vnode-helpers
│  │  ├─ runtime-state
│  │  ├─ router
│  │  ├─ runtime
│  │  └─ hook-registry
│  ├─ deep-compare ─ vnode-marker
│  └─ vnode-marker
└─ hooks ─ runtime-context / hook-registry

vite-plugin
├─ node:fs / node:path
├─ @babel/core
├─ @babel/plugin-transform-react-jsx
└─ babel-plugin
```

**핵심 규칙:** source 모듈은 `app-runtime`의 singleton을 역으로 import하지 않는다. 각 모듈은 runtime state를 **인자**로 받아 격리된다.

---

## 관련 문서

- 상세 모듈 목록: [17. 소스 배치](17-source-layout.md)
- 설계 결정 배경: [설계 결정 문서](design-decisions.md)
