# 17. 소스 배치

이 문서는 AEUI 소스의 파일 경계, 각 파일의 심볼 목록, 모듈 간 의존 방향을 정의한다.

---

## 소스 트리

`packages/core/src`의 주요 파일:

```
src/
├── index.js              → 공개 export 조립
├── core.js               → 기본 AEUI 객체 생성
├── jsx-runtime.js        → automatic JSX의 VNode/Fragment 어댑터
├── jsx-dev-runtime.js    → 개발용 JSX 호출 어댑터
├── jsx-create-element.js → automatic JSX key/spread fallback
├── app-runtime.js        → 독립 앱 인스턴스 팩토리
├── runtime-state.js      → 앱별 mutable state
├── runtime-context.js    → 현재 컴포넌트/phase 스택
├── runtime.js            → init, tick, RAF 루프, 이벤트
├── node-factory.js       → RuntimeNode shell 생성
├── vnode-marker.js       → VNode 식별 Symbol
├── vnode-helpers.js      → key/Fragment 판별
├── component-lifecycle.js → setup, render, commit, cleanup
├── component-type.js     → 함수 값별 setup 등록과 태그 검증
├── component-watchers.js → watcher 실행
├── hook-registry.js      → setup 중 watch/clean 등록
├── hooks.js              → public watch/clean (compile guard)
├── compiler-runtime.js   → Babel 생성 코드 ↔ lifecycle bridge
├── reconciler.js         → 노드 비교, mount/update/unmount
├── dom-host.js           → DOM 생성, props diff, controlled sync
├── deep-compare.js       → _deepEqual, _deepClone
├── router.js             → route table, URL 매칭, SPA 네비게이션
├── babel-plugin.js       → AEUI Babel 변환 플러그인
├── swc-transform.js      → SWC parse/컴포넌트 변환/emit 진입점
├── swc-components.js     → SWC AST의 컴포넌트·props·hook 변환
├── swc-ast.js            → SWC binding 분석과 AST 구성
├── swc-fragments.js      → SWC 인접 JSX 파싱과 source map 연결
├── jsx-fragments.js      → 인접 JSX 파싱과 원본 위치 복원
└── vite-plugin.js        → Vite 빌드 플러그인
```

JSX 진입점의 배포 파일은 기존 `aeui.esm.js` 또는 `aeui.cjs`를 참조한다. AEUI 인스턴스와 컴포넌트 등록 저장소를 별도로 번들하지 않으며, 기존 standalone 런타임 파일은 독립 실행 가능한 형태를 유지한다.

---

## 모듈별 심볼 목록

### 공개 진입과 조립

| 파일 | export | 상세 |
|---|---|---|
| `index.js` | `core.js` + `hooks.js` re-export, `createElement` | |
| `core.js` | `AEUI` | |
| `jsx-runtime.js` | `jsx`, `jsxs`, `Fragment` | |
| `jsx-dev-runtime.js` | `jsxDEV`, `Fragment` | |
| `jsx-create-element.js` | `createElement` | |
| `app-runtime.js` | `createAppRuntime` | package root에서 re-export 안 함 |

### VNode과 값 연산

| 파일 | export | private |
|---|---|---|
| `vnode-marker.js` | `VNODE_MARKER` | — |
| `vnode-helpers.js` | `getVNodeKey`, `isFragmentVNode`, `getFragmentChildren` | `resolveFragmentComponent` |
| `deep-compare.js` | `_deepEqual`, `_deepClone` | `isVNode`, `createPairs`, `clonePairs`, `replacePairs`, `classify`, `compareSet` |

### RuntimeNode와 컴포넌트

| 파일 | export |
|---|---|
| `runtime-state.js` | `createRuntimeState`, `resetRuntimeState` |
| `runtime-context.js` | `getRuntimeContext`, `withComponentContext` |
| `node-factory.js` | `createRootNode`, `createNode` |
| `component-type.js` | `registerComponent`, `resolveComponentSetup`, `assertElementType` |
| `component-lifecycle.js` | `createComponentNode`, `setupComponentNode`, `runComponentRenderPhase`, `invokeComponentRenderFactory`, `renderComponentNode`, `commitRenderedNode`, `cleanupComponentNode` |
| `component-watchers.js` | `runComponentWatchers` |
| `hook-registry.js` | `registerWatch`, `registerCleanup` |
| `hooks.js` | `watch`, `clean` |
| `compiler-runtime.js` | `runComponentWatchersBridge`, `runRenderPhaseBridge` |

### DOM과 Reconciliation

| 파일 | export |
|---|---|
| `dom-host.js` | `cloneHostPropsSnapshot`, `syncHostControlledProps`, `createDomNode`, `updateProps`, `updateDomProps` |
| `reconciler.js` | `unmountNode`, `reconcile` |

### Scheduler와 Runtime

| 파일 | export |
|---|---|
| `runtime.js` | `reconcileRoot`, `init`, `render`, `requestRender`, `dispatchDomEvent`, `stopScheduler`, `startScheduler`, `onAnimationFrame`, `tick` |

runtime.js의 module constant: `MAX_FRAME_DELAY = 60`

### Router

| 파일 | export |
|---|---|
| `router.js` | `createRouteTable`, `matchRoute`, `shouldHandleAnchorClick`, `createDirectoryRouter` |

### 빌드 도구

| 파일 | export |
|---|---|
| `babel-plugin.js` | `default function aeuiTransform({ types: t })` |
| `jsx-fragments.js` | `parseWithAutomaticFragments` |
| `vite-plugin.js` | `default function aeui(options = {})` |

---

## 의존 관계 그래프

```
index
├─ core
│  ├─ component-type
│  ├─ app-runtime
│  │  ├─ component-type
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
├─ swc-transform ─ swc-components / swc-ast / swc-fragments
├─ @babel/core (Babel 선택 시)
├─ @babel/plugin-transform-react-jsx (Babel 선택 시)
├─ parse5 (HTML module script 판별, 외부 의존성)
└─ babel-plugin ─ jsx-fragments
```

**핵심 규칙:** source 모듈은 `app-runtime` singleton을 역으로 import하지 않는다.

`core.js`가 `app-runtime.js`의 팩토리를 조립하는 정방향 import는 허용한다. 공개 JSX 어댑터인 `jsx-runtime.js`와 `jsx-create-element.js`는 `core.js`의 AEUI에 위임한다. 하위 구현 모듈은 `app-runtime.js`, `core.js`, `index.js`를 역으로 import하지 않는다. `component-type.js`의 `componentSetups`와 `runtime-context.js`의 `runtimeContextStack`은 각 모듈의 private 상태다.

---

## 패키지 주변 파일

### packages/core

```
package.json
rollup.config.js          → runtime, JSX 진입점, Babel/SWC/Vite 변환기 빌드
tsconfig.types.json       → strict, ES2020, NodeNext
types/index.d.ts          → runtime 공개 타입
types/jsx-runtime.d.ts
types/jsx-dev-runtime.d.ts
types/babel-plugin.d.ts
types/vite.d.ts
types/swc.d.ts
type-tests/public-api.ts  → public API 타입 검증
type-tests/jsx-runtime.tsx → automatic JSX 타입 검증
```

### packages/create-aeui-app

```
package.json
index.js                  → top-level 실행
template/                 → 생성 프로젝트 파일
```

---

## 관련 문서

- 전체 아키텍처: [01. 아키텍처](01-architecture.md)
