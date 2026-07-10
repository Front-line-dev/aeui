# 08. Vite 플러그인, 타입, 빌드와 패키지 계약

이 문서는 `packages/core/src/vite-plugin.js`, `packages/core/rollup.config.js`, `packages/core/package.json`, `packages/core/types/**`의 목표 계약과 현재 구현을 함께 설명한다. Vite hook 순서부터 npm export map과 tarball 포함 파일까지 하나의 배포 계약으로 다룬다. 상태는 **현재 구현**, **계획 기능**, **수정 필요**로 구분한다. **수정 필요**로 표시한 현재 동작은 재구현 시 보존하지 않고 목표 계약에 맞게 고쳐야 한다.

## 1. 공개 진입점과 패키지 이름

실제 npm package manifest의 이름은 `a-easy-ui`이고 현재 버전은 `0.0.1`, module type은 `module`이다. 그러나 소스와 생성 코드의 module specifier는 `aeui`다. 소비 앱은 npm alias로 이 이름을 제공한다.

```json
{
  "dependencies": {
    "aeui": "npm:a-easy-ui@^0.0.1"
  }
}
```

따라서 아래 세 import와 컴파일러/가상 엔트리가 생성하는 import는 모두 소비 앱의 `aeui` alias를 기준으로 한다.

```js
import { AEUI, watch, clean } from 'aeui';
import aeuiTransform from 'aeui/babel-plugin';
import aeui from 'aeui/vite';
```

## 2. Vite 플러그인 상수와 공식 확장자

목표 계약의 개념 상수는 다음과 같다. 공식 source/route 확장자는 하나의 목록으로 선언하고 detector, eager glob, transform filter, parser 선택과 runtime route parser가 이 목록을 공유해야 한다.

```js
const VIRTUAL_ENTRY_ID = 'virtual:aeui-entry';
const PUBLIC_ENTRY_PATH = '/@aeui-entry';
const RESOLVED_VIRTUAL_ENTRY_ID = '\0virtual:aeui-entry';
const SUPPORTED_SOURCE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
const ROUTE_EXT_RE = /\.(?:js|jsx|ts|tsx|mjs|cjs)$/;
const ROUTE_GLOB_EXTENSIONS = SUPPORTED_SOURCE_EXTENSIONS.join(',');
const DEFAULT_ROUTER_DIR = 'src/pages';
const DEFAULT_ALIAS = '@';
const DEFAULT_ALIAS_DIR = 'src';
```

현재 소스의 `ROUTE_EXT_RE = /\.[cm]?[jt]sx?$/`는 이 목표 계약보다 넓다. 그 결과 생기는 detector/glob/parser 불일치는 7절의 **수정 필요** 항목이다. 넓은 정규식은 보존 대상이 아니다.

`normalizePath(value)`는 `String(value || '')`의 모든 backslash를 slash로 바꾼다.

## 3. 플러그인 팩토리와 옵션

```js
export default function aeui(options = {}) {
  let root = process.cwd();
  return {
    name: 'aeui:vite',
    enforce: 'pre',
    // hooks
  };
}
```

공개 타입과 실제 기본값은 다음과 같다.

```ts
export interface AeuiViteOptions {
  alias?: string | false;
  aliasDir?: string;
  appEntry?: string;
  rootId?: string;
  styles?: string | false;
}

export default function aeui(options?: AeuiViteOptions): unknown;
```

| 옵션 | 기본값 | 정확한 처리 |
|---|---|---|
| `alias` | `'@'` | `undefined`일 때만 기본값. `false`, 빈 문자열, 문자열이 아닌 값은 alias 미생성 |
| `aliasDir` | `'src'` | `options.aliasDir || 'src'`; 빈 문자열도 기본값 사용 |
| `appEntry` | `'src/App.jsx'` | `options.appEntry || default` |
| `rootId` | `'root'` | `options.rootId || default` |
| `styles` | `'src/styles.css'` | 정확히 `false`면 비활성화, 그 외 falsy는 기본값 |

라우트 디렉터리 옵션은 없고 `src/pages`가 고정이다. 내부 `root`는 생성 시 `process.cwd()`이며 `configResolved(config)`에서 `config.root`로 교체된다.

## 4. `config`: 기본 alias

`hasAlias(config, find)`의 규칙:

- `config.resolve.alias`가 없으면 `false`
- 배열이면 `entry && entry.find === find` 검사
- 객체이면 `Object.prototype.hasOwnProperty.call(alias, find)` 검사

배열 entry의 정규식 `find`를 문자열 alias에 적용하지 않고 strict equality만 쓴다.

```text
aliasName = options.alias가 undefined이면 "@", 아니면 options.alias
if aliasName === false: null
if aliasName이 비어 있지 않은 string이 아님: null
if 동일 alias가 이미 있음: null

aliasDir = options.aliasDir || "src"
rootDir = path.resolve(process.cwd(), config.root || ".")
replacement = path.resolve(rootDir, aliasDir)

return { resolve: { alias: { [aliasName]: replacement } } }
```

기존 alias는 덮어쓰지 않는다. 반환값은 Vite가 merge할 partial config다.

## 5. `transformIndexHtml`: 숨은 앱 엔트리

hook은 `{ order: 'pre', handler }` object form이다.

### 5.1 attribute와 수동 main 판별

`getHtmlAttribute(tag, name)`은 대소문자 구분 없이 다음 경계를 요구한다.

```text
(문자열 시작 | whitespace | '<') + name + optional spaces + '='
+ double-quoted | single-quoted | unquoted value
```

이 경계 때문에 `data-src`, `data-type`은 `src`, `type`으로 오인되지 않는다.

HTML에서 `/<script\b[^>]*>/gi`로 opening tag를 수집한다. `type`이 소문자 변환 후 정확히 `module`이고 `src`가 다음 절차를 통과하면 수동 엔트리다.

```text
1. backslash -> slash
2. 첫 '?' 뒤 제거
3. 그 결과에서 첫 '#' 뒤 제거
4. 앞의 './' 하나 제거
5. /(^|\/)src\/main\.[^/]+$/i 검사
```

attribute 순서, `/base/` prefix, query/hash는 무관하며 확장자 문자열은 제한하지 않는다. `type="module"`은 명시되어야 한다.

### 5.2 주입 규칙

목표 계약은 internal id와 public path를 모두 기존 AEUI entry로 감지한다.

```text
if hasExistingAeuiEntry(html) OR hasManualModuleEntry(html):
  원래 html string 반환

그 외:
  {
    html,
    tags: [{
      tag: "script",
      attrs: { type: "module", src: "/@aeui-entry" },
      injectTo: "body"
    }]
}
```

`hasExistingAeuiEntry(html)`의 목표 판정은 다음과 같다.

1. 현재 동작과의 호환을 위해 raw HTML에 internal id `virtual:aeui-entry`가 포함되어 있으면 `true`다.
2. 실제 `<script>` opening tag를 순회한다. `type`을 소문자로 바꾼 값이 `module`인 tag만 본다.
3. 실제 `src` attribute에서 query/hash를 제거하고 backslash를 slash로 바꾼다.
4. 정규화한 `src`가 internal id `virtual:aeui-entry` 또는 public path `/@aeui-entry`와 정확히 같으면 `true`다.
5. `data-src`나 주석 안의 public path 문자열만으로는 existing entry로 판정하지 않는다.

#### **수정 필요**: public entry 중복 주입

현재 구현은 `html.includes("virtual:aeui-entry")`만 검사한다. 실제 module script가 이미 public path를 사용해도 이를 발견하지 못한다.

```html
<script type="module" src="/@aeui-entry"></script>
```

위 HTML에 현재 plugin을 적용하면 동일한 public path tag가 추가될 수 있다. 이 중복 주입은 현재 잘못된 동작이며 재구현 시 유지하지 않는다. 수정 구현은 internal id와 public path를 모두 감지해야 한다.

## 6. virtual module 해석

`resolveId(id)`:

```text
"virtual:aeui-entry" -> "\0virtual:aeui-entry"
"/@aeui-entry"       -> "\0virtual:aeui-entry"
그 외                 -> null
```

`load(id)`는 id가 정확히 `\0virtual:aeui-entry`일 때만 bootstrap 소스를 만들고, 그 외에는 `null`이다.

## 7. route file 존재 검사

`hasRouteFile(dir)`는 동기 filesystem API로 재귀 탐색한다. 목표 구현은 2절의 공식 여섯 확장자만 route file로 판정한다.

```text
if fs.existsSync(dir)가 false: false
entries = fs.readdirSync(dir, { withFileTypes: true })
for entry:
  directory이고 재귀 결과가 true면 true
  file이고 ROUTE_EXT_RE가 이름에 맞으면 true
return false
```

`readdirSync` 오류는 catch하지 않는다. symlink가 directory/file로 판정되지 않으면 탐색하지 않는다.

#### **수정 필요**: 12개 detector suffix와 6개 glob/parser의 불일치

현재 소스의 넓은 정규식이 문법상 인정하는 suffix는 12개다.

```text
.js .jsx .ts .tsx
.cjs .cjsx .cts .ctsx
.mjs .mjsx .mts .mtsx
```

하지만 eager glob이 실제 import하는 공식 지원 확장자는 `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` 여섯 개다. 예를 들어 `index.mts`만 있으면 현재 구현은 route branch를 선택하지만 glob에는 모듈이 들어오지 않고 TypeScript parser도 켜지지 않는다.

이 동작은 호환 경계가 아니라 현재 잘못된 부분이다. 수정 구현은 다음을 만족해야 한다.

- `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`만 공식 지원한다.
- `hasRouteFile`, eager glob, source transform filter와 runtime route parser가 동일한 목록을 사용한다.
- `.mts`, `.cts`, `.mjsx`, `.cjsx` 등 목록 밖 파일만 존재하면 router mode를 선택하지 않는다.
- 목록 밖 파일은 AEUI Vite transform 대상이나 runtime route 후보가 아니다.

## 8. style import

```text
if styleEntry === false: 빈 문자열
stylePath = styleEntry || "src/styles.css"
absoluteStylePath = path.resolve(root, stylePath)
if 실제 file이 아님: 빈 문자열
return `import "/${normalizePath(path.relative(root, absoluteStylePath))}";`
```

file 검사는 `existsSync && statSync(...).isFile()`이고 예외는 file 없음으로 처리한다. root 밖의 경로를 금지하지 않아 상대 import path에 `..`가 포함될 수 있다.

## 9. virtual bootstrap 소스

### 9.1 directory router branch

`<root>/src/pages` 아래에 route file이 하나라도 있으면 다음 구조를 생성한다.

```js
import { AEUI } from "aeui";
// 존재하는 style import

const routes = import.meta.glob(
  "/src/pages/**/*.{js,jsx,ts,tsx,mjs,cjs}",
  { eager: true }
);
AEUI.__runtime.initDirectoryRouter(
  routes,
  document.getElementById("root"),
  { rootDir: "/src/pages" }
);
```

실제 glob은 한 줄로 출력된다. `rootId`만 옵션으로 바뀌며 route directory와 `rootDir`은 고정이다. 이 branch에서는 `appEntry`를 사용하지 않는다.

### 9.2 단일 App fallback

route file이 없으면 다음 구조를 생성한다.

```js
import { AEUI } from "aeui";
import App from "/src/App.jsx";
// 존재하는 style import
AEUI.init(App, document.getElementById("root"));
```

`appEntry`는 root 기준 absolute path로 resolve한 후 다시 root relative path로 바꾸고 `/`를 붙인다. 파일 존재는 확인하지 않으므로 잘못된 경로는 이후 Vite resolution에서 실패한다.

## 10. source transform hook

### 10.1 대상 판별

```text
filePath = id.split('?')[0]
if 공식 여섯 확장자 중 하나가 아님: false
if filePath.includes('/node_modules/'): false
otherwise: true
```

route directory에 한정하지 않고 공식 여섯 확장자의 source 전체를 변환한다. query만 제거하고 hash는 제거하지 않는다. separator normalize 전에 `/node_modules/`를 검사한다. 현재 넓은 `ROUTE_EXT_RE`가 `.mts`, `.cts` 등을 통과시키는 동작은 7절의 **수정 필요** 항목이며 목표 계약이 아니다.

### 10.2 parser

| suffix | parser plugins |
|---|---|
| `.tsx` | `'jsx'`, `['typescript', { allExtensions: true, isTSX: true }]` |
| `.ts` | `['typescript', { allExtensions: true, isTSX: false }]` |
| `.jsx` | `'jsx'` |
| `.js`, `.mjs`, `.cjs` | JSX transform plugin이 제공하는 JSX syntax 지원 |

확장자 판정은 case-sensitive다. `.TS`, `.TSX` 같은 대문자 확장자와 공식 목록 밖의 `.mts`, `.cts`는 transform 대상이 아니다. parser는 transform filter와 별개의 더 넓은 확장자 집합을 암묵적으로 허용해서는 안 된다.

### 10.3 Babel 호출

```js
const result = await transformAsync(code, {
  babelrc: false,
  configFile: false,
  filename: filePath,
  parserOpts: { plugins: createParserPlugins(filePath) },
  plugins: [
    aeuiTransform,
    [jsxTransform, {
      pragma: 'AEUI.createElement',
      pragmaFrag: 'AEUI.Fragment',
    }],
  ],
  sourceMaps: true,
});
```

외부 Babel config는 읽지 않고 별도의 TypeScript strip transform도 사용하지 않는다. 다만 AEUI AST rewrite가 component/render 파라미터를 generated identifier로 교체하면서 그 위치의 annotation을 결과에서 없애거나 로컬 binding 쪽으로 이동시킬 수 있다. 변환 뒤 남은 TypeScript syntax의 최종 제거는 이후 Vite pipeline이 처리한다. 결과가 있으면 `{ code, map }`, 없으면 `null`; 오류는 catch하지 않고 전파한다.

## 11. npm export map

`packages/core/package.json`의 진입점 계약:

| subpath | types | ESM import | CommonJS require |
|---|---|---|---|
| `.` | `./types/index.d.ts` | `./dist/aeui.esm.js` | `./dist/aeui.cjs` |
| `./babel-plugin` | `./types/babel-plugin.d.ts` | `./dist/babel-plugin.js` | `./dist/babel-plugin.cjs` |
| `./vite` | `./types/vite.d.ts` | `./dist/vite-plugin.js` | `./dist/vite-plugin.cjs` |

legacy root fields도 일치한다.

```json
{
  "main": "dist/aeui.cjs",
  "module": "dist/aeui.esm.js",
  "types": "types/index.d.ts"
}
```

`exports`가 있으므로 `src`가 tarball에 있어도 정의되지 않은 `aeui/src/...` subpath는 일반 package resolution으로 공개되지 않는다. `./package.json`, `./jsx-runtime` export도 없다.

`typesVersions`는 version selector `*` 아래에 다음 mapping을 둔다.

```json
{
  "babel-plugin": ["types/babel-plugin.d.ts"],
  "vite": ["types/vite.d.ts"],
  "*": ["types/index.d.ts"]
}
```

## 12. Rollup 빌드

Rollup config는 세 독립 build의 배열이다.

### 12.1 runtime library

```text
input: src/index.js
outputs:
  dist/aeui.cjs    format cjs, exports named, sourcemap true
  dist/aeui.esm.js format es, sourcemap true
plugins: [nodeResolve()]
```

`src/index.js`는 `core.js`와 `hooks.js`를 re-export한다. 현재 CJS runtime의 top-level export key는 `AEUI`, `watch`, `clean`이다.

### 12.2 Babel plugin

```text
input: src/babel-plugin.js
outputs:
  dist/babel-plugin.cjs format cjs, exports default, sourcemap true
  dist/babel-plugin.js  format es, sourcemap true
plugins: [nodeResolve()]
```

CJS의 `exports: 'default'` 때문에 `require('aeui/babel-plugin')` 결과 자체가 함수다. `.default` wrapper가 아니다. ESM은 default import를 사용한다.

### 12.3 Vite plugin

```text
input: src/vite-plugin.js
explicit external:
  @babel/core
  @babel/plugin-transform-react-jsx
outputs:
  dist/vite-plugin.cjs format cjs, exports default, sourcemap true
  dist/vite-plugin.js  format es, sourcemap true
plugins: [nodeResolve()]
```

상대 import인 `babel-plugin.js` 구현은 Vite plugin bundle에 들어간다. 두 Babel package는 external로 남으며 core package의 `dependencies`에 선언된다. Node built-in `node:fs`, `node:path`도 환경 제공 module로 남는다. CJS require 결과는 함수 자체다.

## 13. 타입 선언

### 13.1 runtime types

`types/index.d.ts`는 다음 선언 shape를 그대로 제공한다. 제네릭 기본값, optional props 인자, Fragment의 두 단계 함수형, 두 JSX namespace를 생략하면 현재 타입 계약을 재현한 것이 아니다.

```ts
export type PrimitiveRenderable = string | number | bigint;

export type Renderable =
  | VNode<any>
  | PrimitiveRenderable
  | boolean
  | null
  | undefined
  | Renderable[];

export type RenderFunction<P = Record<string, unknown>> =
  (props?: P) => Renderable;

export type Component<P = Record<string, unknown>> =
  (props: P) => Renderable | RenderFunction<P>;

export type FragmentComponent =
  (initialProps?: { children?: Renderable[] }) =>
    RenderFunction<{ children?: Renderable[] }>;

export type VNodeTag<P = Record<string, unknown>> =
  string | Component<P> | FragmentComponent;

export interface VNode<P = Record<string, unknown>> {
  tag: VNodeTag<any>;
  props: (P & { children?: Renderable[] }) | null;
  children: Renderable[];
}

export interface AeuiRuntimeInternals {
  watch(
    callback: () => void,
    deps: readonly unknown[] | (() => readonly unknown[])
  ): void;
  clean(callback: () => void): void;
  runRenderPhase(...args: unknown[]): Renderable;
  [key: string]: unknown;
}

export interface AeuiApp {
  createVNode<P = Record<string, unknown>>(
    tag: VNodeTag<P>,
    props?: P | null,
    ...children: Renderable[]
  ): VNode<P>;
  createElement<P = Record<string, unknown>>(
    tag: VNodeTag<P>,
    props?: P | null,
    ...children: Renderable[]
  ): VNode<P>;
  Fragment: FragmentComponent;
  init(rootComponent: Component<any>, containerElement: Element): void;
  render(): boolean;
  __runtime: AeuiRuntimeInternals;
}

export declare const AEUI: AeuiApp;

export declare function watch(
  callback: () => void,
  deps: readonly unknown[] | (() => readonly unknown[])
): void;

export declare function clean(callback: () => void): void;
```

이어지는 global `JSX`와 exported `AEUI.JSX` namespace는 각각 같은 네 interface를 선언한다.

```ts
interface Element extends VNode {}
interface ElementAttributesProperty { props: {}; }
interface ElementChildrenAttribute { children: {}; }
interface IntrinsicElements {
  [elementName: string]: Record<string, unknown>;
}
```

global 선언은 `declare global { namespace JSX { ... } }`, AEUI 선언은 `export declare namespace AEUI { namespace JSX { ... } }` 안에 둔다. intrinsic prop 이름과 타입은 전부 열려 있고 React 타입을 import하지 않는다.

### 13.2 plugin types

```ts
// types/babel-plugin.d.ts
export default function aeuiTransform(api: { types: unknown }): unknown;

// types/vite.d.ts
export default function aeui(options?: AeuiViteOptions): unknown;
```

두 반환 타입은 구체적인 Babel/Vite package type에 결합하지 않고 `unknown`이다.

### 13.3 typecheck

`tsconfig.types.json`은 strict mode, ES2020 target, NodeNext module/resolution, `ES2020`과 `DOM` lib로 `types/**/*.d.ts`와 `type-tests/**/*.ts`만 검사하며 emit하지 않는다. `type-tests/public-api.ts`는 세 package 진입점, component/VNode/renderable, alias options를 smoke test한다.

## 14. tarball 포함 파일

package는 `sideEffects: false`이며 `files`를 정확히 whitelist한다.

```json
[
  "dist/aeui.cjs",
  "dist/aeui.cjs.map",
  "dist/aeui.esm.js",
  "dist/aeui.esm.js.map",
  "dist/babel-plugin.cjs",
  "dist/babel-plugin.cjs.map",
  "dist/babel-plugin.js",
  "dist/babel-plugin.js.map",
  "dist/vite-plugin.cjs",
  "dist/vite-plugin.cjs.map",
  "dist/vite-plugin.js",
  "dist/vite-plugin.js.map",
  "src",
  "types"
]
```

npm은 `package.json`도 자동 포함한다. `dist` 전체가 아니라 whitelist이므로 로컬의 예전 산출물 `dist/aeui.js`는 tarball에 들어가지 않는다. 현재 dry-run 기준 구성은 위 12개 dist 파일, 전체 `src`, 세 `.d.ts`, `package.json`이다.

## 15. scripts와 dependency 경계

### 15.1 루트 workspace manifest

저장소 루트 `package.json`의 workspace 조립 계약은 다음과 같다.

```json
{
  "name": "aeui-monorepo",
  "private": true,
  "scripts": {
    "test": "npm --prefix example/test test",
    "build": "npm run build:core && npm run build:examples",
    "build:core": "npm --workspace a-easy-ui run build",
    "build:examples": "npm --prefix example/vite-demo run build && npm --prefix example/deep-compare-test run build && npm --prefix example/commerce-admin run build",
    "typecheck": "npm --workspace a-easy-ui run typecheck",
    "pack:core": "npm pack --dry-run --workspace a-easy-ui --cache .npm"
  },
  "workspaces": ["packages/*"]
}
```

`private: true`는 monorepo root 자체의 실수 배포를 막고, workspace pattern은 core와 CLI package를 npm workspace 명령의 대상으로 만든다.

### 15.2 core package metadata와 scripts

기능 진입점 외 metadata도 현재 manifest 재현 범위다.

```json
{
  "description": "A lightweight, custom frontend framework",
  "keywords": ["frontend", "framework", "ui"],
  "author": "",
  "license": "ISC"
}
```

core package scripts:

```json
{
  "build": "rollup -c",
  "prepublishOnly": "npm run build",
  "test": "npm --prefix ../../example/test test",
  "typecheck": "tsc -p tsconfig.types.json --noEmit"
}
```

runtime dependencies:

```text
@babel/core ^7.23.0
@babel/plugin-transform-react-jsx ^7.23.0
```

dev dependencies:

```text
@rollup/plugin-node-resolve ^16.0.3
rollup ^4.53.3
typescript ^5.9.3
```

위 root manifest의 acceptance script 의미:

```text
npm test              -> example/test Vitest
npm run build         -> core build 후 세 example build
npm run build:core    -> a-easy-ui workspace build
npm run build:examples
npm run typecheck     -> core typecheck
npm run pack:core     -> core npm pack --dry-run
```

## 16. **현재 구현** 테스트 증거와 재현 검증

`example/test/src/__tests__/router.test.js`의 기존 `aeui/vite plugin` suite는 현재 다음 경로를 실행한다. 기존 suite 자체는 최종 적합성 계약이 아니며 새 명세 기반 test suite 작성은 별도의 **계획 기능**이다.

- 수동 main이 없을 때 `/@aeui-entry` 주입
- script attribute 순서, base prefix, query/hash와 무관하게 `src/main.*` 보존
- `data-src`/`data-type` false positive 방지
- 기본 `@ -> src` alias
- 기존 `@` alias 비덮어쓰기
- `src/pages/index.tsx`가 있을 때 router bootstrap과 6개 확장자 glob
- JSX/TSX classic AEUI JSX transform
- `.ts`의 `AEUI.createVNode` component도 render phase wrapper로 변환

현재 suite에는 public entry 중복 방지와 넓은 suffix 불일치 경로가 없다. 두 결함을 수정할 때는 다음을 목표 계약 테스트로 추가해야 한다.

- HTML에 module script `src="/@aeui-entry"`가 이미 있으면 tag를 추가하지 않음
- internal `virtual:aeui-entry`도 기존 entry로 감지함
- `data-src="/@aeui-entry"`나 주석의 문자열은 public entry로 오인하지 않음
- 공식 여섯 확장자는 detector, glob, transform filter와 runtime parser에서 동일하게 처리됨
- `.mts`, `.cts`, `.mjsx`, `.cjsx`만 있는 route directory는 router mode를 선택하지 않음
- 공식 목록 밖 source id는 AEUI transform 대상에서 제외됨

배포 재현의 최소 검증:

```text
npm run build:core
npm run typecheck
npm test
npm run pack:core
ESM/CJS root import smoke
ESM/CJS babel-plugin default export smoke
ESM/CJS vite default export smoke
```

## 17. 재구현 시 보존할 경계

- Vite plugin은 `name: 'aeui:vite'`, `enforce: 'pre'`다.
- alias는 기존 config를 덮어쓰지 않는다.
- manual main 검사와 virtual id 검사는 서로 다른 규칙이다.
- internal `virtual:aeui-entry`와 public `/@aeui-entry`를 모두 기존 hidden entry로 감지해 중복 주입하지 않는다.
- route directory는 고정이고 route 유무에 따라 router/App bootstrap을 선택한다.
- route detector, eager glob, transform filter, parser 선택과 runtime route parser는 `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`라는 하나의 공식 목록을 공유한다.
- 현재 12 suffix detector와 6 suffix glob의 차이는 보존할 경계가 아니라 **수정 필요** 항목이다.
- transform은 route file에 한정되지 않고 matching source 전체에 적용된다.
- 별도 TypeScript strip plugin은 없고, AEUI rewrite 뒤 남은 TypeScript syntax의 최종 제거는 Vite에 맡긴다.
- AEUI Babel plugin이 classic JSX plugin보다 먼저 실행된다.
- npm 물리 이름은 `a-easy-ui`, 생성 module specifier는 `aeui`다.
- root CJS는 named exports이고 두 plugin CJS는 함수 default export 자체다.
- tarball은 명시적 dist whitelist와 `src`, `types`만 배포한다.
