# Watcher 실행 — `_runComponentWatchers`

## 개요

`_runComponentWatchers`는 컴포넌트에 등록된 모든 **watcher(감시자)**의 의존성을 체크하고, 변경이 감지되면 콜백을 실행한다.

watcher는 `watch()` 훅으로 등록되며, "특정 값이 변경되면 이 코드를 실행해라"라는 선언이다. React의 `useEffect`와 유사한 역할을 한다.

```javascript
// 사용자 코드
let count = 0;
watch(() => {
  console.log("count가 변경됨:", count);
}, [count]);

// count가 변경되면 다음 tick에서 console.log가 실행됨
```

---

## 함수 시그니처

```javascript
_runComponentWatchers(instance)
```

| 파라미터 | 설명 |
|----------|------|
| `instance` | watcher를 실행할 컴포넌트 인스턴스. `instance.watchStates`에 등록된 watcher들을 순회한다 |

---

## 동작 과정

```
instance.watchStates 배열을 순회:
  각 watcher에 대해:
    1. getDeps() 호출 → 현재 의존성 값 배열 획득
       예: () => [count]가 호출되어 [3] 반환

    2. oldDeps (이전 스냅샷)와 비교
       _deepEqual로 각 요소를 비교:
       ├── oldDeps가 null → 변경됨 (초기 상태 이후 첫 변경)
       └── 하나라도 다른 요소가 있음 → 변경됨

    3. 변경된 경우:
       ├── callback() 실행 (사용자가 등록한 함수)
       └── oldDeps = _deepClone(newDeps)
           (현재 값의 깊은 복사본을 저장하여 다음 비교에 사용)

    4. try-catch로 감싸 에러 발생 시:
       console.error로 로깅, 다음 watcher로 계속 진행
```

### 코드

```javascript
runComponentWatchers(instance, deepEqual, deepClone) {
  if (!instance.watchStates) return;
  instance.watchStates.forEach((watcher) => {
    try {
      const newDeps = watcher.getDeps();          // 현재 의존성 값
      const hasChanged =
        !watcher.oldDeps ||                       // 이전 값 없음 (첫 변경)
        newDeps.some((d, i) =>                    // 하나라도 다른 요소가 있으면
          !deepEqual(d, watcher.oldDeps[i])
        );

      if (hasChanged) {
        watcher.callback();                       // 콜백 실행
        watcher.oldDeps = deepClone(newDeps);     // 스냅샷 저장
      }
    } catch (e) {
      console.error('[AEUI] Watcher error:', e);
    }
  });
}
```

---

## Watcher 구조

`watch()` 훅으로 등록되는 각 watcher 객체의 형태:

```javascript
{
  callback: Function,     // 의존성 변경 시 실행할 함수
  getDeps: () => Array,   // 현재 의존성 값을 반환하는 함수
  oldDeps: Array | null   // 이전 의존성 스냅샷 (깊은 복사본)
}
```

각 필드의 역할:

| 필드 | 설명 |
|------|------|
| `callback` | 의존성이 변경되었을 때 실행할 사용자 정의 함수. 예: `() => console.log("변경됨")` |
| `getDeps` | 호출될 때마다 현재 의존성 값들의 배열을 반환하는 함수. 예: `() => [count, name]`이면 호출 시 `[3, "홍길동"]`을 반환 |
| `oldDeps` | 마지막으로 callback이 실행된 시점의 의존성 값의 **깊은 복사본**. 다음 tick에서 `getDeps()` 결과와 비교하여 변경 여부를 판단 |

### getDeps가 함수인 이유

사용자는 `watch(cb, [count])`처럼 배열을 직접 전달하지만, Babel 플러그인이 이를 `watch(cb, () => [count])`로 변환한다.

왜 함수로 변환해야 하는가:

```javascript
// ❌ 배열을 직접 전달하면
let count = 0;
watch(cb, [count]);
// 이 시점에 [count]는 [0]으로 평가되어 고정된다
// 이후 count가 3이 되어도 getDeps()는 항상 [0]을 반환
// → 변경을 영원히 감지하지 못함

// ✅ 함수로 감싸면
let count = 0;
watch(cb, () => [count]);
// getDeps 호출마다 클로저에서 현재 count 값을 읽어 새 배열을 생성
// count가 3이면 getDeps()는 [3]을 반환
// → [0] vs [3] 비교로 변경 감지 성공
```

### oldDeps에 `_deepClone`을 사용하는 이유

의존성 값이 원시값(number, string)이면 복사가 불필요하지만, 객체나 배열이면 **참조 복사로는 부족**하다.

```javascript
let items = [1, 2, 3];
watch(() => console.log("changed"), [items]);

// items.push(4) 실행 후:

// 만약 oldDeps가 참조 복사(얕은 복사)였다면:
//   oldDeps[0] === items (같은 배열 참조)
//   → items가 [1,2,3,4]로 변경되면 oldDeps[0]도 [1,2,3,4]
//   → _deepEqual([1,2,3,4], [1,2,3,4]) = true
//   → 변화를 감지하지 못함 ❌

// 깊은 복사(deepClone)라면:
//   oldDeps[0] = [1,2,3] (독립된 복사본)
//   items = [1,2,3,4] (원본이 수정됨)
//   → _deepEqual([1,2,3,4], [1,2,3]) = false
//   → 변화를 감지함 ✅
```

---

## 호출 시점

`_runComponentWatchers`는 의도적으로 **여러 곳에서 호출**된다:

| 호출 위치 | 코드 위치 | 시점 |
|-----------|-----------|------|
| `_reconcile` 내부 (4단계: Component Node) | `packages/core/src/reconciler.js` | 컴포넌트 render 호출 직전 |
| Babel 플러그인이 렌더 함수에 주입 | `packages/core/src/babel-plugin.js` (변환된 코드) | render 함수 시작부에서 props 업데이트 직후 |
| `instance.update()` 메서드 내부 | `packages/core/src/runtime.js` | 루트 인스턴스의 tick에서 render 호출 직전 |

### 왜 render 전에 실행하는가

watch callback이 **상태를 변경**할 수 있기 때문이다. 예를 들어:

```javascript
let count = 0;
let displayText = "";

watch(() => {
  displayText = `카운트: ${count}`;  // ← watch가 상태를 변경
}, [count]);

return <p>{displayText}</p>;
```

watcher를 render보다 먼저 실행하면, `displayText`가 먼저 갱신된 후 JSX에서 최신 값으로 렌더링된다. 만약 render를 먼저 실행하면 `displayText`가 이전 값인 채로 렌더링되고, watch에 의한 변경은 다음 tick(최대 1초)까지 반영되지 않는다.

### 다중 호출에도 callback이 1번만 실행되는 이유

`_runComponentWatchers`가 한 tick에서 2~3번 호출되더라도, callback은 실제로 **1번만 실행**된다. 첫 호출에서 변경이 감지되면:
1. callback 실행
2. `oldDeps = _deepClone(newDeps)` → oldDeps이 현재 값으로 갱신

이후 같은 tick에서 두 번째 호출이 오면:
- `getDeps()` 결과와 방금 갱신된 `oldDeps`가 같음
- `_deepEqual` → 변경 없음
- callback 미실행

### `_reconcile` 내 호출과 Babel 주입 호출의 역할 분담

이 두 호출의 정확한 역할 분담에 대해서는 추가 분석이 필요하다.
<!-- TODO: 추후 분석을 통해 각 호출 시점의 정확한 역할 규명 필요 -->

---

## 에러 격리

```javascript
try {
  // watcher 실행
} catch (e) {
  console.error('[AEUI] Watcher error:', e);
}
```

각 watcher를 개별 `try-catch`로 감싸서, 하나의 watcher에서 에러가 발생해도 **나머지 watcher는 정상 실행**된다. 이렇게 하면 하나의 watch callback에 버그가 있어도 전체 컴포넌트가 멈추지 않는다.

---

## 관련 코드 위치

- watcher 실행 엔진: `packages/core/src/runtime.js`
- 런타임 래퍼 (`AEUI._runComponentWatchers`): `packages/core/src/core.js`
- `watch` 훅 (watcher 등록): `packages/core/src/hooks.js` L3-L15
