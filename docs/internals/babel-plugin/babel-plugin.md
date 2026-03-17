# Babel 플러그인 — 단일 Render Phase 계약

## 개요

현재 AEUI Babel 플러그인의 목적은 여전히 같다.

- setup은 한 번만 실행
- render 함수는 반복 실행
- props와 watcher는 매 render phase마다 최신 값 기준으로 다시 계산

다만 이번 코어 단순화 이후, 플러그인이 런타임에 기대는 계약은 더 작아졌다. 예전에는 `updateProps()`와 `_runComponentWatchers()`를 별도로 호출했지만, 지금은 **`AEUI._runRenderPhase()` 하나만 호출**한다.

---

## 주요 변환

### 1. 컴포넌트 판별

다음 함수들을 AEUI 컴포넌트로 판단한다.

- JSX tag로 사용되는 함수
- PascalCase 함수
- renderable expression을 반환하는 anonymous default export

이 기준은 기존과 같지만, anonymous default export 처리와 renderable expression 탐지가 조금 더 명시적이다.

### 2. `return JSX`를 render factory로 변환

```javascript
function Counter() {
  let count = 0;
  return <div>{count}</div>;
}
```

는 다음 개념으로 변환된다.

```javascript
function Counter() {
  let count = 0;
  return () => <div>{count}</div>;
}
```

expression body, conditional expression, logical expression, array return도 renderable value로 인식한다.

### 3. props 반응화

props 파라미터가 있으면 `_initialProps`와 `__props`를 도입한다.

```javascript
function Card({ title }) { ... }
```

는 개념적으로 다음 구조가 된다.

```javascript
function Card(_initialProps) {
  const __props = { ..._initialProps };
  let { title } = _initialProps;
  const _resolveProps = () => {
    const { title } = __props;
    return { title };
  };
}
```

구조 분해 props는 `_resolveProps()`를 통해 render/watch 시점에 다시 해석되므로 alias, default, nested pattern을 유지할 수 있다.

### 4. `watch()` deps 정규화

```javascript
watch([count], callback);
```

는 다음처럼 바뀐다.

```javascript
watch(() => [count], callback);
```

구버전 순서인 `watch(callback, deps)`를 만나도 내부적으로 `watch(deps, callback)` 형태로 맞춘 뒤 deps getter를 생성한다.

### 5. 단일 render phase helper 호출

가장 중요한 변화다. 최종 render wrapper는 이제 다음 구조를 만든다.

```javascript
return (_newProps) => AEUI._runRenderPhase(_newProps, __props, innerRenderFn);
```

예전처럼 wrapper 내부에:

- `AEUI.updateProps(__props, _newProps)`
- `AEUI._runComponentWatchers(AEUI._currentComponentNode)`

를 직접 주입하지 않는다. 이 두 단계는 `_runRenderPhase()` 안으로 이동했다.

---

## Render 파라미터 보존

render 함수가 직접 파라미터를 받는 경우도 지원해야 한다.

```javascript
return ({ size = 'm' }) => <div>{size}</div>;
```

현재 플러그인은 내부적으로 별도 render param id를 만들고, 원래 파라미터 패턴을 다시 바인딩한다. 이 작업은 `createRenderParamBindings()`가 담당한다.

이 덕분에 다음 패턴들이 유지된다.

- 단순 identifier 파라미터
- object / array destructuring
- default assignment pattern

즉, render wrapper를 단일 helper 호출로 줄이면서도 기존 사용자 코드 의미를 깨지 않는다.

---

## 변환 후 개념 예시

입력:

```jsx
function TodoItem({ text, done }) {
  let editing = false;

  watch([done], () => {
    if (done) editing = false;
  });

  return <li>{editing ? text : 'idle'}</li>;
}
```

출력 개념:

```jsx
function TodoItem(_initialProps) {
  const __props = { ..._initialProps };
  let { text, done } = _initialProps;
  const _resolveProps = () => {
    const { text, done } = __props;
    return { text, done };
  };

  let editing = false;

  watch(
    () => {
      const _resolvedProps = _resolveProps();
      return [_resolvedProps.done];
    },
    () => {
      const _resolvedProps = _resolveProps();
      if (_resolvedProps.done) editing = false;
    }
  );

  return (_newProps) => AEUI._runRenderPhase(
    _newProps,
    __props,
    (_renderProps) => {
      const _resolvedProps = _resolveProps();
      return <li>{editing ? _resolvedProps.text : 'idle'}</li>;
    }
  );
}
```

핵심은 Babel이 "props 동기화 + watcher 실행 + render context 설정"의 세부 단계를 직접 조합하지 않고, render phase 계약 하나에만 의존한다는 점이다.

---

## 왜 더 단순한가

- Babel plugin이 runtime 내부 helper 조합을 덜 안다
- `_runRenderPhase()` 하나만 테스트하면 watcher ordering을 검증할 수 있다
- runtime 내부에서 props sync와 watcher 실행 순서를 바꿔도 Babel contract는 유지된다

즉, compile-time 코드와 runtime 코드가 더 느슨하게 결합된다.

---

## 관련 코드 위치

- `packages/core/src/babel-plugin.js`
- `packages/core/src/core.js`
- `packages/core/src/component-lifecycle.js`
