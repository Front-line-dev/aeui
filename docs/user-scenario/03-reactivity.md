# 03. 반응성

[02. 컴포넌트](02-components.md)에서 `let` 변수를 상태로 사용하고 직접 변경하는 것을 봤습니다. 이 장에서는 AEUI가 **어떻게 변경을 감지**하는지와, `watch`/`clean`으로 더 정교하게 반응하는 방법을 설명합니다.

---

## 변경 감지의 원리

AEUI는 **Dirty Checking** 방식으로 상태 변경을 감지합니다. 주기적으로 이전 값과 현재 값을 비교하여, 달라졌으면 화면을 갱신합니다.

- **DOM 이벤트** (클릭, 입력 등) 후에는 다음 프레임에 **즉시** 갱신됩니다
- 그 외에는 polling으로 최대 약 1초 내에 감지됩니다
- 배열이나 객체도 **깊은 비교(deep equal)**로 내용 변경을 감지합니다

대부분의 상태 변경은 DOM 이벤트에서 일어나므로, 사용자 체감상 즉시 반영됩니다.

---

## `watch` — 값 변화에 반응하기

`watch`는 **화면이 갱신될 때마다** 콜백을 실행합니다. 상태 변경에 따라 부수 효과(side effect)를 실행할 때 사용합니다.

### 기본 사용법 — deps 없이

```jsx
import { watch } from 'aeui';

function PriceDisplay() {
  let price = 1000;
  let tax = 0;

  // 매 렌더마다 실행 — price가 바뀌면 tax도 갱신
  watch(() => {
    tax = Math.floor(price * 0.1);
    console.log(`가격: ${price}원, 세금: ${tax}원`);
  });

  return (
    <div>
      <p>가격: {price}원 (세금 포함: {price + tax}원)</p>
      <button onClick={() => price += 500}>500원 인상</button>
    </div>
  );
}
```

**deps 없이 `watch(콜백)`만 호출하면, 매 렌더마다 콜백이 항상 실행됩니다.** 이것이 가장 일반적인 사용법입니다.

### 문법

```js
watch(콜백함수);           // ✅ 기본: 매 렌더마다 실행
watch(콜백함수, [감시할 값들]); // 지정한 값이 바뀔 때만 실행
```

- **첫 번째 인자**: 실행할 함수
- **두 번째 인자 (선택)**: 감시할 값들의 배열 (deps) — 생략하면 매번 실행

### 핵심 규칙

1. `watch`는 **setup에서만** 호출할 수 있습니다 (함수 본문에서, `return` 위에)
2. deps가 없으면 **매 렌더마다** 콜백을 실행합니다
3. deps가 있으면 **처음 등록할 때는 실행하지 않고**, 이후 deps가 변경될 때만 실행합니다

---

## deps는 언제 사용하나?

**대부분의 경우 deps는 필요 없습니다.** 콜백이 매번 실행되어도 괜찮다면, 그냥 `watch(콜백)`을 쓰세요.

deps를 사용하는 경우는 **콜백이 여러 번 실행되면 안 되는 상황**입니다:

### ✅ deps가 필요한 경우 — 네트워크 요청

```jsx
function UserProfile({ userId }) {
  let profile = null;

  // userId가 바뀔 때만 API 호출 (매번 호출하면 낭비!)
  watch(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => { profile = data; });
  }, [userId]);

  return profile
    ? <div>{profile.name}</div>
    : <p>로딩 중...</p>;
}
```

### ✅ deps가 필요한 경우 — 알림, 로깅

```jsx
function OrderTracker({ status }) {
  // status가 바뀔 때만 알림 (매번 보내면 스팸!)
  watch(() => {
    alert(`주문 상태가 "${status}"(으)로 변경되었습니다.`);
  }, [status]);

  return <p>현재 상태: {status}</p>;
}
```

### ❌ deps가 불필요한 경우 — 계산, 동기화

```jsx
function Cart() {
  let items = [];
  let total = 0;

  // 매번 다시 계산해도 문제없으므로 deps 불필요
  watch(() => {
    total = items.reduce((sum, item) => sum + item.price, 0);
  });

  return <p>합계: {total}원</p>;
}
```

> **원칙:** 콜백의 부수 효과가 가벼운 연산이면 deps 없이 쓰세요. 네트워크 요청, 알림 발송, 파일 저장 등 **비용이 크거나 중복 실행이 위험한 작업**에만 deps를 지정하세요.

---

## deps 사용 시 참고

### 여러 값 감시

```jsx
watch(() => {
  console.log('이름 또는 나이가 바뀜');
}, [name, age]);
```

### 배열/객체 변경도 감지

AEUI는 **깊은 비교(deep equal)**를 사용하므로, 배열이나 객체의 내용이 바뀌어도 감지합니다:

```jsx
function TodoList() {
  let items = ['할 일 1', '할 일 2'];

  watch(() => {
    console.log(`할 일 ${items.length}개`);
  }, [items]);

  return (
    <div>
      <button onClick={() => items.push('새 할 일')}>추가</button>
      {items.map(item => <p>{item}</p>)}
    </div>
  );
}
```

`items.push()`로 배열을 직접 수정해도, AEUI가 이전 상태의 복사본과 비교하여 변경을 감지합니다.

---

## `clean` — 정리 작업 등록

`clean`은 **컴포넌트가 화면에서 제거될 때** 실행할 작업을 등록합니다:

```jsx
import { clean } from 'aeui';

function Clock() {
  let time = new Date().toLocaleTimeString();
  
  const timerId = setInterval(() => {
    time = new Date().toLocaleTimeString();
  }, 1000);

  // 컴포넌트가 제거될 때 interval 해제
  clean(() => {
    clearInterval(timerId);
  });

  return <p>현재 시각: {time}</p>;
}
```

### 핵심 규칙

1. `clean`도 **setup에서만** 호출합니다
2. 여러 번 호출하면 **등록 순서대로** 실행됩니다
3. 하나의 clean이 실패해도 **나머지는 계속 실행**됩니다

### 자주 쓰는 패턴

```jsx
function DataFetcher({ url }) {
  let data = null;
  let loading = true;

  // WebSocket 연결
  const ws = new WebSocket(url);
  ws.onmessage = (e) => {
    data = JSON.parse(e.data);
    loading = false;
  };

  // 컴포넌트 제거 시 연결 해제
  clean(() => ws.close());

  return loading ? <p>로딩 중...</p> : <pre>{JSON.stringify(data)}</pre>;
}
```

---

## 비동기 작업과 수동 갱신

`setTimeout`, `setInterval`, `fetch` 등의 비동기 작업 안에서 상태를 변경하면, DOM 이벤트와 달리 **즉시 갱신되지 않습니다**. AEUI의 polling이 변경을 감지할 때까지 최대 약 1초 정도 걸릴 수 있습니다.

즉시 갱신이 필요하다면 `AEUI.render()`를 호출하세요:

```jsx
import { AEUI } from 'aeui';

function AsyncCounter() {
  let count = 0;

  setTimeout(() => {
    count = 42;
    AEUI.render(); // 즉시 화면 갱신
  }, 2000);

  return <p>{count}</p>;
}
```

### 언제 `AEUI.render()`가 필요한가?

| 상황 | 자동 갱신? | `AEUI.render()` 필요? |
|---|---|---|
| `onClick` 등 DOM 이벤트 | ✅ 다음 프레임에 자동 | ❌ |
| `setTimeout` / `setInterval` | ⚠️ polling 대기 (최대 ~1초) | 즉시 갱신 원하면 ✅ |
| `fetch` / Promise | ⚠️ polling 대기 | 즉시 갱신 원하면 ✅ |
| 외부 라이브러리 콜백 | ⚠️ polling 대기 | 즉시 갱신 원하면 ✅ |

> **팁:** 대부분의 경우, 사용자 인터랙션은 DOM 이벤트를 통하므로 `AEUI.render()`를 직접 호출할 일은 드뭅니다.

---

## watch + clean 조합 예시

```jsx
import { watch, clean } from 'aeui';

function AutoSaver({ data }) {
  let saveTimer = null;

  // data가 변경되면 2초 후에 자동 저장
  watch(() => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem('draft', JSON.stringify(data));
      console.log('자동 저장 완료');
    }, 2000);
  }, [data]);

  // 컴포넌트 제거 시 타이머 정리
  clean(() => {
    if (saveTimer) clearTimeout(saveTimer);
  });

  return <p>자동 저장이 활성화되어 있습니다.</p>;
}
```

## 이름 있는 dependency getter와 import alias

`import { watch as observe } from 'aeui'`처럼 별칭을 사용할 수 있습니다. 재할당되지 않는 local 함수는 getter로 그대로 전달합니다.

```js
const getDeps = () => [count];
observe(() => console.log(count), getDeps);
```

import된 값, 재할당되는 binding, 동적 member는 함수인지 dependency 값인지 안전하게 결정할 수 없어 컴파일 진단을 냅니다. 이때는 `() => [value]`, `() => props.deps`, `() => getDeps()`처럼 결과가 배열인 getter를 직접 적으세요.
