# 06. Babel 컴파일러와 컴파일러 런타임 ABI

이 문서는 `packages/core/src/babel-plugin.js`와 `packages/core/src/compiler-runtime.js`의 규범 계약을 정의한다. AST 판별 조건, 순회 범위, 생성 코드와 런타임 호출 순서를 구현 단위로 고정한다.

## 1. 책임과 입력/출력

AEUI 컴파일러는 다음 네 가지 일을 한 번의 Babel 플러그인에서 수행한다.

1. JSX 또는 AEUI 런타임 참조에 필요한 `AEUI` named import를 보장한다.
2. 컴포넌트 함수를 setup 함수와 반복 실행 가능한 render factory로 분리한다.
3. 첫 번째 props 파라미터를 최신 props를 유지하는 가변 target과 연결한다.
4. `watch`와 `clean` 호출을 활성 앱 런타임에 바인딩된 internal helper 호출로 바꾼다.

플러그인의 default export 시그니처는 다음과 같다.

```js
export default function aeuiTransform({ types: t }) {
  return { visitor: { /* ... */ } };
}
```

플러그인 자체는 JSX를 호스트 호출로 낮추지 않는다. 직접 통합할 때는 AEUI 플러그인 뒤에 classic JSX transform을 두어야 한다.

```js
plugins: [
  aeuiTransform,
  [jsxTransform, {
    pragma: 'AEUI.createElement',
    pragmaFrag: 'AEUI.Fragment',
  }],
]
```

따라서 최종 JSX 출력은 `AEUI.createElement(...)`이고 fragment factory는 `AEUI.Fragment`다. AEUI 플러그인은 JSX 변환 전 AST와 이미 변환된 `AEUI.createVNode(...)`/`AEUI.createElement(...)`를 모두 판별할 수 있어야 한다.

## 2. 최상위 visitor와 실행 순서

visitor 계약은 다음 의사코드와 같다.

```text
Program.exit(programPath):
  if needsAeuiRuntimeBinding(programPath):
    ensureAeuiImport(programPath)

ArrowFunctionExpression | FunctionDeclaration | FunctionExpression(path):
  if not shouldTransformComponent(path):
    return
  transformToFactory(path)
  injectReactiveProps(path)
```

함수 visitor에서 먼저 render factory와 runtime helper가 생성되고, `Program.exit`에서 전체 프로그램을 다시 검사해 import를 보장한다. 함수 선언, 화살표 함수, 함수 표현식만 방문한다. class method와 object method AST 노드는 이 합성 visitor의 직접 대상이 아니다. `async` 또는 generator 여부를 별도로 제외하는 조건도 없다.

`ensureBlockBody(functionPath)`는 화살표 함수의 expression body를 다음처럼 block body로 바꾼 후 `body` path를 반환한다.

```js
const App = () => expression;

// 변환
const App = () => {
  return expression;
};
```

## 3. `AEUI` import 주입

### 3.1 올바른 binding의 정의

올바른 runtime binding은 local 이름과 imported 이름이 모두 `AEUI`인 named import다.

```js
import { AEUI } from 'aeui'; // 올바름
```

다음 형태는 동일한 binding으로 취급하지 않는다.

```js
import AEUI from 'aeui';
import * as AEUI from 'aeui';
import { AEUI as Runtime } from 'aeui';
import { Runtime as AEUI } from 'aeui';
```

검사는 Babel scope의 `programPath.scope.getBinding('AEUI')` 결과가 `ImportSpecifier`이고, imported identifier가 `AEUI`이며, 부모 import source가 정확히 문자열 `aeui`인지 확인한다.

### 3.2 import가 필요한 조건

`needsAeuiRuntimeBinding(programPath)`는 프로그램 전체를 순회하며 다음 중 하나를 처음 발견하면 `true`를 반환하고 순회를 중단한다.

- `JSXElement`
- `JSXFragment`
- referenced identifier인 `AEUI`에 binding이 없음
- referenced identifier인 `AEUI`가 올바른 import binding이 아니고, 바로 부모가 아래 네 runtime member 중 하나인 non-computed member expression임
  - `AEUI.createElement`
  - `AEUI.createVNode`
  - `AEUI.Fragment`
  - `AEUI.__runtime`

마지막 조건은 부모 member의 object가 바로 해당 identifier이고 property가 identifier이며 `computed === false`일 때만 성립한다. 따라서 JSX가 없는 파일에서 `const AEUI = value; console.log(AEUI)`는 충돌로 판정하지 않지만, `const AEUI = value; AEUI.createElement(...)`는 충돌로 판정한다. 반대로 binding이 전혀 없는 bare `AEUI` reference는 property 종류와 관계없이 import 필요 상태가 된다.

### 3.3 import 생성과 충돌 처리

`ensureAeuiImport(programPath)`는 다음 규칙을 만족해야 한다.

1. 이미 올바른 `import { AEUI } from 'aeui'` binding이 있으면 아무것도 바꾸지 않는다.
2. 다른 local `AEUI` binding이 있으면 다음 compile error를 낸다.
3. 기존 `aeui` import가 named-only이거나 default import와 named import의 조합이면, 기존 specifier의 종류와 의미를 보존한 채 named `AEUI`를 병합한다.
4. 기존 import가 namespace import를 포함하면 그 declaration에는 named specifier를 섞지 않는다. 별도의 `import { AEUI } from 'aeui'` declaration을 만든다.
5. 기존 `aeui` import가 전혀 없으면 프로그램 body 앞에 별도 named import를 만든다.
6. 어느 경로에서도 기존 default/namespace/local binding의 의미를 바꾸거나 유효하지 않은 import grammar를 생성해서는 안 된다.

출력 예시는 다음과 같다.

```js
// default import는 default 의미를 유지한다.
import Runtime, { AEUI } from 'aeui';

// namespace import에는 별도 named import를 둔다.
import * as Runtime from 'aeui';
import { AEUI } from 'aeui';
```

충돌 오류 문자열은 다음과 같다.

```text
[AEUI] Local AEUI bindings conflict with the JSX runtime import. Rename the local binding or import { AEUI } from "aeui".
```

module specifier는 옵션화되어 있지 않으며 항상 `aeui`다. 실제 npm 배포 이름과의 관계는 `08-vite-plugin-and-build.md`에서 정의한다.

## 4. renderable expression 판별

### 4.1 기본 JSX/VNode 판별

`isJSX(node)`는 다음만 `true`로 본다.

- `JSXElement`
- `JSXFragment`
- 괄호 표현식 안에서 재귀적으로 `isJSX === true`
- callee가 member expression이고 object가 identifier `AEUI`, property가 identifier `createVNode` 또는 `createElement`인 call expression

마지막 검사는 member expression의 `computed` 값을 확인하지 않는다. 따라서 AST가 identifier property를 갖는 `AEUI[createElement](...)`도 판별될 수 있지만 string literal property인 `AEUI['createElement'](...)`는 판별되지 않는다.

### 4.2 복합 표현식 판별

`containsRenderableExpression(node)`는 다음 재귀 규칙을 사용한다.

| AST 종류 | 결과 |
|---|---|
| `isJSX(node)` | `true` |
| parenthesized | 내부 expression 결과 |
| conditional | consequent 또는 alternate 중 하나라도 `true` |
| logical | left 또는 right 중 하나라도 `true` |
| sequence | expressions 중 하나라도 `true` |
| array | null slot을 제외한 element 중 하나라도 `true` |
| array의 spread | spread argument 결과 |
| 그 외 | `false` |

즉 다음은 renderable return으로 판별된다.

```js
return <A />;
return ok ? <A /> : null;
return ready && <A />;
return (prepare(), <A />);
return [header, <A />, ...itemsContainingVNode];
return AEUI.createVNode('div', null);
```

반면 일반 함수 호출, 식별자, object expression, `await` expression 안의 JSX 등은 별도의 추론 없이 `false`다.

### 4.3 render factory를 반환하는 함수 판별

`functionReturnsRenderableExpression(functionPath)`는 대상이 arrow/function expression일 때만 동작한다.

- expression-body arrow라면 body에 `containsRenderableExpression`을 적용한다.
- block body라면 대상 함수가 직접 소유한 `ReturnStatement`만 순회하고, return argument에 `containsRenderableExpression`을 적용한다.
- 중첩 함수가 소유한 return은 `returnPath.getFunctionParent().node` 비교로 제외한다.

`returnsRenderableValue(componentPath)`는 한 단계 더 넓다.

- expression-body arrow: body 자체가 renderable이거나 body가 renderable을 반환하는 함수 표현식이면 `true`
- block body: 직접 return의 argument가 renderable이거나, argument가 renderable을 반환하는 함수 표현식이면 `true`

따라서 아래 두 형태를 모두 컴포넌트 후보로 볼 수 있다.

```js
function A() { return <div />; }
function B() { return () => <div />; }
```

## 5. 컴포넌트 판별

`shouldTransformComponent(path)`는 함수의 위치와 binding reference를 함께 본다.

### 5.1 익명 default export

함수/화살표 함수가 `ExportDefaultDeclaration`의 직접 declaration이고 이름이 없으며 `returnsRenderableValue(path)`가 `true`이면 즉시 컴포넌트다.

```js
export default () => <div />;       // 변환
export default function () {        // 변환
  return <div />;
}
export default () => () => 42;      // 변환하지 않음
```

named default export는 이 예외에 포함되지 않는다.

### 5.2 후보 이름 추출

이름은 다음 위치에서만 얻는다.

| 함수 위치 | 후보 이름 |
|---|---|
| 이름 있는 `FunctionDeclaration` | 함수 id |
| identifier를 id로 갖는 `VariableDeclarator`의 init | 변수 이름 |
| non-computed member assignment의 right | left property 이름 |
| identifier key를 갖는 `ObjectProperty`의 value | property key 이름 |

export는 단독 판정 근거가 아니다. 이름, renderable 반환과 아래 사용 근거를 함께 만족해야 한다.

### 5.3 컴포넌트 근거와 판정

컴포넌트 후보를 수집할 때 허용하는 근거는 다음으로 제한한다.

1. 원본 JSX AST의 opening tag가 참조하는 **같은 모듈의 local function binding**: `<Card />`
2. callee와 runtime binding이 정확히 확인된 `AEUI.createElement` 또는 `AEUI.createVNode`의 tag argument: `AEUI.createElement(Card, props)`
3. 같은 모듈에서 정의된 export/default export 중, 익명 default export이거나 PascalCase 이름을 가지면서 `returnsRenderableValue`에 준하는 분석으로 renderable 반환까지 확인된 함수 정의

다음 값은 컴포넌트 근거가 아니다.

- 임의 호출의 첫 번째 argument
- 단순히 첫 글자가 대문자라는 사실만 있는 non-renderable 함수
- `map`, `filter`, `then`, `setTimeout`, event registration 등에 전달된 callback
- 다른 모듈에서 import된 binding의 소비 모듈 내부 사용 방식

import된 컴포넌트는 **정의가 있는 원래 모듈에서 컴파일**되어야 한다. 소비 모듈은 `<ImportedCard />`를 VNode 생성 호출로 낮출 뿐, import binding만 보고 외부 함수 정의를 추측하거나 변환하지 않는다. 이미 컴파일된 라이브러리를 소비하는 경우에도 같은 원칙을 적용한다.

re-export, 동적 alias와 식별자에 저장된 renderable처럼 정의를 안전하게 확정할 수 없는 패턴은 일반 함수로 추측 변환하지 않는다. 지원 범위에 속하지만 판정할 수 없는 입력에는 위치와 해결 방법이 포함된 compile diagnostic을 낸다.

컴포넌트 후보 분석은 JSX lowering 전의 원본 AST와 binding을 사용하고, 선택된 local binding의 정의를 정확히 한 번만 변환한다. props와 hook 변환 뒤에 classic JSX lowering을 적용한다.

## 6. `transformToFactory`: 직접 return을 factory로 변환

먼저 함수 body를 block으로 만든 후 모든 `ReturnStatement`를 순회한다. 방문 중인 컴포넌트 함수가 직접 소유한 return만 처리한다.

다음 조건을 모두 만족하면 return argument를 인자 없는 arrow function으로 감싼다.

- argument가 존재한다.
- argument가 arrow/function expression이 아니다.
- `containsRenderableExpression(argument)`가 `true`다.

```js
function Counter() {
  return <div />;
}

// 중간 AST 개념
function Counter() {
  return () => <div />;
}
```

conditional, logical, sequence, array는 전체 expression을 하나의 factory body로 감싼다. 이미 `return () => ...` 또는 `return function () { ... }` 형태라면 이 단계에서는 그대로 둔다. 복제에는 `t.cloneNode(argument, true)`를 사용한다.

## 7. props 변환

`injectReactiveProps(path)`는 factory 변환 뒤 실행된다. 첫 번째 파라미터만 props로 취급하며 지원 범위는 다음과 같다.

- identifier
- object pattern
- 위 두 종류 중 하나를 left로 갖는 assignment pattern

그 밖의 첫 파라미터는 props 변환 대상이 아니다. 두 번째 이후 컴포넌트 파라미터는 수정하지 않는다.

### 7.1 공통 target

props 변환 대상으로 분류한 파라미터는 Babel scope가 생성한 `_initialProps` 계열 identifier로 교체된다. assignment pattern이면 먼저 기본값을 계산한다. props target을 포함한 모든 compiler-generated binding은 `scope.generateUidIdentifier(...)`로 만들고, 생성한 identifier node를 alias, resolver, watcher와 render wrapper에서 일관되게 사용한다.

아래 `_initialProps`, `_initialPropsValue`와 `_props`는 대표 이름이다. 실제 이름과 숫자 suffix는 surrounding scope에 따라 달라지며 공개 계약이 아니다.

```js
function Card(props = {}) { /* ... */ }

// 생성 구조
function Card(_initialProps) {
  const _initialPropsValue =
    _initialProps === undefined ? {} : _initialProps;
  const _props = { ..._initialPropsValue };
  const props = _props;
  // ...
}
```

assignment pattern이 아니면 source는 `_initialProps` 자체다. props target은 언제나 object spread로 새 객체를 만든다. 사용자 source에 컴파일러 전용 예약 identifier를 요구해서는 안 되며 다음 의미를 보존해야 한다.

- props target object의 identity는 component instance 동안 유지된다.
- render마다 runtime이 같은 target의 key를 최신 props로 동기화한다.
- identifier props alias와 destructuring resolver는 같은 target을 참조한다.
- 사용자 binding은 이름이 generated name과 같거나 비슷해도 의미가 바뀌지 않는다.
- 변환 결과에는 duplicate binding이 없어야 한다.

### 7.2 identifier props

원래 identifier는 생성된 props target의 const alias로 복원한다.

```js
function Card(props) { /* ... */ }

// 생성 구조
function Card(_initialProps) {
  const _props = { ..._initialProps };
  const props = _props;
  // ...
}
```

런타임은 이후 `_props` 객체의 identity를 유지하면서 key를 지우고 새 props를 할당한다. 따라서 `props` alias도 최신 값을 본다.

### 7.3 object destructuring 변환

구조 분해 패턴의 모든 binding identifier를 `t.getBindingIdentifiers(pattern)`으로 수집한다. 생성 statement 순서는 다음과 같다.

1. assignment default source 선언이 있으면 추가
2. `const _props = { ...source }`
3. `const _resolveProps = () => { ... }`
4. `let originalPattern = source`

resolver는 원래 패턴을 그대로 생성된 props target에 적용하고 bound 이름을 object로 돌려준다.

```js
function Card({ title: label = 'Guest', ...rest }) { /* ... */ }

// 생성 구조
function Card(_initialProps) {
  const _props = { ..._initialProps };
  const _resolveProps = () => {
    const { title: label = 'Guest', ...rest } = _props;
    return { rest, label }; // 실제 key 순서는 getBindingIdentifiers 결과를 따름
  };
  let { title: label = 'Guest', ...rest } = _initialProps;
  // ...
}
```

초기 setup 코드에서는 원래 `let` binding을 사용한다. 반복 실행되는 render 함수와 inline watch 함수 안에서만 resolver 결과로 참조를 변환한다.

### 7.4 구조 분해 참조 변환

`prepareResolvedProps(functionPath)`는 다음을 수행한다.

1. 함수 scope에서 `_resolvedProps` 계열 identifier를 생성한다.
2. 대상 함수 전체를 순회하며 구조 분해 binding의 referenced identifier를 `_resolvedProps.<name>`으로 치환한다.
3. 대상 함수를 block body로 만든다.
4. 맨 앞에 `const _resolvedProps = _resolveProps();`를 삽입한다.

단, 같은 이름이 대상 함수 안쪽 scope에 새로 binding되어 있고 그 binding scope가 원 컴포넌트 scope와 다르면 치환하지 않는다. 이 규칙은 callback parameter나 중첩 local variable shadowing을 보존한다.

적용 대상은 다음뿐이다.

- `watch`의 첫 argument가 inline arrow/function expression인 경우 그 callback
- 변환된 `watch` deps getter
- 반환된 render function

identifier로 전달한 named watch callback은 함수 path가 아니므로 이 변환 대상이 아니다.

## 8. `watch`와 `clean` 변환

### 8.1 hook call 판별

hook 종류는 callee의 문자열 이름이 아니라 Babel binding으로 결정한다.

```text
callee가 identifier가 아니면 hook 아님
binding이 aeui ImportSpecifier이면:
  imported 이름이 watch -> runtime.watch
  imported 이름이 clean -> runtime.clean
  그 외 -> hook 아님
binding이 없고 callee가 bare watch/clean이면:
  unbound compatibility 규칙에 따라 같은 이름의 runtime hook
그 밖의 local binding 또는 다른 module import이면 hook 아님
```

따라서 `import { watch as observe }`의 `observe(...)`는 watch로, `import { clean as dispose }`의 `dispose(...)`는 clean으로 변환한다. `import { clean as watch }`의 `watch(...)`는 **clean**으로 변환하며 watch로 취급하지 않는다.

`import { somethingElse as watch } from 'aeui'`, 다른 package에서 import한 hook 이름과 같은 이름의 local binding은 변환하지 않는다. namespace member와 임의 member call도 local identifier hook으로 취급하지 않는다.

이 순회는 컴포넌트 path 아래의 모든 call expression을 보며 중첩 함수 소유 여부를 제한하지 않는다.

### 8.2 `clean`

인자 개수와 타입을 검사하지 않고 callee만 바꾼다.

```js
clean(callback);
// -> AEUI.__runtime.clean(callback)
```

### 8.3 `watch`

다음 조건일 때만 변환한다.

- argument가 정확히 2개다.
- 첫 argument가 `ArrayExpression`이 아니다.

첫 argument가 array이면 deps-first 구문으로 간주하여 그대로 둔다. argument가 1개 또는 3개 이상이어도 그대로 둔다.

두 번째 argument는 8.4의 규칙으로 getter와 dependency value를 구분한다.

```js
watch(callback, [count]);
// -> AEUI.__runtime.watch(callback, () => [count])

watch(callback, () => [count]);
// -> AEUI.__runtime.watch(callback, () => [count])
```

### 8.4 dependency getter 분류

두 번째 argument는 다음 순서로 분류한다.

1. inline arrow/function expression이면 getter 자체를 유지한다.
2. identifier의 local binding이 function declaration이거나 arrow/function expression으로 초기화된 immutable binding이면 named getter로 판정하고 identifier 자체를 유지한다.
3. array literal, local array/value binding, 그리고 그 밖의 명확한 dependency value expression은 `() => expression`으로 감싸 매 검사 시점에 값을 다시 읽는다.
4. import된 identifier, 재할당 가능한 binding, 동적 member처럼 getter인지 dependency value인지 안전하게 결정할 수 없는 입력은 추측하지 않는다. 사용자가 `() => getDeps()` 또는 `() => deps`로 의미를 명시하도록 compile diagnostic을 낸다.

```js
function getDeps() {
  return [count];
}

watch(callback, getDeps);
// -> AEUI.__runtime.watch(callback, getDeps)

watch(callback, deps);
// deps가 local array/value binding이면 -> runtime.watch(callback, () => deps)
```

named getter는 불필요한 wrapper 없이 원 getter binding을 유지한다. `() => getDeps`처럼 함수 객체를 dependency 결과로 반환하는 출력은 생성하지 않는다.

구조 분해 props가 있으면 inline callback과 최종 deps getter 각각에 별도의 `_resolvedProps` 선언을 넣고 참조를 변환한다.

변환되지 않은 public `watch()`는 실행 시 항상 다음 오류를 던진다.

```text
[AEUI] watch(callback, deps) must be compiled by the AEUI Babel plugin.
```

따라서 잘못된 argument 개수나 deps-first 호출이 우연히 fallback 동작을 갖지는 않는다.

## 9. render phase wrapper 생성

props와 hook 처리가 끝난 뒤, 컴포넌트가 직접 반환하는 arrow/function expression을 runtime wrapper로 바꾼다.

```js
return renderFunction;

// 생성 형태
return (_newProps) => AEUI.__runtime.runRenderPhase(
  _newProps,
  propsTarget,
  innerRenderFunction
);
```

`propsTarget`은 지원되는 첫 props 파라미터가 있었으면 7.1에서 생성한 scope-safe props target, 없으면 `null`이다.

### 9.1 원 render 파라미터 보존

원 render 함수의 첫 파라미터만 저장하고, 함수 파라미터 목록 전체를 생성된 `_renderProps` 하나로 교체한다. 원 첫 파라미터에 따라 body 앞에 다음 binding을 삽입한다.

| 원 파라미터 | 생성 binding |
|---|---|
| identifier `p` | `const p = _renderProps` |
| object/array pattern | `const pattern = _renderProps` |
| 지원되는 assignment pattern | `const left = _renderProps === undefined ? right : _renderProps` |
| 없음 또는 그 밖의 패턴 | 생성 없음 |

원 render 함수의 두 번째 이후 파라미터는 보존되지 않는다. 원 함수가 expression body이면 block과 return으로 바꾼다. 구조 분해 component props용 `_resolvedProps` 선언은 위 render-param binding보다 먼저 삽입된다.

구조 분해 component props가 있는 경우 방금 삽입한 render-param binding도 참조 변환 순회를 한 번 더 거친다. 따라서 render 파라미터의 default expression이 component의 구조 분해 binding을 참조하면 `_resolvedProps.<name>`으로 바뀐다.

### 9.2 wrapper idempotence

idempotence 판별은 사용자 identifier 문자열에 의존하지 않는다. generated wrapper는 plugin 전용 AST 기록 또는 callee, argument 수, props target과 inner render 구조를 모두 확인하는 canonical 구조로 식별한다.

같은 AST에 플러그인을 다시 실행해도 wrapper는 한 번만 생성한다. 사용자가 `_newProps`, `_newProps2`, `_newPropsFromParent` 같은 이름을 선택했다는 사실은 skip 근거가 아니다. AST가 serialize된 뒤 다시 컴파일되는 경로에서도 canonical wrapper 구조로 중복 생성을 막는다. 사용자가 우연히 `runRenderPhase`라는 helper를 호출했다는 사실만으로 generated wrapper로 취급하지 않는다.

## 10. 전체 변환 예시

입력:

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

대표 출력 구조는 다음과 같다. generated identifier의 숫자 suffix와 포맷은 surrounding scope와 Babel generator에 따라 달라질 수 있다.

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

## 11. 컴파일러 런타임 ABI

컴파일된 코드는 public hook을 직접 실행하지 않고 앱별 `AEUI.__runtime`을 호출한다. `createAppRuntime()`은 다음 연결을 만든다.

| 생성 코드 | `__runtime` 구현 |
|---|---|
| `watch(...)` | `registerWatch(state, ...)` |
| `clean(...)` | `registerCleanup(state, ...)` |
| `runRenderPhase(...)` | `runRenderPhaseBridge(state, ...)` |
| `runComponentWatchers(...)` | `runComponentWatchersBridge(state, ...)` |

### 11.1 `runComponentWatchersBridge`

```js
export function runComponentWatchersBridge(state, node) {
  runComponentWatchers(state, node);
}
```

반환값을 가공하지 않는 단순 위임이다.

### 11.2 `runRenderPhaseBridge`

정확한 제어 흐름은 다음과 같다.

```js
export function runRenderPhaseBridge(state, nextProps, propsTarget, render) {
  const node = state.currentComponentNode;
  if (!node) {
    return typeof render === 'function' ? render(nextProps || {}) : null;
  }

  return runComponentRenderPhase(state, node, nextProps, render, {
    propsTarget,
    runWatchers: true,
  });
}
```

활성 component node가 없으면 props target을 동기화하지 않고 watcher도 실행하지 않으며 component context도 만들지 않는다. render가 함수일 때만 `nextProps || {}`를 넘겨 직접 호출하고, 아니면 `null`을 반환한다.

node가 있으면 `runComponentRenderPhase`가 다음 순서를 보장한다.

1. `node.props = nextProps || {}`
2. `propsTarget`이 객체이면 `for...in`으로 기존 key를 delete
3. `nextProps`가 truthy이면 `Object.assign(propsTarget, nextProps)`
4. `runComponentWatchers(state, node)` 실행
5. render가 함수가 아니면 `null`
6. 이미 같은 node의 render phase이면 `render(node.props)` 직접 호출
7. 아니면 `withComponentContext(state, node, 'render', ...)` 안에서 호출

이 순서 때문에 watcher deps와 callback, 실제 render가 모두 동기화된 props target을 본다.

## 12. 컴파일러 스펙 경계

- import source 문자열은 `aeui`로 고정한다.
- component 판별에서 export 여부는 최종 조건이 아니다.
- return과 renderable 검사에서는 중첩 함수의 직접 return을 소유 함수 비교로 제외한다.
- hook call 순회에는 같은 소유 함수 제한이 없다.
- `clean`도 runtime helper로 변환된다.
- `watch`는 정확히 두 argument만 변환하고 첫 argument array를 거부한다.
- props는 첫 component 파라미터만 처리한다. 지원 범위는 identifier/object pattern과 그 assignment pattern이다.
- render 함수는 원 첫 파라미터만 재바인딩하고 나머지는 버린다.
- destructured props의 최신값을 반영하는 참조 변환은 render와 inline watch 함수에 한정된다.
- classic JSX transform의 pragma는 `AEUI.createElement`, fragment pragma는 `AEUI.Fragment`다.
- Vite 통합의 parser와 JSX transform 순서는 `08-vite-plugin-and-build.md`를 따른다.
