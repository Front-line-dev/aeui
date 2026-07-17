# 12. 소스 모듈 배치와 심볼 목록

## 1. 목적

01~09는 동작 계약을 중심으로 설명한다. 이 문서는 같은 구현을 현재 저장소와 동일한 파일 경계로 다시 나눌 때 필요한 **모듈·심볼 manifest**다. 알고리즘은 각 연결 문서가 규범이며, 여기서는 함수 이름, 공개 여부, 의존 방향과 파일 배치를 고정한다.

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

파일을 합쳐도 런타임 결과만 같으면 되는 일반 라이브러리 설명과 달리, 이 프로젝트의 문서 우선 개발에서는 이 경계도 유지보수 계약이다. 새 책임을 추가할 때 기존 파일에 무관한 코드를 누적하지 말고 manifest를 먼저 바꾼다.

## 3. 공개 진입과 조립 모듈

| 파일 | export | private 심볼 | 상세 명세 |
|---|---|---|---|
| `index.js` | `core.js`, `hooks.js`의 모든 named export | 없음 | 01 §1 |
| `core.js` | `AEUI` | `createVNode`, `Fragment` | 01 §3, 02 §2~4 |
| `app-runtime.js` | `createAppRuntime` | `bindRuntimeState` | 01 §4, 03 §2 |

`createAppRuntime`은 package root에서 re-export하지 않는다. `core.js`만 이 팩토리로 기본 singleton `AEUI`를 만들며, source-level test는 팩토리를 직접 import할 수 있다.

## 4. VNode와 값 연산 모듈

| 파일 | export | private 심볼 | 상세 명세 |
|---|---|---|---|
| `vnode-marker.js` | `VNODE_MARKER` | 없음 | 02 §2.1 |
| `vnode-helpers.js` | `getVNodeKey`, `isFragmentVNode`, `getFragmentChildren` | `resolveFragmentComponent` | 02 §5 |
| `deep-compare.js` | `_deepEqual`, `_deepClone` | `isVNode`, `canDeepMatchSetValue`, `primitiveSignature`, `getValueShape`, `getOwnDataPropertyShape`, `getSetMatchSignature`, `getCachedSetMatchSignature`, `mergeSeen`, cached `propertyIsEnumerable` | 02 §7~8 |

위 private 심볼은 현재 구현 inventory다. deep compare의 signature helper는 Set 1:1 후보 선택 최적화에 관여하지만, `AEUI-DATA-FIX-001`을 구현할 때 단방향 `seen` 구조나 `mergeSeen` 모양까지 보존해서는 안 된다. 목표 구현은 02 §7.4의 현재 후보 격리 방식을 참고하되 §7.5의 양방향 대응과 독립 trial 상태를 만족하도록 helper와 manifest를 함께 갱신한다.

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

`syncPropsTarget`과 `dom-host.js`의 `updateProps`는 현재 별도 함수다. 두 함수가 같은 delete-then-assign 형태여도 하나를 import해 공유하지 않는다. 전자는 null/object guard를 두지만 후자는 target guard가 없다는 차이를 보존한다.

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

`packages/core`에서 source 외 재현 대상은 다음과 같다.

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

## 13. 재구현 순서

동일 저장소를 빈 디렉터리에서 만들 때 다음 순서를 권장한다.

1. marker, VNode helper, deep compare와 `core.js` VNode 팩토리
2. runtime state/context, node factory와 component lifecycle
3. DOM host와 reconciler
4. scheduler, hook registry/watcher와 app-runtime 조립
5. Babel plugin과 compiler runtime ABI
6. router와 Vite plugin
7. public types, Rollup와 package export map
8. create CLI/template
9. `docs/spec` 계약에서 처음부터 작성한 새 적합성 suite와 reference apps

각 단계에서 다음 단계의 임시 stub을 공개 API로 남기지 않는다. 최종 package root export는 01과 08의 세 값으로 돌아와야 한다.

## 14. manifest 변경 규칙

- source 파일을 추가·삭제·이름 변경하면 이 문서를 먼저 갱신한다.
- export를 바꾸면 01의 public/private 경계와 08의 package/type 계약을 함께 검토한다.
- private helper를 합치거나 나눌 때도 관련 알고리즘 단계가 사라지지 않았는지 문서 계약을 먼저 검토한다. 새 적합성 suite가 준비된 뒤에는 그 계약을 직접 가리키는 테스트로 확인한다. 기존 legacy suite 통과만으로는 알고리즘 계약 보존을 증명하지 않는다.
- 새 build artifact는 08의 Rollup output, package `files`, dry-run tarball 목록을 함께 바꾼다.
