# VNode 생성 — `createVNode`, `createElement`, `Fragment`

## 개요

AEUI의 모든 UI는 **VNode(Virtual Node)** 객체로 표현된다.

VNode란, 실제 DOM(브라우저가 화면에 그리는 HTML 요소)을 나타내는 **가벼운 자바스크립트 객체**이다. 실제 DOM을 직접 조작하는 대신, VNode 객체를 비교하여 변경된 부분만 DOM에 반영하는 것이 VDOM(Virtual DOM) 방식의 핵심이다.

사용자가 JSX 코드를 작성하면, Babel 트랜스파일러가 이를 `AEUI.createVNode()` 함수 호출로 변환하고, 이 함수가 VNode 객체를 생성한다.

```
JSX 코드
  ↓ Babel 변환 (빌드 시)
AEUI.createVNode() 호출
  ↓ 런타임 실행
VNode 객체 생성
  ↓ reconcile에서 이전 RuntimeNode과 비교
변경된 부분만 실제 DOM에 반영
```

---

## VNode과 RuntimeNode의 분리

AEUI는 **VNode**과 **RuntimeNode**를 명확히 분리한다.

| 구분 | VNode | RuntimeNode |
|------|-------|-------------|
| 역할 | 입력 명세 (렌더 함수가 반환하는 값) | 실행 상태 (reconcile이 보관하는 객체) |
| 생명주기 | 매 render마다 새로 생성 | old/new 비교 과정에서 재사용 |
| 소유하는 것 | tag, props, children | DOM 참조, lifecycle state, 자식 관계 |

VNode은 `createVNode`이 매번 새로 만드는 가벼운 객체이고, RuntimeNode는 `reconcile`이 VNode을 기반으로 생성하고 유지하는 실행 중 객체이다. RuntimeNode의 상세 구조는 `instance.md`를 참조한다.

---

## VNode 구조

`createVNode`이 반환하는 객체의 형태:

```javascript
{
  tag: "div",
  props: {
    id: "test",
    children: ["hello"]
  },
  children: ["hello"]
}
```

실제 객체에는 위의 enumerable 필드 외에 AEUI 내부용 non-enumerable `Symbol` marker가 함께 붙는다. 이 marker는 `_deepEqual`, `_deepClone`이 일반 사용자 데이터와 VNode를 구분하기 위한 내부 식별자이며, `Object.keys(vnode)`나 일반 직렬화 결과에는 나타나지 않는다.

각 필드의 의미:

| 필드 | 타입 | 설명 |
|------|------|------|
| `tag` | `string` 또는 `Function` | HTML 태그 이름(예: `"div"`, `"p"`)이면 DOM 요소를, 함수이면 AEUI 컴포넌트를 나타낸다 |
| `props` | `Object` | JSX에서 전달된 모든 속성(attribute)을 담는 객체. 예를 들어 `<div id="test">`에서 `id: "test"`가 props에 저장된다. `children`도 여기에 포함된다 |
| `children` | `Array` | 이 요소의 자식 요소들. 텍스트(`"hello"`), 숫자(`42`), 다른 VNode 객체 등이 올 수 있다 |

### `children`이 `props`와 최상위 필드에 동시에 존재하는 이유

`children`은 두 군데에 저장된다:
- `props.children`: 컴포넌트 함수에서 `props.children`으로 자식에 접근할 수 있도록 하기 위함 (React의 관례와 동일)
- `vnode.children`: `reconcile`에서 자식을 순회할 때 빠르게 접근하기 위한 단축 참조

두 값은 **같은 배열 참조**를 가리키므로 메모리 낭비는 없다.

### `key`의 위치

`key`는 `props` 안에 그대로 남아 있으며, 컴포넌트에서는 `props.key`로 읽을 수 있다. 다만 `updateDomProps`에서 `key`를 건너뛰므로 DOM attribute로는 렌더되지 않는다. reconcile 중 형제 노드 매칭에 사용된다.

---

## `createVNode(tag, props, ...children)`

### 파라미터

| 파라미터 | 설명 |
|----------|------|
| `tag` | HTML 태그 문자열(`"div"`) 또는 컴포넌트 함수(`Counter`) |
| `props` | JSX 속성 객체. `<div id="test">`이면 `{ id: "test" }`. 속성이 없으면 `null` |
| `...children` | 나머지 인자로 전달되는 자식 요소들 |

### 동작 과정

```javascript
createVNode(tag, props, ...children) {
  // 1. children 평탄화 및 필터링
  const validChildren = children.flat().filter(c => c != null && typeof c !== 'boolean');
  
  // 2. props가 null이면 빈 객체로 대체
  const finalProps = props || {};
  
  // 3. children을 props에도 저장
  finalProps.children = validChildren;
  
  // 4. VNode 객체 생성
  const vnode = { tag, props: finalProps, children: validChildren };

  // 5. 내부 VNode marker를 non-enumerable Symbol로 부여
  Object.defineProperty(vnode, VNODE_MARKER, {
    value: true,
    enumerable: false,
  });

  // 6. VNode 객체 반환
  return vnode;
}
```

### 1단계: children 평탄화 (flat)

JSX에서 `{items.map(i => <span>{i}</span>)}`와 같은 배열 표현식을 사용하면, children 인자에 **배열이 중첩**되어 전달된다.

```javascript
// JSX
<ul>
  <li>고정 항목</li>
  {items.map(i => <li>{i}</li>)}
</ul>

// Babel이 변환한 코드
AEUI.createVNode("ul", null,
  AEUI.createVNode("li", null, "고정 항목"),
  items.map(i => AEUI.createVNode("li", null, i))   // ← 이것은 배열
)

// children 인자에 실제로 전달되는 값:
// ["고정 항목" VNode, [아이템1 VNode, 아이템2 VNode, ...]]
//                      ↑ 중첩 배열
```

`.flat()`을 호출하면 1단계 중첩이 풀려서 `reconcile`이 단일 배열로 순회할 수 있게 된다:

```
flat 전: [VNode, [VNode, VNode]]
flat 후: [VNode, VNode, VNode]
```

### 2단계: null, undefined, boolean 필터링

```javascript
.filter(c => c != null && typeof c !== 'boolean')
```

| 제거되는 값 | 제거 이유 |
|------------|-----------|
| `null`, `undefined` | 아무것도 렌더링하지 않아야 하는 빈 자리 |
| `true`, `false` | 조건부 렌더링 패턴 지원을 위함 |

조건부 렌더링에서 boolean이 제거되어야 하는 이유:

```jsx
// JSX
<div>
  {isLoggedIn && <UserProfile />}
</div>

// isLoggedIn이 false일 때, 위 표현식의 결과는 자바스크립트의 && 연산자에 의해 false가 된다
// → false가 children에 포함되면 화면에 "false"라는 텍스트가 출력됨
// → filter로 boolean을 제거하여 이 문제를 방지
```

### 3단계: props 기본값

```javascript
const finalProps = props || {};
```

JSX에서 속성이 없는 요소(`<div>내용</div>`)의 경우 Babel이 props를 `null`로 전달한다. 이를 빈 객체 `{}`로 변환하여, 이후 코드에서 `props.children`에 안전하게 접근할 수 있게 한다.

---

### JSX → createVNode 변환 예시

```jsx
// 사용자가 작성하는 JSX 코드
<div className="box">
  <p>Hello</p>
  {items.map(i => <span>{i}</span>)}
</div>

// Babel 트랜스파일러가 변환한 코드
AEUI.createVNode("div", { className: "box" },
  AEUI.createVNode("p", null, "Hello"),
  items.map(i => AEUI.createVNode("span", null, i))
)

// 실행 결과 생성되는 VNode 객체 (items = ["A", "B"]일 때)
{
  tag: "div",
  props: {
    className: "box",
    children: [
      { tag: "p", props: { children: ["Hello"] }, children: ["Hello"] },
      { tag: "span", props: { children: ["A"] }, children: ["A"] },
      { tag: "span", props: { children: ["B"] }, children: ["B"] }
    ]
  },
  children: [ /* props.children과 같은 배열 참조 */ ]
}
```

---

## `createElement`

```javascript
AEUI.createElement = AEUI.createVNode;
```

`createElement`는 `createVNode`의 **alias(별칭)**이다. 동일한 함수를 가리킨다.

Vite의 JSX 설정에서 `jsxFactory`를 `'AEUI.createElement'` 또는 `'AEUI.createVNode'` 어느 쪽으로 지정해도 동작하도록 하기 위해 존재한다. React에서 `React.createElement`를 사용하는 관례에 맞춘 것이다.

---

## `Fragment`

```javascript
AEUI.Fragment = (initialProps) => (props) => props.children;
```

Fragment는 **래핑 DOM 요소 없이** 여러 자식을 반환할 수 있게 하는 특수 컴포넌트이다.

### 왜 필요한가

JSX에서 컴포넌트는 하나의 루트 요소만 반환할 수 있다. 여러 형제 요소를 반환하려면 `<div>`로 감싸야 하는데, DOM에 불필요한 래핑 요소가 추가된다.

```jsx
// ❌ 불필요한 <div> 래핑
function List() {
  return (
    <div>        {/* ← 이 div는 의미 없음 */}
      <p>A</p>
      <p>B</p>
    </div>
  );
}

// ✅ Fragment로 래핑 없이 반환
function List() {
  return (
    <>
      <p>A</p>
      <p>B</p>
    </>
  );
}
```

### 런타임 내부에서의 처리

사용자 API로서 `AEUI.Fragment`는 함수이지만, 런타임 내부에서는 `AEUI.Fragment` VNode과 배열 반환을 모두 **fragment RuntimeNode**로 해석한다. 즉 "컴포넌트처럼 보이는 public API"와 "fragment node로 실행되는 internal model"이 분리되어 있다.

이 덕분에 아래 두 형태는 런타임에서 같은 의미를 가진다:

```jsx
<>
  <p>A</p>
  <p>B</p>
</>
```

```jsx
{items.map(item => <li>{item}</li>)}
```

둘 다 DOM-less child group을 생성하며, sibling diff는 fragment node의 `children` 기준으로 수행된다.

### Fragment 감지 로직

Fragment 판별 규칙은 `vnode-helpers.js`의 `isFragmentVNode()`와 `reconciler.js`의 `isSameNodeType()`가 공유한다:

```javascript
function isFragmentVNode(AEUI, vnode) {
  return Array.isArray(vnode) || (vnode && typeof vnode === 'object' && vnode.tag === AEUI.Fragment);
}
```

배열이거나 tag가 `AEUI.Fragment`인 VNode이면 fragment로 처리한다. `node-factory.js`와 `reconciler.js`가 이 helper를 함께 사용하므로, fragment 규칙이 한곳에 모여 있다.

### 주의사항: Babel 플러그인과의 관계

Fragment는 함수이지만, Babel 플러그인이 이를 일반 컴포넌트로 인식하여 `return () => children` 형태로 변환하면 안 된다. 이를 방지하기 위해 `vite.config.js`에서 `jsxFragmentFactory`를 별도로 설정하여, Babel이 Fragment를 일반 함수 호출이 아닌 Fragment 전용 처리를 하도록 해야 한다.

---

## 관련 코드 위치

- `createVNode`: `packages/core/src/core.js`
- `createElement` alias: `packages/core/src/core.js`
- `Fragment`: `packages/core/src/core.js`
- `isFragmentVNode`: `packages/core/src/vnode-helpers.js`
