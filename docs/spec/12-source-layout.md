# 12. 소스 모듈 배치와 심볼 목록

## 1. 목적

01~09는 동작 계약을 중심으로 설명한다. 이 문서는 AEUI source repository의 파일 경계에 적용되는 **모듈·심볼 manifest 스펙**을 정의한다. 알고리즘은 각 연결 문서가 규범이며, 여기서는 함수 이름, 공개 여부, 의존 방향과 파일 배치를 고정한다.

## 2. 코어 소스 트리

`packages/core/src`에는 다음 20개 파일을 둔다.

```text
src/
├── index.js
├── core.js
├── app-runtime.js
├── runtime-state.js
├── runtime-context.js
├── runtime.js
├── node-factory.js
├── vnode-marker.js
├── vnode-helpers.js
├── component-lifecycle.js
├── component-watchers.js
├── hook-registry.js
├── hooks.js
├── compiler-runtime.js
├── reconciler.js
├── dom-host.js
├── deep-compare.js
├── router.js
├── babel-plugin.js
└── vite-plugin.js
```

위 20개 파일과 각 파일의 책임 경계는 source layout 계약이다. 한 파일은 아래 절에서 배정한 책임과 의존 방향만 소유해야 한다.

## 3. 공개 진입과 조립 모듈

| 파일 | export | private 심볼 | 상세 명세 |
|---|---|---|---|
| `index.js` | `core.js`, `hooks.js`의 모든 named export | 없음 | 01 §1 |
| `core.js` | `AEUI` | `createVNode`, `Fragment` | 01 §3, 02 §2~4 |
| `app-runtime.js` | `createAppRuntime` | `bindRuntimeState` | 01 §4, 03 §2 |

`createAppRuntime`은 source module export이지만 package root에서 re-export하지 않는다. `core.js`만 이 팩토리로 기본 singleton `AEUI`를 만든다.

## 4. VNode와 값 연산 모듈

| 파일 | export | private 심볼 | 상세 명세 |
|---|---|---|---|
| `vnode-marker.js` | `VNODE_MARKER` | 없음 | 02 §2.1 |
| `vnode-helpers.js` | `getVNodeKey`, `isFragmentVNode`, `getFragmentChildren` | `resolveFragmentComponent` | 02 §5 |
| `deep-compare.js` | `_deepEqual`, `_deepClone` | `isVNode`, `canDeepMatchSetValue`, `primitiveSignature`, `getValueShape`, `getOwnDataPropertyShape`, `getSetMatchSignature`, `getCachedSetMatchSignature`, `mergeSeen`, cached `propertyIsEnumerable` | 02 §7~8 |

위 private 심볼은 `deep-compare.js` 안에서만 사용하며 다른 source module이나 package entry에서 export하지 않는다. signature helper는 Set 후보의 1:1 선택과 trial 비교를 지원해야 하며 동작 규범은 02 §7을 따른다.

## 5. RuntimeNode와 컴포넌트 모듈

| 파일 | export | private 심볼 | 상세 명세 |
|---|---|---|---|
| `runtime-state.js` | `createRuntimeState`, `resetRuntimeState` | 없음 | 05 §2 |
| `runtime-context.js` | `getRuntimeContext`, `withComponentContext` | `runtimeContextStack` | 03 §5 |
| `node-factory.js` | `createRootNode`, `createNode` | 없음 | 02 §6, 03 §3~4 |
| `component-lifecycle.js` | `createComponentNode`, `setupComponentNode`, `runComponentRenderPhase`, `invokeComponentRenderFactory`, `renderComponentNode`, `commitRenderedNode`, `cleanupComponentNode` | `syncPropsTarget` | 03 §6~9 |
| `component-watchers.js` | `runComponentWatchers` | 없음 | 05 §12 |
| `hook-registry.js` | `registerWatch`, `registerCleanup` | `getSetupComponentNode`, `readDeps` | 05 §11 |
| `hooks.js` | `watch`, `clean` | 없음 | 01 §6, 05 §10 |
| `compiler-runtime.js` | `runComponentWatchersBridge`, `runRenderPhaseBridge` | 없음 | 03 §7, 06 §11 |

`syncPropsTarget`과 `dom-host.js`의 `updateProps`는 별도 함수로 유지한다. 두 함수가 같은 delete-then-assign 형태여도 하나를 import해 공유하지 않는다. 전자는 null/object guard를 두고 후자는 target guard를 두지 않는다.

## 6. DOM과 reconciliation 모듈

### 6.1 `dom-host.js`

export:

```text
cloneHostPropsSnapshot
syncHostControlledProps
createDomNode
updateProps
updateDomProps
```

private:

```text
isInternalJsxMetadataProp
hasOwn
```

규범은 04 §10~13에 있다.

### 6.2 `reconciler.js`

export는 `unmountNode`, `reconcile` 두 개다. private helper의 책임 순서는 다음과 같다.

| private helper | 책임 |
|---|---|
| `updateRangeFromChildren` | fragment/root 범위 계산 |
| `getDomNodesInRange` | 직접 형제 DOM range 수집 |
| `placeNode` | range를 anchor 앞으로 이동 |
| `removeInsertedSiblings` | 실패한 fragment mount의 새 sibling 제거 |
| `warnDuplicateKey` | 고정 prefix 경고 |
| `isSameNodeType` | key와 kind별 identity 비교 |
| `reconcileChildren` | keyed/unkeyed sibling diff와 최종 배치 |
| `mountTextNode` | text DOM mount |
| `mountHostNode` | host/children/controlled mount와 실패 정리 |
| `mountFragmentNode` | DOM-less child group mount와 실패 정리 |
| `mountComponentNode` | component lifecycle 위임 |
| `mountNode` | kind별 mount dispatch |
| `updateTextNode` | text update |
| `updateHostNode` | props, children, controlled update |
| `updateFragmentNode` | fragment children/range update |
| `updateComponentNode` | component props/subtree update |
| `removeDomRange` | unmount 시 실제 DOM 제거 |

전체 순서와 실패 한계는 04 §2~9가 규정한다.

## 7. Scheduler와 root runtime 모듈

`runtime.js`의 module constant는 `MAX_FRAME_DELAY = 60`이다.

export:

```text
reconcileRoot
init
render
requestRender
dispatchDomEvent
stopScheduler
startScheduler
onAnimationFrame
tick
```

private:

```text
computeNextPollingDelay
collectCommittedDomNodes
removeUncommittedDom
```

세 private 함수는 각각 RAF backoff, 이전 root DOM snapshot, 실패 DOM 정리를 맡는다. 동작은 05 §3~9가 규정한다.

## 8. Router 모듈

`router.js`의 export는 다음 네 개다.

```text
createRouteTable
matchRoute
shouldHandleAnchorClick
createDirectoryRouter
```

private 심볼은 처리 단계 순서대로 다음과 같다.

```text
ROUTE_EXT_RE, DEFAULT_ROOT_DIR, ROUTE_ROOT_MARKERS
stripQuery, normalizeSlashes, trimTrailingSlash, normalizeRootDir
inferRootDir, toRouteRelativePath
parseQuery, parseSegment, segmentRank, compareRoutes, routePathFromSegments
createRoute, findSpecialModule
resolveHref, routeInfoFromUrl, safeDecodeSegment, matchSegments
DefaultNotFound, currentHref, findAnchor, pushRouterHistory
```

`createDirectoryRouter` 내부 closure `syncFromLocation`, `Root`, `attach`, 그리고 attach 내부 `onPopState`, `onClick`은 router 인스턴스마다 새로 만들어진다. 07이 route record, URL, History와 teardown의 정확한 의미를 규정한다.

## 9. Babel 컴파일러 모듈

`babel-plugin.js`는 default function `aeuiTransform({ types: t })` 하나를 export한다. 다음 helper는 plugin factory closure 안에 있어 각 plugin instance가 Babel `types` 객체를 캡처한다.

```text
isAeuiImportDeclaration
hasAeuiImportSpecifier
bindingIsAeuiImport
ensureAeuiImport
needsAeuiRuntimeBinding
isJSX
isFunctionLike
ensureBlockBody
createAeuiRuntimeMember
isAeuiHookCall
containsRenderableExpression
functionReturnsRenderableExpression
returnsRenderableValue
shouldTransformComponent
transformToFactory
injectReactiveProps
```

`needsAeuiRuntimeBinding` 안에는 `isAeuiRuntimeReference`가 있다. `injectReactiveProps` 안에는 다음 component-local transform helper가 있다.

```text
rewriteResolvedPropsReferences
prepareResolvedProps
createRenderParamBindings
isSupportedPropsParam
getPropsBindingPattern
createInitialPropsSource
```

visitor key는 `Program.exit`와 문자열 union `ArrowFunctionExpression|FunctionDeclaration|FunctionExpression` 두 종류다. 전체 AST 조건과 변환 순서는 06이 규정한다.

## 10. Vite 플러그인 모듈

`vite-plugin.js`는 default function `aeui(options = {})` 하나를 export한다.

private constant:

```text
VIRTUAL_ENTRY_ID
PUBLIC_ENTRY_PATH
RESOLVED_VIRTUAL_ENTRY_ID
ROUTE_EXT_RE
ROUTE_GLOB_EXTENSIONS
DEFAULT_ROUTER_DIR
DEFAULT_ALIAS
DEFAULT_ALIAS_DIR
```

private function:

```text
normalizePath
getHtmlAttribute
isManualMainSrc
hasAlias
createAliasConfig
hasManualModuleEntry
hasFile
hasRouteFile
createStyleImport
createRouterEntry
shouldTransform
createParserPlugins
```

반환 plugin object의 hook은 `config`, `configResolved`, object-form `transformIndexHtml`, `resolveId`, `load`, async `transform`이다. 08 §2~10이 각 hook의 반환 형태까지 규정한다.

## 11. 패키지 주변 파일

`packages/core`에서 source 외 스펙 대상은 다음과 같다.

```text
package.json
rollup.config.js
tsconfig.types.json
types/index.d.ts
types/babel-plugin.d.ts
types/vite.d.ts
type-tests/public-api.ts
```

Rollup config의 세 build object는 하나의 default-export 배열 안에 둔다. package exports, types, tarball 및 명령은 08 §11~15를 따른다.

`packages/create-aeui-app`은 다음 경계를 가진다.

```text
package.json
index.js
template/
```

CLI `index.js`의 named export는 없고 top-level에서 실행한다. private function은 `printUsage`, `isValidPackageName`, `copyDir`다. 템플릿 전체 트리와 byte-level로 중요한 JSON/HTML/JSX 내용은 09가 규정한다.

## 12. 주요 import 방향

```text
index
├─ core
│  ├─ app-runtime
│  │  ├─ compiler-runtime ─ component-watchers/component-lifecycle
│  │  ├─ dom-host
│  │  ├─ node-factory ─ component-lifecycle/vnode-helpers
│  │  ├─ reconciler ─ component-lifecycle/dom-host/vnode-helpers
│  │  ├─ runtime-state
│  │  ├─ router
│  │  ├─ runtime
│  │  └─ hook-registry
│  ├─ deep-compare ─ vnode-marker
│  └─ vnode-marker
└─ hooks ─ runtime-context/hook-registry

vite-plugin
├─ node:fs / node:path
├─ @babel/core
├─ @babel/plugin-transform-react-jsx
└─ babel-plugin
```

`component-lifecycle`은 `component-watchers`, `runtime-context`, `vnode-helpers`를 import한다. source 모듈은 `app-runtime`의 singleton을 역으로 import하지 않으므로 각 runtime state를 인자로 받아 격리된다.
