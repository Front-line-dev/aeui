# AEUI

VDOM 기반 프론트엔드 프레임워크. `let` 변수를 직접 수정하는 것만으로 UI를 업데이트한다.

```jsx
function Counter() {
  let count = 0;

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => count++}>+1</button>
    </div>
  );
}
```

React의 `useState`나 Svelte의 컴파일러 없이, **일반 JavaScript 변수의 직접 수정**으로 반응성을 구현한다.

---

## 핵심 특징

- **`let`이 곧 상태**: `let count = 0; count++;`만으로 UI 업데이트
- **직접 변이 가능**: `items.push()`, `obj.name = "..."` 등 일반 JavaScript 코드 사용
- **Setup 1회 실행**: 컴포넌트 함수 본문은 한 번만 실행, 렌더 함수만 반복
- **JSX 지원**: React와 동일한 JSX 문법
- **Babel 기반 변환**: 기존 빌드 도구(Vite, Webpack)와 통합
- **파일 기반 라우터 내장**: AEUI core가 `src/pages`와 일반 `<a>`를 이용한 디렉터리 라우팅 제공

---

## 시작하기

```bash
npx create-aeui-app my-app
cd my-app
npm install
npm run dev
```

---

## 문서

문서의 역할, 권위와 읽기 순서는 [문서 인덱스](docs/README.md)에서 먼저 확인한다.

### 구현 명세

| 문서 | 설명 |
|------|------|
| [AEUI 구현 명세](docs/spec/README.md) | 코드가 따라야 하는 규범, 현재 구현, 계획 기능, 수정 필요 항목 |
| [적합성 검증](docs/spec/10-conformance.md) | 문서 계약에서 새 테스트를 작성하고 추적하는 원칙 |

### 사용자 가이드

| 문서 | 설명 |
|------|------|
| [Level 1 — 기본 사용법](docs/guide/level-1.md) | 컴포넌트, 상태, props, watch, clean |
| [디렉터리 라우터](docs/guide/router.md) | core 파일 기반 라우팅과 페이지 규칙 |
| [Level 2 — 핵심 원리](docs/guide/level-2.md) | Babel 변환, VDOM, Tick 루프 |
| [Level 3 — 내부 구조](docs/guide/level-3.md) | 아키텍처, 코드 구조, 내부 문서 인덱스 |

### 내부 구현 상세

| 문서 | 설명 |
|------|------|
| [설계 결정](docs/internals/design-decisions.md) | 주요 설계 선택과 그 이유 |
| [Core 런타임](docs/internals/core/) | VNode, 인스턴스, Reconciler, DOM, 스케줄러, Watcher 등 |
| [Hooks](docs/internals/hooks/) | watch, clean 훅 상세 |
| [Babel 플러그인](docs/internals/babel-plugin/babel-plugin.md) | 코드 변환 로직 전체 |

### 기타

| 문서 | 설명 |
|------|------|
| [로드맵](docs/roadmap.md) | 향후 계획 |
| [기여 가이드](docs/contributing.md) | 개발 환경 설정, 빌드, 테스트 |

---

## 프로젝트 구조

```
aeui/
├── packages/core/          프레임워크 코어 (core.js, hooks.js, babel-plugin.js)
├── packages/create-aeui-app/  프로젝트 스캐폴딩 CLI
├── example/vite-demo/      데모 앱
├── example/commerce-admin/  오프라인 E-commerce + Admin 쇼케이스 예제
├── example/test/            테스트
└── docs/                    문서
```

---

## 라이선스

MIT
