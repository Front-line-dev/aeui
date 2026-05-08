# 훅 레지스트리 — `hook-registry.js`

## 개요

`hook-registry.js`는 `watch()`와 `clean()` 훅의 **등록 로직**을 담당한다. 실행 로직은 `component-watchers.js`(watch)와 `component-lifecycle.js`(clean)에 있다.

compiled main path(`AEUI.__runtime.watch`)와 fallback path(`hooks.js`의 `watch`)가 모두 이 모듈의 `registerWatch`/`registerCleanup`을 공유한다.

---

## `registerWatch(runtime, firstArg, secondArg)`

watcher를 component node의 `watchStates`에 등록한다.

### 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `runtime` | `Object` | runtime state (또는 null) |
| `firstArg` | `Function \| Array \| any` | deps 또는 callback |
| `secondArg` | `Function \| Array \| any` | callback 또는 deps |

### 동작

```text
1. normalizeWatchArgs(firstArg, secondArg) → { depsGetter, callback }
2. callback이 함수가 아니면 리턴
3. getDeps: depsGetter를 매번 호출해 현재 deps를 읽는 함수 생성
4. getSetupComponentNode(runtime) → setup phase의 component node
5. node가 없으면 리턴 (render phase이거나 컴포넌트 밖)
6. node.watchStates에 watcher 객체 push
```

### 인자 정규화

`watch(deps, callback)`과 `watch(callback, deps)` 양쪽을 지원한다. `normalizeWatchArgs`가 두 인자의 타입을 보고 `{ depsGetter, callback }`으로 정규화한다.

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
- `packages/core/src/hooks.js` (fallback wrapper)
- `packages/core/src/runtime-context.js` (phase 관리)
- `packages/core/src/component-watchers.js` (watcher 실행)
