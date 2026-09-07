# AEUI 문서 인덱스

이 문서는 AEUI 문서의 **역할, 권위 순서, 읽기 순서**를 정의하는 루트 인덱스다.

## 문서 권위

문서 간 내용이 충돌하면 다음 우선순위를 따른다.

| 우선순위 | 위치 | 설명 |
|---|---|---|
| **1 (최우선)** | [`user-scenario/`](user-scenario/) | 사용자에게 약속한 동작. 이 문서의 내용이 최종 계약이다. |
| **2** | [`internal-implement/`](internal-implement/) | user-scenario의 동작을 코드로 구현하는 방법을 서술한다. |
| **3** | 현재 코드 | 위 문서에 기술되지 않은 세부 동작은 코드가 사실상의 명세다. |

구현이 `user-scenario`와 일치하지 않는 항목은 [`issue/known-defects.md`](issue/known-defects.md)에서 추적한다.

## user-scenario

| # | 문서 | 한 줄 요약 |
|---|---|---|
| 01 | [시작하기](user-scenario/01-getting-started.md) | 프로젝트 생성부터 첫 화면 띄우기까지 |
| 02 | [컴포넌트](user-scenario/02-components.md) | 함수형 컴포넌트, setup/render 분리, props |
| 03 | [반응성](user-scenario/03-reactivity.md) | `let` 변수 상태, `watch`, `clean` |
| 04 | [JSX와 렌더링](user-scenario/04-jsx-and-rendering.md) | JSX 문법, Fragment, 조건부 렌더링, 리스트와 key |
| 05 | [라우팅](user-scenario/05-routing.md) | 파일 기반 라우팅, 동적 경로, 레이아웃 |
| 06 | [이벤트와 입력](user-scenario/06-event-handling.md) | 이벤트 핸들링, controlled input, 폼 처리 |
| 07 | [프로젝트 설정](user-scenario/07-project-config.md) | Vite 플러그인 옵션, 빌드 설정, npm 패키지 구조 |

## internal-implement

| # | 문서 | 한 줄 요약 |
|---|---|---|
| 01 | [아키텍처](internal-implement/01-architecture.md) | 전체 구조, 모듈 의존 관계 |
| 02 | [VDOM](internal-implement/02-vdom.md) | VNode 구조, child 정규화 |
| 03 | [Reconciler](internal-implement/03-reconciler.md) | Diffing, DOM 갱신 알고리즘 |
| 04 | [인스턴스](internal-implement/04-instance.md) | RuntimeNode, 인스턴스 트리 |
| 05 | [컴포넌트 생명주기](internal-implement/05-component-lifecycle.md) | setup/render 실행 흐름, context |
| 06 | [스케줄러](internal-implement/06-scheduler.md) | Polling 루프, backoff, DOM 이벤트 dispatch |
| 07 | [깊은 비교](internal-implement/07-deep-compare.md) | `_deepEqual`, `_deepClone` |
| 08 | [DOM 연산](internal-implement/08-dom.md) | DOM props, 이벤트 프록시, controlled input |
| 09 | [Unmount](internal-implement/09-unmount.md) | 해제 흐름, cleanup 실행 |
| 10 | [Babel 컴파일러](internal-implement/10-babel-compiler.md) | 컴포넌트 판별, props/hook 변환, render wrapper |
| 11 | [앱 런타임](internal-implement/11-app-runtime.md) | `createAppRuntime`, state 격리 |
| 12 | [컴파일러-런타임 브리지](internal-implement/12-compiler-runtime.md) | Babel output ↔ runtime 연결 |
| 13 | [런타임 컨텍스트](internal-implement/13-runtime-context.md) | active runtime stack, phase 관리 |
| 14 | [훅 레지스트리](internal-implement/14-hook-registry.md) | watch/clean 등록 로직 |
| 15 | [Watcher 실행](internal-implement/15-watcher.md) | deps 비교, callback 실행 엔진 |
| 16 | [라우터](internal-implement/16-router.md) | route table, segment 매칭 |
| 17 | [소스 배치](internal-implement/17-source-layout.md) | 파일 경계, 모듈별 심볼 |
| 18 | [적합성 검증](internal-implement/18-conformance.md) | 테스트 설계 원칙, 검증 범위 |
| 19 | [컴포넌트 값 판별 검증](internal-implement/19-component-type-validation.md) | 값 기반 판별 적용, 회귀 검증과 지원 경계 |
| — | [설계 결정](internal-implement/design-decisions.md) | 주요 설계 선택과 근거 |

## issue

| 문서 | 한 줄 요약 |
|---|---|
| [알려진 결함](issue/known-defects.md) | 현재 코드의 알려진 문제점 |
| [계획 기능](issue/planned-features.md) | 아직 구현하지 않은 기능과 개선 작업 |

## 권장 읽기 순서

- **처음 사용:** `user-scenario/01` → 순서대로 읽기
- **프레임워크 수정:** 이 인덱스 → `internal-implement/01` → 관련 문서
- **결함 수정:** `issue/known-defects.md` → 관련 내부 문서 → 코드
- **기능 추가:** `issue/planned-features.md` → 관련 내부 문서 → 코드

## 공개와 기여

- [기여 안내](../CONTRIBUTING.md)
- [릴리즈 절차](releasing.md)
- [보안 문제 신고](../SECURITY.md)
