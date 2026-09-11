# 18. 적합성 검증

이 문서는 AEUI의 계약 충족 여부를 검증하는 원칙과 범위를 설명한다.

## 실행

```bash
npm ci
npm test
```

`npm test`는 계약 연결 검사 → 코어 빌드 → SWC·Babel 각각의 새 적합성 테스트를 실행한다. `example/test/src/conformance/`만 포함하며 기존 `src/__tests__/`는 재사용하거나 통과 근거로 합산하지 않는다.

설치·전체 앱 빌드·실제 브라우저처럼 실행 시간이 길거나 실패 자료가 큰 검증은 기본 테스트에서 제외한다.

```bash
npx playwright install chromium  # 최초 한 번
npm run test:extra
```

extra는 실제 tarball을 저장소 밖의 임시 프로젝트에 설치하고 ESM/CJS/strict NodeNext, 배포 CLI, 생성 앱의 개발 서버·preview와 Vite 예제 5개를 확인한다. Chromium만 사용하며, 다른 브라우저·OS·지원 버전 전체를 한 실행으로 보장하지 않는다. `AEUI_TEST_PORT`로 브라우저 서버의 시작 포트를 바꿀 수 있고 연속된 7개 포트를 사용한다.

기본 실행과 extra 모두 화면에는 단계와 개수·시간만 출력한다. 전체 로그, JSON 결과, 실패 시 screenshot·trace는 Git에서 제외한 `.conformance/`에 저장한다. extra의 소비 프로젝트와 서버는 종료 시 정리한다. npm 의존성 설치에는 네트워크가 필요하다. `letProps`·`shoppingCart` 검증은 외부 요청을 차단한 상태에서 빌드된 정적 파일을 로딩하고, 브라우저에 Babel이 없을 때도 상호작용이 동작하는지 확인한다.

방문자가 작성한 JSX를 컴파일하는 랜딩 코드 편집기는 별도 `npm run test:landing`으로 검증한다. 이 검증에서는 웹 컴파일러가 실제로 사용자 코드를 변환하고 실행하는지 확인한다.

| 명령/결과 | 의미 |
|---|---|
| `npm run test:contracts` | 문서·검토 기록·test ID 연결 검사만 실행 |
| `.conformance/default-summary.json` | 이번 기본 실행의 결과. extra는 `not-run` |
| `.conformance/extra-summary.json` | 이번 extra 실행의 결과. 기본 검증은 `not-run` |
| `.conformance/default.log`, `extra.log` | 해당 실행의 전체 로그 |
| `.conformance/extra-browser.json` | 브라우저별 상세 결과와 실패 자료 위치 |

한 명령의 성공만으로 전체 적합성을 표시하지 않는다. 같은 소스에 대해 기본·extra가 모두 성공해야 전체 실행을 통과한 것이다. 프로세스 실패, 누락된 test ID, skip, 미완료 검토는 성공으로 집계하지 않는다. 알려진 결함의 해결 여부는 별도로 유지한다.

## 계약과 검토 기록

`example/test/conformance/contracts.json`은 검증 묶음마다 문서·절·근거 문장, 목적, 발생하면 안 되는 결과, 기본/extra 분류를 기록한다. 각 테스트 제목은 `[계약ID.번호] 상황과 기대 결과`로 시작하며, parameterized case는 실행 결과에서 개별 기록된다. 테스트 제목과 assertion은 구체적인 검증 목적을 설명해야 한다.

`coverage.json`은 `user-scenario/`의 모든 2단계 절을 계약 또는 `REVIEW-*`에 연결한다. 사용 지침, 지원 제외 범위, 외부 환경 조건처럼 단일 실행으로 증명할 수 없는 내용은 이유를 적어 검토한다. 문서의 전체 hash가 달라지면 연결 검사가 실패한다. 변경된 문장과 새 테스트의 필요성을 검토한 뒤 hash를 갱신하며, hash만 자동 갱신하는 명령은 제공하지 않는다. 절 연결이나 코드 coverage 비율만으로 모든 문장의 의미를 자동 증명했다고 해석하지 않는다.

`tutorial/`로 분리한 JSX runtime·컴파일러 설정 가이드는 `contracts.json`에서 해당 문서·절·근거 문장으로 연결한다. 튜토리얼의 상대 링크와 heading도 저장소 문서 검사에 포함한다. TypeScript 예제는 공개 타입과 package 소비 검사에 맞춰 검토한다.

공개 계약은 `public`, 내부 구현 보장은 `internal`로 분류한다. 내부의 정확한 시간 간격·private 심볼·오류 처리 세부사항을 사용자 API 계약으로 승격하지 않는다. 소스 구조 문서의 `component-type.js` 및 private 상태 배치도 독립적으로 검사한다.

## 새 테스트 작성 기준

1. 사용자 계약에서 상황과 기대 결과를 먼저 정하고 내부 구현을 참고한다. 기존 테스트의 기대값을 복사하지 않는다.
2. 같은 상황에서 발생하면 안 되는 결과를 정한다. 예: keyed 재배치 후 상태 초기화 금지, 같은 deps의 중복 callback 금지, 제거한 watcher·타이머 재실행 금지, 브라우저 전용 링크 가로채기 금지.
3. 정상 결과와 금지 결과는 같은 계약을 검증할 때 함께 확인한다. unrelated 동작을 개수만 늘리려고 붙이지 않는다.
4. 자동 갱신 테스트는 수동 `render()`로 보정하지 않는다. cleanup 검증 전 강제 timer 삭제로 자원 누수를 가리지 않는다.
5. private API는 내부 보장 검증, compiler가 사용하는 router 진입점, 테스트 자원 정리에 한정한다. 공개 동작은 사용자 코드와 DOM 결과로 확인한다.
6. 반복·대형 snapshot·전체 빌드·설치·브라우저 등 비용이 큰 검증은 extra에 둔다. 기본 테스트 실패 출력에 DOM 전체나 생성 코드 전체를 덤프하지 않는다.
7. 테스트 도구 자체를 통과시키기 위한 무의미한 테스트는 추가하지 않는다. 연결 검사 도구는 누락·중복·미실행을 실제 실행 단계에서 거부한다.

---

## 테스트와 계약의 연결

일반적인 개발 흐름의 공개 동작 테스트는 `user-scenario`의 문장과 heading을 근거로 삼는다. 별도 빌드 구성처럼 튜토리얼에서 다루는 사용법은 `tutorial`의 설정·예시와 연결한다. 내부 구조 검증은 `internal-implement`를 참고하되, 공개 동작이 충돌하면 `user-scenario`가 우선한다. 소스 코드의 현재 동작이나 기존 테스트의 기대값은 계약을 대체하지 않는다.

| 규칙 | 설명 |
|---|---|
| 근거 명시 | 테스트마다 개발 흐름 또는 튜토리얼의 문서·절·문장을 적음 |
| 고유 ID | 자동화 가능한 규칙은 test ID에 연결 |
| 수동 검증 | 자동화 불가 규칙은 review ID에 사유와 절차 명시 |
| 근거 없는 기대값 금지 | 연결된 사용자 문서에 없는 결과를 공개 동작의 통과 조건으로 넣지 않음 |

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
| `example/vite-demo` | `aeui/vite` (manual main) | local state, props, watch, clean, keyed list |
| `example/deep-compare-test` | `aeui/vite` (manual main) | 동일 데이터 새 참조, 직접 변이의 deep snapshot |
| `example/commerce-admin` | `aeui/vite` (router mode) | 디렉터리 라우터, 전역 store, CRUD |
| `example/letProps` | `aeui/vite` (SWC, manual main) | 부모 let → 자식 props, 웹 컴파일러 없이 실행 |
| `example/shoppingCart` | `aeui/vite` (SWC, manual main) | 배열 직접 변이, keyed component, 웹 컴파일러 없이 실행 |

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
| subpath import | ESM/CJS에서 root, babel-plugin, swc, vite, JSX runtime과 개발용 runtime 검증 |
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
