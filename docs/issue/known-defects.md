# 알려진 구현 결함

이 문서는 현재 코드가 [`docs/spec`](../spec/README.md)을 위반하는 지점을 추적한다. 올바른 결과는 각 항목에 연결된 스펙 조항만 정의한다. 아래의 회귀 검증 범위는 결함이 다시 생기지 않는지 확인할 사례이며 별도 계약이 아니다.

모든 항목의 초기 상태는 **open**, 우선순위는 **high**다.

## 목록

| ID | 영역 | 위반한 스펙 |
|---|---|---|
| `AEUI-DATA-FIX-001` | 깊은 비교의 대칭성·타입·참조 그래프 | [02 §7 `_deepEqual`](../spec/02-vnode-and-deep-data.md#7-_deepequal--깊은-비교) |
| `AEUI-DATA-FIX-002` | `__proto__` own property 안전 복제 | [02 §8 `_deepClone`](../spec/02-vnode-and-deep-data.md#8-_deepclone--깊은-복사) |
| `AEUI-DOM-FIX-001` | boolean `aria-*` 의미 | [04 §10.2 props 적용 규칙](../spec/04-reconciliation-and-dom.md#props-적용-규칙) |
| `AEUI-DOM-FIX-002` | file input type 대소문자 판정 | [04 §12 controlled input: value와 checked](../spec/04-reconciliation-and-dom.md#12-controlled-input-value와-checked) |
| `AEUI-COMPILER-IMPORT-FIX-001` | default·namespace import 보존 | [06 §3.3 충돌 처리](../spec/06-babel-compiler.md#33-충돌-처리) |
| `AEUI-COMPILER-FIX-001` | 일반 callback의 컴포넌트 오판 | [06 §4.2 컴포넌트 판별 기준](../spec/06-babel-compiler.md#42-컴포넌트-판별-기준) |
| `AEUI-COMPILER-FIX-002` | compiler 생성 이름 충돌 | [06 §6.2 identifier props](../spec/06-babel-compiler.md#62-identifier-props) |
| `AEUI-COMPILER-FIX-003` | named dependency getter 오변환 | [06 §7.4 deps getter 분류](../spec/06-babel-compiler.md#74-deps-getter-분류) |
| `AEUI-COMPILER-FIX-004` | hook import alias 오판 | [06 §7.1 hook 판별 — binding 기반](../spec/06-babel-compiler.md#71-hook-판별--binding-기반) |
| `AEUI-COMPILER-FIX-005` | 사용자 render parameter를 wrapper로 오인 | [06 §8 render phase wrapper 생성](../spec/06-babel-compiler.md#8-render-phase-wrapper-생성) |
| `AEUI-ROUTER-FIX-001` | route/source 확장자 집합 불일치 | [07 §2 Vite 자동 부트스트랩](../spec/07-directory-router.md#2-vite-자동-부트스트랩), [08 §5.1 대상 판별](../spec/08-vite-plugin-and-build.md#대상-판별) |
| `AEUI-VITE-FIX-001` | public/internal virtual entry 중복 주입 | [07 §2 Vite 자동 부트스트랩](../spec/07-directory-router.md#2-vite-자동-부트스트랩), [08 §3 HTML entry 자동 주입](../spec/08-vite-plugin-and-build.md#3-html-entry-자동-주입) |

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

- 현재 잘못된 결과: `updateDomProps`의 file input 판정은 `String(type).toLowerCase() === 'file'`로 대소문자를 올바르게 무시하나, `syncHostControlledProps`의 controlled sync 경로가 `type !== 'file'`로 정확한 문자열만 비교해 `type="FILE"`과 `type="File"`을 일반 input으로 오인하고 금지된 non-empty value 쓰기를 시도할 수 있다.
- 영향 코드: `packages/core/src/dom-host.js`
- 회귀 검증 범위: `file`, `FILE`, `File`과 `updateDomProps`·`syncHostControlledProps` 두 경로 모두의 controlled DOM 갱신.

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

- 현재 잘못된 결과: 고정된 `__props` identifier가 사용자 binding과 충돌한다. 스펙 §6.2는 컴파일러가 생성하는 identifier가 사용자 binding과 충돌하지 않고 scope-safe한 고유 이름을 생성해야 한다고 규정한다.
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

- 현재 잘못된 결과: HTML에 public `/@aeui-entry`가 있어도 internal `virtual:aeui-entry`만 검사해 script를 중복 주입할 수 있다. 스펙 §3은 `virtual:aeui-entry` 또는 `/@aeui-entry` 둘 다 검사해야 하며, 수동 main 감지 시 실제 `<script>` 태그의 `type="module"` attribute만 대상으로 하고 `data-src`, HTML 주석, 일반 문자열 내의 경로는 module script로 판정하지 않아야 한다고 규정한다.
- 영향 코드: `packages/core/src/vite-plugin.js`
- 회귀 검증 범위: internal/public ID, 실제 module script, `data-src`, 주석과 일반 문자열.
