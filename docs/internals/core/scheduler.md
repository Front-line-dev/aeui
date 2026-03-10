# Scheduler 와 Root Render Loop

## 개요

AEUI의 scheduler는 `_tick()`을 호출해 루트 RuntimeNode를 재조정한다. 이전처럼 `_rootInstance.update()`를 직접 호출하지 않고, root wrapper가 현재 루트 child node를 소유한 상태에서 `_reconcileRoot()`를 실행한다.

## 흐름

1. `init(RootComponent, container)` 호출
2. root wrapper node 생성 (`AEUI._rootNode`)
3. `_tick()` 최초 실행
4. `_reconcileRoot()`가 `createVNode(RootComponent)`를 만들고 현재 root child node와 비교
5. requestAnimationFrame 기반 scheduler 시작

## `_tick()`

`_tick()`은 다음 역할만 한다.

- re-entrant render 방지
- `_didMutate` 초기화
- `_reconcileRoot()` 호출
- mutation 여부를 반환하여 frame backoff 조정

컴포넌트별 start index 계산이나 `_getDomNodeCount` 합산은 더 이상 존재하지 않는다.
