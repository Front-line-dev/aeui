# 08. DOM 조작 — `createDomNode`, `updateDomProps`, `updateProps`

## 개요

이 함수들은 AEUI에서 **실제 브라우저 DOM을 조작**하는 역할을 담당한다.

`reconcile`이 "무엇을 변경할지" (어떤 노드를 추가/수정/삭제할지) 결정하면, 이 함수들이 "실제 DOM에 어떻게 적용할지"를 처리한다. AEUI 내부에서 `document.createElement`, `setAttribute`, `addEventListener` 등 브라우저 API를 직접 호출하는 곳은 여기뿐이다.

---

## 함수 목록

| 함수 | 역할 |
|------|------|
| `createDomNode(state, vnode)` | VNode으로부터 DOM 요소 생성 |
| `updateDomProps(state, domNode, props, oldProps)` | DOM 속성 diff 및 적용 |
| `updateProps(target, newProps)` | 컴포넌트 props 객체 내용 교체 |
| `cloneHostPropsSnapshot(state, props)` | host node의 props 스냅샷 생성 |
| `syncHostControlledProps(state, node)` | `value`/`checked` controlled prop 동기화 |

---

## `createDomNode(state, vnode)`

VNode로부터 **실제 DOM 요소를 생성**한다.

### 코드

```javascript
export function createDomNode(state, vnode) {
  if (typeof vnode !== "object") {
    return document.createTextNode(String(vnode));
  }

  const domNode = document.createElement(vnode.tag);
  updateDomProps(state, domNode, vnode.props);
  return domNode;
}
```

### 주의사항

- **children은 여기서 처리하지 않는다**. children은 `reconcile`이 재귀적으로 처리한다. `createDomNode()`는 빈 껍데기 DOM 요소만 만든다.
- `vnode.tag`가 함수(컴포넌트)인 경우는 `reconcile`의 4단계에서 처리되므로 이 함수에 도달하면 안 된다. 만약 도달하면 `console.error`를 출력한다.

---

## `cloneHostPropsSnapshot(state, props)`

host node의 props를 deepClone으로 독립적 스냅샷을 만든다. `children`, `key`, `ref`는 DOM 속성이 아니므로 스냅샷에 포함하지 않는다.

JSX transform이 개발용 metadata로 주입하는 `__self`, `__source`도 스냅샷에서 제외한다. 특히 `__self`는 컴포넌트 인스턴스 노드 전체를 가리킬 수 있으므로 deepClone 대상에 포함되면 인스턴스 트리와 DOM 참조를 따라가며 메모리 폭증을 일으킬 수 있다.

이전 props를 `deepClone`으로 저장해두므로, **같은 style 객체를 직접 수정해도** 다음 렌더에서 변경이 감지된다.

---

## `updateDomProps(state, domNode, props, oldProps)`

DOM 요소의 **속성(attribute, property)을 업데이트**한다. 새 props와 이전 props를 비교하여 **실제로 변경된 부분만** 적용한다.

### 파라미터

| 파라미터 | 설명 |
|----------|------|
| `domNode` | 대상 DOM 요소 (예: `<div>`, `<button>`) |
| `props` | 이번 렌더에서의 속성 객체. 예: `{ className: "box", onClick: fn }` |
| `oldProps` | 이전 렌더에서의 속성 객체. 기본값 `{}`. 비교 대상이며, 이전에 있었지만 이번에 사라진 속성을 제거할 때 사용 |

### 전체 처리 순서

```
1. allProps = { ...oldProps, ...props }
   → 이전과 현재의 모든 key를 수집 (사라진 속성도 감지하기 위함)

2. 각 key에 대해 순서대로:
   ├── key가 children, key, ref, __self, __source → 건너뜀
   ├── file-input value 특례인지 계산
   ├── 새 값과 이전 값이 같고 file-input value 특례가 아니면 (deepEqual) → 건너뜀
   ├── key가 on으로 시작 + 함수값 → 이벤트 핸들러 처리
   ├── key === "className" → className 처리
   ├── key === "style" + 객체값 → style 객체 처리
   ├── key === "style" + 문자열 → style 문자열 처리
   ├── key === "value" → controlled value 처리
   ├── key가 aria-로 시작 → ARIA attribute 처리
   ├── boolean 값 → boolean attribute 처리
   ├── null/undefined 값 → attribute 제거
   └── 그 외 → setAttribute로 설정
```

### allProps 병합으로 모든 key를 수집하는 이유

```javascript
const allProps = { ...oldProps, ...props };
```

이전 props에는 있었지만 새 props에는 없는 속성을 감지하여 제거하기 위함이다.

```
oldProps: { id: "test", className: "old" }
props:    { id: "test" }
allProps: { id: "test", className: "old" }

→ className의 경우: newValue = undefined (props에 없음), oldValue = "old" (있었음)
→ removeAttribute("className") 실행
```

---

### 스킵되는 props

```javascript
if (key === 'children' || key === 'key' || key === 'ref') continue;
```

| key | 이유 |
|-----|------|
| `children` | `createVNode`이 children을 props에도 저장하지만, 이것은 DOM 속성이 아니다. 자식 요소 처리는 `reconcile`이 담당한다 |
| `key` | reconciliation에서 형제 노드를 식별하는 내부 힌트다. DOM 속성으로 설정하면 안 된다 |
| `ref` | AEUI 내부용으로 예약한 값이므로 DOM 속성으로 설정하지 않는다 |

`__self`, `__source`도 JSX transform이 개발용으로 넣는 metadata이므로 DOM 속성으로 내려보내지 않는다.

### 변경 감지 (불필요한 DOM 조작 방지)

```javascript
if (state.deepEqual(newValue, oldValue)) continue;
```

`deepEqual`로 이전 값과 새 값을 비교하여, 실제로 변경되지 않은 속성은 건너뛴다. DOM 조작은 비용이 크기 때문에 (브라우저의 레이아웃 재계산을 유발할 수 있음), 최소화해야 한다.

---

### 이벤트 핸들러 처리

```javascript
if (key.startsWith("on")) {
  const eventName = key.substring(2).toLowerCase();

  // 1. 프록시 저장소 초기화
  if (!domNode._aeuiHandlers) {
    domNode._aeuiHandlers = {};
  }
  if (!domNode._aeuiProxyListeners) {
    domNode._aeuiProxyListeners = {};
  }

  if (typeof newValue !== "function") {
    // 함수가 아니면 리스너를 제거한다.
    if (domNode._aeuiProxyListeners[eventName]) {
      domNode.removeEventListener(eventName, domNode._aeuiProxyListeners[eventName]);
      delete domNode._aeuiProxyListeners[eventName];
    }
    delete domNode._aeuiHandlers[eventName];
    continue;
  }

  // 최신 핸들러 참조만 교체
  domNode._aeuiHandlers[eventName] = newValue;

  // 이벤트 타입별 프록시 리스너는 1회만 등록
  if (!domNode._aeuiProxyListeners[eventName]) {
    const proxyListener = (event) => {
      if (typeof state.dispatchDomEvent === 'function') {
        state.dispatchDomEvent(domNode, eventName, event);
        return;
      }

      const currentHandler = domNode._aeuiHandlers[eventName];
      if (typeof currentHandler === 'function') {
        currentHandler.call(domNode, event);
      }
    };
    domNode.addEventListener(eventName, proxyListener);
    domNode._aeuiProxyListeners[eventName] = proxyListener;
  }
}
```

**동작**:
1. JSX의 이벤트 prop 이름에서 `on` 접두사를 제거하고 소문자로 변환하여 표준 DOM 이벤트 이름을 얻는다. 예: `onClick` → `click`, `onInput` → `input`
2. DOM 노드에 이벤트별 핸들러 저장소(`_aeuiHandlers`)와 프록시 리스너 저장소(`_aeuiProxyListeners`)를 유지한다.
3. 새 값이 함수가 아니면 기존 프록시 리스너를 제거한다.
4. 새 값이 함수면 저장된 핸들러 참조만 갱신한다.
5. 프록시 리스너가 아직 없을 때만 `addEventListener`를 1회 등록한다.
6. 실제 이벤트가 발생하면 `dispatchDomEvent()`가 핸들러를 실행하고, 가장 바깥 DOM 이벤트가 끝난 뒤 `requestRender()`로 다음 프레임 렌더를 예약한다.

이 fast path는 **AEUI가 등록한 DOM 이벤트 안의 동기 변경**만 다룬다. `setTimeout`, `Promise`, 외부 store, 수동 `addEventListener`에서 일어난 변경은 DOM 이벤트 브리지를 통과하지 않으므로, 기존 polling fallback이 계속 필요하다.

**인라인 함수 처리 최적화**:

```jsx
<button onClick={() => count++}>클릭</button>
```

인라인 화살표 함수(`() => count++`)는 렌더 함수가 실행될 때마다 **새 함수 객체**가 생성된다. `deepEqual`은 함수를 참조 비교(`Object.is`)하므로 매번 "다름"으로 판단된다.  
이 구현은 DOM 리스너를 매번 재등록하지 않고, 저장된 핸들러 참조만 갱신하므로 불필요한 `removeEventListener`/`addEventListener` 호출을 줄인다.

> **이벤트 핸들러 변경은 `didMutate`를 true로 만들지 않는다.** DOM write가 아니므로 polling backoff에 영향을 주지 않는다.

---

### className 처리

```javascript
if (key === 'className') {
  domNode.className = newValue ?? '';
}
```

JSX에서는 HTML의 `class` 대신 `className`을 사용한다 (JavaScript의 `class` 예약어와의 충돌 방지). DOM의 `.className` 프로퍼티에 직접 할당하면 HTML `class` 속성으로 올바르게 반영된다.

`newValue`가 `null`이나 `undefined`면 빈 문자열로 설정하여 이전 class를 제거한다.

---

### style 처리

AEUI는 style을 두 가지 형태로 지원한다:

**1. 객체 형태** (React 스타일):
```jsx
<div style={{ color: 'red', fontSize: '16px' }} />
```
```javascript
if (key === "style" && typeof newValue === "object" && newValue !== null) {
  domNode.style.cssText = '';             // 이전 스타일 전체 초기화
  Object.assign(domNode.style, newValue); // 새 스타일 일괄 적용
}
```

`cssText = ''`로 먼저 초기화하는 이유: 이전 tick에서 `{ color: 'red', border: '1px solid' }`이었고 이번 tick에서 `{ color: 'blue' }`로 바뀌었을 때, `border`가 남아있지 않도록 전체를 리셋한 후 새 스타일만 적용한다.

**2. 문자열 형태** (HTML 스타일):
```jsx
<div style="color: red; font-size: 16px" />
```
```javascript
if (key === "style" && typeof newValue === "string") {
  domNode.style.cssText = newValue;
}
```

---

### `value`와 file input 처리

`value`는 DOM property와 attribute를 함께 갱신한다. 다만 file input에는 브라우저 보안 규칙상 사용자 값을 property로 쓸 수 없으므로 attribute만 제거하고 property에는 쓰지 않는다.

file input 여부는 이번 props가 own `type` key를 가지면 그 값을, 아니면 현재 DOM의 `type`을 사용해 판정한다. tag와 type을 문자열로 바꾸어 소문자로 비교하므로 `file`, `FILE`, `File`은 모두 같은 결과다. 이 판정을 `value` 처리 전에 한 번 계산하므로 `{ value, type: 'file' }`의 key 순서와도 무관하다.

```javascript
const tag = String(domNode.tagName).toLowerCase();
const type = Object.prototype.hasOwnProperty.call(props, 'type')
  ? props.type
  : domNode.type;
const isFileInput = tag === 'input' && String(type).toLowerCase() === 'file';
```

text input이 file input으로 바뀌는 경우에도 이전 `value` attribute를 제거한다.

---

### ARIA attribute 처리

`aria-*`는 일반 HTML boolean property가 아니라 문자열 attribute다.

```javascript
if (key.startsWith('aria-')) {
  if (newValue === undefined || newValue === null) {
    domNode.removeAttribute(key);
  } else if (typeof newValue === 'boolean') {
    domNode.setAttribute(key, String(newValue));
  } else {
    domNode.setAttribute(key, newValue);
  }
}
```

따라서 `aria-hidden={true}`는 `aria-hidden="true"`, `aria-hidden={false}`는 `aria-hidden="false"`가 된다. null이나 undefined일 때만 attribute를 제거한다.

---

### HTML boolean 속성 처리

```javascript
if (typeof newValue === 'boolean') {
  domNode[key] = newValue;          // JavaScript 프로퍼티 설정
  if (newValue) domNode.setAttribute(key, '');   // HTML attribute 추가
  else domNode.removeAttribute(key);             // HTML attribute 제거
}
```

`aria-*`가 아닌 `disabled`, `checked`, `readOnly` 같은 boolean 속성은 **프로퍼티와 attribute 양쪽에 모두 반영**해야 올바르게 동작한다.

---

### attribute 제거

```javascript
if (newValue === undefined || newValue === null) {
  if (typeof oldValue === 'boolean' || typeof domNode[key] === 'boolean') {
    domNode[key] = false;
  }
  domNode.removeAttribute(key);
}
```

새 props에 해당 key가 없거나 값이 `null`이면, DOM에서 해당 attribute를 제거한다. 기존 값이 boolean prop이었다면 DOM property도 `false`로 되돌려야 브라우저 내부 상태가 남지 않는다.

---

## `syncHostControlledProps(state, node)`

`<input>`, `<select>`, `<textarea>`의 `value`/`checked`를 DOM property와 동기화한다.

이 함수가 필요한 이유:

1. `<select>`는 `<option>` children이 모두 렌더된 뒤에야 `value`를 설정할 수 있다.
2. `<input type="file">`의 `value`는 보안상 DOM property에 직접 쓸 수 없다.

`updateDomProps()`도 같은 규칙을 따른다. children을 처리한 뒤 controlled property를 다시 맞추는 경로에서도 같은 대소문자 무관 판정을 사용하며, file input의 `value` property에는 값을 쓰지 않는다.

사용자가 input 값을 직접 바꿔도 같은 props로 다음 reconcile하면 **controlled 값으로 복구**된다.

---

## Host Node의 Mount/Update 순서

### Mount

```
1. createDomNode(vnode)        → DOM 요소 생성
2. parentDom에 삽입
3. props snapshot 저장
4. children reconcile
5. controlled props 동기화
```

### Update

```
1. updateDomProps()            ← props diff (children보다 먼저)
2. vnode/key/tag 갱신
3. props snapshot 저장
4. children reconcile
5. controlled props 동기화     ← children 뒤에
```

**순서가 중요:** props diff가 children보다 먼저지만, controlled value의 최종 동기화는 option children mount 후에.

---

## `updateProps(target, newProps)`

Babel 플러그인이 변환한 렌더 함수 내부에서 호출되는 유틸리티로, **컴파일러가 만든 props 저장 객체의 내용을 업데이트**한다.

### 코드

```javascript
updateProps(target, newProps) {
  for (const key in target) delete target[key];  // 기존 속성 전부 삭제
  if (newProps) Object.assign(target, newProps);  // 새 속성 복사
}
```

### 왜 delete 후 assign인가

컴포넌트 setup에서 컴파일러가 만든 props 저장 객체는 클로저에 의해 참조가 유지된다. 새 객체를 만들면 클로저의 참조가 끊어지므로, **같은 객체를 유지하면서 내용만 교체**해야 한다.

delete-then-assign 방식은 `Object.keys` 비교 등 더 정교한 방법보다 단순하다. 초기 코드 복잡성을 피하기 위한 설계이다.

---

## 이전 모듈과의 분리

이전에는 이 함수들이 `reconciler.js`에 직접 포함되어 있었다. 분리 후:

- reconciler는 "무엇을 바꾸는가"만 결정한다.
- dom-host는 "DOM에 어떻게 쓰는가"를 담당한다.
- controlled props 동기화 로직이 한곳에 모여 있다.

---

## 관련 코드 위치

- `createDomNode`: `packages/core/src/dom-host.js`
- `updateDomProps`: `packages/core/src/dom-host.js`
- `updateProps`: `packages/core/src/dom-host.js`
- `cloneHostPropsSnapshot`: `packages/core/src/dom-host.js`
- `syncHostControlledProps`: `packages/core/src/dom-host.js`

## 관련 문서

- Reconciliation 전체 흐름: [03. Reconciliation](03-reconciler.md)
