# 01. AEUI를 불러오고 앱을 실행하는 규칙

이 장은 앱 코드와 빌드 설정에서 AEUI를 불러오는 방법을 정의한다. 먼저 코드에 적을 수 있는 세 주소와 각 주소에서 얻는 기능을 설명한다. 이어서 `AEUI.init()`이 지정한 HTML 요소 안에 첫 화면을 표시하고, 각 앱의 화면 구조와 화면의 한 부분을 만드는 컴포넌트 함수가 사용하는 값을 다른 앱과 섞이지 않게 보관하는 방법을 정의한다.

## 1. AEUI를 불러오는 세 주소

설치한 AEUI 패키지는 `aeui`, `aeui/vite`, `aeui/babel-plugin`의 세 주소를 제공한다. 여기서 주소는 `import ... from '주소'` 또는 `require('주소')` 안에 적는 문자열이다. 세 주소는 한 파일에 모두 작성하는 사용 예가 아니다.

일반적인 Vite 프로젝트는 앱 소스에서 `aeui`를 사용하고, `vite.config.js`에서 `aeui/vite`를 사용한다. Vite 없이 Babel을 직접 구성하는 프로젝트는 `aeui/vite` 대신 `aeui/babel-plugin`을 사용한다.

### 1.1 `aeui`: 앱에서 사용하는 실행 기능

`aeui`는 `App.jsx`나 컴포넌트처럼 앱의 화면과 동작을 작성하는 소스 파일에서 사용한다. 이 주소에서 가져온 코드는 빌드 결과에 포함되어 브라우저에서 실행된다.

```js
// App.jsx 또는 컴포넌트 파일
import { AEUI, watch, clean } from 'aeui';
```

`aeui`에서 가져올 수 있는 값은 다음 세 개다.

| 이름 | 하는 일 |
| --- | --- |
| `AEUI` | VNode를 만들고, 앱을 HTML 요소에 붙이고, DOM을 갱신한다. |
| `watch` | 지정한 값이 바뀌었을 때 실행할 작업을 등록한다. |
| `clean` | 컴포넌트가 화면에서 제거될 때 실행할 정리 작업을 등록한다. |

한 파일에서 세 값을 항상 전부 가져올 필요는 없다. 해당 파일에서 실제로 사용하는 값만 import한다. `AEUI`, `watch`, `clean`의 정확한 타입은 2절, 런타임 동작은 3절부터 6절까지에서 각각 정의한다.

### 1.2 `aeui/vite`: Vite 프로젝트 설정

`aeui/vite`는 Vite를 사용하는 프로젝트의 `vite.config.js`에서 사용한다. 브라우저에서 실행되는 앱 API가 아니라, Vite 개발 서버를 시작하거나 배포 파일을 만들 때 실행되는 빌드 플러그인이다.

```js
// vite.config.js
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

`aeui()`를 Vite의 `plugins` 목록에 넣으면 다음 작업이 연결된다.

- AEUI Babel 변환과 JSX 변환을 소스 파일에 적용한다.
- 앱을 시작하는 가상 진입 코드를 만들고 HTML에 연결한다.
- `src/pages`의 파일 구조를 읽어 URL과 페이지를 연결한다.
- 필요한 스타일 import와 기본 `@` 경로 별칭을 준비한다.

`aeui/vite`가 `aeui/babel-plugin`을 내부에서 이미 등록하므로 Vite 프로젝트에서 두 플러그인을 함께 등록하지 않는다. Vite hook, 가상 진입 코드와 변환 대상의 정확한 규칙은 [08. Vite 플러그인, 타입, 빌드와 패키지 계약](08-vite-plugin-and-build.md)이 정의한다.

### 1.3 `aeui/babel-plugin`: Babel 직접 설정

`aeui/babel-plugin`은 `aeui/vite`를 사용하지 않고 Babel 설정을 직접 구성할 때 사용한다. 앱의 브라우저 코드에서 호출하는 API가 아니라, 빌드 중에 앱 소스를 변환하는 컴파일러 플러그인이다.

```js
// Babel 설정 파일
import aeuiTransform from 'aeui/babel-plugin';
```

이 플러그인은 컴포넌트 함수를 setup과 render로 나누고, props와 `watch`·`clean` 호출을 AEUI 런타임에 맞게 변환한다. 변환 결과에 `AEUI`가 필요하지만 올바른 import가 없으면 `import { AEUI } from 'aeui'`도 추가한다.

이 플러그인만으로 JSX가 JavaScript 호출로 바뀌지는 않는다. Babel을 직접 구성하는 사용자는 JSX를 `AEUI.createElement(...)` 호출로 바꾸는 JSX 변환 플러그인도 함께 설정해야 한다. 판별 조건과 전체 변환 순서는 [06. Babel 컴파일러와 컴파일러 런타임 ABI](06-babel-compiler.md)가 정의한다.

### 1.4 배포 파일 연결

`packages/core/package.json`의 `exports`는 앞의 세 주소를 실제 배포 파일과 연결한다.

| 코드에 적는 주소 | `exports` 경로 | import용 JavaScript | require용 JavaScript | TypeScript 설명 파일 |
| --- | --- | --- | --- | --- |
| `aeui` | `.` | `dist/aeui.esm.js` | `dist/aeui.cjs` | `types/index.d.ts` |
| `aeui/vite` | `./vite` | `dist/vite-plugin.js` | `dist/vite-plugin.cjs` | `types/vite.d.ts` |
| `aeui/babel-plugin` | `./babel-plugin` | `dist/babel-plugin.js` | `dist/babel-plugin.cjs` | `types/babel-plugin.d.ts` |

앱과 설정 코드는 표의 `dist/...` 파일이나 `packages/core/src/...` 파일을 직접 지정하지 않는다. 패키지 안에 파일이 있더라도 `exports`에 없는 주소에서는 불러올 수 없다.

`aeui` 배포 파일의 소스 진입점인 `src/index.js`는 다음 두 모듈의 공개 값을 다시 내보낸다.

```javascript
export * from './core.js';
export * from './hooks.js';
```

`createAppRuntime`, `createRouteTable`, `matchRoute`, `createDirectoryRouter`는 구현 파일 안에는 있지만 `import { ... } from 'aeui'`로 가져올 수 없다. `Router`, `Link`, `navigate`라는 공개 값과 `aeui/router` 주소도 없다. 디렉터리 라우터는 `aeui/vite`가 가상 진입 코드를 만들 때 연결하며, 파일 이름과 URL 규칙은 [07. 디렉터리 라우터](07-directory-router.md)가 정의한다.

## 2. `aeui`의 TypeScript 타입

`types/index.d.ts`는 `aeui`에서 가져오는 값의 TypeScript 타입을 정의한다. `props`는 부모 컴포넌트가 자식 컴포넌트에 전달하는 값이고, `Renderable`은 화면에 표시할 수 있는 값이다. 관련 타입은 다음과 같다.

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

`AEUI` 객체가 제공하는 함수와 값은 다음과 같다.

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

`__runtime` 속성은 Babel 플러그인과 AEUI 내부 코드가 서로 호출할 때 사용한다. 일반 앱 코드가 직접 사용하도록 제공하는 값이 아니다. TypeScript 선언은 `watch`, `clean`, `runRenderPhase`만 구체적으로 적고 나머지는 `[key: string]: unknown`으로 표시한다.

## 3. `core.js`가 기본 `AEUI` 객체에 넣는 기능

### 3.1 `createVNode(tag, props, ...children)`

`AEUI.createVNode(tag, props, ...children)`은 화면 구조를 저장할 VNode 객체를 다음 순서로 만든다.

1. `...children`으로 모은 배열을 `Array.prototype.flat()`의 기본 깊이인 1단계만 펼친다.
2. 값이 `null` 또는 `undefined`인 자식과 타입이 `boolean`인 모든 자식을 버린다.
3. 원래 `props`를 직접 수정하지 않고 최상위 속성만 새 객체로 복사한다.
4. 복사한 props의 `children`을 2단계에서 만든 배열로 덮어쓴다.
5. `{ tag, props: finalProps, children: validChildren }` 객체를 만든다.
6. AEUI 내부에서 VNode인지 구분할 표식인 `VNODE_MARKER` Symbol 속성을 값 `true`, `enumerable: false`로 정의한다. 별도 옵션을 주지 않으므로 이 속성은 `writable`과 `configurable`도 `false`다.

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

항상 `vnode.props.children`과 `vnode.children`은 같은 배열 객체여야 하며, 호출자가 넘긴 props 객체는 바뀌지 않아야 한다. 문자열, 숫자, bigint, 객체와 두 단계 이상 중첩된 배열은 이 함수에서 추가로 바꾸거나 걸러내지 않는다.

### 3.2 `Fragment`

`Fragment`는 여러 자식을 감싸는 실제 HTML 요소를 만들지 않고 한 묶음으로 다루는 기능이다. 이 함수는 처음 받은 값을 사용하지 않고, 화면을 갱신할 때 받은 `props.children`을 반환하는 함수를 만든다.

```javascript
function Fragment(initialProps) {
  return (props) => props.children;
}
```

이 함수 자체를 직접 호출하면 반환된 함수가 호출 시점의 `props.children`을 돌려준다. JSX에서 만든 Fragment VNode는 일반 컴포넌트보다 먼저 Fragment로 분류하므로 이 함수를 직접 실행하지 않는다. 화면 갱신 코드는 Fragment VNode의 `children` 배열을 바로 사용하며 자식을 감싸는 별도 HTML 요소를 만들지 않는다.

### 3.3 기본 `AEUI` 객체

`core.js`는 다음 다섯 값을 `createAppRuntime()`에 전달해 기본 `AEUI` 객체 하나를 만들고, 이름 `AEUI`로 export한다.

```javascript
export const AEUI = createAppRuntime({
  deepEqual: _deepEqual,
  deepClone: _deepClone,
  createVNode,
  createElement: createVNode,
  Fragment,
});
```

`AEUI.createElement`와 `AEUI.createVNode`는 이름만 다르고 정확히 같은 함수다. `aeui`를 import한 코드는 모두 이 기본 `AEUI` 객체를 공유한다. 반면 `createAppRuntime()`을 다시 호출하면 다른 앱과 값을 공유하지 않는 새 실행 상태를 만들 수 있다.

## 4. `createAppRuntime(config)`

### 4.1 `config`로 받는 값

`createAppRuntime(config)`는 `config` 객체에서 다음 값을 꺼내 사용한다.

| 필드 | 필수 여부 | 사용처 |
| --- | --- | --- |
| `deepEqual` | 필수 | watcher가 이전 값과 새 값을 비교할 때 사용 |
| `deepClone` | 필수 | watcher가 나중 비교를 위해 현재 값을 복사해 둘 때 사용 |
| `createVNode` | 필수 | 루트, 컴포넌트, 라우터 VNode 생성 |
| `createElement` | 선택 | 생략하면 `createVNode`를 사용 |
| `Fragment` | 필수 | Fragment 식별과 공개 API |

이 함수는 `config`와 각 필드의 타입을 미리 검사하지 않는다. `config`가 `undefined`이면 매개변수에서 값을 꺼낼 때 즉시 실패하고, 필수 함수가 잘못되었으면 해당 함수를 처음 사용할 때 JavaScript 오류가 발생한다.

### 4.2 앱의 실행 상태를 저장할 객체 생성

여기서 `state`는 한 앱의 루트 컴포넌트, 현재 실행 중인 컴포넌트, 화면 갱신 예약과 라우터 정리 함수를 함께 저장하는 객체다. 첫 단계에서 `createRuntimeState({ deepEqual, deepClone })`를 호출하며, 호출할 때마다 아래 모양의 새 객체를 만들어야 한다. 이 객체의 필드는 앱이 실행되는 동안 바뀐다.

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

`state`는 모든 앱이 함께 쓰는 변수가 아니다. 앱 A의 `frameDelay`, root, 현재 watcher 정보와 router 정리 함수를 바꾸어도 앱 B의 `state`에는 영향을 주지 않아야 한다.

### 4.3 `state`를 사용하는 내부 함수 모음 만들기

`internalRuntime`은 AEUI 내부 함수들을 한 객체에 모은 값이다. 원래 내부 함수는 첫 번째 인자로 `state`를 받는다. `createAppRuntime()`은 각 함수를 감싸 현재 앱의 `state`를 자동으로 첫 인자로 넘기며, 아래 이름으로 저장한다.

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

첫 URL에 맞는 페이지를 찾고 라우터 객체를 만드는 작업은 공통 `init`보다 먼저 실행한다. click과 `popstate` listener는 첫 화면을 그린 뒤 화면 갱신 예약을 시작하고 나서 붙인다. `initDirectoryRouter`는 `{ Root, attach, router }`나 다른 값을 호출자에게 돌려주지 않으므로 반환값은 `undefined`다.

### 4.4 `state`에서도 내부 함수를 호출할 수 있게 연결

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

뒤쪽 함수들은 호출할 때마다 대응하는 `internalRuntime` 속성을 다시 조회해야 한다. 따라서 속성에 저장된 함수 참조가 바뀌면 이후 `state.*` 호출은 바뀐 참조를 사용한다.

### 4.5 호출자에게 돌려주는 객체

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

앱 코드가 `AEUI`의 최상위에서 호출할 수 있는 화면 갱신 함수는 `init`과 `render`뿐이다. 나머지 내부 함수는 `AEUI.__runtime` 밖에 같은 이름으로 다시 제공하지 않는다.

## 5. 지정한 HTML 요소 안에 앱의 첫 화면 표시

### 5.1 `AEUI.init(RootComponent, containerElement)`

정상 호출은 앱을 넣을 HTML 요소인 `containerElement`와 첫 화면을 만드는 함수인 `RootComponent`를 받는다. 두 값을 별도로 검사하지 않고 다음 순서를 한 번에 이어서 실행한다.

1. 화면을 다시 확인할 시간을 예약하는 scheduler의 기존 예약을 취소하고 `state.rafId = null`로 만든다.
2. `state.routerTeardown`이 함수이면 호출해 기존 라우터가 등록한 click과 `popstate` 처리 함수를 제거한다.
3. 앱 전체 트리를 담는 root node에 첫 번째 자식이 있으면 `unmountNode`로 이전 앱 전체를 제거한다. 이 과정에서 컴포넌트가 등록한 정리 함수도 실행한다.
4. `RootComponent`와 `containerElement`를 state에 저장한다.
5. `createRootNode(containerElement)`로 새 root wrapper를 만든다.
6. `containerElement.innerHTML = ''`로 기존 HTML 요소를 전부 제거한다. 서버가 미리 만든 HTML을 재사용하지 않는다.
7. `interactiveRenderRequested = false`로 초기화한다.
8. `tick()`을 즉시 한 번 호출하고, `init()`이 반환되기 전에 첫 화면을 그린다.
9. 첫 `tick()`에서 DOM을 바꿨는지를 나타내는 `didMutate`로 다음 확인 간격을 계산한다. 변경이 있으면 1프레임 뒤, 없으면 현재 `frameDelay`를 두 배로 늘리되 최대 60프레임 뒤에 다시 확인한다.
10. 브라우저가 `requestAnimationFrame`을 제공하면 이를 사용하고, 없으면 16ms `setTimeout`을 사용해 다음 화면 확인을 예약한다.

`init` 자체는 값을 반환하지 않는다. 같은 `AEUI` 객체에서 다시 호출하면 이전 화면 갱신 예약, 라우터의 이벤트 처리 함수와 컴포넌트 트리를 제거한 뒤 새 앱의 첫 화면을 표시하고 다음 갱신을 예약한다.

container가 `null`이거나 `innerHTML`을 지원하지 않으면 6단계에서 오류가 그대로 전파된다. RootComponent가 함수인지도 선검증하지 않는다.

### 5.2 첫 화면 트리를 만들고 DOM을 갱신하는 순서

`tick()`은 다음 조건이면 아무 작업 없이 `false`를 반환한다.

- RootComponent, container, root wrapper 중 하나가 없음
- 이미 `state.isRendering === true`임

그 외에는 `isRendering`을 `true`로 두고 `reconcileRoot()`를 실행한다. 이 함수는 이전 화면 트리와 새 VNode를 비교해 필요한 DOM만 바꾼다. 루트 VNode는 항상 `state.createVNode(state.RootComponent)`로 만들기 때문에 `AEUI.init()`에는 루트 컴포넌트의 props를 전달하는 인자가 없다.

비교와 DOM 갱신에 성공하면 root node는 새 자식을 0개 또는 1개만 가지며, 그 자식의 첫 DOM과 마지막 DOM을 `firstDom`과 `lastDom`에 저장한다. 실패하면 작업 시작 전에 이미 화면에 반영을 끝낸 DOM은 유지하고, 이번 작업에서 새로 넣었지만 끝까지 반영하지 못한 DOM만 제거한 뒤 오류를 다시 던진다.

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

`render()`는 예약된 시간을 기다리지 않고 현재 앱의 `tick()`을 즉시 실행하는 함수다.

1. RootComponent 또는 container가 없으면 `false`를 반환한다.
2. 대기 중인 interactive 요청을 false로 지운다.
3. `tick()`을 즉시 호출한다.
4. 결과에 따라 polling 간격을 갱신한다.
5. scheduler가 멈춰 있으면 다시 예약한다.
6. 이번 tick에서 실제 DOM write가 있었는지를 boolean으로 반환한다.

컴포넌트 오류는 `tick()`의 정책에 따라 로그로 처리되므로 보통 `render()`에서 throw되지 않고 `didMutate` 값을 반환한다.

### 5.5 즉시 실행하는 `render()`와 다음 프레임을 예약하는 `requestRender()`

`requestRender()`는 AEUI 내부 코드에서만 사용한다. 표시 중인 앱이 없으면 `false`를 반환한다. 앱이 있으면 `interactiveRenderRequested = true`로 표시하고 다음 화면 확인을 예약한 뒤 `true`를 반환한다. `tick()`을 즉시 실행하지 않는다.

DOM 이벤트 처리, 라우터 click과 `popstate`는 이 함수를 사용해 현재의 주기적 확인 간격과 관계없이 다음 화면 프레임에 갱신을 요청한다. 여러 요청이 연속해서 와도 하나의 boolean 값과 하나의 `requestAnimationFrame` 예약으로 합친다.

## 6. `watch`와 `clean`을 Babel 변환 코드에 연결

### 6.1 `watch`

`hooks.js`의 공개 `watch()`는 항상 다음 오류를 던진다.

```text
[AEUI] watch(callback, deps) must be compiled by the AEUI Babel plugin.
```

정상 컴파일에서는 Babel 플러그인이 `watch(callback, deps)`를 `AEUI.__runtime.watch(callback, depsGetter)`로 바꾼다. 내부 등록 함수는 컴포넌트를 처음 만들고 있는 동안에만 watcher를 추가한다. `callback`이 함수가 아니거나 `deps`가 없거나, `deps` 또는 그 반환값이 배열이 아니면 `TypeError`를 던진다.

### 6.2 `clean`

`clean(callback)`은 현재 실행 중인 컴포넌트를 기록한 목록의 맨 위에서 `state`를 찾고 `registerCleanup`에 전달한다. 지금 처음 만드는 중인 컴포넌트가 없으면 아무 작업도 하지 않는다. Babel이 변환한 코드는 `AEUI.__runtime.clean`을 호출하며 같은 등록 함수를 사용한다.

컴포넌트를 처음 만들거나 다시 그리기 시작하면 해당 컴포넌트와 `state`를 목록의 맨 위에 추가하고, 성공하거나 오류가 나도 `finally`에서 제거한다. 따라서 `createAppRuntime()`으로 여러 앱을 만들더라도 정리 함수는 지금 실행 중인 앱에 등록된다.

## 7. 파일과 함수가 호출되는 순서

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

라우터도 별도의 화면 갱신기를 만들지 않고 일반 앱과 같은 root 비교·DOM 갱신 함수와 다음 갱신 예약을 사용한다.

## 8. 항상 지켜야 하는 조건

AEUI core는 다음 조건을 항상 지켜야 한다.

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
