# Runtime Node Model

## 개요

AEUI의 런타임 상태 단위는 더 이상 "컴포넌트 인스턴스 배열"이 아니라 **RuntimeNode 트리**이다. VNode는 입력 명세이고, RuntimeNode는 실제 DOM 참조, lifecycle state, 자식 관계를 가진 실행 중 객체이다.

## Node 종류

AEUI 내부 node 종류는 4개다.

| kind | 설명 |
|------|------|
| `text` | 문자열/숫자 같은 원시 렌더 결과 |
| `host` | 실제 DOM 요소를 가지는 노드 (`div`, `span` 등) |
| `component` | setup/render/watch/clean state를 가지는 컴포넌트 노드 |
| `fragment` | DOM 요소 없이 여러 자식을 묶는 노드. 배열 반환과 `AEUI.Fragment`를 모두 포함 |

루트 컨테이너는 내부적으로 별도 root wrapper가 children을 소유하지만, 사용자 의미의 node 종류는 위 4개로 본다.

## 공통 필드

모든 RuntimeNode는 최소한 아래 필드를 가진다.

```javascript
{
  kind,
  key,
  vnode,
  parent,
  parentDom,
  children,
  firstDom,
  lastDom,
  isMounted
}
```

- `key`: sibling diff에 사용되는 선택적 식별자
- `vnode`: 이 node를 만든 현재 입력 VNode
- `parent`: 부모 RuntimeNode
- `parentDom`: 이 node의 DOM range가 속한 실제 DOM 부모
- `children`: 자식 RuntimeNode 목록
- `firstDom`, `lastDom`: 이 node가 차지하는 실제 DOM 범위
- `isMounted`: unmount 이후 재사용을 방지하기 위한 상태

## Component Node 추가 필드

컴포넌트 node만 lifecycle state를 가진다.

```javascript
{
  component,     // 컴포넌트 함수
  props,         // 현재 props
  render,        // setup이 반환한 render 함수
  watchStates,   // watch 등록 목록
  cleanups,      // clean 등록 목록
  renderedNode   // render 결과 subtree의 루트 node
}
```

`host`, `text`, `fragment`는 구조 노드일 뿐이며 hook state를 가지지 않는다.

## Hook 컨텍스트

기존 `_currentInstance` 중심 모델 대신, 런타임은 현재 hook이 허용되는 **component node**를 추적한다. `watch()`와 `clean()`은 이 component node의 `watchStates`, `cleanups`에 등록된다.

Babel 플러그인과의 호환을 위해 내부적으로 `_currentInstance` alias를 유지할 수는 있지만, 개념적으로는 "현재 컴포넌트 node"가 정확한 모델이다.

## DOM Ownership

`fragment`와 `component`는 자체 DOM 노드가 없을 수 있으므로, 각 node는 단일 `dom` 대신 `firstDom`/`lastDom` 범위를 가진다.

- `text`: `firstDom === lastDom === TextNode`
- `host`: `firstDom === lastDom === HTMLElement`
- `fragment`: 첫 자식의 `firstDom`부터 마지막 자식의 `lastDom`까지
- `component`: `renderedNode`가 차지하는 범위와 동일

이 구조 덕분에 sibling reorder는 "DOM 개수 계산"이 아니라 node range 이동으로 처리할 수 있다.
