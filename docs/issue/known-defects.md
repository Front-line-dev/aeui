# 알려진 구현 결함

이 문서는 현재 코드의 알려진 결함을 추적한다. 올바른 동작은 `user-scenario` 문서가 정의한다.

## `AEUI-COMPILER-001`: 순환 import 평가 중 등록 전 마운트

함수 선언은 ESM 모듈 본문 실행 전에도 순환 의존 모듈에서 참조할 수 있지만, `registerComponent`는 정의 모듈 본문에서 실행된다. 다른 모듈이 그 사이에 컴포넌트를 마운트하면 setup 등록이 아직 없어 원본 호출 후 컴파일 안내 오류가 발생할 수 있다.

일반 import·re-export 및 같은 파일에서 선언보다 앞선 마운트는 지원한다. 앱 시작을 모듈 평가 이후로 옮기면 이 문제를 피할 수 있다. 순환 초기화 도중의 실행을 지원하려면 별도의 모듈 초기화 프로토콜이 필요하다.

## 해결 기록

### `AEUI-EXAMPLE-001`: Standalone 예제의 ESM 실행

적합성 extra 구축 당시 `letProps`와 `shoppingCart`의 `eval()`이 컴파일러가 삽입한 `import` 문을 실행하지 못하는 문제가 확인되었다. 당시에는 공통 실행기에서 훅을 명시적으로 import하고 변환된 ESM을 Blob module로 실행하도록 수정했다.

현재 두 예제는 Vite/SWC 빌드로 전환했으며, Babel Standalone과 공통 실행기를 제거했다. extra의 `REFERENCE-APPS.12`·`.13`은 웹 컴파일러 없이 빌드 결과를 실행해 화면 갱신과 브라우저 오류 부재를 검증한다.
