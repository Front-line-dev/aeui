# AEUI Project Context

- GitHub Actions workflow를 추가하지 않는다.

이 프로젝트는 **AEUI (A Easy UI)**라는 자체 개발 프론트엔드 프레임워크의 모노레포입니다.
React와 유사한 VDOM 기반의 UI 라이브러리이지만, `setState` 대신 **일반 `let` 변수와 Dirty Checking 반응성 시스템**, 그리고 **컴파일러(Babel 플러그인) 기반의 Setup/Render 분리 모델**을 채택하고 있습니다.

---

## 1. 프로젝트 구조 (Monorepo)

```
aeui/
├── packages/
│   ├── core/                  # 프레임워크 핵심 런타임 및 컴파일러/빌드 플러그인
│   └── create-aeui-app/       # 프로젝트 생성 CLI 도구 (템플릿 포함)
├── docs/                      # 프레임워크 명세 및 설계 문서 (한국어 작성)
│   ├── README.md              # 문서 인덱스 및 권위 체계
│   ├── user-scenario/         # [우선순위 1] 사용자 계약 및 API 명세
│   ├── internal-implement/    # [우선순위 2] 내부 구현 및 아키텍처 명세
│   └── issue/                 # 알려진 결함 및 계획된 기능 추적
└── example/                   # 테스트 스위트 및 데모 애플리케이션
    ├── test/                  # 핵심 단위/통합 테스트 (Vitest)
    ├── vite-demo/             # 기본 데모 앱
    ├── commerce-admin/        # 종합 실전 예제 (라우팅, 폼, 상태 관리)
    ├── deep-compare-test/     # 반응성 및 깊은 비교 테스트용 앱
    ├── letProps/              # props 반응성 데모
    └── shoppingCart/          # 바닐라 연동 예제
```

---

## 2. 핵심 아키텍처 및 철학

### 2.1 컴포넌트 모델 (Setup / Render 분리)
- **함수 본문(Setup)은 마운트 시 최초 1회만 실행**됩니다 (Closure 활용).
- 상태 변경 시 재실행되는 것은 반환된 **렌더 함수(`() => JSX`)**입니다.
- **Babel 컴파일러**(`babel-plugin.js`)가 빌드 시점에 `return (JSX)`를 `return () => (JSX)`로 자동 변환하고, props 반응화 래퍼(`runRenderPhase`)를 주입합니다.

### 2.2 반응성 시스템 (Dirty Checking & Scheduler)
- `setState`나 별도 Setter 함수가 없습니다. 일반 `let` 변수를 상태로 직접 변경합니다 (`count++`).
- **DOM 이벤트 핸들러** 실행 후에는 다음 프레임에 **즉시** 화면이 갱신됩니다.
- 비동기 작업(타이머, 네트워크 등) 후에는 `scheduler.js`의 **Polling 루프(`tick`)**를 통해 변경 사항을 감지하여 갱신합니다.
- 객체와 배열은 `deep-compare.js`의 **깊은 비교(`_deepEqual`)**로 감지합니다.

### 2.3 훅 시스템 (`watch`, `clean`)
- `watch(cb, [deps])`: 상태 변경에 반응하여 부수 효과를 실행합니다. deps가 없으면 매 렌더마다 실행되며, deps가 있으면 해당 값 변경 시에만 실행됩니다.
- `clean(cb)`: 컴포넌트 언마운트 시 정리 작업을 등록합니다.
- `watch`와 `clean`은 컴포넌트의 **Setup 단계(함수 본문 최상위)에서만 호출 가능**합니다.

### 2.4 순수 바닐라 구현
- `react` 등 외부 UI 라이브러리를 일절 사용하지 않습니다.
- VDOM 생성, Reconciliation, DOM 조작, 라우팅 모두 자체 구현 모듈로 동작합니다.

---

## 3. 핵심 소스 맵 (`packages/core/src/`)

| 파일 | 역할 및 주요 책임 |
|---|---|
| `core.js` | `AEUI` 기본 인스턴스 export, `createVNode`, `Fragment` 정의 |
| `app-runtime.js` | `createAppRuntime`, 독립된 앱 상태(`RuntimeState`) 및 라이프사이클 관리 |
| `runtime.js` | 앱 인스턴스 팩토리, `mount`, `render`, `unmount` 진입점 |
| `runtime-state.js` | 런타임 노드 트리 및 변경 플래그(`didMutate`) 상태 관리 |
| `runtime-context.js` | 컴포넌트 실행 컨텍스트 스택(`withComponentContext`, phase: `'setup'`/`'render'`) |
| `reconciler.js` | VDOM Diffing, DOM 요소 배치/이동, 재조정(Reconciliation) |
| `node-factory.js` | `createNode` (text, host, fragment, component) |
| `vnode-helpers.js` | VNode 타입 검사, key 추출, Fragment 자식 정규화 |
| `vnode-marker.js` | VNode 식별용 내부 심볼/마커 |
| `dom-host.js` | DOM 노드 생성, props/style/className 반영, 이벤트 위임/프록시, controlled input |
| `component-lifecycle.js` | 컴포넌트 setup/render 호출, 인스턴스 캐싱, 렌더링 결과 commit, unmount 정리 |
| `component-watchers.js` | 렌더 주기별 watcher 실행 및 deps 비교 엔진 |
| `hook-registry.js` | setup 중 `watch` / `clean` 등록 및 유효성 검증 |
| `hooks.js` | `watch`, `clean` public API export |
| `deep-compare.js` | 깊은 비교(`_deepEqual`), 안전한 깊은 복제(`_deepClone`) |
| `compiler-runtime.js` | Babel 컴파일된 코드와 런타임 연결 브리지(`runRenderPhaseBridge`) |
| `babel-plugin.js` | AEUI 컴포넌트 감지, return 팩토리 변환, props 구조분해 반응화, watch deps getter 변환 |
| `router.js` | 파일 시스템 기반 디렉터리 라우터, 경로 매칭 및 동적 파라미터 파싱 |
| `vite-plugin.js` | Vite 연동 플러그인 (Babel 변환, 가상 엔트리 주입, 라우터 연동) |

---

## 4. 문서 권위 체계 및 작성 규칙

1. **문서 우선순위**:
   - **1순위 (최우선)**: `docs/user-scenario/` (사용자 관점의 명세이자 최종 계약)
   - **2순위**: `docs/internal-implement/` (내부 구현 설계 및 기술 명세)
   - **3순위**: 소스 코드 (문서에 명시되지 않은 세부 동작은 코드가 명세)
2. **이슈 및 결함 관리**:
   - 구현이 `user-scenario`와 일치하지 않거나 결함 발견 시 `docs/issue/known-defects.md`에 기록
   - 미구현 기능 및 로드맵은 `docs/issue/planned-features.md`에 기록
3. **언어 규칙**: 문서는 일관되게 **한국어**로 작성합니다.

---

## 5. 개발 및 검증 가이드라인

### 5.1 명령어
- **테스트 실행**: `npm test` (전체 Vitest 스위트 실행)
- **빌드**: `npm run build` (`packages/core` 및 예제 앱 빌드)
- **코어 빌드**: `npm run build:core`
- **타입 검사**: `npm run typecheck`

### 5.2 작업 시 주의사항
- **프레임워크 코어 수정**: 프레임워크 소스 코드는 오직 `packages/core/src/` 내부에서만 수정해야 합니다.
- **Babel 변환 결과 의식**: 컴포넌트 코드 작성 및 분석 시, Babel 컴파일러가 변환한 후의 런타임 동작(setup 1회 실행, render 반복 실행, closure 캡처, watch getter)을 항상 염두에 두어야 합니다.
- **과도한 설명 지양**: 문서나 코드 작성 시 불필요한 사족을 지양하고, 본질적이고 명확한 형태를 유지합니다.
- **회귀 검증**: 코어 코드 수정 후에는 반드시 `npm test`를 실행하여 기존 테스트가 모두 통과하는지 확인합니다.
