# AEUI 구현 명세

AEUI(A Easy UI)는 React와 유사한 Virtual DOM 기반 프런트엔드 프레임워크다.
`setState` 없이 일반 `let` 변수를 상태로 사용하며, **Dirty Checking 기반의 자동 변경 감지**와 **Babel 컴파일러가 만드는 setup/render 분리 구조**가 핵심 특징이다.

`docs/spec`은 현재 버전의 AEUI 구현이 반드시 따라야 할 규칙이다.
01부터 12까지 순서대로 읽으면 앞 장에서 정의한 내용을 다음 장이 이어서 사용한다.

> 현재 코드의 관찰 기록, 알려진 스펙 위반, 아직 적용하지 않은 기능과 작업 상태는 이 디렉터리에 두지 않는다.
> 해당 내용은 [작업 추적](../tracking/README.md)에서 관리한다.

각 문서의 역할은 [AEUI 문서 인덱스](../README.md)를, 스펙 충족 여부를 검증하는 방법은 [10. 스펙 충족 여부 검증](10-conformance.md)을, 변경 절차는 [기여 가이드](../contributing.md)를 따른다.

## 문서 구성

### 사용자가 먼저 읽을 문서

| 문서 | 한 줄 요약 |
|---|---|
| [01. 공개 API와 아키텍처](01-public-api-and-architecture.md) | `AEUI`, `watch`, `clean` — 앱 코드에서 사용하는 세 가지 API |
| [02. VNode와 깊은 데이터 연산](02-vnode-and-deep-data.md) | 화면 구조 객체(VNode)의 생성 규칙과, 변경 감지에 쓰이는 비교·복사 알고리즘 |
| [03. 컴포넌트 런타임](03-component-runtime.md) | 컴포넌트의 생명주기 — 생성(setup) → 렌더(render) → 갱신 → 정리(cleanup) |
| [05. 스케줄러, 훅, 오류 처리](05-scheduler-hooks-and-errors.md) | 변경 감지 루프(Dirty Checking), `watch`/`clean` 동작, 오류 격리 |

### 화면 갱신의 내부 동작

| 문서 | 한 줄 요약 |
|---|---|
| [04. Reconciliation과 DOM](04-reconciliation-and-dom.md) | 이전 화면과 새 화면을 비교해 DOM을 최소한으로 변경하는 알고리즘 |

### 빌드 도구와 라우터

| 문서 | 한 줄 요약 |
|---|---|
| [06. Babel 컴파일러](06-babel-compiler.md) | 컴포넌트 코드를 AEUI 런타임에 맞게 변환하는 Babel 플러그인의 규칙 |
| [07. 디렉터리 라우터](07-directory-router.md) | 파일 이름이 곧 URL — `src/pages`의 파일 구조로 라우팅 |
| [08. Vite 플러그인과 빌드](08-vite-plugin-and-build.md) | Vite 설정, npm 패키지 구조, 빌드 산출물 |
| [09. `create-aeui-app` CLI](09-create-aeui-app.md) | `npx create-aeui-app my-app` 한 줄로 프로젝트 생성 |

### 검증과 참조

| 문서 | 한 줄 요약 |
|---|---|
| [10. 스펙 충족 여부 검증](10-conformance.md) | 테스트 설계 원칙과 검증 기준 |
| [11. 예제 애플리케이션](11-reference-applications.md) | 각 예제 앱이 보여주는 기능과 필수 동작 시나리오 |
| [12. 소스 파일 배치](12-source-layout.md) | 소스 파일 구조, 모듈 간 의존 방향, 함수 목록 |
