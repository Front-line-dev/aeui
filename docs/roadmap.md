# 로드맵 (Roadmap)

> 기존 `docs/old-docs/spec.md`, `docs/old-docs/feature-to-be-implemented.md`의 TODO와 최근 코어 정리 작업을 함께 반영한 문서이다.

---

## ✅ 최근 완료

### Key 기반 Reconciliation

같은 형제 목록에서 key가 있는 node는 key로 우선 매칭하고, key가 없는 node는 순서 기반으로 fallback 하도록 정리했다. 리스트 재정렬과 삽입/삭제에서 DOM과 component state를 더 안정적으로 보존한다.

### Core Lifecycle 단순화

코어 구조를 다음 축으로 재정리했다.

- `vnode-helpers.js`로 key / fragment 판별 공통화
- `runtime-state.js`로 mutable runtime 상태 분리
- `component-lifecycle.js`, `component-watchers.js`로 component 실행 경로 분리
- Babel render wrapper를 `AEUI._runRenderPhase()` 단일 계약으로 축소
- file input `value` 동기화 예외를 반영해 controlled host prop 경계 보강

이 변경으로 `core.js`, `runtime.js`, `reconciler.js`, `babel-plugin.js`의 책임이 이전보다 명확해졌다.

---

## 🟡 중간 우선순위

### 현재 컴포넌트 컨텍스트 스택 구조 전환

지금도 `currentComponentNode` / `currentInstance`는 단일 슬롯 기반이다. 비동기 렌더링이나 중첩 실행 안전성을 높이려면 stack 기반 context로 전환하는 편이 낫다.

### 런타임 facade 축소

현재 `AEUI`는 호환성 때문에 underscore accessor와 여러 internal wrapper를 계속 노출한다. 다음 단계에서는:

- 진짜 public API와 internal test hook 구분
- legacy alias 축소
- state-bound helper 연결 방식 단순화

를 검토할 수 있다.

### 문서/테스트 coverage 확장

이번 정리로 Babel, lifecycle, runtime-state 테스트는 보강됐지만 다음은 추가 여지가 있다.

- fragment reorder edge case
- nested destructuring props with render param variants
- cleanup/watch ordering regression

---

## 🟢 장기 계획

### TypeScript 타입 정의

- `packages/core/types/index.d.ts` 추가
- 최소한 `AEUI`, `watch`, `clean`, `createVNode` 타입 선언
- `package.json`의 `types` 필드 정리

### 빌드 설정 개선

- minification 플러그인 추가
- source map 생성
- `sideEffects` 메타데이터 검토

### `create-aeui-app` CLI 개선

- AEUI 버전 자동 삽입
- `.gitignore` 자동 생성
- 선택형 템플릿 제공

### 모노레포 워크스페이스 개선

- 루트 공통 스크립트
- lint / format 설정
- example 앱 실행 흐름 통합
