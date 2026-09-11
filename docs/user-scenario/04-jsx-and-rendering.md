# 04. JSX와 렌더링

JSX는 화면 요소를 JavaScript 코드 안에서 태그 형태로 작성하는 문법입니다. 속성과 텍스트에 값을 넣고, 조건과 배열을 사용해 표시할 요소를 정합니다.

---

## JSX 기본

컴포넌트에서 JSX를 반환하면 해당 구조가 화면에 표시됩니다:

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

여러 요소를 반환할 때 AEUI Babel/SWC/Vite 변환기가 인접한 JSX 요소를 Fragment로 자동 묶습니다. 감싸는 태그를 직접 작성하지 않아도 됩니다:

```jsx
function UserInfo() {
  return (
    <h2>홍길동</h2>
    <p>개발자</p>
  );
}
```

Fragment는 실제 DOM 요소를 만들지 않고, 자식들을 그대로 부모에 삽입합니다. `<>...</>`를 직접 작성할 수도 있습니다.

### Fragment 자동 처리

하나의 표현식에 연속해서 작성한 JSX 요소와 명시적 Fragment를 하나로 묶습니다. 일반 반환문, 화살표 함수, JSX 안의 조건식과 속성 표현식에서도 동일하게 동작합니다:

```jsx
// 조건이 참일 때 두 요소를 함께 표시
<section>{visible && <h2>제목</h2><p>내용</p>}</section>

// 각 분기에 속한 요소를 각각 묶음
const content = ready ? <h2>완료</h2><p>결과</p> : <h2>대기</h2><p>안내</p>;

// 각 항목에 두 요소를 반환
items.map(item => <dt>{item.name}</dt><dd>{item.description}</dd>);
```

자동으로 묶은 요소는 직접 Fragment로 감싼 표현식과 같은 우선순위를 갖습니다. 요소 사이의 공백·줄바꿈·JavaScript 주석은 화면에 출력하지 않습니다. 문자열이나 표현식으로 된 자식을 사이에 넣으려면 명시적 Fragment를 사용합니다:

```jsx
<><strong>{name}</strong>님, {message}</>
```

이미 부모 JSX 태그 안에 있는 자식, 쉼표로 구분한 배열 항목, 별도 문장의 JSX는 추가로 묶지 않습니다. 이 문법 확장은 AEUI Babel/SWC/Vite 변환기가 적용되는 빌드에서 제공하며, 일반 JSX 파서만 사용하는 편집기·포매터·TypeScript 문법 검사는 인접 요소를 오류로 표시할 수 있습니다. 그런 도구와 함께 쓰는 파일에서는 명시적 `<>...</>`를 사용할 수 있습니다.

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
