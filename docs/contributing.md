# 기여 가이드 (Contributing)

## 개발 환경 설정

### 필수 도구

- Node.js 18+
- npm 8+

### 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/Front-line-dev/aeui.git
cd aeui
npm install
```

루트의 `npm install`이 `packages/core`와 `packages/create-aeui-app`의 의존성도 함께 설치한다 (npm workspaces).

---

## 프로젝트 구조

```
aeui/
├── packages/
│   ├── core/                    AEUI 프레임워크 코어
│   │   ├── src/
│   │   │   ├── core.js          진입점 (AEUI 객체 조립)
│   │   │   ├── deep-compare.js  깊은 비교/복사 유틸리티
│   │   │   ├── reconciler.js    DOM 조작, reconcile, unmount
│   │   │   ├── runtime.js       hooks 브릿지, watcher, 인스턴스, 스케줄러
│   │   │   ├── hooks.js         watch guard, clean 훅
│   │   │   ├── babel-plugin.js  Babel 변환 플러그인
│   │   │   └── index.js         진입점
│   │   ├── dist/                빌드 결과물
│   │   ├── rollup.config.js     빌드 설정
│   │   └── package.json
│   │
│   └── create-aeui-app/         프로젝트 스캐폴딩 CLI
│       ├── index.js
│       └── template/            프로젝트 템플릿
│
├── example/
│   ├── vite-demo/               Vite 기반 데모 앱
│   └── test/                    테스트 프로젝트
│       └── src/__tests__/
│           ├── unit.test.js        유틸리티 유닛 테스트
│           ├── dom.test.js         DOM 조작 통합 테스트
│           ├── component.test.jsx  컴포넌트 통합 테스트
│           └── ...                 그 밖의 runtime, router, compiler 테스트
│
├── docs/                        문서
│   ├── README.md                문서 인덱스, 권위와 읽기 순서
│   ├── spec/                    코드가 따라야 하는 구현 명세
│   ├── tracking/                알려진 결함, 계획 기능과 구현 근거
│   ├── guide/                   사용자 가이드 (Level 1~3)
│   └── internals/               내부 구현 상세 문서
│
└── package.json                 루트 (workspaces 설정)
```

---

## 빌드

### 코어 라이브러리 빌드

```bash
npm run build:core
```

`dist/` 폴더에 ESM과 CJS 형식의 번들이 생성된다:
- `dist/aeui.esm.js` — ES Module
- `dist/aeui.cjs` — CommonJS
- `dist/babel-plugin.cjs` — Babel 플러그인 (CJS)
- `dist/babel-plugin.js` — Babel 플러그인 (ESM)
- `dist/vite-plugin.cjs` — Vite 플러그인 (CJS)
- `dist/vite-plugin.js` — Vite 플러그인 (ESM)
- 각 번들의 `.map` 파일 — source map

---

## 테스트

### 테스트 실행

```bash
npm test
```

루트 `npm test`는 `example/test`의 Vitest suite를 실행한다.

### 대표 테스트 파일

전체 파일과 검증 항목은 [구현 및 검증 근거](tracking/implementation-evidence.md#기존-테스트-목록)에서 확인한다.

| 파일 | 대상 | 설명 |
|------|------|------|
| `unit.test.js` | `_deepEqual`, `_deepClone`, `createVNode` | 유틸리티 함수 단위 테스트 |
| `dom.test.js` | `updateDomProps`, `reconcile`, `unmountNode` | DOM 조작 통합 테스트 (jsdom) |
| `component.test.jsx` | 컴포넌트 마운트, 상태, props, hooks | 컴포넌트 수준 통합 테스트 |

### 테스트 환경

- **프레임워크**: Vitest
- **DOM 시뮬레이션**: jsdom
- **JSX 변환**: Babel + AEUI 플러그인 (vitest 설정에서 자동 적용)

---

## 타입 검증

```bash
npm run typecheck
```

`packages/core/types/`의 public 타입 선언과 `packages/core/type-tests/`의 smoke 사용 예제를 TypeScript로 검증한다. 현재 core 소스는 JavaScript를 유지하고, 타입 선언은 배포용 `.d.ts`로 제공한다.

---

## 패키징 검증

```bash
AEUI_PACK_CACHE_DIR="$(mktemp -d)"
npm pack --dry-run --workspace a-easy-ui --cache "$AEUI_PACK_CACHE_DIR"
```

패키지 dry-run으로 `dist`, `src`, `types`가 포함되는지 확인한다. ESM/CJS 진입점은 다음 smoke command로 확인할 수 있다:

```bash
node -e "import('aeui').then(m => console.log(Object.keys(m)))"
node -e "const m = require('aeui'); console.log(Object.keys(m), typeof m.AEUI.init)"
node -e "import('aeui/babel-plugin').then(m => console.log(typeof m.default))"
node -e "const plugin = require('aeui/babel-plugin'); console.log(typeof plugin)"
node -e "import('aeui/vite').then(m => console.log(typeof m.default))"
node -e "const plugin = require('aeui/vite'); console.log(typeof plugin)"
```

---

## 전체 검증

```bash
npm run build
npm test
npm run typecheck
AEUI_PACK_CACHE_DIR="$(mktemp -d)"
npm pack --dry-run --workspace a-easy-ui --cache "$AEUI_PACK_CACHE_DIR"
```

`npm run build`는 core 번들과 Vite 예제 앱들을 모두 빌드한다.

---

## 데모 앱 실행

```bash
cd example/vite-demo
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하여 AEUI 기능을 확인할 수 있다.

---

## 코드 컨벤션

### 컴포넌트 명명

- 컴포넌트: **PascalCase** (`Counter`, `TodoList`)
- 일반 함수: **camelCase** (`handleClick`, `formatDate`)
- 내부 함수: 모듈 목적에 맞는 동사형 이름 사용 (`reconcile`, `tick`, `unmountNode`)

### JSX

- HTML `class` 대신 `className` 사용
- 이벤트: `onClick`, `onInput` 등 React 관례 사용

---

## 문서 관련

### 문서 위치

문서를 수정하기 전에 [`docs/README.md`](README.md)에서 각 문서의 역할과 읽기 순서를 확인한다. `docs/spec`에는 반드시 지켜야 하는 규칙만 기록하며 구현 상태나 작업 계획을 섞지 않는다.

- 코드가 기존 스펙을 위반하면 [`tracking/known-defects.md`](tracking/known-defects.md)에 등록하고 스펙을 잘못된 코드에 맞추지 않는다.
- 아직 적용하지 않은 기능은 [`tracking/planned-features.md`](tracking/planned-features.md)에 기록한다.
- 계획 기능을 구현할 때는 확정된 계약을 먼저 `docs/spec`에 반영하고 적합성 테스트와 소스 구현을 뒤따르게 한다.
- 현재 소스와 기존 테스트의 관찰 기록은 [`tracking/implementation-evidence.md`](tracking/implementation-evidence.md)에 둔다.
- 여러 스펙이 같은 내용을 요약하면 어느 문서가 세부 규칙을 정의하는지 명시한다. 규칙을 바꿀 때는 그 문서를 먼저 수정하고 요약을 함께 맞춘다.

| 문서 | 대상 독자 | 내용 |
|------|-----------|------|
| `docs/README.md` | 모든 독자 | 문서 인덱스와 권위 |
| `docs/spec/` | 구현자·리뷰어 | 현재 구현이 반드시 따라야 하는 규칙만 |
| `docs/tracking/` | 기여자 | 알려진 결함, 계획 기능과 스펙이 아닌 구현 참고 자료 |
| `docs/guide/level-1.md` | 첫 사용자 | 기본 사용법 |
| `docs/guide/router.md` | 사용자 | core 디렉터리 라우터 사용법 |
| `docs/guide/level-2.md` | 사용자 | 핵심 원리 이해 |
| `docs/guide/level-3.md` | 기여자 | 내부 구조 개요 |
| `docs/internals/` | 기여자 | 상세 구현 문서 |

### 문서 작성 스타일

`docs/internals/` 문서는 다음을 지킨다:
- 모든 개념을 **처음 등장할 때 인라인으로 설명**
- 코드 예시에 **입력 → 출력** 대비
- **왜 이렇게 동작하는가** 설명 포함
- 줄 번호가 아닌 **함수 이름과 파일 경로**로 코드 위치 참조

## 변경 작업 절차

### 임시 검증 순서

공식 적합성 suite가 모든 조항을 자동화하기 전까지 다음 검증을 참고 안전망으로 사용한다.

```bash
npm run build:core
npm test
npm run typecheck
npm run build:examples
AEUI_PACK_CACHE_DIR="$(mktemp -d)"
npm pack --dry-run --workspace a-easy-ui --cache "$AEUI_PACK_CACHE_DIR"
git diff --check
```

- npm cache와 생성 artifact는 저장소 밖 임시 경로에 둔다.
- 생성 tarball은 임시 소비 프로젝트에서 ESM/CJS root, `babel-plugin`, `vite` 진입점을 확인한다.
- 문서만 바꾸면 Markdown link, heading, 용어 일관성과 `git diff --check`를 우선 확인한다.
- 기존 테스트 성공은 회귀 안전망이며 스펙 적합성은 연결된 조항별 검토로 별도 확인한다.

### 변경 완료 체크리스트

- [ ] 동작 변경 전에 관련 스펙과 경계 조건을 확정했다.
- [ ] 정상뿐 아니라 nullish, duplicate, malformed, teardown과 error 경계를 명시했다.
- [ ] compiler 전후 계약과 runtime ABI 영향을 함께 확인했다.
- [ ] public API, `__runtime`, types와 package exports의 일관성을 확인했다.
- [ ] test ID 또는 review ID가 변경한 규범 문장을 직접 가리킨다.
- [ ] build artifact로 테스트와 reference application을 검증했다.
- [ ] cache, 생성 output, 사용자별 절대 경로와 `.DS_Store`를 추적하지 않았다.

### Source manifest 작업 순서

모듈 의존 관계를 따라 구현할 때는 다음 순서를 권장한다. 이 순서는 스펙 적합성 조건이 아니다.

1. marker, VNode helper, deep compare와 `core.js` VNode factory
2. runtime state/context, node factory와 component lifecycle
3. DOM host와 reconciler
4. scheduler, hook registry/watcher와 app-runtime
5. Babel plugin과 compiler runtime ABI
6. router와 Vite plugin
7. public types, Rollup와 package export map
8. create CLI/template
9. 스펙 조항에 추적되는 conformance suite와 reference applications

- source 파일을 추가·삭제·이름 변경하면 source manifest를 함께 갱신한다.
- export 변경 시 public/private 경계와 package/type 계약을 함께 검토한다.
- private helper 변경 시 관련 알고리즘 단계와 conformance mapping을 확인한다.
- build artifact 변경 시 Rollup output, package `files`와 dry-run tarball 목록을 함께 갱신한다.
