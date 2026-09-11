# TypeScript JSX 설정하기

TypeScript는 선언한 타입과 코드에서 사용하는 값이 맞는지 검사합니다. AEUI 컴포넌트의 props에 타입을 선언하면, 필수 prop을 빠뜨리거나 다른 타입의 값을 전달한 곳을 실행 전에 찾을 수 있습니다.

Vite는 `.ts`·`.tsx`를 실행할 JavaScript로 변환하고, TypeScript는 타입을 검사합니다. 아래에서는 AEUI Vite 앱에 타입 검사를 추가하고 실제 오류를 확인합니다.

## 검사할 컴포넌트 작성

`src/Greeting.tsx`에 문자열 `name`을 받는 컴포넌트를 작성합니다.

```tsx
export default function Greeting({ name }: { name: string }) {
  return <h1>안녕하세요, {name}</h1>;
}
```

`src/App.tsx`에서 이 컴포넌트를 사용합니다.

```tsx
import Greeting from './Greeting';

export default function App() {
  return <Greeting name="AEUI" />;
}
```

`name="AEUI"`는 선언한 문자열 타입에 맞습니다. `name={42}`로 바꾸거나 `name`을 생략한 경우에는 타입 검사에서 오류가 나야 합니다.

## JSX를 검사하도록 설정

[AEUI Vite 설정](../user-scenario/07-project-config.md)을 마친 앱 디렉터리에서 TypeScript를 설치합니다.

```sh
npm install --save-dev typescript
```

TypeScript가 JSX의 요소와 props 타입을 검사하려면 어떤 패키지의 JSX 타입을 사용할지 알아야 합니다. `jsxImportSource`를 `aeui`로 지정하고, JavaScript 출력은 Vite가 담당하도록 `noEmit`을 설정합니다.

프로젝트 루트에 `tsconfig.json`을 만듭니다. 파일이 있다면 필요한 옵션을 합칩니다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "aeui",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

| 옵션 | 역할 |
|---|---|
| `jsx: 'react-jsx'` | TypeScript의 automatic JSX 모드를 선택합니다. |
| `jsxImportSource: 'aeui'` | JSX 요소와 props의 타입을 AEUI 패키지에서 찾습니다. |
| `noEmit: true` | JavaScript 파일을 출력하지 않고 타입만 검사합니다. |
| `strict: true` | 타입이 불명확하거나 허용되지 않는 값 사용을 엄격하게 검사합니다. |
| `moduleResolution: 'Bundler'` | Vite처럼 번들러로 처리할 import 경로를 해석합니다. |

`react-jsx`는 TypeScript 옵션의 이름입니다. 이 설정에서는 AEUI가 JSX 타입을 제공하므로 React를 설치할 필요는 없습니다. `@` 별칭을 사용한다면 [경로 별칭 설정](../user-scenario/07-project-config.md#경로-별칭-)도 합칩니다.

## 정상 코드와 오류 확인

타입 검사를 실행합니다.

```sh
npx tsc --noEmit
```

앞의 코드는 오류 없이 종료됩니다. `src/App.tsx`의 한 줄을 바꾸어 검사 결과를 확인합니다.

| 작성한 JSX | 예상 결과 |
|---|---|
| `<Greeting name="AEUI" />` | 통과 |
| `<Greeting name={42} />` | `name`에 문자열이 필요한데 숫자를 전달했다는 오류 |
| `<Greeting />` | 필수 prop `name`이 없다는 오류 |

잘못된 값을 수정한 뒤 같은 명령으로 다시 검사합니다. 이 검사는 화면을 실행하지 않고도 호출하는 쪽의 props 사용을 확인합니다.

## 앱에서 TSX 사용

라우터를 사용하는 앱에서는 페이지 파일을 `.tsx`로 작성할 수 있습니다. 같은 URL을 나타내는 `.jsx`와 `.tsx` 파일을 동시에 두지 않습니다. 라우터 없이 위 `src/App.tsx`를 시작 화면으로 쓴다면 `aeui({ appEntry: 'src/App.tsx' })`로 진입점을 지정합니다.

Vite의 `aeui()`는 타입 제거와 함께 AEUI 컴포넌트 변환을 수행합니다. `tsc`의 JSX 설정만으로 setup/render 분리와 반응성 처리를 대신할 수는 없습니다. 타입 검사와 `npm run build`를 각각 실행해 타입 오류와 앱 빌드 오류를 확인합니다.

TypeScript는 표준 JSX 문법을 검사하므로, 여러 요소를 반환하는 `.tsx` 코드에는 명시적 `<>...</>`를 사용할 수 있습니다. AEUI의 인접 JSX 자동 Fragment 처리 범위는 [JSX 문서](../user-scenario/04-jsx-and-rendering.md#fragment-자동-처리)에 설명합니다.

## 관련 문서

- 생성 함수와 import: [JSX runtime](jsx-runtime.md)
- Vite 외의 변환 연결: [Babel과 SWC 직접 설정하기](compiler-setup.md)
- [튜토리얼 목록](README.md)
