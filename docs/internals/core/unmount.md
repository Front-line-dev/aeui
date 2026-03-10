# Unmount

## 개요

AEUI는 `_unmountNode(node)`로 subtree를 정리한다. 모든 RuntimeNode는 재귀적으로 정리되지만, cleanup/watch state는 component node에만 존재한다.

## 규칙

- 모든 node: `isMounted = false`, 자식 subtree 재귀 정리
- `component`:
  - `cleanups` 등록 순서대로 실행
  - `watchStates = []`
  - `cleanups = []`
  - `renderedNode = null`
- `host/text/fragment`:
  - 구조 정리만 수행
- `removeDom = true`이면 `firstDom..lastDom` 범위를 실제 DOM에서 제거

## DOM 제거

node는 자기 DOM 범위를 `firstDom/lastDom`로 알고 있으므로, unmount 시 DOM 개수 계산 없이 해당 range를 통째로 제거할 수 있다.

이 설계 덕분에 keyed reorder와 subtree replacement에서 DOM 제거와 lifecycle 정리가 동일한 경로를 공유한다.
