# Level 3 — AEUI 내부 구조

> 이 문서는 AEUI 내부 수정자를 위한 요약 가이드다. 현재 코어는 VNode 입력과 RuntimeNode 실행 상태를 분리한 구조를 사용한다.

## 코드 구조

```
packages/core/src/
├── core.js            AEUI 객체 조립
├── deep-compare.js    깊은 비교/복사 유틸리티
├── reconciler.js      RuntimeNode 기반 reconcile / DOM 이동 / unmount
├── runtime.js         root node, node 생성, scheduler, watcher 실행
├── hooks.js           watch, clean 훅
├── babel-plugin.js    Babel 변환 플러그인
└── index.js           re-export
```

## 핵심 모델

- `createVNode()`는 입력 명세만 만든다
- 런타임은 `text | host | component | fragment` RuntimeNode 트리를 유지한다
- 각 node는 `firstDom/lastDom`로 실제 DOM 범위를 추적한다
- hook state는 component node에만 존재한다

## 렌더 흐름

```
AEUI.init()
  └── root wrapper 생성
  └── _tick()
      └── _reconcileRoot()
          └── createVNode(RootComponent)
          └── _reconcile(container, oldRootChild, newRootVNode, null, rootNode)
```

컴포넌트 node는 setup 시 render 함수를 만들고, 이후 tick마다:

1. watcher 실행
2. `render(props)` 호출
3. `renderedNode` subtree와 diff

순서로 갱신된다.

## Reconciliation

- `text`: text node 재사용/교체
- `host`: DOM 재사용 + props update + child diff
- `component`: 같은 함수+key면 재사용, 아니면 교체
- `fragment`: DOM 없이 child group만 diff

형제 diff는 node 기준이며, `key`가 있으면 key 우선, 없으면 순서 fallback이다.

## 문서 인덱스

- [vdom.md](../internals/core/vdom.md)
- [instance.md](../internals/core/instance.md)
- [scheduler.md](../internals/core/scheduler.md)
- [reconciler.md](../internals/core/reconciler.md)
- [dom.md](../internals/core/dom.md)
- [unmount.md](../internals/core/unmount.md)
