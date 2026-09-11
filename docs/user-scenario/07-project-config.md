# 07. 프로젝트 설정

Vite로 AEUI 앱을 실행하고 배포용 파일을 만드는 방법입니다. 기본 설정으로 실행한 뒤, 필요한 경우 앱의 시작 파일이나 화면을 표시할 HTML 요소를 바꿀 수 있습니다.

---

## Vite 플러그인 기본 설정

Vite의 `aeui()` 플러그인은 컴포넌트와 JSX를 JavaScript로 변환하고, 앱을 실행할 시작 코드를 추가합니다. `create-aeui-app`으로 만든 프로젝트에는 설정이 들어 있습니다. 수동으로 구성한다면 [npm alias 설정](#npm-패키지-이름)에 따라 `aeui` 의존성을 추가하고 아래 `vite.config.js`를 작성합니다.

Node.js `^22.12.0 || >=24.0.0`과 Vite 8.2.2 이상 8.x를 사용합니다.

```js
// vite.config.js
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

옵션 없이 `aeui()`만 호출하면 SWC로 컴포넌트와 JSX를 변환합니다. Babel 변환은 `aeui({ compiler: 'babel' })`로 선택할 수 있습니다.

`npm run dev`로 개발 서버를 시작하고 표시된 주소에 접속합니다. 시작 화면은 다음 HTML 진입점과 파일 구조에 따라 결정됩니다.

---

## HTML 진입점

`index.html`의 root 요소는 앱이 표시될 위치입니다. Vite 플러그인이 시작 코드를 불러올 `<script>` 태그를 추가하므로 직접 작성할 필요가 없습니다:

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

`src/main.jsx`를 모듈 script로 지정한 앱은 해당 파일에서 직접 앱을 시작합니다. 이 경우에는 플러그인이 자동 시작 코드를 추가하지 않습니다.

---

## 모드 자동 선택

Vite 플러그인은 `src/pages/` 디렉토리에 라우트 파일이 있는지에 따라 자동으로 모드를 선택합니다:

### Router Mode

`src/pages/` 안에 `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` 라우트 파일이 있으면 파일 이름을 URL에 연결합니다. 예를 들어 `src/pages/index.jsx`는 `/`, `src/pages/about.jsx`는 `/about`에 표시됩니다. URL에 맞는 페이지가 HTML의 root 요소에 마운트됩니다.

### Single-App Mode

라우트 파일이 없으면 `appEntry`가 가리키는 컴포넌트를 root 요소에 마운트합니다. 기본값은 `src/App.jsx`입니다. 한 화면으로 앱을 시작하려면 이 파일에서 컴포넌트를 default export합니다.

파일 기반 라우팅의 자세한 규칙은 [05. 라우팅](05-routing.md)에 있습니다.

---

## import 경로

AEUI는 다음 import 경로를 제공합니다:

| import 경로 | 용도 |
|---|---|
| `aeui` | 앱 코드에서 `AEUI`, `watch`, `clean` 사용 |
| `aeui/vite` | Vite 플러그인 설정 |

```js
// 앱 코드
import { AEUI, watch, clean } from 'aeui';

// Vite 설정
import aeui from 'aeui/vite';
```

`aeui/vite`는 컴포넌트와 JSX 변환을 설정합니다. JSX를 작성하기 위한 import는 자동으로 추가되며, 코드에서 직접 사용하는 API는 import합니다.

---

## 경로 별칭 (`@`)

폴더가 깊어지면 상대 import 경로가 길어집니다. `@` 별칭은 `src/` 디렉토리를 기준으로 경로를 작성하게 합니다:

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

## 빌드

개발 서버에서 확인한 앱을 배포할 파일로 만들고, 그 결과를 미리 봅니다.

```bash
npm run build     # 프로덕션 빌드 (dist/ 폴더에 출력)
npm run preview   # 빌드 결과 미리보기
```

`preview`가 표시한 주소에서 시작 화면과 페이지 이동을 확인합니다. 개발 서버와 별도로 빌드 결과가 실행되는지 확인하는 단계입니다.

---

## 플러그인 옵션

기본 파일 위치나 root 요소를 바꿀 때 필요한 옵션만 지정합니다.

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `compiler` | `'swc'` | 컴포넌트 변환기. `'swc'` 또는 `'babel'` |
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

## npm 패키지 이름

npm에 배포되는 물리적 이름은 `a-easy-ui`이고, 코드에서 사용하는 이름은 `aeui`입니다. `package.json`에서 npm alias로 연결합니다:

```json
{
  "dependencies": {
    "aeui": "npm:a-easy-ui@0.1.0-alpha.1"
  }
}
```

`create-aeui-app`으로 만든 프로젝트에는 이미 설정되어 있습니다.

---

## 관련 문서

- 라우팅 규칙 자세히: [05. 라우팅](05-routing.md)
- JSX import와 변환 옵션 이해: [JSX runtime 튜토리얼](../tutorial/jsx-runtime.md)
- Vite 외의 빌드 구성: [Babel과 SWC 직접 설정하기](../tutorial/compiler-setup.md)
- TSX 타입 검사: [TypeScript JSX 설정하기](../tutorial/typescript-jsx.md)
