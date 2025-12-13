# AEUI 프레임워크

AEUI는 복잡한 HTML을 쉽게 작성하고, 값이 변할 때 화면을 자동으로 업데이트 해주는 프레임워크입니다.

## 컴포넌트 (Components)

AEUI에서 컴포넌트는 HTML을 반환하는 함수입니다.

아래는 버튼을 누를 때마다 `count` 값이 증가하는 예제입니다.

```javascript
import { watch } from 'aeui';

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

function App() {
  return (
    <div>
      <Counter name="첫번째" />
      <Counter name="두번째" />
    </div>
  );
} 
```

AEUI는 대문자로 시작하는 함수를 컴포넌트로 인식합니다. 위의 코드에서 `Counter`와 `App`이 컴포넌트입니다. 컴포넌트는 함수로 동작하지 않고 특별한 동작을 합니다.

```html
name 값 전달하기
<Counter name="첫번째" />
```

```javascript
name 값 받기
function Counter({ name })
```

컴포넌트를 작성시 값을 전달할 수 있습니다. 값이 변하면 HTML에 반영됩니다.


- 컴포넌트 내부에서 `const`, `let`을 사용하여 값을 선언할 수 있습니다. 값이 변하면 HTML에 반영됩니다.
- 컴포넌트 내부에서 `watch`를 사용하여 값이 변할 때마다 특정 코드를 실행할 수 있습니다.



#### 컴포넌트를 처음 생성할 때 (Mount)
컴포넌트를 처음 생성할 때, 함수 본문이 **딱 한 번** 실행됩니다.

```javascript
  const id = crypto.randomUUID();
  let count = 0;
```

그리고 JSX 코드가 실행됩니다.

```javascript
  return (
    <div className="counter">
      <p>이름: {name}</p>
      <p>아이디: {id}</p>
      <p>현재 숫자: {count}</p>
      <button onClick={() => count++}>증가</button>
    </div>
  );
```

JSX 코드는 HTML로 변환됩니다.

```html
<div class="counter">
  <p>이름: 첫번째</p>
  <p>아이디: 1234567890</p>
  <p>현재 숫자: 0</p>
  <button>증가</button>
</div>
```

#### 값이 변경될 때 (Update)
값이 변경될 때마다 `return` 문으로 반환되는 JSX 코드가 다시 실행되어서 HTML이 다시 생성됩니다.

```javascript
  return (
    <div className="counter">
      <p>이름: {name}</p>
      <p>아이디: {id}</p>
      <p>현재 숫자: {count}</p>
      <button onClick={() => count++}>증가</button>
    </div>
  );
```

위 코드에서는 `name`, `id`, `count`가 변경될 때마다 HTML이 업데이트됩니다.

#### watch
`watch`에 등록한 값이 변경되면 `watch`에 등록한 코드가 실행됩니다.

```javascript
  watch(() => {
    console.log("숫자가 바뀜:", count);
  }, [count]);
```

`[count]`에서 배열 내부에 `count`가 있기 때문에 `count`가 변경되면 `watch`에 등록한 코드(`console.log("숫자가 바뀜:", count);`)가 실행됩니다.

#### 컴포넌트를 여러번 사용할 수 있습니다.

반복되는 코드를 컴포넌트로 만들어서 사용할 수 있습니다.

```javascript
function App() {
  return (
    <div>
      <Counter name="첫번째" />
      <Counter name="두번째" />
    </div>
  );
} 
```

---
> Svelte와 비슷하게 느껴지시나요?

Svelte를 잘 아시는 분은 AEUI를 JSX를 사용하는 Svelte처럼 느낄 수 있습니다. 하지만 AEUI는 값의 내부 수정(Mutation)까지 감지하여 더욱 편리한 반응성을 제공합니다.

```javascript
// Svelte 코드

let numbers = [1, 2, 3, 4];

function addNumber() {
  // Svelte에서는 numbers 업데이트를 감지하지 못함
  numbers.push(numbers.length + 1);

  // Svelte에서는 업데이트를 위해 numbers를 다시 할당해야 함
  numbers = numbers;

  // 혹은 Svelte에서는 아래와 같이 Spread를 사용하여 numbers를 다시 할당할 수 있음
  numbers = [...numbers, numbers.length + 1];
}

let person = {
  name: "첫번째",
  age: 20,
};

function changeName(name) {
  // Svelte에서는 person 업데이트를 감지하지 못함
  person.name = name;

  // Svelte에서는 업데이트를 위해 person을 다시 할당해야 함
  person = person;

  // 혹은 Svelte에서는 아래와 같이 Spread를 사용하여 person을 다시 할당할 수 있음
  person = { ...person, name };
}
```

```javascript
// AEUI 코드

let numbers = [1, 2, 3, 4];

function addNumber() {
  numbers.push(numbers.length + 1);
}

let person = {
  name: "첫번째",
  age: 20,
};

function changeName(name) {
  person.name = name;
}
```

> **더 깊은 내용이 궁금하신가요?**  
> 값 변경이 내부적으로 어떻게 연결되는지 궁금하다면 [아키텍처 심화 (Level 2)](./architecture-lv2.md) 문서를 참고하세요.
