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
// 컴포넌트 전용 setup의 개념
function CounterSetup() {
  let count = 0;
  return () => <button onClick={() => count++}>{count}</button>;
}
```

컴포넌트 전용 setup에서 `return` 뒤에 `() =>`가 붙으면서 함수 본문(**setup** — 한 번)과 반환된 함수(**render** — 매번)로 나뉩니다. 이 변환은 자동이므로 신경 쓸 필요 없습니다.

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

컴파일러는 원래 함수의 일반 호출을 유지하고 컴포넌트 전용 setup을 별도로 준비합니다. 따라서 `badge({ text: '일반 호출' })`는 원래처럼 VNode를 반환합니다. 일반 호출에는 독립적인 컴포넌트 상태나 생명주기가 생기지 않으며, `watch`·`clean`의 setup 전용 규칙도 그대로 적용됩니다.

### 자동 준비 범위

AEUI Babel/Vite 플러그인이 처리하는 함수 선언·함수 표현식·화살표 함수가 대상입니다.

- JSX 또는 AEUI VNode 생성 표현식을 반환하는 함수는 이름·export 여부와 관계없이 준비합니다. 함수를 반환하는 팩토리의 내부 함수도 포함합니다.
- 같은 파일의 JSX 태그·AEUI 생성/초기화 호출·JSX props에서 함수 정의까지 추적되는 값도 준비합니다. 별칭, 재할당, 조건식과 단순 객체 속성을 추적합니다.
- export된 함수의 `null`, 문자열·숫자 등의 리터럴, props 및 children 참조 반환도 준비합니다. JSX가 없는 파일도 플러그인의 처리 대상입니다.
- import·re-export는 정의 파일에서 준비된 함수 값을 그대로 전달합니다. 사용하는 파일에서 외부 함수의 소스를 추측하거나 실행하지 않습니다.
- 수동으로 render 함수를 반환하는 기존 setup 함수도 사용할 수 있습니다. 준비되지 않은 함수가 VNode 등을 바로 반환하면 컴파일이 필요하다는 오류를 기록합니다. async/generator 컴포넌트는 지원하지 않습니다.

함수나 getter의 실행 결과를 빌드 중 알아내는 전역 분석은 수행하지 않습니다. JSX가 없고 위 사용 근거도 없는 외부 함수, `bind`·Proxy 등으로 새로 만든 함수, 객체/class 메서드는 자동 준비 범위 밖입니다. 해당 함수는 미리 AEUI로 빌드하거나 수동 setup/render 계약을 만족해야 합니다. 앱 시작은 모듈 평가가 끝난 뒤 수행해야 합니다. 순환 import 평가 중 등록 전에 마운트하는 경우는 [알려진 결함](../issue/known-defects.md)에서 추적합니다.

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
