# 디렉터리 라우터

`src/pages` 디렉터리에 페이지 파일을 만들면 파일 경로가 그대로 URL이 된다. 화면 이동은 HTML에서 쓰던 것처럼 일반 `<a href="/path">` 링크를 사용한다.

## Vite 설정

AEUI 앱은 `aeui/vite` 플러그인을 사용한다.

```javascript
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

플러그인은 기본으로 `@` alias를 `src`에 연결하고, JSX에 필요한 `AEUI` import를 자동으로 주입한다. 페이지 파일에는 라우트 컴포넌트만 작성하면 된다.

`index.html`에는 `#root`만 두면 된다. 별도의 앱 진입 파일을 만들 필요가 없다.

```html
<div id="root"></div>
```

## 라우터 디렉터리

`src/pages` 디렉터리가 있으면 AEUI가 파일을 URL로 해석한다. 새 프로젝트는 Next.js처럼 `pages` 디렉터리를 사용한다.

라우트 파일 확장자는 `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`를 지원한다. JSX를 쓰는 파일은 Vite 플러그인이 AEUI Babel 플러그인과 JSX transform을 먼저 적용하고, TypeScript 문법은 이후 Vite 파이프라인이 처리한다.

| 파일 | URL |
| --- | --- |
| `src/pages/index.jsx` | `/` |
| `src/pages/about.jsx` | `/about` |
| `src/pages/products/[id].jsx` | `/products/:id` |
| `src/pages/docs/[...slug].jsx` | `/docs/*slug` |
| `src/pages/404.jsx` | fallback |
| `src/pages/_layout.jsx` | 공통 layout |

`[...slug].jsx` 같은 catch-all 페이지는 route의 마지막 segment로만 사용한다. 뒤에 하나 이상의 path segment가 있을 때 매칭된다. 예를 들어 `src/pages/docs/[...slug].jsx`는 `/docs/core/router`를 처리하고, `/docs` 화면은 `src/pages/docs/index.jsx`에 작성한다.

`src/pages`가 없으면 플러그인은 기존 방식처럼 `src/App.jsx`를 자동으로 부팅한다.

## 페이지 컴포넌트

페이지는 일반 AEUI 컴포넌트다. 컴포넌트 setup은 마운트 시 한 번 실행되고, 반환된 render 함수가 route prop 변경에 맞춰 다시 실행된다.

```jsx
export default function ProductPage({ route }) {
  return (
    <main>
      <h1>Product {route.params.id}</h1>
      <a href="/">Home</a>
    </main>
  );
}
```

페이지에는 `route` prop만 전달한다.

- `route.pathname`: 현재 path
- `route.href`: path, query, hash를 포함한 현재 href
- `route.params`: 동적 세그먼트 값
- `route.query`: query string 값

## 링크 이동

내부 이동은 일반 `<a href="/path">`를 사용한다. 같은 사이트 안의 링크는 새로고침 없이 페이지가 전환된다.

다음 링크는 브라우저 기본 동작을 유지한다.

- 외부 origin 링크
- `target="_blank"` 같은 새 browsing context 링크
- `download` 링크
- Cmd/Ctrl/Shift/Alt 클릭
- middle click

AEUI 전용 링크 컴포넌트를 따로 배울 필요 없이 HTML 링크를 그대로 쓰면 된다.
