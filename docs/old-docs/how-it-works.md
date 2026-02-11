AI를 통해 자동으로 만들어진 문서입니다.

# React 개발자를 위한 AEUI 가이드

이미 React에 익숙하신가요? 그렇다면 AEUI의 핵심 차이점만 빠르게 짚고 넘어가겠습니다. AEUI는 겉보기엔 React와 비슷해 보이지만, 내부 동작 방식은 **클로저(Closure)**와 **컴파일러(Babel)**에 크게 의존합니다.

## 1. AEUI 컴포넌트

React의 함수형 컴포넌트는 렌더링될 때마다 함수 전체가 다시 실행됩니다.

반면, **AEUI 컴포넌트는 Setup이 1회만 실행**됩니다.

```javascript
// AEUI Component
const Counter = () => {
  // [Setup 영역]
  // 컴포넌트가 마운트될 때 딱 "한 번만" 실행됩니다.
  // 'let' 변수가 그대로 상태(State)가 됩니다!
  let count = 0;

  // [Render 영역]
  // 매 렌더링마다 실행되어서 React처럼 코드를 작성할 수 있습니다.
  return (
    <button onClick={() => count++}>
      Count is {count}
    </button>
  );
};
```

> **핵심**: `useState`가 필요 없습니다. 그냥 `let`을 쓰세요.

## 2. `let`이 가능한 이유

"잠깐, `let`으로 선언하면 Props가 바뀔 때 업데이트가 안 되지 않나요?"

맞습니다. 일반적인 자바스크립트라면 그렇습니다. 하지만 AEUI는 **Babel 플러그인**을 통해 코드를 변환하여 이 문제를 해결합니다.

여러분이 작성한 코드가:
```javascript
const User = ({ name }) => {
  return <div>Hello, {name}</div>;
};
```

실제로는 이렇게 변환되어 실행됩니다:
```javascript
const User = (_props) => {
  // 1. 초기 Props를 지역 변수(let)로 선언
  let { name } = _props; 

  return (_newProps) => {
    // 2. 렌더링 시 새로운 Props가 들어오면, 지역 변수를 자동으로 업데이트!
    if (_newProps) {
      ({ name } = _newProps);
    }
    return <div>Hello, {name}</div>;
  };
};
```

클로저 덕분에 값은 유지되고, 함수를 사용하지 않고 상태를 사용할 수 있습니다.

## 3. `watch` vs `useEffect`

AEUI의 `watch`는 React의 `useEffect`와 비슷하지만, **Cleanup 함수를 반환하지 않습니다.**

**React:**
```javascript
useEffect(() => {
  const timer = setInterval(...)
  return () => clearInterval(timer); // Cleanup 반환
}, []);
```

**AEUI:**
```javascript
let timer;

watch(() => {
  timer = setInterval(...)
  // 여기서 return 해도 아무 일도 일어나지 않습니다.
}, []);

clean(() => clearInterval(timer)); // 별도의 clean 훅 사용
```

## 4. 렌더링 트리거 (The Tick)

React는 `setState`가 호출될 때 리렌더링을 예약합니다.
AEUI는 **명시적인 렌더링 요청이 없습니다.**

대신, 내부적으로 **틱마다(Tick)** 루프를 돌며 변경 사항을 체크합니다.
1. `watch` 의존성 배열을 확인하여 변경되었으면 콜백 실행
2. 전체 가상 DOM을 비교(Diff)하여 변경된 부분만 반영

이 "Lazy" 폴링 방식 덕분에, `count++` 처럼 변수를 직접 수정해도 다음 Tick에 자동으로 화면에 반영됩니다.
