# 런타임 컨텍스트 — `runtime-context.js`

## 개요

`runtime-context.js`는 현재 실행 중인 **컴포넌트 노드**와 **phase**를 관리한다. 훅(`watch`, `clean`)이 "지금 어떤 컴포넌트의 어떤 단계에서 호출되었는가"를 알기 위해 이 모듈을 참조한다.

구현은 단일 글로벌 포인터가 아니라 **스택 기반**이다. 중첩된 컴포넌트 setup/render가 발생해도, 바깥 컨텍스트가 안전하게 복원된다.

---

## `withComponentContext(state, node, phase, callback)`

컴포넌트 실행 컨텍스트를 설정하고 `callback`을 실행한 뒤 복원한다.

### 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `state` | `Object` | runtime state |
| `node` | `Object` | 현재 실행할 component RuntimeNode |
| `phase` | `'setup'` \| `'render'` | 현재 실행 단계 |
| `callback` | `Function` | 컨텍스트 안에서 실행할 함수 |

### 동작

```text
1. 이전 node/phase 백업
2. runtimeContextStack에 state push
3. state.currentComponentNode = node
4. state.currentComponentPhase = phase
5. callback() 실행
6. finally:
   ├── runtimeContextStack에서 pop
   ├── state.currentComponentNode 복원
   └── state.currentComponentPhase 복원
```

### 코드

```javascript
export function withComponentContext(state, node, phase, callback) {
  const previousNode = state.currentComponentNode;
  const previousPhase = state.currentComponentPhase;

  runtimeContextStack.push(state);

  state.currentComponentNode = node;
  state.currentComponentPhase = phase;

  try {
    return callback();
  } finally {
    runtimeContextStack.pop();
    state.currentComponentNode = previousNode;
    state.currentComponentPhase = previousPhase;
  }
}
```

`try/finally` 덕분에 callback에서 예외가 발생해도 컨텍스트가 항상 복원된다.

---

## `getRuntimeContext()`

현재 active runtime state를 반환한다. 스택이 비어 있으면 `null`을 반환한다.

```javascript
export function getRuntimeContext() {
  return runtimeContextStack[runtimeContextStack.length - 1] || null;
}
```

이 함수는 `hooks.js`의 fallback `watch()`/`clean()`에서 사용된다. Babel 플러그인이 변환하지 않은 코드에서 훅이 호출되면, `getRuntimeContext()`로 현재 runtime state를 가져와 등록을 진행한다.

---

## 왜 스택인가

AEUI에서 컴포넌트 A의 render 중에 컴포넌트 B가 mount될 수 있다. 이 경우 B의 setup이 A의 render 안에서 실행된다.

```text
A render 시작
  ├── withComponentContext(state, A, 'render', ...)
  │     ├── reconcile → B mount
  │     │     └── withComponentContext(state, B, 'setup', ...)
  │     │           └── B의 watch/clean 등록
  │     │     └── withComponentContext(state, B, 'render', ...)
  │     │           └── B의 JSX 반환
  │     └── A의 render 계속
  └── A render 끝
```

글로벌 포인터 하나로 관리하면 B의 setup/render가 A의 컨텍스트를 덮어쓴다. 스택으로 관리하면 B가 끝난 뒤 A의 컨텍스트가 자동으로 복원된다.

---

## phase의 역할

| phase | 의미 | 허용되는 훅 |
|-------|------|-------------|
| `setup` | 컴포넌트 함수 본문 실행 (마운트 시 1회) | `watch()`, `clean()` |
| `render` | render factory 실행 (매 tick마다) | 없음 |

`hook-registry.js`의 `getSetupComponentNode()`는 `currentComponentPhase === 'setup'`일 때만 node를 반환한다. render phase에서 호출된 `watch()`/`clean()`은 `null`을 받아 등록이 무시된다.

---

## 관련 코드 위치

- `packages/core/src/runtime-context.js`
- `packages/core/src/hooks.js`
- `packages/core/src/hook-registry.js`
- `packages/core/src/component-lifecycle.js`
