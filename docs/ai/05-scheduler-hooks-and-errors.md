# 05. 스케줄러, 훅, 오류 처리 명세

이 문서는 AEUI의 dirty-checking 루프, DOM 이벤트 fast path, runtime state, `watch`/`clean` 훅, 오류 격리 규칙을 규정한다. 일반 `let` 변경에는 setter가 없으므로 DOM 이벤트 예약과 주기적 polling이 함께 있어야 현재 동작을 재현할 수 있다.

## 1. 모듈 경계

| 모듈 | 책임 |
| --- | --- |
| `runtime-state.js` | 앱별 mutable state 생성/reset |
| `runtime.js` | init, root reconcile, tick, 수동 render, RAF loop, DOM 이벤트 dispatch |
| `app-runtime.js` | state와 순수 함수를 앱 인스턴스 메서드로 바인딩 |
| `hooks.js` | public `watch` compile guard와 `clean` fallback |
| `hook-registry.js` | setup-phase watcher/cleanup 등록 |
| `component-watchers.js` | deps 비교, callback 실행, snapshot 갱신 |
| `component-lifecycle.js` | props 동기화 후 watcher 실행, unmount cleanup 실행 |
| `runtime-context.js` | active runtime/component phase 복원 |

## 2. runtime state

`createRuntimeState({ deepEqual, deepClone })`는 다음 필드를 가진 새 객체를 반환한다.

```js
{
  deepEqual,
  deepClone,
  rootNode: null,
  containerElement: null,
  RootComponent: null,
  currentComponentNode: null,
  currentComponentPhase: null,
  isRendering: false,
  rafId: null,
  frameDelay: 1,
  framesUntilNextTick: 0,
  didMutate: false,
  domEventDepth: 0,
  interactiveRenderRequested: false,
  routerTeardown: null,
}
```

`app-runtime.js`는 여기에 VNode/Fragment와 reconcile/scheduler helper를 추가로 바인딩한다.

### 2.1 `resetRuntimeState`

reset은 먼저 `routerTeardown`이 함수면 호출한다. 그 뒤 위 mutable 필드를 초기값으로 돌리되 `deepEqual`, `deepClone` 및 app-runtime이 추가한 helper property는 삭제하지 않는다.

reset 자체는 실제로 예약된 RAF/timeout을 cancel하지 않는다. `rafId`만 `null`로 만든다. 따라서 정상 호출자는 reset 전에 `stopScheduler()`를 실행해야 한다. router teardown이나 다른 외부 cleanup이 throw하면 reset은 그 예외를 별도로 격리하지 않는다.

reset은 기존 `rootNode.children`을 `unmountNode`로 순회하지 않고 container의 DOM도 비우지 않는다. 따라서 component `clean` callback, 자식 lifecycle, host DOM 제거를 수행하는 일반 앱 teardown API가 아니다. 마운트된 앱에 직접 쓸 호출자는 먼저 scheduler 중지와 명시적 unmount를 수행해야 하며, 그렇지 않으면 state reference만 초기화된 채 DOM과 외부 자원이 남을 수 있다.

## 3. root reconcile

`reconcileRoot(state)`는 root wrapper와 실제 루트 component subtree를 연결한다.

```text
guard: rootNode, containerElement, RootComponent가 모두 있어야 함

1. rootVNode = state.createVNode(state.RootComponent)
2. previousRootChild = state.rootNode.children[0] || null
3. previousRootChild가 소유한 committed DOM Set 수집
4. state.reconcile(container, previousRootChild, rootVNode, null, rootNode)
5. 성공 시 root children/range commit
6. 실패 시 committed Set에 없던 container subtree를 제거하고 error rethrow
```

성공 commit은 다음과 같다.

```js
state.rootNode.children = nextRootChild ? [nextRootChild] : [];
state.rootNode.firstDom = nextRootChild ? nextRootChild.firstDom : null;
state.rootNode.lastDom = nextRootChild ? nextRootChild.lastDom : null;
```

### 3.1 committed DOM 수집

RuntimeNode tree를 재귀 순회한다.

- `node.dom`이 있으면 Set에 추가한다.
- `firstDom`이 있고 `firstDom === lastDom`이면 그 DOM도 추가한다.
- `node.children`을 재귀 순회한다.

host/text DOM은 `dom`으로 들어가고, component/fragment의 실제 DOM은 자식 순회로 들어간다.

### 3.2 실패 후 새 DOM 제거

container의 현재 `childNodes`를 snapshot 배열로 순회한다.

- child가 committed Set에 없으면 그 child subtree 전체를 제거한다.
- committed child면 그 child 내부를 같은 방식으로 재귀 검사한다.

이 동작은 실패 render에서 새로 삽입되고 RuntimeNode tree에 commit되지 않은 DOM의 누적을 막는다. 그러나 완전한 rollback은 아니다.

- 이미 제거된 이전 committed DOM을 복구하지 않는다.
- 실패 전에 갱신된 기존 text/attribute/property를 이전 값으로 되돌리지 않는다.
- update 중 같은 RuntimeNode 객체에 반영된 중간 상태를 복사본으로 복구하지 않는다.
- container에 외부 코드가 삽입한 비-committed DOM도 실패 정리 대상이 될 수 있다.

## 4. 초기화: `AEUI.init`

공개 호출은 `AEUI.init(RootComponent, containerElement)`이며 내부 순서는 다음과 같다.

```text
1. stopScheduler()
2. routerTeardown이 함수면 호출
3. 이전 root child가 있으면 unmountNode(previousRootChild)
4. state.RootComponent = RootComponent
5. state.containerElement = containerElement
6. state.rootNode = createRootNode(containerElement)
7. containerElement.innerHTML = ''
8. state.interactiveRenderRequested = false
9. didMutate = state.tick()
10. didMutate에 따라 polling delay 계산
11. startScheduler()
```

인자 타입을 선검증하지 않는다. null container는 `innerHTML` 접근에서 throw하며, 유효하지 않은 RootComponent는 첫 tick의 render error 경로로 갈 수 있다.

이전 root unmount가 lifecycle cleanup과 DOM 제거를 담당하고, 그 뒤 `innerHTML=''`로 container를 최종 정리한다. `tick()`은 시작할 때 `didMutate=false`로 다시 설정하므로 init의 직접적인 container clear는 첫 tick의 mutation 결과에 포함되지 않는다.

초기 render error는 `tick`이 로그 후 삼키므로 `init`은 scheduler를 계속 시작한다. router teardown 자체의 error는 `tick` 밖이므로 전파된다.

## 5. 한 render cycle: `tick`

```js
if (!RootComponent || !containerElement || !rootNode) return false;
if (isRendering) return false;

isRendering = true;
didMutate = false;
try {
  reconcileRoot(state);
} catch (error) {
  console.error('[AEUI] Render error:', error);
} finally {
  isRendering = false;
}
return didMutate;
```

재진입 tick은 실행하지 않고 `false`다. render error는 호출자에게 전파하지 않으며 scheduler가 다음 tick에서 재시도할 수 있게 한다. direct `__runtime.reconcile` 호출은 이 catch 밖이므로 원래 error를 전파한다.

`didMutate`는 “상태가 바뀌었는가”가 아니라 이번 cycle에서 런타임이 추적하는 DOM write/move/remove가 있었는가를 나타낸다. text write, element 삽입/이동/제거, 일반 DOM prop branch, controlled property 복구가 true로 만든다. event handler 저장소만 교체한 경우는 true로 만들지 않는다.

현재 file input의 `value` 특례는 attribute가 이미 없는 동일 props render에서도 `removeAttribute`를 호출하고 `didMutate=true`로 만든다. 이것은 **현재 구현** 설명이며 최종 mutation 의미가 아니다. 정확한 file-input mutation 판정은 6.1의 **계획 기능**으로 분리한다.

## 6. polling backoff

최대 간격은 60 frame이다.

```js
frameDelay = didMutate
  ? 1
  : Math.min(frameDelay * 2, 60);
framesUntilNextTick = frameDelay - 1;
```

- DOM 변화가 있으면 다음 polling tick까지 0 frame을 건너뛴다. 즉 다음 RAF에서 다시 tick한다.
- 변화가 없으면 `1 -> 2 -> 4 -> 8 -> ... -> 60`으로 늘어난다.
- `framesUntilNextTick > 0`인 RAF에서는 tick하지 않고 1만 감소시킨다.

이 값은 시간 milliseconds가 아니라 RAF callback 횟수다.

### 6.1 **계획 기능**: 동일 file input props에서 backoff 유지

현재 file input에 `value` prop이 있으면 실제 `value` attribute가 이미 없더라도 DOM host가 매 render를 mutation으로 보고할 수 있다. 따라서 사용자 상태와 DOM이 모두 안정되어 있어도 다음 흐름이 반복될 수 있다.

```text
file input의 동일 props reconcile
실제 DOM 변화 없음
현재 구현은 didMutate=true 보고
frameDelay=1로 초기화
다음 RAF에서 다시 tick
```

이 최적화는 현재 구현하지 않았으며 나중에 구현해야 하는 **계획 기능**이다. 목표 계약은 다음과 같다.

- `didMutate`는 file input의 `value` attribute가 실제로 제거되는 경우에만 그 branch 때문에 true가 된다.
- attribute가 이미 없고 다른 DOM write도 없으면 tick은 `false`를 반환할 수 있어야 한다.
- 무변화 cycle은 일반 backoff 규칙에 따라 `1 -> 2 -> 4 -> ... -> 60`으로 진행한다.
- text input에서 file input으로 전환해 기존 value attribute를 실제로 제거한 cycle은 mutation으로 보고하고 delay를 1로 되돌린다.

이 항목은 현재 동작 호환 요구가 아니라 향후 polling 비용을 줄이기 위한 목표다.

## 7. scheduler 제어

### 7.1 `startScheduler`

`state.rafId != null`이면 중복 예약하지 않는다. 전역 `requestAnimationFrame`이 함수면 이를 사용하고, 없으면 `setTimeout(..., 16)`을 사용한다. callback은 `onAnimationFrame(state)`를 호출한다.

### 7.2 `stopScheduler`

`rafId`가 있으면 전역 `cancelAnimationFrame`이 함수일 때 이를 사용하고, 없으면 `clearTimeout`을 사용한다. 마지막에는 항상 `rafId = null`이다.

### 7.3 `onAnimationFrame`

```text
1. rafId = null
2. RootComponent/containerElement가 없으면 종료하고 재예약하지 않음

3. interactiveRenderRequested가 true면:
   a. flag = false
   b. tick()
   c. tick 도중 flag가 다시 true가 됐으면 delay=1, countdown=0
      아니면 didMutate로 backoff 계산
   d. 다음 scheduler 예약 후 return

4. interactive 요청이 없고 countdown <= 0이면:
   a. tick()
   b. tick 도중 interactive 요청이 생기면 delay=1, countdown=0
      아니면 didMutate로 backoff 계산

5. countdown > 0이면 countdown -= 1
6. 다음 scheduler 예약
```

interactive lane은 polling countdown이 59처럼 길어도 다음 RAF에서 tick을 한 번 실행한다.

## 8. 수동 render와 render 요청

### 8.1 `AEUI.render()`

RootComponent 또는 container가 없으면 `false`다. 있으면 interactive flag를 지우고 `tick()`을 동기 실행한다. 그 결과로 backoff를 계산하고 scheduler를 보장한 뒤 `didMutate`를 반환한다.

이 함수는 다음 frame을 기다리지 않는다. 다만 render error는 tick 내부에서 로그로 격리된다.

### 8.2 `requestRender()`

RootComponent, container, rootNode가 모두 있어야 한다. 없으면 `false`다. 있으면 다음만 수행하고 `true`를 반환한다.

```js
state.interactiveRenderRequested = true;
state.startScheduler();
```

즉시 tick하지 않는다. 여러 호출은 boolean flag 하나로 합쳐지고, 이미 RAF가 예약되어 있으면 추가 RAF를 만들지 않는다.

## 9. DOM 이벤트 fast path

DOM host proxy가 `dispatchDomEvent(state, domNode, eventName, event)`를 호출한다.

```text
1. domEventDepth += 1
2. domNode._aeuiHandlers[eventName]의 최신 handler 조회
3. 함수면 handler.call(domNode, event), 그 반환값 반환
4. 함수가 아니면 undefined 반환
5. finally:
   domEventDepth -= 1
   depth가 0이면 requestRender()
```

handler가 throw해도 finally에서 render 요청은 남고 AEUI bridge는 원래 error를 catch하지 않은 채 바깥으로 다시 던진다. 실제 browser `dispatchEvent`가 그 예외를 호출 스택, error event, console에 전달하는 방식은 플랫폼 규칙이며 AEUI가 동기 반환 오류로 변환하지 않는다. 중첩 이벤트는 가장 바깥 dispatch가 끝날 때 한 번만 요청한다. 별도 연속 DOM 이벤트가 각각 요청하더라도 boolean flag와 단일 RAF 예약으로 다음 frame render 하나에 합쳐진다.

fast path는 AEUI proxy를 통과한 동기 DOM 이벤트만 앞당긴다. timeout, Promise, 외부 store, 직접 등록한 native listener의 변경은 polling fallback 또는 수동 `AEUI.render()`가 필요하다.

## 10. public 훅과 compiler 계약

공개 모듈은 `watch`와 `clean`을 export하지만 정상 컴포넌트 코드는 Babel 변환 뒤 compiler-private helper를 사용한다.

### 10.1 `watch`

원본 public 함수는 언제 호출해도 다음 error를 throw하는 compile guard다.

```text
[AEUI] watch(callback, deps) must be compiled by the AEUI Babel plugin.
```

정상 Babel 출력은 callback-first 호출을 다음과 같이 바꾼다.

```js
AEUI.__runtime.watch(callback, () => [currentDeps]);
```

따라서 runtime의 실제 등록 함수는 `registerWatch(state, callback, deps)`다.

### 10.2 `clean`

public fallback은 현재 active runtime context를 읽어 `registerCleanup(runtime, callback)`을 호출한다. 정상 compiled path는 `AEUI.__runtime.clean(callback)`으로 직접 현재 앱 state에 등록한다.

## 11. 훅 등록 phase

등록 전에 다음 가드를 적용한다.

```text
runtime이 없으면 등록 안 함
runtime.currentComponentNode가 없으면 등록 안 함
runtime.currentComponentPhase !== 'setup'이면 등록 안 함
```

이 가드는 인자 검증보다 먼저다. 따라서 render phase나 컴포넌트 밖의 invalid hook 인자는 조용히 무시될 수 있다.

### 11.1 watcher 등록

setup node를 얻은 뒤 다음을 검증한다.

- callback이 함수가 아니면 `TypeError('[AEUI] watch(callback, deps) requires callback to be a function.')`
- deps가 `undefined`면 `TypeError('[AEUI] watch(callback, deps) requires deps.')`
- deps 자체 또는 deps 함수의 현재 반환값이 Array가 아니면 `TypeError('[AEUI] watch(callback, deps) requires deps to be an array or a function that returns an array.')`

deps가 함수면 매번 함수를 호출하고, 아니면 같은 배열 값을 읽는 `getDeps` closure를 만든다. 등록 entry는 다음과 같다.

```js
{
  callback,
  getDeps,
  oldDeps: state.deepClone(getDeps()),
}
```

초기 callback은 실행하지 않는다. getter 평가나 deep clone이 throw하면 setup error로 전파된다.

### 11.2 cleanup 등록

setup node의 `cleanups`에 callback 값을 그대로 push한다. callback 타입을 등록 시점에 검증하지 않는다.

## 12. watcher 실행

node가 없거나 `node.watchStates`가 falsy면 watcher 실행 함수는 즉시 반환한다.

compiled render bridge의 `runComponentRenderPhase`는 다음 순서를 보장한다.

```text
1. node.props = nextProps || {}
2. compiler propsTarget 동기화
3. runComponentWatchers(state, node)
4. 실제 render 함수 호출
```

각 watcher는 독립 try/catch 안에서 실행한다.

```text
newDeps = watcher.getDeps()
changed = !watcher.oldDeps || !deepEqual(newDeps, watcher.oldDeps)

changed이면:
  watcher.callback()
  finalDeps = watcher.getDeps()
  watcher.oldDeps = deepClone(finalDeps)
```

callback 뒤 deps를 다시 읽는 것이 중요하다. callback이 감시 값을 clamp/normalize했다면 그 최종 값을 snapshot으로 삼아 다음 render에서 같은 callback이 불필요하게 다시 실행되지 않는다. deps 배열 길이 변화도 deepEqual에서 변경으로 판정된다.

watcher 하나의 getter/callback/final getter/clone 중 어느 단계가 throw해도 다음을 로그하고 다음 watcher와 render를 계속한다.

```text
[AEUI] Watcher error: <error>
```

실패한 watcher는 `oldDeps` 갱신 단계에 도달하지 못할 수 있으므로 이후 render에서 같은 변경을 다시 시도한다.

render phase에서 호출된 watch/clean은 phase guard 때문에 새 entry를 만들지 않는다. setup이 정상적으로 한 번 실행되는 compiled component에서는 훅 등록도 component lifetime에 한 번이다.

## 13. cleanup 실행

component unmount 시작 시 등록 순서대로 각 cleanup을 호출한다. 각 호출은 독립 try/catch다.

```text
[AEUI] Cleanup error: <error>
```

하나가 실패해도 나머지 cleanup, watcher 참조 해제, 자식 재귀 unmount, DOM 제거를 계속한다. 모든 cleanup 뒤 `watchStates`, `cleanups`, `renderedNode`, `renderFactory`, `render`를 비운다. 부모 component cleanup이 자식 cleanup보다 먼저다.

## 14. 오류 처리 행렬

| 오류 위치 | 로그/전파 | 후속 동작 |
| --- | --- | --- |
| public uncompiled `watch` | 즉시 throw | component setup 안이면 최종적으로 tick의 Render error로 기록될 수 있음 |
| watch 등록 인자/getter | setup으로 throw | reconcile/root error 경로 |
| watcher 실행 | `Watcher error` 로그, 삼킴 | 다음 watcher와 같은 render 계속 |
| cleanup callback | `Cleanup error` 로그, 삼킴 | 다음 cleanup과 subtree unmount 계속 |
| component setup/render | direct reconcile에는 throw | context는 finally로 복원 |
| root reconcile | 새 비-committed DOM 제거 후 rethrow | tick이 받음 |
| tick 내부 render | `Render error` 로그, 삼킴 | `isRendering=false`, scheduler 계속 가능 |
| DOM event handler | 원래 error 전파 | finally에서 interactive render 요청 |
| router teardown/init의 tick 밖 코드 | 별도 catch 없음 | 호출자에게 전파 |

render 실패 후 scheduler가 살아 있으므로 같은 실패가 이후 polling마다 다시 로그될 수 있다. 현재 오류 처리는 error boundary나 이전 UI의 완전한 transactional 복원을 제공하지 않는다.

완전한 transactional 복원과, 실패 전에 setup이 성공한 provisional component의 cleanup 보장은 구분한다. 후자는 현재 구현하지 않았지만 나중에 구현해야 하는 **계획 기능**이다. 향후에는 render commit이 실패해도 해당 시도에서 등록된 cleanup을 정확히 한 번 실행해야 한다. 이 요구는 기존 text/attribute/state까지 모두 이전 값으로 되돌리는 error boundary나 전체 rollback을 뜻하지 않는다. 상세 계약은 `04-reconciliation-and-dom.md` 9.3을 따른다.

## 15. 검증 계약

새 문서 우선 적합성 suite는 최종적으로 다음 항목을 상태에 맞게 검증해야 한다. 현재 legacy suite 통과는 이 계약의 증거가 아니다.

- runtime state 기본값과 reset 후 scheduling/render flag가 정확하다.
- reset은 주입 helper를 유지하고 router teardown을 호출한다.
- init은 이전 root cleanup, container clear, 초기 tick, scheduler 시작 순서를 따른다.
- 무변화 polling은 1/2/4 frame으로 backoff하고 변화 시 1로 돌아오며 60을 넘지 않는다.
- 동일한 file input props에서 실제 attribute 제거가 없을 때 backoff를 유지하는 검증은 **계획 기능**에 속한다. 현재 구현은 이 목표를 아직 만족하지 않는다.
- interactive 요청은 남은 polling countdown과 무관하게 다음 RAF에서 tick한다.
- `AEUI.render()`는 동기 렌더 결과 boolean을 반환한다.
- DOM 이벤트 뒤 다음 frame 자동 렌더, 여러 이벤트의 한 frame coalescing, handler `this`와 error-finally 예약이 동작한다.
- watcher는 초기 실행하지 않고 deps 변경 때 최신 props/local 값을 보며 callback 뒤 최종 deps를 저장한다.
- watcher 오류가 다음 watcher/render를 막지 않는다.
- render-phase 훅은 등록되지 않고 uncompiled watch는 compile guard error를 낸다.
- cleanup 오류가 나머지 cleanup과 재귀 unmount를 막지 않는다.
- 부분 mount 실패 전에 setup이 성공한 provisional component cleanup을 정확히 한 번 실행하는 검증은 **계획 기능**에 속한다. 현재 구현은 이 목표를 아직 만족하지 않는다.
- setup/render 오류 뒤 active component context와 `isRendering`이 복원된다.
- 실패 render의 새 DOM이 다음 render마다 누적되지 않는다.

현재 구현을 조사할 때 참고할 기존 테스트는 `runtime-state.test.js`, `runtime-context.test.js`, `app-runtime.test.js`, `dom.test.js`, `component-lifecycle.test.js`, `component.test.jsx`, `babel-plugin.test.js`다. 이 파일들은 새 적합성 suite가 아니며 위 항목을 문서 상태별로 다시 작성해야 한다.
