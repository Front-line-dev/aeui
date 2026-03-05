# 인스턴스 관리 — `createInstance`, `_currentInstance`

## 개요

AEUI에서 **인스턴스(Instance)**는 하나의 컴포넌트가 화면에 마운트된 후의 **런타임 상태를 담는 객체**이다.

컴포넌트 **함수** 자체는 "이 컴포넌트가 어떻게 동작하는지"를 정의하는 코드일 뿐이고, 인스턴스는 "실제로 화면에 렌더링된 해당 컴포넌트의 현재 상태"를 가지고 있다. 같은 컴포넌트 함수로 여러 개의 인스턴스를 만들 수 있다.

```jsx
// Counter 함수는 1개, 하지만 인스턴스는 2개 생성
<Counter name="A" />   →  인스턴스 1 (count=0, name="A")
<Counter name="B" />   →  인스턴스 2 (count=0, name="B")
```

React의 Fiber Node가 이에 해당한다.

---

## 인스턴스 구조

`createInstance`가 반환하는 객체의 각 필드:

```javascript
{
  vnode,             // 이 인스턴스를 생성한 VNode
  render,            // 컴포넌트의 렌더 함수
  prevRenderedVNode, // 마지막 렌더링 결과
  watchStates,       // 등록된 watcher 목록
  cleanups,          // 등록된 clean 콜백 목록
  props,             // 현재 props
  parent,            // 부모 인스턴스
  children,          // 자식 컴포넌트 인스턴스 배열
  _domNodeCount,     // 이 인스턴스가 차지하는 DOM 노드 수 캐시
  parentElement,     // 이 컴포넌트가 렌더링되는 DOM 부모 요소
  isMounted,         // 마운트 상태
  _childCursor       // reconcile 시 자식 인스턴스 재사용 커서
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `vnode` | `VNode` | 이 인스턴스를 만든 VNode. `vnode.tag`가 컴포넌트 함수이고, `vnode.props`가 전달된 속성이다. 재렌더링 시 새 VNode으로 갱신된다 |
| `render` | `Function` | 컴포넌트의 **렌더 함수**. 컴포넌트 함수(setup)를 실행하면 반환되는 `(_newProps) => { ... JSX ... }` 형태의 함수이다. 매 tick마다 이 함수가 호출되어 새 VNode을 생성한다 |
| `prevRenderedVNode` | `VNode \| null` | 이전 tick에서 `render`가 반환한 결과. 다음 tick에서 새 결과와 비교(diffing)하여 DOM 변경 사항을 결정하는 데 사용된다. 최초 렌더링 전에는 `null` |
| `watchStates` | `Array` | `watch()` 훅으로 등록된 watcher 객체들의 배열. 각 watcher는 `{ callback, getDeps, oldDeps }` 구조를 가진다. 상세한 동작은 `watcher.md` 참조 |
| `cleanups` | `Array` | `clean()` 훅으로 등록된 정리 함수들의 배열. 인스턴스가 언마운트될 때 순서대로 실행된다. 예: `clearInterval`, 이벤트 리스너 해제 등 |
| `props` | `Object` | 현재 이 컴포넌트에 전달된 props. 부모가 새 props를 전달하면 갱신된다 |
| `parent` | `Instance \| null` | 이 인스턴스를 포함하는 부모 컴포넌트의 인스턴스. 루트 컴포넌트는 `null`. 인스턴스 트리의 부모-자식 관계를 형성한다 |
| `children` | `Instance[]` | 이 컴포넌트의 렌더 결과에 포함된 **자식 컴포넌트 인스턴스**들의 배열. DOM 요소 자식이 아닌, 컴포넌트 자식만 포함한다 |
| `_domNodeCount` | `number` | 이 인스턴스의 렌더 결과가 차지하는 DOM 노드 수의 캐시. `_reconcile` 4단계에서 컴포넌트 처리 후 갱신된다. 형제 컴포넌트의 DOM 시작 인덱스 계산(`_getDomNodeCount`)에 사용된다 |
| `parentElement` | `HTMLElement` | 이 컴포넌트의 렌더 결과가 삽입되는 실제 DOM 부모 요소. `_reconcile`에 전달되어 DOM 조작의 기준점이 된다 |
| `isMounted` | `boolean` | `true`면 현재 화면에 마운트되어 있는 상태. `_unmount` 시 `false`로 설정되며, `instance.update()`에서 첫 줄에 이 값을 체크하여 이미 언마운트된 인스턴스의 불필요한 업데이트를 방지한다 |
| `_childCursor` | `number` | `_reconcile`에서 자식 컴포넌트 인스턴스를 순서대로 재사용할 때 사용하는 인덱스 커서. 렌더링 시작 시 `0`으로 초기화되고, 자식 컴포넌트를 만날 때마다 증가한다. 상세 동작은 아래 "자식 인스턴스 재사용" 섹션 참조 |

---

## `createInstance(vnode, parentInstance)`

인스턴스를 생성하고, 컴포넌트의 **setup 코드를 실행**하는 함수이다.

### 파라미터

| 파라미터 | 설명 |
|----------|------|
| `vnode` | `tag`가 컴포넌트 함수인 VNode. 예: `{ tag: Counter, props: { name: "A" } }` |
| `parentInstance` | 부모 컴포넌트의 인스턴스. 루트면 `null` |

### 동작 과정

```
1. 빈 인스턴스 객체 생성 (위 구조의 모든 필드 초기화)
2. AEUI._currentInstance = instance   ← 전역 컨텍스트 설정 (아래 설명)
3. instance.render = vnode.tag(vnode.props)
   └→ 컴포넌트 함수(setup) 실행 — 이 코드는 컴포넌트 생명 동안 딱 1번만 실행됨
   └→ 이 실행 중에 watch(), clean() 등의 훅이 호출되면
      _currentInstance를 통해 이 인스턴스에 등록됨
   └→ 반환값은 렌더 함수((newProps) => VNode)
4. AEUI._currentInstance = null       ← 컨텍스트 해제
5. 인스턴스 반환
```

### 핵심 원리: Setup 1회 실행

AEUI 컴포넌트의 가장 중요한 특성은, **컴포넌트 함수의 본문(setup)이 마운트 시 딱 한 번만 실행**된다는 것이다. 이후에는 setup이 반환한 **렌더 함수**만 반복 실행된다.

이것이 가능한 이유는 Babel 플러그인이 `return (JSX)`를 `return () => (JSX)` 형태로 변환하기 때문이다:

```javascript
// 사용자가 작성한 코드
function Counter() {
  let count = 0;     // ← setup: 1회만 실행

  return (
    <div>{count}</div>  // ← JSX
  );
}

// Babel 변환 후 실제 실행되는 코드
function Counter() {
  let count = 0;     // ← setup: 1회만 실행

  return (_newProps) => {        // ← 이것이 instance.render가 된다
    return AEUI.createVNode("div", null, count);
    // ↑ 이 함수만 매 tick마다 반복 실행됨
    // count는 클로저로 참조되므로, 외부에서 count++ 하면 다음 렌더에서 새 값이 반영됨
  };
}
```

자바스크립트의 **클로저(closure)** 덕분에, setup에서 선언된 `let count = 0`은 렌더 함수가 참조를 유지하고, `count++` 같은 변경이 다음 렌더에서 자동으로 반영된다. React처럼 `useState`를 사용할 필요가 없다.

---

## `_currentInstance` (전역 컨텍스트)

### 역할

`watch()`와 `clean()` 같은 훅 함수는 독립적인 함수이므로, "지금 어떤 컴포넌트의 setup 안에서 호출되고 있는지"를 스스로 알 수 없다. `_currentInstance`는 이 정보를 전해주는 전역 변수이다.

```javascript
// hooks.js
export function watch(callback, depsGetter) {
  const runtime = getRuntimeContext();
  if (!runtime) return;

  const instance = runtime.getCurrentInstance();  // ← "지금 어떤 컴포넌트?"
  if (instance) {
    instance.watchStates.push({ ... });           // ← 그 컴포넌트의 watcher 목록에 등록
  }
}
```

### 설정 시점

| 시점 | 설정되는 값 | 목적 |
|------|-------------|------|
| `createInstance`에서 setup 실행 전 | 새로 생성된 instance | `watch()`, `clean()` 훅이 이 인스턴스에 등록되도록 |
| `_reconcile` 내 Component Node 처리에서 render 실행 전 | 해당 컴포넌트의 instance | 렌더 중 watcher 실행 시 컨텍스트 제공 |
| `instance.update()`에서 render 실행 전 | 해당 instance | 루트 인스턴스 업데이트 시 컨텍스트 제공 |

각 설정 후, 해당 작업이 끝나면 반드시 `_currentInstance = null`로 해제한다.

### 동기적 작동 보장

`_currentInstance`는 전역 변수 하나이므로, 만약 컴포넌트 A의 setup 중에 컴포넌트 B의 setup이 시작되면 A의 컨텍스트가 덮어씌워질 수 있다. 그러나 현재 AEUI의 모든 코드는 **동기적으로 실행**되므로 (비동기 렌더링 없음), 한 컴포넌트의 setup이 완전히 끝난 후에야 다음 컴포넌트의 setup이 시작된다. 따라서 이 문제는 발생하지 않는다.

---

## `instance.update()`

인스턴스에 정의된 메서드로, tick에서 호출되어 컴포넌트를 **재렌더링**한다. 현재는 루트 인스턴스의 `_tick()`에서만 호출되며, 자식 컴포넌트는 `_reconcile` 내부에서 직접 render를 호출한다.

### 동작 과정

```
1. if (!this.isMounted) return;  ← 이미 언마운트된 인스턴스면 중단

2. startIndex 계산:
   부모의 children 배열에서 이 인스턴스보다 앞에 있는 형제들의
   DOM 노드 수를 합산하여, parentElement.childNodes에서의
   이 컴포넌트의 시작 위치를 결정한다
   (DOM은 flat한 childNodes 배열이므로 인덱스 계산 필요)

3. _childCursor = 0  ← 자식 인스턴스 재사용 커서 초기화

4. _currentInstance = this  ← 전역 컨텍스트 설정

5. _runComponentWatchers(this)  ← watcher 의존성 체크 후 콜백 실행
   (watch callback이 상태를 변경할 수 있으므로 render 전에 실행)

6. this.render(this.props)  ← 렌더 함수 호출 → 새 VNode 반환

7. _currentInstance = null  ← 컨텍스트 해제

8. _reconcile(parentElement, newVNode, prevRenderedVNode, startIndex, this)
   → 이전 결과와 비교하여 DOM 업데이트

9. prevRenderedVNode = newVNode  ← 다음 비교를 위해 저장
```

### watcher가 render보다 먼저 실행되는 이유

5번에서 watcher를 먼저 실행하는 이유는, **watch callback이 상태를 변경할 수 있기 때문**이다. watcher가 상태를 변경하면 그 변경이 6번의 render에 즉시 반영되어, 한 tick 안에서 최신 상태를 기반으로 VNode이 생성된다.

만약 render를 먼저 실행하고 watcher를 나중에 실행하면, watch callback의 상태 변경이 다음 tick까지 반영되지 않아 1초의 지연이 발생한다.

---

## `_childCursor` — 자식 인스턴스 재사용

`_reconcile`에서 컴포넌트 VNode을 만날 때, 매번 새 인스턴스를 생성하면 이전 상태가 모두 사라진다. 대신, 기존 인스턴스를 **재사용**하여 상태를 유지한다.

`_childCursor`는 "현재 몇 번째 자식까지 처리했는지"를 추적하는 인덱스이다.

### 동작 예시

```jsx
function Parent() {
  return (
    <div>
      <ChildA />     {/* children[0]과 매칭 시도, cursor 0→1 */}
      <ChildB />     {/* children[1]과 매칭 시도, cursor 1→2 */}
    </div>
  );
}
```

```
tick 시작 → _childCursor = 0

렌더 함수 실행 → JSX에서 <ChildA />, <ChildB /> 순서대로 _reconcile 호출:

  <ChildA /> 처리:
    children[0]이 있고 tag가 ChildA와 같음 → 기존 인스턴스 재사용
    _childCursor++ → 1

  <ChildB /> 처리:
    children[1]이 있고 tag가 ChildB와 같음 → 기존 인스턴스 재사용
    _childCursor++ → 2

렌더 완료 후:
  children.length = 2, _childCursor = 2 → 초과분 없음
```

### 자식이 줄어든 경우

```
이전 렌더: <ChildA />, <ChildB />, <ChildC />  (children 3개)
이번 렌더: <ChildA />, <ChildB />              (children 2개)

→ _childCursor = 2, children.length = 3
→ children[2] (ChildC 인스턴스)를 _unmount하고 배열에서 제거
```

```javascript
// _reconcile 내 코드
if (instance._childCursor < instance.children.length) {
  const removed = instance.children.splice(instance._childCursor);
  removed.forEach(child => this._unmount(child));
}
```

### 같은 위치에 다른 컴포넌트가 올 때

```
이전: <ChildA />    → children[0] = ChildA 인스턴스
이번: <ChildX />    → tag가 다름 (ChildA ≠ ChildX)

→ ChildA 인스턴스를 _unmount
→ ChildX 인스턴스를 새로 createInstance
→ children[0]을 교체
```

인덱스 기반이므로, **같은 위치(인덱스)에 같은 컴포넌트 함수**가 있어야 재사용된다. 컴포넌트 함수가 다르면 이전 상태가 모두 파괴되고 새로 생성된다.

---

## 관련 코드 위치

- `createInstance`: `packages/core/src/runtime.js`
- `instance.update()`: `packages/core/src/runtime.js`
- `_currentInstance` 선언: `packages/core/src/core.js` L22
- `_currentInstance` 참조 (hooks): `packages/core/src/hooks.js` (`runtime.js` 경유)
- runtime bridge: `packages/core/src/runtime.js`
