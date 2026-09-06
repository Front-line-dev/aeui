# 02. 컴포넌트

AEUI의 컴포넌트는 **함수**입니다. React와 비슷하게 보이지만, 근본적으로 다른 점이 하나 있습니다.

---

## React와의 핵심 차이

같은 카운터를 React와 AEUI로 비교해 보세요:

**React** — 버튼을 누를 때마다 함수 전체가 다시 실행됩니다:

```jsx
function Counter() {
  // ← 매 렌더마다 이 줄부터 전부 재실행
  const [count, setCount] = useState(0);
  console.log('렌더!');  // 클릭할 때마다 출력

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**AEUI** — 함수 본문은 처음 한 번만 실행되고, `return` 부분만 반복됩니다:

```jsx
function Counter() {
  // ← 처음 화면에 나타날 때 한 번만 실행
  let count = 0;              // 일반 let 변수가 곧 상태
  console.log('마운트!');      // 딱 한 번만 출력

  return <button onClick={() => count++}>{count}</button>;
  //                           ↑ setter 함수 없이 직접 변경
  //     ↑ 이 부분만 화면 갱신 시마다 다시 실행
}
```

핵심 차이를 정리하면:

- **함수 실행**: React는 매 렌더마다 전체 재실행 / AEUI는 최초 1회만 실행
- **상태**: React는 `useState` 훅 / AEUI는 일반 `let` 변수
- **갱신**: React는 `setState` 호출 / AEUI는 자동 변경 감지

---

## 왜 이게 가능할까? — Babel 컴파일러

AEUI의 Babel 컴파일러가 빌드 시점에 `return`을 함수로 감쌉니다:

```jsx
// 여러분이 작성한 코드
function Counter() {
  let count = 0;
  return <button onClick={() => count++}>{count}</button>;
}
```

```jsx
// Babel 컴파일러가 변환한 코드
function Counter() {
  let count = 0;
  return () => <button onClick={() => count++}>{count}</button>;
}
```

`return` 뒤에 `() =>`가 붙으면서 함수 본문(**setup** — 한 번)과 반환된 함수(**render** — 매번)로 나뉩니다. 이 변환은 자동이므로 신경 쓸 필요 없습니다.

> **참고:** 위 카운터 예제에서 `let count = 0`으로 상태를 선언하고 `count++`로 직접 변경했습니다. AEUI가 이 변경을 어떻게 감지하는지는 [03. 반응성](03-reactivity.md)에서 설명합니다.

---

## Props 받기

### 기본 형태

```jsx
function UserCard({ name, age }) {
  return (
    <div>
      <h2>{name}</h2>
      <p>{age}세</p>
    </div>
  );
}

// 사용
<UserCard name="홍길동" age={25} />
```

### 기본값 설정

```jsx
function Badge({ label = '일반', color = 'gray' }) {
  return (
    <span style={`background: ${color}`}>
      {label}
    </span>
  );
}
```

### rest props

```jsx
function Button({ label, ...rest }) {
  return <button {...rest}>{label}</button>;
}

<Button label="저장" onClick={() => save()} disabled={isSaving} />
```

### props는 항상 최신

setup은 한 번만 실행되는데, 구조 분해한 props는 어떻게 최신 값을 유지할까요?

```jsx
// 여러분이 작성한 코드
function Display({ message }) {
  return <p>{message}</p>;
}
```

```jsx
// Babel 컴파일러가 변환한 코드 (개념)
function Display(_initialProps) {
  const _props = { ..._initialProps };      // props 저장 객체
  let { message } = _initialProps;

  return (_newProps) => {
    Object.assign(_props, _newProps);        // 매 render마다 최신 props로 갱신
    ({ message } = _props);
    return <p>{message}</p>;
  };
}
```

컴파일러가 props 저장 객체를 만들고, 매 render마다 최신 값을 다시 읽습니다. 자동이므로 신경 쓸 필요 없습니다.

---

## 컴포넌트 조합

컴포넌트 안에서 다른 컴포넌트를 사용할 수 있습니다:

```jsx
function App() {
  return (
    <main>
      <Header />
      <Counter />
      <Footer />
    </main>
  );
}

function Header() {
  return <h1>AEUI 앱</h1>;
}

function Footer() {
  return <footer>© 2026 AEUI</footer>;
}
```

### children 사용

```jsx
function Card({ title, children }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="card-body">{children}</div>
    </div>
  );
}

// 사용
<Card title="알림">
  <p>새로운 메시지가 있습니다.</p>
</Card>
```

---

## 컴포넌트 이름 규칙

AEUI의 Babel 컴파일러는 **PascalCase 이름**의 함수를 컴포넌트로 인식합니다:

```jsx
function MyComponent() { ... }    // ✅ 컴포넌트로 인식
function myHelper() { ... }      // ❌ 일반 함수로 취급

export default function () { ... } // ✅ export default는 이름 없어도 인식
```

### 컴포넌트로 인식되는 조건

- PascalCase 이름 + JSX를 반환 + export
- JSX에서 태그로 사용됨: `<MyComponent />`
- 올바른 AEUI runtime의 `createElement`, `createVNode` 첫 인자 또는 `AEUI.init`의 루트 컴포넌트로 사용됨
- `export default`인 익명 함수이면서 JSX를 반환

---

## 생명주기

| 단계 | 시점 | 실행 횟수 |
|---|---|---|
| **setup** | 컴포넌트가 화면에 처음 나타날 때 | 1회 |
| **render** | 상태가 변경될 때마다 | 반복 |
| **cleanup** | 컴포넌트가 화면에서 제거될 때 | 1회 |

cleanup에 대해서는 [03. 반응성](03-reactivity.md)에서 `clean`과 함께 설명합니다.
