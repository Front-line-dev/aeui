# 10. 적합성 suite 재작성 계획과 임시 검증 절차

## 1. 목적

이 문서는 01~09의 규범을 앞으로 작성할 실행 가능한 적합성 suite에 연결하는 방법을 정한다. 테스트는 구현 세부 함수의 우연한 모양을 복제하는 대신, 문서가 요구하는 관찰 결과와 상태 전이를 검증해야 한다. `AEUI.__runtime`처럼 문서에서 컴파일러·Vite 플러그인과의 결합 계약으로 명시한 내부 surface만 예외적으로 직접 검증한다.

> **현재 상태:** 기존 Vitest suite는 적합성 suite로 인정하지 않는다. 문서 작성 시점의 파일 10개·테스트 170개는 기존 회귀와 **현재 구현**을 조사하기 위한 참고 자료일 뿐이며, 처음부터 다시 작성할 예정이다. 이 숫자나 기존 assertion을 유지하는 것은 목표가 아니다.

기존 suite가 통과했다는 사실은 기존 코드와의 우발적인 회귀가 적다는 참고 신호만 제공한다. 다음 중 어느 것도 증명하지 않는다.

- 구현이 `docs/ai`의 규범적 계약을 만족한다.
- 기존 assertion이 올바른 제품 동작을 기대한다.
- 기존 구현의 알려진 결함이나 비의도적 artifact를 보존해야 한다.
- 문서에 적힌 경계 조건, 실패 정리, package 소비 경로가 충분히 검증되었다.

따라서 새 suite가 완성되기 전에는 `npm test` 성공을 적합성 승인 조건으로 사용할 수 없다.

## 2. 기존 legacy suite 환경 참고

- 테스트 러너: Vitest
- DOM 환경: jsdom
- JSX 테스트 변환 순서: `aeui/babel-plugin` 후 classic JSX transform
- JSX pragma: `AEUI.createElement`
- Fragment pragma: `AEUI.Fragment`
- 공개 패키지 import 이름: `aeui`
- 로컬 패키지 연결: `example/test`에서 `file:../../packages/core`

이 환경 목록은 기존 테스트를 조사하거나 재작성에 활용할 수 있는 utility를 찾기 위한 참고 자료다. 새 suite가 같은 runner, 디렉터리 또는 transform 설정을 그대로 유지해야 한다는 계약은 아니다.

일부 기존 테스트는 `packages/core/src`를 직접 import하고, 통합 테스트는 package entry의 빌드 결과를 import한다. 기존 suite를 참고 실행할 때는 코어를 먼저 빌드해야 stale `dist` 오판을 피할 수 있다. 그렇게 실행한 기존 테스트 결과도 새 명세에 대한 적합성 증거는 아니다.

## 3. 새 적합성 suite 재작성 원칙

새 suite는 기존 파일을 항목별로 보충하는 방식이 아니라 문서 계약에서 다시 설계한다. 다음 원칙을 모두 적용한다.

1. **문서 조항에서 시작한다.** 각 테스트는 `docs/ai`의 장·절과 검증할 문장을 식별한다. 기존 테스트 이름이나 기존 implementation branch를 출발점으로 삼지 않는다.
2. **상태 분류를 기대값에 반영한다.** **규범**만 정상 통과 기대값으로 둔다. **수정 필요** 항목은 잘못된 현재 결과를 정답으로 고정하지 않고 목표 계약을 먼저 쓴 뒤 실패하는 테스트로 연결한다. **계획 기능**은 구현 전까지 별도의 future/pending 상태로 추적한다. **현재 구현**은 마이그레이션 조사 자료이며 자동으로 합격 기준이 되지 않는다.
3. **관찰 가능한 동작을 우선한다.** 공개 API, DOM 결과, lifecycle 순서, cleanup 횟수, scheduler 상태 전이, compiler output의 유효성, router 결과와 package import 성공을 검증한다. private helper 이름이나 현재 파일 분할은 그 자체가 명시적 ABI가 아닌 한 expected value가 아니다.
4. **정상·경계·실패를 분리한다.** 각 계약마다 정상 경로뿐 아니라 nullish, duplicate, malformed input, throw, partial mount, teardown과 재진입 경계를 독립된 테스트로 만든다. 한 통합 테스트가 여러 계약을 우연히 거치는 것으로 coverage를 대신하지 않는다.
5. **결정적으로 실행한다.** RAF, polling, event와 timer는 명시적으로 제어한다. wall-clock 대기나 테스트 실행 순서에 기대지 않으며, 각 테스트는 runtime, DOM, module registry와 mock을 완전히 격리한다.
6. **계층별 증거를 만든다.** 값/VNode 단위 테스트, compiler transform 테스트, runtime/DOM 통합 테스트, router/Vite fixture 테스트, 생성 tarball 소비 smoke, reference app/browser smoke를 분리한다.
7. **기존 코드는 자료로만 사용한다.** 기존 fixture나 helper는 그 의미를 문서와 다시 대조한 뒤 재사용할 수 있지만, 기존 assertion을 복사했다는 이유로 계약이 확정되지는 않는다.
8. **추적표를 유지한다.** 모든 규범 조항은 새 test ID 또는 명시적인 future 상태에 연결되어야 한다. 반대로 모든 새 테스트도 근거 문서 조항을 가져야 한다.

새 suite의 최소 계층은 다음과 같다.

| 계층 | 주된 검증 대상 |
|---|---|
| 값과 VNode | deep equality/clone, VNode shape와 child 정규화 |
| 컴파일러 | 입력 source, 변환된 유효 JavaScript, import와 component/hook rewrite |
| runtime과 DOM | setup/render/watch/cleanup, reconciliation, event, controlled property, scheduler |
| router와 Vite | route fixture, mode 선택, virtual entry, extension/parser 일관성 |
| package 소비 | 실제 tarball을 설치한 ESM/CJS 소비 프로젝트와 TypeScript public API |
| reference app | build 결과와 실제 브라우저 상호작용의 최소 smoke |

새 suite가 적합성 기준으로 전환되려면 규범 조항 추적표, 독립 실행, 실패 경계, package 소비 smoke가 모두 갖춰져야 한다. 그전까지 기존 suite와 아래 명령은 참고용 안전망이다.

### 3.1 현재 전환 항목의 테스트 상태

| 상태 | 항목 | 새 suite에서의 취급 |
|---|---|---|
| **계획 기능** | 부분 mount 실패의 provisional component cleanup | 구현 전에는 future로 추적하고 현재 pass 조건에서 제외한다. ABI를 확정한 뒤 cleanup 1회 성공 테스트를 작성한다. |
| **계획 기능** | 동일 file input props의 실제 mutation 기반 backoff | 구현 전에는 future로 추적한다. 이후 실제 attribute 제거 유무와 frameDelay 전이를 함께 검증한다. |
| **계획 기능** | component props ArrayPattern | 현재 TypeError를 기대값으로 고정하지 않는다. 입력 ABI를 확정한 뒤 성공 경로를 새로 작성한다. |
| **계획 기능** | 더 정확한 event prop 판정 | 현재 `once -> ce`를 합격 조건으로 만들지 않는다. 이름 규칙 확정 뒤 일반 prop/event 등록/해제를 각각 검증한다. |
| **수정 필요** | file type 대소문자 판정 | `file`, `FILE`, `File` 모두 value property에 사용자 값을 쓰지 않는 목표 테스트를 먼저 둔다. |
| **수정 필요** | Babel default/namespace import 보존 | 생성 결과의 parse 성공과 기존 import specifier 종류·binding 의미 보존을 검증한다. |
| **수정 필요** | 공식 route/source 확장자 통일 | 여섯 공식 확장자의 전 계층 일치와 목록 밖 suffix의 제외를 검증한다. |
| **수정 필요** | public/internal virtual entry 중복 방지 | 실제 module script의 두 id는 중복 주입하지 않고 `data-src`·주석은 오인하지 않는지 검증한다. |
| **수정 필요** | boolean `aria-*` 의미 | `true`/`false` 문자열 attribute와 nullish 제거, expando 비생성을 검증한다. |
| **현재 구현** | props target 열거·삭제·복사 의미 | 03 §7.3의 정확한 사실 설명을 참고한다. 이를 더 강한 일반 객체 replacement 계약으로 확대하지 않는다. |
| **현재 구현** | deep clone의 `__proto__` 대입 예외 | 02 §8의 정확한 사실 설명을 참고한다. 안전한 clone으로 바꾸려면 별도 규범 변경을 먼저 한다. |

## 4. 재작성 완료 전 참고 검증 순서

새 suite가 완성되기 전에도 명백한 build 파손과 기존 동작의 급격한 변화를 빨리 찾기 위해 저장소 루트에서 다음 순서를 참고 실행할 수 있다.

```bash
npm run build:core
npm test
npm run typecheck
npm run build:examples
npm pack --dry-run --workspace a-easy-ui --cache <temporary-cache-directory>
# 계획된 새 package-consumer smoke로 대체해야 하는 현재 수동 단계
# 임시 소비 프로젝트에서 생성 tarball을 설치한 뒤 ESM/CJS root 및 두 subpath import 확인
git diff --check
```

`<temporary-cache-directory>`는 저장소 밖의 임시 경로를 사용한다. 검증 과정에서 npm cache나 생성 산출물을 추적 파일로 추가하지 않는다.

여기서 `npm test`는 기존 suite의 참고 신호이고, 주석으로 남은 package 소비 단계도 아직 재현 가능한 자동 적합성 검증이 아니다. 각 명령이 성공해도 문서 계약 승인으로 해석하지 않는다.

문서만 변경한 경우에는 Markdown 링크와 heading, 용어·상태 분류의 일관성, `git diff --check`를 우선 확인한다. 기존 `npm test`와 typecheck를 함께 실행할 수 있지만, 문서 의미가 올바른지는 새 suite 또는 직접적인 조항별 검토로 별도 확인한다.

## 5. 기존 테스트 파일별 참고 범위

아래 목록은 기존 파일 이름과 관련 동작을 조사하기 위한 inventory다. 현재 170개 테스트가 각 bullet을 실제로, 독립적으로, 올바른 기대값으로 단언한다는 뜻이 아니다. 새 suite가 이 파일 구조나 bullet 구성을 유지해야 한다는 뜻도 아니다.

특히 다른 장에서 **계획 기능**, **수정 필요**, **현재 구현**으로 분류한 동작은 이 목록에 나타나더라도 현재 결과를 통과 기준으로 삼지 않는다. 재작성 때 각 bullet을 규범 문서와 다시 대조하여 채택, 수정, future 분리 또는 폐기한다.

### 5.1 `unit.test.js`: 값 연산과 공개 VNode API

현재 파일 및 관련 문서에서 다루는 항목의 참고 목록은 다음과 같다.

- 원시값, 중첩 배열, 일반 객체, Date, Map, Set의 깊은 동등성
- enumerable own string key만 사용하는 일반 객체 비교
- Set의 순서 독립 객체 매칭과 deep-equal 중복 객체의 1:1 소비
- 같은 참조 객체 fast path와 구조 비교의 공존
- 순환 객체, 배열, Set의 종료와 그래프 구조 구분
- VNode는 같은 참조일 때만 동등하고, VNode처럼 보이는 일반 객체는 일반 데이터로 취급
- 배열, 객체, Date, 순환 구조의 독립 복제
- VNode 참조 보존
- `createVNode`의 필드, non-enumerable symbol marker, children 공유 배열
- 원본 또는 frozen props 비변이
- nullish child 필터링
- `createElement === createVNode`
- Fragment render 함수가 render 시점 `props.children`을 반환
- legacy `_tick`, `_didMutate` 등이 공개 `AEUI` 최상위에 없음

### 5.2 `vnode-helpers.test.js`: VNode 보조 규칙

- `props.key` 추출과 null 정규화
- 배열 및 `AEUI.Fragment` VNode 판별
- 두 Fragment 표현에서 children 반환

### 5.3 `runtime-state.test.js`: mutable state shape

- 초기 root/container/component/context/scheduler/event 필드 값
- reset 후 렌더 및 scheduler flag 초기화
- reset이 `deepEqual`, `deepClone`과 런타임에 바인딩된 helper를 삭제하지 않음
- router teardown이 있으면 reset 전에 실행됨

### 5.4 `runtime-context.test.js`: 중첩 컨텍스트

- 컨텍스트 밖에서 `getRuntimeContext()`는 null
- 서로 다른 app runtime이 중첩되어도 최상위 stack 값 반환
- 내부 callback 종료 후 외부 node와 phase 복구
- 예외가 발생해도 `finally`로 stack 및 이전 상태 복구

### 5.5 `component-lifecycle.test.js`: setup/render/cleanup

- truthy render factory를 반환하는 setup은 node당 한 번만 실행
- 다음 props가 watcher보다 먼저 node와 compiler props target에 반영
- watcher가 render보다 먼저 실행
- component render 결과가 같은 component node의 `renderedNode`, `children`, DOM 범위로 commit
- cleanup callback 오류 격리
- cleanup 후 watcher, cleanup, render factory, render alias 및 소유 필드 초기화

### 5.6 `app-runtime.test.js`: 앱 인스턴스 조립

- `createAppRuntime()` 호출마다 state 객체가 독립
- polling backoff가 남아 있어도 `requestRender()` 후 다음 animation frame에 tick 실행
- state에 바인딩된 helper가 자기 runtime의 internal method를 동적으로 호출

### 5.7 `dom.test.js`: DOM host, reconciler, scheduler

현재 파일과 문서에 연결된 그룹을 조사할 때 다음 inventory를 참고한다.

**속성 및 이벤트**

- `children`, `key`, `ref`, `__self`, `__source`를 DOM과 snapshot에서 제외
- `className`, 문자열/객체 style, boolean, 일반 attribute 설정과 제거
- boolean 제거 시 DOM property를 false로 복구
- `value`의 property/attribute 동기화와 nullish 제거
- file input에는 value property를 쓰지 않고 text에서 file로 바뀔 때 기존 value attribute 제거
- event proxy 한 개를 유지하면서 handler 교체
- 함수가 아닌 handler로 바뀔 때 proxy listener와 handler 제거
- handler의 `this`는 현재 DOM node

**controlled property 복구**

- option mount 뒤 select value 동기화
- 외부에서 바뀐 input/textarea value를 동일 props의 다음 reconcile에서 복구
- 외부에서 바뀐 checkbox checked 복구
- 같은 style 객체를 직접 변이해도 deep-cloned snapshot으로 감지

**형제 diff와 DOM range**

- 배열 증가/감소
- keyed host 노드의 identity 유지 및 순서 변경
- keyed 중간 삽입 시 기존 형제 유지
- mixed keyed/unkeyed 매칭 규칙
- duplicate key 경고 후 렌더 계속
- 순서가 같으면 불필요한 `insertBefore`를 호출하지 않음
- Fragment와 component가 차지하는 연속 DOM 범위 이동

**unmount와 cleanup**

- node를 unmounted로 표시
- watcher 비우기, cleanup 실행 및 오류 격리
- 자식 subtree 재귀 unmount
- DOM 범위 제거와 component 소유 필드 해제

**스케줄러와 실패 정리**

- init 시 scheduler 예약, 재-init 시 기존 예약 취소 후 새 예약
- 무변화 polling 간격 `1 -> 2 -> 4` 및 최대 60
- DOM 변화 시 간격 1 복구
- `AEUI.render()`의 즉시 tick 및 boolean 결과
- component node 생성과 setup 실행의 분리
- setup/render 오류 뒤 component context 복구
- 실패 중 삽입된 미커밋 DOM이 다음 렌더에 누적되지 않음
- watcher 하나의 오류가 다른 watcher와 render를 막지 않음
- watcher callback 뒤 다시 읽은 최종 deps가 snapshot이 됨

### 5.8 `component.test.jsx`: 컴파일러와 런타임 통합

기존 통합 테스트와 관련 문서가 다루는 시나리오 inventory는 다음과 같다. 새 suite에서는 계약별로 분리하고 기대값을 다시 결정한다.

- 기본 mount와 setup 1회 실행
- 클릭 후 수동 tick, 여러 클릭 batching, 다음 RAF 자동 렌더 및 여러 이벤트 병합
- 부모 props 갱신과 props watcher
- deps 길이 감소, local state deps, named callback, callback 내부 재변경
- 같은 tick의 여러 deps 변화가 callback 1회만 유발
- render phase의 `watch` 등록 무시
- 구식 `watch(deps, callback)` 호출에 대한 guard 오류
- alias/default/nested/rest를 포함한 object props 구조 분해 최신화
- expression-body, conditional, logical, 수동 render 함수 및 render param default
- root 교체, 조건부 제거, key 교체 시 정확히 한 번 cleanup
- 배열 추가/삭제와 keyed component/host 재정렬의 상태 보존
- Fragment와 중첩 component 범위
- 같은 component의 여러 인스턴스 상태 격리
- 형제 중 일부 제거 및 부모 host 타입 교체 시 올바른 cleanup과 나머지 상태 보존
- router layout/page/route prop, anchor delegation, popstate 통합

### 5.9 `babel-plugin.test.js`: 정적 변환

- JSX가 있으면 `AEUI` named import 자동 주입
- 기존 `aeui` import의 첫 specifier로 `AEUI` 추가
- JSX와 compiled helper가 없으면 import 미주입
- JSX를 반환하지 않는 PascalCase helper 미변환
- local `AEUI` binding 충돌 시 code-frame compile error
- renderable anonymous default export 변환, non-renderable named/anonymous helper 미변환
- 구조 분해/default props를 최신 props target으로 rewrite
- 수동 render param 보존
- `watch`와 `clean`을 `AEUI.__runtime` helper로 rewrite
- 정확히 인자 두 개인 callback-first watch만 변환
- deps가 함수가 아니면 getter로 래핑
- deps 생략, 세 번째 options 인자, 배열이 첫 인자인 구식 순서는 runtime watch helper로 변환하지 않음

기존 “첫 specifier로 `AEUI` 추가” assertion은 named-only import의 현재 경로를 조사하는 자료일 뿐 모든 import 문법의 목표 계약이 아니다. 새 suite는 default import 의미 보존과 namespace import용 별도 named declaration을 06 §3.3에 따라 검증해야 한다. component ArrayPattern의 현재 TypeError는 **계획 기능**의 미구현 상태이므로 실패 결과를 호환 assertion으로 복사하지 않는다.

### 5.10 `router.test.js`: route table과 Vite 결합

- index/static/dynamic/catch-all/fallback 및 반복 query
- 공개 지원 확장자 `js`, `jsx`, `ts`, `tsx`, `mjs`, `cjs`
- static > dynamic > catch-all 우선순위
- index exact match와 비어 있지 않은 catch-all remainder
- malformed percent encoding의 fallback
- URL-decoded static segment 비교
- 마지막 위치가 아닌 catch-all 파일 제외
- 동일 origin 기본 좌클릭만 가로채기
- modifier/middle/external/download/new-tab 클릭 미처리
- 수동 main script 유무에 따른 가상 entry 주입
- script attribute 순서와 `data-*` false positive 방지
- 기본 `@ -> src` alias 및 기존 alias 보존
- route 파일 존재 시 eager glob router bootstrap 생성
- JSX/TSX/TS 모듈의 pre-transform

### 5.11 기존 suite에서 확인된 coverage 공백

다음은 문서 작성 시점에 기존 suite가 간접적으로만 거치거나 전혀 직접 단언하지 않는다고 확인한 공백이다. 새 suite 설계 시 참고하되, 이 목록만 채우면 재작성이 끝난 것으로 보지 않는다. **계획 기능**은 현재 실패 결과가 아니라 future 상태로 등록하고, **수정 필요** 항목은 목표 계약을 검증한다.

- runtime reset의 `deepEqual` 및 app-runtime helper 보존, router teardown 호출, 실제 예약 RAF 취소 책임의 분리
- runtime context callback이 throw할 때의 stack/phase 복구
- component lifecycle에서 props target 동기화의 구체적 내용, watcher-before-render 호출 순서, cleanup 오류 격리와 render alias 초기화
- VNode의 `props.children === vnode.children` 참조 동일성, key의 nullish/`0`/`false` 경계
- host snapshot의 `children`/`key`/`ref` 제외와 `value` nullish 제거
- handler 교체 시 proxy listener 한 개 유지 및 multi-DOM Fragment/component range 이동
- 재-init 시 이전 RAF에 대한 cancel 호출 자체
- component ArrayPattern props의 현재 TypeError 원인과 향후 입력 ABI 결정 필요성. TypeError 자체를 합격 기대값으로 만들지 않음
- 배열을 첫 argument로 둔 legacy watch 호출의 미변환과 dynamic/catch-all pattern 충돌의 module insertion-order 선점
- 생성 tarball을 실제 소비 프로젝트에 설치한 뒤 ESM/CJS에서 root, `babel-plugin`, `vite` 세 진입점을 불러오는 smoke

이 항목을 기존 suite에 부분적으로 추가하거나 수동 검증하는 것만으로 적합성 작업을 완료 처리하지 않는다. 새 suite에서 해당 문서 조항의 상태와 기대 동작을 다시 정한 뒤 독립 테스트로 작성한다.

## 6. 오류 및 경고 문자열 inventory

다음은 현재 구현에서 관찰되는 오류 prefix inventory다. 각 문자열을 문자 단위 호환 계약으로 유지할지는 관련 규범 조항과 공개 API 정책을 검토하여 새 suite에서 결정한다. 새 suite 결정 전에는 기존 출력 변화 탐지에만 참고한다.

| 상황 | 출력 |
|---|---|
| 컴파일되지 않은 public watch | `[AEUI] watch(callback, deps) must be compiled by the AEUI Babel plugin.` |
| callback이 함수가 아님 | `[AEUI] watch(callback, deps) requires callback to be a function.` |
| deps 생략 | `[AEUI] watch(callback, deps) requires deps.` |
| deps 결과가 배열이 아님 | `[AEUI] watch(callback, deps) requires deps to be an array or a function that returns an array.` |
| watcher 예외 | `console.error('[AEUI] Watcher error:', error)` |
| cleanup 예외 | `console.error('[AEUI] Cleanup error:', error)` |
| render/reconcile 예외 | `console.error('[AEUI] Render error:', error)` |
| sibling duplicate key | ``console.warn(`[AEUI] Duplicate key detected in sibling list: ${String(key)}`)`` |
| JSX runtime binding 충돌 | `[AEUI] Local AEUI bindings conflict with the JSX runtime import. Rename the local binding or import { AEUI } from "aeui".` |

로깅되는 오류는 해당 callback 또는 tick 경계에서 격리하지만, Babel compile error와 직접 호출한 registry validation error는 호출자에게 throw한다.

## 7. 패키지 및 저장소 위생 검사

이 항목은 legacy assertion과 별개로 package 및 저장소 산출물에서 직접 확인한다. 새 적합성 suite에는 가능한 항목을 자동화한다.

- `npm pack --dry-run` 결과에 package manifest의 `files` 범위 밖 파일이 없음
- ESM과 CJS에서 root, `babel-plugin`, `vite` subpath를 각각 불러올 수 있음
- TypeScript public API smoke가 strict NodeNext 설정에서 통과
- 추적 파일에 `.DS_Store`가 없음
- 추적 파일 내용에 운영체제별 사용자 홈을 가리키는 절대 경로가 없음
- 새 Markdown 상대 링크가 실제 파일 또는 heading을 가리킴
- `docs/roadmap.md`에는 완료된 현재 동작을 옮겨 적지 않음

## 8. 변경 완료 체크리스트

- [ ] 변경하려는 동작이 먼저 `docs/ai`에 쓰였다.
- [ ] 정상 경로뿐 아니라 nullish, duplicate, malformed, teardown, error 경계를 명시했다.
- [ ] 컴파일 전/후 계약이 모두 영향을 받는지 확인했다.
- [ ] 공개 API, `__runtime`, 타입 선언, package exports의 일관성을 확인했다.
- [ ] 새 적합성 suite의 test ID가 변경한 규범 문장을 직접 가리키며 검증한다. 새 suite가 아직 준비되지 않았다면 완료로 표시하지 않고 그 사실을 기록한다.
- [ ] 빌드된 코어로 새 테스트와 예제를 검증했다. 기존 `npm test`만 통과한 상태는 참고 신호로 별도 기록했다.
- [ ] 사용자 가이드와 내부 해설의 대상 독자를 섞지 않았다.
- [ ] 생성물, cache, 절대 경로, `.DS_Store`를 추적하지 않았다.
