# 07. 디렉터리 라우터

AEUI의 라우팅은 단순하다: **파일 이름이 곧 URL**이다.

```
src/pages/
├── index.jsx           → /
├── about.jsx           → /about
├── products/
│   ├── index.jsx       → /products
│   └── [id].jsx        → /products/:id
└── docs/
    └── [...slug].jsx   → /docs/* (catch-all)
```

별도의 `Router`, `Link`, `navigate` API가 없다. 일반 `<a href>` 태그를 쓰면 AEUI가 알아서 **History API로 SPA 내비게이션**을 처리한다.

---

## 1. 동작 원리 요약

```
1. aeui/vite가 src/pages의 모든 파일을 eager import
2. AEUI.__runtime.initDirectoryRouter()로 route table 생성
3. 현재 URL에 맞는 페이지 컴포넌트를 찾아 마운트
4. container 안의 <a> 클릭을 가로채 pushState + 리렌더
5. 뒤로/앞으로 → popstate → 리매칭 + 리렌더
```

라우터가 **하지 않는** 것:
- nested layout (root-global layout 하나만 지원)
- imperative navigation API (`navigate()` 등)
- route guard, loader, lazy import
- HTTP status 변경, server routing

---

## 2. Vite 자동 부트스트랩

`aeui/vite`가 `src/pages` 아래에 공식 확장자 파일(`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`)이 하나라도 있으면 router mode로, 없으면 single-app mode로 진입 코드를 만든다.

### router mode 진입 코드 (의미상)

```javascript
import { AEUI } from 'aeui';
const routes = import.meta.glob(
  '/src/pages/**/*.{js,jsx,ts,tsx,mjs,cjs}',
  { eager: true }
);
AEUI.__runtime.initDirectoryRouter(
  routes,
  document.getElementById('root'),
  { rootDir: '/src/pages' }
);
```

### single-app mode 진입 코드 (의미상)

```javascript
import { AEUI } from 'aeui';
import App from '/src/App.jsx';
AEUI.init(App, document.getElementById('root'));
```

> **공식 확장자 6종:** `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` — route 감지, glob, transform, parser가 모두 이 목록을 공유한다.

---

## 3. route table 생성

### 3.1 route module map

`createRouteTable(routeModules, options)`는 Vite glob이 만든 객체를 입력으로 받는다:

```javascript
{
  '/src/pages/index.jsx': { default: HomePage },
  '/src/pages/products/[id].jsx': { default: ProductPage },
}
```

### 3.2 컴포넌트 선택

각 모듈에서 컴포넌트를 고르는 우선순위:

```javascript
const component = mod && (mod.default || mod.Page || mod);
```

선택 결과가 **함수**일 때만 유효하다.

### 3.3 파일 이름 → URL 규칙

| 파일 이름 형태 | 결과 | 예시 |
|---|---|---|
| `index.<ext>` | 마지막 `index` 제거 | `pages/index.jsx` → `/` |
| `[name].<ext>` | 동적 파라미터 `:name` | `products/[id].jsx` → `/products/:id` |
| `[...name].<ext>` | catch-all `*name` | `docs/[...slug].jsx` → `/docs/*slug` |
| `404.<ext>` | global fallback (root만) | `pages/404.jsx` → fallback |
| `_layout.<ext>` | global layout (root만) | `pages/_layout.jsx` → layout |
| `_anything.<ext>` | 일반 route에서 제외 | `pages/_utils.jsx` → 무시 |
| 그 외 | literal static segment | `pages/about.jsx` → `/about` |

**세부 규칙:**
- `_` 제외는 **파일 이름에만** 적용. `_private/page.jsx`는 `/_private/page` route가 됨
- `404`와 `_layout`은 root에서만 인정. `blog/404.jsx`는 fallback이 아님 (route에서도 제외)
- catch-all은 **마지막 segment에서만** 유효. `[...slug]/edit.jsx`는 무시됨

### 3.4 route 우선순위

segment rank: static(30) > dynamic(20) > catch-all(0)

```
/products/new       ← static (먼저 매칭)
/products/:id       ← dynamic
/products/*rest     ← catch-all (마지막)
```

같은 rank의 literal은 알파벳순 정렬하지 않는다 (exact match이므로 불필요).

---

## 4. URL 매칭

### 4.1 pathname 정규화

1. trailing slash 하나 제거 (`/docs/` → `/docs`, `/` → `/`)
2. `/`로 분리하고 빈 문자열 제거

### 4.2 segment 매칭

- **static:** decode한 segment가 파일명과 일치
- **dynamic:** decode한 segment를 `params[name]`에 저장
- **catch-all:** 나머지 전부를 문자열 배열로 저장 (빈 remainder는 불일치)

percent encoding이 깨진 segment가 하나라도 있으면 해당 route 전체가 불일치.

### 4.3 매칭 결과

```javascript
// 성공
{ component, filePath, isFallback: false, path, route: routeInfo }

// 실패 (fallback)
{ component: fallback404 || null, filePath: null, isFallback: true, path: '404', route: ... }
```

---

## 5. page에 전달하는 `route` prop

매칭된 페이지 컴포넌트는 `route` prop을 받는다:

```jsx
export default function ProductPage({ route }) {
  return <h1>Product {route.params.id}</h1>;
}
```

`route` 객체의 구조:

```javascript
{
  href: '/products/p-1?tab=details&tag=a&tag=b#reviews',
  pathname: '/products/p-1',
  params: { id: 'p-1' },
  query: { tab: 'details', tag: ['a', 'b'] },
}
```

| 필드 | 설명 |
|---|---|
| `href` | origin 제외한 pathname + query + hash |
| `pathname` | trailing slash 제거된 경로 |
| `params` | dynamic은 문자열, catch-all은 문자열 배열 |
| `query` | 같은 key가 여러 번이면 배열로 변환 |

---

## 6. layout과 404

### global layout

`src/pages/_layout.jsx`가 있으면, **모든 페이지**를 감싸는 레이아웃으로 사용한다:

```jsx
// _layout.jsx
export default function Layout({ route, children }) {
  return (
    <div>
      <nav>...</nav>
      <main>{children}</main>
    </div>
  );
}
```

layout은 **root-global 하나만** 지원한다. 디렉토리별 중첩 layout은 없다.

### custom 404

`src/pages/404.jsx`가 있으면 fallback 페이지로 사용한다. 없으면 내장 404:

```html
<main>
  <h1>404</h1>
  <p>Page not found: {route.pathname}</p>
</main>
```

---

## 7. anchor click 가로채기

### 리스너 등록

`attach(container)`는 container에 **bubbling `click` listener 하나**를 등록한다.
`target.closest('a[href]')`로 가장 가까운 anchor를 찾고, `container.contains(anchor)`를 확인한다.

### 가로채는 조건

다음을 **모두** 만족할 때만 SPA 내비게이션:

1. `defaultPrevented === false`
2. 왼쪽 클릭 (`button === 0`)
3. modifier key 없음 (meta/alt/ctrl/shift)
4. `download` attribute 없음
5. `target` attribute가 없거나 `_self`
6. href가 truthy
7. href가 `#`으로 시작하지 않음
8. same origin
9. `http:` 또는 `https:` protocol

따라서 외부 링크, 새 탭, 다운로드, hash-only 링크, `mailto:` 등은 **브라우저 기본 동작**을 유지한다.

### 클릭 처리 순서

```
1. event.preventDefault()
2. nextHref 생성 (pathname + search + hash)
3. 현재 URL과 같으면 → 종료
4. history.pushState({}, '', nextHref)
5. 현재 URL로 route 재매칭
6. requestRender() → 다음 프레임에 화면 갱신
```

### back/forward

`popstate` listener:
1. 현재 URL로 route 재매칭
2. `requestRender()` 호출

> **직접 History API 사용 시 주의:** `history.pushState()`만 호출하면 `router.current`가 갱신되지 않는다. `popstate`를 dispatch하는 등 별도 sync가 필요하다.

---

## 8. teardown과 재마운트

`attach()`는 두 listener를 등록한 뒤 `state.routerTeardown`에 정리 함수를 저장한다:

```javascript
state.routerTeardown = () => {
  window.removeEventListener('popstate', onPopState);
  container.removeEventListener('click', onClick);
  state.routerTeardown = null;
};
```

이 함수는 다음 상황에서 호출된다:
- `AEUI.init()` 시작부 (새 앱 마운트 전)
- `resetRuntimeState()` (명시적 reset 시)

`initDirectoryRouter`는 `init()`을 먼저 호출하므로, 기존 라우터의 리스너가 제거된 뒤 새 리스너가 등록된다.

---

## 9. 오류 처리

### 조용히 무시/fallback 처리

- 컴포넌트가 함수가 아닌 route → table에서 제외
- 마지막이 아닌 catch-all → table에서 제외
- 지원 외 확장자 → table에서 제외
- malformed percent encoding → fallback
- 일치 route 없음 → custom/내장 404

### 그대로 예외가 나는 경우

- `new URL()`이 해석할 수 없는 입력
- 잘못된 container로 `init` 호출
- `history.pushState` 등의 platform 예외

페이지/layout의 렌더 오류는 공통 `tick()`이 `[AEUI] Render error:`로 로그한다. 라우터가 별도로 error page로 바꾸거나 fallback route로 재매칭하지는 않는다.

---

## 10. 핵심 규칙 요약

- public router API (`Router`, `Link`, `navigate`)를 제공하지 않음
- route module은 eager glob으로 시작 시 모두 로드 (lazy import 없음)
- `_layout`과 `404`는 root에서만 special, nested는 미지원
- `_` prefix 파일은 제외하지만 `_` 디렉토리는 제외하지 않음
- 우선순위: static > dynamic > catch-all
- catch-all은 1개 이상의 remainder를 요구
- 모든 segment를 decode하고 실패하면 fallback
- layout과 page는 같은 `route` 객체를 받음
- listener closure는 `state.routerTeardown` 하나로 관리
