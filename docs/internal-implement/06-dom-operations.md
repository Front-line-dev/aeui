# 06. DOM 연산

이 문서는 AEUI의 DOM props 적용, 이벤트 프록시 패턴, controlled input 동기화의 내부 구현을 설명한다.

---

## 관련 모듈

| 모듈 | 역할 |
|---|---|
| `dom-host.js` | DOM 생성, prop diff, controlled 동기화 |
| `reconciler.js` | mount/update에서 dom-host 호출 |

---

## updateDomProps — Props Diff

이전/새 props의 모든 key를 합쳐 순회하며, `deepEqual`로 변화를 감지한다.

### skip하는 key

`children`, `key`, `ref`, `__self`, `__source`

### 적용 규칙

| 조건 | 동작 |
|---|---|
| `key.startsWith('on')` | 이벤트 핸들러 처리 |
| `className` | `domNode.className = value ?? ''` |
| `style` (객체) | `cssText=''` 후 `Object.assign(style, value)` |
| `style` (문자열) | `domNode.style.cssText = value` |
| `value` | file input 특례 또는 property+attribute 동기화 |
| `aria-*` | boolean → 문자열 attribute, nullish → 제거 |
| boolean 값 | DOM property + true=빈 attribute / false=제거 |
| null/undefined | attribute 제거 (boolean property도 false) |
| 나머지 | `setAttribute(key, value)` |

### class와 style 상세

- `className`은 DOM property로 직접 설정. `class`를 쓰면 일반 attribute로 처리 (별도 변환 없음)
- 객체 style은 `cssText` 비운 후 assign → 빠진 style도 제거
- null style은 attribute 제거 branch

---

## 이벤트 프록시 패턴

`key.startsWith('on')` → 이벤트 prop. 이벤트 이름은 앞 두 글자 제거 + 소문자:

| 예시 | 이벤트 이름 |
|---|---|
| `onClick` | `click` |
| `onInput` | `input` |

### 프록시 구조

```js
domNode._aeuiHandlers[eventName]       // 최신 사용자 함수
domNode._aeuiProxyListeners[eventName] // 고정 proxy listener
```

**핵심:** 인라인 함수가 매 렌더마다 새로 만들어져도 실제 DOM listener는 **한 번만** 등록한다. proxy가 저장소의 **최신 핸들러**를 조회해 호출하기 때문이다.

```
새 값이 함수 → 핸들러 저장소 교체 (proxy 유지)
새 값이 함수 아님 → removeEventListener + 저장소 삭제
```

handler의 `this`는 DOM node.

> **이벤트 핸들러 변경은 `didMutate`를 true로 만들지 않는다.** DOM write가 아니므로 polling backoff에 영향을 주지 않는다.

---

## Controlled Input

### updateDomProps의 value 처리

- `type="file"` (대소문자 무시): value **attribute만** 제거, property에 쓰지 않음 (보안)
- 그 외: nullish → `''`, 아니면 `String(value)` → `domNode.value` + attribute 동기화

### syncHostControlledProps — children 뒤에 실행

```
input/textarea/select의 value → props 값으로 복구
input의 checked → props 값으로 복구
```

**왜 children 뒤에?** `<select>`의 value는 `<option>` children이 mount된 후에야 올바르게 설정할 수 있기 때문이다.

file input은 controlled sync를 건너뛴다.

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

## Props Snapshot

이전 props를 `deepClone`으로 저장해두므로, **같은 style 객체를 직접 수정해도** 다음 렌더에서 변경이 감지된다.

---

## 관련 문서

- Reconciliation 전체 흐름: [02. VDOM과 Diffing](02-vdom-and-diffing.md)
