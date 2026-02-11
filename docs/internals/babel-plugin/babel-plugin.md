# Babel 플러그인 — `aeuiTransform`

## 개요

AEUI Babel 플러그인은 사용자가 작성한 컴포넌트 코드를 **AEUI 런타임이 이해할 수 있는 형태로 변환**하는 컴파일 타임 도구이다.

AEUI에서 `let count = 0; count++;`만으로 UI가 업데이트되는 마법은 이 Babel 플러그인이 코드를 변환해주기 때문에 가능하다. 플러그인 없이는 AEUI 컴포넌트가 정상 동작하지 않는다.

### 플러그인이 수행하는 3가지 변환

| 변환 | 입력 | 출력 | 목적 |
|------|------|------|------|
| **Return 래핑** | `return <div />` | `return () => <div />` | setup 1회 실행 + 렌더 함수 반복 실행 구조 생성 |
| **Props 반응화** | `function Comp(props)` | `function Comp(_initialProps)` + `__props` 객체 | props 변경 시 클로저 참조가 자동 갱신되도록 |
| **Watch deps 래핑** | `watch(cb, [count])` | `watch(cb, () => [count])` | 매 호출 시 현재 값을 읽도록 함수화 |

### 전체 변환 흐름

```
사용자 코드:
function Counter({ name }) {
  let count = 0;
  watch(() => console.log(name, count), [name, count]);
  return <div>{name}: {count}</div>;
}

↓ Babel 플러그인 적용 후:

function Counter(_initialProps) {
  const __props = { ..._initialProps };
  let { name } = _initialProps;

  let count = 0;
  watch(
    () => console.log(__props.name, count),
    () => [__props.name, count]
  );

  return (_newProps) => {
    AEUI.updateProps(__props, _newProps);
    AEUI._runComponentWatchers(AEUI._currentInstance);
    return AEUI.createVNode("div", null, __props.name, ": ", count);
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

// 해결: __props 객체를 통해 최신값 참조
function UserCard(_initialProps) {
  const __props = { ..._initialProps };
  let { name } = _initialProps;

  return (_newProps) => {
    AEUI.updateProps(__props, _newProps);  // __props 내용을 최신으로 교체
    return <p>{__props.name}</p>;          // __props.name으로 최신값 참조
  };
}
```

`__props`는 같은 객체 참조를 유지하면서 내용만 교체되므로 (`updateProps` → delete all + assign), 클로저에서 `__props.name`으로 접근하면 항상 최신값을 읽을 수 있다.

### 3-2. Watch deps 래핑

```javascript
// 입력
watch(() => console.log(count), [count]);

// 출력
watch(() => console.log(count), () => [count]);
```

```javascript
if (t.isArrayExpression(args[1])) {
  depsPath.replaceWith(t.arrowFunctionExpression([], t.cloneNode(args[1], true)));
}
```

배열 리터럴을 화살표 함수로 감싸서, 매 호출 시 클로저에서 현재 값을 읽도록 한다. `watch.md`에서 설명한 것과 같은 이유이다.

### 3-3. 구조 분해된 props의 참조 교체

구조 분해로 `{ name, age }`를 사용한 경우, watch callback과 deps, 그리고 렌더 함수 내부에서 `name`을 `__props.name`으로 교체한다.

```javascript
// 입력
function UserCard({ name }) {
  watch(() => console.log(name), [name]);
  return <p>{name}</p>;
}

// 출력 (중요: name → __props.name 교체)
function UserCard(_initialProps) {
  const __props = { ..._initialProps };
  let { name } = _initialProps;

  watch(
    () => console.log(__props.name),      // name → __props.name
    () => [__props.name]                   // name → __props.name
  );

  return (_newProps) => {
    AEUI.updateProps(__props, _newProps);
    AEUI._runComponentWatchers(AEUI._currentInstance);
    return <p>{__props.name}</p>;          // name → __props.name
  };
}
```

### 교체 로직의 안전 장치

```javascript
const replaceIdentifiers = (targetPath) => {
  targetPath.traverse({
    Identifier(idPath) {
      const name = idPath.node.name;

      // 참조(사용)인 경우만 (선언, 프로퍼티 키 등은 제외)
      if (!idPath.isReferencedIdentifier()) return;

      // 구조 분해된 prop 이름만
      if (!destructuredNames.has(name)) return;

      // 쉐도잉 체크: 내부 스코프에서 같은 이름의 변수가 선언되었으면 건너뜀
      if (idPath.scope.hasBinding(name) &&
          idPath.scope.getBinding(name).scope !== path.scope) return;

      // 교체: name → __props.name
      idPath.replaceWith(t.memberExpression(propsId, t.identifier(name)));
    }
  });
};
```

**`isReferencedIdentifier`**: 변수 **참조**(사용)인 경우만 교체한다. 변수 **선언**(`let name = ...`의 `name`), 객체 **프로퍼티 키**(`{ name: value }`의 `name`) 등은 교체하지 않는다.

**`destructuredNames`**: props에서 구조 분해된 이름만 교체한다. 컴포넌트 내부의 `let count = 0`의 `count`는 교체하지 않는다.

**쉐도잉(shadowing) 체크**: 내부 함수에서 같은 이름의 지역 변수가 선언되었으면 그 범위에서는 교체하지 않는다.

```jsx
function UserCard({ name }) {           // ← 이 name은 교체 대상
  const process = (name) => {           // ← 이 name은 쉐도잉 (내부 스코프)
    return name.toUpperCase();          // ← 이 name은 교체하면 안 됨
  };
  return <p>{name}</p>;                 // ← 이 name은 __props.name으로 교체
}
```

### 3-4. 렌더 함수에 업데이트 로직 주입

return에서 래핑된 화살표 함수(렌더 함수)를 찾아, **시작부에 업데이트 코드를 삽입**한다.

```javascript
// 래핑된 렌더 함수를 찾으면:
return () => <div>{count}</div>;

// 다음과 같이 변환:
return (_newProps) => {
  AEUI.updateProps(__props, _newProps);                            // 1. props 갱신
  AEUI._runComponentWatchers(AEUI._currentInstance);               // 2. watcher 실행
  return <div>{count}</div>;                                       // 3. JSX 반환
};
```

**이중 변환 방지**: 이미 `_newProps` 파라미터가 있으면 건너뛴다.

```javascript
if (renderFn.params.length > 0 && renderFn.params[0].name.startsWith("_newProps")) return;
```

**props가 없는 컴포넌트**: `updateProps` 호출은 생략하고 `_runComponentWatchers`만 주입한다.

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

### 출력 (Babel 변환 후)

```jsx
export function TodoItem(_initialProps) {
  const __props = { ..._initialProps };
  let { text, done } = _initialProps;

  let editing = false;

  watch(
    () => { if (__props.done) editing = false; },    // done → __props.done
    () => [__props.done]                              // 배열 → 함수, done → __props.done
  );

  clean(() => console.log("TodoItem 제거됨"));        // 변환 없음

  return (_newProps) => {
    AEUI.updateProps(__props, _newProps);
    AEUI._runComponentWatchers(AEUI._currentInstance);
    return AEUI.createVNode("li", { className: __props.done ? "done" : "" },
      editing
        ? AEUI.createVNode("input", { value: __props.text })
        : AEUI.createVNode("span", null, __props.text)
    );
  };
}
```

변환 요약:
- `{ text, done }` → `_initialProps` + `__props` 생성
- `return (JSX)` → `return (_newProps) => { 업데이트 로직; return JSX; }`
- watch deps `[done]` → `() => [__props.done]`
- watch callback 내 `done` → `__props.done`
- 렌더 함수 내 `text`, `done` → `__props.text`, `__props.done`
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
