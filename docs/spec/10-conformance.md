# 10. 스펙 충족 여부 검증

## 1. 목적

이 문서는 01~09와 11~12가 정한 규칙을 실행 가능한 테스트로 연결하는 방법을 정의한다. 테스트는 내부 함수가 우연히 같은 모양인지가 아니라, 스펙이 요구한 결과와 작업 전후에 AEUI가 저장한 값의 변화를 확인한다. `AEUI.__runtime`처럼 Babel 컴파일러와 Vite 플러그인이 사용한다고 스펙에 적힌 내부 값만 예외적으로 직접 확인한다.

## 2. 테스트를 스펙에 연결하는 규칙

테스트의 기대값은 `docs/spec`에서만 가져온다. 소스 코드의 실제 결과, 기존 테스트가 비교하는 값, 테스트용 파일 구조 또는 다른 설명 문서는 스펙을 대체하거나 확장하지 않는다.

공식 검증 테스트는 다음 추적 규칙을 모두 만족해야 한다.

1. 모든 테스트와 수동 검증 항목은 근거가 되는 문서, 절과 스펙 문장을 식별한다.
2. 자동화할 수 있는 각 스펙 규칙은 고유한 test ID에 연결한다.
3. 자동화할 수 없는 스펙 규칙은 사유와 확인 절차가 적힌 review ID에 연결한다.
4. 모든 test ID와 review ID는 하나 이상의 근거 조항을 가져야 한다.
5. 스펙에 근거가 없는 기대값을 통과 조건으로 추가하지 않는다.
6. 여러 문서가 같은 동작을 다루면 가장 자세한 스펙 조항 하나를 주 근거로 삼고 나머지는 관련 조항으로 연결한다.

## 3. 테스트 설계 원칙

### 3.1 관찰 결과 우선

공개 API, DOM 결과, lifecycle 순서, cleanup 횟수, scheduler 전이, compiler output의 유효성, router 결과와 package import 성공을 우선 검증한다. private helper 이름이나 파일 분할은 12에서 명시적으로 고정한 항목만 직접 검증한다.

### 3.2 정상·예외·실패 입력 분리

각 계약은 적용 가능한 범위에서 정상 입력, nullish 값, duplicate, malformed input, throw, partial mount, teardown과 재진입을 독립된 테스트로 검증한다. 하나의 통합 테스트가 여러 계약을 우연히 통과하는 것으로 개별 계약의 증거를 대신하지 않는다.

### 3.3 같은 조건에서 같은 결과가 나오는 실행

RAF, polling, DOM event와 timer는 테스트가 명시적으로 제어한다. wall-clock 대기나 실행 순서에 기대지 않으며, 각 테스트는 runtime, DOM, module registry, timer와 mock을 다른 테스트로부터 격리한다.

### 3.4 실제 소비 경로

public package 계약은 source 직접 import만으로 검증하지 않는다. 생성된 package artifact를 설치한 독립 소비 프로젝트에서 ESM, CJS와 TypeScript 경로를 검증한다. source 직접 import는 12가 고정한 내부 module 계약을 검증할 때만 사용한다.

## 4. 반드시 따로 확인할 기능 묶음

| 기능 묶음 | 반드시 확인할 내용 |
|---|---|
| 값과 VNode | deep equality/clone, VNode shape, marker, child 정규화와 비변이 |
| compiler | 입력 source, 변환된 유효 JavaScript, import 보존, component·props·hook 변환과 compiler/runtime ABI |
| runtime과 DOM | setup/render/watch/cleanup, reconciliation, event, controlled property, scheduler와 오류 경계 |
| router와 Vite | route fixture, mode 선택, URL·History, virtual entry, extension과 parser 일관성 |
| package 소비 | 생성 tarball을 설치한 ESM/CJS 소비와 strict TypeScript public API |
| CLI | argument·오류 경계, 생성 tree, manifest 변경, 설치 후 build와 package artifact |
| reference app | build 결과와 11에 정의한 browser 상호작용 및 데이터 흐름 |

각 기능 묶음은 다른 묶음의 성공에 기대지 않고 따로 실패 원인을 찾을 수 있어야 한다.

## 5. 오류와 경고 검증

오류와 경고는 관련 스펙이 정한 경계에서 다음 항목을 검증한다.

- throw, log, warning 또는 격리 중 어느 경로를 사용하는지
- callback, watcher, cleanup, reconcile과 scheduler 중 어느 범위까지 실행을 계속하는지
- 오류 뒤 runtime context, scheduler flag, DOM과 component 소유 정보가 어떤 값으로 정리되는지
- 스펙이 오류 문자열을 고정한 경우 문장의 시작 부분, 중간에 넣는 값과 출력 위치가 일치하는지

스펙이 문자열을 고정하지 않은 오류는 의미와 전파 경계만 검증하며 우연한 전체 문구를 호환 조건으로 만들지 않는다.

## 6. package 및 저장소 검사

스펙 충족 여부를 확인할 때는 다음 저장소와 배포 규칙도 검사해야 한다.

- package manifest의 `files` 범위와 생성 tarball의 실제 파일 목록이 일치한다.
- ESM과 CJS에서 package root, `babel-plugin`, `vite` 진입점을 각각 불러올 수 있다.
- root package는 01과 08이 정한 named export만 제공하고 subpath의 default export 형태를 보존한다.
- strict NodeNext 소비 프로젝트에서 public TypeScript API가 통과한다.
- `create-aeui-app` 산출물은 09의 tree와 manifest 계약을 만족하고 설치 후 build할 수 있다.
- reference application은 11의 build 및 browser 계약을 만족한다.
- 추적 파일에는 `.DS_Store`와 사용자별 홈 디렉터리를 가리키는 절대 경로가 없다.
- 문서의 상대 링크와 명시적으로 참조한 heading이 존재한다.

## 7. 스펙 충족 판정

구현은 다음 조건을 모두 만족할 때에만 이 스펙 전체를 충족한다.

1. 모든 스펙 조항이 test ID 또는 review ID에 연결되어 있다.
2. 필수 기능 묶음이 각각 따로 통과한다.
3. package와 CLI 검증이 workspace 내부 경로가 아닌 실제 소비 경로에서 통과한다.
4. reference application의 필수 통합 시나리오가 통과한다.
5. package 및 저장소 검사가 모두 통과한다.
6. 검증 기대값과 스펙 조항 사이에 해결되지 않은 불일치가 없다.
