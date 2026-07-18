# 10. 스펙 충족 여부 검증

이 문서는 01~09와 11~12의 규칙을 **테스트로 검증하는 방법**을 정의한다.

테스트는 내부 함수의 이름이나 파일 분할이 아니라, **스펙이 요구한 결과**를 확인한다. 단, `AEUI.__runtime`처럼 컴파일러와 런타임 사이의 ABI로 스펙에 명시된 값만 예외적으로 직접 확인한다.

---

## 1. 테스트와 스펙의 연결

모든 검증은 `docs/spec`의 문장을 근거로 한다. 소스 코드의 현재 동작, 기존 테스트가 비교하는 값, 또는 다른 문서는 스펙을 대체하지 않는다.

| 규칙 | 설명 |
|---|---|
| 근거 명시 | 테스트와 수동 검증 항목은 근거 문서·절·문장을 적음 |
| 고유 ID | 자동화할 수 있는 스펙 규칙은 test ID에 연결 |
| 수동 검증 | 자동화 불가한 규칙은 review ID에 사유와 절차를 명시 |
| 근거 없는 기대값 금지 | 스펙에 없는 결과를 통과 조건으로 넣지 않음 |
| 중복 조항 | 같은 동작의 가장 자세한 스펙 조항을 주 근거로 삼음 |

---

## 2. 테스트 설계 원칙

### 관찰 결과 우선

공개 API, DOM 결과, lifecycle 순서, cleanup 횟수, scheduler 전이, 컴파일러 출력, 라우터 결과, package import를 우선 검증한다.

### 분리된 테스트

각 규칙은 정상 입력, nullish 값, duplicate, malformed input, throw, partial mount, teardown, 재진입을 **독립된 테스트**로 검증한다. 하나의 통합 테스트가 여러 규칙을 우연히 통과하는 것으로 개별 규칙의 증거를 대체하지 않는다.

### 결정적 실행

RAF, polling, DOM event, timer는 테스트가 명시적으로 제어한다. wall-clock 대기나 실행 순서에 의존하지 않으며, 각 테스트는 runtime, DOM, module registry, timer, mock을 다른 테스트로부터 격리한다.

### 실제 소비 경로

public package 검증은 source 직접 import만으로 하지 않는다. 생성된 package artifact를 설치한 독립 프로젝트에서 ESM, CJS, TypeScript 경로를 검증한다.

---

## 3. 기능별 검증 범위

| 기능 묶음 | 확인 내용 |
|---|---|
| **값과 VNode** | deep equality/clone, VNode shape, marker, child 정규화, 비변이 |
| **컴파일러** | 입력→변환된 JS, import 보존, component/props/hook 변환, ABI |
| **런타임과 DOM** | setup/render/watch/cleanup, reconciliation, event, controlled prop, scheduler, 오류 |
| **라우터와 Vite** | route fixture, mode 선택, URL/History, virtual entry, 확장자/parser |
| **package 소비** | 생성 tarball의 ESM/CJS import, strict TypeScript public API |
| **CLI** | argument, 오류 경계, 생성 tree, manifest 변경, 설치 후 build |
| **예제 앱** | build 결과, 11장의 browser 상호작용 시나리오 |

각 묶음은 다른 묶음의 성공에 의존하지 않고 독립적으로 실패 원인을 찾을 수 있어야 한다.

---

## 4. 오류와 경고 검증

오류/경고는 스펙이 정한 경계에서 다음을 확인한다:

- **경로:** throw / console.error / warning / 격리 중 어느 것을 사용하는지
- **범위:** callback, watcher, cleanup, reconcile, scheduler 중 어디까지 실행을 계속하는지
- **정리:** 오류 후 runtime context, scheduler flag, DOM, component 소유 정보가 어떤 상태로 남는지
- **메시지:** 스펙이 문자열을 고정한 경우 시작 부분, 중간 값, 출력 위치가 일치하는지

스펙이 문자열을 고정하지 않은 오류는 **의미와 전파 경계만** 검증하고, 우연한 전체 문구를 호환 조건으로 만들지 않는다.

---

## 5. 패키지 및 저장소 검사

| 확인 항목 | 설명 |
|---|---|
| tarball 일치 | `package.json`의 `files`와 실제 tarball 내용이 일치 |
| subpath import | ESM/CJS에서 root, `babel-plugin`, `vite` 진입점을 각각 불러올 수 있음 |
| named export | root package는 01/08이 정한 export만 제공 |
| TypeScript | strict NodeNext 소비 프로젝트에서 public API 통과 |
| CLI 산출물 | `create-aeui-app` 결과가 09의 tree/manifest를 만족하고 build 성공 |
| 예제 앱 | 11의 build 및 browser 시나리오 통과 |
| 추적 파일 정합성 | `.DS_Store` 없음, 절대 경로 없음 |
| 문서 링크 | 상대 링크와 참조된 heading이 실제로 존재 |

---

## 6. 스펙 충족 판정

구현은 다음을 **모두** 만족할 때 이 스펙 전체를 충족한다:

1. 모든 스펙 조항이 test ID 또는 review ID에 연결됨
2. 기능별 묶음이 각각 독립적으로 통과
3. package/CLI 검증이 실제 소비 경로에서 통과
4. 예제 앱의 필수 통합 시나리오 통과
5. 패키지 및 저장소 검사 통과
6. 검증 기대값과 스펙 조항 사이에 해결되지 않은 불일치 없음
