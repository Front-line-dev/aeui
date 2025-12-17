---
trigger: always_on
---

# AEUI Project Context

이 프로젝트는 **AEUI (A Easy UI)**라는 자체 개발 프론트엔드 프레임워크의 모노레포입니다.
React와 유사한 VDOM 기반의 프레임워크이나, Dirty Checking 반응성 시스템과 컴파일러(Babel 플러그인) 의존적인 문법을 가지고 있습니다.

## 1. 프로젝트 구조 (Monorepo)
- **`packages/core`**: 프레임워크의 핵심 런타임 및 컴파일러 플러그인이 위치합니다.
  - `src/core.js`: VDOM 생성, Diffing, Reconciliation, 인스턴스 트리 관리, Polling(`tick`) 기반 반응성 루프.
  - `src/hooks.js`: `watch`, `clean` 등의 훅 정의.
  - `src/babel-plugin.js`: AEUI 전용 Babel 플러그인. JSX 변환, 컴포넌트 래핑(`() => JSX`), 의존성 주입 등 필수적인 트랜스파일링 담당.
- **`packages/create-aeui-app`**: CLI 도구.
- **`docs/`**: 디자인 문서 및 사용자 가이드 (주로 한글 작성).
- **`example/`**: 테스트 및 데모용 애플리케이션 (`vite-demo`, `shoppingCart` 등).

## 2. 핵심 아키텍처 및 철학
- **컴포넌트 모델**:
  - 함수형 컴포넌트를 사용하지만, **함수 본문은 마운트 시 단 한 번만 실행**됩니다(Closure 활용).
  - 렌더링마다 재실행되는 것은 반환된 렌더 함수(`() => JSX`)입니다.
  - 이를 위해 Babel 플러그인이 `return (JSX)`를 `return () => (JSX)` 형태로 자동 변환합니다.
- **반응성 시스템 (Reactivity)**:
  - `setState`가 없습니다. 일반 `let` 변수를 상태로 사용합니다.
  - 별도의 Setter 없이, `core.js` 내부의 **1초 간격(또는 유동적) Polling (`_tick`)**을 통해 변경 사항을 감지하고 리렌더링합니다.
  - `watch(callback, dependencies)` 훅을 통해 특정 상태 변경에 반응합니다.
- **스펙 (Spec)**:
  - `react` 패키지를 사용하지 않습니다. 모든 로직은 바닐라 JS로 구현됩니다.
  - DOM 조작은 `core.js`의 `_reconcile` 함수에서 수행됩니다.

## 3. 개발 규칙 (Rules)
- **문서화**: 새로운 기능 추가나 변경 시 `docs/` 내의 문서(특히 `spec.md`)를 최신화해야 합니다. 문서는 주로 **한국어**로 작성합니다.
- **Babel 의존성 주의**: 컴포넌트 코드를 작성하거나 분석할 때, 항상 **Babel 플러그인에 의해 변환될 결과**를 염두에 두어야 합니다. (예: `watch`의 의존성 배열 `[a, b]`는 `() => [a, b]`로 변환됨).
- **파일 시스템**:
  - 프레임워크 코어 수정은 오직 `packages/core` 내에서만 이루어져야 합니다.
  - 테스트는 `example/` 디렉토리의 프로젝트를 활용합니다.