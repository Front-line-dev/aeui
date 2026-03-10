# VNode 와 RuntimeNode

## 개요

AEUI는 **VNode**와 **RuntimeNode**를 분리한다.

- `VNode`: `createVNode`가 만드는 입력 명세
- `RuntimeNode`: reconcile이 실제로 보관하는 실행 상태

VNode는 매 render마다 새로 만들어질 수 있지만, RuntimeNode는 old/new 비교 과정에서 재사용된다.

## `createVNode`

`createVNode(tag, props, ...children)`의 공개 동작은 유지된다.

- `children.flat()`으로 1단계 평탄화
- `null`, `undefined`, `boolean` children 제거
- `props.children`과 `vnode.children`에 같은 배열 참조 저장

`key`도 `props`에 그대로 남아 있으며, component에서는 `props.key`로 읽을 수 있다. DOM attribute로는 렌더되지 않는다.

## Fragment

사용자 API로서 `AEUI.Fragment`는 유지된다.

```javascript
AEUI.Fragment = (initialProps) => (props) => props.children;
```

다만 런타임 내부에서는 `AEUI.Fragment` VNode와 배열 반환을 모두 **fragment RuntimeNode**로 해석한다. 즉 "컴포넌트처럼 보이는 public API"와 "fragment node로 실행되는 internal model"이 분리되어 있다.

이 덕분에 아래 두 형태는 런타임에서 같은 의미를 가진다.

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
