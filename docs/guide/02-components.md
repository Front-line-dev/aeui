# 02. 컴포넌트

AEUI의 컴포넌트는 **함수**입니다. React와 비슷하게 보이지만, 근본적으로 다른 점이 하나 있습니다.

---

## React와의 핵심 차이

| | React | AEUI |
|---|---|---|
| **함수 실행** | 매 렌더마다 전체 함수 재실행 | 함수 본문은 **최초 1회만** 실행 |
| **상태** | `useState` 훅 사용 | 일반 `let` 변수 사용 |
| **갱신** | 명시적 `setState` 호출 | 자동 변경 감지 (Dirty Checking) |

---

## 기본 컴포넌트 작성

```jsx
function Greeting() {
  // 이 줄들은 컴포넌트가 처음 화면에 나타날 때 한 번만 실행됩니다.
  console.log('안녕, 나는 한 번만 출력돼요!');
  
  // ↓ 이 부분만 화면이 갱신될 때마다 다시 실행됩니다.
  return <h1>안녕하세요!</h1>;
}
```

AEUI의 Babel 컴파일러가 자동으로 함수를 두 부분으로 나눕니다:

1. **setup** (함수 본문) — 마운트 시 한 번만 실행
2. **render** (`return` 이후) — 화면 갱신 시마다 실행

이 분리는 **자동**으로 이루어지므로, 특별한 문법을 배울 필요가 없습니다.

---

## `let` 변수를 상태로 사용하기

AEUI에서는 `useState` 같은 훅이 필요 없습니다. 그냥 `let`을 쓰세요:

```jsx
function Counter() {
  // setup: 한 번만 실행
  let count = 0;
  
  // render: 매번 실행 — 항상 최신 count를 표시
  return (
    <button onClick={() => count++}>
      클릭 횟수: {count}
    </button>
  );
}
```

`count++`가 실행되면, AEUI가 자동으로 값의 변경을 감지하고 화면을 갱신합니다.

### 왜 이게 가능할까?

함수 본문(setup)은 한 번만 실행되므로, `let count = 0`은 **최초 마운트 시 한 번만** 실행됩니다. 이후 `count++`로 값을 바꿔도 `count`가 0으로 초기화되지 않습니다. `return` 뒤의 JSX만 반복 실행되면서 **현재 count 값**을 읽어갑니다.

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

AEUI는 부모가 새 props를 전달하면, 컴포넌트가 항상 **최신 값**을 볼 수 있도록 보장합니다. setup에서 구조 분해한 변수도 render 시점에는 최신 값으로 업데이트됩니다.

```jsx
function Display({ message }) {
  // message는 항상 부모가 전달한 최신 값입니다.
  return <p>{message}</p>;
}
```

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
- `export default`인 익명 함수이면서 JSX를 반환

---

## 생명주기 정리

| 단계 | 시점 | 실행 횟수 |
|---|---|---|
| **setup** | 컴포넌트가 화면에 처음 나타날 때 | 1회 |
| **render** | 상태가 변경될 때마다 | 반복 |
| **cleanup** | 컴포넌트가 화면에서 제거될 때 | 1회 |

cleanup에 대해서는 [03. 반응성](03-reactivity.md)에서 `clean`과 함께 설명합니다.

---

## 다음 단계

→ [03. 반응성](03-reactivity.md)에서 `watch`와 `clean`으로 더 정교한 상태 관리를 배워보세요.
