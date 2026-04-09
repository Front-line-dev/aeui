# Level 2 — AEUI 핵심 원리

> 이 문서는 AEUI가 내부적으로 **어떤 원리로 동작하는지** 설명한다. Level 1의 기본 사용법을 이해한 후 읽는다.

---

## AEUI의 두 가지 핵심 원리

AEUI의 모든 기능은 두 가지 핵심 원리의 조합이다:

1. **Babel 코드 변환**: 사용자 코드를 AEUI 런타임이 이해할 수 있는 형태로 변환
2. **VDOM Polling**: 가상 DOM을 주기적으로 비교하여 변경사항만 실제 DOM에 반영

---

## 1. Babel 코드 변환

사용자가 작성한 JSX 코드는 브라우저가 직접 이해하지 못한다. Babel이 두 단계의 변환을 수행한다.

### 1-1. JSX → createVNode

모든 JSX 태그는 `AEUI.createVNode()` 함수 호출로 변환된다.

```jsx
// 사용자 코드
<div className="box">
  <p>안녕하세요</p>
</div>

// 변환 결과
AEUI.createVNode("div", { className: "box" },
  AEUI.createVNode("p", null, "안녕하세요")
)
```

`createVNode`은 VNode(Virtual Node)라는 가벼운 JavaScript 객체를 반환한다. 이 객체가 실제 DOM 대신 사용되어 비교(diffing)에 활용된다.

### 1-2. 컴포넌트 함수 변환

AEUI의 핵심 변환이다. 컴포넌트 함수의 `return`문이 **팩토리 함수**로 감싸진다.

```jsx
// 사용자 코드
function Counter() {
  let count = 0;
  return <p>{count}</p>;
}

// Babel 변환 후
function Counter() {
  let count = 0;                    // ← setup: 1회 실행
  return (_newProps) => {            // ← 렌더 함수: 매 tick마다 실행
    return AEUI.createVNode("p", null, count);
  };
}
```

> 참고: 사용자는 React처럼 **JSX를 그대로 `return`** 하면 된다. `return () => ...` 같은 팩토리 형태는 **Babel 플러그인이 자동으로 변환한 결과**이며, 직접 작성할 필요가 없다.

이 변환의 결과:
- `let count = 0`은 **한 번만** 실행된다 (setup)
- `return AEUI.createVNode(...)` 부분은 **매 tick마다** 실행된다 (render)
- JavaScript **클로저** 덕분에 렌더 함수가 `count` 변수를 참조할 수 있다

버튼 클릭으로 `count++`를 실행하면 `count` 변수의 값이 변경되고, 다음 tick에서 렌더 함수가 다시 실행될 때 새 `count` 값이 VNode에 반영된다.

### 1-3. watch deps 변환

`watch`의 의존성 배열도 함수로 감싸진다.

```jsx
// 사용자 코드
watch([count], () => console.log(count));

// 변환 후
watch(() => [count], () => console.log(count));
```

배열 `[count]`는 작성 시점에 한 번 평가되면 고정되지만, 함수 `() => [count]`는 호출될 때마다 **현재** `count` 값을 읽어 새 배열을 생성한다.

---

## 2. Virtual DOM (VDOM)

### VDOM이란

VDOM은 실제 DOM의 **가벼운 JavaScript 객체 표현**이다.

```javascript
// 실제 DOM (브라우저가 관리, 무거움)
const dom = document.createElement('div');
dom.className = 'box';
dom.appendChild(document.createTextNode('안녕'));

// VNode (JavaScript 객체, 가벼움)
const vnode = {
  tag: 'div',
  props: { className: 'box' },
  children: ['안녕']
};
```

실제 DOM 조작은 비용이 크다 (브라우저의 레이아웃 재계산, 리페인트 유발). VNode 객체 비교는 단순한 JavaScript 객체 비교이므로 훨씬 빠르다.

### Diffing (차이점 비교)

매 tick마다:
1. 렌더 함수가 **새 VNode 트리**를 생성
2. 이전 tick에서 저장된 **이전 VNode 트리**와 비교
3. **차이점만** 실제 DOM에 반영

```
tick 1: VNode = { tag: "p", children: ["카운트: 0"] }
         → DOM: <p>카운트: 0</p>

(사용자가 count++ 실행)

tick 2: VNode = { tag: "p", children: ["카운트: 1"] }
         → 이전 VNode과 비교
         → children[0]만 다름: "카운트: 0" → "카운트: 1"
         → DOM에서 텍스트 노드의 값만 변경 (전체 재생성 X)
```

---

## 3. Tick 루프 (Polling)

### 동작 흐름

```
AEUI.init(App, container)
  ├── 최초 tick 즉시 실행 → 화면에 첫 렌더링
  └── requestAnimationFrame 기반 scheduler 시작
      (변화가 있으면 빠르게, 없으면 프레임 간격 점진 증가)

각 tick에서:
  1. watcher 의존성 체크 → 변경된 watcher의 callback 실행
  2. 렌더 함수 실행 → 새 VNode 생성
  3. 이전 VNode과 비교 (diffing)
  4. 변경된 부분만 실제 DOM에 반영
```

### why Polling?

AEUI가 `let` 변수의 직접 수정을 감지하기 위해 Polling을 사용한다. JavaScript에는 "변수가 변경되었을 때 알림을 받는" 기능이 없으므로, 주기적으로 현재 값을 이전 값과 비교하는 방식이 유일하다.

이 방식의 자연스러운 결과:
- `count++`, `items.push()` 등 일반 JavaScript 코드가 그대로 동작
- 비동기 변경은 여전히 **다음 polling tick**에서 화면에 반영된다.
- AEUI가 소유한 DOM 이벤트 안의 동기 변경은 `requestRender()` fast path로 다음 프레임 렌더를 앞당길 수 있다.

---

## 4. 전체 플로우 정리

사용자가 버튼을 클릭했을 때의 전체 흐름:

```
1. 사용자 "증가" 버튼 클릭
   └→ onClick 핸들러 실행: count++
   └→ count가 0에서 1로 변경됨 (메모리상 변수만 변경, 화면은 아직 그대로)

2. AEUI DOM 이벤트 경로
   └→ proxy listener가 이벤트 종료 후 requestRender() 예약
   └→ 다음 animation frame에서 render phase 시작
      └→ AEUI.__runtime.runRenderPhase(...)
      └→ watcher 의존성 체크
      └→ [count]의 현재값 [1]과 이전 스냅샷 [0] 비교 → 변경 감지
      └→ watcher callback 실행 (있는 경우)
      └→ callback 이후 최종 deps를 oldDeps로 저장
      └→ AEUI.createVNode("p", null, count)
      └→ count가 1이므로 VNode = { tag: "p", children: [1] }

3. reconcile (diffing)
   └→ 이전 VNode: { tag: "p", children: [0] }
   └→ 새 VNode:   { tag: "p", children: [1] }
   └→ children[0]이 다름: 0 → 1
   └→ 텍스트 노드의 nodeValue를 "1"로 변경

4. 화면에 "카운트: 1"이 표시됨
```

---

## 다음 단계

내부 구현의 세부 사항(reconciliation 알고리즘, 인스턴스 관리, DOM 조작 등)은 **Level 3**에서 다룬다.
