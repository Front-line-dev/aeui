# DOM 호스트 — `dom-host.js`

## 개요

`dom-host.js`는 실제 브라우저 DOM을 조작하는 함수들을 모은 모듈이다. reconciler가 "무엇을 변경할지" 결정하면, 이 모듈이 "DOM에 어떻게 적용할지"를 처리한다.

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

## `cloneHostPropsSnapshot(state, props)`

host node의 props를 deepClone으로 독립적 스냅샷을 만든다. `children`, `key`, `ref`는 DOM 속성이 아니므로 스냅샷에 포함하지 않는다.

JSX transform이 개발용 metadata로 주입하는 `__self`, `__source`도 스냅샷에서 제외한다. 특히 `__self`는 컴포넌트 인스턴스 노드 전체를 가리킬 수 있으므로 deepClone 대상에 포함되면 인스턴스 트리와 DOM 참조를 따라가며 메모리 폭증을 일으킬 수 있다.

---

## `updateDomProps(state, domNode, props, oldProps)`

DOM 속성 diff를 수행하고 실제 DOM에 반영한다. `children`, `key`, `ref`, `__self`, `__source`는 실제 DOM attribute로 내려보내지 않는다.

---

## `syncHostControlledProps(state, node)`

`<input>`, `<select>`, `<textarea>`의 `value`/`checked`를 DOM property와 동기화한다.

이 함수가 필요한 이유:

1. `<select>`는 `<option>` children이 모두 렌더된 뒤에야 `value`를 설정할 수 있다.
2. `<input type="file">`의 `value`는 보안상 DOM property에 직접 쓸 수 없다.

`updateDomProps()`도 같은 규칙을 따른다. `input`이 이전 렌더의 `type="text"`에서 이번 렌더의 `type="file"`로 바뀌는 경우, props 순서와 무관하게 다음 `type`을 기준으로 file input 여부를 판단하고 `value` attribute를 제거한다. tag와 type을 소문자로 정규화하므로 `file`, `FILE`, `File`은 모두 같은 file input으로 처리한다.

---

## `updateProps(target, newProps)`

컴파일러가 만든 props 저장 객체의 내용을 업데이트한다. 같은 객체를 유지하면서 내용만 교체하는 이유는 setup 클로저가 이 객체의 참조를 들고 있기 때문이다. 생성되는 식별자 이름은 현재 스코프와 충돌하지 않도록 컴파일러가 정하며 공개 API가 아니다.

---

## 이전 모듈과의 분리

이전에는 이 함수들이 `reconciler.js`에 직접 포함되어 있었다. 분리 후:

- reconciler는 "무엇을 바꾸는가"만 결정한다.
- dom-host는 "DOM에 어떻게 쓰는가"를 담당한다.
- controlled props 동기화 로직이 한곳에 모여 있다.

---

## 관련 코드 위치

- `packages/core/src/dom-host.js`
- `packages/core/src/reconciler.js` (mount/update에서 호출)
