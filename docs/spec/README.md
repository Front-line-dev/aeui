# AEUI 구현 명세

`docs/spec`은 현재 버전의 AEUI 구현이 반드시 따라야 할 규칙이다. 01부터 12까지 순서대로 읽으면 앞 장에서 정의한 내용을 다음 장이 이어서 사용한다.

현재 코드의 관찰 기록, 알려진 스펙 위반, 아직 적용하지 않은 기능과 작업 상태는 이 디렉터리에 두지 않는다. 해당 내용은 [작업 추적](../tracking/README.md)에서 관리한다.

각 문서의 역할은 [AEUI 문서 인덱스](../README.md)를, 스펙 충족 여부를 검증하는 방법은 [10. 스펙 충족 여부 검증](10-conformance.md)을, 변경 절차는 [기여 가이드](../contributing.md)를 따른다.

## 명세 목록

| 문서 | 내용 |
|---|---|
| [01. AEUI를 불러오고 앱을 실행하는 규칙](01-public-api-and-architecture.md) | 세 import 주소, TypeScript 타입, 앱 상태와 첫 화면 표시 |
| [02. VNode와 깊은 데이터 연산](02-vnode-and-deep-data.md) | 화면 구조 객체 생성, 중첩된 값의 비교와 복사 |
| [03. 컴포넌트 런타임](03-component-runtime.md) | 컴포넌트를 만들고 다시 그리며 제거하는 순서 |
| [04. Reconciliation과 DOM 호스트](04-reconciliation-and-dom.md) | 이전 화면과 새 화면을 비교해 HTML 요소를 추가·수정·제거하는 방법 |
| [05. 스케줄러, 훅, 오류 처리](05-scheduler-hooks-and-errors.md) | 값을 다시 확인할 시점, `watch`·`clean` 실행과 오류 처리 |
| [06. Babel 컴파일러와 런타임 ABI](06-babel-compiler.md) | Babel이 컴포넌트·props·hook 코드를 바꾸고 AEUI 내부 함수를 호출하는 방법 |
| [07. 디렉터리 라우터](07-directory-router.md) | 페이지 파일 이름을 URL에 연결하고 링크 이동을 처리하는 방법 |
| [08. Vite 플러그인, 타입, 빌드와 패키지](08-vite-plugin-and-build.md) | Vite 설정, import 주소, TypeScript 선언과 배포 파일 |
| [09. `create-aeui-app` CLI와 생성 템플릿](09-create-aeui-app.md) | CLI 입력, 프로젝트 생성, 템플릿과 패키징 |
| [10. 스펙 충족 여부 검증](10-conformance.md) | 각 테스트가 확인할 스펙 조항, 검증 단계와 통과 조건 |
| [11. 예제 애플리케이션](11-reference-applications.md) | 각 예제가 반드시 보여 주어야 하는 사용자 동작 |
| [12. 소스 파일 배치와 함수 목록](12-source-layout.md) | 소스 파일별 역할, 파일 사이의 import 방향과 내부 함수 목록 |
