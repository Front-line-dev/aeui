# 로드맵 (Roadmap)

## 🟡 중간 우선순위

### 테스트 coverage 확장

희귀 케이스 보강

- fragment reorder edge case
- nested destructuring props + render param 조합
- cleanup/watch ordering regression

### watch API 개선 (DX 향상)

- 공식 시그니처를 `watch(callback, deps?, options?)`로 정리.
- 기존 `watch([deps], callback)`은 하위 호환으로 유지하되 문서에서는 구버전 호환 API로 낮춘다.
- `watch`의 `deps`는 최적화를 위한 부분이고, 기본적으로는 `deps`를 아예 설정하지 않더라도 작동하도록 지원하여 개발자 경험(DX) 개선.
- `immediate`, `flush` 같은 옵션 도입 여부 검토.

### 입력 바인딩 문법 추가 (DX 향상)

반복되는 `value + onInput`, `checked + onChange` 패턴을 줄이기 위한 컴파일러 기반 바인딩 문법을 검토한다.

- `bindValue={name}`: 문자열 입력 바인딩
- `bindNumber={age}`: 숫자 입력 바인딩
- `bindChecked={enabled}`: checkbox/radio checked 바인딩
- JSX namespace 충돌 가능성이 낮은 camelCase prop 문법을 우선 검토.

### 컴포넌트 판별 및 return 규칙 개선

Babel 플러그인의 컴포넌트 판별 휴리스틱과 renderable return 감지 범위를 개선한다.

- PascalCase 함수가 JSX를 직접 반환하지 않는 경우의 오인/누락 케이스 점검.
- JSX를 담은 지역 변수를 반환하는 패턴 지원 검토.
- 감지할 수 없는 컴포넌트 패턴에 대한 dev warning 추가.
- 명시적 컴포넌트 표시를 위한 annotation 또는 helper API 검토.

### JSX import 및 빌드 설정 간소화

JSX 사용을 위해 모든 파일에서 `AEUI`를 import하거나 Vite Babel 설정을 직접 작성해야 하는 부담을 줄인다.

- `aeui/jsx-runtime` 제공 검토.
- Babel 플러그인의 자동 import 주입 검토.
- `aeui/vite` 플러그인 제공으로 Babel 플러그인 순서와 JSX pragma 설정을 자동화.
- `create-aeui-app` 템플릿에 간소화된 설정 반영.

### Fragment 삭제

JSX 특성상 Fragment가 필요한 부분에 트랜스파일 단계에서 자동으로 Fragment를 추가한다.

### 문서 보강

- guide level1의 목적: 처음 AEUI를 접하는 사람들에게 AEUI가 어떤 역할을 하는지 설명하고 기존 React, Next.js 보다 간결함을 느끼게 해서 사용하고 싶어지게 함
- guide level2의 목적: 기존 React, Svelte 에서 하지 못 했던 문법들이 어떻게 가능한지 궁금한 사람들을 위해 개념적으로 설명해서 이해시킴
- guide level3의 목적: 실제로 AEUI 코드레벨에서 어떻게 구현했는지 설명한다.
- internals의 목적: AI가 코드를 수정하거나 프로젝트에 기여하고 싶은 사람들을 위한 문서. 어떤 목적으로 코드가 구성되었는지 설명한다.

## 🟢 장기 계획

### TypeScript 타입 정의

- `packages/core/types/index.d.ts` 추가
- 최소한 `AEUI`, `watch`, `clean`, `createVNode`의 타입 선언
- `package.json`에 `types` 필드 추가

### App-local runtime context

현재는 active runtime stack이 모듈 레벨에 있다. 장기적으로는 app instance가 자기 context stack을 직접 소유하도록 더 좁히는 방향을 검토한다.

### 빌드 설정 개선

- Rollup에 minification 플러그인 추가 (`@rollup/plugin-terser`)
- Source map 생성
- `package.json`에 `sideEffects: false` 추가

### `create-aeui-app` CLI 개선

- AEUI 버전을 동적으로 삽입
- `.gitignore` 자동 생성
- 선택적 템플릿 (minimal / with-router / with-ssr)

### 모노레포 워크스페이스 개선

- 루트 `package.json`에 공통 스크립트 추가
- ESLint, Prettier 설정
