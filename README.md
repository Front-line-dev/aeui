<p><img src="assets/brand/aeui-logo-wordmark.svg" alt="AEUI" width="240"></p>

# AEUI

**일반 `let` 변수를 직접 바꾸면 화면이 갱신되는 프론트엔드 프레임워크입니다.** JSX, VDOM, 파일 기반 라우터를 제공하며 React 런타임을 사용하지 않습니다.

```jsx
export default function Counter() {
  let count = 0;
  return <button onClick={() => count++}>클릭: {count}</button>;
}
```

## 현재 상태

`0.1.0-alpha.1` 공개를 준비 중인 **실험적 버전**입니다. API 변경 가능성이 있으며, 안정적인 프로덕션 지원을 약속하는 단계는 아닙니다. 이 저장소의 문서는 이 소스 버전에 해당합니다. npm에 이미 배포된 `0.0.1`은 이전 구현이므로 현재 문서와 동작이 다릅니다.

- Node.js: `^22.12.0 || >=24.0.0`
- Vite: 8.2.2 이상 8.x
- JavaScript/JSX, TypeScript/TSX 지원
- [알려진 결함](docs/issue/known-defects.md) · [계획 기능](docs/issue/planned-features.md)

## 지금 실행하기

아직 발행하지 않은 alpha 버전은 아래 저장소 실행 경로로 확인합니다.

```bash
git clone https://github.com/Front-line-dev/aeui.git
cd aeui
npm ci
npm run build:core
npm run dev --workspace commerce-admin
```

표시된 로컬 주소에서 상품 목록, 장바구니, 주문, 관리자 화면을 확인할 수 있습니다. [예제 사용 안내](example/commerce-admin/README.md)

릴리즈 노트에서 npm 발행 완료를 확인한 뒤에는 다음 명령으로 새 프로젝트를 만듭니다.

```bash
npx create-aeui-app@0.1.0-alpha.1 my-app
cd my-app
npm install
npm run dev
```

npm의 물리적 패키지 이름은 `a-easy-ui`이고, 앱에서는 `aeui`라는 npm alias를 사용합니다. CLI가 두 이름을 자동으로 연결합니다. [수동 설정](docs/user-scenario/07-project-config.md)

## 동작을 이해하기

- **Setup은 마운트마다 1회 실행됩니다.** Babel 플러그인이 컴포넌트의 반환 부분을 렌더 함수로 바꿉니다. 이후에는 렌더 함수가 반복 실행됩니다.
- **DOM 이벤트에서 바꾼 상태는 다음 프레임에 반영됩니다.** `count++`, `items.push()`, 객체 속성 수정처럼 일반 JavaScript를 사용합니다.
- **타이머·네트워크 등 외부 비동기 변경은 polling으로 감지합니다.** 활성 화면에서 약 1초까지 기다릴 수 있으며 백그라운드 탭은 브라우저의 실행 제한을 받습니다.
- **`watch(callback)`은 매 렌더마다, `watch(callback, [deps])`는 값이 바뀔 때 실행됩니다.** `clean(callback)`은 언마운트 정리를 등록합니다. 두 hook은 setup에서 호출합니다.
- **`src/pages` 파일이 경로가 됩니다.** 일반 `<a>`로 내부 페이지를 이동합니다.

React와 JSX 문법은 비슷하지만 컴포넌트 실행 방식, 이벤트, hook 계약은 다릅니다. React 컴포넌트·hook과의 호환성은 제공하지 않습니다. DOM/event 타입은 기본 수준이며, SSR과 동시 렌더링은 현재 지원 범위가 아닙니다.

## 랜딩 페이지

`npm run dev:landing`으로 소개 페이지와 편집 가능한 실행 예제를 확인할 수 있습니다. `npm run build:landing`은 GitHub Pages용 정적 파일을 생성합니다. [랜딩 페이지 개발 및 자동 배포 안내](landing/README.md)

## 문서와 기여

- [시작하기](docs/user-scenario/01-getting-started.md)
- [컴포넌트](docs/user-scenario/02-components.md) · [반응성](docs/user-scenario/03-reactivity.md) · [라우팅](docs/user-scenario/05-routing.md)
- [전체 문서와 문서 우선순위](docs/README.md)
- [기여하기](CONTRIBUTING.md) · [보안 문제 신고](SECURITY.md) · [릴리즈 절차](docs/releasing.md)

```bash
npm ci
npm test
npm run typecheck
npm run build
```

## 저장소 구조

| 위치 | 내용 |
|---|---|
| `packages/core` | 런타임, 컴파일러, Vite 플러그인, 공개 타입 |
| `packages/create-aeui-app` | 프로젝트 생성 CLI와 템플릿 |
| `example/test` | 단위·통합·회귀 테스트 |
| `example/commerce-admin` | 종합 예제 |
| `docs` | 사용자 계약, 내부 설계, 결함과 계획 |

## 라이선스

[ISC](LICENSE).
