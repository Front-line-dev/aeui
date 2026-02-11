# 설계 결정 (Design Decisions)

## 개요

AEUI 프레임워크의 주요 설계 선택과 그 이유를 기록한다. "왜 이렇게 만들었는가?"에 대한 답변이다.

---

## 1. Polling(Dirty Checking) 반응성 시스템

### 결정

`setState`나 Proxy 같은 명시적 상태 알림 대신, **1초마다 전체 상태를 비교하여 변경을 감지**하는 Polling 방식을 선택했다.

### 이유

**`let` 변수를 직접 수정하는 것만으로 UI를 업데이트**할 수 있게 하기 위함이다.

```jsx
// AEUI: let 변수 직접 수정
let count = 0;
count++;  // 다음 tick에서 자동 반영

// React: useState 호출 필요
const [count, setCount] = useState(0);
setCount(count + 1);
```

Proxy나 Signal 기반 방식은 객체를 래핑해야 하므로 `let` 직접 수정이 불가하다. Polling만이 **일반 JavaScript 변수의 직접 변이(mutation)를 감지**할 수 있다. 이것은 Babel 플러그인이 렌더 함수를 매 tick마다 재실행하는 구조와 결합되어 작동한다.

### 트레이드오프

| 장점 | 단점 |
|------|------|
| 사용자가 `useState` 같은 API를 배울 필요 없음 | 최대 1초의 UI 업데이트 지연 |
| 직접 변이(`push`, `splice` 등) 가능 | 변경 없어도 매 tick마다 비교 비용 발생 |
| 코드가 일반 JavaScript처럼 자연스러움 | 복잡한 상태에서 `_deepEqual` 비용 증가 |

### 향후 계획

고정 1초 대신 **적응형 tick interval**을 도입하여, 이벤트 발생 시 즉시 tick을 실행하고 유휴 시에는 간격을 늘리는 방식으로 종합적인 반응성을 개선할 예정이다.

---

## 2. Setup 1회 실행 + 렌더 함수 반복 실행 구조

### 결정

컴포넌트 함수 본문을 **한 번만 실행(setup)**하고, return문을 **`() => JSX` 팩토리로 변환**하여 매 tick마다 반복 실행하는 구조를 선택했다.

### 이유

React에서는 컴포넌트 함수 전체가 매 렌더마다 재실행된다. 이로 인해:
- `useState`, `useRef` 등의 훅으로 상태를 관리해야 함
- 훅의 호출 순서가 중요하며, 조건문 안에서 훅 호출 불가
- `useMemo`, `useCallback` 등의 최적화 훅 필요

AEUI는 setup을 1회만 실행하므로:
- `let` 변수가 클로저에 유지되어 자연스럽게 상태가 됨
- `watch`, `clean`은 호출 순서에 제약 없음
- 별도 최적화 API 불필요

### Babel 플러그인 의존성

이 구조는 **Babel 플러그인 없이는 작동하지 않는다**. 사용자가 `return <div />` 를 쓰면 반드시 `return () => <div />`로 변환되어야 한다. 이는 의도적인 설계 트레이드오프로, 빌드 도구 없이 AEUI를 사용할 수 없다는 뜻이다.

---

## 3. Babel 플러그인 기반 코드 변환

### 결정

런타임 마법(Proxy, getter/setter)이 아닌 **컴파일 타임 코드 변환**을 선택했다.

### 이유

런타임 방식의 문제:
- Proxy: `let` 변수를 래핑할 수 없음, 객체/배열만 가능
- Compiler(Svelte 방식): 자체 컴파일러 필요 → 개발 복잡도 매우 높음
- Signal: `signal.value`처럼 접근자(.value) 필요 → 사용자 학습 비용

Babel 플러그인은 기존 빌드 시스템(Vite, Webpack)에 쉽게 통합되면서도, 사용자가 일반 JavaScript를 작성하면 알아서 변환해준다. 자체 컴파일러보다 개발/유지보수 비용이 훨씬 낮다.

### 트레이드오프

| 장점 | 단점 |
|------|------|
| 기존 JS 생태계 도구와 호환 | Babel 의존성 필수 |
| 자체 파서/컴파일러 불필요 | 변환 로직 디버깅이 어려움 |
| JSX를 그대로 활용 | 사용자 코드와 실행 코드가 다름 |

---

## 4. Props 반응화: `__props` 패턴

### 결정

props를 `__props`라는 중간 객체에 담아, **같은 객체 참조를 유지하면서 내용만 교체**하는 방식을 선택했다.

### 이유

setup이 1회만 실행되므로 `function Comp({ name })`에서 `name`은 초기값으로 고정된다. 부모가 새 props를 전달해도 `name` 변수는 변하지 않는다.

`__props` 객체를 통해:
1. `updateProps(__props, newProps)`로 내용을 교체하면
2. 렌더 함수에서 `__props.name`으로 접근할 때 항상 최신값을 얻는다
3. 같은 객체 참조이므로 클로저가 끊어지지 않는다

`updateProps`에서 기존 key를 delete 후 assign하는 방식은, 세밀한 비교를 하는 것보다 단순하다. 초기 코드 복잡성을 피하기 위한 설계이다.

---

## 5. Watcher가 Render보다 먼저 실행

### 결정

`_runComponentWatchers`를 렌더 함수 **호출 전에** 실행한다.

### 이유

watch callback이 **상태를 변경**할 수 있다. 변경된 상태가 이번 tick의 렌더 결과에 즉시 반영되어야 한다.

```jsx
let count = 0;
let label = "";

watch(() => {
  label = count > 10 ? "많음" : "적음";  // ← 상태 변경
}, [count]);

return <p>{label}</p>;  // ← label이 최신이어야 정확한 렌더
```

만약 render를 먼저 실행하면 `label`은 이전 tick 값인 채로 렌더링되고, watch에 의한 변경은 다음 tick(최대 1초)까지 반영되지 않는다.

---

## 6. `_currentInstance` 전역 변수 방식

### 결정

훅(`watch`, `clean`)이 현재 컴포넌트를 알기 위해 **단일 전역 변수**를 사용한다.

### 이유

React도 동일한 패턴을 사용한다 (`ReactCurrentDispatcher`). 훅 함수에 인스턴스를 직접 전달하면 사용자 API가 복잡해진다:

```javascript
// ❌ 인스턴스를 명시적으로 전달하면
watch(instance, () => { ... }, [count]);  // 사용자가 불편

// ✅ 전역 변수로 암묵적 전달
watch(() => { ... }, [count]);            // 깔끔한 API
```

현재 AEUI의 모든 코드는 동기적으로 실행되므로, 전역 변수가 덮어씌워지는 문제는 발생하지 않는다.

### 향후 계획

비동기 렌더링이나 Concurrent Mode를 도입하게 되면 **스택 구조**로 전환 필요. 이미 `spec.md` TODO에 기재되어 있다.

---

## 7. 인덱스 기반 Reconciliation (Key 미지원)

### 결정

`_reconcile`에서 `parentElement.childNodes[index]`로 DOM 노드에 직접 접근하는 **인덱스 기반 비교만** 사용한다.

### 이유

초기 구현의 단순성을 위한 선택이다. key 기반 reconciliation은 노드 매핑, 이동 감지, 삭제/삽입 분리 등의 로직이 필요하여 구현 복잡도가 높다.

### 트레이드오프

| 장점 | 단점 |
|------|------|
| 구현이 단순 | 리스트 중간 삽입/삭제 시 비효율적 |
| 코드 이해가 쉬움 | 컴포넌트 상태가 예기치 않게 파괴될 수 있음 |

### 향후 계획

key 기반 reconciliation 도입 예정. `spec.md` TODO에 기재되어 있다.

---

## 8. SSR 지원, 하이드레이션 미지원

### 결정

서버 사이드 렌더링은 지원하지만, **하이드레이션(Hydration)은 의도적으로 미지원**한다.

### 이유

`init()`에서 `containerElement.innerHTML = ''`로 기존 DOM을 모두 제거하고 처음부터 렌더링한다. SSR로 생성된 HTML은 **SEO 목적으로만 제공**되며, AEUI가 로드되면 완전히 새로 그린다.

하이드레이션은 서버에서 생성된 DOM을 클라이언트에서 재활용하여 초기 로딩 속도를 개선하는 기법이지만, 구현 복잡도가 매우 높고 AEUI의 polling 기반 반응성과의 통합이 까다롭다.

---

## 관련 문서

- Polling 반응성: `docs/internals/core/scheduler.md`
- Babel 변환: `docs/internals/babel-plugin/babel-plugin.md`
- Props 반응화: `docs/internals/core/dom.md` (`updateProps` 섹션)
- Watcher 실행: `docs/internals/core/watcher.md`
- Reconciliation: `docs/internals/core/reconciler.md`
