# 로드맵 (Roadmap)

> 기존 `docs/old-docs/spec.md`, `docs/old-docs/feature-to-be-implemented.md`의 TODO 항목과 분석 결과를 통합한 문서이다.

---

## ✅ 최근 완료

### Key 기반 Reconciliation

같은 형제 목록에서 `key`가 있는 노드는 key로 우선 매칭하고, `key`가 없는 노드는 기존 순서 기반으로 fallback 하도록 구현했다. 덕분에 리스트 중간 삽입/삭제/재정렬에서 DOM 노드와 컴포넌트 상태를 더 정확히 보존한다.

### Core Lifecycle 구조 단순화

최근 코어 정리 작업으로 다음이 반영되었다.

- `runtimeState` 기반의 explicit 상태 저장 구조 도입
- `component-lifecycle.js`, `component-watchers.js` 분리
- Babel render wrapper를 `AEUI._runRenderPhase()` 단일 계약으로 축소
- 공통 vnode helper 분리
- controlled host prop 경계 보강 (`input[type="file"]`의 `value` 예외 처리)

이로써 `core.js`, `runtime.js`, `reconciler.js`, `babel-plugin.js`의 책임이 이전보다 명확해졌다.

---

## 🟡 중간 우선순위

### 런타임 facade 축소

현재 `AEUI`는 호환성 때문에 underscore accessor와 여러 internal wrapper를 계속 노출한다. 장기적으로는 public API와 internal helper 경계를 더 분명히 나눌 필요가 있다.

### 문서/테스트 coverage 확장

최근 테스트는 많이 보강됐지만, 다음과 같은 회귀 케이스는 추가 여지가 있다.

- fragment reorder edge case
- nested destructuring props + render param 조합
- cleanup/watch ordering regression

---

## 🟢 장기 계획

### TypeScript 타입 정의

- `packages/core/types/index.d.ts` 추가
- 최소한 `AEUI`, `watch`, `clean`, `createVNode`의 타입 선언
- `package.json`에 `types` 필드 추가

### 현재 컴포넌트 컨텍스트 스택 구조 전환

비동기 렌더링 대비, 현재의 단일 전역 component context를 스택 구조로 변경. 내부 alias인 `_currentInstance`는 최종적으로 제거 대상이다.

### 빌드 설정 개선

- Rollup에 minification 플러그인 추가 (`@rollup/plugin-terser`)
- Source map 생성
- `package.json`에 `sideEffects: false` 추가

### `create-aeui-app` CLI 개선

- AEUI 버전을 동적으로 삽입
- `.gitignore` 자동 생성
- 선택적 템플릿 (minimal / with-router / with-ssr)

### 모노레포 워크스페이스 개선

- 루트 `package.json`에 공통 스크립트 추가
- ESLint, Prettier 설정
