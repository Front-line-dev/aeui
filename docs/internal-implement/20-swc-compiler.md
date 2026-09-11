# 20. SWC 컴파일러

SWC 컴파일러는 컴포넌트 소스를 받아 setup/render 준비 코드와 JSX runtime 호출로 변환하는 Node.js용 도구다. 공개 진입점은 `aeui/swc`이며, Vite 플러그인의 기본 변환 경로도 이 함수를 호출한다.

구현은 파싱, 컴포넌트 AST 변환, 코드 생성으로 나뉜다. 호출 방법과 설정 예시는 [Babel·SWC 튜토리얼](../tutorial/compiler-setup.md#swc로-변환하기)에 있다.

## 처리 경로

`swc-transform.js`는 다음 순서로 소스를 처리하고 `{ code, map }`을 반환한다.

| 단계 | 입력 → 출력 | 담당 |
|---|---|---|
| 파싱 | JavaScript·TypeScript와 JSX 소스 → SWC AST | `swc-fragments.js`, `Compiler.parseSync` |
| 컴포넌트 준비 | 함수 AST → 원본 함수와 등록할 setup AST | `swc-components.js` |
| 코드 생성 | 변환한 AST → 타입을 제거한 JavaScript와 source map | `Compiler.transformSync` |

JSX 출력에는 `runtime: 'automatic'`, `importSource: 'aeui'`를 적용한다. `development`가 참이면 `aeui/jsx-dev-runtime`, 거짓이면 `aeui/jsx-runtime`에 연결한다. VNode 생성 규칙은 [JSX runtime 구현](02-vdom.md#automatic-jsx-runtime-연결)을 따른다.

컴포넌트 변환은 JavaScript로 작성한 SWC AST 변환기다. Babel AST나 Babel 실행을 거치지 않으며, SWC의 JavaScript plugin callback 대신 파싱한 AST를 코드 생성기에 전달한다. 파싱과 코드 생성에 같은 `Compiler`를 사용해 소스 위치를 연결하고, 인접 JSX를 보정했다면 마지막에 원본 source map과 합성한다.

네이티브 파서·코드 생성기와 JavaScript AST 사이에는 직렬화 비용이 있다. 전체 개발 서버의 성능은 이 변환 단계와 별도로 측정한다.

## 파일 경계

| 파일 | 역할 |
|---|---|
| `swc-transform.js` | Node.js 공개 변환 진입점과 SWC 호출 |
| `swc-components.js` | 컴포넌트·props·hook 변환 |
| `swc-ast.js` | binding 분석, AST 생성과 참조 재작성 |
| `swc-fragments.js` | 인접 JSX 파싱과 source map |

이 모듈들은 런타임 상태를 import하지 않는다. 생성 코드만 공개 AEUI runtime과 JSX runtime에 연결한다.

## Binding과 컴포넌트 판별

SWC resolver가 부여한 identifier의 `ctxt`와 이름을 함께 사용해 binding을 식별한다. import alias, 함수 parameter, 변수 선언, 재할당을 수집하며 같은 이름의 지역 변수와 외부 모듈의 hook을 구분한다. 함수나 getter를 실행해 컴포넌트를 추측하지 않는다.

후보 범위는 Babel과 같은 사용자 계약을 따른다.

- JSX·VNode를 반환하는 함수와 수동 render 함수
- JSX 태그·props, AEUI 생성/초기화 호출에서 별칭·재할당·단순 객체 속성으로 도달하는 함수
- export된 함수의 리터럴·props·children 반환

후보는 안쪽부터 변환한다. 원래 함수는 일반 호출용으로 남기고, 별도의 setup을 `registerComponent`로 연결한다. 함수 선언은 같은 block의 시작에서 등록하며, 표현식은 생성 위치에서 등록한다. 이름 추론, 기명 함수 표현식의 자기 참조, arrow의 lexical `this`·`arguments`를 유지한다.

이미 등록된 원본·setup과 render bridge는 재변환하지 않는다. async/generator 컴포넌트는 사용자 본문을 실행하기 전에 동기 setup 전용 오류를 낸다. 미지원 함수 형태와 순환 import의 조기 마운트 제한은 [컴포넌트 자동 준비 범위](../tutorial/compiler-setup.md#컴포넌트-자동-준비-범위)를 따른다.

## Props와 hook

첫 parameter를 초기 props 입력으로 바꾸고 props 저장 객체를 만든다. 구조 분해 pattern은 setup 초기화와 resolver에 보존한다. render, inline watch callback, 변환한 dependency getter가 resolver를 호출해 최신 props를 읽는다. binding context가 다른 shadow 변수는 변경하지 않는다.

`watch`·`clean`은 import binding으로 판별한다. 함수 dependency getter는 그대로 사용하고, 명확한 배열·객체·리터럴 dependency는 getter로 감싼다. import된 값, 재할당된 identifier와 동적 member처럼 모호한 dependency는 명시적인 getter를 요구한다. 이름 있는 callback과 setup에서 저장한 값은 자동으로 재계산하지 않는다.

## 인접 JSX와 source map

표준 파싱이 성공하면 원본 AST를 그대로 사용한다. 실패한 경우에만 가능한 인접 경계에 임시 `+`를 넣어 파싱하고, SWC가 실제 JSX 사이의 binary operator로 인식한 경계만 Fragment로 묶는다. 문자열·정규식·주석·기존 JSX 자식 안의 후보는 AST 검증에서 제외한다. 최종 Fragment를 다시 파싱해 조건식과 논리식의 우선순위를 보존한다.

SWC의 byte offset은 원본의 문자 offset과 구분한다. 삽입 위치의 source map과 SWC가 생성한 map을 합성해 한글·emoji를 포함한 원본 위치와 `sourcesContent`를 유지한다. 다른 문법 오류는 원본 파싱 오류로 보고한다.

## 앱 실행과 웹 코드 편집기의 차이

컴파일은 JSX와 컴포넌트 소스를 실행 가능한 JavaScript로 바꾸는 작업이다. 렌더링은 이미 만들어진 render 함수를 실행해 현재 상태를 화면에 반영하는 작업이다. `count++`나 장바구니 수량 변경은 렌더링을 일으키며, 소스 재컴파일을 요구하지 않는다.

| 대상 | 소스가 바뀌는 시점 | 컴파일 위치 | 브라우저에서 수행하는 일 |
|---|---|---|---|
| 일반 Vite 앱 | 개발자가 소스 파일을 수정할 때 | Node.js의 Vite/SWC | 변환된 JavaScript 실행과 상태 갱신 |
| `letProps`, `shoppingCart` | 개발자가 예제 파일을 수정할 때 | Node.js의 Vite/SWC | 부모·자식 props 갱신, 수량·합계 계산 |
| 랜딩 코드 편집기 | 방문자가 페이지에서 JSX를 입력할 때 | 브라우저 Worker의 Babel Standalone | 새 소스 컴파일 후 iframe에서 실행 |

일반 앱과 두 예제의 소스는 배포 전에 알 수 있으므로 미리 컴파일한다. 개발 중에는 Vite가 파일 변경을 처리하고, 배포할 때는 `vite build`가 정적 파일을 만든다. 결과 HTML이 존재하거나 화면에 상호작용이 있다는 이유로 웹 컴파일러가 필요한 것은 아니다. 두 예제는 각각 `src/main.jsx`와 Vite 설정을 사용하며, Babel CDN·HTML 속 JSX 문자열·Blob module 실행기를 사용하지 않는다.

랜딩 코드 편집기는 배포 후 방문자가 작성할 소스를 미리 알 수 없다. 새 JSX를 별도 서버에 보내지 않고 실행하려면 브라우저에서 사용할 수 있는 컴파일러가 필요하다. 현재는 `landing/src/compiler.worker.js`가 `compile.js`의 Babel Standalone과 AEUI Babel 플러그인을 호출한다. 컴파일 결과는 실행용 iframe에 전달하며, 상태 변경은 그 안의 AEUI runtime이 처리한다. 웹 컴파일러는 코드 편집 기능의 의존성이고, 일반 AEUI 앱의 실행 의존성은 아니다.

실행 명령은 [예제 안내](../../example/README.md), 편집기의 코드 전달과 실행 환경은 [랜딩 안내](../../landing/README.md#웹-컴파일러를-사용하는-이유)를 따른다.

## 검증

`npm test`는 같은 적합성 suite를 SWC와 Babel Vite 경로에서 각각 실행한다. 추가 비교 fixture는 props·hook·상태·key, 수동 render, 함수 identity와 일반 호출, 오류 경계, 재변환, TSX와 source map을 확인한다.

extra는 tarball의 ESM/CJS SWC 진입점, Babel 로딩을 금지한 Node 프로세스에서의 SWC·Vite 실행, 생성 앱과 기존 예제의 브라우저 동작을 검증한다. SWC 선택 시 실패를 숨기는 Babel fallback은 없다.
