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

## AEUI 앱의 기본 구조

### import

AEUI에서 사용하는 것은 **세 가지**뿐입니다:

```js
import { AEUI, watch, clean } from 'aeui';
```

| 이름 | 역할 |
|---|---|
| `AEUI` | 앱 초기화, VNode 생성, 화면 갱신 |
| `watch` | 특정 값이 바뀌었을 때 실행할 콜백 등록 |
| `clean` | 컴포넌트가 제거될 때 실행할 정리 작업 등록 |

> **팁:** JSX를 사용하면 `AEUI`는 자동으로 import됩니다. `watch`와 `clean`은 필요할 때만 가져오세요.

### 컴포넌트 작성

AEUI의 컴포넌트는 JSX를 반환하는 함수입니다:

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

React와 비슷하게 보이지만, 동작 원리는 다릅니다. 자세한 내용은 [02. 컴포넌트](02-components.md)에서 설명합니다.

### 앱 초기화

`src/pages/` 디렉토리를 사용하면 앱 초기화는 **자동**입니다. Vite 플러그인이 알아서 처리합니다.

만약 라우터 없이 단일 앱을 만들고 싶다면, `src/App.jsx`를 만들고 수동으로 초기화할 수 있습니다:

```jsx
// src/App.jsx
export default function App() {
  return <h1>Hello AEUI!</h1>;
}
```

이 경우 `src/pages/` 디렉토리가 없으면 Vite 플러그인이 자동으로 `App.jsx`를 진입점으로 사용합니다.

---

## vite.config.js

생성된 프로젝트의 Vite 설정은 간단합니다:

```js
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

`aeui()` 플러그인이 다음을 자동으로 처리합니다:
- AEUI Babel 변환과 JSX 변환
- 앱 부트스트랩 코드 생성
- 디렉터리 라우팅 설정
- `@` 경로 별칭 (`@ → src/`)

설정 옵션에 대한 자세한 내용은 [07. 프로젝트 설정](07-project-config.md)을 참고하세요.

---

## 사용 가능한 스크립트

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 시작 (HMR 지원) |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |

---

## 다음 단계

→ [02. 컴포넌트](02-components.md)에서 AEUI 컴포넌트의 작성법을 배워보세요.
