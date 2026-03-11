# Babel 플러그인 — `aeuiTransform`

## 개요

AEUI Babel 플러그인은 사용자가 작성한 컴포넌트 코드를 **AEUI 런타임이 이해할 수 있는 형태로 변환**하는 컴파일 타임 도구이다.

AEUI에서 `let count = 0; count++;`만으로 UI가 업데이트되는 마법은 이 Babel 플러그인이 코드를 변환해주기 때문에 가능하다. 플러그인 없이는 AEUI 컴포넌트가 정상 동작하지 않는다.

### 플러그인이 수행하는 3가지 변환

| 변환 | 입력 | 출력 | 목적 |
|------|------|------|------|
| **Return 래핑** | `return <div />` | `return () => <div />` | setup 1회 실행 + 렌더 함수 반복 실행 구조 생성 |
| **Props 반응화** | `function Comp(props)` | `function Comp(_initialProps)` + `__props` 객체 | props 변경 시 클로저 참조가 자동 갱신되도록 |
| **Watch deps 래핑** | `watch([count], cb)` | `watch(() => [count], cb)` | 매 호출 시 현재 값을 읽도록 함수화 |

### 전체 변환 흐름

```
사용자 코드:
function Counter({ name }) {
  let count = 0;
  watch([name, count], () => console.log(name, count));
  return <div>{name}: {count}</div>;
}

↓ Babel 플러그인 적용 후:

function Counter(_initialProps) {
  const __props = { ..._initialProps };
  let { name } = _initialProps;
  const _resolveProps = () => {
    const { name } = __props;
    return { name };
  };

  let count = 0;
  watch(
    () => {
      const _resolvedProps = _resolveProps();
      return [_resolvedProps.name, count];
    },
    () => {
      const _resolvedProps2 = _resolveProps();
      return console.log(_resolvedProps2.name, count);
    }
  );

  return (_newProps) => {
    AEUI.updateProps(__props, _newProps);
    AEUI._runComponentWatchers(AEUI._currentComponentNode);
    const _resolvedProps3 = _resolveProps();
    return AEUI.createVNode("div", null, _resolvedProps3.name, ": ", count);
  };
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

Babel은 코드를 AST(Abstract Syntax Tree, 추상 구문 트리)로 파싱한 후, visitor 패턴으로 각 노드를 순회한다. 이 플러그인은 모든 함수 선언/표현식을 방문하여:

1. **`shouldTransformComponent`**: 이 함수가 AEUI 컴포넌트인지 판별
2. **`transformToFactory`**: `return JSX`를 `return () => JSX`로 변환
3. **`injectReactiveProps`**: props 반응화, watch deps 래핑, 렌더 함수에 업데이트 로직 주입

`types: t`는 Babel이 제공하는 AST 노드 생성/검사 유틸리티이다. `t.isIdentifier()`, `t.arrowFunctionExpression()` 등의 함수를 포함한다.

---

## 1단계: `shouldTransformComponent` — 컴포넌트 판별

모든 함수가 AEUI 컴포넌트인 것은 아니다. 이벤트 핸들러, 유틸리티 함수 등은 변환하면 안 된다. 이 함수는 **해당 함수가 AEUI 컴포넌트인지 판별**한다.

### 판별 기준 (우선순위 순)

```
1. JSX 태그로 사용되는 함수 → 컴포넌트 (최우선)
   예: <Counter /> 에서 Counter가 사용됨

2. PascalCase(대문자로 시작)인 함수 → 컴포넌트
   예: function Counter() { ... }
   예: const MyApp = () => { ... }

3. 그 외 → 컴포넌트가 아님
   예: function handleClick() { ... }
   예: const formatDate = (date) => { ... }
```

### JSX 태그 사용 감지 (Strategy 1)

```javascript
binding.referencePaths.forEach(refPath => {
  // <Counter /> 형태로 사용되는지
  if (t.isJSXOpeningElement(refPath.parent) && refPath.parent.name === refPath.node) {
    isUsedAsComponent = true;
  }

  // AEUI.createElement(Counter, ...) 형태로 사용되는지 (이미 변환된 JSX)
  else if (
    t.isCallExpression(refPath.parent) &&
    refPath.parent.arguments[0] === refPath.node
  ) {
    isUsedAsComponent = true;
  }
});
```

Babel의 `scope.getBinding()`을 사용하여 해당 함수가 코드 내에서 어떻게 참조되는지 확인한다. JSX 태그(`<Counter />`)의 이름으로 사용되거나, 이미 변환된 `createElement`의 첫 번째 인자로 사용되면 컴포넌트로 판별한다.

### PascalCase 검사 (Strategy 2)

```javascript
if (varName && /^[A-Z]/.test(varName)) {
  return true;
}
```

함수 이름이 대문자로 시작하면 컴포넌트로 판별한다. React의 관례와 동일하게, AEUI에서도 컴포넌트는 PascalCase, 일반 함수는 camelCase로 명명한다.

### 지원되는 함수 형태

| 형태 | 예시 | 이름 추출 위치 |
|------|------|-------------|
| 함수 선언 | `function Counter() {}` | `path.node.id.name` |
| 변수에 할당된 화살표 함수 | `const Counter = () => {}` | `path.parent.id.name` |
| 변수에 할당된 함수 표현식 | `const Counter = function() {}` | `path.parent.id.name` |
| 객체 프로퍼티 | `{ Counter: () => {} }` | `path.parent.key.name` |
| 멤버 할당 | `exports.Counter = () => {}` | `path.parent.left.property.name` |

---

## 2단계: `transformToFactory` — Return 래핑

컴포넌트의 `return JSX`를 `return () => JSX`로 변환한다.

### 왜 필요한가

AEUI의 핵심 원리: **컴포넌트 함수(setup)는 한 번만 실행**되고, **렌더 함수(factory)는 매 tick마다 반복 실행**된다. 사용자가 `return <div>{count}</div>`를 작성하면, 이것은 setup의 일부이므로 한 번만 평가된다. 매 tick마다 최신 count를 반영하려면 `return () => <div>{count}</div>`로 변환해야 한다.

### 두 가지 함수 형태 처리

**1. Expression Body (화살표 함수 단축형)**
```javascript
// 입력
const Counter = () => <div>{count}</div>;

// 출력
const Counter = () => () => <div>{count}</div>;
```

```javascript
if (isJSX(path.node.body)) {
  path.node.body = t.arrowFunctionExpression([], path.node.body);
}
```

**2. Block Statement Body (중괄호 본문)**
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

```javascript
path.traverse({
  ReturnStatement(returnPath) {
    // 이 컴포넌트의 직접 return인지 확인 (중첩 함수의 return이 아닌지)
    if (returnPath.getFunctionParent().node === path.node) {
      if (isJSX(returnPath.node.argument)) {
        // 이미 함수로 감싸져 있으면 건너뜀 (이중 래핑 방지)
        if (t.isArrowFunctionExpression(returnPath.node.argument)) return;
        returnPath.node.argument = t.arrowFunctionExpression([], returnPath.node.argument);
      }
    }
  }
});
```

### `isJSX` 헬퍼 함수

return 값이 JSX인지 판별한다. 여러 형태를 지원한다:

```javascript
const isJSX = (node) => {
  if (t.isJSXElement(node) || t.isJSXFragment(node)) return true;   // <div />, <>...</>
  if (t.isParenthesizedExpression(node)) return isJSX(node.expression); // (<div />)
  if (t.isCallExpression(node)) {
    // AEUI.createVNode(...) 또는 AEUI.createElement(...)
    // → 이미 JSX가 변환된 경우
  }
  return false;
};
```

괄호로 감싸진 JSX (`return (<div />)`)도 재귀적으로 감지한다.

### 중첩 함수의 return은 건너뛰기

```javascript
if (returnPath.getFunctionParent().node === path.node) { ... }
```

컴포넌트 내부에 다른 함수가 있고 그 함수도 JSX를 반환하는 경우:

```jsx
function ParentApp() {
  const renderItem = (item) => <span>{item}</span>;  // ← 이 return은 변환하면 안 됨
  return <div>{renderItem("hello")}</div>;            // ← 이 return만 변환
}
```

`getFunctionParent()`로 return문이 속한 함수가 현재 변환 대상 컴포넌트인지 확인한다.

---

## 3단계: `injectReactiveProps` — Props 반응화

가장 복잡한 변환이다. props가 변경될 때 컴포넌트 내부의 코드가 **자동으로 최신 props를 참조**하도록 변환한다.

### 3-1. 파라미터 변환과 `__props` 생성

**전체 props 객체를 받는 경우:**

```javascript
// 입력
function UserCard(props) { ... }

// 출력
function UserCard(_initialProps) {
  const __props = { ..._initialProps };   // 반응형 props 객체
  const props = __props;                  // 사용자 변수에 참조 연결
  ...
}
```

**구조 분해(destructuring)를 사용하는 경우:**

```javascript
// 입력
function UserCard({ name, age }) { ... }

// 출력
function UserCard(_initialProps) {
  const __props = { ..._initialProps };   // 반응형 props 객체
  let { name, age } = _initialProps;      // 초기값으로 변수 생성
  ...
}
```

### `__props`가 필요한 이유

setup은 한 번만 실행되므로, `const { name } = props`도 한 번만 실행된다. 부모가 새 props를 전달해도 `name` 변수는 초기값으로 고정된다.

```javascript
// 문제: setup에서 한 번만 실행됨
function UserCard({ name }) {
  // name = "홍길동" (초기값, 이후 변경 불가)
  return <p>{name}</p>;
}

// 해결: __props를 현재 시점 구조 분해로 다시 해석
function UserCard(_initialProps) {
  const __props = { ..._initialProps };
  let { name } = _initialProps;
  const _resolveProps = () => {
    const { name } = __props;
    return { name };
  };

  return (_newProps) => {
    AEUI.updateProps(__props, _newProps);  // __props 내용을 최신으로 교체
    const _resolvedProps = _resolveProps();
    return <p>{_resolvedProps.name}</p>;   // 현재 props 기준으로 다시 해석
  };
}
```

`__props`는 같은 객체 참조를 유지하면서 내용만 교체된다. render/watch가 실행될 때마다 `_resolveProps()`가 이 현재 `__props`를 다시 구조 분해하므로, alias/default/nested/rest를 포함한 패턴도 최신값 기준으로 평가할 수 있다.

### 3-2. Watch deps 래핑 및 시그니처 정규화

```javascript
// 입력
watch([count], () => console.log(count));

// 출력
watch(() => [count], () => console.log(count));
```

```javascript
if (!isFunctionLike(depsArg)) {
  depsArg = t.arrowFunctionExpression([], t.cloneNode(depsArg, true));
}
```

새 API는 `watch(deps, callback)`이다. 플러그인은 이 순서를 기준으로 정규화하며, 구버전 `watch(callback, deps)`도 만나면 내부적으로 같은 형태로 바꾼다. 그 뒤 deps 표현식을 화살표 함수로 감싸서, 매 호출 시 클로저에서 현재 값을 읽도록 한다.

### 3-3. 구조 분해된 props의 재해석

초기 구현은 구조 분해된 이름을 `__props.name`처럼 직접 치환했지만, alias/default/nested/rest 패턴을 정확히 처리할 수 없었다. 현재 구현은 **원래 구조 분해 패턴 자체를 `_resolveProps()` 안에 보존**하고, watch/render가 실행될 때마다 현재 `__props`를 다시 해석한다.

```javascript
// 입력
function UserCard({ title: label, count = 0 }) {
  watch([label, count], () => console.log(label, count));
  return <p>{label}: {count}</p>;
}

// 출력 (중요: 원래 구조 분해 패턴을 _resolveProps 안에 유지)
function UserCard(_initialProps) {
  const __props = { ..._initialProps };
  let { title: label, count = 0 } = _initialProps;
  const _resolveProps = () => {
    const { title: label, count = 0 } = __props;
    return { label, count };
  };

  watch(
    () => {
      const _resolvedProps = _resolveProps();
      return [_resolvedProps.label, _resolvedProps.count];
    },
    () => {
      const _resolvedProps2 = _resolveProps();
      return console.log(_resolvedProps2.label, _resolvedProps2.count);
    }
  );

  return (_newProps) => {
    AEUI.updateProps(__props, _newProps);
    AEUI._runComponentWatchers(AEUI._currentComponentNode);
    const _resolvedProps3 = _resolveProps();
    return <p>{_resolvedProps3.label}: {_resolvedProps3.count}</p>;
  };
}
```

이 방식의 장점:

- `title: label` 같은 alias가 정확히 유지된다
- `count = 0` 같은 default 값이 최신 props 기준으로 다시 계산된다
- `{ user: { name } }`, `{ ...rest }` 같은 nested/rest 패턴도 JS 본래 semantics를 그대로 사용한다
- render/watch 안에서는 치환 대상이 단순히 `_resolvedProps.<name>`가 되므로 shadowing 처리도 단순해진다

### 3-4. 렌더 함수에 업데이트 로직 주입

return에서 래핑된 화살표 함수(렌더 함수)를 찾아, **시작부에 업데이트 코드를 삽입**한다.

```javascript
// 래핑된 렌더 함수를 찾으면:
return () => <div>{count}</div>;

// 다음과 같이 변환:
return (_newProps) => {
  AEUI.updateProps(__props, _newProps);                            // 1. props 갱신
  AEUI._runComponentWatchers(AEUI._currentComponentNode);          // 2. watcher 실행 (유일한 실행 지점)
  return <div>{count}</div>;                                       // 3. JSX 반환
};
```

**이중 변환 방지**: 이미 `_newProps` 파라미터가 있으면 건너뛴다.

```javascript
if (renderFn.params.length > 0 && renderFn.params[0].name.startsWith("_newProps")) return;
```

**props가 없는 컴포넌트**: `updateProps` 호출은 생략하고 `_runComponentWatchers`만 주입한다.
즉, watcher 실행 책임은 reconciler가 아니라 **렌더 함수 wrapper 시작부**에 집중된다.

---

## 변환 전후 전체 비교

### 입력 (사용자 코드)

```jsx
export function TodoItem({ text, done }) {
  let editing = false;

  watch([done], () => {
    if (done) editing = false;
  });

  clean(() => console.log("TodoItem 제거됨"));

  return (
    <li className={done ? "done" : ""}>
      {editing ? <input value={text} /> : <span>{text}</span>}
    </li>
  );
}
```

### 출력 (Babel 변환 후)

```jsx
export function TodoItem(_initialProps) {
  const __props = { ..._initialProps };
  let { text, done } = _initialProps;
  const _resolveProps = () => {
    const { text, done } = __props;
    return { text, done };
  };

  let editing = false;

  watch(
    () => {
      const _resolvedProps = _resolveProps();
      return [_resolvedProps.done];
    },
    () => {
      const _resolvedProps2 = _resolveProps();
      if (_resolvedProps2.done) editing = false;
    }
  );

  clean(() => console.log("TodoItem 제거됨"));        // 변환 없음

  return (_newProps) => {
    AEUI.updateProps(__props, _newProps);
    AEUI._runComponentWatchers(AEUI._currentComponentNode);
    const _resolvedProps3 = _resolveProps();
    return AEUI.createVNode("li", { className: _resolvedProps3.done ? "done" : "" },
      editing
        ? AEUI.createVNode("input", { value: _resolvedProps3.text })
        : AEUI.createVNode("span", null, _resolvedProps3.text)
    );
  };
}
```

변환 요약:
- `{ text, done }` → `_initialProps` + `__props` 생성
- `_resolveProps()`가 현재 `__props`를 원래 구조 분해 패턴으로 다시 해석
- `return (JSX)` → `return (_newProps) => { 업데이트 로직; return JSX; }`
- `watch([done], cb)` → `watch(() => [done], cb)` 형태로 정규화
- watch/render 내부의 구조 분해 props 참조는 `_resolveProps()` 결과를 통해 최신값 사용
- `editing`은 props가 아닌 로컬 상태이므로 변환하지 않음
- `clean()`은 변환 대상이 아님

---

## 변환되지 않는 것들

| 항목 | 이유 |
|------|------|
| `clean()` 호출 | 단순히 콜백을 등록하는 것이므로 변환 불필요 |
| 로컬 `let` 변수 | 클로저에 의해 자동으로 최신 값이 참조됨 |
| 이벤트 핸들러 내부 코드 | 이미 클로저로 최신 상태를 참조함 |
| PascalCase가 아닌 함수 | 컴포넌트로 인식되지 않음 |
| JSX를 반환하지 않는 함수 | `isJSX` 검사에서 false, return 래핑 건너뜀 |

---

## 관련 코드 위치

- `aeuiTransform`: `packages/core/src/babel-plugin.js` L1-L331
- `isJSX`: `packages/core/src/babel-plugin.js` L5-L21
- `shouldTransformComponent`: `packages/core/src/babel-plugin.js` L29-L99
- `transformToFactory`: `packages/core/src/babel-plugin.js` L105-L127
- `injectReactiveProps`: `packages/core/src/babel-plugin.js` L138-L313
