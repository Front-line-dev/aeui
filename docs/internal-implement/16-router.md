# 16. 라우터 내부

이 문서는 AEUI 디렉터리 라우터의 내부 구현 — route table 생성, URL 매칭, anchor click 가로채기를 설명한다.

---

## 목적

디렉터리 라우터는 사용자가 Router 컴포넌트, `Link`, `navigate`, `main.js`를 작성하지 않아도 `src/pages` 파일과 일반 `<a href>`만으로 화면을 전환하게 만든다. 공개 API는 늘리지 않고, Vite 플러그인과 런타임 내부 브릿지로 동작을 숨긴다.

---

## 관련 모듈

| 모듈 | 역할 |
|---|---|
| `router.js` | route table, URL 매칭, SPA 네비게이션 |
| `vite-plugin.js` | route mode 감지, virtual entry 생성 |

### 모듈 경계

- **`packages/core/src/vite-plugin.js`**
  - `index.html`에 내부 가상 엔트리 `"/@aeui-entry"`를 주입한다.
  - `src/pages/**/*.{js,jsx,ts,tsx,mjs,cjs}`가 있으면 route module map을 만들고 `AEUI.__runtime.initDirectoryRouter(...)`를 호출한다.
  - 라우트 디렉터리가 없으면 `src/App.jsx`를 기존 단일 앱처럼 자동 부팅한다.
  - 지원 확장자의 모듈은 기본 SWC 변환기에서 컴포넌트 변환과 automatic JSX 변환을 수행한다. `compiler: 'babel'`이면 AEUI Babel 플러그인과 automatic JSX 변환을 적용한다.

- **`packages/core/src/router.js`**
  - route module map을 route table로 변환한다.
  - `index`, `[id]`, `[...slug]`, `_layout`, `404` 파일 규칙을 처리한다.
  - 현재 URL을 `route` prop으로 정규화해 page component에 전달한다.
  - 앱 컨테이너에 click delegation을 등록해 same-origin 내부 `<a href>` 이동을 History API 전환으로 처리한다.

- **`packages/core/src/app-runtime.js`**
  - `AEUI.__runtime.initDirectoryRouter` 내부 브릿지를 제공한다.
  - public top-level export는 추가하지 않는다.

---

## 런타임 흐름

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

상세 단계:
1. Vite가 `transformIndexHtml`의 pre hook에서 `"/@aeui-entry"` script를 삽입한다.
2. 가상 엔트리는 `src/pages/**/*.{js,jsx,ts,tsx,mjs,cjs}`를 eager glob으로 로드한다.
3. `initDirectoryRouter(routeModules, container, { rootDir })`가 route table과 router root component를 만든다.
4. `AEUI.init(Root, container)`가 기존 reconciliation/scheduler 흐름을 그대로 시작한다.
5. 내부 링크 클릭 시 router가 `history.pushState`를 호출하고 `state.requestRender()`로 다음 렌더를 예약한다.
6. browser back/forward는 `popstate` listener가 현재 URL을 다시 매칭하고 렌더를 예약한다.

라우터도 일반 앱과 **같은 스케줄러와 렌더 함수**를 사용한다.

---

## Route Table 생성

### 입력: Vite glob 결과

```js
{
  '/src/pages/index.jsx': { default: HomePage },
  '/src/pages/products/[id].jsx': { default: ProductPage },
}
```

### 컴포넌트 선택 우선순위

```js
const component = mod && (mod.default || mod.Page || mod);
```

선택 결과가 **함수**일 때만 유효.

### 파일명 → URL 변환

| 파일명 | 결과 |
|---|---|
| `index.ext` | 마지막 `index` 제거 |
| `[name].ext` | 동적 파라미터 `:name` |
| `[...name].ext` | catch-all `*name` |
| `404.ext` | fallback (root만) |
| `_layout.ext` | layout (root만) |
| `_anything.ext` | 일반 route에서 제외 |
| 그 외 | literal static segment |

**세부 규칙:**
- `_` 제외는 **파일명에만** 적용. `_private/page.jsx`는 `/_private/page` route
- `404`와 `_layout`은 root에서만 특별. `blog/404.jsx`는 제외
- catch-all은 **마지막 segment에서만** 유효. `src/pages/[...slug]/edit.jsx`처럼 뒤에 segment가 남는 파일은 route table에 넣지 않는다.

### Route 우선순위

segment rank: static(30) > dynamic(20) > catch-all(0)

동일 depth에서 static route가 dynamic route보다 먼저 매칭되어야 한다. `index` 파일은 해당 디렉터리의 exact route를 담당하므로, catch-all은 남은 segment가 하나 이상 있을 때만 매칭한다.

---

## URL 매칭

### Pathname 정규화

1. trailing slash 제거 (`/docs/` → `/docs`, `/` → `/`)
2. `/`로 분리, 빈 문자열 제거

### Segment 매칭

- **static:** decode한 segment가 파일명과 일치
- **dynamic:** decode한 segment를 `params[name]`에 저장
- **catch-all:** 나머지 전부를 문자열 배열로 저장 (빈 remainder → 불일치)

percent encoding이 깨진 segment가 하나라도 있으면 해당 route 전체 불일치.

### 매칭 결과

```js
// 성공
{ component, filePath, isFallback: false, path, route: routeInfo }

// 실패
{ component: fallback404 || null, filePath: null, isFallback: true, path: '404', route }
```

---

## Route Prop 구조

```js
{
  href: '/products/p-1?tab=details&tag=a&tag=b#reviews',
  pathname: '/products/p-1',
  params: { id: 'p-1' },
  query: { tab: 'details', tag: ['a', 'b'] },
}
```

query에서 같은 key가 여러 번이면 배열.

---

## Anchor Click 가로채기

### 리스너 등록

`attach(container)`: container에 **bubbling click listener 하나** 등록. `target.closest('a[href]')` + `container.contains(anchor)` 확인.

### SPA 내비게이션 조건 (모두 만족)

1. `defaultPrevented === false`
2. 왼쪽 클릭 (`button === 0`)
3. modifier key 없음
4. `download` attribute 없음
5. `target`이 없거나 `_self`
6. href가 truthy
7. href가 `#`으로 시작하지 않음
8. same origin
9. `http:` 또는 `https:`

### 클릭 처리

```
1. event.preventDefault()
2. nextHref 생성 (pathname + search + hash)
3. 현재 URL과 같으면 → 종료
4. history.pushState({}, '', nextHref)
5. 현재 URL로 route 재매칭
6. requestRender()
```

### Back/Forward

`popstate` listener:
1. 현재 URL로 route 재매칭
2. `requestRender()`

---

## Teardown

`attach()`가 등록한 두 listener를 `state.routerTeardown`에 저장:

```js
state.routerTeardown = () => {
  window.removeEventListener('popstate', onPopState);
  container.removeEventListener('click', onClick);
  state.routerTeardown = null;
};
```

`AEUI.init()` 시작부와 `resetRuntimeState()`에서 호출.

---

## 오류 처리

### 조용히 무시/fallback

- 함수 아닌 컴포넌트 route → 제외
- 마지막 아닌 catch-all → 제외
- malformed percent encoding → fallback
- 일치 없음 → custom/내장 404

### 예외 전파

- `new URL()` 해석 불가
- 잘못된 container로 `init`
- `history.pushState` platform 예외

렌더 오류는 공통 `tick()`이 로그. 라우터가 error page로 교체하지는 않는다.

---

## 정리와 테스트 기준

- `AEUI.init`을 다시 호출하거나 테스트에서 runtime state를 reset할 때 router listener를 제거해야 한다.
- 내부 링크, 외부 링크, 새 탭, download, modifier-click, middle click을 분리해서 테스트한다.
- route matching은 static, dynamic, catch-all, index vs catch-all, malformed segment, query, fallback, priority를 독립적으로 검증한다.
- 컴포넌트 통합 테스트는 `_layout.jsx`, `route` prop 전달, anchor click, `popstate`를 포함해야 한다.

---

## 관련 코드 위치

- `packages/core/src/router.js`
- `packages/core/src/vite-plugin.js`
- `packages/core/src/app-runtime.js`

## 관련 문서

- 사용자 관점: [user-scenario 05. 라우팅](../user-scenario/05-routing.md)
