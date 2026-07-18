# 09. `create-aeui-app` CLI

한 줄로 AEUI 프로젝트를 만든다:

```bash
npx create-aeui-app my-app
```

이 명령은 `my-app` 디렉토리를 만들고, 그 안에 Vite + AEUI로 구성된 프로젝트를 복사한 뒤 의존성을 설치한다.

---

## 1. CLI 사용법

```
create-aeui-app [options] [project-name]
```

### 인자

| 인자 | 설명 |
|---|---|
| `project-name` | 생성할 디렉토리 이름 (기본: `aeui-app`) |

### 옵션

| 옵션 | 짧은 형태 | 설명 |
|---|---|---|
| `--help` | `-h` | 도움말 출력 후 종료 |
| `--no-install` | | 의존성 설치 건너뛰기 |

### 이름 검증

프로젝트 이름은 npm 패키지 이름 규칙을 따른다:

- 소문자, 숫자, `-`, `.`만 허용
- 비어 있으면 기본값 `aeui-app`

검증 실패 시 오류 출력 후 `process.exit(1)`.

---

## 2. 생성되는 프로젝트 구조

```
my-app/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── App.jsx
    └── styles.css
```

5개 파일, 1개 디렉토리.

---

## 3. 각 파일의 내용

### `package.json`

```json
{
  "name": "<project-name>",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "aeui": "npm:a-easy-ui@latest"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

`<project-name>`은 CLI 인자로 전달된 이름이다.

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AEUI App</title>
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

### `src/App.jsx`

```jsx
import { AEUI, watch, clean } from 'aeui';

export default function App() {
  let count = 0;

  return (
    <div>
      <h1>AEUI</h1>
      <button onClick={() => count++}>
        count: {count}
      </button>
    </div>
  );
}
```

### `src/styles.css`

```css
:root {
  font-family: Inter, system-ui, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color: #213547;
  background-color: #ffffff;
}
```

---

## 4. CLI 실행 순서

```
1. 인자/옵션 파싱

2. --help이면 도움말 출력 후 종료

3. 이름 검증
   → 실패: 오류 + exit(1)
   → 비어 있음: 'aeui-app' 사용

4. 대상 디렉토리 확인
   → 없으면 생성
   → 있으면 기존 내용 유지 (비우지 않음)

5. template/ 디렉토리를 대상에 재귀 복사
   → 디렉토리는 생성
   → 파일은 복사

6. package.json의 name 필드를 프로젝트 이름으로 수정

7. --no-install이 아니면
   → 대상 디렉토리에서 npm install 실행

8. 사용법 안내 출력
```

### 디렉토리 복사

`copyDir(src, dest)` — 재귀적으로:
- 디렉토리면 `mkdirSync({ recursive: true })`
- 파일이면 `copyFileSync`

이미 같은 이름의 파일이 있으면 **덮어쓴다** (확인 없음).

---

## 5. 오류 처리

| 상황 | 동작 |
|---|---|
| 이름 검증 실패 | 오류 메시지 + `process.exit(1)` |
| 디렉토리 생성 실패 | 플랫폼 예외 전파 |
| 파일 복사 실패 | 플랫폼 예외 전파 |
| `npm install` 실패 | child process 예외 전파 |

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

- 기본 프로젝트 이름: `aeui-app`
- npm alias로 `aeui` → `a-easy-ui` 연결
- HTML에 script 태그 없음 (Vite plugin이 주입)
- 기존 디렉토리는 비우지 않고 파일을 덮어씀
- `index.js`는 named export 없이 top-level 실행
