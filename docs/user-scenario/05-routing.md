# 05. 라우팅

AEUI는 **파일 이름이 곧 URL**인 디렉터리 기반 라우팅을 제공합니다. 별도의 `Router`나 `Link` 컴포넌트가 필요 없습니다.

---

## 기본 원리

`src/pages/` 디렉토리에 파일을 넣으면, 파일 이름이 자동으로 URL과 연결됩니다:

```
src/pages/
├── index.jsx           → /
├── about.jsx           → /about
├── products/
│   ├── index.jsx       → /products
│   └── [id].jsx        → /products/:id
└── docs/
    └── [...slug].jsx   → /docs/* (모든 하위 경로)
```

---

## 파일명 규칙

| 파일명 형태 | URL | 설명 |
|---|---|---|
| `index.jsx` | `/` | 디렉토리의 기본 페이지 |
| `about.jsx` | `/about` | 정적 경로 |
| `[id].jsx` | `/products/:id` | 동적 파라미터 |
| `[...slug].jsx` | `/docs/*` | 모든 하위 경로 매칭 |
| `_layout.jsx` | — | 전역 레이아웃 (root만) |
| `404.jsx` | — | 404 페이지 (root만) |
| `_anything.jsx` | — | 무시 (private 파일) |

### 규칙 상세

- `_`로 시작하는 **파일**은 라우트에서 제외됩니다. (헬퍼, 유틸 파일로 활용)
- `_`로 시작하는 **디렉토리**는 제외되지 않습니다. (`_admin/settings.jsx` → `/_admin/settings`)
- catch-all (`[...slug]`)은 **마지막 segment에서만** 유효합니다.

---

## 정적 라우트

가장 간단한 형태입니다:

```jsx
// src/pages/about.jsx → /about
export default function AboutPage() {
  return (
    <main>
      <h1>소개</h1>
      <p>AEUI 프레임워크에 대해 알아보세요.</p>
    </main>
  );
}
```

---

## 동적 라우트

파일 이름에 대괄호를 사용하면 동적 파라미터가 됩니다:

```jsx
// src/pages/products/[id].jsx → /products/:id
export default function ProductPage({ route }) {
  return (
    <main>
      <h1>상품 상세</h1>
      <p>상품 ID: {route.params.id}</p>
    </main>
  );
}
```

URL `/products/abc-123`으로 접근하면 `route.params.id`가 `'abc-123'`이 됩니다.

---

## `route` prop

모든 페이지 컴포넌트는 `route` prop을 받습니다:

```jsx
export default function Page({ route }) {
  // route 객체 구조:
  // {
  //   href: '/products/p-1?tab=details#reviews',
  //   pathname: '/products/p-1',
  //   params: { id: 'p-1' },
  //   query: { tab: 'details' },
  // }
}
```

| 필드 | 설명 |
|---|---|
| `href` | 전체 경로 (pathname + query + hash) |
| `pathname` | 경로 부분만 |
| `params` | 동적 파라미터 (`:id` 등) |
| `query` | 쿼리 파라미터 (같은 key가 여러 번이면 배열) |

---

## Catch-All 라우트

하위 경로 전부를 하나의 페이지에서 처리하려면 `[...name]`을 사용합니다:

```jsx
// src/pages/docs/[...slug].jsx → /docs/intro, /docs/api/watch, ...
export default function DocsPage({ route }) {
  // /docs/api/watch 접근 시
  // route.params.slug = ['api', 'watch']
  return <h1>문서: {route.params.slug.join('/')}</h1>;
}
```

catch-all은 **1개 이상의 경로 segment**가 있어야 매칭됩니다. `/docs`만으로는 매칭되지 않으므로, `/docs`를 위한 `index.jsx`를 별도로 만들어야 합니다.

---

## 링크와 네비게이션

AEUI에는 별도의 `Link` 컴포넌트가 없습니다. **일반 `<a>` 태그**를 쓰면 됩니다:

```jsx
<nav>
  <a href="/">홈</a>
  <a href="/about">소개</a>
  <a href="/products/p-1">상품 1</a>
</nav>
```

AEUI가 앱 내부의 `<a>` 클릭을 자동으로 가로채서 **History API를 통한 SPA 네비게이션**으로 처리합니다. 페이지가 다시 로드되지 않습니다.

### SPA 네비게이션이 동작하지 않는 경우

다음 경우에는 브라우저 기본 동작(페이지 새로고침)이 유지됩니다:

- 외부 도메인 링크 (`https://example.com`)
- `target="_blank"` (새 탭)
- Ctrl/Cmd + 클릭 (새 탭)
- `download` 속성이 있는 링크
- `#`으로 시작하는 hash 링크
- `mailto:`, `tel:` 등의 프로토콜

---

## 전역 레이아웃

`src/pages/_layout.jsx`를 만들면 **모든 페이지**를 감싸는 레이아웃이 됩니다:

```jsx
// src/pages/_layout.jsx
export default function Layout({ route, children }) {
  return (
    <div>
      <nav>
        <a href="/">홈</a>
        <a href="/about">소개</a>
      </nav>
      <main>{children}</main>
      <footer>© 2026</footer>
    </div>
  );
}
```

레이아웃도 `route` prop을 받으므로, 현재 경로에 따라 네비게이션 스타일을 바꿀 수 있습니다.

> **제한:** 중첩 레이아웃(디렉토리별 레이아웃)은 지원하지 않습니다. 전역 레이아웃 하나만 사용 가능합니다.

---

## 404 페이지

`src/pages/404.jsx`를 만들면 매칭되는 라우트가 없을 때 이 페이지를 표시합니다:

```jsx
// src/pages/404.jsx
export default function NotFound({ route }) {
  return (
    <main>
      <h1>404</h1>
      <p>페이지를 찾을 수 없습니다: {route.pathname}</p>
      <a href="/">홈으로 돌아가기</a>
    </main>
  );
}
```

`404.jsx`가 없으면 기본 404 메시지가 표시됩니다.

---

## 라우트 우선순위

같은 위치에 여러 종류의 라우트가 있으면, 구체적인 것이 먼저 매칭됩니다:

```
/products/new       ← 정적 라우트 (최우선)
/products/:id       ← 동적 라우트
/products/*rest     ← catch-all (최후순위)
```

---

## 지원하는 파일 확장자

다음 6가지 확장자가 라우트 파일로 인식됩니다:

`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
