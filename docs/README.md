# AEUI 문서 인덱스

이 문서는 AEUI 문서의 역할, 권위와 읽기 순서를 정의하는 루트 인덱스다.

## 문서 권위

[`docs/spec`](spec/README.md)만 현재 AEUI가 따라야 하는 규칙을 정의한다. 소스 코드, 테스트, 예제와 다른 문서는 스펙을 설명하거나 검증할 수 있지만 스펙을 바꾸지는 않는다. 서로 충돌하면 `docs/spec`을 따른다.

- 스펙 조항에 직접 연결된 적합성 테스트는 해당 조항을 검증하는 증거다. 아직 연결되지 않은 기존 테스트의 기대값은 별도 규칙으로 취급하지 않는다.
- [`docs/guide`](guide/level-1.md)와 [`docs/internals`](internals/design-decisions.md)는 사용법과 설계 이유를 설명한다.
- [`docs/tracking`](tracking/README.md)은 구현 결함, 계획과 조사 결과를 기록한다.
- [11. 예제 애플리케이션](spec/11-reference-applications.md)이 명시한 동작은 스펙이다. 예제 코드의 나머지 구현 세부와 화면 모양은 스펙이 아니다.

## 문서별 역할

`docs/spec`에는 현재 버전의 AEUI가 반드시 지켜야 하는 규칙만 둔다. 현재 코드를 조사한 기록, 알려진 스펙 위반, 아직 만들지 않은 기능과 작업 상태는 넣지 않는다.

| 위치 | 내용 |
|---|---|
| [`spec/`](spec/README.md) | 현재 코드가 반드시 따라야 하는 스펙 |
| [`tracking/known-defects.md`](tracking/known-defects.md) | 현재 코드가 스펙을 위반하는 지점 |
| [`tracking/planned-features.md`](tracking/planned-features.md) | 아직 현재 스펙에 포함하지 않은 기능 |
| [`tracking/implementation-evidence.md`](tracking/implementation-evidence.md) | 현재 소스·기존 테스트·임시 검증에서 얻은 스펙이 아닌 참고 자료 |
| [`old-docs/`](old-docs/README.md) | 이전 문서를 보존하는 기록 보관소; 현재 규칙이나 계획으로 사용하지 않음 |

코드가 스펙을 위반해도 올바른 계약은 `docs/spec`에 유지한다. 잘못된 실제 동작은 결함 문서에서 추적하며, 계획 기능은 계약을 확정해 `docs/spec`으로 옮기기 전까지 적합성 기준으로 사용하지 않는다.

## 문서 지도

| 문서 | 독자 | 역할 |
|---|---|---|
| [`guide/`](guide/README.md) | **AEUI 사용자** | 설치, 사용법, 튜토리얼 — "AEUI를 어떻게 쓰는가?" |
| [`dev/`](dev/README.md) | **기여자·구현자** | 내부 구현 상세 — "어떻게 구현되었는가?" |
| [`spec/`](spec/README.md) | 구현자·리뷰어 | 코드가 따라야 하는 상세 계약과 적합성 기준 (규범 문서) |
| [`internals/`](internals/design-decisions.md) | 기여자 | 현재 구현의 배경과 설계 근거 |
| [`tracking/`](tracking/README.md) | 기여자 | 알려진 결함, 계획 기능과 현재 구현 근거 |
| [`old-docs/`](old-docs/README.md) | 유지보수자 | 현재 문서 체계 이전의 보관 자료 |
| [`contributing.md`](contributing.md) | 기여자 | 개발 환경, 검증 명령과 문서 변경 규칙 |

## 권장 읽기 순서

- **처음 사용하는 경우:** [`guide/01-getting-started.md`](guide/01-getting-started.md) → 순서대로 읽기
- **프레임워크를 수정하는 경우:** 이 인덱스 → [`dev/01-architecture.md`](dev/01-architecture.md) → 관련 dev 문서 → `spec/` 원본 명세
- **결함을 수정하는 경우:** `tracking/known-defects.md` → 연결된 스펙 → 테스트 → 코드
- **기능을 추가하는 경우:** `tracking/planned-features.md` → 확정된 스펙 → 테스트 → 코드
