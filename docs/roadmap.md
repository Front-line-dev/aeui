# 로드맵 (Roadmap)

> 기존 `spec.md`, `feature-to-be-implemented.md`, `implementing.md`의 TODO 항목과 분석 결과를 통합한 문서이다.

---

## 🔴 높은 우선순위

### 적응형 Tick Interval

**현재**: 고정 1초 `setInterval`. 버튼 클릭 후 최대 1초 대기.

**목표**: 이벤트 발생 시 즉시 `_tick()` 실행, 유휴 시 간격을 점진적으로 늘리는 방식으로 변경.

**접근 방향**:
- 이벤트 핸들러 실행 후 dirty flag 설정 → `requestAnimationFrame` 기반 즉시 tick
- 변경 감지 시 빠른 tick, 미감지 시 점진적 간격 증가

---

### Key 기반 Reconciliation

**현재**: 인덱스 기반 비교만 수행. 리스트 중간 삽입/삭제 시 이후 모든 노드가 불필요하게 업데이트됨.

**목표**: `key` prop을 지원하여 노드를 key로 식별, 이동/삽입/삭제를 정확히 판별.

---

### `_getDomNodeCount` 정확화

**현재**: 컴포넌트 노드를 무조건 `return 1`로 처리. Fragment나 배열을 반환하는 컴포넌트에서 인덱스 계산 오류.

**목표**: 컴포넌트의 `prevRenderedVNode`을 재귀적으로 추적하여 실제 DOM 노드 수 반환.

---

## 🟡 중간 우선순위

### 이벤트 핸들러 최적화

인라인 함수(`onClick={() => ...}`)는 매 tick마다 새 함수가 생성되어 리스너가 교체된다. 이벤트 위임(Event Delegation) 또는 프록시 핸들러 패턴 도입 검토.

### `_deepEqual`/`_deepClone` 순환 참조 보호

`WeakSet`으로 방문 추적 추가. 순환 참조 객체 사용 시 무한 루프 방지.

### DOM↔컴포넌트 타입 전환 처리

같은 위치에 DOM 요소 → 컴포넌트, 또는 컴포넌트 → 텍스트 전환 시 이전 노드 정리 로직 개선.

### Watcher 중복 실행 분석

`_runComponentWatchers`가 여러 곳에서 호출되는 구조 분석, 필요시 호출 지점 통합 검토.

### Babel 플러그인 테스트

현재 전체 미테스트 상태. AST 변환 결과 검증 테스트 추가 필요.

### 테스트 방식 전환

현재 Vitest + jsdom 기반. 브라우저 기반 E2E 테스트 도입 검토 (Playwright 등).

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
