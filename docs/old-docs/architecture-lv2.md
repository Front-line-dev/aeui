# AEUI 설명 Level 2

이전 문서에서 AEUI의 기본적인 사용 방법을 알아봤습니다.
이번에는 AEUI가 내부적으로 어떻게 동작하는지 알아보겠습니다.

핵심은 **코드 변환**과 **가상 돔(Virtual DOM)**입니다.

## 1. 코드 변환

AEUI 코드는 브라우저가 이해할 수 있는 자바스크립트가 아닙니다. 트랜스컴파일러를 사용하여 AEUI 코드를 자바스크립트로 변환합니다.

**AEUI 코드**
```javascript
function Counter({ name }) {
  const id = crypto.randomUUID();
  let count = 0;

  watch(() => {
    console.log("숫자가 바뀜:", count);
  }, [count]);

  return (
    <div className="counter">
      <p>이름: {name}</p>
      <p>아이디: {id}</p>
      <p>현재 숫자: {count}</p>
      <button onClick={() => count++}>증가</button>
    </div>
  );
}
```

**변환된 코드**
```javascript
function Counter(_initialProps) {
  // 1회만 실행되는 부분 (초기화)
  const __props = { ..._initialProps }; // 반응형 Props 객체 생성
  let { name } = _initialProps; // 초기 로직을 위한 구조 분해

  const id = crypto.randomUUID();
  let count = 0;

  watch(() => {
    console.log("숫자가 바뀜:", count);
  }, () => [count]); // 의존성 배열이 함수로 변환됨

  return (_newProps) => {
    // 반복 실행되는 부분 (렌더링)

    // 1. Props 업데이트 및 Watcher 실행
    AEUI.updateProps(__props, _newProps);
    AEUI._runComponentWatchers(AEUI._currentInstance);

    // 2. 렌더링 (구조 분해된 변수는 __props로 대체됨)
    return AEUI.createVNode("div", { className: "counter" },
      AEUI.createVNode("p", null, "이름: ", __props.name), // name -> __props.name
      AEUI.createVNode("p", null, "아이디: ", id),
      AEUI.createVNode("p", null, "현재 숫자: ", count),
      AEUI.createVNode("button", { onClick: () => count++ }, "증가")
    );
  };
}
```

이렇게 변환되기 때문에 `let count = 0`이 다시 실행되어 0으로 초기화되지 않고, 값이 계속 유지되는 것입니다.



## 2. 가상 돔 (Virtual DOM)

`return` 문에서 HTML을 반환하는 것처럼 보이지만, 사실은 자바스크립트 객체를 반환합니다. 이것을 **가상 돔(Virtual DOM)**이라고 부릅니다.

### 가짜 객체 만들기

```javascript
/* JSX 코드 */
<div className="box">안녕</div>
```

```javascript
/* 트랜스파일러가 변환한 코드 */
AEUI.createVNode("div", { className: "box" }, "안녕");
```

```javascript
/* 실제 만들어지는 객체 (VNode) */
{
  tag: "div",
  props: { className: "box" },
  children: ["안녕"]
}
```

이 객체는 진짜 HTML 태그보다 훨씬 가볍습니다.

### 변경된 부분만 찾기 (Diffing)

값이 바뀌어서 화면을 다시 그려야 할 때, AEUI는 가상 돔을 활용합니다.

1.  값이 업데이트 된 **새로운 가상 돔**을 만듭니다.
2.  **이전 가상 돔**과 비교합니다.
3.  **달라진 부분**만 찾아서 진짜 화면(DOM)을 고칩니다.
4.  **이전 가상 돔**을 **새로운 가상 돔**으로 교체합니다.

```
이전: <p>사과</p>
이후: <p>포도</p>
```

AEUI는 "아, `p` 태그는 그대로고 글자만 '사과'에서 '포도'로 바뀌었네?" 라고 판단하고 글자만 변경합니다.

---

> **더 깊은 내용이 궁금하신가요?**
> 직접 프레임워크를 수정하거나 기여하고 싶다면 [내부 구현 (Level 3)](../guide/level-3.md) 문서를 참고하세요.
