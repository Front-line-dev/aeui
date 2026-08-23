# 01. 시작하기

이 문서는 AEUI 프로젝트를 처음부터 만들어 첫 화면을 띄우기까지의 과정을 안내합니다.

---

## 프로젝트 만들기

터미널에서 한 줄이면 됩니다:

```bash
npx create-aeui-app my-app
```

`my-app` 디렉토리가 만들어지고, 그 안에 바로 실행 가능한 AEUI 프로젝트가 구성됩니다.

### 의존성 설치와 실행

```bash
cd my-app
npm install
npm run dev
```

`npm run dev`를 실행하면 Vite 개발 서버가 시작됩니다. 브라우저에서 표시된 URL(보통 `http://localhost:5173`)을 열면 첫 화면을 볼 수 있습니다.

---

## 생성된 프로젝트 구조

```
my-app/
├── .gitignore
├── index.html          ← HTML 진입점
├── jsconfig.json       ← IDE 경로 힌트
├── package.json
├── vite.config.js      ← Vite + AEUI 설정
└── src/
    └── pages/          ← 파일 기반 라우팅
        ├── index.jsx       → /
        ├── about.jsx       → /about
        └── products/
            └── [id].jsx    → /products/:id
```

`src/pages/` 디렉토리 안의 파일이 자동으로 URL과 연결됩니다. 자세한 라우팅 규칙은 [05. 라우팅](05-routing.md)을 참고하세요.

---

## 첫 페이지 작성

`src/pages/index.jsx`를 열어 내용을 바꿔 보세요:

```jsx
export default function HomePage() {
  return (
    <main>
      <h1>안녕하세요!</h1>
      <p>AEUI로 만든 첫 페이지입니다.</p>
    </main>
  );
}
```

저장하면 브라우저가 즉시 갱신됩니다. AEUI 컴포넌트는 JSX를 반환하는 함수입니다. React와 비슷하게 보이지만 동작 원리가 다릅니다 — 자세한 내용은 [02. 컴포넌트](02-components.md)에서 설명합니다.

---

## 컴포넌트는 어떻게 화면에 나타나나?

작성한 컴포넌트가 브라우저에 표시되려면, 누군가가 그 컴포넌트를 HTML 페이지의 실제 DOM 요소에 연결해야 합니다. `create-aeui-app`으로 만든 프로젝트에서는 이 과정이 **자동**입니다.

### `src/pages/`가 있을 때 (기본)

Vite 플러그인이 다음을 자동으로 수행합니다:

1. `index.html`의 `<div id="root">`를 찾고
2. `src/pages/` 안의 파일들을 URL과 연결한 라우터를 만들고
3. 라우터를 `<div id="root">`에 연결합니다

따라서 별도의 코드를 작성할 필요가 없습니다.

### `src/pages/`가 없을 때

라우터 없이 단일 컴포넌트로 앱을 구성하고 싶다면, `src/App.jsx`를 만드세요:

```jsx
// src/App.jsx
export default function App() {
  return <h1>Hello AEUI!</h1>;
}
```

Vite 플러그인이 `App.jsx`를 진입점으로 삼아 `<div id="root">`에 연결합니다.

> **참고:** Vite 플러그인 옵션이나 빌드 설정에 대해서는 [07. 프로젝트 설정](07-project-config.md)을 참고하세요.

---

## 사용 가능한 스크립트

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 시작 (HMR 지원) |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
