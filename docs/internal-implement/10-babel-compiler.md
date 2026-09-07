# Babel 플러그인 — `aeuiTransform`

## 개요

AEUI Babel 플러그인은 사용자가 작성한 컴포넌트 코드를 **AEUI 런타임이 이해할 수 있는 형태로 변환**하는 컴파일 타임 도구이다.

AEUI에서 `let count = 0; count++;`만으로 UI가 업데이트되는 동작은 이 Babel 플러그인이 컴포넌트를 setup/render 이중 구조로 바꿔주기 때문에 가능하다. 플러그인 없이는 AEUI 컴포넌트가 정상 동작하지 않는다.

### 플러그인이 수행하는 4가지 변환

| 변환 | 입력 | 출력 | 목적 |
|------|------|------|------|
| **Runtime import 주입** | JSX 또는 compiled helper 사용 | `import { AEUI } from 'aeui'` 자동 추가 | 사용자가 JSX 때문에 `AEUI` import를 직접 쓰지 않도록 함 |
| **Return 래핑** | `return <div />` | `return () => <div />` | setup 1회 실행 + render 반복 실행 구조 생성 |
| **Props 반응화** | `function Comp(props)` | 초기 props 파라미터 + 내부 props 저장 객체 | props 변경 시 클로저 참조를 최신 상태로 유지 |
| **Hook 연결** | `watch(cb, [count])`, `watch(cb)`, `clean(cb)` | `AEUI.__runtime.watch(...)`, `AEUI.__runtime.clean(...)` | 활성 앱 런타임에 hook 등록을 위임 |

플러그인은 JSX 또는 compiled helper가 `AEUI` 식별자를 필요로 하는 파일에 named import를 자동으로 넣는다. 기존 `import { watch } from 'aeui'`가 있으면 같은 import 선언에 `AEUI` specifier를 추가하고, import가 없으면 새 import 선언을 만든다. runtime binding이 필요한 파일에 다른 local `AEUI` binding이 있으면 JSX runtime helper를 안전하게 가리킬 수 없으므로 compile error를 낸다.

플러그인은 render wrapper에서 **`AEUI.__runtime.runRenderPhase()`를 호출**한다. props 동기화, watcher 실행, render context 설정은 이 runtime helper가 담당한다.

이 문서의 변환 예시에서 `_props`는 컴파일러가 만드는 props 저장 객체를 나타내는 설명용 이름이다. 실제 플러그인은 사용자 코드와 충돌하지 않는 식별자를 선택해야 하며, 생성되는 이름은 공개 API가 아니다.

### 전체 변환 흐름

```javascript
// 사용자 코드
function Counter({ name }) {
  let count = 0;
  watch(() => console.log(name, count), [name, count]);
  return <div>{name}: {count}</div>;
}

// Babel 적용 후 개념 구조
import { AEUI } from 'aeui';

function Counter(_initialProps) {
  const _props = { ..._initialProps };
  let { name } = _initialProps;
  const _resolveProps = () => {
    const { name } = _props;
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
    _props,
    (_renderProps) => {
      const _resolvedProps3 = _resolveProps();
      return AEUI.createElement("div", null, _resolvedProps3.name, ": ", count);
    }
  );
}
```

---

## 플러그인 진입점과 후보 수집

`Program.enter`에서 JSX lowering 전에 후보와 Babel binding을 수집한다. 이미 `registerComponent`로 연결된 원본/실행 함수와 `runRenderPhase` 출력은 재변환하지 않는다. 중첩 함수부터 처리한 다음 상위 함수를 복제하여 두 경로가 같은 lexical scope의 준비된 내부 함수를 갖도록 한다.

후보는 다음과 같다.

1. JSX 또는 AEUI VNode 생성 표현식을 직접 반환하거나, 그런 render 함수를 반환하는 함수
2. JSX 태그·AEUI `createElement`/`createVNode`/`init`·JSX props에서 local binding을 따라 도달하는 함수
3. export되어 있고 리터럴·props 참조 등 단순 renderable 값을 반환하는 함수

이름의 PascalCase 여부로 함수를 제외하지 않는다. 소문자 단독 JSX 태그를 host 문자열로 처리하는 JSX 문법은 유지한다.

`collectTypeFunctions`는 식별자 binding의 초기값과 재할당 우변, 조건식·논리식, sequence의 마지막 값, 단순 객체 속성을 순회한다. 방문한 AST 노드를 기록하여 별칭 순환을 끝낸다. 사용자 함수나 getter를 실행하지 않으며, import 정의를 다른 파일에서 역으로 분석하지 않는다. JSX 반환 함수와 export된 단순 반환 함수를 정의 파일에서 준비하므로 일반적인 import·props 전달은 파일 간 분석 없이 처리된다.

## 일반 호출과 컴포넌트 실행 분리

```js
// 개념 예시: 원래 함수 identity와 일반 호출 결과를 보존한다.
function badge(props) {
  return AEUI.createElement('span', null, props.text);
}
AEUI.__runtime.registerComponent(badge, function (_initialProps) {
  const props = { ..._initialProps };
  return nextProps => AEUI.__runtime.runRenderPhase(
    nextProps, props, () => AEUI.createElement('span', null, props.text)
  );
});
```

함수 선언의 등록문은 같은 Program/Block의 시작에 놓아 선언보다 앞선 마운트도 지원한다. 함수 표현식은 생성 위치에서 원본과 setup을 연결하고 원본을 그대로 반환한다. 새 함수 scope에서 원래 이름을 임의로 바인딩하지 않으며, 기명 함수 표현식의 자기 참조는 원본 callable을 가리킨다. 원래 arrow의 lexical `this`/`arguments`와 일반 함수의 호출 semantics를 유지한다.

`component-type.js`의 모듈 단위 WeakMap이 `원본 함수 → setup`을 저장한다. 함수 속성을 검사하거나 수정하지 않으며 앱 인스턴스가 달라도 같은 런타임 모듈의 등록 정보를 공유한다. 서로 다른 setup의 중복 등록은 오류다. 원본 함수와 key가 reconciliation identity이고 setup clone의 identity는 비교에 사용하지 않는다.

함수 선언 등록도 ESM 모듈 본문 실행이 필요하므로 순환 import의 너무 이른 마운트는 지원하지 못한다. 등록하지 않은 기존 수동 setup은 런타임이 반환 계약을 검증하여 허용한다. async/generator 후보는 원래 일반 호출을 보존하되 컴포넌트 경로에서는 사용자 본문 실행 전에 동기 setup 전용 오류를 낸다.

다음 변환 예시들은 등록된 setup 쪽 코드만 보여준다. 실제 출력에는 일반 호출용 원본도 남는다.

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

선택된 후보의 일반 반환식은 `null`, 텍스트, children 참조를 포함하여 render factory로 감싼다. 반환식이 없는 경로는 빈 render를 만든다. 함수 자체를 반환하는 수동 render 형태는 그대로 연결한다. 팩토리의 일반 호출이 반환하는 내부 함수는 별도의 컴포넌트로도 쓸 수 있도록 등록한다.

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

### 3-1. 파라미터 변환과 props 저장 객체 생성

**전체 props 객체를 받는 경우**

```javascript
// 입력
function UserCard(props) { ... }

// 출력
function UserCard(_initialProps) {
  const _props = { ..._initialProps };
  const props = _props;
  ...
}
```

**구조 분해를 사용하는 경우**

```javascript
// 입력
function UserCard({ name, age }) { ... }

// 출력
function UserCard(_initialProps) {
  const _props = { ..._initialProps };
  let { name, age } = _initialProps;
  ...
}
```

**default parameter를 가진 구조 분해**

```javascript
// 입력
function UserCard({ name } = { name: 'Guest' }) { ... }

// 출력 개념
function UserCard(_initialProps) {
  const _initialPropsValue = _initialProps === undefined
    ? { name: 'Guest' }
    : _initialProps;
  const _props = { ..._initialPropsValue };
  let { name } = _initialPropsValue;
  ...
}
```

### props 저장 객체가 필요한 이유

setup은 한 번만 실행되므로, setup 시점의 구조 분해 결과를 그대로 두면 새 props를 받아도 로컬 변수가 초기값에 고정된다. 이를 해결하기 위해 플러그인은 같은 props 저장 객체를 유지하고, 반복 render와 변환 대상인 inline watch 함수에서 `_resolveProps()`로 현재 값을 다시 해석한다.

```javascript
function UserCard(_initialProps) {
  const _props = { ..._initialProps };
  let { name } = _initialProps;
  const _resolveProps = () => {
    const { name } = _props;
    return { name };
  };
}
```

이 방식 덕분에 alias/default/nested/rest 패턴도 원래 JS semantics에 가깝게 유지할 수 있다.

### 3-2. Hook binding 판별

`watch`와 `clean`은 호출에 적힌 문자열이 아니라 Babel binding으로 구분한다.

- `import { watch as observe } from 'aeui'`의 `observe(...)`는 `watch`로 변환한다.
- `import { clean as dispose } from 'aeui'`의 `dispose(...)`는 `clean`으로 변환한다.
- `import { clean as watch } from 'aeui'`의 `watch(...)`는 이름과 관계없이 `clean`으로 변환한다.
- binding이 없는 bare `watch(...)`와 `clean(...)`은 호환 규칙에 따라 같은 이름의 hook으로 처리한다.
- local binding, 다른 패키지에서 가져온 binding, namespace/member 호출은 AEUI hook으로 추측하지 않는다.

`clean`은 인자 개수와 타입을 바꾸지 않고 callee만 `AEUI.__runtime.clean`으로 교체한다. `watch`는 다음 두 형태를 변환한다.

- **2인자**: `watch(cb, deps)` — 첫 인자가 배열이 아닐 때 `AEUI.__runtime.watch(cb, depsGetter)`로 교체
- **1인자**: `watch(cb)` — deps 없이 매 render마다 실행하는 형태로 `AEUI.__runtime.watch(cb)`로 교체

hook call 순회는 컴포넌트 아래의 중첩 함수 안까지 확인한다. 다만 구조 분해된 props 참조를 최신값으로 바꾸는 대상은 inline watch callback과 최종 dependency getter이며, identifier로 전달한 named callback의 함수 본문은 이 단계에서 다시 쓰지 않는다.

### 3-3. Watch dependency getter 처리

```javascript
// 입력
watch(() => console.log(count), [count]);

// 출력
AEUI.__runtime.watch(() => console.log(count), () => [count]);
```

두 번째 인자는 다음처럼 getter와 dependency value를 구분한다.

- inline arrow/function expression은 이미 getter이므로 그대로 둔다.
- immutable local function declaration 또는 함수 표현식 binding은 named getter로 보고 그대로 둔다.
- 배열 literal, local array/value binding과 그 밖의 명확한 dependency value는 함수로 감싸 매 검사 시점에 다시 읽는다.
- import된 identifier, 재할당 가능한 binding, 동적 member처럼 뜻을 안전하게 결정할 수 없는 값은 추측하지 않고 명시적인 getter를 요구하는 compile diagnostic을 낸다.

```javascript
function getDeps() {
  return [count];
}

watch(callback, getDeps);
// -> AEUI.__runtime.watch(callback, getDeps)

watch(callback, deps);
// deps가 local array/value binding이면
// -> AEUI.__runtime.watch(callback, () => deps)
```

named getter를 `() => getDeps`로 감싸면 dependency 결과가 아니라 함수 객체를 반환하므로 그렇게 변환하지 않는다.

### 3-4. 구조 분해된 props의 재해석

구조 분해 props는 원래 패턴 자체를 `_resolveProps()`에 보존한다. 반복 render, inline watch callback과 변환된 dependency getter는 각 실행 시점에 이를 다시 호출한다.

```javascript
function UserCard({ title: label, count = 0 }) {
  watch(() => console.log(label, count), [label, count]);
  return <p>{label}: {count}</p>;
}
```

는 개념적으로 다음 구조를 만든다.

```javascript
function UserCard(_initialProps) {
  const _props = { ..._initialProps };
  let { title: label, count = 0 } = _initialProps;
  const _resolveProps = () => {
    const { title: label, count = 0 } = _props;
    return { label, count };
  };
}
```

### 3-5. render phase helper 주입

render wrapper는 다음 helper를 호출한다.

```javascript
return (_newProps) => AEUI.__runtime.runRenderPhase(
  _newProps,
  _props,
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

### render wrapper 중복 방지

같은 AST에 플러그인을 다시 실행해도 `runRenderPhase` wrapper는 한 번만 만들어야 한다. 컴파일러는 전용 AST 표시 또는 callee, 인자 수, props 저장 객체와 내부 render 함수로 이루어진 전체 구조를 확인한다.

사용자가 `_newProps`처럼 컴파일러 예시와 비슷한 이름을 썼다는 이유만으로 변환을 건너뛰지 않는다. 반대로 사용자가 직접 `runRenderPhase`라는 함수를 호출했다는 사실만으로 이미 변환된 wrapper라고 판단하지도 않는다. serialize된 AST를 다시 컴파일하는 경우에도 같은 구조를 알아보고 wrapper를 중복 생성하지 않는다.

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
import { AEUI } from 'aeui';

export function TodoItem(_initialProps) {
  const _props = { ..._initialProps };
  let { text, done } = _initialProps;
  const _resolveProps = () => {
    const { text, done } = _props;
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

  AEUI.__runtime.clean(() => console.log("TodoItem 제거됨"));

  return (_newProps) => AEUI.__runtime.runRenderPhase(
    _newProps,
    _props,
    (_renderProps) => {
      const _resolvedProps3 = _resolveProps();
      return AEUI.createElement(
        "li",
        { className: _resolvedProps3.done ? "done" : "" },
        editing
          ? AEUI.createElement("input", { value: _resolvedProps3.text })
          : AEUI.createElement("span", null, _resolvedProps3.text)
      );
    }
  );
}
```

변환 요약:

- `{ text, done }` → 초기 props 파라미터 + props 저장 객체 생성
- `_resolveProps()`가 현재 props 저장 객체를 원래 구조 분해 패턴으로 다시 해석
- `watch(cb, [done])` → `AEUI.__runtime.watch(cb, () => [done])` 형태로 변환
- `clean(cb)` → `AEUI.__runtime.clean(cb)` 형태로 변환
- `return (JSX)` → render factory + `AEUI.__runtime.runRenderPhase(...)`
- render/watch 내부의 구조 분해 props 참조는 `_resolveProps()` 결과를 통해 최신값 사용. JSX 태그의 식별자와 member의 루트도 binding을 확인하여 재작성
- `editing`은 props가 아닌 로컬 상태이므로 변환하지 않음

---

## 변환되지 않는 것들

| 항목 | 이유 |
|------|------|
| 로컬 `let` 변수 | 클로저에 의해 최신 값 참조 가능 |
| 이벤트 핸들러 내부 코드 | 이미 클로저로 최신 상태를 참조함 |
| JSX·단순 export 반환·태그/props 사용 근거가 없는 함수 | 자동 준비 범위 밖 |
| local/다른 패키지의 `watch`·`clean` 동명 binding | AEUI hook binding이 아님 |

---

## 관련 코드 위치

- `packages/core/src/babel-plugin.js`
- `packages/core/src/core.js`
- `packages/core/src/component-lifecycle.js`
