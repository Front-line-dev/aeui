# 로드맵 (Roadmap)

## 🟡 중간 우선순위

### 테스트 coverage 확장

희귀 케이스 보강

- fragment reorder edge case
- nested destructuring props + render param 조합
- cleanup/watch ordering regression

### 입력 바인딩 문법 추가 (DX 향상)

반복되는 `value + onInput`, `checked + onChange` 패턴을 줄이기 위한 컴파일러 기반 바인딩 문법을 검토한다.

- `bindValue={name}`: 문자열 입력 바인딩
- `bindNumber={age}`: 숫자 입력 바인딩
- `bindChecked={enabled}`: checkbox/radio checked 바인딩
- JSX namespace 충돌 가능성이 낮은 camelCase prop 문법을 우선 검토.

### DOM attribute 및 이벤트 보강

JSX에서 자주 사용하는 DOM prop과 HTML attribute의 매핑 규칙을 정리하고, 런타임/컴파일러 지원 범위를 확장한다.

- `attribute`, `class`, `for`, `ref`, `event` 등 DOM prop 처리 보강.
- `class`/`className`, `for`/`htmlFor`처럼 HTML 표준 명칭과 JS 친화 명칭의 alias 정책 정리.
- `ref`를 DOM attribute로 내려보내지 않고 실제 DOM node 또는 component 노드에 접근할 수 있는 API 검토.
- 이벤트 prop의 이름 규칙, listener 교체/해제, 중복 등록 방지 규칙 보강.
- boolean attribute, dataset, aria 속성 등 기존 처리와 충돌하지 않도록 테스트 케이스 확장.

### 컴포넌트 스토리 및 상태 저장 시스템

Storybook과 비슷하게 컴포넌트를 독립적으로 실행, 확인, 공유할 수 있는 개발용 시스템을 검토한다.

- `dev` 실행 시 컴포넌트별 상태를 로컬에 저장하고 다시 불러올 수 있는 기능 추가.
- 컴포넌트 요소에서 제공되는 함수를 호출해 현재 상태 snapshot을 로컬 저장소에 저장하는 API 검토.
- Fragment로 렌더링되는 컴포넌트는 fragment 하위 요소들에서도 같은 저장 함수를 호출할 수 있게 context 전달 방식 검토.
- 저장된 상태를 스토리/케이스 단위로 관리하고, UI에서 선택해 재현할 수 있는 구조 검토.
- 로컬 개발 기능이 production bundle에 포함되지 않도록 dev-only 빌드 경계 설계.

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

### GitHub Pages 배포 기능

정적 빌드 결과물을 GitHub Pages에 쉽게 배포할 수 있는 공식 경로를 제공한다.

- GitHub Pages용 base path 설정 가이드와 템플릿 제공.
- `npm run deploy` 또는 CLI 명령으로 정적 빌드와 배포를 자동화하는 방식 검토.
- GitHub Actions workflow 예시 제공.
- SPA fallback, asset path, repository project page 배포 케이스 문서화.

### Fragment 삭제

JSX 특성상 Fragment가 필요한 부분에 트랜스파일 단계에서 자동으로 Fragment를 추가한다.

### 문서 보강

- guide level1의 목적: 처음 AEUI를 접하는 사람들에게 AEUI가 어떤 역할을 하는지 설명하고 기존 React, Next.js 보다 간결함을 느끼게 해서 사용하고 싶어지게 함
- guide level2의 목적: 기존 React, Svelte 에서 하지 못 했던 문법들이 어떻게 가능한지 궁금한 사람들을 위해 개념적으로 설명해서 이해시킴
- guide level3의 목적: AEUI 사용자가 내부 모델을 이해해 앱 코드를 더 잘 작성할 수 있게 설명한다.
- internals의 목적: AEUI를 개발하거나 수정하는 사람을 위한 구현 문서. 모듈 경계, 런타임 흐름, 컴파일러 변환, 테스트 기준을 설명한다.

## 🟢 장기 계획

### TypeScript 타입 정의

- 타입 선언의 정밀도 개선: DOM prop, event handler, component props inference 보강
- JSX namespace와 TypeScript 프로젝트 설정 예시 문서화

### App-local runtime context

현재는 active runtime stack이 모듈 레벨에 있다. 장기적으로는 app instance가 자기 context stack을 직접 소유하도록 더 좁히는 방향을 검토한다.

### 빌드 설정 개선

- Rollup에 minification 플러그인 추가 (`@rollup/plugin-terser`)
- npm 배포 전 smoke 검증 자동화

### `create-aeui-app` CLI 개선

- AEUI 버전을 동적으로 삽입
- 선택적 템플릿 (minimal / with-router / with-ssr)

### 모노레포 워크스페이스 개선

- ESLint, Prettier 설정
