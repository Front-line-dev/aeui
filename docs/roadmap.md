# 로드맵 (Roadmap)

이 문서는 아직 완료되지 않은 작업만 기록한다. 현재 구현을 설명하는 내용은 `docs/spec`의 **현재 구현** 문단에 두고, 아래 작업은 **현재 구현 결함 수정**과 **계획 기능**을 구분해 관리한다.

## 🔴 우선 수정 필요

### DOM 입력 및 접근성 정확성

- file input 판정을 모든 DOM 갱신 경로에서 대소문자 비구분으로 통일한다. 현재 controlled sync는 `type="FILE"` 등을 일반 input으로 오인해 금지된 non-empty value 쓰기를 시도할 수 있다.
- `aria-*`의 boolean 값을 HTML boolean attribute처럼 빈 문자열/제거로 처리하지 않는다. nullish만 제거하고 `true`와 `false`는 각각 문자열 attribute로 보존한다.

### Babel import 병합 정확성

- JSX runtime용 `AEUI` 자동 import를 추가할 때 기존 default import의 의미를 바꾸지 않는다.
- namespace import에는 named specifier를 같은 declaration에 강제로 넣지 않고, 문법적으로 유효한 별도 named import를 생성한다.
- named/default/namespace/alias 조합별 transform 회귀를 새 적합성 suite에 포함한다.

### 깊은 데이터 비교 및 복제 정확성

- `AEUI-DATA-FIX-001`: `_deepEqual(a, b)`와 `_deepEqual(b, a)`가 항상 같은 결과를 내도록 타입 분기와 양방향 참조 대응을 수정한다. 서로 다른 내장 타입, 순환 구조, 공유 참조 구조를 포함한 property test를 추가한다.
- `AEUI-DATA-FIX-002`: enumerable own `__proto__`가 clone의 prototype setter로 작동하지 않고 own data property로 복제되도록 수정한다. clone 및 전역 prototype 불변성을 회귀 테스트로 고정한다.

### Babel 컴포넌트 및 hook 판별 정확성

- `AEUI-COMPILER-FIX-001`: 임의 호출의 첫 인자라는 이유만으로 일반 callback을 컴포넌트로 변환하지 않도록 판별 근거를 JSX tag, 정확한 AEUI element factory의 type 위치, 명시적 component 표식처럼 검증 가능한 신호로 제한한다. 일반 callback negative fixture와 실제 component positive fixture를 함께 추가한다.
- `AEUI-COMPILER-FIX-002`: 고정된 `__props` 생성 이름을 scope-safe UID로 바꾸고 사용자 binding 충돌 회귀를 추가한다.
- `AEUI-COMPILER-FIX-003`: named dependency getter가 함수 객체 자체를 반환하는 getter로 바뀌지 않도록 binding 종류를 판별하고, 실제 dependency 배열이 runtime에 전달되는지 검증한다.
- `AEUI-COMPILER-FIX-004`: hook의 local 이름이 아니라 `aeui`에서 가져온 실제 imported 이름으로 `watch`와 `clean`을 판별하고 alias·shadowing negative fixture를 추가한다.
- `AEUI-COMPILER-FIX-005`: `_newProps` parameter 이름 접두사 대신 plugin metadata 또는 생성 wrapper 구조로 idempotence를 판별하고, 사용자 parameter 보존과 재컴파일 무중복을 함께 검증한다.
- React의 JSX 처리에서 참고할 수 있는 경계를 별도 compiler pipeline 설명으로 문서화한다. JSX 변환은 tag를 element type으로 보존하고 후속 단계가 host string과 component value를 구분한다는 점을 참고하되, React가 사용자 컴포넌트 함수 본문을 AEUI식 render factory로 미리 다시 쓴다고 설명하지 않는다.
- AEUI pipeline을 `component 후보 수집 -> 명시적 판별/진단 -> setup/render factory 변환 -> JSX lowering -> runtime component 실행` 단계로 나누고, 각 단계의 입력·출력·실패 조건 및 단계별 fixture를 문서화한다.

### Vite route 및 virtual entry 정확성

- route detector, eager glob, transform filter, parser가 공식 지원 확장자 `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` 하나의 목록을 공유하도록 고친다.
- `.mts`, `.cts`, `.mjsx` 등 detector만 받아들이고 실제 route import/parser는 처리하지 못하는 불일치를 제거한다.
- HTML에 public entry `/@aeui-entry` 또는 internal id `virtual:aeui-entry`가 이미 있으면 virtual entry script를 중복 주입하지 않는다.

### 적합성 테스트 전면 재작성

현재 `example/test`는 현재 구현의 회귀를 조사하는 참고 자료일 뿐 문서 계약의 적합성 판정 기준으로 사용하지 않는다. 기존 suite에 테스트를 덧붙이는 방식이 아니라 `docs/spec`의 규범과 목표 계약에서 새 suite를 처음부터 작성한다.

- 각 테스트가 검증하는 문서 절과 상태를 명시한다.
- **현재 구현**과 **계획 기능**을 현재 합격 조건으로 고정하지 않는다.
- **수정 필요** 항목은 잘못된 현재 결과가 아니라 문서에 적힌 목표 결과를 검증한다.
- fragment reorder, nested destructuring props와 render param 조합, cleanup/watch ordering을 새 suite의 명시적 시나리오로 다시 설계한다.
- source 직접 import와 빌드된 package entry 검증을 분리하고, package 소비 ESM/CJS smoke를 실행 가능한 명령으로 제공한다.

## 🟡 중간 우선순위

### 마운트 실패 자원 정리 보장

최초 mount 도중 뒤쪽 sibling이 실패해도 앞에서 setup을 끝낸 provisional component의 cleanup이 정확히 한 번 실행되도록 한다. 이는 전체 render의 완전한 트랜잭션 rollback이나 error boundary와 별개인 수명주기 보장이다.

### file input polling 변화 감지 개선

동일한 file input props에서 제거할 `value` attribute가 이미 없다면 DOM mutation으로 세지 않도록 개선한다. 실제 DOM 변화가 없을 때 adaptive polling backoff가 정상적으로 증가해야 한다.

### component ArrayPattern props 지원

component의 첫 파라미터가 ArrayPattern 또는 ArrayPattern assignment인 문법은 반드시 지원한다. plain-object VNode props와 충돌하지 않는 입력 표현 및 resolver 규칙을 설계하고, 표준 VNode 경로에서 setup과 반복 render가 TypeError 없이 완료되도록 구현한다. 구현 전까지는 **계획 기능**이므로 현재 적합성 조건에는 포함하지 않지만, 선택 기능이나 비목표로 재분류하지 않는다.

### event prop 판정 정밀화

현재의 단순 `startsWith('on')` 판정을 대체해 `once` 같은 일반 prop을 `ce` event로 오인하지 않는 이름 규칙을 설계한다. listener 교체·해제와 기존 event proxy 안정성은 유지한다.

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
- event capture/options 문법과 listener options 지원 범위 검토.
- HTML boolean attribute, dataset, 일반 DOM property의 장기 매핑 정책 정리.

### 컴포넌트 스토리 및 상태 저장 시스템

Storybook과 비슷하게 컴포넌트를 독립적으로 실행, 확인, 공유할 수 있는 개발용 시스템을 검토한다.

- `dev` 실행 시 컴포넌트별 상태를 로컬에 저장하고 다시 불러올 수 있는 기능 추가.
- 컴포넌트 요소에서 제공되는 함수를 호출해 현재 상태 snapshot을 로컬 저장소에 저장하는 API 검토.
- Fragment로 렌더링되는 컴포넌트는 fragment 하위 요소들에서도 같은 저장 함수를 호출할 수 있게 context 전달 방식 검토.
- 저장된 상태를 스토리/케이스 단위로 관리하고, UI에서 선택해 재현할 수 있는 구조 검토.
- 로컬 개발 기능이 production bundle에 포함되지 않도록 dev-only 빌드 경계 설계.

### 컴포넌트 return 규칙 확장

우선 수정 항목의 컴포넌트 판별 pipeline을 확정한 뒤 renderable return 감지 범위를 확장한다.

- JSX를 담은 지역 변수를 반환하는 패턴 지원 검토.
- 감지할 수 없는 컴포넌트 패턴에 대한 dev warning 추가.
- 명시적 컴포넌트 표시를 위한 annotation 또는 helper API 검토.

### JSX import 및 빌드 설정 간소화

JSX 사용을 위해 모든 파일에서 `AEUI`를 import하거나 Vite Babel 설정을 직접 작성해야 하는 부담을 줄인다.

- `aeui/jsx-runtime` 제공 검토.

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
- core 디렉터리 라우터를 사용하는 router-first 기본 템플릿을 유지하면서 추가 템플릿 정책 검토

### 모노레포 워크스페이스 개선

- ESLint, Prettier 설정
