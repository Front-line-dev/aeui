# AEUI 문서 인덱스

이 문서는 AEUI 문서의 역할, 권위와 읽기 순서를 정의하는 루트 인덱스다.

## 문서 권위

문서나 코드가 충돌하면 다음 순서로 판단한다.

1. [`docs/spec`](spec/README.md)의 **규범**과 **수정 필요** 항목에 적힌 목표 계약
2. `docs/spec`에서 직접 도출한 새 적합성 suite
3. `packages/*/src`의 현재 참조 구현
4. `docs/guide`와 `docs/internals`의 사용자 설명 및 구현 해설
5. 기존 `example/test`와 예제 애플리케이션

`docs/spec`은 AI 전용 참고 문서가 아니라 사람과 도구가 함께 사용하는 공식 source of truth다. 구현 계약을 가리키는 모든 새 참조는 이 경로를 사용한다.

## 상태 분류

구현 명세는 다음 네 상태만 사용한다.

| 상태 | 의미 |
|---|---|
| **규범** | 현재 구현이 반드시 만족해야 하는 의도된 계약 |
| **현재 구현** | 실제 동작이나 내부 구조를 기록한 비규범 참고 정보 |
| **계획 기능** | 반드시 구현할 목표로 확정되었지만 아직 현재 적합성 조건에는 포함하지 않은 기능 |
| **수정 필요** | 현재 구현이 잘못되었으며 함께 적힌 목표 계약으로 고쳐야 하는 항목 |

상태가 없는 `docs/spec` 본문은 **규범**이다. 임의의 다섯 번째 상태를 추가하지 않는다.

## 제품 범위

AEUI core 제품은 다음을 함께 포함한다.

- 일반 `let`과 직접 변이를 사용하는 컴포넌트·런타임 의미론
- Babel 컴파일러와 compiler/runtime ABI
- Vite 통합과 `src/pages` 디렉터리 라우터
- 공식 package export, 타입, `create-aeui-app` 생성 경험

디렉터리 라우터는 선택적 외부 패키지가 아니라 AEUI core 제품 계약이다. 공개 `Router`, `Link`, `navigate` API를 추가하지 않고, `aeui/vite`, 숨은 entry, 일반 `<a>`와 runtime bridge로 제공한다.

## 문서 지도

| 문서 | 독자 | 역할 |
|---|---|---|
| [`spec/`](spec/README.md) | 구현자·리뷰어 | 코드가 따라야 하는 상세 계약과 적합성 기준 |
| [`guide/`](guide/level-1.md) | AEUI 사용자 | 설치, 사용법과 사용자 mental model |
| [`guide/router.md`](guide/router.md) | AEUI 사용자 | core 디렉터리 라우터 사용법 |
| [`internals/`](internals/design-decisions.md) | 기여자 | 현재 구현의 구조, 배경과 설계 근거 |
| [`roadmap.md`](roadmap.md) | 기여자 | 완료되지 않은 수정과 계획 기능만 기록 |
| [`contributing.md`](contributing.md) | 기여자 | 개발 환경, 검증 명령과 문서 변경 규칙 |

## 권장 읽기 순서

- 처음 사용하는 경우: Level 1 → router guide → Level 2
- 프레임워크를 수정하는 경우: 이 인덱스 → `spec/README.md` → 관련 세부 명세 → 적합성 문서 → internals
- 저장소를 문서만으로 재현하는 경우: `spec/README.md`의 01~12 순서
