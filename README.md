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

별도의 상태 setter 없이, Babel 변환과 주기적인 값 비교를 이용해 **일반 JavaScript 변수의 직접 수정**을 화면에 반영한다.

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

- `docs/user-scenario/` — 사용자에게 약속한 동작을 정의하는 문서
- `docs/internal-implement/` — 약속한 동작을 코드로 구현하는 방법을 설명하는 문서

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
