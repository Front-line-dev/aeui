# 알려진 구현 결함

이 문서는 현재 코드가 [`docs/spec`](../spec/README.md)을 위반하는 지점을 추적한다. 올바른 결과는 각 항목에 연결된 스펙 조항만 정의한다. 아래의 회귀 검증 범위는 결함이 다시 생기지 않는지 확인할 사례이며 별도 계약이 아니다.

모든 항목의 초기 상태는 **open**, 우선순위는 **high**다.

## 목록

| ID | 영역 | 위반한 스펙 |
|---|---|---|
| `AEUI-DATA-FIX-001` | 깊은 비교의 대칭성·타입·참조 그래프 | [02 §7 `_deepEqual`](../spec/02-vnode-and-deep-data.md#7-_deepequal) |
| `AEUI-DATA-FIX-002` | `__proto__` own property 안전 복제 | [02 §8 `_deepClone`](../spec/02-vnode-and-deep-data.md#8-_deepclone) |
| `AEUI-DOM-FIX-001` | boolean `aria-*` 의미 | [04 §11.3 boolean과 일반 attribute](../spec/04-reconciliation-and-dom.md#113-boolean과-일반-attribute) |
| `AEUI-DOM-FIX-002` | file input type 대소문자 판정 | [04 §13 value와 checked](../spec/04-reconciliation-and-dom.md#13-value와-checked) |
| `AEUI-COMPILER-IMPORT-FIX-001` | default·namespace import 보존 | [06 §3.3 import 생성과 충돌 처리](../spec/06-babel-compiler.md#33-import-생성과-충돌-처리) |
| `AEUI-COMPILER-FIX-001` | 일반 callback의 컴포넌트 오판 | [06 §5.3 컴포넌트 근거와 판정](../spec/06-babel-compiler.md#53-컴포넌트-근거와-판정) |
| `AEUI-COMPILER-FIX-002` | compiler 생성 이름 충돌 | [06 §7.1 공통 target](../spec/06-babel-compiler.md#71-공통-target) |
| `AEUI-COMPILER-FIX-003` | named dependency getter 오변환 | [06 §8.4 dependency getter 분류](../spec/06-babel-compiler.md#84-dependency-getter-분류) |
| `AEUI-COMPILER-FIX-004` | hook import alias 오판 | [06 §8.1 hook call 판별](../spec/06-babel-compiler.md#81-hook-call-판별) |
| `AEUI-COMPILER-FIX-005` | 사용자 render parameter를 wrapper로 오인 | [06 §9.2 wrapper idempotence](../spec/06-babel-compiler.md#92-wrapper-idempotence) |
| `AEUI-ROUTER-FIX-001` | route/source 확장자 집합 불일치 | [07 §2.3 router mode 선택](../spec/07-directory-router.md#23-router-mode-선택), [08 §2 공식 확장자](../spec/08-vite-plugin-and-build.md#2-vite-플러그인-상수와-공식-확장자) |
| `AEUI-VITE-FIX-001` | public/internal virtual entry 중복 주입 | [07 §2.2 HTML entry 주입](../spec/07-directory-router.md#22-html-entry-주입), [08 §5.2 주입 규칙](../spec/08-vite-plugin-and-build.md#52-주입-규칙) |

## 데이터 연산

### `AEUI-DATA-FIX-001`: `_deepEqual`

- 현재 잘못된 결과: 단방향 `a -> b` 대응만 기록해 인자 순서에 따라 결과가 달라질 수 있고, 서로 다른 내장 타입이나 공유 참조 구조를 같은 값으로 판단할 수 있다.
- 영향 코드: `packages/core/src/deep-compare.js`
- 회귀 검증 범위: 인자 순서 대칭성, 내장 타입 일치, 순환·공유 참조의 일대일 대응과 Set 후보별 격리 상태.

### `AEUI-DATA-FIX-002`: `_deepClone`

- 현재 잘못된 결과: enumerable own `__proto__`를 일반 대입해 property를 잃고 clone의 prototype을 바꿀 수 있다.
- 영향 코드: `packages/core/src/deep-compare.js`
- 회귀 검증 범위: `__proto__` own data property, clone의 prototype과 전역 prototype 불변성.

## DOM

### `AEUI-DOM-FIX-001`: boolean `aria-*`

- 현재 잘못된 결과: `true`와 `false`를 HTML boolean attribute처럼 빈 문자열 또는 제거로 처리한다.
- 영향 코드: `packages/core/src/dom-host.js`
- 회귀 검증 범위: `true`, `false`, nullish 값과 expando property 부재.

### `AEUI-DOM-FIX-002`: file input type

- 현재 잘못된 결과: controlled sync 경로가 `type="FILE"`과 `type="File"`을 일반 input으로 오인해 금지된 non-empty value 쓰기를 시도할 수 있다.
- 영향 코드: `packages/core/src/dom-host.js`, `packages/core/src/component-lifecycle.js`
- 회귀 검증 범위: `file`, `FILE`, `File`과 모든 controlled DOM 갱신 경로.

## Babel 컴파일러

### `AEUI-COMPILER-IMPORT-FIX-001`: import 병합

- 현재 잘못된 결과: default import를 named import처럼 바꾸거나 namespace import declaration에 named specifier를 섞어 유효하지 않은 ECMAScript를 만들 수 있다.
- 영향 코드: `packages/core/src/babel-plugin.js`
- 회귀 검증 범위: named/default/namespace/alias 조합의 문법과 binding 의미.

### `AEUI-COMPILER-FIX-001`: 컴포넌트 판별

- 현재 잘못된 결과: 임의 호출의 첫 번째 인자라는 이유만으로 `map`, timer, registration callback 같은 일반 함수를 컴포넌트로 변환할 수 있다.
- 영향 코드: `packages/core/src/babel-plugin.js`
- 회귀 검증 범위: 스펙이 허용한 component 근거의 positive fixture와 일반 callback negative fixture.

### `AEUI-COMPILER-FIX-002`: 생성 identifier

- 현재 잘못된 결과: 고정된 `__props` identifier가 사용자 binding과 충돌한다.
- 영향 코드: `packages/core/src/babel-plugin.js`
- 회귀 검증 범위: 생성 identifier와 같은 이름 또는 비슷한 이름을 쓰는 사용자 binding.

### `AEUI-COMPILER-FIX-003`: named dependency

- 현재 잘못된 결과: 이름 있는 dependency getter를 함수 객체 자체를 반환하는 `() => getDeps` 형태로 바꿀 수 있다.
- 영향 코드: `packages/core/src/babel-plugin.js`
- 회귀 검증 범위: inline·named getter, local dependency value와 판별할 수 없는 binding.

### `AEUI-COMPILER-FIX-004`: hook alias

- 현재 잘못된 결과: `aeui`에서 import된 원래 이름이 아니라 local 이름만 보고 `watch`와 `clean`을 판별한다.
- 영향 코드: `packages/core/src/babel-plugin.js`
- 회귀 검증 범위: `watch as observe`, `clean as watch`, 비-AEUI import와 shadowed binding.

### `AEUI-COMPILER-FIX-005`: wrapper idempotence

- 현재 잘못된 결과: render parameter 이름이 `_newProps`로 시작하면 사용자 코드도 compiler 생성 wrapper로 오인한다.
- 영향 코드: `packages/core/src/babel-plugin.js`
- 회귀 검증 범위: `_newProps` 계열 사용자 parameter와 compiler output 재처리.

## Router와 Vite

### `AEUI-ROUTER-FIX-001`: 공식 확장자 집합

- 현재 잘못된 결과: detector와 runtime parser는 12개 suffix를 허용하지만 eager glob과 parser plugin은 공식 여섯 확장자만 처리한다.
- 영향 코드: `packages/core/src/router.js`, `packages/core/src/vite-plugin.js`
- 회귀 검증 범위: 여섯 공식 확장자와 `.mts`, `.cts`, `.mjsx`, `.cjsx` 같은 목록 밖 확장자.

### `AEUI-VITE-FIX-001`: virtual entry 중복

- 현재 잘못된 결과: HTML에 public `/@aeui-entry`가 있어도 internal `virtual:aeui-entry`만 검사해 script를 중복 주입할 수 있다.
- 영향 코드: `packages/core/src/vite-plugin.js`
- 회귀 검증 범위: internal/public ID, 실제 module script, `data-src`, 주석과 일반 문자열.
