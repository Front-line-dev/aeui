# AEUI 개발 문서

AEUI 프레임워크의 **내부 구현**을 설명하는 문서입니다. AEUI에 기여하거나 내부 동작을 이해하고 싶은 개발자를 위한 자료입니다.

> **사용법을 찾고 계신가요?** → [사용자 가이드](../guide/README.md)를 참고하세요.

## 목차

| 문서 | 한 줄 요약 |
|---|---|
| [01. 아키텍처](01-architecture.md) | 전체 구조, `createAppRuntime`, state 격리, 모듈 의존 관계 |
| [02. VDOM과 Diffing](02-vdom-and-diffing.md) | VNode 구조, VNODE_MARKER, createNode 분류, Reconciliation 알고리즘 |
| [03. 컴포넌트 내부](03-component-internals.md) | RuntimeNode, setup/render 실행 흐름, context 스택, commit/cleanup |
| [04. 스케줄러와 Dirty Checking](04-scheduler-and-dirty-checking.md) | Polling 루프, backoff, RAF loop, tick, DOM 이벤트 dispatch |
| [05. 깊은 비교](05-deep-compare.md) | `_deepEqual` 알고리즘, 순환/공유 참조, Set 매칭, `_deepClone` |
| [06. DOM 연산](06-dom-operations.md) | DOM props 적용, 이벤트 프록시 패턴, controlled input |
| [07. Babel 컴파일러](07-babel-compiler.md) | 컴포넌트 판별, props/hook 변환, render wrapper, ABI |
| [08. 라우터 내부](08-router-internals.md) | route table 생성, segment 매칭, anchor click 가로채기 |
| [09. 소스 배치](09-source-layout.md) | 파일 경계, 모듈별 심볼 목록, 의존 관계 |
| [10. 적합성 검증](10-conformance.md) | 테스트 설계 원칙, 검증 범위, 예제 앱 규칙 |

## 관련 문서

- 모든 구현의 규범은 → [구현 명세 (spec)](../spec/README.md)
- 설계 결정의 배경은 → [설계 결정 문서](../internals/design-decisions.md)
- 알려진 결함과 계획은 → [작업 추적](../tracking/README.md)
