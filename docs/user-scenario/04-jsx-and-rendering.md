# 04. JSX와 렌더링

AEUI는 **JSX**를 사용해 화면을 구성합니다. React의 JSX와 거의 동일하지만, 몇 가지 AEUI 고유의 특징이 있습니다.

---

## JSX 기본

JSX는 HTML처럼 보이는 JavaScript 확장 문법입니다:

```jsx
function Welcome() {
  let name = '세계';
  
  return (
    <div>
      <h1>안녕하세요, {name}!</h1>
      <p>AEUI에 오신 것을 환영합니다.</p>
    </div>
  );
}
```

중괄호 `{}`를 사용해 JavaScript 표현식을 넣을 수 있습니다.

### 속성(props) 전달

```jsx
<img src="/logo.png" alt="로고" />
<button className="primary" disabled={isLoading}>저장</button>
<input type="text" value={query} onInput={(e) => query = e.target.value} />
```

> **참고:** CSS 클래스는 `class` 대신 `className`을 사용합니다.

---

## Fragment — 감싸는 태그 없이 묶기

여러 요소를 반환할 때 불필요한 `<div>`를 넣고 싶지 않다면 Fragment를 사용합니다:

```jsx
function UserInfo() {
  return (
    <>
      <h2>홍길동</h2>
      <p>개발자</p>
    </>
  );
}
```

`<>...</>`는 실제 DOM 요소를 만들지 않고, 자식들을 그대로 부모에 삽입합니다.

---

## 조건부 렌더링

### `&&` 패턴

```jsx
function Notification({ count }) {
  return (
    <div>
      {count > 0 && <span className="badge">{count}</span>}
    </div>
  );
}
```

`count > 0`이 `false`이면 `<span>`은 렌더링되지 않습니다.

### 삼항 연산자

```jsx
function LoginButton({ isLoggedIn }) {
  return (
    <button>
      {isLoggedIn ? '로그아웃' : '로그인'}
    </button>
  );
}
```

### 함수 활용

더 복잡한 조건은 함수로 분리하여 JSX 안에서 호출합니다:

```jsx
function StatusMessage({ status }) {
  function renderMessage() {
    if (status === 'loading') return <p>로딩 중...</p>;
    if (status === 'error') return <p className="error">오류 발생</p>;
    return <p>완료!</p>;
  }

  return <div>{renderMessage()}</div>;
}
```

---

## 리스트 렌더링

배열의 각 항목을 화면에 표시하려면 `map()`을 사용합니다:

```jsx
function FruitList() {
  let fruits = ['사과', '바나나', '체리'];

  return (
    <ul>
      {fruits.map(fruit => (
        <li>{fruit}</li>
      ))}
    </ul>
  );
}
```

### key 사용하기

리스트 항목이 추가, 삭제, 재정렬될 수 있다면 **key**를 지정하세요:

```jsx
function TodoList() {
  let todos = [
    { id: 1, text: '장보기' },
    { id: 2, text: '운동하기' },
    { id: 3, text: '공부하기' },
  ];

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

### key가 중요한 이유

- key가 없으면: AEUI는 순서대로 이전 항목과 새 항목을 매칭합니다. 항목이 중간에 삽입/삭제되면 불필요한 DOM 업데이트가 발생할 수 있습니다.
- key가 있으면: AEUI는 **같은 key의 항목을 정확히 매칭**합니다. DOM과 컴포넌트 상태가 올바르게 보존됩니다.

```jsx
// ✅ 고유 ID를 key로 사용
{items.map(item => <Card key={item.id} data={item} />)}

// ⚠️ index를 key로 사용하면 재정렬 시 문제 가능
{items.map((item, i) => <Card key={i} data={item} />)}
```

### 중복 key 경고

같은 key가 여러 번 나타나면 AEUI가 콘솔에 경고를 출력합니다:

```
[AEUI] Duplicate key detected in sibling list: <key>
```

---

## 스타일 적용

### className

```jsx
<div className="card active">...</div>
```

### 인라인 style

문자열 또는 객체 형태를 사용할 수 있습니다:

```jsx
// 문자열
<div style="color: red; font-size: 16px">빨간 글씨</div>

// 객체
<div style={{ color: 'blue', fontSize: '16px' }}>파란 글씨</div>
```

객체 style은 매 렌더마다 이전 style을 비우고 새로 적용합니다. 빠진 속성은 자동으로 제거됩니다.

---

## 표시되지 않는 값

JSX에서 다음 값들은 화면에 아무것도 표시하지 않습니다:

- `null`
- `undefined`
- `true` / `false`

이 덕분에 조건부 렌더링이 자연스럽게 동작합니다:

```jsx
{showDetails && <Details />}   // showDetails가 false이면 아무것도 안 보임
{null}                          // 아무것도 안 보임
```
