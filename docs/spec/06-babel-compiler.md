# 06. Babel 컴파일러

AEUI의 핵심 마법은 **Babel 플러그인**에 있다. 이 플러그인이 일반 함수처럼 보이는 컴포넌트 코드를 AEUI 런타임이 이해하는 형태로 변환한다.

먼저 변환 전후를 비교해 직관적으로 이해한 뒤, 세부 규칙을 설명한다.

---

## 1. 전체 변환 예시 — 변환 전과 후

### 입력 (개발자가 작성하는 코드)

```jsx
import { watch, clean } from 'aeui';

export function Card({ title: label = 'Guest', ...rest } = {}) {
  let n = 0;
  watch(() => console.log(label), [label, n]);
  clean(() => { n = 0; });
  return ({ suffix = '!' }) => (
    <p data-x={rest.x}>{label}{suffix}{n}</p>
  );
}
```

### 출력 (Babel이 만드는 코드)

```js
import { AEUI, watch, clean } from 'aeui';

export function Card(_initialProps) {
  // 1. props 기본값 처리
  const _initialPropsValue = _initialProps === undefined ? {} : _initialProps;
  const _props = { ..._initialPropsValue };
  
  // 2. 구조 분해를 재실행 가능한 함수로
  const _resolveProps = () => {
    const { title: label = 'Guest', ...rest } = _props;
    return { rest, label };
  };
  
  // 3. 초기 구조 분해 (setup에서 사용)
  let { title: label = 'Guest', ...rest } = _initialPropsValue;

  let n = 0;
  
  // 4. watch → runtime helper로 변환
  AEUI.__runtime.watch(() => {
    const _resolvedProps = _resolveProps();
    return console.log(_resolvedProps.label);
  }, () => {
    const _resolvedProps2 = _resolveProps();
    return [_resolvedProps2.label, n];
  });
  
  // 5. clean → runtime helper로 변환
  AEUI.__runtime.clean(() => { n = 0; });

  // 6. render 함수 → runtime wrapper로
  return _newProps => AEUI.__runtime.runRenderPhase(
    _newProps,
    _props,
    _renderProps => {
      const _resolvedProps3 = _resolveProps();
      const { suffix = '!' } = _renderProps;
      return AEUI.createElement(
        'p',
        { 'data-x': _resolvedProps3.rest.x },
        _resolvedProps3.label,
        suffix,
        n
      );
    }
  );
}
```

---

## 2. 플러그인이 하는 네 가지 일

| 번호 | 변환 | 목적 |
|---|---|---|
| 1 | **AEUI import 보장** | JSX가 `AEUI.createElement`를 호출하므로 import가 필요 |
| 2 | **return JSX → return () => JSX** | 함수 본문(setup)과 렌더 함수를 분리 |
| 3 | **props 파라미터 변환** | 매 렌더마다 최신 props를 받을 수 있도록 가변 target 생성 |
| 4 | **watch/clean → runtime helper** | 각 앱의 state에 바인딩된 내부 함수로 연결 |

플러그인 자체는 **JSX를 호스트 호출로 변환하지 않는다**. 직접 통합할 때는 AEUI 플러그인 뒤에 classic JSX transform을 둬야 한다:

```js
plugins: [
  aeuiTransform,
  [jsxTransform, {
    pragma: 'AEUI.createElement',
    pragmaFrag: 'AEUI.Fragment',
  }],
]
```

---

## 3. AEUI import 주입

### 3.1 올바른 import의 정의

```js
import { AEUI } from 'aeui';  // ✅ 올바름

import AEUI from 'aeui';                // ❌ default import
import * as AEUI from 'aeui';           // ❌ namespace import
import { AEUI as Runtime } from 'aeui'; // ❌ 다른 local 이름
import { Runtime as AEUI } from 'aeui'; // ❌ 다른 imported 이름
```

### 3.2 import가 필요한 경우

프로그램 전체를 순회하며 다음 중 하나를 발견하면 import를 추가한다:

- `JSXElement` 또는 `JSXFragment`가 있음
- `AEUI`라는 identifier에 binding이 없음
- `AEUI`가 올바른 import가 아닌데 `AEUI.createElement`, `AEUI.createVNode`, `AEUI.Fragment`, `AEUI.__runtime` 형태로 사용됨

### 3.3 충돌 처리

이미 같은 이름의 다른 local binding이 있으면 컴파일 오류:

```
[AEUI] Local AEUI bindings conflict with the JSX runtime import.
Rename the local binding or import { AEUI } from "aeui".
```

기존 `aeui` import에 AEUI를 병합할 때:
- named/default 조합 → 기존 specifier를 보존하고 AEUI를 추가
- namespace import → 별도 `import { AEUI } from 'aeui'`를 새로 만듦

---

## 4. 컴포넌트 판별 — "이 함수가 컴포넌트인가?"

### 4.1 renderable expression 판별

`containsRenderableExpression(node)`는 다음을 재귀적으로 확인한다:

| AST 종류 | renderable? |
|---|---|
| JSXElement, JSXFragment | ✅ |
| `AEUI.createElement(...)`, `AEUI.createVNode(...)` | ✅ |
| 조건 (`? :`) | consequent 또는 alternate 중 하나라도 ✅ |
| 논리 (`&&`, `\|\|`) | left 또는 right 중 하나라도 ✅ |
| 배열 | 원소 중 하나라도 ✅ |
| 그 외 | ❌ |

### 4.2 컴포넌트 판별 기준

`shouldTransformComponent(path)`는 함수의 **위치, 이름, 사용처**를 종합적으로 본다:

**즉시 컴포넌트로 판정:**
- 이름 없는 `export default` 함수이면서 renderable을 반환

**이름 기반 후보 + 사용 근거:**
1. 같은 모듈의 JSX에서 태그로 사용됨: `<Card />`
2. `AEUI.createElement(Card, props)` 형태로 사용됨
3. PascalCase 이름 + renderable 반환 + export/default export

**컴포넌트가 아닌 것:**
- 임의 함수 호출의 인자
- 대문자 이름만 있고 renderable을 반환하지 않는 함수
- `map`, `filter`, `setTimeout` 등에 전달된 콜백
- 다른 모듈에서 import된 함수 (원래 모듈에서 컴파일해야 함)

> **원칙:** import된 컴포넌트는 **정의가 있는 원래 모듈에서 컴파일**된다. 소비 모듈은 JSX를 VNode 호출로 변환할 뿐, import binding만 보고 변환하지 않는다.

---

## 5. 직접 return을 factory로 변환

`return <JSX />`를 `return () => <JSX />`로 감싼다:

```js
// 변환 전
function Counter() {
  return <div />;
}

// 변환 후 (개념)
function Counter() {
  return () => <div />;
}
```

**변환 조건:**
- argument가 존재하고
- arrow/function expression이 **아니고**
- renderable expression을 포함하면

이미 `return () => <div />` 형태라면 이 단계에서는 그대로 둔다.

---

## 6. props 변환

### 6.1 지원하는 파라미터 형태

- identifier: `function Card(props) { ... }`
- object pattern: `function Card({ title, ...rest }) { ... }`
- 위 둘에 기본값: `function Card(props = {}) { ... }`

두 번째 이후 파라미터는 수정하지 않는다.

### 6.2 identifier props

```js
// 변환 전
function Card(props) { ... }

// 변환 후
function Card(_initialProps) {
  const _props = { ..._initialProps };
  const props = _props;  // alias
  ...
}
```

`_props` 객체의 **identity가 유지**되면서 runtime이 매 render마다 key를 교체한다. `props` alias도 자동으로 최신 값을 본다.

> **충돌 방지:** 컴파일러가 생성하는 identifier(`_initialProps`, `_props`, `_resolveProps`, `_resolvedProps`, `_newProps`, `_renderProps` 등)는 사용자 binding과 충돌하지 않아야 한다. 같은 이름의 사용자 binding이 이미 존재하면 컴파일러는 scope-safe한 고유 이름을 생성해야 한다.

### 6.3 object destructuring

```js
// 변환 전
function Card({ title: label = 'Guest', ...rest }) { ... }

// 변환 후
function Card(_initialProps) {
  const _props = { ..._initialProps };
  const _resolveProps = () => {
    const { title: label = 'Guest', ...rest } = _props;
    return { rest, label };
  };
  let { title: label = 'Guest', ...rest } = _initialProps;
  ...
}
```

- `_resolveProps`는 최신 `_props`에서 구조 분해를 **다시 실행**하는 함수
- 초기 setup에서는 원래 `let` binding을 사용
- render 함수와 watch callback 안에서는 `_resolveProps()`의 결과를 사용

### 6.4 render/watch 안의 참조 변환

render 함수와 inline watch callback 안의 구조 분해 binding 참조를 `_resolvedProps.<name>`으로 교체한다:

```js
// render 함수 내부
const _resolvedProps = _resolveProps();
// label → _resolvedProps.label
// rest → _resolvedProps.rest
```

단, 같은 이름이 안쪽 scope에서 새로 binding되면(콜백 파라미터, 중첩 변수) 치환하지 않는다.

---

## 7. watch와 clean 변환

### 7.1 hook 판별 — binding 기반

hook 종류는 함수 이름이 아니라 **Babel binding**으로 결정한다:

```js
import { watch as observe } from 'aeui';
observe(...);  // → watch로 변환

import { clean as dispose } from 'aeui';
dispose(...);  // → clean으로 변환

import { clean as watch } from 'aeui';
watch(...);    // → clean으로 변환 (imported 이름 기준!)
```

다른 패키지에서 import한 같은 이름이나, local binding은 변환하지 않는다.

### 7.2 clean 변환

인자 검사 없이 callee만 교체:

```js
clean(callback);
// → AEUI.__runtime.clean(callback)
```

### 7.3 watch 변환

**정확히 2개 인자**이고 **첫 인자가 배열이 아닐 때만** 변환:

```js
watch(callback, [count]);
// → AEUI.__runtime.watch(callback, () => [count])

watch(callback, () => [count]);
// → AEUI.__runtime.watch(callback, () => [count])
```

### 7.4 deps getter 분류

두 번째 인자를 분석해 getter인지 dependency value인지 결정한다:

| 입력 | 처리 |
|---|---|
| inline arrow/function | getter 자체를 유지 |
| 함수 binding (`getDeps` 같은) | 그대로 유지 (불필요한 wrapper 안 만듦) |
| 배열 리터럴, 값 binding | `() => expression`으로 감쌈 |
| 불확실한 입력 | 컴파일 오류 — 사용자가 의미를 명시해야 함 |

---

## 8. render phase wrapper 생성

props와 hook 변환 후, 반환되는 render 함수를 runtime wrapper로 감싼다:

```js
// 변환 전
return renderFunction;

// 변환 후
return (_newProps) => AEUI.__runtime.runRenderPhase(
  _newProps,
  propsTarget,   // §6에서 만든 _props 또는 null
  innerRenderFunction
);
```

### 원 render 파라미터 보존

원 render 함수의 첫 파라미터만 저장하고, 파라미터 목록을 `_renderProps` 하나로 교체한다:

| 원 파라미터 | 생성 binding |
|---|---|
| identifier `p` | `const p = _renderProps` |
| object/array pattern | `const pattern = _renderProps` |
| assignment pattern | `const left = _renderProps === undefined ? right : _renderProps` |
| 없음 | 생성 없음 |

### wrapper 중복 방지

같은 AST에 플러그인을 다시 실행해도 wrapper는 **한 번만** 생성한다. canonical 구조로 기존 wrapper를 식별한다.

---

## 9. visitor 구조

```
Program.exit:
  if AEUI import가 필요하면 → 추가

ArrowFunctionExpression | FunctionDeclaration | FunctionExpression:
  if 컴포넌트가 아니면 → return
  transformToFactory()     ← return JSX → return () => JSX
  injectReactiveProps()    ← props 변환 + hook 변환 + render wrapper
```

- 함수 visitor에서 먼저 변환하고, `Program.exit`에서 import를 보장
- class method, object method는 대상이 아님
- `async`/generator를 별도로 제외하는 조건은 없음

---

## 10. 컴파일러 런타임 ABI

컴파일된 코드가 호출하는 `__runtime` 함수와 실제 구현의 연결:

| 생성 코드 | `__runtime` 구현 |
|---|---|
| `watch(...)` | `registerWatch(state, ...)` |
| `clean(...)` | `registerCleanup(state, ...)` |
| `runRenderPhase(...)` | `runRenderPhaseBridge(state, ...)` |
| `runComponentWatchers(...)` | `runComponentWatchersBridge(state, ...)` |

### `runRenderPhaseBridge` 동작

```js
function runRenderPhaseBridge(state, nextProps, propsTarget, render) {
  const node = state.currentComponentNode;
  if (!node) {
    // 컴포넌트 context가 없으면 직접 호출 (fallback)
    return typeof render === 'function' ? render(nextProps || {}) : null;
  }

  return runComponentRenderPhase(state, node, nextProps, render, {
    propsTarget,
    runWatchers: true,
  });
}
```

`runComponentRenderPhase` 실행 순서:

1. `node.props = nextProps || {}`
2. propsTarget의 기존 key 삭제 → 새 props 할당
3. watcher 실행
4. render 호출

이 순서 덕분에 **watcher deps와 render가 모두 최신 props를 본다**.

---

## 11. 컴파일러 규칙 요약

- import source 문자열은 `aeui`로 고정
- 컴포넌트 판별에서 export 여부는 최종 조건이 아님
- hook binding은 imported 이름으로 판별 (local 이름이 아님)
- `watch`는 정확히 2개 인자만 변환, 첫 인자 배열이면 변환 안 함
- props는 첫 파라미터만 처리 (identifier/object pattern/assignment pattern)
- render 함수의 첫 파라미터만 재바인딩, 나머지는 버림
- 구조 분해 props의 최신값 반영은 render와 inline watch에 한정
- classic JSX pragma는 `AEUI.createElement`, fragment는 `AEUI.Fragment`
