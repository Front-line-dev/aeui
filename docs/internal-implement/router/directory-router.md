# Directory Router Internals

이 문서는 AEUI 라우터를 개발하거나 수정하는 사람을 위한 내부 구현 문서이다. 사용자 관점의 사용법은 `docs/guide/router.md`에서 다룬다.

## 목적

디렉터리 라우터는 사용자가 Router 컴포넌트, `Link`, `navigate`, `main.js`를 작성하지 않아도 `src/pages` 파일과 일반 `<a href>`만으로 화면을 전환하게 만든다. 공개 API는 늘리지 않고, Vite 플러그인과 런타임 내부 브릿지로 동작을 숨긴다.

## 모듈 경계

- `packages/core/src/vite-plugin.js`
  - `index.html`에 내부 가상 엔트리 `"/@aeui-entry"`를 주입한다.
  - `src/pages/**/*.{js,jsx,ts,tsx,mjs,cjs}`가 있으면 route module map을 만들고 `AEUI.__runtime.initDirectoryRouter(...)`를 호출한다.
  - 라우트 디렉터리가 없으면 `src/App.jsx`를 기존 단일 앱처럼 자동 부팅한다.
  - 지원 확장자의 모듈 변환은 AEUI Babel 플러그인과 classic JSX transform을 같은 순서로 적용한다. TypeScript syntax는 parser에서 허용하고, type 제거는 이후 Vite 파이프라인에 맡긴다.

- `packages/core/src/router.js`
  - route module map을 route table로 변환한다.
  - `index`, `[id]`, `[...slug]`, `_layout`, `404` 파일 규칙을 처리한다.
  - 현재 URL을 `route` prop으로 정규화해 page component에 전달한다.
  - 앱 컨테이너에 click delegation을 등록해 same-origin 내부 `<a href>` 이동을 History API 전환으로 처리한다.

- `packages/core/src/app-runtime.js`
  - `AEUI.__runtime.initDirectoryRouter` 내부 브릿지를 제공한다.
  - public top-level export는 추가하지 않는다.

## 런타임 흐름

1. Vite가 `transformIndexHtml`의 pre hook에서 `"/@aeui-entry"` script를 삽입한다.
2. 가상 엔트리는 `src/pages/**/*.{js,jsx,ts,tsx,mjs,cjs}`를 eager glob으로 로드한다.
3. `initDirectoryRouter(routeModules, container, { rootDir })`가 route table과 router root component를 만든다.
4. `AEUI.init(Root, container)`가 기존 reconciliation/scheduler 흐름을 그대로 시작한다.
5. 내부 링크 클릭 시 router가 `history.pushState`를 호출하고 `state.requestRender()`로 다음 렌더를 예약한다.
6. browser back/forward는 `popstate` listener가 현재 URL을 다시 매칭하고 렌더를 예약한다.

## 라우트 우선순위

라우트는 segment별로 static, dynamic, catch-all 순서가 되도록 정렬한다.

- static: `products/new`
- dynamic: `products/[id]`
- catch-all: `docs/[...slug]`

동일 depth에서 static route가 dynamic route보다 먼저 매칭되어야 한다.
`index` 파일은 해당 디렉터리의 exact route를 담당하므로, catch-all은 남은 segment가 하나 이상 있을 때만 매칭한다. 예를 들어 `/docs`는 `docs/index`가 처리하고, `/docs/core/router`는 `docs/[...slug]`가 처리한다.
catch-all segment는 route의 마지막 segment에서만 유효하다. `src/pages/[...slug]/edit.jsx`처럼 뒤에 segment가 남는 파일은 route table에 넣지 않는다.
정적 segment, 동적 segment, catch-all segment는 URL decode 후 비교한다. decode할 수 없는 malformed URL은 해당 route 매칭을 실패 처리해 fallback으로 보낸다.

## 정리와 테스트 기준

- `AEUI.init`을 다시 호출하거나 테스트에서 runtime state를 reset할 때 router listener를 제거해야 한다.
- 내부 링크, 외부 링크, 새 탭, download, modifier-click, middle click을 분리해서 테스트한다.
- route matching은 static, dynamic, catch-all, index vs catch-all, malformed segment, query, fallback, priority를 독립적으로 검증한다.
- 컴포넌트 통합 테스트는 `_layout.jsx`, `route` prop 전달, anchor click, `popstate`를 포함해야 한다.
