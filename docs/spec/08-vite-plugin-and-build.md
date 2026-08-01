# 08. Vite 플러그인, 타입, 빌드와 패키지

이 장은 AEUI 프로젝트의 **빌드 도구 설정**을 다룬다: Vite 플러그인 옵션, npm 패키지 구조, TypeScript 타입, 빌드 산출물.

---

## 1. npm 패키지 이름과 alias

npm에 배포되는 물리 이름은 `a-easy-ui`이고, 소스와 생성 코드에서 사용하는 module specifier는 `aeui`다. 소비 앱은 **npm alias**로 이 이름을 연결한다:

```json
{
  "dependencies": {
    "aeui": "npm:a-easy-ui@^0.0.1"
  }
}
```

따라서 `import { AEUI } from 'aeui'`가 실제로는 `a-easy-ui` 패키지를 가져온다.

---

## 2. Vite 플러그인 설정

```js
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]  // 옵션 없이 기본값으로 충분
});
```

### 플러그인 옵션

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `alias` | `'@'` | Vite resolve alias 이름. `false`이면 비활성화 |
| `aliasDir` | `'src'` | alias가 가리킬 경로 |
| `appEntry` | `'src/App.jsx'` | route 파일이 없을 때 import할 앱 |
| `rootId` | `'root'` | `document.getElementById`에 전달할 id |
| `styles` | `'src/styles.css'` | 존재할 때만 import할 스타일. `false`이면 비활성화 |

플러그인 이름은 `aeui:vite`, 실행 순서는 `enforce: 'pre'`.

### alias 설정

`config` hook에서 사용자가 같은 alias를 이미 선언하지 않은 경우에만 추가한다:

```
@ → <project-root>/src (기본)
```

> **라우트 디렉토리 옵션은 없다.** 항상 `src/pages`가 고정이다.

---

## 3. HTML entry 자동 주입

`transformIndexHtml` hook이 `<script type="module" src="/@aeui-entry">` 를 body에 주입한다.

**주입하지 않는 경우:**
- `virtual:aeui-entry` 또는 `/@aeui-entry`가 이미 HTML에 있음
- `src/main.*` 형태의 수동 module script가 있음

수동 main 감지는 실제 `<script>` 태그의 `type="module"` attribute를 가진 것만 대상으로 하며, `src` attribute에서 query/hash를 제거한 후 `src/main.<확장자>` 패턴과 대소문자 무시로 비교한다. `data-src`, HTML 주석, 일반 문자열 내의 경로는 module script로 판정하지 않는다.

### virtual module 해석

```
virtual:aeui-entry  →  \0virtual:aeui-entry
/@aeui-entry        →  \0virtual:aeui-entry
```

`load`는 resolved id에 맞는 bootstrap 소스를 반환한다.

---

## 4. router mode 선택

`src/pages` 아래에 공식 6종 확장자 파일이 하나라도 있으면 → **router mode**
없으면 → **single-app mode**

### router mode bootstrap

```js
import { AEUI } from 'aeui';
const routes = import.meta.glob(
  '/src/pages/**/*.{js,jsx,ts,tsx,mjs,cjs}',
  { eager: true }
);
AEUI.__runtime.initDirectoryRouter(
  routes,
  document.getElementById('root'),
  { rootDir: '/src/pages' }
);
```

### single-app mode bootstrap

```js
import { AEUI } from 'aeui';
import App from '/src/App.jsx';
AEUI.init(App, document.getElementById('root'));
```

---

## 5. source transform

### 대상 판별

- 공식 6종 확장자(`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`) 중 하나
- `/node_modules/`를 포함하지 않음
- route 디렉토리에 한정하지 않고 **프로젝트 전역** 변환

### Babel 호출 순서

```js
const result = await transformAsync(code, {
  babelrc: false,
  configFile: false,
  filename: filePath,
  parserOpts: { plugins: createParserPlugins(filePath) },
  plugins: [
    aeuiTransform,                     // 1. AEUI 변환
    [jsxTransform, {                   // 2. JSX → createElement
      pragma: 'AEUI.createElement',
      pragmaFrag: 'AEUI.Fragment',
    }],
  ],
  sourceMaps: true,
});
```

### parser 선택

| 확장자 | parser plugins |
|---|---|
| `.tsx` | `'jsx'`, `['typescript', { isTSX: true }]` |
| `.ts` | `['typescript', { isTSX: false }]` |
| `.jsx` | `'jsx'` |
| `.js`, `.mjs`, `.cjs` | JSX transform이 제공하는 syntax 지원 |

> 별도 TypeScript strip plugin은 없다. 변환 후 남은 TypeScript syntax의 제거는 Vite pipeline이 담당한다.

---

## 6. npm export map

| subpath | types | ESM | CJS |
|---|---|---|---|
| `.` (root) | `./types/index.d.ts` | `./dist/aeui.esm.js` | `./dist/aeui.cjs` |
| `./babel-plugin` | `./types/babel-plugin.d.ts` | `./dist/babel-plugin.js` | `./dist/babel-plugin.cjs` |
| `./vite` | `./types/vite.d.ts` | `./dist/vite-plugin.js` | `./dist/vite-plugin.cjs` |

legacy root fields:

```json
{
  "main": "dist/aeui.cjs",
  "module": "dist/aeui.esm.js",
  "types": "types/index.d.ts"
}
```

`exports`에 없는 subpath(예: `aeui/src/...`)로는 불러올 수 없다.

---

## 7. TypeScript 타입 선언

### runtime types (`types/index.d.ts`)

핵심 타입: `Renderable`, `Component`, `RenderFunction`, `VNode`, `AeuiApp`

두 JSX namespace를 선언한다:
- `declare global { namespace JSX { ... } }`
- `export declare namespace AEUI { namespace JSX { ... } }`

각각 `Element`, `ElementAttributesProperty`, `ElementChildrenAttribute`, `IntrinsicElements`를 포함. intrinsic prop은 전부 열려있고 React 타입을 import하지 않는다.

### plugin types

```ts
// types/babel-plugin.d.ts
export default function aeuiTransform(api: { types: unknown }): unknown;

// types/vite.d.ts
export default function aeui(options?: AeuiViteOptions): unknown;
```

반환 타입은 `unknown` — Babel/Vite 패키지 타입에 결합하지 않는다.

### typecheck

`tsconfig.types.json`: strict mode, ES2020, NodeNext, `types/**/*.d.ts`와 `type-tests/**/*.ts`만 검사, emit 없음.

---

## 8. Rollup 빌드

세 독립 build의 배열:

### runtime library

```
input: src/index.js
outputs:
  dist/aeui.cjs      (format: cjs, exports: named, sourcemap: true)
  dist/aeui.esm.js    (format: es, sourcemap: true)
```

CJS의 top-level export: `AEUI`, `watch`, `clean`

### Babel plugin

```
input: src/babel-plugin.js
outputs:
  dist/babel-plugin.cjs   (format: cjs, exports: default, sourcemap: true)
  dist/babel-plugin.js     (format: es, sourcemap: true)
```

CJS `exports: 'default'` → `require('aeui/babel-plugin')` 결과가 **함수 자체**.

### Vite plugin

```
input: src/vite-plugin.js
external: @babel/core, @babel/plugin-transform-react-jsx
outputs:
  dist/vite-plugin.cjs   (format: cjs, exports: default, sourcemap: true)
  dist/vite-plugin.js     (format: es, sourcemap: true)
```

두 Babel 패키지는 external로 남으며 `dependencies`에 선언.

---

## 9. tarball 포함 파일

```json
"files": [
  "dist/aeui.cjs", "dist/aeui.cjs.map",
  "dist/aeui.esm.js", "dist/aeui.esm.js.map",
  "dist/babel-plugin.cjs", "dist/babel-plugin.cjs.map",
  "dist/babel-plugin.js", "dist/babel-plugin.js.map",
  "dist/vite-plugin.cjs", "dist/vite-plugin.cjs.map",
  "dist/vite-plugin.js", "dist/vite-plugin.js.map",
  "src",
  "types"
]
```

12개 dist 파일 + 전체 `src` + 3개 `.d.ts` + `package.json` (자동 포함)

---

## 10. monorepo scripts

### 루트 workspace

```json
{
  "name": "aeui-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "npm --prefix example/test test",
    "build": "npm run build:core && npm run build:examples",
    "build:core": "npm --workspace a-easy-ui run build",
    "build:examples": "npm --prefix example/vite-demo run build && npm --prefix example/deep-compare-test run build && npm --prefix example/commerce-admin run build",
    "typecheck": "npm --workspace a-easy-ui run typecheck",
    "pack:core": "npm pack --dry-run --workspace a-easy-ui --cache .npm"
  }
}
```

### core package

```json
{
  "scripts": {
    "build": "rollup -c",
    "prepublishOnly": "npm run build",
    "test": "npm --prefix ../../example/test test",
    "typecheck": "tsc -p tsconfig.types.json --noEmit"
  },
  "dependencies": {
    "@babel/core": "^7.23.0",
    "@babel/plugin-transform-react-jsx": "^7.23.0"
  }
}
```

---

## 11. 핵심 규칙 요약

- Vite plugin: `name: 'aeui:vite'`, `enforce: 'pre'`
- alias는 기존 config를 덮어쓰지 않음
- route 유무에 따라 router/App bootstrap 자동 선택
- 공식 6종 확장자만 통일된 목록으로 지원
- transform은 프로젝트 전역 (route 파일에 한정 안 됨)
- AEUI Babel plugin → classic JSX plugin 순서
- npm 물리 이름 `a-easy-ui`, module specifier `aeui`
- root CJS는 named exports, plugin CJS는 default export
