# 09. `create-aeui-app` CLI

한 줄로 AEUI 프로젝트를 만든다:

```bash
npx create-aeui-app my-app
```

이 명령은 `my-app` 디렉토리를 만들고, 그 안에 Vite + AEUI + 디렉터리 라우터로 구성된 프로젝트를 복사한다. 의존성 설치는 사용자가 직접 수행한다.

---

## 1. CLI 사용법

```
create-aeui-app <project-name>
```

### 인자

| 인자 | 설명 |
|---|---|
| `project-name` | 생성할 디렉토리 이름 (**필수**) |

### 옵션

| 옵션 | 짧은 형태 | 설명 |
|---|---|---|
| `--help` | `-h` | 도움말 출력 후 종료 |

### 이름 검증

프로젝트 이름은 다음 규칙을 모두 만족해야 한다:

- 소문자, 숫자, `-`, `.`, `_`만 허용
- 첫 글자가 `.`이나 `_`로 시작하지 않음
- `node_modules`, `favicon.ico`가 아님
- `/`나 `\`를 포함하지 않음
- 214자 이하
- 정규식: `^[a-z0-9][a-z0-9._-]*$`

이름을 생략하면 도움말을 출력하고 `process.exit(1)`. 인자가 2개 이상이면 오류 출력 후 `process.exit(1)`.

---

## 2. 생성되는 프로젝트 구조

```
my-app/
├── .gitignore
├── index.html
├── jsconfig.json
├── package.json
├── vite.config.js
└── src/
    └── pages/
        ├── index.jsx
        ├── about.jsx
        └── products/
            └── [id].jsx
```

6개 파일, 3개 디렉터리. `src/pages` 구조이므로 Vite plugin이 자동으로 router mode bootstrap을 생성한다.

---

## 3. 각 파일의 내용

### `package.json`

```json
{
  "name": "<project-name>",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "engines": {
    "node": "^20.19.0 || >=22.12.0"
  },
  "dependencies": {
    "aeui": "npm:a-easy-ui@^0.0.1"
  },
  "devDependencies": {
    "vite": "^8.0.0"
  }
}
```

`<project-name>`은 CLI 인자로 전달된 이름이다. `version`은 `0.0.0`으로 고정.

### `index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AEUI Vite Demo</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

- `<script>` 태그가 없다 — Vite plugin이 자동으로 주입
- `id="root"`이 필수

### `vite.config.js`

```js
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

### `jsconfig.json`

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

Vite plugin의 기본 alias `@` → `src`에 대응하는 IDE 경로 힌트.

### `.gitignore`

```
node_modules/
dist/
.DS_Store
*.log
```

> 템플릿에서는 `gitignore`로 저장하고 복사 시 `.gitignore`로 이름을 변경한다 (npm이 `.gitignore`를 tarball에서 제외하기 때문).

### `src/pages/index.jsx`

```jsx
export default function HomePage() {
  return (
    <main>
      <h1>AEUI App</h1>
      <p>src/pages 디렉터리의 파일이 URL이 됩니다.</p>
      <nav>
        <a href="/about">About</a>
        <a href="/products/sample">Sample Product</a>
      </nav>
    </main>
  );
}
```

`about.jsx`와 `products/[id].jsx`도 포함되어 정적, 동적 라우트의 작동 예시를 보여준다.

---

## 4. CLI 실행 순서

```
1. 인자 파싱

2. --help 또는 -h이면 도움말 출력 후 exit(0)

3. 이름이 없으면 도움말 + exit(1)

4. 인자가 2개 이상이면 오류 + exit(1)

5. 이름 검증
   → 실패: 오류 + exit(1)

6. 대상 디렉토리 확인
   → 이미 존재하면 오류 + exit(1)
   → 없으면 생성

7. template/ 디렉토리를 대상에 재귀 복사
   → 디렉토리는 생성
   → 파일은 복사
   → 이름이 정확히 'gitignore'이면 '.gitignore'로 변경

8. package.json의 name 필드를 프로젝트 이름으로 수정

9. 사용법 안내 출력:
   cd <project-name>
   npm install
   npm run dev
```

> **자동 설치하지 않는다.** 의존성 설치는 사용자에게 안내만 한다.

### 디렉토리 복사

`copyDir(src, dest)` — 재귀적으로:
- 디렉토리면 `mkdirSync({ recursive: true })`
- 파일이면 `copyFileSync`
- 이름이 `gitignore`이면 dest에서 `.gitignore`로 변경

---

## 5. 오류 처리

| 상황 | 동작 |
|---|---|
| 이름 생략 | 도움말 + `process.exit(1)` |
| 인자 초과 | 오류 메시지 + `process.exit(1)` |
| 이름 검증 실패 | 오류 메시지 + `process.exit(1)` |
| 디렉토리 이미 존재 | 오류 메시지 + `process.exit(1)` |
| 디렉토리 생성 실패 | 플랫폼 예외 전파 |
| 파일 복사 실패 | 플랫폼 예외 전파 |

---

## 6. package manifest (`packages/create-aeui-app/package.json`)

```json
{
  "name": "create-aeui-app",
  "version": "0.0.1",
  "description": "Create a new AEUI project",
  "bin": "index.js",
  "files": ["index.js", "template"],
  "type": "module"
}
```

- `bin`이 `index.js`를 직접 가리킴
- tarball에는 `index.js`와 `template/` 전체가 포함

---

## 7. 핵심 규칙 요약

- 프로젝트 이름은 **필수** (기본값 없음)
- 이미 존재하는 디렉토리에는 생성 거부
- npm alias로 `aeui` → `a-easy-ui` 연결
- HTML에 script 태그 없음 (Vite plugin이 주입)
- 템플릿은 `src/pages` 기반 라우터 구조
- `gitignore` → `.gitignore` 이름 변경
- 의존성 자동 설치 없음 (안내만 출력)
- `index.js`는 named export 없이 top-level 실행
