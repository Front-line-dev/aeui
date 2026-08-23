# 07. 프로젝트 설정

AEUI 프로젝트의 Vite 플러그인 옵션, 빌드 설정, npm 패키지 구조를 설명합니다.

---

## Vite 플러그인 기본 설정

```js
// vite.config.js
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

옵션 없이 `aeui()`만 호출하면 대부분의 프로젝트에서 충분합니다.

---

## 플러그인 옵션

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `alias` | `'@'` | Vite 경로 별칭 이름. `false`면 비활성화 |
| `aliasDir` | `'src'` | 별칭이 가리킬 디렉토리 |
| `appEntry` | `'src/App.jsx'` | 라우트 파일 없을 때 사용할 앱 진입점 |
| `rootId` | `'root'` | `document.getElementById`에 전달할 id |
| `styles` | `'src/styles.css'` | 자동으로 import할 CSS 파일. `false`면 비활성화 |

### 사용 예시

```js
export default defineConfig({
  plugins: [aeui({
    alias: '~',           // @ 대신 ~ 사용
    aliasDir: 'src',
    rootId: 'app',        // <div id="app"> 사용
    styles: 'src/main.css', // 스타일 파일 경로 변경
  })]
});
```

---

## 경로 별칭 (`@`)

기본적으로 `@`는 `src/` 디렉토리를 가리킵니다:

```jsx
// 이렇게 쓰는 대신
import Header from '../../components/Header';

// 이렇게 쓸 수 있습니다
import Header from '@/components/Header';
```

IDE에서도 경로 힌트를 받으려면 `jsconfig.json`(또는 `tsconfig.json`)을 설정하세요:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

> **참고:** `create-aeui-app`으로 만든 프로젝트에는 이미 설정되어 있습니다.

---

## 모드 자동 선택

Vite 플러그인은 `src/pages/` 디렉토리에 라우트 파일이 있는지에 따라 자동으로 모드를 선택합니다:

### Router Mode

`src/pages/` 안에 `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` 파일이 하나라도 있으면:

- 모든 페이지 파일을 glob으로 수집
- 디렉터리 라우터를 초기화
- 파일명 기반 URL 매핑 적용

### Single-App Mode

`src/pages/` 안에 라우트 파일이 없으면:

- `appEntry` 옵션의 파일을 진입점으로 사용 (기본: `src/App.jsx`)
- `AEUI.init(App, document.getElementById('root'))`로 초기화

---

## HTML 진입점

`index.html`에 `<script>` 태그를 넣을 필요가 없습니다. Vite 플러그인이 자동으로 주입합니다:

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>나의 AEUI 앱</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- ← script 태그 불필요, 자동 주입됨 -->
  </body>
</html>
```

`rootId` 옵션을 변경했다면 `<div id="...">` 부분도 맞춰 수정하세요.

---

## npm 패키지 이름

npm에 배포되는 물리적 이름은 `a-easy-ui`이고, 코드에서 사용하는 이름은 `aeui`입니다. `package.json`에서 npm alias로 연결합니다:

```json
{
  "dependencies": {
    "aeui": "npm:a-easy-ui@^0.0.1"
  }
}
```

`create-aeui-app`으로 만든 프로젝트에는 이미 설정되어 있습니다.

---

## import 경로

AEUI는 세 가지 import 경로를 제공합니다:

| import 경로 | 용도 |
|---|---|
| `aeui` | 앱 코드에서 `AEUI`, `watch`, `clean` 사용 |
| `aeui/vite` | Vite 플러그인 설정 |
| `aeui/babel-plugin` | Babel 직접 설정 시 (Vite 없이 사용할 때) |

```js
// 앱 코드
import { AEUI, watch, clean } from 'aeui';

// Vite 설정
import aeui from 'aeui/vite';

// Babel 직접 설정 (Vite를 사용하지 않을 때)
import aeuiTransform from 'aeui/babel-plugin';
```

> **주의:** `aeui/vite`가 내부적으로 `aeui/babel-plugin`을 포함하므로, Vite 프로젝트에서 두 플러그인을 함께 사용할 필요가 없습니다.

---

## Babel 직접 설정 (Vite 없이)

Vite를 사용하지 않는 프로젝트에서는 Babel을 직접 설정할 수 있습니다:

```js
// babel.config.js
import aeuiTransform from 'aeui/babel-plugin';
import jsxTransform from '@babel/plugin-transform-react-jsx';

export default {
  plugins: [
    aeuiTransform,
    [jsxTransform, {
      pragma: 'AEUI.createElement',
      pragmaFrag: 'AEUI.Fragment',
    }],
  ],
};
```

**순서가 중요합니다:** AEUI 플러그인이 먼저, JSX 변환 플러그인이 뒤에 와야 합니다.

---

## 빌드

```bash
npm run build     # 프로덕션 빌드 (dist/ 폴더에 출력)
npm run preview   # 빌드 결과 미리보기
```

---

## 관련 문서

- 라우팅 규칙 자세히: [05. 라우팅](05-routing.md)
- 내부 빌드 구조: [개발 문서 — Babel 컴파일러](../internal-implement/10-babel-compiler.md)
