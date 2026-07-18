# 01. 공개 API와 아키텍처

AEUI 앱을 만들려면 세 가지만 알면 된다: **`AEUI`** 객체로 화면을 만들고, **`watch`**로 변화에 반응하고, **`clean`**으로 정리한다. 이 장은 이 세 API의 사용법과, 앱이 처음 화면을 표시하기까지의 전체 흐름을 설명한다.

---

## 1. AEUI를 불러오는 세 가지 주소

### 1.1 `aeui` — 앱 코드에서 사용

```js
// App.jsx 또는 컴포넌트 파일
import { AEUI, watch, clean } from 'aeui';
```

브라우저에서 실행되는 앱 코드가 사용하는 주소다. 여기서 가져올 수 있는 것은 세 가지뿐이다:

| 이름 | 역할 |
|---|---|
| `AEUI` | VNode 생성, 앱 초기화, DOM 갱신을 담당하는 메인 객체 |
| `watch` | 지정한 값이 바뀌었을 때 실행할 콜백을 등록 |
| `clean` | 컴포넌트가 화면에서 제거될 때 실행할 정리 작업을 등록 |

사용하는 것만 가져오면 된다. `AEUI`, `watch`, `clean`의 구체적인 동작은 이후 장에서 하나씩 다룬다.

### 1.2 `aeui/vite` — Vite 프로젝트 설정

```js
// vite.config.js
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

Vite 개발 서버나 프로덕션 빌드에서 사용하는 **빌드 플러그인**이다. `aeui()`를 plugins에 넣으면 다음 네 가지가 자동으로 설정된다:

1. AEUI Babel 변환과 JSX 변환을 소스 파일에 적용
2. 앱을 시작하는 가상 진입 코드를 만들고 HTML에 연결
3. `src/pages`의 파일 구조를 읽어 URL과 페이지를 연결 (디렉터리 라우터)
4. 기본 스타일 import와 `@` 경로 별칭 준비

> **주의:** `aeui/vite`가 내부에서 `aeui/babel-plugin`을 이미 등록하므로, Vite 프로젝트에서 두 플러그인을 함께 쓸 필요 없다.

자세한 설정 옵션은 [08. Vite 플러그인과 빌드](08-vite-plugin-and-build.md)를 참고한다.

### 1.3 `aeui/babel-plugin` — Babel 직접 설정

`aeui/vite`를 사용하지 않고 Babel을 직접 구성할 때만 사용한다.

```js
// Babel 설정 파일
import aeuiTransform from 'aeui/babel-plugin';
```

이 플러그인은 컴포넌트 함수를 setup과 render로 나누고, `watch`/`clean` 호출을 런타임에 맞게 변환한다. 단, **JSX를 JavaScript로 바꾸는 것은 이 플러그인의 역할이 아니다** — 별도의 JSX 변환 플러그인(`@babel/plugin-transform-react-jsx`)도 함께 설정해야 한다.

변환 규칙은 [06. Babel 컴파일러](06-babel-compiler.md)를 참고한다.

### 1.4 배포 파일 연결

`packages/core/package.json`의 `exports`가 세 주소를 실제 파일에 연결한다:

| 코드에 적는 주소 | ESM | CJS | TypeScript |
|---|---|---|---|
| `aeui` | `dist/aeui.esm.js` | `dist/aeui.cjs` | `types/index.d.ts` |
| `aeui/vite` | `dist/vite-plugin.js` | `dist/vite-plugin.cjs` | `types/vite.d.ts` |
| `aeui/babel-plugin` | `dist/babel-plugin.js` | `dist/babel-plugin.cjs` | `types/babel-plugin.d.ts` |

`exports`에 없는 주소(예: `aeui/src/core.js`)로는 불러올 수 없다.

`aeui`의 소스 진입점인 `src/index.js`는 두 모듈의 공개 값을 다시 내보낸다:

```js
export * from './core.js';
export * from './hooks.js';
```

> **참고:** `createAppRuntime`, `createRouteTable`, `matchRoute` 등은 내부 구현 함수로, `import { ... } from 'aeui'`로 가져올 수 없다. 디렉터리 라우터는 `aeui/vite`가 가상 진입 코드에서 연결한다.

---

## 2. TypeScript 타입

`types/index.d.ts`는 `aeui`에서 가져오는 모든 값의 타입을 정의한다.

### 핵심 타입

```typescript
// 화면에 표시할 수 있는 값
type Renderable =
  | VNode
  | string | number | bigint
  | boolean | null | undefined
  | Renderable[];

// 컴포넌트 함수의 타입: props를 받아 화면을 반환
type Component<P = Record<string, unknown>> =
  (props: P) => Renderable | RenderFunction<P>;

// 렌더 함수: 매 갱신마다 호출됨
type RenderFunction<P = Record<string, unknown>> =
  (props?: P) => Renderable;
```

### `AEUI` 객체의 타입

```typescript
interface AeuiApp {
  // VNode 생성 (JSX가 변환되는 대상)
  createVNode(tag, props?, ...children): VNode;
  createElement(tag, props?, ...children): VNode;  // createVNode과 같은 함수
  
  // 여러 자식을 감싸는 빈 컨테이너
  Fragment: FragmentComponent;
  
  // 앱 초기화: 루트 컴포넌트를 HTML 요소에 마운트
  init(rootComponent: Component<any>, containerElement: Element): void;
  
  // 즉시 화면 갱신
  render(): boolean;
  
  // Babel 플러그인과 내부 코드가 사용하는 private API
  __runtime: AeuiRuntimeInternals;
}
```

`__runtime`은 앱 코드에서 직접 사용하지 않는다. Babel이 변환한 코드와 AEUI 내부에서만 사용한다.

---

## 3. `AEUI` 객체가 제공하는 기능

### 3.1 `createVNode(tag, props, ...children)` — VNode 생성

JSX 코드가 Babel에 의해 변환되면, 결국 이 함수를 호출하게 된다:

```jsx
// JSX 원본
<div className="card">{title}</div>

// Babel 변환 결과
AEUI.createElement('div', { className: 'card' }, title)
```

이 함수는 다음 순서로 VNode 객체를 만든다:

1. children 배열을 **1단계만** 펼침 (`flat()`)
2. `null`, `undefined`, `boolean` 자식을 제거
3. 원래 props를 **복사**하여 새 객체를 만듦 (원본 수정 방지)
4. 복사한 props의 `children`을 정리된 배열로 설정
5. `{ tag, props, children }` 객체를 만듦
6. VNode 식별용 Symbol 마커를 비열거 속성으로 추가

동등한 구현:

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

> **중요:** `vnode.props.children`과 `vnode.children`은 항상 **같은 배열 객체**를 참조해야 하며, 호출자가 넘긴 props 객체는 변하지 않아야 한다.

### 3.2 `createElement` — `createVNode`의 별칭

```js
AEUI.createElement === AEUI.createVNode  // true (같은 함수 객체)
```

### 3.3 `Fragment` — 감싸는 DOM 없이 자식을 묶기

Fragment는 `<div>` 같은 실제 HTML 요소를 만들지 않고 여러 자식을 한 묶음으로 다루는 기능이다:

```jsx
// JSX
<>
  <h1>제목</h1>
  <p>내용</p>
</>
```

내부 구현은 단순하다 — 매번 `props.children`을 그대로 반환하는 함수다:

```javascript
function Fragment(initialProps) {
  return (props) => props.children;
}
```

### 3.4 기본 `AEUI` 객체의 생성

`core.js`는 `createAppRuntime()`을 호출해 기본 `AEUI` 객체를 만들고 export한다:

```javascript
export const AEUI = createAppRuntime({
  deepEqual: _deepEqual,
  deepClone: _deepClone,
  createVNode,
  createElement: createVNode,
  Fragment,
});
```

`aeui`를 import한 모든 코드는 이 하나의 `AEUI` 객체를 공유한다.

---

## 4. 앱 실행 상태의 격리: `createAppRuntime(config)`

`createAppRuntime()`은 **독립된 실행 상태를 가진 새 AEUI 인스턴스**를 만드는 팩토리 함수다. 기본 `AEUI` 객체도 이 함수로 만들어진다.

### 왜 필요한가?

한 페이지에 여러 AEUI 앱을 띄울 때, 앱 A의 화면 갱신이 앱 B에 영향을 주면 안 된다. `createAppRuntime()`은 호출할 때마다 완전히 격리된 상태 객체를 만들어 이 문제를 해결한다.

### 4.1 `config`로 받는 값

| 필드 | 필수 | 용도 |
|---|---|---|
| `deepEqual` | 필수 | watcher가 이전 값과 새 값을 비교할 때 |
| `deepClone` | 필수 | watcher가 비교 기준값을 복사해둘 때 |
| `createVNode` | 필수 | 루트/컴포넌트/라우터 VNode 생성 |
| `createElement` | 선택 | 생략하면 `createVNode`을 사용 |
| `Fragment` | 필수 | Fragment 식별과 공개 API |

### 4.2 앱의 실행 상태 (`state`)

`createAppRuntime()`이 내부에서 만드는 `state` 객체는 앱 하나의 모든 실행 상태를 담는다:

```javascript
{
  deepEqual,                      // 값 비교 함수
  deepClone,                      // 값 복사 함수
  rootNode: null,                 // 앱 전체 트리의 root 노드
  containerElement: null,         // 앱이 마운트된 DOM 요소
  RootComponent: null,            // 루트 컴포넌트 함수
  currentComponentNode: null,     // 현재 setup/render 중인 컴포넌트
  currentComponentPhase: null,    // 'setup' 또는 'render'
  isRendering: false,             // 렌더링 진행 중 여부
  rafId: null,                    // requestAnimationFrame 예약 ID
  frameDelay: 1,                  // 다음 변경 확인까지 건너뛸 프레임 수
  framesUntilNextTick: 0,         // 남은 프레임 카운트다운
  didMutate: false,               // 이번 tick에서 DOM 변경이 있었는지
  domEventDepth: 0,               // 중첩된 DOM 이벤트 깊이
  interactiveRenderRequested: false, // 다음 프레임에 렌더링 요청됨
  routerTeardown: null,           // 라우터 정리 함수
}
```

> **앱 A의 state를 바꿔도 앱 B의 state에는 영향이 없다.** 각 `createAppRuntime()` 호출이 독립된 `state`를 만들기 때문이다.

### 4.3 내부 함수 모음 (`__runtime`)

AEUI의 내부 함수들은 원래 첫 번째 인자로 `state`를 받는 순수 함수다. `createAppRuntime()`은 이 함수들을 **현재 앱의 `state`를 자동으로 전달하는 래퍼**로 감싸서 `__runtime` 객체에 모은다:

| `__runtime` 속성 | 실제 호출 |
|---|---|
| `createNode(...args)` | `createNode(state, ...args)` |
| `reconcile(...args)` | `reconcile(state, ...args)` |
| `watch(...args)` | `registerWatch(state, ...args)` |
| `clean(...args)` | `registerCleanup(state, ...args)` |
| `tick(...args)` | `tick(state, ...args)` |
| ... | (이하 동일 패턴) |

전체 목록은 [12. 소스 파일 배치](12-source-layout.md)를 참고한다.

### 4.4 반환되는 공개 객체

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

앱 코드가 호출할 수 있는 함수는 `init`과 `render` 뿐이다. 나머지 내부 함수는 `__runtime` 밖에 노출하지 않는다.

---

## 5. 앱의 첫 화면 표시: `AEUI.init()`

### 5.1 기본 사용법

```javascript
import { AEUI } from 'aeui';
import App from './App.jsx';

AEUI.init(App, document.getElementById('root'));
```

`AEUI.init(RootComponent, containerElement)`는 지정한 HTML 요소 안에 앱의 첫 화면을 표시한다.

### 5.2 내부 실행 순서

1. 기존 스케줄러 예약 취소
2. 기존 라우터 리스너 제거 (`routerTeardown`)
3. 이전 앱 트리가 있으면 모든 컴포넌트 정리(cleanup) 후 제거
4. `RootComponent`와 `containerElement`를 state에 저장
5. 새 root 노드 생성
6. `containerElement.innerHTML = ''`로 기존 HTML 제거
7. `tick()`을 **즉시 한 번** 호출하여 첫 화면을 그림
8. DOM 변경 여부에 따라 다음 확인 간격을 계산
9. 스케줄러 시작 (정기적으로 변경 감지)

> **핵심:** `init()`은 반환되기 전에 첫 화면을 **동기적으로** 그린다. 이후 변경 감지는 비동기 스케줄러가 담당한다.

### 5.3 렌더 오류 처리

`tick()` 내부의 렌더링 오류는 **로그만 남기고 삼킨다**:

```javascript
try {
  reconcileRoot(state);
} catch (error) {
  console.error('[AEUI] Render error:', error);
} finally {
  state.isRendering = false;
}
```

따라서 컴포넌트 setup이 실패해도 `init()`은 스케줄러를 시작한다. 다만 다음 오류는 이 catch 바깥이므로 호출자에게 그대로 전파된다:

- 잘못된 container의 `innerHTML` 접근
- 라우터 teardown이나 이전 트리 unmount 자체의 예외
- 디렉터리 라우터의 route table 생성 중 예외

### 5.4 `AEUI.render()` — 즉시 화면 갱신

```javascript
AEUI.render();  // 스케줄러를 기다리지 않고 지금 바로 갱신
```

`render()`는 현재 앱의 `tick()`을 **동기적으로** 실행하고, DOM 변경이 있었는지를 boolean으로 반환한다.

### 5.5 `requestRender()` — 다음 프레임에 갱신 예약

`requestRender()`는 내부 전용 함수다. `interactiveRenderRequested = true`로 표시하고 다음 애니메이션 프레임에 갱신을 예약한다. 즉시 `tick()`을 실행하지는 않는다.

DOM 이벤트 처리, 라우터 click, `popstate` 이벤트가 이 함수를 사용한다. 여러 요청이 연속으로 와도 **하나의 boolean 값과 하나의 `requestAnimationFrame` 예약**으로 합쳐진다.

---

## 6. `watch`와 `clean`의 Babel 연결

### 6.1 `watch` — 값 변화 감시

`hooks.js`에서 export하는 공개 `watch()` 함수는 **직접 호출하면 항상 오류를 던진다**:

```
[AEUI] watch(callback, deps) must be compiled by the AEUI Babel plugin.
```

이것은 의도적인 설계다. Babel 플러그인이 `watch(callback, deps)`를 다음과 같이 변환한다:

```javascript
// 변환 전
watch(() => console.log(count), [count]);

// 변환 후
AEUI.__runtime.watch(() => console.log(count), () => [count]);
```

deps 배열을 **함수로 감싸는 것**이 핵심이다. 이렇게 해야 매 확인 시점마다 deps의 **현재 값**을 다시 읽을 수 있다.

### 6.2 `clean` — 정리 작업 등록

```javascript
clean(() => {
  clearInterval(timerId);
});
```

`clean(callback)`은 현재 setup 중인 컴포넌트에 정리 함수를 등록한다. 컴포넌트가 화면에서 제거될 때 등록된 순서대로 실행된다.

Babel이 변환한 코드는 `AEUI.__runtime.clean`을 호출하여 **해당 앱의 state**에 정리 함수를 등록한다. 여러 앱이 있어도 정리 함수는 현재 실행 중인 앱에만 등록된다.

---

## 7. 전체 실행 흐름

### 7.1 일반 앱

```
import { AEUI } from 'aeui'
  → src/index.js
     → core.js: 기본 AEUI 객체 생성
        → createAppRuntime(config)
           → 독립된 state 생성
           → 내부 함수를 state에 바인딩

AEUI.init(App, container)
  → 이전 스케줄러/라우터/트리 정리
  → createRootNode(container)
  → tick()
     → reconcileRoot()
        → createVNode(App)
        → reconciler로 DOM 갱신
  → startScheduler()
```

### 7.2 디렉터리 라우터 앱

```
aeui/vite 가상 진입 코드
  → AEUI.__runtime.initDirectoryRouter(routeModules, container, options)
     → createDirectoryRouter(state, routeModules, options)
        → route table 생성 + 현재 URL 매칭
     → init(state, Root, container)
        → 첫 화면 렌더링
     → attach(container)
        → container click 리스너 등록
        → window popstate 리스너 등록
```

라우터도 별도의 화면 갱신기를 만들지 않고, 일반 앱과 **같은 스케줄러와 DOM 갱신 함수**를 사용한다.

---

## 8. 핵심 규칙 요약

- `aeui`에서는 `AEUI`, `watch`, `clean`만 가져올 수 있다. 라우터 관련 API는 공개하지 않는다.
- `createVNode`은 props를 복사하며 원본을 수정하지 않는다.
- 각 `createAppRuntime()` 호출은 독립된 state를 가진다.
- `init()`은 기존 라우터 → root unmount → container 초기화 → 첫 tick → 스케줄러 시작 순서를 따른다.
- 컴포넌트 렌더 오류는 `[AEUI] Render error:`로 로그하며, 스케줄러를 중단시키지 않는다.
- `render()`는 동기 실행, `requestRender()`는 다음 프레임 예약이다.
