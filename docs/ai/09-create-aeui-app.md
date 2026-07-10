# 09. `create-aeui-app` CLI와 생성 템플릿

이 문서는 `packages/create-aeui-app/index.js`, package manifest, `template/**`의 현재 구현을 그대로 재현하기 위한 명세다. 대화형 도구가 아니라 단일 positional argument를 받는 동기식 파일 복사 CLI다.

## 1. package와 실행 진입점

manifest 계약:

```json
{
  "name": "create-aeui-app",
  "version": "0.0.1",
  "description": "Scaffolding tool for AEUI apps",
  "main": "index.js",
  "bin": {
    "create-aeui-app": "index.js"
  },
  "type": "module",
  "files": [
    "index.js",
    "template"
  ],
  "keywords": [
    "aeui",
    "cli",
    "scaffold"
  ],
  "author": "",
  "license": "ISC"
}
```

`index.js`는 executable bit와 다음 shebang을 가진 ESM 파일이다.

```js
#!/usr/bin/env node
```

외부 dependency, package script, 자체 test script, CLI 자체의 `engines` 선언은 없다. Node built-in `node:fs`, `node:path`, `node:url`만 사용한다.

대표 실행:

```text
npx create-aeui-app my-app
```

## 2. 초기화와 argument 해석

ESM의 현재 파일 위치는 다음 방식으로 구한다.

```js
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const projectName = args[0];
```

argument 처리 순서가 중요하다.

```text
1. args 어디든 "--help" 또는 "-h"가 있으면 usage 출력, exit 0
2. 첫 argument가 없으면 usage 출력, exit 1
3. argument가 2개 이상이면 오류 + usage, exit 1
4. project name 검증
5. 기존 target 검사
6. 생성 시작
```

help 검사가 가장 먼저이므로 `create-aeui-app name --help`도 프로젝트를 만들지 않고 usage만 출력한 뒤 성공 종료한다. `--version`은 지원하지 않는다. 유일한 argument일 때만 이름 검증 단계에서 잘못된 project name으로 처리되고, help가 없는 2개 이상 argument에서는 위치와 무관하게 먼저 argument 개수 오류가 난다.

usage는 stderr에 정확히 두 줄을 쓴다.

```text
Please specify the project name:
  npx create-aeui-app <project-name>
```

두 개 이상 argument일 때는 먼저 다음 줄을 stderr에 쓴 뒤 usage를 쓴다.

```text
Only one project name can be provided.
```

## 3. project name 검증

`isValidPackageName(name)`은 다음 순서로 검사한다.

```js
function isValidPackageName(name) {
  if (typeof name !== 'string') return false;
  if (!name || name.length > 214) return false;
  if (name === 'node_modules' || name === 'favicon.ico') return false;
  if (name.startsWith('.') || name.startsWith('_')) return false;
  if (name.includes('/') || name.includes('\\')) return false;
  return /^[a-z0-9][a-z0-9._-]*$/.test(name);
}
```

허용 규칙:

- 길이 1~214
- 첫 문자는 ASCII lowercase letter 또는 digit
- 이후 문자는 lowercase letter, digit, `.`, `_`, `-`
- path separator 없음
- exact reserved name `node_modules`, `favicon.ico` 아님

예:

| 입력 | 결과 | 이유 |
|---|---|---|
| `my-app` | 허용 | 일반 lowercase npm 이름 |
| `app_2.test` | 허용 | 첫 글자 이후 `_`, `.` 허용 |
| `2-app` | 허용 | digit 시작 허용 |
| `MyApp` | 거부 | uppercase 불허 |
| `-app` | 거부 | 첫 글자 규칙 위반 |
| `.app`, `_app` | 거부 | 명시적 prefix 거부 |
| `scope/app` | 거부 | slash 불허; scoped package 미지원 |
| `한글앱` | 거부 | ASCII 정규식 밖 |
| `node_modules` | 거부 | reserved exact name |

이 검사는 npm의 모든 package-name 정책을 구현한 것이 아니다. 예를 들어 첫 글자 뒤의 연속 dot 같은 형태는 정규식상 허용될 수 있다.

거부 시 stderr:

```text
Invalid project name: <입력>
Use a lowercase npm package name without spaces or path separators.
```

그리고 exit code 1이다.

## 4. target과 기존 경로

경로 계산:

```js
const templateDir = path.join(__dirname, 'template');
const targetDir = path.join(process.cwd(), projectName);
```

project name에서 separator를 금지하므로 target은 현재 작업 디렉터리의 직접 자식이다. target에 file, directory, symlink 등 무엇이든 존재해 `fs.existsSync(targetDir)`가 `true`이면 병합하거나 덮어쓰지 않는다.

stderr와 exit code:

```text
Directory <projectName> already exists.
```

```text
exit 1
```

빈 기존 디렉터리도 재사용하지 않는다.

## 5. 복사 알고리즘

생성 시작 시 stdout:

```text
Creating a new AEUI app in <absolute target path>...
```

그 뒤 target을 `fs.mkdirSync(targetDir, { recursive: true })`로 만든다.

재귀 복사 함수의 정확한 의사코드:

```text
copyDir(src, dest):
  entries = fs.readdirSync(src, { withFileTypes: true })
  fs.mkdirSync(dest, { recursive: true })

  for entry of entries:
    srcPath = path.join(src, entry.name)
    destName = entry.name === "gitignore" ? ".gitignore" : entry.name
    destPath = path.join(dest, destName)

    if entry.isDirectory():
      copyDir(srcPath, destPath)
    else:
      fs.copyFileSync(srcPath, destPath)
```

이름이 정확히 `gitignore`인 entry는 어느 depth에서든 `.gitignore`로 바뀐다. 현재 template에서는 root의 한 파일만 해당한다. directory 이외 entry는 모두 `copyFileSync` 경로로 간다.

복사는 전부 동기식이며 예외를 catch하거나 rollback하지 않는다. mkdir, read, copy, JSON parse/write 중 실패하면 Node 오류가 그대로 전파되고 이미 만든 target이나 복사된 일부 파일은 남는다.

## 6. 생성 package 이름 치환

복사가 끝나면 target의 `package.json`만 다시 읽어 `name`을 바꾼다.

```js
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
pkg.name = projectName;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
```

다른 manifest field는 수정하지 않는다. `JSON.stringify(..., null, 2)` 결과 뒤에 별도 newline을 붙이지 않는다.

성공 시 stdout은 blank line을 포함해 다음 안내를 쓴다.

```text
Done! Now run:

  cd <projectName>
  npm install
  npm run dev
```

CLI는 dependency 설치, Git 초기화, package manager 선택, dev server 실행을 하지 않는다.

## 7. 생성 파일 트리

현재 template의 전체 결과:

```text
<projectName>/
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

`src/App.jsx`, `src/main.*`, `src/styles.css`는 만들지 않는다. `src/pages`가 존재하므로 `aeui/vite`의 directory router branch가 자동 bootstrap을 담당한다.

## 8. 생성 앱 manifest

template 원본의 `name`은 `aeui-app`이지만 CLI가 project name으로 교체한다. 나머지는 다음과 같다.

```json
{
  "name": "<projectName>",
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

물리 package `a-easy-ui`를 local 이름 `aeui`로 설치하므로 framework source와 compiler가 생성하는 `aeui` import가 해석된다.

## 9. Vite와 editor 설정

`vite.config.js`:

```js
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

별도 React plugin이나 Babel config는 없다. `aeui/vite`가 JSX transform, runtime import, virtual entry, router bootstrap, 기본 alias를 모두 제공한다.

`jsconfig.json`:

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

이는 runtime build alias가 아니라 editor/language-service용 mirror다. 실제 Vite alias는 plugin 기본값 `@ -> src`가 만든다.

## 10. HTML entry

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

module script를 일부러 두지 않는다. Vite plugin이 `/@aeui-entry`를 body에 주입하고, 기본 `rootId`인 `root` element에 directory router를 mount한다.

## 11. route page template

### 11.1 `/`: `src/pages/index.jsx`

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

### 11.2 `/about`: `src/pages/about.jsx`

```jsx
export default function AboutPage() {
  return (
    <main>
      <h1>About</h1>
      <p>일반 a 태그로 이동해도 AEUI가 내부 라우팅을 처리합니다.</p>
      <a href="/">Home</a>
    </main>
  );
}
```

### 11.3 `/products/:id`: `src/pages/products/[id].jsx`

```jsx
export default function ProductPage({ route }) {
  return (
    <main>
      <h1>Product {route.params.id}</h1>
      <p>동적 세그먼트는 route.params로 전달됩니다.</p>
      <a href="/">Home</a>
    </main>
  );
}
```

페이지는 `AEUI`를 import하지 않는다. Babel compiler의 import injection이 이를 보완한다. 모든 링크는 일반 `<a>`이며 router의 delegated click 처리에 의존한다.

## 12. `.gitignore`

package 안에서는 npm이 dotfile을 누락하거나 특별 취급하지 않도록 template 파일명이 `gitignore`다. 복사 시 `.gitignore`로 바뀌며 내용은 다음과 같다.

```gitignore
node_modules/
dist/
.DS_Store
*.log
```

## 13. CLI package tarball

`files: ["index.js", "template"]`와 npm의 자동 manifest 포함 규칙으로 현재 dry-run tarball은 다음 10 entry로 구성된다.

```text
index.js
package.json
template/gitignore
template/index.html
template/jsconfig.json
template/package.json
template/vite.config.js
template/src/pages/index.jsx
template/src/pages/about.jsx
template/src/pages/products/[id].jsx
```

template의 `gitignore`가 tarball에서는 아직 dotfile이 아니고, 앱 생성 시에만 바뀌는 점을 보존해야 한다.

## 14. 재구현 시 보존할 경계

- help flag는 위치와 무관하게 다른 모든 검증보다 먼저 처리한다.
- positional project name은 정확히 하나만 허용한다.
- 이름 검사는 lowercase ASCII와 제한된 punctuation만 허용하며 scoped name을 지원하지 않는다.
- 기존 target은 비어 있어도 거부한다.
- copy와 manifest rewrite는 동기식이고 rollback이 없다.
- `gitignore` rename은 copy 함수의 일반 규칙이다.
- package name만 바꾸고 dependency/version/config는 그대로 둔다.
- 생성 앱에는 main entry와 App component가 없고 `src/pages` router를 기본으로 사용한다.
- framework dependency는 npm alias `aeui -> a-easy-ui`다.
- 페이지 소스는 수동 `AEUI` import 없이 JSX를 쓴다.
- CLI는 install, Git init, dev server 실행을 자동화하지 않는다.

## 15. 검증 기준

현재 repository에는 CLI 전용 automated test suite가 없다. 새 문서 우선 적합성 suite를 처음부터 작성할 때 최소한 별도 임시 디렉터리에서 다음을 독립적으로 검증해야 한다.

```text
--help / -h -> stderr usage, exit 0, filesystem 변경 없음
argument 없음 -> exit 1
두 argument -> exit 1
유효/무효 이름 표의 경계값
기존 file 및 기존 directory 거부
생성 tree와 .gitignore rename
package.json name만 치환
npm install 후 npm run build
npm pack --dry-run --workspace create-aeui-app
```
