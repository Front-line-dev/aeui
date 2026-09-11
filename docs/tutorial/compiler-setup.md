# Babel과 SWC 직접 설정하기

AEUI 컴포넌트 변환은 함수 본문을 한 번 실행하는 setup과 화면을 갱신할 때 실행하는 render로 나눕니다. 여기에 JSX 변환을 적용하면 브라우저에서 사용할 JavaScript를 얻습니다.

Vite 앱에서는 `plugins: [aeui()]`가 필요한 변환을 처리합니다. 다른 빌드 도구나 Node.js 스크립트에서 컴포넌트 소스를 변환하려면 아래의 Babel 또는 SWC 설정을 사용합니다.

## 컴포넌트 변환과 JSX 변환

다음 카운터로 두 변환의 역할을 확인할 수 있습니다.

```jsx
// src/App.jsx
export default function App() {
  let count = 0;
  return <button onClick={() => count++}>클릭: {count}</button>;
}
```

1. **컴포넌트 변환**은 `count`를 setup에 보관하고, 현재 `count`를 읽는 render 함수를 준비합니다. props 갱신과 hook 호출도 AEUI runtime이 처리할 수 있는 코드로 바꿉니다.
2. **JSX 변환**은 `<button>`을 JSX runtime의 함수 호출로 바꿉니다. 이 호출은 현재 `count`를 포함한 VNode를 만듭니다.

컴포넌트 변환을 먼저 적용해야 JSX가 있는 함수에서 setup/render를 준비할 수 있습니다. JSX runtime과 import 옵션의 의미는 [JSX runtime 이해하기](jsx-runtime.md)에서 설명합니다.

### 변환된 코드

아래는 이 문서의 Babel 설정으로 변환한 결과입니다. 한글은 읽기 쉽게 표시했습니다.

```js
import { AEUI } from "aeui";
import { jsxs as _jsxs } from "aeui/jsx-runtime";
AEUI.__runtime.registerComponent(App, function () {
  let count = 0;
  return _newProps2 => AEUI.__runtime.runRenderPhase(_newProps2, null, _renderProps2 => {
    return _jsxs("button", {
      onClick: (_component => AEUI.__runtime.registerComponent(_component, () => {
        return _newProps => AEUI.__runtime.runRenderPhase(_newProps, null, _renderProps => {
          return count++;
        });
      }))(() => count++),
      children: ["클릭: ", count]
    });
  });
});
// src/App.jsx
export default function App() {
  let count = 0;
  return _jsxs("button", {
    onClick: (_component => AEUI.__runtime.registerComponent(_component, () => {
      return _newProps => AEUI.__runtime.runRenderPhase(_newProps, null, _renderProps => {
        return count++;
      });
    }))(() => count++),
    children: ["클릭: ", count]
  });
}
```

`registerComponent(App, function () { ... })`의 두 번째 함수가 컴포넌트용 setup입니다. 여기서 `count`를 한 번 만들고, 반환한 함수가 화면 갱신 때 현재 `count`로 `_jsxs`를 호출합니다. `_jsxs`는 `<button>` JSX를 대신해 VNode를 만듭니다.

아래쪽의 `App` 함수는 일반 함수 호출용으로 남습니다. `onClick`처럼 props에 전달한 함수에도 등록 코드가 붙지만, 이벤트 발생 시에는 원래의 `() => count++`가 호출됩니다. 함수 값을 준비하는 범위는 [자동 준비 범위](#컴포넌트-자동-준비-범위)에 설명합니다. SWC는 같은 동작을 하는 코드를 생성하며, 생성되는 변수명과 코드 모양은 다를 수 있습니다.

## 사용할 변환기 선택

| 빌드 구성 | 적용 방법 |
|---|---|
| Vite 앱 | `aeui/vite` 사용. 아래 스크립트를 추가할 필요는 없습니다. |
| Babel을 사용하는 빌드 | AEUI Babel 플러그인 뒤에 JSX 플러그인 적용 |
| Node.js에서 SWC로 변환 | `aeui/swc` 호출. 컴포넌트와 JSX를 함께 변환 |

한 파일의 컴포넌트 변환에는 Babel 또는 SWC 중 하나를 사용합니다. 두 경로는 setup 1회 실행, 최신 props, watch·clean과 컴포넌트 상태 보존의 동작을 따릅니다.

아래 예시는 Node.js와 AEUI 패키지가 설치되어 있고, 앞의 카운터를 `src/App.jsx`에 저장한 프로젝트에서 실행합니다. 패키지 설치는 [설치 안내](../user-scenario/01-getting-started.md)와 [npm alias 설정](../user-scenario/07-project-config.md#npm-패키지-이름)을 따릅니다.

## Babel 직접 설정 (Vite 없이)

Babel을 실행할 도구를 개발 의존성에 설치합니다.

```sh
npm install --save-dev @babel/core@^7 @babel/plugin-transform-react-jsx@^7
```

프로젝트 루트의 `babel.config.mjs`에 두 변환을 등록합니다.

```js
// babel.config.mjs
import aeuiTransform from 'aeui/babel-plugin';
import jsxTransform from '@babel/plugin-transform-react-jsx';

export default {
  plugins: [
    aeuiTransform,
    [jsxTransform, {
      runtime: 'automatic',
      importSource: 'aeui',
    }],
  ],
};
```

AEUI 플러그인이 먼저, JSX 변환 플러그인이 뒤에 와야 합니다. `runtime`은 자동 import 방식을 선택하고, `importSource`는 생성한 코드가 AEUI의 JSX 함수를 사용하게 합니다.

설정을 적용할 `compile-babel.mjs`를 프로젝트 루트에 만듭니다.

```js
import { transformFileAsync } from '@babel/core';

const result = await transformFileAsync('src/App.jsx', {
  configFile: './babel.config.mjs',
  sourceMaps: true,
});

console.log(result.code);
```

```sh
node compile-babel.mjs
```

터미널에 출력되는 코드는 JSX 대신 JavaScript 함수 호출을 사용합니다. `aeui/jsx-runtime` import와 카운터의 setup/render 준비 코드가 포함됩니다. `result.map`은 원본 위치를 추적할 source map 객체입니다. `.mjs` 설정 파일은 위처럼 비동기 Babel API로 읽습니다.

### classic JSX 설정

JSX를 `AEUI.createElement(...)` 호출로 변환하려면 JSX 플러그인 옵션을 다음으로 바꿉니다.

```js
[jsxTransform, {
  runtime: 'classic',
  pragma: 'AEUI.createElement',
  pragmaFrag: 'AEUI.Fragment',
}]
```

`pragma`는 JSX 생성 함수, `pragmaFrag`는 Fragment에 사용할 값을 지정합니다. JSX를 작성하는 파일에서 `import { AEUI } from 'aeui'`로 호출 대상을 준비합니다. classic 설정에는 `importSource`를 넣지 않습니다.

### 개발용 JSX 설정

개발용 위치 정보를 포함하려면 `@babel/plugin-transform-react-jsx-development@^7`을 개발 의존성에 설치하고 JSX 플러그인으로 사용합니다. `runtime: 'automatic'`, `importSource: 'aeui'`를 함께 지정하면 `aeui/jsx-dev-runtime`의 `jsxDEV` 호출을 생성합니다.

## SWC로 변환하기

`aeui/swc`는 컴포넌트 변환과 JSX 변환을 함께 수행합니다. SWC 의존성은 AEUI 패키지에 포함되어 있습니다.

프로젝트 루트에 `compile-swc.mjs`를 만듭니다.

```js
import { readFileSync } from 'node:fs';
import transform from 'aeui/swc';

const filename = 'src/App.jsx';
const source = readFileSync(filename, 'utf8');
const result = transform(source, {
  filename,
  development: false,
  sourceMaps: true,
});

console.log(result.code);
```

```sh
node compile-swc.mjs
```

Babel 예제처럼 컴포넌트와 JSX를 변환한 JavaScript가 출력됩니다. `result.code`에 이 코드가, `result.map`에 JSON 문자열 형태의 source map이 들어 있습니다.

| 옵션 | 기본값 | 선택 기준 |
|---|---|---|
| `filename` | `'module.jsx'` | 실제 파일명을 전달합니다. `.ts`·`.tsx`이면 해당 구문을 처리하고 원본 위치를 기록합니다. |
| `development` | `false` | 개발용 JSX 호출을 생성할 때 `true`로 지정합니다. |
| `sourceMaps` | `true` | 오류나 디버깅 위치를 원본 소스와 연결할 때 사용합니다. |

## 컴포넌트 자동 준비 범위

AEUI Babel/SWC 변환기가 처리하는 함수 선언·함수 표현식·화살표 함수가 대상입니다. 컴파일러는 원래 함수의 일반 호출을 유지하고 컴포넌트 전용 setup을 별도로 준비합니다.

- JSX 또는 AEUI VNode 생성 표현식을 반환하는 함수는 이름·export 여부와 관계없이 준비합니다. 함수를 반환하는 팩토리의 내부 함수도 포함합니다.
- 같은 파일의 JSX 태그·AEUI 생성/초기화 호출·JSX props에서 함수 정의까지 추적되는 값도 준비합니다. 별칭, 재할당, 조건식과 단순 객체 속성을 추적합니다.
- export된 함수의 `null`, 문자열·숫자 등의 리터럴, props 및 children 참조 반환도 준비합니다. JSX가 없는 파일도 변환기의 처리 대상입니다.
- import·re-export는 정의 파일에서 준비된 함수 값을 그대로 전달합니다. 사용하는 파일에서 외부 함수의 소스를 추측하거나 실행하지 않습니다.
- render 함수를 직접 반환하는 setup 함수도 사용할 수 있습니다. 준비되지 않은 함수가 VNode 등을 바로 반환하면 컴파일이 필요하다는 오류를 기록합니다. async/generator 컴포넌트는 지원하지 않습니다.

함수나 getter의 실행 결과를 빌드 중 알아내는 전역 분석은 수행하지 않습니다. JSX가 없고 위 사용 근거도 없는 외부 함수, `bind`·Proxy 등으로 새로 만든 함수, 객체/class 메서드는 자동 준비 범위 밖입니다. 해당 함수는 미리 AEUI로 빌드하거나 수동 setup/render 계약을 만족해야 합니다. 앱 시작은 모듈 평가가 끝난 뒤 수행해야 합니다. 순환 import 평가 중 등록 전에 마운트하는 경우는 [알려진 결함](../issue/known-defects.md)에서 추적합니다.

## 변환 결과로 앱 빌드하기

위 스크립트는 한 파일의 변환 결과를 출력합니다. 앱 빌드에서는 사용하는 번들러에 `result.code`와 source map을 전달하고, 컴포넌트를 정의한 각 파일에 같은 변환을 적용합니다. 번들러는 결과에 남은 `aeui`와 파일 import를 처리하고 HTML에서 실행할 파일을 만듭니다.

빌드한 앱을 실행한 뒤에는 카운터가 `클릭: 0`으로 표시되고, 버튼을 누를 때마다 숫자가 증가하는지 확인합니다. 소스 파일을 수정하면 빌드 도구가 다시 변환하고, 버튼 클릭에 따른 상태 갱신은 브라우저의 AEUI runtime이 처리합니다.

## 관련 문서

- Vite가 빌드 과정을 처리하도록 설정: [프로젝트 설정](../user-scenario/07-project-config.md)
- TSX 타입 검사: [TypeScript JSX 설정하기](typescript-jsx.md)
- 변환 로직: [내부 구현 — Babel 컴파일러](../internal-implement/10-babel-compiler.md), [내부 구현 — SWC 컴파일러](../internal-implement/20-swc-compiler.md)
- [튜토리얼 목록](README.md)
