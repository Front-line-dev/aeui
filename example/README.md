# AEUI 예제

아래 예제는 모두 Vite 앱입니다. 개발 서버와 빌드 과정에서 Node.js의 SWC가 JSX와 컴포넌트를 변환하고, 브라우저는 결과 JavaScript를 실행합니다.

| 예제 | 확인할 동작 |
|---|---|
| `vite-demo` | 상태, props, watch, clean, keyed list |
| `deep-compare-test` | 동일 값 재할당과 객체의 직접 변경 구분 |
| `commerce-admin` | 라우팅, 폼, 상품·주문 관리 |
| `letProps` | 자식의 버튼으로 부모의 `let` 값을 바꾸고 양쪽 화면 갱신 |
| `shoppingCart` | 항목 수량을 직접 바꾸고 같은 항목의 DOM·합계 갱신 |

## 작은 예제 실행

저장소 루트에서 의존성을 설치하고 코어를 빌드합니다.

```sh
npm ci
npm run build:core
```

실행할 예제를 선택합니다.

```sh
npm run dev --workspace aeui-let-props
npm run dev --workspace aeui-shopping-cart
```

각 예제의 `src/main.jsx`에 컴포넌트와 시작 코드가 있고, `index.html`은 이 파일을 모듈 진입점으로 지정합니다. 소스 HTML을 파일로 직접 열지 않고 Vite 개발 서버의 주소로 접속합니다.

## 정적 빌드와 확인

```sh
npm run build --workspace aeui-let-props
npm run preview --workspace aeui-let-props

npm run build --workspace aeui-shopping-cart
npm run preview --workspace aeui-shopping-cart
```

각 디렉터리의 `dist/`가 빌드 결과입니다. 저장소 루트의 `npm run build:examples`와 `npm run build`에도 두 예제가 포함됩니다.

두 예제는 방문자가 코드를 편집하는 기능이 없으므로 웹 컴파일러가 필요하지 않습니다. 버튼 클릭과 수량 변경은 이미 변환된 render 함수를 실행합니다. 새 JSX를 브라우저에서 편집·실행하는 기능은 [랜딩 코드 편집기](../landing/README.md#웹-컴파일러를-사용하는-이유)에서 확인할 수 있습니다.
