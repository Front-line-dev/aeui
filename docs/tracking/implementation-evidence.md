# 구현 및 검증 근거

이 문서는 현재 소스, 기존 테스트와 임시 검증에서 관찰한 참고 자료를 보관한다. 이 자료는 스펙이 아니다. 내용이 [`docs/spec`](../spec/README.md)과 충돌하면 스펙이 우선하며, 구현 변경 뒤에는 이 문서가 낡을 수 있다.

## 기존 suite 상태와 환경

- 분리 시점의 기존 suite는 파일 10개, 테스트 170개였다.
- runner는 Vitest, DOM 환경은 jsdom이다.
- JSX 변환 순서는 AEUI Babel plugin 다음 classic JSX transform이다.
- JSX pragma는 `AEUI.createElement`, Fragment pragma는 `AEUI.Fragment`다.
- package import 이름은 `aeui`이며 `example/test`는 core package를 local file dependency로 연결한다.
- 일부 테스트는 `packages/core/src`를 직접 import하고 통합 테스트는 build 결과를 import한다.
- `packages/create-aeui-app`에는 전용 automated test suite가 없다.

## 기존 테스트 목록

### `unit.test.js`

- 원시값, 배열, object, Date, Map, Set의 deep equality와 clone
- enumerable own string key 비교
- Set의 순서 독립 및 1:1 객체 후보 소비
- 순환 및 공유 참조 graph 종료·구분
- VNode identity-only 비교와 VNode-like 일반 object 구분
- VNode marker, 공개 필드, children 참조와 frozen props 비변이
- nullish child filtering, `createElement === createVNode`, Fragment children

### `vnode-helpers.test.js`

- `props.key` 추출과 null 정규화
- array/Fragment 판별과 Fragment children 반환

### `runtime-state.test.js`

- root/container/component/context/scheduler/event 초기 필드
- reset 후 render/scheduler flag
- injected deep helper와 runtime helper 보존
- router teardown 호출

### `runtime-context.test.js`

- context 밖 null
- 서로 다른 app runtime의 nested stack
- callback 종료와 throw 뒤 node/phase 복구

### `component-lifecycle.test.js`

- truthy render factory의 setup 1회
- next props가 watcher보다 먼저 node와 compiler target에 반영됨
- watcher-before-render
- rendered node/children/DOM range commit
- cleanup 오류 격리와 소유 필드 초기화

### `app-runtime.test.js`

- `createAppRuntime()`별 state 격리
- polling backoff 중 `requestRender()`의 다음 frame tick
- state helper가 자기 runtime method를 동적으로 호출함

### `dom.test.js`

- internal JSX metadata prop 제외
- class/style/boolean/general attribute와 value 설정·제거
- file input value 보호와 text-to-file 전환
- event proxy 유지, handler 교체·제거와 `this`
- select/input/textarea/checked controlled 복구
- mutable style snapshot
- keyed/unkeyed sibling diff, duplicate key와 range 이동
- recursive unmount, cleanup 격리와 DOM range 제거
- scheduler 예약·취소, polling `1 -> 2 -> 4`와 최대 60
- render error 뒤 context 복구와 미커밋 DOM 비누적
- watcher 오류 격리와 callback 뒤 dependency snapshot

### `component.test.jsx`

- mount와 setup 1회, event batching과 다음 RAF render
- props/local dependency watcher와 dependency 길이 변화
- render-phase hook guard
- object destructuring/default/rest props 최신화
- expression/conditional/logical/manual render factory
- root·conditional·key 교체 cleanup
- keyed component/host reorder와 instance 격리
- Fragment/component DOM range
- router page/layout/route prop, anchor delegation과 popstate

### `babel-plugin.test.js`

- `AEUI` import injection과 JSX가 없는 source의 미주입
- local `AEUI` 충돌 diagnostic
- anonymous default export 및 PascalCase 판별
- props destructuring, watch/clean runtime helper transform
- callback-first two-argument watch와 dependency getter wrapping
- render parameter wrapper

### `router.test.js`

- static/dynamic/catch-all/query/fallback matching
- encoded segment와 malformed percent fallback
- click interception과 modifier/external/download/new-tab 제외
- manual main과 virtual entry 주입
- script attribute와 `data-*` false positive
- alias, route eager glob과 JSX/TSX/TS pre-transform

## 확인된 coverage 공백

- runtime reset의 helper 보존, router teardown과 예약 RAF 취소 책임
- runtime context callback throw 뒤 stack/phase 복구
- props target 동기화 내용, watcher 순서, cleanup 오류와 render alias 초기화
- VNode children identity 및 key nullish/`0`/`false` 경계
- host snapshot metadata 제외와 value nullish 제거
- event proxy 하나 유지 및 multi-DOM range 이동
- component ArrayPattern의 입력 ABI와 성공 경로
- legacy watch argument 순서와 dynamic/catch-all insertion-order 충돌
- deep compare의 대칭성, cross-type, graph와 `__proto__` property tests
- compiler의 callback negative, UID, named getter, imported-name과 idempotence fixtures
- 생성 tarball을 설치한 실제 ESM/CJS 소비 smoke
- file input의 `syncHostControlledProps` 대소문자 무시 경로 테스트
- virtual entry public path(`/@aeui-entry`) 검사 경로 테스트

## 오류 및 경고 prefix 관찰값

- uncompiled watch: `[AEUI] watch(callback, deps) must be compiled by the AEUI Babel plugin.`
- non-function callback: `[AEUI] watch(callback, deps) requires callback to be a function.`
- missing deps: `[AEUI] watch(callback, deps) requires deps.`
- non-array deps: `[AEUI] watch(callback, deps) requires deps to be an array or a function that returns an array.`
- watcher error: `console.error('[AEUI] Watcher error:', error)`
- cleanup error: `console.error('[AEUI] Cleanup error:', error)`
- render error: `console.error('[AEUI] Render error:', error)`
- duplicate key: `console.warn('[AEUI] Duplicate key detected in sibling list: ...')`
- JSX runtime binding conflict: `[AEUI] Local AEUI bindings conflict with the JSX runtime import. Rename the local binding or import { AEUI } from "aeui".`

## Reference application 관찰값

- `example/test`는 현재 회귀 조사 suite이며 reference application 계약에 포함하지 않는다.
- Deep Compare Test의 진단 UI에는 trigger count 0과 1을 각각 PASS로 표시하는 역사적 문구가 있었다. 스펙의 기대값은 연결된 데이터·watch 계약에서 결정한다.
- Deep Compare Test의 세 interval과 DOM Prop Test timeout은 page lifetime 동안 cleanup하지 않는 fixture다. 이 현황은 integration contract가 아니다.
- visual text, shadow와 spacing은 프레임워크 적합성 조건이 아니다.
- commerce-admin의 localStorage는 key `"aeui-commerce-admin:v1"`을 `localStorage.getItem`/`setItem`에 전달하고, 값은 `{ version, savedAt, data }` JSON 객체다.

## 소스 파일 목록에서 확인한 내용

- `createAppRuntime`은 source에서 export되지만 public package root에서는 export하지 않는다.
- deep compare private helper의 특정 optimization이나 단방향 `seen` 구조는 보존 계약이 아니다.
- `syncPropsTarget`과 `updateProps`는 별도 helper로 존재한다.

## 장별 구현 대조 자료

### AEUI import와 앱 실행

대조에 사용한 source는 `packages/core/package.json`, `src/index.js`, `core.js`, `app-runtime.js`, `runtime-state.js`, `runtime.js`, `hooks.js`, `types/index.d.ts`다.

`state.*` wrapper는 호출 시점마다 `internalRuntime.*`를 조회한다. 기존 `app-runtime.test.js`, `component.test.jsx`, `dom.test.js`는 runtime state 격리, 초기 mount, scheduler와 실패 정리를 조사한다.

### 깊은 데이터 연산

결함 수정 전 deep-equal 구현은 다음 순서로 관찰됐다.

```text
Object.is -> primitive/null -> VNode -> 단방향 seen
-> 첫 번째 인자의 Array/Date/RegExp/Map/Set 분기
-> 일반 object enumerable own string key 비교
```

Set 구현은 `remainingB`, SameValueZero 직접 삭제, 후보 signature와 trial cycle map을 사용한다. 이 최적화와 단방향 `seen` 구조는 스펙이 아니며 [`AEUI-DATA-FIX-001`](known-defects.md)의 수정 과정에서 바뀔 수 있다.

일반 object clone은 `{}`와 `Object.entries`를 사용한다. VNode identity와 Map key identity를 유지하고 Array hole을 명시적 `undefined`로 만들며 Symbol/non-enumerable key를 제외한다. `__proto__` 일반 대입 문제는 [`AEUI-DATA-FIX-002`](known-defects.md)에서 추적한다.

### 컴포넌트 런타임

- `__runtime`은 compiler와 router가 runtime을 호출하고 기존 테스트가 내부 기능에 접근할 때 사용된다.
- `internalRuntime` method 교체가 state wrapper 호출에 반영되는 테스트 구조가 있다.
- 과거의 최상위 helper `_tick`, `_didMutate`는 package에서 import할 수 있는 값에 포함하지 않는다.

### DOM·scheduler 참고 파일

- DOM과 reconciliation: `dom.test.js`, `component.test.jsx`, `component-lifecycle.test.js`
- scheduler와 hook: `runtime-state.test.js`, `runtime-context.test.js`, `app-runtime.test.js`, `dom.test.js`, `component-lifecycle.test.js`, `component.test.jsx`, `babel-plugin.test.js`

이 테스트들은 attribute branch, event proxy, controlled property, mount 실패 정리, scheduler backoff, watcher/cleanup ordering과 오류 격리를 조사하는 참고 자료다.

### Reconciliation과 mount 실패 정리

host mount 실패 시 `mountHostNode`의 `try` 안에서 children reconcile이나 controlled sync가 throw하면, DOM 요소를 직접 제거하고 node를 정리한다. 단, `cloneHostPropsSnapshot`은 `try` 밖에서 실행되므로 이 단계에서 실패하면 직접 `reconcile` 경로에서는 DOM이 남을 수 있다. root 경로(`reconcileRoot`)에서는 `removeUncommittedDom`이 미커밋 DOM을 별도 정리한다.

fragment mount 실패 시 `mountFragmentNode`는 mount 전 sibling 위치를 기억해두고, 실패 시 그 이후에 새로 삽입된 DOM을 `removeInsertedSiblings`로 제거한다.

### Babel 컴파일러

- `ensureAeuiImport`는 분리 시점에 처음 찾은 `aeui` import declaration을 직접 수정했다. default·namespace import를 구분하지 않는 문제는 [`AEUI-COMPILER-IMPORT-FIX-001`](known-defects.md)에서 추적한다.
- component 판별은 익명 default export의 renderable 반환, JSX 또는 임의 call의 첫 argument 사용, 대문자 이름과 renderable 반환을 조합했다. 임의 callback을 component로 오인하는 문제는 [`AEUI-COMPILER-FIX-001`](known-defects.md)에서 추적한다.
- compiler가 생성하는 identifier(`_initialProps`, `_props`, `_resolveProps` 등)는 고정 이름을 사용하며 사용자 binding과 충돌할 수 있다. 스펙 06 §6.2는 scope-safe한 고유 이름을 생성해야 한다고 규정하며, 이 문제는 [`AEUI-COMPILER-FIX-002`](known-defects.md)에서 추적한다.
- `clean` 변환은 callee만 바꾸고 argument 수와 타입을 검사하지 않았다.
- `watch` 변환은 callback-first 두 argument 호출만 처리하고, 첫 argument가 배열이거나 argument가 1개 또는 3개 이상이면 그대로 두었다.
- hook 순회는 component path 아래의 call expression을 검사하며 call을 소유한 함수가 원 component인지 별도로 제한하지 않았다.
- `babel-plugin.test.js`는 import 주입·미주입, local `AEUI` 충돌, 익명 default export, 구조 분해 props 갱신, render parameter, hook helper와 일부 watch argument 경로를 조사했다. default·namespace import와 다섯 compiler 결함의 positive/negative matrix는 포함하지 않았다.

### 디렉터리 라우터

- 대조에 사용한 source는 `vite-plugin.js`, `router.js`, `app-runtime.js`, `runtime.js`, `runtime-state.js`다.
- `inferRootDir`은 module key를 확인하지만 다른 root를 추론하지 않았고, option이 없으면 `/src/pages`를 사용했다.
- 기존 router 테스트는 root/static/dynamic/catch-all/query/fallback matching, precedence, malformed decoding, delegated anchor, hidden entry와 manual main, alias, eager glob, JSX·TypeScript 변환을 조사했다.
- `create-aeui-app`은 root index, static about, dynamic product page를 제공했고 `commerce-admin`은 root layout, route 기반 shell state, dynamic ID watch와 custom root 404를 사용했다.

### Vite·빌드·패키지

- 분리 시점 `package.json`은 실제 package 이름 `a-easy-ui`, version `0.0.1`, ESM module type과 앱에서 쓰는 별칭 `aeui`를 사용했다.
- 기존 Vite 테스트는 manual main 보존, `data-*` 오인 방지, 기본·사용자 alias, 여섯 확장자 eager glob과 JSX·TS·TSX 변환을 조사했다. public virtual entry 중복과 detector/parser 확장자 불일치 경로는 포함하지 않았다.
- `type-tests/public-api.ts`는 세 package 진입점, component/VNode/renderable 타입과 alias option을 smoke test했다.
- dry-run package에는 whitelist된 dist artifact 12개(6 JS + 6 sourcemap), 전체 `src`, 선언 파일 3개와 `package.json`이 포함됐고 목록 밖 `dist/aeui.js`는 제외됐다.
- Rollup 세 빌드 모두 `sourcemap: true`를 설정하며, tarball의 `files` 목록은 12개 dist 파일(6 JS + 6 `.map`)을 포함한다.
- 루트 workspace의 `build:examples` script는 `vite-demo`, `deep-compare-test`, `commerce-admin` 세 예제를 순서대로 빌드한다.

### `create-aeui-app` CLI

- template은 root의 `gitignore`, `index.html`, `jsconfig.json`, `package.json`, `vite.config.js`와 `src/pages` 아래 route page 3개(`index.jsx`, `about.jsx`, `products/[id].jsx`)로 구성됐다.
- copy 함수는 depth와 무관하게 이름이 정확히 `gitignore`인 entry를 `.gitignore`로 바꿨지만, 분리 시점 template에서는 root 파일 하나만 이 규칙에 해당했다.
- CLI는 프로젝트 이름을 필수로 요구하며, 이름 생략 시 도움말을 출력하고 `process.exit(1)`. 기본 이름 `aeui-app`은 없다.
- 이미 존재하는 디렉토리에 대해 오류를 출력하고 `process.exit(1)`. 기존 내용 유지나 덮어쓰기를 하지 않는다.
- CLI는 `npm install`을 자동으로 실행하지 않는다. `--no-install` 옵션도 없다. 사용법 안내에 `npm install` 명령을 출력할 뿐이다.
- template `package.json`의 의존성은 `aeui: "npm:a-easy-ui@^0.0.1"`과 `vite: "^8.0.0"`, `engines`에 Node `^20.19.0 || >=22.12.0`을 포함한다.
- CLI dry-run package는 `index.js`, `package.json`, template root 파일 5개와 page 파일 3개(하위 디렉토리 포함)로 총 10개 entry를 포함했다.
- `packages/create-aeui-app`에는 전용 test file과 package test script가 없었고, root에도 CLI 전용 suite를 실행하는 script가 없었다.
