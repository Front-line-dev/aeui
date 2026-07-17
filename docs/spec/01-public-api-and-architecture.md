# 01. 공개 API와 런타임 조립 명세

이 문서는 현재 `packages/core` 구현을 다시 작성할 수 있도록 패키지 진입점, 공개 `AEUI` 객체, 앱 런타임 팩토리, 내부 런타임 경계와 앱 마운트 계약을 명세한다. 설명의 기준은 다음 소스다.

- `packages/core/package.json`
- `packages/core/src/index.js`
- `packages/core/src/core.js`
- `packages/core/src/app-runtime.js`
- `packages/core/src/runtime-state.js`
- `packages/core/src/runtime.js`
- `packages/core/src/hooks.js`
- `packages/core/types/index.d.ts`

디렉터리 라우터는 AEUI core 제품 계약이며 별도 공개 router package로 분리하지 않는다. 파일 규칙과 History 동작은 `docs/spec/07-directory-router.md`에서 이어서 명세한다.

## 1. 패키지 진입점

`packages/core/package.json`은 세 개의 export 경로를 제공한다.

| export 경로 | ESM | CommonJS | 타입 | 역할 |
| --- | --- | --- | --- | --- |
| `.` | `dist/aeui.esm.js` | `dist/aeui.cjs` | `types/index.d.ts` | 프레임워크 런타임과 훅 |
| `./babel-plugin` | `dist/babel-plugin.js` | `dist/babel-plugin.cjs` | `types/babel-plugin.d.ts` | AEUI 컴파일러 플러그인 |
| `./vite` | `dist/vite-plugin.js` | `dist/vite-plugin.cjs` | `types/vite.d.ts` | Vite 통합과 자동 부트스트랩 |

루트 번들의 Rollup 입력은 `src/index.js`다. 이 파일은 오직 다음 두 모듈의 named export를 다시 내보낸다.

```javascript
export * from './core.js';
export * from './hooks.js';
```

따라서 루트 패키지의 명시적 공개 값은 다음 세 개다.

| 이름 | 종류 | 계약 |
| --- | --- | --- |
| `AEUI` | 객체 | 기본 런타임 인스턴스. VNode 생성, 앱 마운트, 수동 렌더를 제공한다. |
| `watch` | 함수 | 소스 호환용 compile guard. 정상 앱 코드는 Babel 플러그인이 이 호출을 `AEUI.__runtime.watch`로 바꿔야 한다. |
| `clean` | 함수 | 현재 setup 중인 컴포넌트에 unmount cleanup을 등록한다. |

`createAppRuntime`, `createRouteTable`, `matchRoute`, `createDirectoryRouter`는 소스 모듈에서는 export되지만 `src/index.js`나 package export map을 통해 공개하지 않는다. `Router`, `Link`, `navigate`도 공개 API에 존재하지 않는다.

## 2. 공개 타입 표면

`types/index.d.ts`가 정의하는 핵심 타입은 다음과 같다.

```typescript
type PrimitiveRenderable = string | number | bigint;

type Renderable =
  | VNode
  | PrimitiveRenderable
  | boolean
  | null
  | undefined
  | Renderable[];

type RenderFunction<P = Record<string, unknown>> =
  (props?: P) => Renderable;

type Component<P = Record<string, unknown>> =
  (props: P) => Renderable | RenderFunction<P>;
```

`AeuiApp`의 공개 모양은 다음과 같다.

```typescript
interface AeuiApp {
  createVNode(tag, props?, ...children): VNode;
  createElement(tag, props?, ...children): VNode;
  Fragment: FragmentComponent;
  init(rootComponent: Component<any>, containerElement: Element): void;
  render(): boolean;
  __runtime: AeuiRuntimeInternals;
}
```

`__runtime` 속성은 객체에 실제로 존재하지만 compiler와 프레임워크 통합을 위한 internal namespace다. 타입은 `watch`, `clean`, `runRenderPhase`만 구체적으로 선언하고 나머지는 `[key: string]: unknown`으로 감춘다. 앱 코드용 안정적 public API로 간주하지 않는다.

## 3. `core.js`: 기본 런타임 구성

### 3.1 `createVNode(tag, props, ...children)`

기본 런타임에 주입되는 VNode 팩토리는 다음 순서로 동작해야 한다.

1. rest parameter로 받은 `children`을 `Array.prototype.flat()` 기본 깊이인 1단계만 펼친다.
2. 값이 `null` 또는 `undefined`인 자식과 타입이 `boolean`인 모든 자식을 버린다.
3. 원래 `props`를 직접 수정하지 않고 얕게 복사한다.
4. 복사한 props의 `children`을 2단계에서 만든 배열로 덮어쓴다.
5. `{ tag, props: finalProps, children: validChildren }` 객체를 만든다.
6. `VNODE_MARKER` symbol 속성을 값 `true`, `enumerable: false`로 정의한다. 별도 옵션을 주지 않으므로 이 속성은 writable/configurable도 false다.

동등한 구현은 다음과 같다.

```javascript
function createVNode(tag, props, ...children) {
  const validChildren = children
    .flat()
    .filter((child) => child != null && typeof child !== 'boolean');
  const finalProps = { ...(props || {}), children: validChildren };
  const vnode = { tag, props: finalProps, children: validChildren };

  Object.defineProperty(vnode, VNODE_MARKER, {
    value: true,
    enumerable: false,
  });

  return vnode;
}
```

중요한 불변식은 `vnode.props.children === vnode.children`이라는 참조 동일성과, 호출자가 넘긴 props 객체가 변하지 않는다는 점이다. 문자열, 숫자, bigint, 객체와 중첩 깊이가 2 이상인 배열은 이 함수 자체에서 추가 정규화하지 않는다.

### 3.2 `Fragment`

기본 Fragment는 첫 번째 setup 인자를 사용하지 않고 render 함수를 반환한다.

```javascript
function Fragment(initialProps) {
  return (props) => props.children;
}
```

이 함수 자체를 직접 호출하면 반환 render가 호출 시점의 `props.children`을 돌려준다. 그러나 정상 Fragment VNode은 node factory가 일반 component보다 먼저 fragment kind로 분류하므로 이 함수의 setup/render를 실행하지 않는다. reconciler는 매 render에 생성된 Fragment VNode의 `children` 배열을 직접 사용하고 별도 DOM wrapper를 만들지 않는다.

### 3.3 기본 `AEUI` 인스턴스

`core.js`는 다음 의존성을 주입해 런타임 하나를 만들고, 그 결과를 named export `AEUI`로 고정한다.

```javascript
export const AEUI = createAppRuntime({
  deepEqual: _deepEqual,
  deepClone: _deepClone,
  createVNode,
  createElement: createVNode,
  Fragment,
});
```

즉 `AEUI.createElement`와 `AEUI.createVNode`는 같은 함수 참조다. 이 `AEUI`는 루트 패키지에서 공유하는 기본 singleton이지만, `createAppRuntime()` 자체는 호출마다 격리된 state를 만들 수 있는 팩토리다.

## 4. `createAppRuntime(config)`

### 4.1 입력 계약

팩토리는 객체 구조분해로 다음 값을 받는다.

| 필드 | 필수 여부 | 사용처 |
| --- | --- | --- |
| `deepEqual` | 필수 | watcher와 dirty comparison에 저장 |
| `deepClone` | 필수 | dependency snapshot 등에 저장 |
| `createVNode` | 필수 | 루트, 컴포넌트, 라우터 VNode 생성 |
| `createElement` | 선택 | 생략하면 `createVNode`를 사용 |
| `Fragment` | 필수 | Fragment 식별과 공개 API |

팩토리 자체는 런타임 타입 검증을 하지 않는다. config가 `undefined`이면 매개변수 구조분해에서 즉시 실패하고, 필수 함수가 잘못되었으면 실제 사용 시 JavaScript 오류가 발생한다.

### 4.2 state 생성

첫 단계는 `createRuntimeState({ deepEqual, deepClone })` 호출이다. 새 호출마다 아래 모양의 새 mutable 객체를 만들어야 한다.

```javascript
{
  deepEqual,
  deepClone,
  rootNode: null,
  containerElement: null,
  RootComponent: null,
  currentComponentNode: null,
  currentComponentPhase: null,
  isRendering: false,
  rafId: null,
  frameDelay: 1,
  framesUntilNextTick: 0,
  didMutate: false,
  domEventDepth: 0,
  interactiveRenderRequested: false,
  routerTeardown: null,
}
```

state는 모듈 전역 변수가 아니다. 런타임 인스턴스 A의 `frameDelay`, root, watcher context, router teardown을 바꾸어도 인스턴스 B의 state에는 영향을 주지 않아야 한다.

### 4.3 `internalRuntime` 조립

팩토리는 엔진 모듈의 state-first 함수를 현재 state에 바인딩해 `internalRuntime`을 만든다. 구현 시 아래 필드와 연결 방향을 유지한다.

| 필드 | 연결 대상과 동작 |
| --- | --- |
| `state` | 위에서 생성한 mutable state 자체 |
| `deepEqual`, `deepClone` | config에서 받은 함수 참조 |
| `createRootNode` | `node-factory.js` 함수 참조 |
| `createNode(...args)` | `createNode(state, ...args)` |
| `requestRender(...args)` | `requestRender(state, ...args)` |
| `tick(...args)` | `tick(state, ...args)` |
| `reconcileRoot(...args)` | `reconcileRoot(state, ...args)` |
| `stopScheduler(...args)` | `stopScheduler(state, ...args)` |
| `startScheduler(...args)` | `startScheduler(state, ...args)` |
| `onAnimationFrame(...args)` | `onAnimationFrame(state, ...args)` |
| `runComponentWatchers(...args)` | `runComponentWatchersBridge(state, ...args)` |
| `runRenderPhase(...args)` | `runRenderPhaseBridge(state, ...args)` |
| `initDirectoryRouter(routeModules, container, options)` | 디렉터리 라우터를 만든 뒤 공통 `init`과 listener attach 실행 |
| `createDomNode(...args)` | `createDomNode(state, ...args)` |
| `watch(...args)` | `registerWatch(state, ...args)` |
| `clean(...args)` | `registerCleanup(state, ...args)` |
| `updateProps` | `dom-host.js` 함수 참조를 그대로 노출 |
| `updateDomProps(...args)` | `updateDomProps(state, ...args)` |
| `unmountNode(...args)` | `unmountNode(state, ...args)` |
| `reconcile(...args)` | `reconcile(state, ...args)` |
| `dispatchDomEvent(...args)` | `dispatchDomEvent(state, ...args)` |

`initDirectoryRouter`의 정확한 순서는 다음과 같다.

```javascript
const { Root, attach } = createDirectoryRouter(
  state,
  routeModules,
  options
);
init(state, Root, containerElement);
attach(containerElement);
```

초기 URL 매칭과 라우터 객체 생성은 공통 `init`보다 먼저 일어나고, click/popstate listener 부착은 초기 동기 렌더와 scheduler 시작보다 나중에 일어난다. 이 bridge는 `{ Root, attach, router }`나 다른 값을 호출자에게 반환하지 않으므로 반환값은 `undefined`다.

### 4.4 state에 엔진 함수 연결

`bindRuntimeState(state, internalRuntime, shared)`는 엔진 내부 함수들이 다시 `state.*`를 통해 서로 호출할 수 있게 다음 필드를 붙인다.

```text
state.Fragment       <- shared.Fragment
state.createVNode    <- shared.createVNode
state.createElement  <- shared.createElement
state.createRootNode <- createRootNode
state.updateProps    <- updateProps

state.createNode         -> internalRuntime.createNode
state.reconcile          -> internalRuntime.reconcile
state.unmountNode        -> internalRuntime.unmountNode
state.dispatchDomEvent   -> internalRuntime.dispatchDomEvent
state.requestRender      -> internalRuntime.requestRender
state.runRenderPhase     -> internalRuntime.runRenderPhase
state.stopScheduler      -> internalRuntime.stopScheduler
state.startScheduler     -> internalRuntime.startScheduler
state.onAnimationFrame   -> internalRuntime.onAnimationFrame
state.tick               -> internalRuntime.tick
```

뒤쪽 함수들은 `internalRuntime`의 속성을 호출할 때마다 다시 조회하는 wrapper다. 따라서 테스트가 `internalRuntime.tick` 같은 메서드를 spy나 대체 함수로 바꾸면 `state.tick()` 경로도 그 변경을 보게 된다.

### 4.5 반환 객체

팩토리는 다음 객체를 반환한다.

```javascript
{
  createVNode,
  createElement,
  Fragment,
  init: (...args) => init(state, ...args),
  render: (...args) => render(state, ...args),
  __runtime: internalRuntime,
}
```

`init`과 `render`만 public scheduler 진입점이다. 나머지 엔진 함수는 top level에 복제하지 않는다.

## 5. 앱 마운트 계약

### 5.1 `AEUI.init(RootComponent, containerElement)`

정상 호출은 DOM `Element`인 container와 함수형 RootComponent를 받는다. 구현은 별도 입력 검증 없이 다음 순서를 동기 실행한다.

1. 현재 scheduler의 예약을 취소하고 `state.rafId = null`로 만든다.
2. `state.routerTeardown`이 함수이면 호출해 기존 라우터의 listener를 제거한다.
3. 기존 root wrapper에 첫 번째 자식이 있으면 `unmountNode`로 전체 이전 앱을 정리한다. 이 과정에서 컴포넌트 cleanup도 실행된다.
4. `RootComponent`와 `containerElement`를 state에 저장한다.
5. `createRootNode(containerElement)`로 새 root wrapper를 만든다.
6. `containerElement.innerHTML = ''`로 기존 DOM을 전부 제거한다. hydration은 하지 않는다.
7. `interactiveRenderRequested = false`로 초기화한다.
8. `tick()`을 즉시 한 번 호출해 첫 화면을 동기 렌더한다.
9. 첫 tick의 `didMutate` 결과로 polling 간격을 계산한다. 변경이 있으면 1프레임, 없으면 현재 `frameDelay`를 두 배로 늘리되 최대 60프레임이다.
10. RAF가 있으면 `requestAnimationFrame`, 없으면 16ms `setTimeout`으로 scheduler를 시작한다.

`init` 자체는 값을 반환하지 않는다. 같은 런타임에서 다시 호출하면 이전 scheduler, router listener와 컴포넌트 트리를 정리한 뒤 새 앱을 마운트하고 새로운 scheduler 예약을 만든다.

container가 `null`이거나 `innerHTML`을 지원하지 않으면 6단계에서 오류가 그대로 전파된다. RootComponent가 함수인지도 선검증하지 않는다.

### 5.2 루트 렌더 경로

`tick()`은 다음 조건이면 아무 작업 없이 `false`를 반환한다.

- RootComponent, container, root wrapper 중 하나가 없음
- 이미 `state.isRendering === true`임

그 외에는 `isRendering`을 true로 두고 `reconcileRoot()`를 실행한다. `reconcileRoot()`는 다음 VNode를 항상 `state.createVNode(state.RootComponent)`로 생성하므로 public `init`에는 root props를 전달하는 인자가 없다.

reconciliation 성공 시 root wrapper는 새 child를 0개 또는 1개만 소유하고 그 child의 `firstDom`/`lastDom` 범위를 복사한다. 실패 시 렌더 전에 존재하던 committed DOM 집합을 기준으로 새로 삽입되었으나 커밋되지 않은 DOM을 제거한 뒤 오류를 다시 던진다.

### 5.3 렌더 오류

`tick()`은 setup/render/reconciliation 오류를 호출자에게 다시 던지지 않는다.

```javascript
try {
  reconcileRoot(state);
} catch (error) {
  console.error('[AEUI] Render error:', error);
} finally {
  state.isRendering = false;
}
```

따라서 초기 `AEUI.init()` 중 컴포넌트 setup이 실패해도, container 조작 자체가 성공했다면 `init`은 계속 polling 간격을 계산하고 scheduler를 시작한다. 이후 tick에서도 다시 시도할 수 있다. 반대로 다음 오류는 이 catch 바깥이므로 그대로 전파될 수 있다.

- 잘못된 container의 `innerHTML` 접근
- 기존 router teardown이나 이전 트리 unmount 자체의 예외
- 디렉터리 라우터의 route table/URL 생성 중 예외
- listener 부착 중 DOM API 예외

cleanup callback의 예외는 unmount 구현이 각각 `[AEUI] Cleanup error:`로 기록하고 다음 cleanup을 계속 처리한다.

### 5.4 `AEUI.render()`

`render()`는 현재 앱을 즉시 동기 tick하는 수동 API다.

1. RootComponent 또는 container가 없으면 `false`를 반환한다.
2. 대기 중인 interactive 요청을 false로 지운다.
3. `tick()`을 즉시 호출한다.
4. 결과에 따라 polling 간격을 갱신한다.
5. scheduler가 멈춰 있으면 다시 예약한다.
6. 이번 tick에서 실제 DOM write가 있었는지를 boolean으로 반환한다.

컴포넌트 오류는 `tick()`의 정책에 따라 로그로 처리되므로 보통 `render()`에서 throw되지 않고 `didMutate` 값을 반환한다.

### 5.5 `requestRender()`와 public `render()`의 차이

`requestRender()`는 internal API다. 유효한 마운트가 없으면 `false`를 반환한다. 마운트가 있으면 `interactiveRenderRequested = true`로 표시하고 scheduler만 보장한 뒤 `true`를 반환한다. 즉시 tick하지 않는다.

DOM 이벤트 bridge, 라우터 click, `popstate`는 이 함수를 사용해 polling backoff와 무관하게 다음 animation frame 렌더를 요청한다. 여러 요청은 하나의 boolean flag와 하나의 RAF 예약으로 합쳐진다.

## 6. 공개 훅과 compiler 경계

### 6.1 `watch`

`hooks.js`의 공개 `watch()`는 항상 다음 오류를 던진다.

```text
[AEUI] watch(callback, deps) must be compiled by the AEUI Babel plugin.
```

정상 컴파일에서는 Babel 플러그인이 `watch(callback, deps)`를 `AEUI.__runtime.watch(callback, depsGetter)`로 바꾼다. internal 등록기는 setup phase의 현재 component node가 있을 때만 watcher를 추가한다. callback이 함수가 아니거나 deps가 없거나, deps/그 반환값이 배열이 아니면 TypeError를 던진다.

### 6.2 `clean`

공개 `clean(callback)`은 runtime context stack의 최상단 state를 읽어 `registerCleanup`으로 전달한다. 현재 setup 중인 component가 없으면 조용히 아무 작업도 하지 않는다. 컴파일된 코드는 `AEUI.__runtime.clean`을 직접 사용할 수도 있으며 같은 등록기를 공유한다.

runtime context는 중첩 component setup/render마다 stack에 push하고 `finally`에서 pop한다. 따라서 여러 `createAppRuntime()` 인스턴스가 있어도 현재 실행 중인 인스턴스에 cleanup이 등록된다.

## 7. 모듈 의존 및 호출 흐름

### 7.1 일반 앱

```text
package root import
  -> src/index.js
     -> core.js가 기본 AEUI 생성
        -> createAppRuntime(config)
           -> createRuntimeState()
           -> internalRuntime 조립
           -> state에 engine wrapper 바인딩

AEUI.init(App, container)
  -> runtime.js:init(state, App, container)
     -> 이전 scheduler/router/tree 정리
     -> createRootNode(container)
     -> tick(state)
        -> reconcileRoot(state)
           -> createVNode(App)
           -> reconciler.js
     -> startScheduler(state)
```

### 7.2 디렉터리 라우터 앱

```text
aeui/vite virtual entry
  -> AEUI.__runtime.initDirectoryRouter(routeModules, container, options)
     -> createDirectoryRouter(state, routeModules, options)
        -> { Root, attach, router }
     -> runtime.js:init(state, Root, container)
     -> attach(container)
        -> container click listener
        -> window popstate listener
```

라우터도 별도 renderer를 만들지 않고 동일한 root reconciliation과 scheduler를 사용한다.

## 8. 재구현 불변식

다음 항목이 달라지면 현재 구현과 호환되지 않는다.

- package root는 `AEUI`, `watch`, `clean`을 named export하고 router helper를 공개 export하지 않는다.
- `createVNode`는 props를 복사하며 caller props를 수정하지 않는다.
- 각 `createAppRuntime()` 호출은 독립 state를 가진다.
- engine 함수는 전역 singleton이 아니라 해당 state를 첫 인자로 받아 실행된다.
- `state.*` wrapper는 대응하는 `internalRuntime.*` 속성을 동적으로 경유한다.
- `init()`은 기존 router listener를 root unmount보다 먼저 제거한다.
- `init()`은 container를 비우고 초기 tick을 동기 실행한 뒤 scheduler를 시작한다.
- component 렌더 오류는 `[AEUI] Render error:`로 기록되며 scheduler 생명주기를 중단시키지 않는다.
- public `render()`는 동기 실행, internal `requestRender()`는 다음 프레임 예약이다.
- 디렉터리 라우터 bridge는 공통 `init()` 후 listener를 붙이며 값을 반환하지 않는다.

## 9. 기존 테스트의 참고 매핑

아래 파일은 현재 구현을 조사할 때 참고할 수 있는 기존 회귀 테스트다. 이 목록을 새 적합성 계약으로 간주하지 않으며, 이 장의 규범은 `10-conformance.md`의 원칙에 따라 새 suite에서 처음부터 다시 검증한다.

- `example/test/src/__tests__/app-runtime.test.js`
  - 두 팩토리 호출의 state가 격리된다.
  - polling backoff가 남아 있어도 `requestRender()`가 interactive lane에서 다음 frame tick을 실행한다.
- `example/test/src/__tests__/component.test.jsx`
  - 기본 앱의 동기 초기 마운트와 setup 1회 실행.
  - `init()` 재호출 시 이전 컴포넌트 cleanup.
  - 라우터 bridge가 page/layout을 공통 runtime으로 렌더.
- `example/test/src/__tests__/dom.test.js`
  - `init()`이 scheduler를 만들고 재호출 시 새 예약을 만든다.
  - `AEUI.render()`가 DOM mutation 여부를 반환한다.
  - 렌더 실패 시 미커밋 DOM이 누적되지 않고 오류가 기록된다.
