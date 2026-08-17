# AEUI 문서 인덱스

이 문서는 AEUI 문서의 역할과 읽기 순서를 정의하는 루트 인덱스다.

## 문서 구조

| 위치 | 독자 | 역할 |
|---|---|---|
| [`user-scenario/`](user-scenario/01-getting-started.md) | **AEUI 사용자** | AEUI를 사용하는 유저 입장에서 서술한 문서. 이 문서들을 **최우선 룰**로 취급한다. |
| [`internal-implement/`](internal-implement/01-architecture.md) | **기여자·구현자** | `user-scenario`에서 기술한 AEUI 기능들을 어떻게 코드로 구현했는지 서술한 문서. |
| [`issue/`](issue/known-defects.md) | 기여자 | 현재 문제점과 향후 계획. |

## user-scenario — 사용자 시나리오

AEUI를 사용하는 유저 관점에서 작성된 문서. 처음 사용한다면 **01 → 07** 순서로 읽는다.

| 문서 | 한 줄 요약 |
|---|---|
| [01. 시작하기](user-scenario/01-getting-started.md) | 프로젝트 생성부터 첫 화면 띄우기까지 |
| [02. 컴포넌트](user-scenario/02-components.md) | 함수형 컴포넌트 작성법, setup과 render의 분리, props |
| [03. 반응성](user-scenario/03-reactivity.md) | `let` 변수로 상태 관리, `watch`로 변화 감지, `clean`으로 정리 |
| [04. JSX와 렌더링](user-scenario/04-jsx-and-rendering.md) | JSX 문법, Fragment, 조건부 렌더링, 리스트와 key |
| [05. 라우팅](user-scenario/05-routing.md) | 파일 기반 라우팅, 동적 경로, 레이아웃, 404 페이지 |
| [06. 이벤트와 입력](user-scenario/06-event-handling.md) | 이벤트 핸들링, controlled input, 폼 처리 |
| [07. 프로젝트 설정](user-scenario/07-project-config.md) | Vite 플러그인 옵션, 빌드 설정, npm 패키지 구조 |

## internal-implement — 내부 구현

`user-scenario`의 기능들이 코드 수준에서 어떻게 구현되었는지 설명한다.

| 문서 | 한 줄 요약 |
|---|---|
| [01. 아키텍처](internal-implement/01-architecture.md) | 전체 구조, `createAppRuntime`, state 격리, 모듈 의존 관계 |
| [02. VDOM과 Diffing](internal-implement/02-vdom-and-diffing.md) | VNode 구조, Reconciliation 알고리즘 |
| [03. 컴포넌트 내부](internal-implement/03-component-internals.md) | RuntimeNode, setup/render 실행 흐름, context 스택 |
| [04. 스케줄러와 Dirty Checking](internal-implement/04-scheduler-and-dirty-checking.md) | Polling 루프, backoff, DOM 이벤트 dispatch |
| [05. 깊은 비교](internal-implement/05-deep-compare.md) | `_deepEqual` 알고리즘, `_deepClone` |
| [06. DOM 연산](internal-implement/06-dom-operations.md) | DOM props 적용, 이벤트 프록시 패턴, controlled input |
| [07. Babel 컴파일러](internal-implement/07-babel-compiler.md) | 컴포넌트 판별, props/hook 변환, render wrapper |
| [08. 라우터 내부](internal-implement/08-router-internals.md) | route table 생성, segment 매칭, anchor click 가로채기 |
| [09. 소스 배치](internal-implement/09-source-layout.md) | 파일 경계, 모듈별 심볼 목록, 의존 관계 |
| [10. 적합성 검증](internal-implement/10-conformance.md) | 테스트 설계 원칙, 검증 범위, 예제 앱 규칙 |
| [설계 결정](internal-implement/design-decisions.md) | 주요 설계 선택과 그 이유 |

상세 모듈 문서:

- [`babel-plugin/`](internal-implement/babel-plugin/) — Babel 플러그인 상세
- [`core/`](internal-implement/core/) — 코어 런타임 모듈별 상세
- [`hooks/`](internal-implement/hooks/) — watch, clean 훅 상세
- [`router/`](internal-implement/router/) — 디렉터리 라우터 상세

## issue — 문제점과 계획

| 문서 | 한 줄 요약 |
|---|---|
| [알려진 결함](issue/known-defects.md) | 현재 코드의 알려진 문제점 |
| [계획 기능](issue/planned-features.md) | 아직 구현하지 않은 기능과 개선 작업 |

## 권장 읽기 순서

- **처음 사용하는 경우:** [`user-scenario/01-getting-started.md`](user-scenario/01-getting-started.md) → 순서대로 읽기
- **프레임워크를 수정하는 경우:** 이 인덱스 → [`internal-implement/01-architecture.md`](internal-implement/01-architecture.md) → 관련 문서
- **결함을 수정하는 경우:** [`issue/known-defects.md`](issue/known-defects.md) → 관련 내부 문서 → 코드
- **기능을 추가하는 경우:** [`issue/planned-features.md`](issue/planned-features.md) → 관련 내부 문서 → 코드
