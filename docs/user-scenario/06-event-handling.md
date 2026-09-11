# 06. 이벤트와 입력

이벤트 핸들러는 사용자가 버튼을 누르거나 입력값을 바꿀 때 실행되는 함수입니다. JSX의 `onClick`, `onInput` 같은 속성에 지정합니다.

---

## 이벤트 핸들링

JSX에서 `on` + 이벤트 이름(대문자 시작) 형태로 이벤트 핸들러를 등록합니다:

```jsx
function ClickExample() {
  let count = 0;

  return (
    <div>
      <button onClick={() => count++}>클릭: {count}</button>
    </div>
  );
}
```

버튼을 누르면 `count`가 증가하고 다음 프레임에 버튼의 숫자가 바뀝니다.

### 주요 이벤트

| JSX prop | DOM 이벤트 |
|---|---|
| `onClick` | `click` |
| `onInput` | `input` |
| `onChange` | `change` |
| `onSubmit` | `submit` |
| `onKeyDown` | `keydown` |
| `onMouseEnter` | `mouseenter` |
| `onFocus` | `focus` |
| `onBlur` | `blur` |

### 이벤트 객체 사용

핸들러 함수는 표준 DOM 이벤트 객체를 받습니다:

```jsx
function KeyLogger() {
  let lastKey = '';

  return (
    <div>
      <input onKeyDown={(e) => lastKey = e.key} />
      <p>마지막 키: {lastKey}</p>
    </div>
  );
}
```

### 이벤트 기본 동작 차단

```jsx
function FormExample() {
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      console.log('폼 제출 처리');
    }}>
      <button type="submit">제출</button>
    </form>
  );
}
```

---

## 입력(input) 처리

### 텍스트 입력

```jsx
function SearchBox() {
  let query = '';

  return (
    <div>
      <input
        type="text"
        value={query}
        onInput={(e) => query = e.target.value}
        placeholder="검색어 입력..."
      />
      <p>입력값: {query}</p>
    </div>
  );
}
```

텍스트를 편집하는 동안 상태를 갱신하려면 `onInput`을 사용합니다. `onChange`의 발생 시점은 입력 종류와 확정 동작에 따라 다릅니다. 텍스트 입력에서는 편집 후 포커스를 떠날 때, 체크박스에서는 선택 상태가 바뀔 때 발생합니다. [HTML 입력 이벤트 규칙](https://html.spec.whatwg.org/multipage/input.html#common-event-behaviors)을 따릅니다.

### 체크박스

```jsx
function ToggleExample() {
  let isChecked = false;

  return (
    <label>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => isChecked = !isChecked}
      />
      동의합니다 ({isChecked ? '체크됨' : '체크 안 됨'})
    </label>
  );
}
```

### 셀렉트 박스

```jsx
function CategoryFilter() {
  let category = 'all';

  return (
    <select
      value={category}
      onChange={(e) => category = e.target.value}
    >
      <option value="all">전체</option>
      <option value="food">음식</option>
      <option value="tech">기술</option>
    </select>
  );
}
```

### textarea

```jsx
function MemoEditor() {
  let content = '';

  return (
    <textarea
      value={content}
      onInput={(e) => content = e.target.value}
      rows={5}
    />
  );
}
```

---

## Controlled Input

AEUI의 input은 **controlled** 방식으로 동작합니다. `value`나 `checked` prop을 지정하면, AEUI가 매 렌더마다 해당 값으로 input을 **복구**합니다.

```jsx
function NumberInput() {
  let value = 0;

  return (
    <input
      type="number"
      value={value}
      onInput={(e) => {
        const num = parseInt(e.target.value);
        // 0~100 범위로 제한
        value = Math.max(0, Math.min(100, isNaN(num) ? 0 : num));
      }}
    />
  );
}
```

예를 들어 `120`을 입력하면 핸들러가 상태를 `100`으로 제한하고, 다음 렌더에서 입력란에도 `100`이 표시됩니다. 입력 이벤트에서 상태를 바꾸지 않으면 입력란은 다음 렌더에서 상태에 저장된 값으로 돌아옵니다.

> **참고:** `type="file"` input은 보안 상 프로그래밍으로 `value`를 설정할 수 없으므로, AEUI도 value를 강제하지 않습니다.

---

## 폼 조합 예시

```jsx
function ContactForm() {
  let name = '';
  let email = '';
  let message = '';
  let errors = {};

  function validate() {
    const result = {};
    if (!name.trim()) result.name = '이름을 입력하세요';
    if (!email.includes('@')) result.email = '올바른 이메일을 입력하세요';
    if (!message.trim()) result.message = '메시지를 입력하세요';
    return result;
  }

  function handleSubmit(e) {
    e.preventDefault();
    errors = validate();
    if (Object.keys(errors).length === 0) {
      console.log('전송:', { name, email, message });
      name = '';
      email = '';
      message = '';
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>이름</label>
        <input value={name} onInput={(e) => name = e.target.value} />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>
      <div>
        <label>이메일</label>
        <input type="email" value={email} onInput={(e) => email = e.target.value} />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>
      <div>
        <label>메시지</label>
        <textarea value={message} onInput={(e) => message = e.target.value} />
        {errors.message && <span className="error">{errors.message}</span>}
      </div>
      <button type="submit">전송</button>
    </form>
  );
}
```

---

## 이벤트와 화면 갱신

DOM 이벤트(클릭, 입력 등) 안에서 상태를 변경하면, AEUI가 자동으로 **다음 프레임에 화면을 갱신**합니다. `AEUI.render()`를 직접 호출할 필요가 없습니다.

여러 이벤트가 빠르게 연속으로 발생해도, AEUI는 **하나의 렌더링으로 합쳐서** 처리합니다.
