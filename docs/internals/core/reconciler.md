# Reconciliation

## 개요

AEUI의 `_reconcile(parentDom, oldNode, newVNode, beforeDom, parentNode)`는 이전 RuntimeNode와 새 VNode를 비교해 node 트리와 실제 DOM을 함께 갱신한다. 핵심 비교 단위는 더 이상 `prevVNode + index`가 아니라 **old RuntimeNode + new VNode**다.

## 핵심 규칙

1. `newVNode`가 `null`/`boolean`이면 old node를 unmount하고 제거한다.
2. old node와 new VNode의 `kind + key + tag/component`가 호환되면 재사용한다.
3. 호환되지 않으면 old node를 unmount하고 새 node를 mount한다.
4. child diff는 항상 RuntimeNode 배열 기준으로 수행한다.

## Node별 처리

### text

- 기존 text node면 `nodeValue`만 갱신
- 아니면 새 TextNode 생성 후 삽입

### host

- 같은 태그면 기존 DOM 요소 재사용
- `_updateDomProps`로 props 갱신
- 자식은 `node.children` 기준으로 다시 diff

### component

- 같은 함수 + 같은 key면 node 재사용
- `props` 갱신 후 watcher 실행
- `render(props)`의 결과를 `renderedNode` subtree와 비교
- `firstDom/lastDom`는 `renderedNode` 범위를 따른다

### fragment

- DOM 요소 없이 child list만 소유
- 배열 반환과 `AEUI.Fragment` 모두 이 경로를 사용

## Child Diff

형제 diff는 node 기준으로 통일한다.

- `key`가 있으면 같은 부모의 old child node를 key로 우선 매칭
- `key`가 없으면 남은 old child를 순서 fallback
- duplicate key는 warning 후 first-match best-effort

새 child list가 결정되면, DOM 재배치는 오른쪽에서 왼쪽으로 `firstDom..lastDom` 범위를 `beforeDom` anchor 앞으로 이동시키며 정렬한다.

## `beforeDom`

`beforeDom`는 삽입 위치를 나타내는 실제 DOM anchor다.

- `null`이면 부모의 맨 끝에 배치
- 특정 DOM node면 그 노드 바로 앞에 배치

comment anchor는 사용하지 않는다. 빈 fragment나 빈 subtree는 `firstDom = lastDom = null`이며, 다음 sibling의 `firstDom` 또는 부모의 trailing anchor를 기준으로 새 range를 삽입한다.
