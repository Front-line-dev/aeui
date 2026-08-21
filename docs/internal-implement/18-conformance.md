# 18. 적합성 검증

이 문서는 AEUI의 계약 충족 여부를 검증하는 원칙과 범위를 설명한다.

---

## 테스트와 계약의 연결

공개 동작 테스트는 `user-scenario`의 문장과 heading을 직접 근거로 삼는다. 내부 구조 검증은 `internal-implement`를 참고하되, 충돌 시 `user-scenario`가 우선한다. 소스 코드의 현재 동작이나 기존 테스트의 기대값은 계약을 대체하지 않는다.

| 규칙 | 설명 |
|---|---|
| 근거 명시 | 테스트마다 `user-scenario`의 문서·절·문장을 적음 |
| 고유 ID | 자동화 가능한 규칙은 test ID에 연결 |
| 수동 검증 | 자동화 불가 규칙은 review ID에 사유와 절차 명시 |
| 근거 없는 기대값 금지 | `user-scenario`에 없는 결과를 통과 조건으로 넣지 않음 |

---

## 테스트 설계 원칙

### 관찰 결과 우선

공개 API, DOM 결과, lifecycle 순서, cleanup 횟수, scheduler 전이, 컴파일러 출력을 우선 검증.

### 분리된 테스트

각 규칙을 정상 입력, nullish, duplicate, malformed, throw, partial mount, teardown, 재진입으로 **독립 테스트**.

### 결정적 실행

RAF, polling, DOM event, timer는 테스트가 명시적으로 제어. 각 테스트는 runtime, DOM, module registry, timer, mock을 격리.

### 실제 소비 경로

생성된 package artifact를 설치한 독립 프로젝트에서 ESM, CJS, TypeScript 경로 검증.

---

## 기능별 검증 범위

| 기능 묶음 | 확인 내용 |
|---|---|
| **값과 VNode** | deep equality/clone, VNode shape, marker, child 정규화 |
| **컴파일러** | 입력→변환 JS, import 보존, component/props/hook 변환, ABI |
| **런타임과 DOM** | setup/render/watch/cleanup, reconciliation, event, controlled prop, scheduler |
| **라우터와 Vite** | route fixture, mode 선택, URL/History, virtual entry |
| **package 소비** | tarball ESM/CJS import, strict TypeScript API |
| **CLI** | argument, 오류 경계, 생성 tree, manifest, 설치 후 build |
| **예제 앱** | build 결과, browser 상호작용 시나리오 |

---

## 예제 앱 목록

| 예제 | 빌드 방식 | 핵심 검증 |
|---|---|---|
| `example/vite-demo` | Vite + classic JSX | local state, props, watch, clean, keyed list |
| `example/deep-compare-test` | Vite + classic JSX | 동일 데이터 새 참조, 직접 변이의 deep snapshot |
| `example/commerce-admin` | `aeui/vite` (router mode) | 디렉터리 라우터, 전역 store, CRUD |
| `example/letProps` | Babel Standalone | 부모 let → 자식 props |
| `example/shoppingCart` | Babel Standalone | 배열 직접 변이, keyed component |

---

## Commerce Admin 통합 시나리오

1. Admin Products에서 새 상품 생성
2. Store에서 새 상품 확인 후 cart에 담기
3. `AEUI10` 쿠폰 적용 + checkout 완료
4. Orders에서 생성된 주문 확인
5. Admin Orders에서 PAID → SHIPPED → DELIVERED 전이
6. 새로고침 후 데이터 유지 확인
7. checkout 중 route 이탈 시 pending timer cleanup 확인
8. dynamic route 직접 새로고침 확인

---

## 오류와 경고 검증

오류/경고는 스펙이 정한 경계에서 다음을 확인:

- **경로:** throw / console.error / warning / 격리 중 어떤 것인지
- **범위:** 어디까지 실행을 계속하는지
- **정리:** 오류 후 runtime context, scheduler flag, DOM 상태
- **메시지:** 스펙이 고정한 경우 시작/중간/출력 위치 일치

---

## 패키지 및 저장소 검사

| 항목 | 설명 |
|---|---|
| tarball 일치 | `files`와 실제 tarball 일치 |
| subpath import | ESM/CJS에서 root, babel-plugin, vite 검증 |
| named export | root package는 spec이 정한 export만 |
| TypeScript | strict NodeNext 프로젝트에서 통과 |
| CLI 산출물 | 생성 tree/manifest 만족 + build 성공 |
| 문서 링크 | 상대 링크와 heading이 실제 존재 |

---

## 스펙 충족 판정

모든 다음 조건을 만족할 때 충족:

1. 모든 `user-scenario` 동작이 test/review ID에 연결
2. 기능별 묶음이 독립 통과
3. package/CLI가 실제 소비 경로에서 통과
4. 예제 앱 통합 시나리오 통과
5. 패키지/저장소 검사 통과
6. 기대값과 `user-scenario` 사이 불일치 없음

---

## 관련 문서

- 공개 동작 계약: [`user-scenario/`](../user-scenario/01-getting-started.md)
- 내부 구현 참고: [`internal-implement/`](01-architecture.md)
- 알려진 결함: [`issue/known-defects.md`](../issue/known-defects.md)
- 계획 기능: [`issue/planned-features.md`](../issue/planned-features.md)

