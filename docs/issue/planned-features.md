# 계획 기능

이 문서는 아직 `user-scenario`에서 약속하지 않은 기능과 개선 작업을 관리한다. 여기 적힌 내용은 지금 반드시 구현해야 하는 동작이나 테스트 기대값이 아니다. 현재 계약을 구현하지 못한 항목은 여기가 아니라 [`known-defects.md`](known-defects.md)에서 추적한다.

## 높은 우선순위

### 공식 적합성 suite 구축

- 모든 테스트가 검증하는 `user-scenario` 문장을 직접 가리키게 한다.
- 기존 `example/test` assertion을 계약으로 복사하지 않고 기대값을 `user-scenario`에서 도출한다.
- 값/VNode, compiler, runtime/DOM, router/Vite, package 소비와 reference app 계층을 분리한다.
- fragment reorder, nested destructuring props와 render parameter 조합, cleanup/watch ordering을 독립 시나리오로 검증한다.
- source 직접 import와 빌드된 package entry를 분리하고 ESM/CJS package-consumer smoke를 자동화한다.
- `create-aeui-app` CLI를 별도 임시 디렉터리에서 검증하는 공식 suite를 추가한다.
- [17. 소스 배치](../internal-implement/17-source-layout.md)의 파일 경계와 private 심볼 배치는 source import를 통해 검증한다 ([18. 적합성 검증](../internal-implement/18-conformance.md)의 예외 조항).

## 중간 우선순위

### `AEUI-LIFECYCLE-PLAN-001`: 부분 mount 실패 cleanup

최초 mount 도중 뒤쪽 sibling이 실패해도 앞에서 setup을 끝낸 provisional component의 cleanup을 정확히 한 번 실행하는 계약을 설계한다. 전체 render의 완전한 transaction rollback이나 error boundary와는 별개로 관리한다.

> 참고: 현재 host mount 실패 정리는 `mountHostNode` 내부의 `try/catch`에서 수행하며, `cloneHostPropsSnapshot`은 `try` 밖에서 실행되므로 이 단계에서 실패하면 직접 `reconcile` 경로에서는 DOM이 남을 수 있다. root 경로에서만 `removeUncommittedDom`이 별도 정리한다.

### `AEUI-DOM-PLAN-002`: file input polling 변화 감지

검토할 개선안은 동일한 file input props에서 제거할 `value` attribute가 이미 없을 때 이를 DOM mutation으로 세지 않는 것이다. 설계 단계에서 실제 DOM 변화가 없을 때 polling 간격을 늘릴 수 있는지와 다른 DOM 변경을 놓치지 않는지를 함께 검증한다.

### 외부 비동기 변경 보조 trigger

adaptive polling과 DOM event fast path 밖에서 발생한 비동기 상태 변경을 더 빠르게 포착할 보조 trigger가 필요한지 검토한다. API 형태, 중복 render 요청과 polling 간격의 상호작용은 아직 확정하지 않았다.

### component ArrayPattern props

component의 첫 parameter가 ArrayPattern 또는 ArrayPattern assignment인 문법을 지원하는 방향은 유지한다. plain-object VNode props와 충돌하지 않는 입력 표현과 resolver ABI를 확정하기 전까지 현재 스펙에는 포함하지 않는다.

### `AEUI-DOM-PLAN-001`: event prop 판정 정밀화

단순 `startsWith('on')` 대신 `once` 같은 일반 prop을 event로 오인하지 않는 이름 규칙을 설계한다. custom event, lowercase handler, listener 교체·해제와 proxy 안정성의 범위를 함께 확정한다.

### 입력 바인딩 문법

반복되는 `value + onInput`, `checked + onChange` 패턴을 줄이는 compiler 문법을 검토한다.

- `bindValue={name}`
- `bindNumber={age}`
- `bindChecked={enabled}`

### DOM attribute·event·ref 확장

- `class`/`className`, `for`/`htmlFor` alias 정책
- DOM node 또는 component node에 접근하는 `ref` API
- event capture/options 문법과 listener options
- HTML boolean attribute, dataset와 일반 DOM property의 장기 매핑 정책

### 컴포넌트 story와 상태 저장

- component를 독립 실행·확인·공유하는 개발용 시스템
- local 상태 snapshot 저장과 story/case 관리
- Fragment 하위로 저장 context를 전달하는 방식
- production bundle에서 제외되는 dev-only 경계

### 컴포넌트 return 규칙 확장

- JSX를 담은 local 변수를 반환하는 pattern
- 판별할 수 없는 component pattern의 dev warning
- 명시적인 component annotation 또는 helper API

### JSX import와 빌드 설정 간소화

- `aeui/jsx-runtime` 제공 검토

### GitHub Pages 배포

- base path와 SPA fallback 가이드
- 정적 빌드·배포 command 또는 script
- GitHub Actions workflow와 repository project page 예시

### Fragment 자동 처리

JSX 변환 단계가 필요한 Fragment를 자동 삽입해 사용자가 직접 Fragment를 작성할 필요를 줄이는 방식을 설계한다.

### 문서 보강

- `user-scenario`: AEUI의 역할과 간결한 사용자 경험, 일반 변수 반응성과 compiler 기반 문법의 개념
- `internal-implement`: 앱 작성에 필요한 내부 모델, 기여자를 위한 모듈 경계와 구현 근거

## 장기 계획

### TypeScript 타입 정밀도

- DOM prop, event handler와 component props inference 보강
- JSX namespace와 TypeScript 설정 예시

### app-local runtime context

module-level active runtime stack을 app instance가 직접 소유하는 더 좁은 context 구조를 검토한다. 비동기 render나 concurrent 실행을 도입할 경우 `currentComponentNode`, `currentComponentPhase`와 중첩 복구 방식도 함께 설계한다.

### 비동기 render의 DOM range 관리

비동기 render를 도입할 경우 comment anchor 없이 `firstDom`과 `lastDom`으로 범위를 추적하는 방식을 계속 사용할 수 있는지 검토한다. component context와 DOM range 갱신 순서를 하나의 설계로 다룬다.

### runtime 계측과 error boundary

compiler runtime bridge를 계측 또는 error boundary의 삽입 지점으로 사용할지 검토한다. 오류 전파, cleanup, 부분 commit과 public API를 확정하기 전까지 현재 계약에 포함하지 않는다.

### 빌드와 배포 검증

- Rollup minification
- npm 배포 전 package-consumer smoke 자동화

### `create-aeui-app` 개선

- AEUI version 동적 삽입
- router-first 기본 구조를 유지하는 추가 template 정책
- template 의존성 버전(`vite: ^8.0.0`, `aeui: npm:a-easy-ui@^0.0.1`)의 자동 갱신 방안

### monorepo tooling

- ESLint와 Prettier 설정
