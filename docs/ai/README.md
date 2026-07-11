# AEUI 구현 명세

## 1. 목적

이 디렉터리는 AEUI를 **문서에서 코드로 구현하기 위한 명세**다. 목표는 기존 소스를 보지 않은 구현자가 이 문서군과 표준 JavaScript/DOM/Babel/Vite 동작만으로 의도된 프레임워크를 다시 만드는 것이다. 현재 구현을 설명하는 문장, 아직 구현하지 않은 계획 기능, 잘못된 현재 구현을 고치기 위한 목표 계약을 명시적으로 구분한다.

이 문서가 설명하는 대상은 다음과 같다.

- `packages/core`의 공개 API, 런타임, 컴파일러, 디렉터리 라우터, Vite 플러그인, 타입 및 빌드 산출물 계약
- `packages/create-aeui-app` CLI와 생성 템플릿
- `example/test`가 현재 확인하는 관찰 가능한 동작과 새로 작성할 적합성 suite의 범위
- 예제 애플리케이션이 맡는 통합 검증 역할

`docs/guide`는 사용자 사용법, `docs/internals`는 구현 배경과 해설, `docs/ai`는 코드가 따라야 할 상세 계약이라는 경계를 유지한다.

## 2. 규범의 강도

문서에서 다음 용어를 규범적으로 사용한다.

- **반드시**: 호환 구현이 지켜야 한다.
- **금지한다**: 호환 구현이 해서는 안 된다.
- **권장한다**: 특별한 이유가 없다면 지킨다.
- **허용한다**: 구현 선택 사항이다.

### 2.1 상태 표기

각 계약과 경계에는 필요에 따라 다음 상태를 붙인다. 상태가 없는 본문은 **규범**으로 해석한다.

| 상태 | 의미 | 현재 코드와의 관계 | 현재 적합성 판정 |
|---|---|---|---|
| **규범** | 지금 구현이 따라야 하는 의도된 계약 | 코드는 반드시 일치해야 한다. | 새 적합성 suite가 검증해야 한다. |
| **현재 구현** | 마이그레이션을 위해 기록한 실제 동작 또는 내부 구조 | 사실 설명이지만 그 자체로 보존 의무를 만들지 않는다. | 참고 자료다. |
| **계획 기능** | 의도는 확정했지만 아직 구현하지 않은 기능 | 현재 코드가 제공하지 않아도 된다. | 구현 전까지 합격 조건이 아니다. |
| **수정 필요** | 현재 코드가 잘못되었으며 고쳐야 하는 지점 | 함께 적은 목표 계약이 최종 기준이다. | 현재 구현을 정답으로 승인해서는 안 된다. |

현재 동작의 한계가 자동으로 규범이 되는 것은 아니다. 의도적으로 유지하는 비직관적 동작만 규범으로 남기고, 우발적인 구현 결과는 **현재 구현**, 나중에 추가할 동작은 **계획 기능**, 이미 잘못되었다고 판단한 동작은 **수정 필요**로 분리한다.

예를 들어 재귀적으로 모든 children 배열을 평탄화하지 않는 것, `ref`를 실행하지 않는 것, 공개 라우터 API를 추가하지 않는 것은 현재의 의도된 범위다. 반면 실패한 mount의 provisional child cleanup, file input polling 최적화, component ArrayPattern 지원, 더 엄격한 event prop 판정은 계획 기능이며 현재 합격 조건이 아니다. file type 대소문자 처리, AEUI import 병합, route 확장자 불일치, virtual entry 중복 주입, boolean ARIA 의미, 깊은 비교·복제의 안전성, 컴포넌트 판별과 hook 변환의 오판은 수정해야 할 현재 결함이다.

### 2.2 현재 전환 항목 분류

| 상태 | 항목 | 상세 문서 |
|---|---|---|
| **계획 기능** | 실패한 최초 mount의 provisional component cleanup 보장 | 04 §9.3, 05 §13 |
| **계획 기능** | 동일 file input props의 실제 DOM 변화 기반 polling backoff | 04 §13, 05 §5~6 |
| **계획 기능** | component props의 ArrayPattern 지원 | 06 §7.3 |
| **계획 기능** | `startsWith('on')`보다 정확한 event prop 판정 | 04 §12 |
| **수정 필요** | file input type의 대소문자 비구분 판정 | 04 §13.2 |
| **수정 필요** | 기존 default/namespace import를 보존하는 `AEUI` import 주입 | 06 §3.3 |
| **수정 필요** | route detector, glob, transform, parser의 지원 확장자 통일 | 07 §4, 08 §7·§10 |
| **수정 필요** | public/internal virtual entry의 중복 주입 방지 | 08 §5 |
| **수정 필요** | boolean `aria-*`의 문자열 의미 보존 | 04 §11.3 |
| **수정 필요** | `AEUI-DATA-FIX-001`: `_deepEqual` 대칭성·타입 일치·참조 그래프 대응 보장 | 02 `AEUI-DATA-FIX-001` |
| **수정 필요** | `AEUI-DATA-FIX-002`: `_deepClone`의 `__proto__` own property 안전 복제 | 02 `AEUI-DATA-FIX-002` |
| **수정 필요** | `AEUI-COMPILER-FIX-001`: 임의 호출의 첫 인자를 컴포넌트로 오인하는 판별 제거 | 06 `AEUI-COMPILER-FIX-001` |
| **수정 필요** | `AEUI-COMPILER-FIX-002`: 고정 생성 이름 `__props`를 사용자 binding과 충돌하지 않는 UID로 교체 | 06 `AEUI-COMPILER-FIX-002` |
| **수정 필요** | `AEUI-COMPILER-FIX-003`: 이름 있는 의존성 getter를 함수 객체 반환 getter로 오변환하지 않음 | 06 `AEUI-COMPILER-FIX-003` |
| **수정 필요** | `AEUI-COMPILER-FIX-004`: hook의 local 이름이 아니라 실제 원본 import 이름으로 `watch`/`clean` 판별 | 06 `AEUI-COMPILER-FIX-004` |
| **수정 필요** | `AEUI-COMPILER-FIX-005`: `_newProps` 이름 접두사를 compiler 생성 wrapper의 판별 근거로 사용하지 않음 | 06 `AEUI-COMPILER-FIX-005` |
| **현재 구현** | props target의 실제 열거·삭제·복사 의미로 사실 설명 수정 완료 | 03 §7.3 |
| **테스트 전면 재작성 예정** | 기존 `example/test`를 적합성 기준에서 제외하고 문서 계약으로 새 suite 작성 | 10 전체 |

## 3. 문서 우선 개발 규칙

기능을 변경할 때는 다음 순서를 따른다.

1. 영향을 받는 `docs/ai` 계약과 경계 조건을 먼저 수정한다.
2. 변경된 계약을 검증할 적합성 테스트를 추가하거나 수정한다.
3. 소스 코드를 구현한다.
4. 빌드된 코어를 사용해 전체 검증을 수행한다.
5. 사용자에게 노출되는 변화라면 `docs/guide`를, 구현 배경이 필요하면 `docs/internals`를 동기화한다.

**계획 기능**을 구현할 때는 먼저 상태를 규범으로 바꾸고 입력, 출력, 오류, 수명주기와 검증 조건을 확정한 뒤 테스트와 코드를 작성한다. **수정 필요** 항목은 문서에 적힌 목표 계약을 기준으로 실패 테스트를 만들고 코드를 고친다. 현재 구현의 결함을 테스트의 기대값으로 복사해 정당화해서는 안 된다.

코드와 이 문서가 충돌하는 것을 발견한 경우 코드만 보고 문서를 사후 정당화하지 않는다. 문장이 규범인지, 현재 구현 설명인지, 계획 기능인지, 수정 필요 항목인지 먼저 확인하고 명세와 테스트를 같은 변경 단위에서 갱신한다.

## 4. 명세 범위와 우선순위

| 우선순위 | 근거 | 역할 |
|---:|---|---|
| 1 | `docs/ai`의 규범 및 수정 필요 항목에 적힌 목표 계약 | 구현 전 작성하는 기준 계약 |
| 2 | 새로 작성할 적합성 suite | 기준 계약을 실행 가능한 형태로 검증 |
| 3 | `packages/*/src` | 계약의 현재 참조 구현 |
| 4 | `docs/guide`, `docs/internals` | 사용자 설명과 설계 배경 |
| 5 | 현재 `example/test`와 `example/*` 데모 | 기존 동작 조사 및 실제 번들·브라우저 통합 참고 |

현재 `example/test` suite는 처음부터 다시 작성할 예정이다. 기존 테스트 통과 여부는 회귀 탐색에 유용한 참고 신호지만, 새 suite가 완성되기 전까지 명세 적합성을 증명하지 않는다. 기존 테스트가 현재 구현의 우발적 결함을 기대값으로 갖는다면 새 문서 계약을 기준으로 폐기하거나 다시 작성한다.

락 파일, 생성된 `dist`, 디버그 출력은 재현 대상의 근거가 아니라 각각 의존성 고정과 빌드 결과다. Commerce Admin의 상품 문구나 CSS 픽셀값도 프레임워크 호환 계약은 아니지만, 예제가 검증해야 하는 기능과 데이터 흐름은 별도 문서에 기록한다.

## 5. 읽기 및 구현 순서

1. [공개 API와 전체 아키텍처](01-public-api-and-architecture.md)
2. [VNode와 깊은 데이터 연산](02-vnode-and-deep-data.md)
3. [컴포넌트 런타임](03-component-runtime.md)
4. [Reconciliation과 DOM 호스트](04-reconciliation-and-dom.md)
5. [스케줄러, 훅, 오류 처리](05-scheduler-hooks-and-errors.md)
6. [Babel 컴파일러](06-babel-compiler.md)
7. [디렉터리 라우터](07-directory-router.md)
8. [Vite 플러그인, 패키지, 빌드](08-vite-plugin-and-build.md)
9. [`create-aeui-app` CLI](09-create-aeui-app.md)
10. [적합성 검증과 변경 절차](10-conformance.md)
11. [예제 애플리케이션 계약](11-reference-applications.md)
12. [소스 모듈 배치와 심볼 목록](12-source-layout.md)

앞 번호의 데이터 구조와 불변조건을 뒤 문서가 전제로 사용한다.

## 6. 구현 파일 추적표

| 현재 구현 파일 | 주 명세 |
|---|---|
| `packages/core/src/core.js`, `index.js` | 01, 02 |
| `vnode-marker.js`, `vnode-helpers.js`, `deep-compare.js` | 02 |
| `app-runtime.js` | 01, 03 |
| `runtime-state.js`, `runtime-context.js`, `node-factory.js` | 03, 05 |
| `component-lifecycle.js`, `compiler-runtime.js` | 03 |
| `reconciler.js`, `dom-host.js` | 04 |
| `runtime.js`, `component-watchers.js`, `hook-registry.js`, `hooks.js` | 05 |
| `babel-plugin.js` | 06 |
| `router.js` | 07 |
| `vite-plugin.js`, `rollup.config.js`, `package.json`, `types/*` | 08 |
| `packages/create-aeui-app/package.json`, `index.js`, `template/*` | 09 |
| `example/test/src/__tests__/*` | 10 |
| `example/vite-demo`, `deep-compare-test`, `commerce-admin`, `letProps`, `shoppingCart` | 11 |
| 전체 source 파일 경계와 private helper manifest | 12 |

새 구현 파일을 추가하면 이 표와 해당 명세의 모듈 매핑을 먼저 갱신한다.

## 7. 시스템 불변조건

모든 하위 명세는 다음 불변조건을 보존해야 한다.

1. 공개 런타임 값은 단일 `AEUI` 객체와 `watch`, `clean` named export다.
2. 컴포넌트 setup 함수는 정상적인 컴파일 결과에서 인스턴스당 한 번 실행되고, 그 함수가 반환한 render 함수가 반복 실행된다.
3. 사용자의 일반 `let` 값과 객체 직접 변이는 별도 setter 없이 다음 렌더에서 관찰된다.
4. 렌더 요청은 DOM 이벤트 다음 프레임의 interactive 경로와 적응형 RAF polling 경로를 함께 사용한다.
5. VNode는 일시적인 선언 데이터이고, RuntimeNode가 상태·수명·DOM 범위를 소유한다.
6. 형제 목록은 key가 있으면 key 우선, key가 없으면 이전 unkeyed 형제 순서로 매칭한다.
7. 컴포넌트와 Fragment는 별도 래퍼 DOM을 만들지 않으며 `firstDom`/`lastDom` 범위로 소유 DOM을 표현한다.
8. `watch` callback은 의존성이 바뀐 렌더에서 실제 render 함수보다 먼저 실행된다.
9. 디렉터리 라우터는 공개 `Router`, `Link`, `navigate` API 없이 `src/pages`와 일반 `<a>`를 이용한다.
10. JSX 파일은 AEUI Babel 변환과 classic JSX 변환을 거쳐야 한다. 컴파일되지 않은 `watch()`는 의도적으로 오류를 낸다.
11. `AEUI.init()`은 컨테이너의 기존 DOM을 비우므로 SSR hydration을 제공하지 않는다.
12. 각 `createAppRuntime()` 호출의 mutable runtime state는 다른 호출과 격리된다. 공개 패키지는 그 팩토리가 만든 단일 기본 앱을 노출한다.

## 8. 명시적인 비목표와 계획 기능의 경계

현재 호환 구현은 다음을 제공할 필요가 없고, 문서 변경 없이 제공해서도 안 된다.

- React 호환 계층, `useState`, hook call-order 규칙
- Proxy 또는 signal 기반 변경 알림
- SSR renderer와 hydration
- concurrent rendering, time slicing, Suspense
- DOM namespace/SVG 전용 생성 규칙
- event capture/options 문법 또는 synthetic event 객체
- `ref` callback/객체 처리
- 공개 imperative router API와 중첩 layout 체계
- 자동 오류 경계나 실패한 update의 완전한 트랜잭션 rollback

실패한 최초 mount에서 setup까지 끝난 provisional component의 cleanup을 보장하는 계획은 마지막 항목의 “완전한 트랜잭션 rollback”과 다르다. 해당 cleanup 보장은 향후 구현할 수 있지만 현재 규범과 적합성 조건에는 포함하지 않는다.

## 9. 재현 완료 조건

새 적합성 suite가 완성된 뒤, 독립 구현은 다음을 모두 만족할 때 AEUI 계약을 재현한 것으로 본다.

- 01~09의 공개 결과, 내부 상태 전이, 경계 및 오류 메시지를 구현하고 12의 모듈 배치를 따른다.
- 패키지의 ESM/CJS/subpath/type 계약이 일치한다.
- 10의 원칙에 따라 새로 작성된 전체 적합성 검증을 통과한다. 현재 `example/test`만 통과한 결과는 완료 조건이 아니다.
- 생성 CLI가 같은 파일 구조와 부트스트랩 방식을 만든다.
- 예제 빌드가 성공하고 11의 통합 시나리오를 수행할 수 있다.
- 추적 파일에 사용자별 절대 경로나 `.DS_Store`를 포함하지 않는다.
