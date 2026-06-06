# Babel 플러그인 — `aeuiTransform`

## 개요

AEUI Babel 플러그인은 사용자가 작성한 컴포넌트 코드를 **AEUI 런타임이 이해할 수 있는 형태로 변환**하는 컴파일 타임 도구이다.

AEUI에서 `let count = 0; count++;`만으로 UI가 업데이트되는 동작은 이 Babel 플러그인이 컴포넌트를 setup/render 이중 구조로 바꿔주기 때문에 가능하다. 플러그인 없이는 AEUI 컴포넌트가 정상 동작하지 않는다.

### 플러그인이 수행하는 3가지 변환

| 변환 | 입력 | 출력 | 목적 |
|------|------|------|------|
| **Return 래핑** | `return <div />` | `return () => <div />` | setup 1회 실행 + render 반복 실행 구조 생성 |
| **Props 반응화** | `function Comp(props)` | `function Comp(_initialProps)` + `__props` 객체 | props 변경 시 클로저 참조를 최신 상태로 유지 |
| **Watch deps 래핑** | `watch(cb, [count])` | `AEUI.__runtime.watch(cb, () => [count])` | 매 호출 시 현재 값을 읽도록 함수화 |

플러그인은 render wrapper에서 **`AEUI.__runtime.runRenderPhase()`를 호출**한다. props 동기화, watcher 실행, render context 설정은 이 runtime helper가 담당한다.

### 전체 변환 흐름

```javascript
// 사용자 코드
function Counter({ name }) {
  let count = 0;
  watch(() => console.log(name, count), [name, count]);
  return <div>{name}: {count}</div>;
}

// Babel 적용 후 개념 구조
function Counter(_initialProps) {
  const __props = { ..._initialProps };
  let { name } = _initialProps;
  const _resolveProps = () => {
    const { name } = __props;
    return { name };
  };

  let count = 0;
  AEUI.__runtime.watch(
    () => {
      const _resolvedProps2 = _resolveProps();
      return console.log(_resolvedProps2.name, count);
    },
    () => {
      const _resolvedProps = _resolveProps();
      return [_resolvedProps.name, count];
    }
  );

  return (_newProps) => AEUI.__runtime.runRenderPhase(
    _newProps,
    __props,
    (_renderProps) => {
      const _resolvedProps3 = _resolveProps();
      return AEUI.createVNode("div", null, _resolvedProps3.name, ": ", count);
    }
  );
}
```

---

## 플러그인 진입점

```javascript
export default function aeuiTransform({ types: t }) {
  return {
    visitor: {
      "ArrowFunctionExpression|FunctionDeclaration|FunctionExpression"(path) {
        if (!shouldTransformComponent(path)) return;
        transformToFactory(path);
        injectReactiveProps(path);
      }
    }
  };
}
```

Babel은 코드를 AST로 파싱한 뒤 visitor 패턴으로 각 노드를 순회한다. 이 플러그인은 함수 선언/표현식을 방문하여:

1. `shouldTransformComponent`로 AEUI 컴포넌트인지 판별
2. `transformToFactory`로 `return JSX`를 `return () => JSX`로 변환
3. `injectReactiveProps`로 props 반응화, watch deps 래핑, render phase helper 주입 수행

---

## 1단계: `shouldTransformComponent` — 컴포넌트 판별

모든 함수가 AEUI 컴포넌트인 것은 아니다. 이벤트 핸들러나 유틸리티 함수까지 변환하면 안 되므로, 먼저 컴포넌트 여부를 판별한다.

### 판별 기준

```text
1. JSX 태그로 사용되는 함수 → 컴포넌트
2. PascalCase(대문자로 시작) 함수 → 컴포넌트
3. renderable expression을 반환하는 anonymous default export → 컴포넌트
4. 그 외 → 변환하지 않음
```

### JSX 태그 사용 감지

```javascript
binding.referencePaths.forEach(refPath => {
  if (t.isJSXOpeningElement(refPath.parent) && refPath.parent.name === refPath.node) {
    isUsedAsComponent = true;
  } else if (
    t.isCallExpression(refPath.parent) &&
    refPath.parent.arguments.length > 0 &&
    refPath.parent.arguments[0] === refPath.node
  ) {
    isUsedAsComponent = true;
  }
});
```

이미 JSX가 `AEUI.createVNode(...)` 형태로 바뀐 뒤여도 첫 번째 인자로 함수가 전달되면 컴포넌트로 간주한다.

### PascalCase 검사

```javascript
if (varName && /^[A-Z]/.test(varName)) {
  return true;
}
```

React와 같은 관례로, AEUI에서도 컴포넌트는 PascalCase를 우선 기준으로 삼는다.

### anonymous default export 예외

이름이 없는 `export default` 함수/화살표 함수도 top-level return이 JSX 또는 renderable expression이면 컴포넌트로 인식한다.

---

## 2단계: `transformToFactory` — Return 래핑

컴포넌트의 `return JSX`를 `return () => JSX`로 변환한다.

### 왜 필요한가

AEUI의 핵심 원리:

- 컴포넌트 함수(setup)는 한 번만 실행
- 반환된 render factory는 매 tick마다 반복 실행

따라서 사용자가 `return <div>{count}</div>`를 작성하면, 이를 render factory로 감싸야 이후 tick에서 최신 state를 읽을 수 있다.

### 기본 예시

```javascript
// 입력
function Counter() {
  let count = 0;
  return <div>{count}</div>;
}

// 출력
function Counter() {
  let count = 0;
  return () => <div>{count}</div>;
}
```

### 지원되는 return 형태

- JSX element / JSX fragment
- `ok ? <A /> : <B />` 같은 conditional expression
- `flag && <A />` 같은 logical expression
- JSX를 포함한 array return

즉, 단순한 `return <div />`뿐 아니라 "renderable expression"이면 같은 규칙으로 render factory로 감싼다.

### 중첩 함수 return은 제외

```jsx
function ParentApp() {
  const renderItem = (item) => <span>{item}</span>; // 이 함수는 별도 함수
  return <div>{renderItem("hello")}</div>;          // top-level return만 변환
}
```

플러그인은 `getFunctionParent()`를 사용해 현재 변환 대상 함수의 직접 return만 처리한다.

---

## 3단계: `injectReactiveProps` — Props 반응화

이 단계는 props가 변경될 때 컴포넌트 내부 코드가 최신 props를 참조하도록 만든다.

### 3-1. 파라미터 변환과 `__props` 생성

**전체 props 객체를 받는 경우**

```javascript
// 입력
function UserCard(props) { ... }

// 출력
function UserCard(_initialProps) {
  const __props = { ..._initialProps };
  const props = __props;
  ...
}
```

**구조 분해를 사용하는 경우**

```javascript
// 입력
function UserCard({ name, age }) { ... }

// 출력
function UserCard(_initialProps) {
  const __props = { ..._initialProps };
  let { name, age } = _initialProps;
  ...
}
```

### `__props`가 필요한 이유

setup은 한 번만 실행되므로, setup 시점의 구조 분해 결과를 그대로 두면 새 props를 받아도 로컬 변수가 초기값에 고정된다. 이를 해결하기 위해 플러그인은 `__props`를 유지하고, render/watch 시점에 `_resolveProps()`로 현재 값을 다시 해석한다.

```javascript
function UserCard(_initialProps) {
  const __props = { ..._initialProps };
  let { name } = _initialProps;
  const _resolveProps = () => {
    const { name } = __props;
    return { name };
  };
}
```

이 방식 덕분에 alias/default/nested/rest 패턴도 원래 JS semantics에 가깝게 유지할 수 있다.

### 3-2. Watch deps 래핑

```javascript
// 입력
watch(() => console.log(count), [count]);

// 출력
AEUI.__runtime.watch(() => console.log(count), () => [count]);
```

플러그인은 `watch(callback, deps)` 형태만 다룬다. deps 배열 표현식을 함수로 감싸야 매 실행 시점에 현재 deps를 다시 읽을 수 있다.

### 3-3. 구조 분해된 props의 재해석

구조 분해 props는 원래 패턴 자체를 `_resolveProps()`에 보존하고, watch/render 시점마다 이를 다시 호출한다.

```javascript
function UserCard({ title: label, count = 0 }) {
  watch(() => console.log(label, count), [label, count]);
  return <p>{label}: {count}</p>;
}
```

는 개념적으로 다음 구조를 만든다.

```javascript
function UserCard(_initialProps) {
  const __props = { ..._initialProps };
  let { title: label, count = 0 } = _initialProps;
  const _resolveProps = () => {
    const { title: label, count = 0 } = __props;
    return { label, count };
  };
}
```

### 3-4. render phase helper 주입

render wrapper는 다음 helper를 호출한다.

```javascript
return (_newProps) => AEUI.__runtime.runRenderPhase(
  _newProps,
  __props,
  (_renderProps) => {
    return <div>{count}</div>;
  }
);
```

이 구조의 의미:

- Babel은 render phase 진입만 지시
- props 동기화는 runtime helper가 수행
- watcher 실행 순서도 runtime helper가 보장
- current component context 설정도 runtime helper가 책임진다

즉, compile-time 코드는 render phase 진입만 표현하고, props/watcher/context 제어는 runtime helper가 맡는다.

### render parameter 보존

render 함수가 직접 파라미터를 받을 때도 의미를 유지해야 한다.

```javascript
return ({ size = 'm' }) => <div>{size}</div>;
```

render parameter 처리는 내부적으로 별도 render param을 만들고, 원래 파라미터 패턴을 다시 바인딩하는 helper를 사용한다. 덕분에:

- identifier 파라미터
- object / array destructuring
- default assignment pattern

을 helper 기반 render phase 계약으로 옮겨도 기존 의미를 잃지 않는다.

---

## 변환 전후 전체 비교

### 입력 (사용자 코드)

```jsx
export function TodoItem({ text, done }) {
  let editing = false;

  watch(() => {
    if (done) editing = false;
  }, [done]);

  clean(() => console.log("TodoItem 제거됨"));

  return (
    <li className={done ? "done" : ""}>
      {editing ? <input value={text} /> : <span>{text}</span>}
    </li>
  );
}
```

### 출력 (Babel 변환 후 개념 구조)

```jsx
export function TodoItem(_initialProps) {
  const __props = { ..._initialProps };
  let { text, done } = _initialProps;
  const _resolveProps = () => {
    const { text, done } = __props;
    return { text, done };
  };

  let editing = false;

  AEUI.__runtime.watch(
    () => {
      const _resolvedProps2 = _resolveProps();
      if (_resolvedProps2.done) editing = false;
    },
    () => {
      const _resolvedProps = _resolveProps();
      return [_resolvedProps.done];
    }
  );

  clean(() => console.log("TodoItem 제거됨"));

  return (_newProps) => AEUI.__runtime.runRenderPhase(
    _newProps,
    __props,
    (_renderProps) => {
      const _resolvedProps3 = _resolveProps();
      return AEUI.createVNode(
        "li",
        { className: _resolvedProps3.done ? "done" : "" },
        editing
          ? AEUI.createVNode("input", { value: _resolvedProps3.text })
          : AEUI.createVNode("span", null, _resolvedProps3.text)
      );
    }
  );
}
```

변환 요약:

- `{ text, done }` → `_initialProps` + `__props` 생성
- `_resolveProps()`가 현재 `__props`를 원래 구조 분해 패턴으로 다시 해석
- `watch(cb, [done])` → `AEUI.__runtime.watch(cb, () => [done])` 형태로 변환
- `return (JSX)` → render factory + `AEUI.__runtime.runRenderPhase(...)`
- render/watch 내부의 구조 분해 props 참조는 `_resolveProps()` 결과를 통해 최신값 사용
- `editing`은 props가 아닌 로컬 상태이므로 변환하지 않음
- `clean()`은 변환 대상이 아님

---

## 변환되지 않는 것들

| 항목 | 이유 |
|------|------|
| `clean()` 호출 | 단순히 cleanup callback을 등록하는 것이므로 변환 불필요 |
| 로컬 `let` 변수 | 클로저에 의해 최신 값 참조 가능 |
| 이벤트 핸들러 내부 코드 | 이미 클로저로 최신 상태를 참조함 |
| PascalCase가 아닌 함수 | 컴포넌트로 인식되지 않음 |
| JSX를 반환하지 않는 함수 | render factory 변환 대상이 아님 |

---

## 관련 코드 위치

- `packages/core/src/babel-plugin.js`
- `packages/core/src/core.js`
- `packages/core/src/component-lifecycle.js`
