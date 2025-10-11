AEUI 스펙

```jsx
import { watch } from "aeui";

function App() {
  let count = 0;

  watch(() => {
    console.log("count 변화");
  }, [count]);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button
        onClick={() => {
          count++;
        }}
      >
        Click to increase
      </button>
    </div>
  );
}
```

# 구조

- 상태 선언, 사용시 일반 자바스크립트 코드를 사용한다. 원시값이 아닌경우에도 recursive 하게 상태 변화를 추적한다.
  - 원시 값: number, bigint, string, boolean
  - 그 외: Array, Map, Set, Object(key 값만 비교)
- state가 변경될 때 렌더하는게 아니라, `tick`마다 렌더한다.

## tick

- 1초마다 `tick`을 발생시킨다. 이때 렌더를 시도한다.
- `tick` 발생시 이미 렌더중인 경우 렌더하지 않는다.
- TODO
  - 항상 1초마다 발생시키는게 아니라 유동적으로 발생시킨다.
    - 직전에 값이 변화했을 경우 `tick` 발생 주기를 빠르게 한다.
    - 직전에 값 변화가 없을 경우 `tick` 발생 주기를 느리게 한다.

## 렌더

- React와 비슷한 Virtual DOM을 사용한다
- TODO
  - 렌더 과정을 별도의 Web Worker에서 진행한다
  - 렌더 트리를 쪼개서 여러개의 Web Worker에서 진행한다

## 컴포넌트

- `function` 혹은 `Arrow function`으로 JSX를 return 한다.
- React와는 다르게 내부 코드는 1번만 실행된다.
- 컴포넌트 내부에 `watch` 사용시 특정 코드를 여러번 실행시킬 수 있다. 아래 참조.

## watch

- `watch`는 유일한 hook으로, React의 `useEffect`와 비슷하게 작동해서 `watch`로 컴포넌트 내의 코드를 여러번 실행시킬 수 있다.
  - `useEffect`와 다른 점은 `useEffect`는 값이 변경될 때(렌더)마다 트리거되지만, `AEUI`에서는 렌더를 `tick`마다 실행하기 때문에 모든 값 변경마다 실행되지 않을 수 있다.

# 배포

SSR, Static Build 2개의 방법을 제공한다.

## SSR

- TODO
  - http(s), Web socket 서버 (다른 라이브러리 사용)
  - Hydration 사용하지 않음. SEO를 위해 HTML 파일을 제공하나, 실제 페이지 로드시 전부 지우고 새로 생성.
  - Next.js의 `<Link />` 같은 컴포넌트 제공

## Static Build

- TODO
  - GitHub Pages 친화적

# 기타

- TODO
  - 다른 프레임워크처럼 create 명령어 제공
  - babel, SWC 2개의 트랜스파일러 옵션 제공
    - 웹 환경을 위해 babel 옵션을 남겨두고, 실제 사용시 SWC로 속도를 빠르게
