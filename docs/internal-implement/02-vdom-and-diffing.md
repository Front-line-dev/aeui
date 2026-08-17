# 02. VDOM과 Diffing

이 문서는 AEUI의 Virtual DOM(VNode)과 Reconciliation 알고리즘의 내부 구현을 설명한다.

---

## 관련 모듈

| 모듈 | 역할 |
|---|---|
| `vnode-marker.js` | VNode 식별용 전역 Symbol |
| `vnode-helpers.js` | key 추출, Fragment 판별 |
| `node-factory.js` | VNode → RuntimeNode 분류/생성 |
| `reconciler.js` | 노드 비교, mount/update/unmount, children diff |
| `dom-host.js` | DOM 생성, props diff |

---

## VNode 구조

VNode은 실제 DOM이 아니라 **화면의 설계도**이다. JSX가 Babel에 의해 `AEUI.createElement()` 호출로 변환되면 이 함수가 VNode 객체를 반환한다.

```js
{
  tag,                 // 문자열('div'), 함수(컴포넌트), Fragment
  props: { ... },      // 항상 새 객체 (원본 props 비변이)
  children: [ ... ],   // 정규화된 자식 배열
  [VNODE_MARKER]: true  // 비열거 속성
}
```

### VNODE_MARKER

```js
export const VNODE_MARKER = Symbol.for('aeui.vnode');
```

`Object.defineProperty`로 `enumerable: false`로 설정되어 `Object.keys()`에 나타나지 않는다. VNode 판별은 `{ tag, props, children }` 구조가 아니라 **이 마커의 존재 여부**로만 수행한다.

### createVNode 알고리즘

```js
function createVNode(tag, props, ...children) {
  const validChildren = children
    .flat()             // 1단계만 평탄화
    .filter(child => child != null && typeof child !== 'boolean');
  
  const finalProps = { ...(props || {}), children: validChildren };
  const vnode = { tag, props: finalProps, children: validChildren };
  
  Object.defineProperty(vnode, VNODE_MARKER, {
    value: true, enumerable: false,
  });
  
  return vnode;
}
```

**핵심 규칙:**
- `props.children`과 `vnode.children`은 **같은 배열 참조**
- 호출자의 props 객체는 **변경하지 않음** (얕은 복사)
- null, undefined, boolean 자식은 제거 (`{조건 && <Comp />}` 패턴 지원)

---

## createNode — VNode에서 RuntimeNode로

`createNode(state, vnode, parentNode, parentDom)`는 렌더 결과를 다음 규칙으로 **분류만** 한다 (컴포넌트 함수를 호출하지는 않음):

| 입력 | RuntimeNode kind |
|---|---|
| `null` 또는 boolean | → `null` (표시 안 함) |
| 비객체 (문자열, 숫자, bigint) | → `text` |
| 배열 또는 Fragment VNode | → `fragment` |
| `tag`가 문자열인 객체 | → `host` (HTML 요소) |
| 그 외 객체 | → `component` |

text는 `String(vnode)`으로 즉시 변환한다. 엄격한 VNode 검증은 하지 않으므로, 마커 없는 `{ tag: 'div', props: {} }`도 host로 처리된다.

---

## Reconciliation — 이전 화면과 새 화면 비교

### 전체 흐름

```
reconcile(state, parentDom, oldNode, newVNode, beforeDom, parentNode)
  
  1. 새 값이 null/boolean? → oldNode unmount → null 반환
  2. oldNode 있는데 타입이 다르면? → oldNode unmount → oldNode = null
  3. oldNode 없음? → 새 RuntimeNode 생성 → kind별 mount
  4. oldNode 있음? → kind별 update
```

### 노드 identity 판정 — "같은 노드인가?"

모든 kind에서 **key가 다르면 다른 노드**로 판정. key가 같을 때:

| 이전 kind | 같은 타입 조건 |
|---|---|
| `text` | 새 값이 비객체 |
| `fragment` | 새 값이 배열이거나 Fragment VNode |
| `host` | `oldNode.tag === newVNode.tag` |
| `component` | `oldNode.component === newVNode.tag` (같은 함수 참조) |

**props는 identity에 관여하지 않는다.** 같은 tag/component + 같은 key면 RuntimeNode를 재사용하고 props만 갱신한다.

---

## DOM Range

모든 non-empty RuntimeNode는 `firstDom`~`lastDom`으로 parent DOM의 연속된 직접 자식 범위를 나타낸다.

| kind | DOM range |
|---|---|
| text | TextNode 1개 |
| host | Element 1개 |
| fragment | 첫 child.firstDom ~ 마지막 child.lastDom |
| component | 렌더된 subtree의 range |

### placeNode — 위치 이동

```
1. range가 비면 → 아무것도 안 함
2. range 끝의 nextSibling === beforeDom → 이미 올바른 위치
3. 아니면 → range의 각 DOM을 parentDom.insertBefore(dom, beforeDom)
```

이미 올바른 순서면 `insertBefore`를 호출하지 않는다 (불필요한 DOM 조작 방지).

---

## Children Diff

`reconcileChildren`은 형제 노드의 비교와 재배치를 담당한다.

### 1. 인덱싱

```
각 old child에 _matched = false 설정
key 있는 child → Map에 저장 (중복 key 경고)
```

### 2. 매칭

```
keyed 새 값 → Map에서 같은 key의 old child 찾기
unkeyed 새 값 → old children에서 순서대로 미매칭 unkeyed child 찾기
```

**핵심:** keyed child는 위치 무관하게 key로 찾고, unkeyed child는 순차적으로 매칭한다.

### 3. 제거와 재배치

1. 매칭 안 된 old child를 unmount
2. `_matched` property 삭제
3. `nextChildren`을 **오른쪽에서 왼쪽**으로 순회하며 `placeNode`
4. `parentNode.children = nextChildren`

**오른쪽→왼쪽 배치 이유:** 각 child를 `anchor`(다음 child의 firstDom) 앞에 배치하면, keyed reorder 시 DOM node와 component state가 보존된다.

---

## 실패한 Mount의 DOM 정리

### Host mount 실패

DOM 요소 삽입 후 children reconcile에서 throw하면:
- node를 unmount (DOM 제거 없이)
- host DOM이 parent 자식이면 `removeChild`
- `node.dom/firstDom/lastDom = null`
- 원래 오류 rethrow

### Fragment mount 실패

mount 전 sibling 위치를 기억해두고, 실패 시 새로 삽입된 DOM을 제거한다.

---

## 관련 문서

- DOM props 적용: [06. DOM 연산](06-dom-operations.md)
