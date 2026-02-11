# Level 3 — AEUI 내부 구조

> 이 문서는 AEUI 코드에 기여하거나 내부를 수정하려는 개발자를 위한 가이드이다. Level 2의 핵심 원리를 이해한 후 읽는다. 각 주제의 **상세한 구현**은 `docs/internals/` 폴더의 개별 문서를 참조한다.

---

## 코드 구조

### 소스 파일

```
packages/core/src/
├── core.js          460줄  모든 런타임 로직
├── hooks.js          22줄  watch, clean 훅
├── babel-plugin.js  331줄  Babel 변환 플러그인
└── index.js           3줄  진입점 (re-export)
```

### core.js 내부 모듈 (물리적으로는 하나의 파일)

| 모듈 | 함수 | 역할 | 상세 문서 |
|------|------|------|-----------|
| VNode | `createVNode`, `createElement`, `Fragment` | 가상 DOM 객체 생성 | `internals/core/vdom.md` |
| Instance | `createInstance`, `instance.update()` | 컴포넌트 런타임 상태 관리 | `internals/core/instance.md` |
| Scheduler | `init`, `_tick` | 렌더링 루프 관리 | `internals/core/scheduler.md` |
| Deep Compare | `_deepEqual`, `_deepClone` | 깊은 비교/복사 유틸리티 | `internals/core/deep-compare.md` |
| Watcher | `_runComponentWatchers` | 의존성 변경 감지 → 콜백 실행 | `internals/core/watcher.md` |
| DOM | `_createDomNode`, `_updateDomProps`, `updateProps` | 실제 DOM 조작 | `internals/core/dom.md` |
| Reconciler | `_reconcile`, `_getDomNodeCount` | VNode 비교 → DOM 최소 갱신 | `internals/core/reconciler.md` |
| Unmount | `_unmount` | 컴포넌트 정리 | `internals/core/unmount.md` |

---

## 전체 아키텍처 흐름

### 초기화 (app 로드)

```
AEUI.init(App, document.getElementById('root'))
  │
  ├── 이전 상태 정리 (중복 호출 방어)
  ├── container.innerHTML = '' (하이드레이션 미지원)
  ├── _tick() 최초 실행
  │   └── createVNode(App) → _reconcile → createInstance(App)
  │       └── App setup 실행 (1회)
  │           ├── let 변수 초기화
  │           ├── watch/clean 등록
  │           └── return () => JSX (렌더 함수)
  │       └── 렌더 함수 실행 → VNode 생성 → DOM 생성
  │
  └── setInterval(_tick, 1000) 시작
```

### 매 tick (1초마다)

```
_tick()
  └── _rootInstance.update()
      ├── _runComponentWatchers(instance)
      │   └── 각 watcher의 getDeps() vs oldDeps 비교
      │       └── 변경 시 callback 실행 + oldDeps 갱신
      │
      ├── instance.render(props)
      │   └── Babel 주입: updateProps + _runComponentWatchers
      │   └── JSX → createVNode → 새 VNode 트리 반환
      │
      └── _reconcile(container, newVNode, prevVNode)
          ├── 배열(Fragment)? → 각 요소 재귀
          ├── null? → DOM 노드 제거
          ├── 텍스트? → nodeValue 업데이트 또는 생성
          ├── 컴포넌트? → 인스턴스 재사용/생성 → render → 재귀
          └── DOM 요소? → _updateDomProps → children 재귀
```

### 이벤트 처리

```
사용자 클릭 → onClick 핸들러 실행 → let 변수 변경
  (이 시점에서는 DOM 변경 없음, 메모리상 변수만 변경됨)
  
... 최대 1초 후 ...

다음 tick → render 실행 → 클로저에서 변경된 변수 읽음 → 새 VNode → reconcile → DOM 업데이트
```

---

## 인스턴스 트리

컴포넌트가 다른 컴포넌트를 렌더링하면 인스턴스 트리가 형성된다.

```
App Instance
├── Header Instance
├── TodoList Instance
│   ├── TodoItem Instance (items[0])
│   ├── TodoItem Instance (items[1])
│   └── TodoItem Instance (items[2])
└── Footer Instance
```

각 인스턴스는 `parent`와 `children` 필드로 연결된다. `_reconcile`에서 컴포넌트 노드를 처리할 때 `_childCursor`를 사용하여 기존 인스턴스를 재사용한다.

---

## Reconciliation 알고리즘

`_reconcile`은 새 VNode과 이전 VNode을 비교하여 최소한의 DOM 조작을 수행한다.

### 5단계 분기

1. **배열** → 각 요소에 대해 재귀
2. **null** → 이전 DOM 노드 제거
3. **텍스트** → `nodeValue` 업데이트 또는 `createTextNode`
4. **컴포넌트** → 인스턴스 재사용/생성 → render → 재귀
5. **DOM 요소** → 같은 태그면 props 업데이트 + children 재귀, 다른 태그면 교체

### 인덱스 기반 비교

`parentElement.childNodes[index]`로 DOM 노드에 접근한다. key 기반 비교는 아직 미지원이므로, 리스트 중간 삽입/삭제 시 비효율이 발생한다.

상세한 알고리즘은 `docs/internals/core/reconciler.md` 참조.

---

## Babel 플러그인 변환

플러그인은 3가지 변환을 수행한다:

1. **Return 래핑**: `return JSX` → `return () => JSX`
2. **Props 반응화**: 파라미터 → `__props` 패턴
3. **Watch deps 래핑**: `[deps]` → `() => [deps]`

컴포넌트 판별은 PascalCase 이름 또는 JSX 태그 사용 여부로 한다.

상세한 변환 로직은 `docs/internals/babel-plugin/babel-plugin.md` 참조.

---

## 설계 결정

주요 설계 선택과 그 이유는 `docs/internals/design-decisions.md`에 문서화되어 있다:

- Polling 반응성 선택 이유
- Setup 1회 실행 구조
- Babel 의존성
- `__props` 패턴
- Watcher 실행 순서
- 인덱스 기반 reconciliation
- SSR/하이드레이션 정책

---

## 내부 문서 인덱스

### Core 런타임 (`docs/internals/core/`)
- [vdom.md](../internals/core/vdom.md) — VNode 생성
- [instance.md](../internals/core/instance.md) — 인스턴스 관리
- [scheduler.md](../internals/core/scheduler.md) — init, tick 루프
- [watcher.md](../internals/core/watcher.md) — watcher 실행 메커니즘
- [reconciler.md](../internals/core/reconciler.md) — reconciliation 알고리즘
- [dom.md](../internals/core/dom.md) — DOM 조작 함수
- [unmount.md](../internals/core/unmount.md) — 컴포넌트 정리
- [deep-compare.md](../internals/core/deep-compare.md) — 깊은 비교/복사

### 훅 (`docs/internals/hooks/`)
- [watch.md](../internals/hooks/watch.md) — watch 훅 상세
- [clean.md](../internals/hooks/clean.md) — clean 훅 상세

### Babel 플러그인 (`docs/internals/babel-plugin/`)
- [babel-plugin.md](../internals/babel-plugin/babel-plugin.md) — 코드 변환 전체 상세

### 설계 결정
- [design-decisions.md](../internals/design-decisions.md) — 주요 설계 선택 사유
