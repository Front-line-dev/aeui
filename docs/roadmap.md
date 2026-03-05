# 로드맵 (Roadmap)

> 기존 `docs/old-docs/spec.md`, `docs/old-docs/feature-to-be-implemented.md`의 TODO 항목과 분석 결과를 통합한 문서이다.

---

## 🔴 높은 우선순위

### Key 기반 Reconciliation

**현재**: 인덱스 기반 비교만 수행. 리스트 중간 삽입/삭제 시 이후 모든 노드가 불필요하게 업데이트됨.

**목표**: `key` prop을 지원하여 노드를 key로 식별, 이동/삽입/삭제를 정확히 판별.

---

## 🟡 중간 우선순위

### Watcher 중복 실행 분석

`_runComponentWatchers`가 여러 곳에서 호출되는 구조 분석, 필요시 호출 지점 통합 검토.

### Babel 플러그인 테스트

현재 전체 미테스트 상태. AST 변환 결과 검증 테스트 추가 필요.

---

## 🟢 장기 계획

### TypeScript 타입 정의

- `packages/core/types/index.d.ts` 추가
- 최소한 `AEUI`, `watch`, `clean`, `createVNode`의 타입 선언
- `package.json`에 `types` 필드 추가

### `_currentInstance` 스택 구조 전환

비동기 렌더링 대비, 단일 전역 변수를 스택 구조로 변경.

### `core.js` 파일 분할

460줄 단일 파일을 책임별로 분리: `vdom.js`, `reconciler.js`, `dom.js`, `scheduler.js`, `util.js`, `instance.js`.

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
