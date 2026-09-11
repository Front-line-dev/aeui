# JSX runtime 이해하기

JSX runtime은 JSX를 변환한 JavaScript가 UI 요소를 만들 때 사용하는 함수 모음입니다. 이 함수들은 화면 구조를 표현하는 VNode를 만들고, AEUI는 그 정보를 바탕으로 화면을 표시합니다.

## JSX가 실행되는 과정

다음 JSX는 제목 요소 하나를 표현합니다.

```jsx
const element = <h1>안녕하세요</h1>;
```

브라우저가 실행할 수 있도록 컴파일러가 이 문법을 JavaScript 함수 호출로 바꿉니다. AEUI의 automatic JSX 설정에서는 다음과 같은 코드가 됩니다.

```js
import { jsx as _jsx } from 'aeui/jsx-runtime';

const element = _jsx('h1', { children: '안녕하세요' });
```

여기서 `_jsx`는 AEUI가 제공하는 `jsx` 함수의 import 이름입니다. 호출하면 제목과 자식 텍스트를 담은 VNode가 만들어집니다. 컴포넌트가 반환한 VNode를 AEUI가 받아 DOM에 반영합니다.

처리 순서는 **JSX 작성 → 컴파일러가 함수 호출로 변환 → 실행 중 JSX runtime이 VNode 생성 → AEUI가 화면에 반영**입니다. 소스 코드를 바꿀 때는 다시 컴파일하지만, 버튼 클릭으로 상태가 바뀔 때는 이미 변환된 render 함수를 실행합니다.

## automatic과 classic의 차이

JSX를 함수 호출로 바꾸는 방식에는 automatic과 classic이 있습니다. 같은 제목을 classic 방식으로 변환하면 다음과 같은 코드가 됩니다.

```js
import { AEUI } from 'aeui';

const element = AEUI.createElement('h1', null, '안녕하세요');
```

이 경우 호출할 `AEUI`를 소스에서 import합니다. automatic 방식은 앞의 예시처럼 변환기가 필요한 함수의 import를 추가합니다.

| 방식 | 호출 형태 | import를 준비하는 곳 |
|---|---|---|
| automatic | `_jsx('h1', { children: '안녕하세요' })` | JSX 변환기 |
| classic | `AEUI.createElement('h1', null, '안녕하세요')` | 소스 코드 |

두 방식 모두 AEUI의 VNode를 생성합니다. AEUI Vite 플러그인은 automatic 방식을 사용합니다.

## runtime과 importSource가 필요한 이유

범용 JSX 변환기는 어떤 호출 방식을 사용할지와 어떤 패키지의 함수를 호출할지 알아야 합니다. Babel에서는 이 두 가지를 다음 옵션으로 정합니다.

```js
const jsxOptions = {
  runtime: 'automatic',
  importSource: 'aeui',
};
```

`runtime: 'automatic'`은 JSX를 함수 호출로 바꾸고 import를 자동으로 추가하도록 지정합니다. `importSource: 'aeui'`는 그 함수를 AEUI 패키지에서 가져오도록 지정합니다. 이 설정이 앞의 `aeui/jsx-runtime` import를 만듭니다.

두 옵션은 각각 필요합니다. `runtime`만 지정하면 JSX 변환기는 사용할 패키지가 AEUI인지 알 수 없습니다. `importSource`만 지정하면 automatic 방식이 선택되지 않습니다. 예를 들어 Babel 7의 기본 방식은 classic이므로, `importSource`만 지정하면 옵션 조합 오류가 납니다.

classic 방식에서는 `pragma`로 호출할 함수를, `pragmaFrag`로 `<>...</>`에 사용할 Fragment를 지정합니다. 실제 설정은 [컴파일러 설정 가이드](compiler-setup.md#classic-jsx-설정)에 있습니다.

## AEUI 프로젝트에서 설정하기

Vite 앱에서는 플러그인 하나로 컴포넌트와 JSX 변환을 설정합니다.

```js
// vite.config.js
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()],
});
```

이 설정에서 JSX를 쓰기 위해 `AEUI`나 `jsx`를 직접 import할 필요는 없습니다. 코드에서 직접 호출하는 `AEUI.init`, `watch`, `clean` 등의 API는 import합니다. Babel을 직접 구성할 때는 앞의 두 옵션을 지정하고, 전체 절차는 [Babel과 SWC 직접 설정하기](compiler-setup.md)를 따릅니다.

AEUI 컴포넌트에는 JSX 변환과 함께 setup/render 분리와 props·hook 처리를 위한 컴포넌트 변환도 필요합니다. `aeui()`는 두 변환을 모두 적용합니다. JSX 변환 도구만 연결하는 경우에는 [컴포넌트 변환 순서](compiler-setup.md#컴포넌트-변환과-jsx-변환)를 확인하세요.

## 관련 문서

- 타입 검사 설정: [TypeScript JSX 설정하기](typescript-jsx.md)
- 자식·key·개발용 runtime의 동작: [내부 구현 — JSX runtime 연결](../internal-implement/02-vdom.md#automatic-jsx-runtime-연결)
- Babel 옵션 정의: [JSX 변환 플러그인](https://babeljs.io/docs/babel-plugin-transform-react-jsx#options)
- [튜토리얼 목록](README.md)
