# 디렉터리 라우터

`src/router` 디렉터리에 페이지 파일을 만들면 파일 경로가 그대로 URL이 된다. 화면 이동은 HTML에서 쓰던 것처럼 일반 `<a href="/path">` 링크를 사용한다.

## Vite 설정

AEUI 앱은 `aeui/vite` 플러그인을 사용한다.

```javascript
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

`index.html`에는 `#root`만 두면 된다. 별도의 앱 진입 파일을 만들 필요가 없다.

```html
<div id="root"></div>
```

## 라우터 디렉터리

`src/router` 디렉터리가 있으면 AEUI가 파일을 URL로 해석한다.

| 파일 | URL |
| --- | --- |
| `src/router/index.jsx` | `/` |
| `src/router/about.jsx` | `/about` |
| `src/router/products/[id].jsx` | `/products/:id` |
| `src/router/docs/[...slug].jsx` | `/docs/*slug` |
| `src/router/404.jsx` | fallback |
| `src/router/_layout.jsx` | 공통 layout |

`src/router`가 없으면 플러그인은 기존 방식처럼 `src/App.jsx`를 자동으로 부팅한다.

## 페이지 컴포넌트

페이지는 일반 AEUI 컴포넌트다. 컴포넌트 setup은 마운트 시 한 번 실행되고, 반환된 render 함수가 route prop 변경에 맞춰 다시 실행된다.

```jsx
import { AEUI } from 'aeui';

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
