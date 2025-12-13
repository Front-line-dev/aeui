# AEUI Hooks

AEUI는 사이드 이펙트(side effects)와 컴포넌트 생명주기를 관리하기 위한 훅(Hook)들을 제공합니다.

## `watch(callback, dependencies)`

`watch` 훅은 상태 변화에 반응하여 사이드 이펙트를 실행할 때 사용합니다. React의 `useEffect`와 유사하지만, AEUI의 반응형 시스템에 맞춰 설계되었습니다.

### 파라미터 (Parameters)
- **callback** (`Function`): 의존성(dependency)이 변경되었을 때 실행할 함수입니다.
- **dependencies** (`Function | undefined`): 의존성 배열을 반환하는 Getter 함수입니다.
  - **Function**: `() => [count]`와 같이 매 실행시마다 새로운 의존성 배열을 반환해야 합니다. 반환된 배열의 요소들을 이전 값과 비교하여 변경이 감지되면 콜백을 실행합니다.
  - **undefined**: 의존성을 전달하지 않으면(`watch(() => ...)`), 매 틱(tick)마다 `oldDeps`가 `undefined`로 평가되어 항상 콜백이 실행됩니다.
  - **주의**: 배열(`[]`)을 직접 전달하면 `hooks.js` 내부 클로저에 의해 참조가 고정되거나 초기 값만 캡처되어, 변경 사항을 감지하지 못합니다(반응성 소실). 따라서 반드시 함수 형태로 전달해야 합니다.
  - **DX (Babel)**: 사용자가 작성하는 배열 구문(`watch(cb, [dep])`)은 AEUI Babel 플러그인이 자동으로 Getter 함수(`watch(cb, () => [dep])`)로 변환합니다.

### 동작 방식 (Behavior)
- **초기화**: 컴포넌트가 마운트(mount)될 때 `callback`은 즉시 실행되지 **않습니다**. 오직 의존성이 변경되었을 때만 실행됩니다.
- **반응성**: `dependencies`가 반환하는 값이 이전 렌더링과 다를 경우에만 `callback`이 실행됩니다.
- **실행 시점**:
  - 의존성 체크는 props가 업데이트된 **직후**, 그리고 컴포넌트가 UI를 다시 렌더링하기 **직전**에 발생합니다.
  - 이를 통해 콜백 내부에서 로컬 상태를 수정하더라도, 변경된 상태가 즉시 다음 렌더링에 반영됩니다.

### 사용 예시 (Usage)

**1. 기본 사용 (Babel 변환)**
유저가 배열(`[]`)로 작성하면, Babel 플러그인이 자동으로 Getter 함수로 변환합니다.
```javascript
// [사용자 작성 코드]
let count = 0;
watch(() => {
  console.log("Count changed:", count);
}, [count]);

// [Transpiled Code (실제 실행 코드)]
watch(() => {
  console.log("Count changed:", __props.count); // (props인 경우)
}, () => [__props.count]);
```

## `clean(callback)`

`clean` 훅은 컴포넌트가 DOM에서 언마운트(unmount)될 때 실행할 정리(cleanup) 함수를 등록합니다. 인터벌(interval) 제거, 이벤트 리스너 해제 등 뒷정리 작업에 유용합니다.

### 파라미터 (Parameters)
- **callback** (`Function`): 언마운트 시 실행할 함수입니다.

### 사용 예시 (Usage)
```javascript
const timer = setInterval(() => { ... }, 1000);

clean(() => {
  clearInterval(timer);
});
```
