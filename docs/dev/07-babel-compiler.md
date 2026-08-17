# 07. Babel 컴파일러

이 문서는 AEUI의 Babel 플러그인이 수행하는 4가지 핵심 변환을 상세히 설명한다.

---

## 플러그인의 역할 개요

| 번호 | 변환 | 목적 |
|---|---|---|
| 1 | **AEUI import 보장** | JSX가 `AEUI.createElement`를 호출하므로 필요 |
| 2 | **return JSX → return () => JSX** | setup과 render 분리 |
| 3 | **props 파라미터 변환** | 매 render마다 최신 props를 받을 수 있도록 |
| 4 | **watch/clean → runtime helper** | 각 앱의 state에 바인딩 |

> **이 플러그인은 JSX를 호스트 호출로 변환하지 않는다.** 직접 통합 시 AEUI 플러그인 뒤에 classic JSX transform을 둬야 한다.

---

## 변환 전후 비교

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
  const _initialPropsValue = _initialProps === undefined ? {} : _initialProps;
  const _props = { ..._initialPropsValue };
  
  const _resolveProps = () => {
    const { title: label = 'Guest', ...rest } = _props;
    return { rest, label };
  };
  
  let { title: label = 'Guest', ...rest } = _initialPropsValue;

  let n = 0;
  
  AEUI.__runtime.watch(() => {
    const _resolvedProps = _resolveProps();
    return console.log(_resolvedProps.label);
  }, () => {
    const _resolvedProps2 = _resolveProps();
    return [_resolvedProps2.label, n];
  });
  
  AEUI.__runtime.clean(() => { n = 0; });

  return _newProps => AEUI.__runtime.runRenderPhase(
    _newProps, _props,
    _renderProps => {
      const _resolvedProps3 = _resolveProps();
      const { suffix = '!' } = _renderProps;
      return AEUI.createElement('p', { 'data-x': _resolvedProps3.rest.x },
        _resolvedProps3.label, suffix, n);
    }
  );
}
```

---

## 1. AEUI Import 주입

### 올바른 import

```js
import { AEUI } from 'aeui';  // ✅ 유일하게 올바른 형태
```

### 주입 조건

프로그램을 순회해 다음 중 하나를 발견하면 import 추가:
- JSXElement 또는 JSXFragment 존재
- `AEUI` identifier에 binding 없음
- `AEUI`가 올바른 import가 아닌데 `AEUI.createElement` 등으로 사용됨

### 충돌 처리

같은 이름의 local binding이 이미 있으면 컴파일 오류:
```
[AEUI] Local AEUI bindings conflict with the JSX runtime import.
```

---

## 2. 컴포넌트 판별

### renderable expression 판별

`containsRenderableExpression(node)`:

| AST | renderable? |
|---|---|
| JSXElement, JSXFragment | ✅ |
| `AEUI.createElement(...)` | ✅ |
| 조건 (`? :`) | 한쪽이라도 ✅ |
| 논리 (`&&`, `\|\|`) | 한쪽이라도 ✅ |
| 배열 | 원소 중 하나라도 ✅ |
| 그 외 | ❌ |

### shouldTransformComponent(path)

**즉시 컴포넌트:** 이름 없는 `export default` + renderable 반환

**이름 기반 + 사용 근거:**
1. JSX에서 태그로 사용: `<Card />`
2. `AEUI.createElement(Card, props)` 형태
3. PascalCase + renderable 반환 + export

**컴포넌트 아닌 것:** 콜백 인자, 대문자만 있고 renderable 미반환, import된 함수

---

## 3. Props 변환

### Identifier props

```js
// 입력
function Card(props) { ... }

// 출력
function Card(_initialProps) {
  const _props = { ..._initialProps };
  const props = _props;  // alias
  ...
}
```

### Object destructuring

```js
// 입력
function Card({ title: label = 'Guest', ...rest }) { ... }

// 출력
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

- `_resolveProps`는 최신 `_props`에서 구조 분해를 **다시 실행**
- render/watch 안의 구조 분해 binding은 `_resolvedProps.name`으로 교체
- 안쪽 scope에서 새로 binding된 같은 이름은 치환하지 않음

---

## 4. watch/clean 변환

### Hook 판별

함수 이름이 아니라 **Babel binding** (imported 이름)으로 결정:

```js
import { clean as watch } from 'aeui';
watch(...);    // → clean으로 변환! (imported 이름 기준)
```

### clean 변환

```js
clean(callback);
// → AEUI.__runtime.clean(callback)
```

### watch 변환

**정확히 2개 인자**이고 첫 인자가 배열이 아닐 때만:

```js
watch(callback, [count]);
// → AEUI.__runtime.watch(callback, () => [count])
```

### deps getter 분류

| 입력 | 처리 |
|---|---|
| inline arrow/function | getter 유지 |
| 함수 binding | 그대로 (불필요한 wrapper 안 만듦) |
| 배열 리터럴, 값 binding | `() => expression`으로 감쌈 |

---

## 5. Render Phase Wrapper

반환되는 render 함수를 runtime wrapper로 감싼다:

```js
// 변환 후
return (_newProps) => AEUI.__runtime.runRenderPhase(
  _newProps,
  propsTarget,       // _props 또는 null
  innerRenderFunction
);
```

원 render 파라미터는 `_renderProps` 하나로 교체하고, 기존 파라미터에 대한 binding을 body에 추가한다.

---

## 컴파일러 런타임 ABI

| 생성 코드 | `__runtime` 구현 |
|---|---|
| `watch(...)` | `registerWatch(state, ...)` |
| `clean(...)` | `registerCleanup(state, ...)` |
| `runRenderPhase(...)` | `runRenderPhaseBridge(state, ...)` |
| `runComponentWatchers(...)` | `runComponentWatchersBridge(state, ...)` |

---

## Visitor 구조

```
Program.exit:
  if AEUI import 필요 → 추가

ArrowFunctionExpression | FunctionDeclaration | FunctionExpression:
  if 컴포넌트 아님 → return
  transformToFactory()        ← return JSX → return () => JSX
  injectReactiveProps()       ← props + hook + render wrapper
```

class method, object method는 대상 아님.

---

## 관련 문서

- 원본 명세: [spec 06](../spec/06-babel-compiler.md)
- 컴파일러 ABI 사용처: [03. 컴포넌트 내부](03-component-internals.md)
