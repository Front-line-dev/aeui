# 기여 가이드 (Contributing)

## 개발 환경 설정

### 필수 도구

- Node.js 18+
- npm 8+

### 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/[org]/aeui.git
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
│   │   │   ├── hooks.js         watch, clean 훅
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
│           ├── unit.test.js     유틸리티 유닛 테스트
│           ├── dom.test.js      DOM 조작 통합 테스트
│           └── component.test.jsx  컴포넌트 통합 테스트
│
├── docs/                        문서
│   ├── guide/                   사용자 가이드 (Level 1~3)
│   └── internals/               내부 구현 상세 문서
│
└── package.json                 루트 (workspaces 설정)
```

---

## 빌드

### 코어 라이브러리 빌드

```bash
cd packages/core
npm run build
```

`dist/` 폴더에 ESM과 CJS 형식의 번들이 생성된다:
- `dist/aeui.esm.js` — ES Module
- `dist/aeui.js` — CommonJS
- `dist/babel-plugin.cjs` — Babel 플러그인 (CJS)
- `dist/babel-plugin.js` — Babel 플러그인 (ESM)

---

## 테스트

### 테스트 실행

```bash
cd example/test
npm install
npm test
```

### 테스트 구조

| 파일 | 대상 | 설명 |
|------|------|------|
| `unit.test.js` | `_deepEqual`, `_deepClone`, `createVNode` | 유틸리티 함수 단위 테스트 |
| `dom.test.js` | `_updateDomProps`, `_reconcile`, `_unmount` | DOM 조작 통합 테스트 (jsdom) |
| `component.test.jsx` | 컴포넌트 마운트, 상태, props, hooks | 컴포넌트 수준 통합 테스트 |

### 테스트 환경

- **프레임워크**: Vitest
- **DOM 시뮬레이션**: jsdom
- **JSX 변환**: Babel + AEUI 플러그인 (vitest 설정에서 자동 적용)

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
- 내부 함수: **underscore prefix** (`_reconcile`, `_tick`)

### JSX

- HTML `class` 대신 `className` 사용
- 이벤트: `onClick`, `onInput` 등 React 관례 사용

---

## 문서 관련

### 문서 위치

| 문서 | 대상 독자 | 내용 |
|------|-----------|------|
| `docs/guide/level-1.md` | 첫 사용자 | 기본 사용법 |
| `docs/guide/level-2.md` | 사용자 | 핵심 원리 이해 |
| `docs/guide/level-3.md` | 기여자 | 내부 구조 개요 |
| `docs/internals/` | 기여자 | 상세 구현 문서 |

### 문서 작성 스타일

`docs/internals/` 문서는 다음을 지킨다:
- 모든 개념을 **처음 등장할 때 인라인으로 설명**
- 코드 예시에 **입력 → 출력** 대비
- **왜 이렇게 동작하는가** 설명 포함
- 줄 번호가 아닌 **함수 이름과 파일 경로**로 코드 위치 참조
