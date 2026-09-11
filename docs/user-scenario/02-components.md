# 02. 컴포넌트

AEUI의 컴포넌트는 화면에 표시할 내용을 반환하는 함수입니다. 함수 안에 상태를 두고 JSX로 표시하면, 상태를 바꿨을 때 화면이 갱신됩니다.

---

## 컴포넌트 작성하기

다음 카운터는 `count`를 버튼에 표시하고, 클릭할 때 값을 하나씩 늘립니다.

```jsx
function Counter() {
  let count = 0;
  console.log('카운터 시작');

  return <button onClick={() => count++}>클릭: {count}</button>;
}
```

처음 화면에는 `클릭: 0`이 표시됩니다. 버튼을 두 번 누르면 `클릭: 2`가 됩니다. 함수 본문의 `카운터 시작` 로그는 이 컴포넌트가 마운트될 때 한 번 출력됩니다.

## setup과 render

상태를 유지하면서 화면을 갱신하도록 컴포넌트 실행을 두 단계로 나눕니다.

| 단계 | 카운터에서 하는 일 | 실행 시점 |
|---|---|---|
| setup | `count`를 만들고 시작 로그 출력 | 컴포넌트가 마운트될 때 한 번 |
| render | 현재 `count`를 읽어 버튼 내용 생성 | 첫 화면과 이후 화면 갱신 때 |

버튼을 눌러도 `let count = 0`을 다시 실행하지 않으므로 증가한 값이 유지됩니다. 바뀐 `count`를 사용해 `return`하는 JSX를 다시 계산합니다.

[03. 반응성](03-reactivity.md)에서 상태 변경이 반영되는 시점과 `watch`·`clean`을 이어서 다룹니다.

---

## Props 받기

Props는 부모 컴포넌트가 자식에게 전달하는 입력입니다. JSX 속성으로 값을 넘기고, 자식은 함수의 첫 번째 인자로 받습니다.

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

부모가 전달한 props가 바뀌면 자식은 `return`하는 JSX를 다시 계산합니다.

```jsx
function Display({ message }) {
  return <p>{message}</p>;
}

function MessageEditor() {
  let message = '안녕하세요';

  return (
    <div>
      <input value={message} onInput={e => message = e.target.value} />
      <Display message={message} />
    </div>
  );
}
```

입력란의 글자를 바꾸면 `Display`에 표시되는 글자도 바뀝니다. 자식을 다시 마운트하거나 별도 갱신 함수를 호출할 필요는 없습니다. setup에서 다른 지역 변수에 복사해 둔 값은 [값을 저장하는 위치](#setup에서-저장한-값과-render에서-읽는-값)에 따라 동작이 달라집니다.

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

## 컴포넌트 값 전달

JSX 태그는 실행 시점의 값을 사용합니다. 함수 이름이나 `const`·`let` 선언 방식으로 실행 경로를 구분하지 않습니다.

```jsx
const badge = ({ text }) => <span>{text}</span>;
const Badge = badge;

function Slot({ component: View }) {
  return <View text="AEUI" />;
}

function App() {
  return <Slot component={Badge} />;
}
```

- 같은 함수는 별칭, 객체 속성, props, import·re-export를 거쳐도 같은 컴포넌트입니다.
- `let View` 또는 props의 `View`가 다른 함수로 바뀌면 기존 컴포넌트를 정리하고 새 컴포넌트를 마운트합니다. 같은 함수와 key를 유지하면 기존 상태를 유지합니다.
- `<View />`는 변수 값을 읽고, `<props.View />`는 속성 값을 읽습니다. `<view />`처럼 소문자로 시작하는 단독 태그는 HTML 태그 문자열입니다.
- `const View = 'section'`이면 `<View />`는 HTML 요소입니다. `null`, 숫자, 일반 객체, 이미 생성한 VNode는 태그로 사용할 수 없습니다.
- 콜백을 props로 전달해도 판별을 위해 호출하지 않습니다. 함수가 태그 자리에 도달할 때 컴포넌트로 실행합니다.

`badge({ text: '일반 호출' })`처럼 일반 함수로 호출하면 VNode를 반환합니다. 일반 호출에는 독립적인 컴포넌트 상태나 생명주기가 생기지 않습니다. `watch`·`clean`은 컴포넌트의 setup에서 호출해야 합니다.

### setup에서 저장한 값과 render에서 읽는 값

```jsx
function Slot(props) {
  const View = props.component; // 최초 setup에서 저장한 값
  return <View />;
}
```

지역 변수에 복사한 값은 자동으로 다시 계산하지 않습니다. 최신 컴포넌트를 사용하려면 `return <props.component />` 또는 위 예제처럼 파라미터에서 구조 분해한 `View`를 사용합니다.

setup의 `if (...) return ...` 분기도 최초에 결정됩니다. 변경될 조건은 `return visible ? <Content /> : null`처럼 반환 표현식 안에 둡니다. props 기본값에 `() => <span />`을 직접 만들면 재해석 때마다 새 함수가 생기므로, 상태를 유지할 기본 컴포넌트는 함수 밖에 선언합니다.

---

## 생명주기

| 단계 | 시점 | 실행 횟수 |
|---|---|---|
| **setup** | 컴포넌트가 화면에 처음 나타날 때 | 1회 |
| **render** | 상태가 변경될 때마다 | 반복 |
| **cleanup** | 컴포넌트가 화면에서 제거되거나 최초 마운트가 실패할 때 | 등록한 함수마다 1회 |

cleanup에 대해서는 [03. 반응성](03-reactivity.md)에서 `clean`과 함께 설명합니다.

최초 마운트 중 setup·첫 render·뒤쪽 자식 생성이 실패하면 이미 등록한 정리 함수를 실행하고 새로 만든 자식과 DOM을 제거합니다. 기존 화면을 갱신하다 실패한 경우의 전체 변경을 되돌리는 transaction이나 error boundary를 제공하는 것은 아닙니다.
