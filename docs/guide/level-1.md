# Level 1 — AEUI 기본 사용법

> 이 문서는 AEUI를 처음 사용하는 개발자를 위한 가이드이다. 프레임워크의 내부 구현이 아닌 **"어떻게 사용하는가"**에 초점을 맞춘다.

---

## 시작하기

### 프로젝트 생성

AEUI 템플릿은 Vite 8을 사용하므로 Node.js `^20.19.0 || >=22.12.0` 환경에서 실행한다.

```bash
npx create-aeui-app my-app
cd my-app
npm install
npm run dev
```

### 수동 설정 (이미 있는 Vite 프로젝트에 추가)

```bash
npm install aeui@npm:a-easy-ui
```

패키지는 npm에 `a-easy-ui` 이름으로 배포되지만, 앱 안에서는 `aeui` alias로 설치한다. 그래서 import 경로는 계속 `aeui`를 사용한다.

`vite.config.js`에서 AEUI Vite 플러그인을 설정:

```javascript
import { defineConfig } from 'vite';
import aeui from 'aeui/vite';

export default defineConfig({
  plugins: [aeui()]
});
```

`aeui/vite`는 JSX 변환에 필요한 `AEUI` import를 자동으로 주입한다. 컴포넌트 파일에서 JSX를 쓰기 위해 `import { AEUI } from 'aeui'`를 직접 작성할 필요는 없다. 또한 기본으로 `@` alias가 `src` 디렉터리를 가리키므로, 앱 내부 모듈은 `@/components/Button.jsx`처럼 가져올 수 있다.

### 앱 진입점과 core 라우터

`aeui/vite` 플러그인은 앱 진입점을 자동으로 주입한다. `index.html`에는 `#root`만 두면 된다.

```html
<div id="root"></div>
```

`create-aeui-app`이 만드는 기본 앱은 AEUI core 디렉터리 라우터를 사용한다. `src/pages/index.jsx`가 `/`, `src/pages/about.jsx`가 `/about`처럼 파일 경로가 URL이 되며 별도의 router package나 main entry를 만들지 않는다. 자세한 페이지 규칙은 [디렉터리 라우터 가이드](router.md)를 따른다.

`src/pages` 아래에 route 파일이 하나도 없는 앱에서는 `aeui/vite`가 `src/App.jsx`를 단일 루트 컴포넌트로 사용하는 fallback을 제공한다.

직접 초기화해야 하는 특수한 앱에서는 아래처럼 `AEUI.init`을 사용할 수 있다.

```javascript
import { AEUI } from 'aeui';
import App from './App.jsx';

AEUI.init(App, document.getElementById('root'));
```

`AEUI.init`은 `App` 컴포넌트를 `#root` 요소에 렌더링하고, `requestAnimationFrame` 기반 루프를 시작해 자동으로 화면을 업데이트한다. DOM 이벤트(`onClick`, `onInput` 등) 안에서 발생한 상태 변경은 다음 프레임에 즉시 반영되고, 그 외 비동기 변경은 polling fallback이 계속 감시한다.

---

## 컴포넌트

AEUI 컴포넌트는 **JSX를 반환하는 함수**이다. 이름은 반드시 **PascalCase**(대문자로 시작)여야 한다.

```jsx
function HelloWorld() {
  return <h1>Hello, AEUI!</h1>;
}
```

### 컴포넌트 사용

```jsx
function App() {
  return (
    <div>
      <HelloWorld />
      <HelloWorld />
    </div>
  );
}
```

컴포넌트를 HTML 태그처럼 `<HelloWorld />`으로 사용한다. 같은 컴포넌트를 여러 번 사용할 수 있으며, 각각 독립적인 상태를 가진다.

---

## 상태 (State) — `let`

AEUI에서 상태는 단순한 `let` 변수이다. 변수를 수정하면 화면이 자동으로 업데이트된다.

- DOM 이벤트 핸들러 안의 변경: 다음 프레임에 즉시 반영
- `setTimeout`, `Promise`, 외부 콜백 안의 변경: polling fallback으로 감지
- 변화가 없으면 polling 간격은 점진적으로 늘어난다

```jsx
function Counter() {
  let count = 0;

  return (
    <div>
      <p>카운트: {count}</p>
      <button onClick={() => count++}>증가</button>
      <button onClick={() => count--}>감소</button>
    </div>
  );
}
```

React와 비교:

```jsx
// React — useState 필요
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

// AEUI — let 변수만으로 충분
function Counter() {
  let count = 0;
  return <button onClick={() => count++}>{count}</button>;
}
```

### 여러 상태 변수

```jsx
function Form() {
  let name = "";
  let age = 0;
  let submitted = false;

  return (
    <form>
      <input value={name} onInput={(e) => name = e.target.value} />
      <input type="number" value={age} onInput={(e) => age = Number(e.target.value)} />
      <button onClick={() => submitted = true}>제출</button>
      {submitted && <p>{name}님, {age}세</p>}
    </form>
  );
}
```

### 객체/배열 상태

객체와 배열도 직접 수정할 수 있다.

```jsx
function TodoList() {
  let items = ["할 일 1", "할 일 2"];

  return (
    <div>
      <button onClick={() => items.push("새 할 일")}>추가</button>
      <ul>
        {items.map(item => <li>{item}</li>)}
      </ul>
    </div>
  );
}
```

React에서는 `setItems([...items, "새 할 일"])`처럼 새 배열을 만들어야 하지만, AEUI에서는 `items.push()`로 직접 수정해도 된다.

---

## Props — 컴포넌트 간 데이터 전달

부모 컴포넌트가 자식 컴포넌트에 데이터를 전달할 때 props를 사용한다.

### 전달

```jsx
function App() {
  let userName = "홍길동";
  return <Greeting name={userName} />;
}
```

### 받기 — 전체 props 객체

```jsx
function Greeting(props) {
  return <p>안녕하세요, {props.name}!</p>;
}
```

### 받기 — 구조 분해 (Destructuring)

```jsx
function Greeting({ name }) {
  return <p>안녕하세요, {name}!</p>;
}
```

### Props 변경 감지

부모가 전달하는 props가 변경되면, AEUI가 자동으로 자식 컴포넌트에 새 값을 전달한다. Babel 플러그인이 내부적으로 `__props` 객체를 관리하여, 자식은 별도의 코드 없이도 최신 props를 렌더링한다.

```jsx
function App() {
  let color = "red";

  return (
    <div>
      <ColorBox color={color} />
      <button onClick={() => color = "blue"}>파란색으로</button>
    </div>
  );
}

function ColorBox({ color }) {
  return <div style={{ backgroundColor: color, width: '100px', height: '100px' }} />;
}
```

버튼을 클릭하면 `color`가 변경되고, 다음 프레임에서 `ColorBox`가 새로운 `color` 값으로 렌더링된다.

---

## watch — 상태 변경 감시

특정 값이 변경될 때 실행할 코드를 등록한다.

```jsx
function SearchBox() {
  let query = "";
  let results = [];

  watch(() => {
    // query가 변경될 때마다 실행
    results = performSearch(query);
  }, [query]);

  return (
    <div>
      <input value={query} onInput={(e) => query = e.target.value} />
      <ul>
        {results.map(r => <li>{r}</li>)}
      </ul>
    </div>
  );
}
```

### 사용법

```javascript
watch(callback, deps)
```

- `callback`: 의존성이 변경되었을 때 실행할 함수
- `deps`: 감시할 값들의 배열 또는 배열을 반환하는 함수

`deps`는 필수다. `watch([deps], callback)`, `watch(callback)`, `watch(callback, deps, options)` 형태는 지원하지 않는다.

### 여러 의존성

```jsx
watch(() => {
  console.log("이름 또는 나이가 변경됨");
}, [name, age]);
```

배열 내 **하나라도** 변경되면 callback이 실행된다.

### 주의: setup에서만 호출

`watch`는 컴포넌트 함수의 최상위에서만 호출해야 한다. 이벤트 핸들러 안에서는 사용할 수 없다.

---

## clean — 정리 함수 등록

컴포넌트가 화면에서 제거될 때 실행할 정리 코드를 등록한다.

```jsx
function Timer() {
  let seconds = 0;

  const timerId = setInterval(() => {
    seconds++;
  }, 1000);

  clean(() => clearInterval(timerId));

  return <p>경과 시간: {seconds}초</p>;
}
```

`clean`은 `setInterval`, `addEventListener`, `WebSocket` 등 외부 리소스를 정리할 때 사용한다. 등록하지 않으면 컴포넌트가 사라져도 리소스가 해제되지 않아 메모리 누수가 발생한다.

### 여러 개 등록 가능

```jsx
clean(() => clearInterval(timer1));
clean(() => clearInterval(timer2));
clean(() => window.removeEventListener('resize', handleResize));
```

---

## 조건부 렌더링

### && 연산자

```jsx
function App() {
  let loggedIn = false;

  return (
    <div>
      {loggedIn && <UserProfile />}
      <button onClick={() => loggedIn = !loggedIn}>
        {loggedIn ? "로그아웃" : "로그인"}
      </button>
    </div>
  );
}
```

### 삼항 연산자

```jsx
{isLoading ? <Spinner /> : <Content />}
```

---

## 리스트 렌더링

```jsx
function App() {
  let items = ["사과", "바나나", "체리"];

  return (
    <ul>
      {items.map(item => <li>{item}</li>)}
    </ul>
  );
}
```

### 동적 추가/삭제

```jsx
function TodoApp() {
  let todos = [];
  let input = "";

  return (
    <div>
      <input value={input} onInput={(e) => input = e.target.value} />
      <button onClick={() => { todos.push(input); input = ""; }}>추가</button>
      <ul>
        {todos.map((todo, i) => (
          <li>
            {todo}
            <button onClick={() => todos.splice(i, 1)}>삭제</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Fragment

여러 요소를 감싸는 DOM 노드 없이 반환할 때 사용한다.

```jsx
function Info() {
  return (
    <>
      <p>이름: 홍길동</p>
      <p>나이: 25</p>
    </>
  );
}
```

`<>`와 `</>`는 `AEUI.Fragment`의 단축 문법이다. 렌더링 시 추가 DOM 노드를 생성하지 않는다.

---

## 이벤트 처리

JSX에서 이벤트는 `on` + 이벤트명(PascalCase)으로 지정한다.

```jsx
<button onClick={() => count++}>클릭</button>
<input onInput={(e) => name = e.target.value} />
<form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
```

| JSX | DOM 이벤트 |
|-----|-----------|
| `onClick` | `click` |
| `onInput` | `input` |
| `onChange` | `change` |
| `onSubmit` | `submit` |
| `onKeyDown` | `keydown` |

---

## 스타일 적용

### className

```jsx
<div className="container active">내용</div>
```

HTML의 `class` 대신 `className`을 사용한다.

### 인라인 스타일

```jsx
<div style={{ color: 'red', fontSize: '16px', backgroundColor: '#eee' }}>
  스타일 적용
</div>
```

CSS 속성명은 camelCase로 작성한다 (`font-size` → `fontSize`).
