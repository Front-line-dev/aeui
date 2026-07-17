# 06. Babel 컴파일러와 컴파일러 런타임 ABI

이 문서는 `packages/core/src/babel-plugin.js`와 `packages/core/src/compiler-runtime.js`의 목표 계약과 현재 구현을 함께 설명한다. 설명을 단순화한 사용 가이드가 아니라 AST 판별 조건, 순회 범위, 생성 코드, 런타임 호출 순서를 구현 단위로 고정한다. 상태는 **규범**, **현재 구현**, **계획 기능**, **수정 필요**로 구분한다. **수정 필요**로 표시한 현재 동작은 재구현 시 보존할 계약이 아니며 목표 계약에 맞게 고쳐야 한다. **계획 기능**은 현재 적합성 요건이 아니지만 향후 구현해야 할 기능이다.

## 1. 책임과 입력/출력

AEUI 컴파일러는 다음 네 가지 일을 한 번의 Babel 플러그인에서 수행한다.

1. JSX 또는 AEUI 런타임 참조에 필요한 `AEUI` named import를 보장한다.
2. 컴포넌트 함수를 setup 함수와 반복 실행 가능한 render factory로 분리한다.
3. 첫 번째 props 파라미터를 최신 props를 유지하는 가변 target과 연결한다.
4. `watch`와 `clean` 호출을 현재 앱 런타임에 바인딩된 internal helper 호출로 바꾼다.

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

### 3.3 **현재 구현**: import 생성과 충돌

현재 `ensureAeuiImport(programPath)`의 순서는 다음과 같다.

```text
binding = program scope의 "AEUI" binding

if binding이 올바른 `import { AEUI } from 'aeui'`:
  종료

if 다른 binding이 존재:
  compile error

source가 정확히 "aeui"인 첫 ImportDeclaration을 찾음
if 존재:
  imported/local 이름이 모두 AEUI인 specifier가 없으면 맨 앞에 추가
  종료

프로그램 body 맨 앞에 `import { AEUI } from 'aeui'` 추가
```

충돌 오류 문자열은 다음과 같다.

```text
[AEUI] Local AEUI bindings conflict with the JSX runtime import. Rename the local binding or import { AEUI } from "aeui".
```

기존 import가 named specifier로만 구성되어 있을 때 맨 앞에 `AEUI`를 추가한 결과는 유효하다.

```js
import { watch } from 'aeui';
export default () => <div />;

// 결과의 import
import { AEUI, watch } from 'aeui';
```

#### **수정 필요**: default/namespace import의 문법과 의미 훼손

현재 구현은 기존 `aeui` import의 specifier 종류를 구분하지 않고 `ImportSpecifier(AEUI)`를 배열 맨 앞에 넣는다. 이 동작은 named-only import에서는 문제가 없지만 다음 두 입력을 망가뜨린다.

```js
import Runtime from 'aeui';
export default () => <div />;

// 현재 생성 결과
import { AEUI, Runtime } from 'aeui';
```

원래 `Runtime`은 default import였지만 생성 결과에서는 named import가 된다. 코드는 문법상 유효할 수 있어도 import 의미가 바뀐다.

```js
import * as Runtime from 'aeui';
export default () => <div />;

// 현재 생성 결과
import { AEUI, * as Runtime } from 'aeui';
```

두 번째 결과는 유효한 ECMAScript import 문법이 아니다. 이 두 결과는 현재 구현의 알려진 결함이며 호환성이나 재현 대상으로 고정하지 않는다.

#### 목표 계약: 기존 import의 문법과 의미 보존

수정된 `ensureAeuiImport`는 다음 규칙을 만족해야 한다.

1. 이미 올바른 `import { AEUI } from 'aeui'` binding이 있으면 아무것도 바꾸지 않는다.
2. 다른 local `AEUI` binding이 있으면 현재와 같은 compile error를 낸다.
3. 기존 `aeui` import가 named-only이거나 default import와 named import의 조합이면, 기존 specifier의 종류와 의미를 보존한 채 named `AEUI`를 병합한다.
4. 기존 import가 namespace import를 포함하면 그 declaration에는 named specifier를 섞지 않는다. 별도의 `import { AEUI } from 'aeui'` declaration을 만든다.
5. 기존 `aeui` import가 전혀 없으면 프로그램 body 앞에 별도 named import를 만든다.
6. 어느 경로에서도 기존 default/namespace/local binding의 의미를 바꾸거나 유효하지 않은 import grammar를 생성해서는 안 된다.

목표 출력 예시는 다음과 같다.

```js
// default import는 default 의미를 유지한다.
import Runtime, { AEUI } from 'aeui';

// namespace import에는 별도 named import를 둔다.
import * as Runtime from 'aeui';
import { AEUI } from 'aeui';
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

export 여부도 계산하지만 현재 최종 판정에는 사용하지 않는다. 즉 export라는 사실만으로 컴포넌트가 되지 않는다.

### 5.3 **현재 구현**: 사용 지점 기반 판별

함수 선언 또는 identifier 변수 binding의 reference가 다음 중 하나이면 `isUsedAsComponent = true`다.

- JSX opening element의 name과 reference node가 동일: `<Card />`
- 임의의 call expression에서 reference가 정확히 첫 번째 argument: `someCall(Card, ...)`

두 번째 조건은 callee가 `AEUI.createElement`인지 확인하지 않는다. 그러므로 `register(Card)` 같은 일반 호출도 같은 휴리스틱에 걸린다. 사용 지점으로 판별된 함수는 renderable return 검사를 추가로 요구하지 않는다.

### 5.4 **수정 필요 — `AEUI-COMPILER-FIX-001`**: 임의 호출 첫 인자의 컴포넌트 오인

#### 현재 잘못된 동작

현재 구현은 함수 binding이 어떤 call expression의 첫 번째 argument로 사용되기만 하면 컴포넌트로 판정한다. callee의 정체와 함수의 반환값을 확인하지 않으므로 일반 callback과 등록 함수까지 AEUI 컴포넌트 변환을 받을 수 있다.

```js
function formatName(name) {
  return name.toUpperCase();
}

names.map(formatName); // 현재 구현은 formatName을 컴포넌트로 오인할 수 있다.
register(formatName);  // register가 AEUI API인지도 확인하지 않는다.
```

이때 첫 파라미터는 props target을 위한 파라미터로 바뀌고 함수 본문에도 컴포넌트용 코드가 삽입된다. 원래 문자열을 받던 utility가 객체 props를 받는 함수로 바뀌므로, 이 동작은 호환성 경계가 아니라 일반 JavaScript를 훼손하는 결함이다.

#### 목표 계약

컴포넌트 후보를 수집할 때 허용하는 근거는 다음으로 제한한다.

1. 원본 JSX AST의 opening tag가 참조하는 **현재 모듈의 local function binding**: `<Card />`
2. callee와 runtime binding이 정확히 확인된 `AEUI.createElement` 또는 `AEUI.createVNode`의 tag argument: `AEUI.createElement(Card, props)`
3. 현재 모듈에서 정의된 export/default export 중, 익명 default export이거나 PascalCase 이름을 가지면서 `returnsRenderableValue`에 준하는 분석으로 renderable 반환까지 확인된 함수 정의
4. 향후 도입할 명시적 component marker 또는 annotation으로 선택된 함수

다음 값은 컴포넌트 근거가 아니다.

- 임의 호출의 첫 번째 argument
- 단순히 첫 글자가 대문자라는 사실만 있는 non-renderable 함수
- `map`, `filter`, `then`, `setTimeout`, event registration 등에 전달된 callback
- 다른 모듈에서 import된 binding의 소비 모듈 내부 사용 방식

import된 컴포넌트는 **정의가 있는 원래 모듈에서 컴파일**되어야 한다. 소비 모듈은 `<ImportedCard />`를 VNode 생성 호출로 낮출 뿐, import binding만 보고 외부 함수 정의를 추측하거나 다시 작성하지 않는다. 이미 컴파일된 라이브러리를 소비하는 경우에도 같은 원칙을 적용한다.

re-export, 동적 alias, 식별자에 저장된 renderable처럼 현재 분석으로 정의를 안전하게 확정할 수 없는 패턴은 일반 함수로 추측 변환하지 않는다. 지원해야 하는 입력이면 명시적 marker를 요구하고, 지원 대상처럼 보이지만 결정할 수 없으면 위치와 해결 방법이 포함된 compile diagnostic을 낸다.

#### 필수 테스트

positive test는 다음을 포함한다.

- local `Card`가 `<Card />`로 사용될 때 해당 binding의 정의를 한 번만 변환한다.
- 정확한 `AEUI.createElement(Card, ...)`와 `AEUI.createVNode(Card, ...)`가 local `Card` 정의를 선택한다.
- renderable을 반환하는 named/default export 정의가 명시된 export 정책에 따라 변환된다.
- import된 `Card`를 사용하는 소비 모듈에서는 import binding이나 무관한 local 함수를 다시 작성하지 않는다.

negative test는 다음을 포함한다.

```js
items.map(formatName);
items.filter(isVisible);
setTimeout(callback, 0);
register(utility);
promise.then(handler);
```

각 함수의 파라미터, body, 반환 의미가 변하지 않아야 한다. `someCall(Card)`처럼 대문자이고 renderable을 반환하는 함수도 **그 호출만을 근거로는** 선택해서는 안 된다.

### 5.5 React의 JSX 처리에서 빌릴 원칙과 AEUI의 사전 변환 단계

React에서 JSX lowering과 React Compiler는 서로 다른 문제를 해결한다. 이 둘을 구분해야 AEUI의 컴포넌트 변환 순서도 명확해진다.

#### React JSX lowering이 하는 일

React의 JSX에서는 `<Something />`이 `createElement(Something)`에 해당하고, 소문자 `<something />`은 `createElement('something')`에 해당한다. 생성된 element는 전달받은 함수 또는 문자열을 `type`으로 보관하고, element 생성 시점에는 그 컴포넌트를 실행하지 않는다. 자세한 기준은 React 공식 [`createElement` 문서](https://react.dev/reference/react/createElement)에 설명되어 있다.

즉 JSX lowering은 **태그가 가리키는 값의 identity를 runtime에 전달**한다. `function Something() { ... }` 정의를 setup/render 형태로 다시 작성하거나, 임의의 호출 인자를 보고 그 함수가 컴포넌트인지 추론하는 단계가 아니다.

```jsx
function Greeting(props) {
  return <h1>{props.name}</h1>;
}

const element = <Greeting name="Ada" />;
```

classic transform의 핵심 결과만 단순화하면 다음과 같다.

```js
function Greeting(props) {
  return React.createElement('h1', null, props.name);
}

const element = React.createElement(Greeting, { name: 'Ada' });
```

`Greeting` 함수 정의의 실행 모델은 JSX lowering이 바꾸지 않는다. React가 render 시점마다 함수 컴포넌트를 호출할 수 있기 때문에 가능한 구조다.

#### React Compiler에서 참고할 선택과 실패 안전성

함수 정의를 분석하는 React Compiler도 모든 호출 인자를 컴포넌트로 간주하지 않는다. 공식 [`compilationMode` 문서](https://react.dev/reference/react-compiler/compilationMode)의 기본 `infer` 모드는 PascalCase/hook 이름과 JSX 생성 또는 hook 호출을 함께 사용하고, 명시적 annotation 및 syntax 모드도 제공한다. 모든 top-level 함수를 선택하는 `all` 모드는 utility까지 컴파일할 수 있어 권장되지 않는다.

React Compiler는 원본 source 정보가 필요하므로 다른 Babel 변환보다 먼저 실행되어야 한다. 또한 React Compiler용 lint가 위반을 보고한 component/hook은 최적화를 건너뛰면서 다른 코드는 계속 처리하는 실패 안전 경로를 제공한다. 이 원칙은 React 공식 [Compiler 설치 문서](https://react.dev/learn/react-compiler/installation)에 설명되어 있다.

AEUI가 여기서 빌려야 할 원칙은 다음과 같다.

- 변환 전 원본 JSX와 binding 정보를 먼저 본다.
- 이름 하나가 아니라 이름, renderable 반환, JSX tag 사용, 명시적 marker 같은 근거를 결합한다.
- 확신할 수 없는 일반 함수는 변환하지 않는다.
- 지원이 필요한 모호한 입력은 조용히 추측하지 않고 skip/diagnostic 또는 명시적 marker로 해결한다.

이는 React Compiler의 구현을 복제한다는 뜻이 아니다. AEUI에는 React와 다른 **setup-once/render-many** 실행 모델이 있으므로, JSX lowering만으로는 충분하지 않다.

#### AEUI가 요구하는 두 단계 컴파일

AEUI source transform은 한 모듈 안에서 다음 순서를 지켜야 한다.

```text
1. JSX를 보존한 원본 AST parse
2. 전체 모듈의 scope와 binding 생성
3. 컴포넌트 후보 수집 — 이 단계에서는 AST를 아직 변형하지 않음
4. 근거 검증 및 모호한 후보의 skip/diagnostic 결정
5. 선택된 local 함수 정의를 setup-once/render-factory 형태로 한 번만 변환
6. props target, watch/clean, render-phase wrapper 변환
7. AEUI runtime import 보장
8. classic JSX lowering: JSX -> AEUI.createElement, Fragment -> AEUI.Fragment
9. 그 밖의 Babel/TypeScript 변환
```

핵심은 **3~6번이 classic JSX lowering보다 먼저** 실행되어야 한다는 것이다. JSX를 먼저 모두 호출식으로 낮추면 local tag binding과 원본 JSX return의 위치 정보가 줄어들어 컴포넌트 선택과 render factory 분리가 더 불안정해진다.

후보 수집과 실제 변환은 같은 visitor에서 발견 즉시 섞지 않고 모듈 단위의 두 pass로 분리한다.

```text
analysis pass: 원본 AST에서 candidate binding과 근거를 기록
rewrite pass: 검증된 local binding의 정의만 정확히 한 번 변환
```

이 구조에서는 `<Card />`가 `Card`라는 local binding을 가리킨다는 사실을 안전하게 사용할 수 있고, `items.map(formatName)`은 어떠한 component evidence도 만들지 않는다. import된 `Card`는 소비 모듈에서 정의 변환 대상이 아니며, `Card`를 정의한 모듈의 analysis/rewrite pass가 책임진다.

React와 AEUI의 책임 차이를 표로 정리하면 다음과 같다.

| 단계 | React의 일반 JSX 처리 | AEUI 목표 처리 |
|---|---|---|
| JSX tag 해석 | `<div>`는 host string, `<Card>`는 `Card` 값으로 lowering | 같은 구분을 component 후보 binding 수집에도 사용 |
| component 함수 정의 | JSX lowering은 함수 본문을 바꾸지 않음 | 검증된 local component만 setup-once/render-factory 형태로 사전 변환 |
| 일반 callback | JSX와 무관하므로 그대로 둠 | `map`, `filter`, timer 등의 인자라는 이유로 변환하지 않음 |
| 모호한 함수 | JSX lowering의 관심 대상이 아님 | 일반 함수로 보존하고, 지원이 필요하면 marker 또는 diagnostic으로 명시 |
| 최종 element type | 문자열 또는 함수 identity를 runtime에 전달 | 문자열 또는 이미 컴파일된 component 함수 identity를 runtime에 전달 |

하나의 모듈을 개념적으로 처리하는 예는 다음과 같다. 아래 코드는 실제 generated UID 이름을 고정하려는 예가 아니라 단계별 책임을 보여 주기 위한 축약형이다.

```jsx
function formatName(name) {
  return name.toUpperCase();
}

function Card(props) {
  return <article>{props.title}</article>;
}

export default function App() {
  const labels = names.map(formatName);
  return <Card title={labels[0]} />;
}
```

analysis pass는 `<Card />`와 export된 JSX 반환 함수에서 `Card`, `App`의 local binding을 선택한다. `formatName`은 `map`의 argument이지만 JSX tag도 아니고 component export 조건도 만족하지 않으므로 선택하지 않는다.

rewrite pass는 선택된 함수만 개념적으로 다음 역할로 나눈다.

```text
Card setup: props target과 component-local closure를 인스턴스당 한 번 준비
Card render factory: 최신 props 동기화 -> watcher 실행 -> <article> 계산
App setup/render factory: 같은 방식으로 분리
formatName: 원래 JavaScript 함수 그대로 유지
```

그 뒤 JSX lowering이 `<article>`을 `AEUI.createElement('article', ...)`로, `<Card>`를 `AEUI.createElement(Card, ...)`로 바꾼다. 이 순서를 뒤집어 JSX 정보를 잃은 뒤 임의 호출 인자를 훑어 component를 추측해서는 안 된다.

### 5.6 **현재 구현**: 이름 기반 판별과 최종 우선순위

후보 이름의 첫 글자가 `/^[A-Z]/`에 맞고 `returnsRenderableValue(path)`가 `true`이면 컴포넌트다. 전체 이름이 PascalCase인지 검사하는 것이 아니라 첫 ASCII 문자가 대문자인지만 검사한다.

```js
function User(name) {
  return name.toUpperCase();
}
// 대문자로 시작하지만 renderable return이 없으므로 변환하지 않음
```

현재 구현의 최종 판정 우선순위는 다음과 같다.

```text
anonymous default export && returnsRenderableValue -> true
used as JSX tag or any call's first argument       -> true
uppercase first character && returnsRenderableValue -> true
otherwise                                           -> false
```

이 표는 현재 동작을 재현하기 위한 설명일 뿐 목표 판정 계약이 아니다. 특히 `any call's first argument`는 `AEUI-COMPILER-FIX-001`에 따라 제거해야 한다. lowercase named default export가 JSX를 반환하더라도 다른 사용 지점이 없으면 변환되지 않는다는 점도 현재 규칙의 결과다.

## 6. `transformToFactory`: 직접 return을 factory로 변환

먼저 함수 body를 block으로 만든 후 모든 `ReturnStatement`를 순회한다. 현재 컴포넌트 함수가 직접 소유한 return만 처리한다.

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

`injectReactiveProps(path)`는 factory 변환 뒤 실행된다. 첫 번째 파라미터만 props로 취급한다. 현재 정상적으로 사용할 수 있는 component props 파라미터는 다음과 같다.

- identifier
- object pattern
- 위 두 종류 중 하나를 left로 갖는 assignment pattern

현재 compiler의 AST 판별 함수는 array pattern과 array pattern을 left로 갖는 assignment pattern도 변환 대상으로 받아들이지만, 표준 VNode 실행 경로에서는 실제로 사용할 수 없다. 이 상태는 7.3에 설명한 향후 기능의 미완성 구현이지 지원 계약이 아니다. rest parameter 등 그 밖의 첫 파라미터는 props 변환 대상이 아니다. 두 번째 이후 컴포넌트 파라미터는 수정하지 않는다.

### 7.1 공통 target

#### **현재 구현**: 고정 이름 `__props`

현재 compiler가 props 변환 대상으로 분류한 파라미터는 Babel scope가 생성한 `_initialProps` 계열 identifier로 교체된다. assignment pattern이면 먼저 기본값을 계산한다.

```js
function Card(props = {}) { /* ... */ }

// 생성 구조
function Card(_initialProps) {
  const _initialPropsValue =
    _initialProps === undefined ? {} : _initialProps;
  const __props = { ..._initialPropsValue };
  const props = __props;
  // ...
}
```

assignment pattern이 아니면 source는 `_initialProps` 자체다. `__props`는 언제나 object spread로 새 객체를 만든다.

`_initialProps`, `_initialPropsValue`, `_resolveProps`, `_resolvedProps`, `_newProps`, `_renderProps`는 `scope.generateUidIdentifier`를 사용하므로 충돌 시 숫자 suffix가 붙는다. `__props`만 고정 문자열 identifier이므로 컴포넌트 body에서 같은 이름을 선언하는 사용자 코드는 생성 선언과 충돌한다. 이 차이는 현재 구현을 설명하기 위한 것이며 재현하거나 보존할 계약이 아니다.

#### **수정 필요 — `AEUI-COMPILER-FIX-002`**: generated `__props` 이름 충돌

현재 출력은 다음 입력에 컴파일러 자신의 중복 binding을 삽입할 수 있다.

```jsx
function Card(props) {
  const __props = readDebugProps();
  return <p>{props.title}</p>;
}
```

목표 구현은 props target도 `scope.generateUidIdentifier('props')`처럼 Babel scope가 보장하는 UID로 생성해야 한다. 생성된 identifier node를 props alias, resolver, watcher, render wrapper에 일관되게 복제하여 사용하고, 문자열 이름 `__props`를 다시 찾아 연결해서는 안 된다.

사용자 source에 컴파일러 전용 예약 identifier를 요구해서는 안 된다. UID의 실제 출력 이름과 숫자 suffix는 공개 계약이 아니지만 다음 의미는 보존해야 한다.

- props target object의 identity는 component instance 동안 유지된다.
- render마다 runtime이 같은 target의 key를 최신 props로 동기화한다.
- identifier props alias와 destructuring resolver는 같은 target을 참조한다.
- 사용자 binding은 이름이 우연히 generated name과 비슷해도 의미가 바뀌지 않는다.

positive test는 일반 identifier/object-pattern/default props가 고유 target을 통해 기존의 최신 props 동기화 의미를 유지하는지 검사해야 한다.

negative test는 사용자 코드에 `__props`, `_initialProps`, `_resolveProps`, `_newProps` 같은 이름을 각각 선언한 입력을 변환해야 한다. 출력은 다시 parse되어야 하고 duplicate binding이 없어야 하며, 모든 사용자 binding의 참조가 원래 binding을 계속 가리켜야 한다.

### 7.2 identifier props

원래 identifier는 `__props`의 const alias로 복원한다.

```js
function Card(props) { /* ... */ }

// 생성 구조
function Card(_initialProps) {
  const __props = { ..._initialProps };
  const props = __props;
  // ...
}
```

런타임은 이후 `__props` 객체의 identity를 유지하면서 key를 지우고 새 props를 할당한다. 따라서 `props` alias도 최신 값을 본다.

### 7.3 destructuring 변환과 ArrayPattern 계획

구조 분해 패턴의 모든 binding identifier를 `t.getBindingIdentifiers(pattern)`으로 수집한다. 생성 statement 순서는 다음과 같다.

1. assignment default source 선언이 있으면 추가
2. `const __props = { ...source }`
3. `const _resolveProps = () => { ... }`
4. `let originalPattern = source`

resolver는 원래 패턴을 그대로 `__props`에 적용하고 bound 이름을 object로 돌려준다.

```js
function Card({ title: label = 'Guest', ...rest }) { /* ... */ }

// 생성 구조
function Card(_initialProps) {
  const __props = { ..._initialProps };
  const _resolveProps = () => {
    const { title: label = 'Guest', ...rest } = __props;
    return { rest, label }; // 실제 key 순서는 getBindingIdentifiers 결과를 따름
  };
  let { title: label = 'Guest', ...rest } = _initialProps;
  // ...
}
```

초기 setup 코드에서는 원래 `let` binding을 사용한다. 반복 실행되는 render 함수와 inline watch 함수 안에서만 resolver 결과로 참조를 다시 쓴다.

#### **계획 기능**: component ArrayPattern props

component ArrayPattern props는 현재 사용할 수 없지만 AEUI compiler가 향후 **반드시 지원해야 하는 계획 기능**이다. 이 요구를 선택 기능이나 비목표로 내릴 수 없다. 현재 compiler는 ArrayPattern에도 위 코드를 생성하지만 `__props`는 항상 object spread로 만든 plain object다.

```js
function Pair([left, right]) { /* ... */ }

// 개념 출력
function Pair(_initialProps) {
  const __props = { ..._initialProps }; // 항상 plain object
  const _resolveProps = () => {
    const [left, right] = __props;       // __props가 iterable이 아니므로 TypeError
    return { left, right };
  };
  let [left, right] = _initialProps;     // 정상 VNode 경로에서는 여기서 먼저 TypeError
  // ...
}
```

표준 AEUI VNode 경로에서 component가 받는 `vnode.props`는 `createVNode`가 object spread로 만든 plain object다. 따라서 component ArrayPattern은 binding 유무와 관계없이 setup의 `let pattern = _initialProps`가 iterator를 요구하는 순간 먼저 TypeError를 낸다. 빈 `[]`와 assignment pattern의 ArrayPattern left도 이 경계를 피하지 못한다.

변환된 component 함수를 runtime 밖에서 실제 Array 인자로 직접 호출하면 setup restore binding은 통과할 수 있다. 그러나 `__props`는 이미 plain object이므로 binding identifier가 있는 패턴은 반환된 render가 `_resolveProps()`를 호출할 때 다시 TypeError가 난다. 빈 ArrayPattern direct-call만 resolver 준비가 생략될 수 있지만 이는 표준 VNode component 실행 경로가 아니다.

반면 **반환된 render 함수의 파라미터**가 ArrayPattern인 경우에는 `_renderProps`를 그대로 `const [x] = _renderProps`에 사용하므로 실제 render props가 배열이면 동작한다. component props ArrayPattern과 render parameter ArrayPattern을 같은 지원 수준으로 서술해서는 안 된다.

위 TypeError는 현재 상태를 진단하기 위한 설명일 뿐, 향후 구현이 재현해야 할 실패 계약이 아니다. 현재 적합성 기준에서는 component props ArrayPattern을 아직 구현되지 않은 **계획 기능**으로 분류한다. 지원 자체는 확정된 필수 목표이며, 구현 전에는 다음 세부 ABI를 별도 설계 문서에서 먼저 확정해야 한다.

- object인 `vnode.props`를 positional ArrayPattern에 어떤 순서로 대응시킬지
- 또는 ArrayPattern component에 실제 iterable props를 전달하는 별도 ABI를 둘지
- `__props`의 identity 유지와 render마다 최신 props를 다시 구조 분해하는 규칙을 어떻게 보존할지
- 빈 패턴, hole, rest element, default value, assignment pattern을 각각 어떻게 처리할지

어떤 ABI를 선택하더라도 최종 규범은 표준 VNode 경로에서 ArrayPattern component가 TypeError 없이 setup과 반복 render를 완료하는 것이다. 설계가 확정되면 이 성공 경로와 빈 패턴, hole, rest, default, assignment 경계를 새 적합성 suite에 반드시 추가한다.

### 7.4 구조 분해 참조 재작성

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

identifier로 전달한 named watch callback은 함수 path가 아니므로 이 재작성 대상이 아니다.

## 8. `watch`와 `clean` 변환

### 8.1 **현재 구현**: hook call 판별

호출 판별은 `isAeuiHookCall(callPath, hookName)`이 담당한다.

```text
callee가 정확히 hookName identifier가 아니면 false
binding이 없으면 true
binding이 ImportSpecifier가 아니면 false
그 import의 source가 정확히 "aeui"이면 true
그 외 false
```

import specifier의 imported 이름은 별도로 확인하지 않는다. 즉 local 이름이 `watch`이고 source가 `aeui`인 import specifier면 변환 대상이다. namespace member 호출이나 alias된 local 이름은 대상이 아니다. 로컬 함수/변수 binding은 같은 이름이어도 보호된다.

이 순회는 컴포넌트 path 아래의 모든 call expression을 보며 중첩 함수 소유 여부를 제한하지 않는다.

### 8.2 **수정 필요 — `AEUI-COMPILER-FIX-004`**: hook import alias의 imported 이름 미검증

#### 현재 잘못된 동작

현재 판별은 local callee 이름과 import source만 확인하고 `ImportSpecifier.imported`를 확인하지 않는다.

```js
import { clean as watch } from 'aeui';

watch(dispose, []);
// 현재 구현은 imported clean이 아니라 local 이름만 보고 runtime.watch로 바꿀 수 있다.
```

반대 방향의 정상 alias도 인식하지 못한다.

```js
import { watch as observe } from 'aeui';

observe(callback, [value]);
// 현재 구현은 callee local 이름이 watch가 아니므로 변환하지 않는다.
```

#### 목표 계약

hook 종류는 callee의 문자열 이름이 아니라 Babel binding으로 결정한다.

```text
callee가 identifier가 아니면 hook 아님
binding이 aeui ImportSpecifier이면:
  imported 이름이 watch -> runtime.watch
  imported 이름이 clean -> runtime.clean
  그 외 -> hook 아님
binding이 없고 callee가 bare watch/clean이면:
  현재의 unbound compatibility 경로에 따라 같은 이름의 runtime hook
그 밖의 local binding 또는 다른 module import이면 hook 아님
```

따라서 `import { watch as observe }`의 `observe(...)`는 watch로, `import { clean as dispose }`의 `dispose(...)`는 clean으로 변환한다. `import { clean as watch }`의 `watch(...)`는 **clean**으로 변환해야 하며 watch로 오인해서는 안 된다.

positive test는 direct import와 두 hook의 aliased import가 각각 올바른 `AEUI.__runtime.watch`/`clean` 호출을 생성하는지 검사해야 한다.

negative test는 다음을 포함한다.

- `import { clean as watch }`를 `runtime.watch`로 만들지 않는다.
- `import { somethingElse as watch } from 'aeui'`를 hook으로 만들지 않는다.
- 다른 package에서 import한 `watch`와 local `function watch()`를 바꾸지 않는다.
- namespace member와 임의 member call을 local identifier hook으로 오인하지 않는다.

### 8.3 **현재 구현**: `clean`

인자 개수와 타입을 검사하지 않고 callee만 바꾼다.

```js
clean(callback);
// -> AEUI.__runtime.clean(callback)
```

### 8.4 **현재 구현**: `watch`

다음 조건일 때만 변환한다.

- argument가 정확히 2개다.
- 첫 argument가 `ArrayExpression`이 아니다.

첫 argument가 array이면 deps-first 구문으로 간주하여 그대로 둔다. argument가 1개 또는 3개 이상이어도 그대로 둔다.

두 번째 argument가 inline arrow/function expression이면 그대로 사용한다. 그 밖의 AST이면 deep clone한 값을 반환하는 인자 없는 arrow로 감싼다.

```js
watch(callback, [count]);
// -> AEUI.__runtime.watch(callback, () => [count])

watch(callback, () => [count]);
// -> AEUI.__runtime.watch(callback, () => [count])
```

named getter identifier는 function-like AST가 아니므로 다음처럼 값 getter로 감싸진다.

```js
watch(callback, getDeps);
// -> AEUI.__runtime.watch(callback, () => getDeps)
```

런타임은 deps getter의 반환값이 배열이기를 요구하므로 위 코드는 `getDeps` 함수 객체를 반환해 런타임 타입 오류가 된다. 현재 컴파일러의 정확한 경계다.

### 8.5 **수정 필요 — `AEUI-COMPILER-FIX-003`**: named dependency getter 오변환

#### 현재 잘못된 동작

`watch(callback, getDeps)`에서 `getDeps`가 function declaration 또는 함수값 binding이어도, 현재 구현은 identifier AST라는 이유로 `() => getDeps`를 생성한다. watcher가 이 wrapper를 호출하면 dependency array가 아니라 함수 객체가 반환되므로 런타임 오류가 발생한다.

#### 목표 계약

두 번째 argument는 다음 순서로 분류한다.

1. inline arrow/function expression이면 기존처럼 getter 자체를 유지한다.
2. identifier의 local binding이 function declaration이거나 arrow/function expression으로 초기화된 immutable binding이면 named getter로 판정하고 identifier 자체를 유지한다.
3. array literal, local array/value binding, 그리고 그 밖의 명확한 dependency value expression은 `() => expression`으로 감싸 매 검사 시점에 값을 다시 읽는다.
4. import된 identifier, 재할당 가능한 binding, 동적 member처럼 getter인지 dependency value인지 안전하게 결정할 수 없는 입력은 추측하지 않는다. 사용자가 `() => getDeps()` 또는 `() => deps`로 의미를 명시하도록 compile diagnostic을 낸다.

```js
function getDeps() {
  return [count];
}

watch(callback, getDeps);
// 목표: AEUI.__runtime.watch(callback, getDeps)

watch(callback, deps);
// deps가 local array/value binding이면 목표: runtime.watch(callback, () => deps)
```

함수 getter를 `() => getDeps()`로 감싸는 구현도 관찰 가능한 dependency 결과는 같을 수 있지만, 목표 출력은 불필요한 wrapper 없이 원 getter binding을 유지하는 것으로 고정한다. getter의 identity를 향후 diagnostic과 debugging에 사용할 수 있기 때문이다.

positive test는 inline getter, local named function declaration, `const getDeps = () => [...]`, array literal, local dependency array binding을 모두 포함해야 한다. 각 runtime getter를 실제 호출했을 때 배열이 반환되어야 한다.

negative test는 named getter를 호출했을 때 함수 객체가 반환되는 `() => getDeps` 출력을 금지해야 한다. import/재할당/dynamic member처럼 모호한 입력은 일반 값으로 조용히 감싸지 말고 명시적인 diagnostic을 내며, 사용자가 inline getter로 고친 입력은 정상 컴파일되어야 한다.

구조 분해 props가 있으면 inline callback과 최종 deps getter 각각에 별도의 `_resolvedProps` 선언을 넣고 참조를 재작성한다.

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

`propsTarget`은 지원되는 첫 props 파라미터가 있었으면 `__props`, 없으면 `null`이다.

### 9.1 원 render 파라미터 보존

원 render 함수의 첫 파라미터만 저장하고, 함수 파라미터 목록 전체를 생성된 `_renderProps` 하나로 교체한다. 원 첫 파라미터에 따라 body 앞에 다음 binding을 삽입한다.

| 원 파라미터 | 생성 binding |
|---|---|
| identifier `p` | `const p = _renderProps` |
| object/array pattern | `const pattern = _renderProps` |
| 지원되는 assignment pattern | `const left = _renderProps === undefined ? right : _renderProps` |
| 없음 또는 그 밖의 패턴 | 생성 없음 |

원 render 함수의 두 번째 이후 파라미터는 보존되지 않는다. 원 함수가 expression body이면 block과 return으로 바꾼다. 구조 분해 component props용 `_resolvedProps` 선언은 위 render-param binding보다 먼저 삽입된다.

구조 분해 component props가 있는 경우 방금 삽입한 render-param binding도 참조 재작성 순회를 한 번 더 거친다. 따라서 render 파라미터의 default expression이 component의 구조 분해 binding을 참조하면 `_resolvedProps.<name>`으로 바뀐다.

#### **현재 구현**: `_newProps` 이름 접두사 guard

원 render 함수 첫 파라미터가 identifier이고 이름이 `_newProps`로 시작하면 wrapper 생성을 건너뛴다. 이는 생성된 wrapper를 다시 처리하지 않기 위한 현재의 guard이며, 사용자가 같은 접두사의 파라미터를 직접 사용해도 동일하게 건너뛴다.

### 9.2 **수정 필요 — `AEUI-COMPILER-FIX-005`**: 사용자 파라미터를 generated wrapper로 오인

#### 현재 잘못된 동작

다음 render 함수는 사용자가 직접 작성한 함수지만 이름 접두사만으로 이미 변환된 wrapper라고 오인된다.

```jsx
function Card() {
  return (_newPropsFromParent) => <p>{_newPropsFromParent.title}</p>;
}
```

그 결과 `AEUI.__runtime.runRenderPhase` wrapper가 생성되지 않아 component node의 최신 props 동기화와 render 직전 watcher 실행 경로가 빠진다.

#### 목표 계약

idempotence 판별은 사용자 identifier 문자열에 의존해서는 안 된다. analysis/rewrite pass 안에서 다음 중 하나 또는 조합을 사용한다.

- plugin instance가 보유한 `WeakSet`에 이미 변환한 AST node 기록
- plugin 전용 AST metadata 또는 비충돌 symbol
- callee, argument 수, props target, inner render 구조까지 확인하는 정확한 canonical wrapper 구조 검사

같은 AST에 플러그인을 다시 실행해도 wrapper는 한 번만 생성되어야 한다. 반대로 사용자가 `_newProps`, `_newProps2`, `_newPropsFromParent` 같은 이름을 선택했다는 사실은 skip 근거가 될 수 없다. AST가 serialize된 뒤 다시 컴파일되는 경로까지 지원한다면 pass-local metadata만으로 부족하므로 canonical wrapper 구조 검사도 필요하다.

positive test는 정상 render factory를 한 번 변환한 출력에 플러그인을 다시 적용해 `runRenderPhase` 호출이 중첩되지 않는지 검사해야 한다.

negative test는 위 세 접두사 이름을 사용한 **사용자 작성** render 파라미터가 모두 정상적으로 wrapper 안에 들어가고 최신 props와 watcher 순서를 거치는지 검사해야 한다. 사용자가 우연히 `runRenderPhase`라는 helper를 호출하는 것만으로 generated wrapper로 오인하지 않아야 한다.

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
  const __props = { ..._initialPropsValue };
  const _resolveProps = () => {
    const { title: label = 'Guest', ...rest } = __props;
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
    __props,
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

현재 component node가 없으면 props target을 동기화하지 않고 watcher도 실행하지 않으며 component context도 만들지 않는다. render가 함수일 때만 `nextProps || {}`를 넘겨 직접 호출하고, 아니면 `null`을 반환한다.

node가 있으면 `runComponentRenderPhase`가 다음 순서를 보장한다.

1. `node.props = nextProps || {}`
2. `propsTarget`이 객체이면 `for...in`으로 기존 key를 delete
3. `nextProps`가 truthy이면 `Object.assign(propsTarget, nextProps)`
4. `runComponentWatchers(state, node)` 실행
5. render가 함수가 아니면 `null`
6. 이미 같은 node의 render phase이면 `render(node.props)` 직접 호출
7. 아니면 `withComponentContext(state, node, 'render', ...)` 안에서 호출

이 순서 때문에 watcher deps와 callback, 실제 render가 모두 동기화된 props target을 본다.

## 12. 목표 구현에서도 보존할 경계

이 목록은 목표 구현에 남길 계약만 다룬다. `AEUI-COMPILER-FIX-001`부터 `AEUI-COMPILER-FIX-005`까지에서 설명한 현재의 잘못된 동작은 보존 대상이 아니다.

- import source 문자열은 `aeui`로 고정한다.
- component 판별에서 export 여부는 최종 조건이 아니다.
- return과 renderable 검사에서는 중첩 함수의 직접 return을 소유 함수 비교로 제외한다.
- hook call 순회에는 같은 소유 함수 제한이 없다.
- `clean`도 runtime helper로 변환된다.
- `watch`는 정확히 두 argument만 변환하고 첫 argument array를 거부한다.
- props는 첫 component 파라미터만 처리한다. 현재 정상 지원 범위는 identifier/object pattern과 그 assignment pattern이다.
- component ArrayPattern props의 현재 TypeError는 보존할 불변식이 아니다. ArrayPattern 지원은 향후 반드시 구현할 **계획 기능**이다.
- render 함수는 원 첫 파라미터만 재바인딩하고 나머지는 버린다.
- destructured props의 최신값 재작성은 render와 inline watch 함수에 한정된다.
- classic JSX transform의 pragma는 `AEUI.createElement`, fragment pragma는 `AEUI.Fragment`다.

## 13. **현재 구현** 테스트가 제공하는 참고 증거

`example/test/src/__tests__/babel-plugin.test.js`는 현재 구현의 다음 경로를 실행한다. 이 목록은 새 명세 기반 test suite가 완성되기 전의 참고 증거일 뿐 최종 적합성 계약이 아니다. 새 suite 작성은 별도의 **계획 기능**이다.

- JSX 파일의 import 자동 주입
- 기존 `aeui` import 확장
- helper/JSX가 없는 파일에서는 import 미주입
- renderable을 반환하지 않는 uppercase utility 미변환
- local `AEUI` runtime 충돌 compile error
- 익명 default export 컴포넌트 변환과 helper 오인 방지
- expression-body destructured props의 최신값 참조
- default parameter destructured props의 `__props` target 사용
- 수동 render destructuring parameter 지원
- `watch`/`clean` runtime helper 변환
- named callback을 유지한 callback-first watch
- array를 반환하는 callback과 deps getter 구분
- deps 누락 또는 options 추가 호출 미변환

현재 회귀 테스트에는 default import와 namespace import가 있는 상태에서 자동 import를 주입하는 경로가 없다. import 결함을 수정할 때는 다음을 새 계약 테스트로 추가해야 한다.

- default import의 default 의미를 유지하면서 named `AEUI` 병합
- namespace import를 그대로 유지하고 별도 named `AEUI` import 생성
- 생성된 출력의 Babel parse 성공과 실제 import specifier 종류 확인

component ArrayPattern의 현재 TypeError를 호환 계약으로 고정하는 테스트는 만들지 않는다. 입력 ABI가 확정되면 표준 VNode 경로의 성공 테스트를 필수로 추가한다.

Vite 통합에서의 parser와 JSX transform 목표 순서는 `08-vite-plugin-and-build.md`를 따른다.
