# 12. 소스 파일 배치

이 문서는 AEUI 소스의 **파일 경계**를 정의한다. 각 파일이 어떤 함수를 소유하고, 어디에 의존하는지를 고정한다. 알고리즘 동작은 각 연결 문서(01~09)가 규범이다.

---

## 1. 소스 트리

`packages/core/src`에 다음 **20개 파일**을 둔다:

```
src/
├── index.js              → 공개 export 조립
├── core.js               → 기본 AEUI 객체 생성
├── app-runtime.js        → 독립 앱 인스턴스 팩토리
├── runtime-state.js      → 앱별 mutable state
├── runtime-context.js    → 현재 컴포넌트/phase 스택
├── runtime.js            → init, tick, RAF 루프, 이벤트
├── node-factory.js       → RuntimeNode shell 생성
├── vnode-marker.js       → VNode 식별 Symbol
├── vnode-helpers.js      → key/Fragment 판별
├── component-lifecycle.js → setup, render, commit, cleanup
├── component-watchers.js → watcher 실행
├── hook-registry.js      → setup 중 watch/clean 등록
├── hooks.js              → public watch/clean (compile guard)
├── compiler-runtime.js   → Babel 생성 코드 ↔ lifecycle bridge
├── reconciler.js         → 노드 비교, mount/update/unmount
├── dom-host.js           → DOM 생성, props diff, controlled sync
├── deep-compare.js       → _deepEqual, _deepClone
├── router.js             → route table, URL 매칭, SPA 내비게이션
├── babel-plugin.js       → AEUI Babel 변환 플러그인
└── vite-plugin.js        → Vite 빌드 플러그인
```

---

## 2. 모듈별 심볼 목록

### 공개 진입과 조립

| 파일 | export | 상세 |
|---|---|---|
| `index.js` | `core.js` + `hooks.js`의 모든 named export | 01 §1 |
| `core.js` | `AEUI` | 01 §3 |
| `app-runtime.js` | `createAppRuntime` | 01 §4 |

`createAppRuntime`은 source export이지만 **package root에서 re-export하지 않는다.** `core.js`만 이 팩토리를 사용한다.

### VNode과 값 연산

| 파일 | export | private | 상세 |
|---|---|---|---|
| `vnode-marker.js` | `VNODE_MARKER` | — | 02 §2 |
| `vnode-helpers.js` | `getVNodeKey`, `isFragmentVNode`, `getFragmentChildren` | `resolveFragmentComponent` | 02 §5 |
| `deep-compare.js` | `_deepEqual`, `_deepClone` | `isVNode`, `canDeepMatchSetValue`, `primitiveSignature`, `getValueShape`, `getOwnDataPropertyShape`, `getSetMatchSignature`, `getCachedSetMatchSignature`, `mergeSeen`, `propertyIsEnumerable` (cached) | 02 §7~8 |

### RuntimeNode와 컴포넌트

| 파일 | export | private | 상세 |
|---|---|---|---|
| `runtime-state.js` | `createRuntimeState`, `resetRuntimeState` | — | 05 §10 |
| `runtime-context.js` | `getRuntimeContext`, `withComponentContext` | `runtimeContextStack` | 03 §4 |
| `node-factory.js` | `createRootNode`, `createNode` | — | 02 §6, 03 §3 |
| `component-lifecycle.js` | `createComponentNode`, `setupComponentNode`, `runComponentRenderPhase`, `invokeComponentRenderFactory`, `renderComponentNode`, `commitRenderedNode`, `cleanupComponentNode` | `syncPropsTarget` | 03 §5~7 |
| `component-watchers.js` | `runComponentWatchers` | — | 05 §8 |
| `hook-registry.js` | `registerWatch`, `registerCleanup` | `getSetupComponentNode`, `readDeps` | 05 §8 |
| `hooks.js` | `watch`, `clean` | — | 01 §6, 05 §8 |
| `compiler-runtime.js` | `runComponentWatchersBridge`, `runRenderPhaseBridge` | — | 03 §5, 06 §10 |

> **`syncPropsTarget`과 `dom-host.js`의 `updateProps`:** 두 함수가 같은 delete-then-assign 형태여도 하나를 import해 공유하지 않는다. 전자는 null/object guard를, 후자는 target guard를 두지 않는다.

### DOM과 reconciliation

**`dom-host.js`:**
- export: `cloneHostPropsSnapshot`, `syncHostControlledProps`, `createDomNode`, `updateProps`, `updateDomProps`
- private: `isInternalJsxMetadataProp`, `hasOwn`
- 규범: 04 §10~12

**`reconciler.js`:**
- export: `unmountNode`, `reconcile`
- private helpers (책임 순서):

| helper | 역할 |
|---|---|
| `updateRangeFromChildren` | fragment/root 범위 계산 |
| `getDomNodesInRange` | 직접 형제 DOM range 수집 |
| `placeNode` | range를 anchor 앞으로 이동 |
| `removeInsertedSiblings` | 실패한 fragment mount의 새 sibling 제거 |
| `warnDuplicateKey` | 고정 prefix 경고 |
| `isSameNodeType` | key + kind별 identity 비교 |
| `reconcileChildren` | keyed/unkeyed sibling diff + 최종 배치 |
| `mountTextNode` | text DOM mount |
| `mountHostNode` | host/children/controlled mount + 실패 정리 |
| `mountFragmentNode` | DOM-less child group mount + 실패 정리 |
| `mountComponentNode` | component lifecycle 위임 |
| `mountNode` | kind별 mount dispatch |
| `updateTextNode` | text update |
| `updateHostNode` | props, children, controlled update |
| `updateFragmentNode` | fragment children/range update |
| `updateComponentNode` | component props/subtree update |
| `removeDomRange` | unmount 시 실제 DOM 제거 |

### Scheduler와 root runtime

**`runtime.js`:**
- module constant: `MAX_FRAME_DELAY = 60`
- export: `reconcileRoot`, `init`, `render`, `requestRender`, `dispatchDomEvent`, `stopScheduler`, `startScheduler`, `onAnimationFrame`, `tick`
- private: `computeNextPollingDelay`, `collectCommittedDomNodes`, `removeUncommittedDom`

### Router

**`router.js`:**
- export: `createRouteTable`, `matchRoute`, `shouldHandleAnchorClick`, `createDirectoryRouter`
- private (처리 단계 순):

```
ROUTE_EXT_RE, DEFAULT_ROOT_DIR, ROUTE_ROOT_MARKERS
stripQuery, normalizeSlashes, trimTrailingSlash, normalizeRootDir
inferRootDir, toRouteRelativePath
parseQuery, parseSegment, segmentRank, compareRoutes, routePathFromSegments
createRoute, findSpecialModule
resolveHref, routeInfoFromUrl, safeDecodeSegment, matchSegments
DefaultNotFound, currentHref, findAnchor, pushRouterHistory
```

`createDirectoryRouter` 내부 closure: `syncFromLocation`, `Root`, `attach`, `onPopState`, `onClick` — 라우터 인스턴스마다 새로 만들어진다.

### Babel 컴파일러

**`babel-plugin.js`:**
- export: `default function aeuiTransform({ types: t })`
- plugin factory closure 안의 helper:

```
isAeuiImportDeclaration, hasAeuiImportSpecifier, bindingIsAeuiImport
ensureAeuiImport, needsAeuiRuntimeBinding (내부: isAeuiRuntimeReference)
isJSX, isFunctionLike, ensureBlockBody, createAeuiRuntimeMember
isAeuiHookCall, containsRenderableExpression, functionReturnsRenderableExpression
returnsRenderableValue, shouldTransformComponent, transformToFactory
injectReactiveProps (내부: rewriteResolvedPropsReferences, prepareResolvedProps,
  createRenderParamBindings, isSupportedPropsParam, getPropsBindingPattern,
  createInitialPropsSource)
```

visitor key: `Program.exit` + `ArrowFunctionExpression|FunctionDeclaration|FunctionExpression`

### Vite 플러그인

**`vite-plugin.js`:**
- export: `default function aeui(options = {})`
- private constants: `VIRTUAL_ENTRY_ID`, `PUBLIC_ENTRY_PATH`, `RESOLVED_VIRTUAL_ENTRY_ID`, `ROUTE_EXT_RE`, `ROUTE_GLOB_EXTENSIONS`, `DEFAULT_ROUTER_DIR`, `DEFAULT_ALIAS`, `DEFAULT_ALIAS_DIR`
- private functions: `normalizePath`, `getHtmlAttribute`, `isManualMainSrc`, `hasAlias`, `createAliasConfig`, `hasManualModuleEntry`, `hasFile`, `hasRouteFile`, `createStyleImport`, `createRouterEntry`, `shouldTransform`, `createParserPlugins`
- plugin hooks: `config`, `configResolved`, `transformIndexHtml` (object form), `resolveId`, `load`, `transform` (async)

---

## 3. 의존 관계

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

`component-lifecycle`은 `component-watchers`, `runtime-context`, `vnode-helpers`를 import한다.

---

## 4. 패키지 주변 파일

### `packages/core`

```
package.json
rollup.config.js          → 세 build object의 default-export 배열
tsconfig.types.json       → strict, ES2020, NodeNext
types/index.d.ts          → runtime 공개 타입
types/babel-plugin.d.ts   → Babel plugin 타입
types/vite.d.ts           → Vite plugin 타입
type-tests/public-api.ts  → public API 타입 검증
```

### `packages/create-aeui-app`

```
package.json
index.js                  → named export 없음, top-level 실행
template/                 → 생성될 프로젝트 파일
```

private function: `printUsage`, `isValidPackageName`, `copyDir`
