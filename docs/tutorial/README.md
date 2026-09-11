# AEUI 튜토리얼

튜토리얼은 특정 기능의 역할을 이해하고 프로젝트에 적용하는 가이드입니다. 개념을 짧은 예시로 확인한 뒤, 필요한 설정을 선택하고 실행 결과를 점검합니다.

프로젝트를 만들고 화면을 개발하는 기본 흐름은 [사용자 시나리오](../user-scenario/01-getting-started.md)를 따릅니다. 프레임워크 코드를 수정하기 위한 구조와 알고리즘은 [내부 구현 문서](../README.md#internal-implement)에서 설명합니다.

## 가이드 선택

| 하려는 일 | 가이드 |
|---|---|
| JSX가 어떤 코드로 실행되고 import가 어디서 생기는지 이해하기 | [JSX runtime 이해하기](jsx-runtime.md) |
| Vite 외의 빌드 과정에 AEUI 변환 연결하기 | [Babel과 SWC 직접 설정하기](compiler-setup.md) |
| TSX 파일에서 AEUI 컴포넌트의 props 검사하기 | [TypeScript JSX 설정하기](typescript-jsx.md) |

Vite로 앱을 개발한다면 `plugins: [aeui()]`가 컴포넌트와 JSX 변환을 설정합니다. Babel·SWC 직접 설정은 별도의 빌드 과정을 구성할 때 사용합니다.

## 읽는 순서

JSX 변환 설정을 직접 다루려면 **JSX runtime → Babel과 SWC 직접 설정** 순서로 읽습니다. Vite 앱에 TypeScript를 추가하려면 TypeScript 가이드부터 읽어도 됩니다.

각 가이드는 다음 흐름으로 읽을 수 있습니다.

- **JSX runtime:** JSX의 실행 과정 → 두 호출 방식 → 옵션의 이유 → 내 프로젝트의 설정
- **Babel·SWC:** 필요한 변환 → 연결할 도구 선택 → 설정과 실행 → 앱에서 결과 확인
- **TypeScript:** 검사할 props 예제 → JSX 타입 설정 → 정상·오류 확인 → 앱에 적용

생성 코드의 규칙과 자료구조를 더 확인하려면 각 가이드의 내부 구현 문서 링크를 따릅니다.

[전체 문서 인덱스](../README.md)
