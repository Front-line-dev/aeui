# 훅 레지스트리 — `hook-registry.js`

## 개요

`hook-registry.js`는 `watch()`와 `clean()` 훅의 **등록 로직**을 담당한다. 실행 로직은 `component-watchers.js`(watch)와 `component-lifecycle.js`(clean)에 있다.

compiled main path(`AEUI.__runtime.watch`)가 이 모듈의 `registerWatch`를 사용한다. `clean()`은 public fallback wrapper도 `registerCleanup`을 공유하지만, public `watch()`는 fallback 등록을 하지 않고 compile guard로 동작한다.

---

## `registerWatch(runtime, callback, deps)`

watcher를 component node의 `watchStates`에 등록한다.

### 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `runtime` | `Object` | runtime state (또는 null) |
| `callback` | `Function` | 변경 시 실행할 함수 |
| `deps` | `Array \| Function` | 감시할 값 배열 또는 배열을 반환하는 함수 |

### 동작

```text
1. getSetupComponentNode(runtime) → setup phase의 component node
2. node가 없으면 리턴 (render phase이거나 컴포넌트 밖)
3. callback이 함수가 아니면 `TypeError`
4. deps가 없거나 배열/배열 getter가 아니면 `TypeError`
5. getDeps: deps getter를 매번 호출해 현재 deps 배열을 읽는 함수 생성
6. node.watchStates에 watcher 객체 push
```

---

## `registerCleanup(runtime, callback)`

cleanup 함수를 component node의 `cleanups`에 등록한다.

```javascript
export function registerCleanup(runtime, callback) {
  if (!runtime) return;

  const node = getSetupComponentNode(runtime);
  if (!node) return;
  node.cleanups.push(callback);
}
```

---

## phase 가드

```javascript
function getSetupComponentNode(runtime) {
  const node = runtime.currentComponentNode;
  if (!node) return null;
  if (runtime.currentComponentPhase !== 'setup') return null;
  return node;
}
```

`currentComponentPhase`가 `'setup'`일 때만 node를 반환한다. render phase에서 호출된 `watch()`/`clean()`은 `null`을 받아 등록이 무시된다.

---

## 관련 코드 위치

- `packages/core/src/hook-registry.js`
- `packages/core/src/hooks.js` (watch compile guard, clean fallback wrapper)
- `packages/core/src/runtime-context.js` (phase 관리)
- `packages/core/src/component-watchers.js` (watcher 실행)
