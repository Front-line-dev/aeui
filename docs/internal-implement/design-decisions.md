# 설계 결정 (Design Decisions)

## 개요

AEUI 프레임워크의 주요 설계 선택과 그 이유를 기록한다. "왜 이렇게 만들었는가?"에 대한 답변이다.

---

## 1. Polling(Dirty Checking) 반응성 시스템

### 결정

`setState`나 Proxy 같은 명시적 상태 알림 대신, **Dirty Checking + DOM 이벤트 fast path** 조합을 선택했다.

### 이유

**`let` 변수를 직접 수정하는 것만으로 UI를 업데이트**할 수 있게 하기 위함이다.

```jsx
// AEUI: let 변수 직접 수정
let count = 0;
count++;  // DOM 이벤트 안이면 다음 프레임, 그 외엔 polling으로 반영

// React: useState 호출 필요
const [count, setCount] = useState(0);
setCount(count + 1);
```

Proxy나 Signal 기반 방식은 객체를 래핑해야 하므로 `let` 직접 수정이 불가하다. Polling fallback은 **일반 JavaScript 변수의 직접 변이(mutation)**를 DOM 이벤트 밖에서도 감지할 수 있게 해준다. 여기에 AEUI가 등록한 DOM 이벤트가 끝나면 다음 프레임 렌더를 앞당기는 fast path를 더해, 클릭과 입력처럼 흔한 상호작용의 지연을 줄였다. 이것은 Babel 플러그인이 렌더 함수를 매 tick마다 재실행하는 구조와 결합되어 작동한다.

### 트레이드오프

| 장점 | 단점 |
|------|------|
| 사용자가 `useState` 같은 API를 배울 필요 없음 | DOM 이벤트 밖의 변경은 여전히 polling 지연 가능 |
| 직접 변이(`push`, `splice` 등) 가능 | 변경 없어도 매 tick마다 비교 비용 발생 |
| 코드가 일반 JavaScript처럼 자연스러움 | 복잡한 상태에서 `_deepEqual` 비용 증가 |

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

### 컴포넌트 변환 의존성

일반적인 `return <div />` 문법으로 상태를 유지하려면 컴포넌트를 setup/render 구조로 변환해야 한다. 로컬 빌드는 기본 SWC 변환기 또는 선택한 Babel 플러그인이 이 작업을 수행한다. 랜딩 코드 편집기는 방문자가 입력한 새 소스를 브라우저의 Babel Standalone으로 변환한다. 미리 빌드한 앱을 실행하거나 상태를 갱신할 때는 컴파일러가 필요하지 않다.

---

## 3. Babel·SWC 기반 코드 변환

### 결정

런타임 마법(Proxy, getter/setter)이 아닌 **컴파일 타임 코드 변환**을 선택했다.

### 이유

런타임 방식의 문제:
- Proxy: `let` 변수를 래핑할 수 없음, 객체/배열만 가능
- Compiler(Svelte 방식): 자체 컴파일러 필요 → 개발 복잡도 매우 높음
- Signal: `signal.value`처럼 접근자(.value) 필요 → 사용자 학습 비용

JavaScript·JSX 파싱과 코드 생성은 Babel 또는 SWC에 맡기고, AEUI의 컴포넌트 변환을 해당 AST에 적용한다. Vite는 기본적으로 SWC를 사용하며 Babel도 선택할 수 있다. 두 변환기의 출력은 같은 AEUI runtime을 사용하고 동일한 사용자 계약으로 검증한다.

### 트레이드오프

| 장점 | 단점 |
|------|------|
| 기존 JS 생태계 도구와 호환 | 컴포넌트 소스에 변환 과정 필요 |
| 기존 파서와 코드 생성기 사용 | 두 변환기의 동작을 함께 검증해야 함 |
| JSX를 그대로 활용 | 사용자 코드와 실행 코드가 다름 |

---

## 4. Props 반응화: 컴파일러가 만드는 props 저장 객체

### 결정

컴파일러가 props를 보관할 내부 객체를 만들고, **같은 객체 참조를 유지하면서 내용만 교체**하는 방식을 선택했다. 이 객체의 식별자는 사용자 코드와 충돌하지 않도록 컴파일러가 정하며, 생성되는 이름은 공개 API가 아니다.

### 이유

setup이 1회만 실행되므로 `function Comp({ name })`에서 `name`은 초기값으로 고정된다. 부모가 새 props를 전달해도 `name` 변수는 변하지 않는다.

컴파일러가 만든 props 저장 객체를 통해:
1. `updateProps(propsTarget, newProps)`로 내용을 교체하면
2. 렌더 함수가 `propsTarget`에서 값을 다시 읽을 때 항상 최신값을 얻는다
3. 같은 객체 참조이므로 클로저가 끊어지지 않는다

`updateProps`에서 기존 key를 delete 후 assign하는 방식은, 세밀한 비교를 하는 것보다 단순하다. 초기 코드 복잡성을 피하기 위한 설계이다.

---

## 5. Watcher가 Render보다 먼저 실행

### 결정

`runComponentWatchers`를 렌더 함수 **호출 전에** 실행한다.

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

## 6. 현재 컴포넌트 컨텍스트 전역 방식

### 결정

훅(`watch`, `clean`)이 현재 컴포넌트를 알기 위해 **active runtime stack 기반 컨텍스트**를 사용한다. 현재 런타임 모델에서 이 컨텍스트의 실제 대상은 "컴포넌트 인스턴스"가 아니라 **component RuntimeNode**다.

### 이유

React도 동일한 패턴을 사용한다 (`ReactCurrentDispatcher`). 훅 함수에 현재 node를 직접 전달하면 사용자 API가 복잡해진다:

```javascript
// ❌ 현재 node를 명시적으로 전달하면
watch(node, () => { ... }, [count]);  // 사용자가 불편

// ✅ 전역 변수로 암묵적 전달
watch(() => { ... }, [count]);            // 깔끔한 API
```

현재 AEUI의 모든 코드는 여전히 동기 중심으로 실행되지만, nested component setup/render 복구를 위해 컨텍스트는 stack으로 관리한다.

---

## 7. RuntimeNode 기반 Reconciliation (선택적 key 지원)

### 결정

`reconcile`은 `prevVNode + index` 비교가 아니라 **old RuntimeNode + new VNode** 비교를 사용한다. 형제 목록 diff는 RuntimeNode 배열 기준으로 처리하며, `key`가 있는 형제는 key로 우선 매칭하고 `key`가 없는 형제는 순서 기반으로 fallback 한다.

### 이유

초기 인덱스 기반 모델은 구현은 단순했지만, DOM 재배치와 컴포넌트 상태 보존이 부모의 순서 배열에 과도하게 의존했다. RuntimeNode가 자기 subtree와 DOM 범위를 직접 소유하도록 바꾸면:

- DOM 이동과 상태 이동을 같은 트리 연산으로 다룰 수 있고
- Fragment/배열/DOM/컴포넌트를 같은 diff 모델에서 처리할 수 있으며
- key 기반 재정렬에서도 상태 보존 규칙을 더 직접적으로 설명할 수 있다.

### 트레이드오프

| 장점 | 단점 |
|------|------|
| DOM ownership과 상태 ownership이 같은 트리 위에서 관리됨 | node 객체 수가 증가함 |
| 선택적 key reorder에서 상태 보존 규칙이 자연스러움 | `firstDom/lastDom` 범위를 계속 유지해야 함 |
| Fragment/배열을 같은 모델에서 처리 가능 | 런타임 구현 복잡도가 초기 모델보다 큼 |

---

## 8. 하이드레이션 미지원 (SSR 런타임 미구현)

### 결정

현재 코어 런타임에는 SSR 렌더 API가 구현되어 있지 않으며, **하이드레이션(Hydration)도 미지원**한다.

### 이유

`init()`에서 `containerElement.innerHTML = ''`로 기존 DOM을 모두 제거하고 처음부터 렌더링한다. 즉, 클라이언트 마운트 시점에 기존 마크업 재사용(하이드레이션)은 수행하지 않는다.

하이드레이션은 서버에서 생성된 DOM을 클라이언트에서 재활용하여 초기 로딩 속도를 개선하는 기법이지만, 구현 복잡도가 매우 높고 AEUI의 polling 기반 반응성과의 통합이 까다롭다.

---

## 관련 문서

- Polling 반응성: [06. 스케줄러](06-scheduler.md)
- Babel 변환: [10. Babel 컴파일러](10-babel-compiler.md)
- Props 반응화: [08. DOM 조작](08-dom.md) (`updateProps` 섹션)
- Watcher 실행: [15. Watcher 실행](15-watcher.md)
- Reconciliation: [03. Reconciliation](03-reconciler.md)
