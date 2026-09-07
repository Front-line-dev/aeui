# 컴포넌트 값 판별 적용과 검증

## 판단과 적용 방식

함수 값에 컴포넌트용 setup을 연결하는 방식은 AEUI의 setup 1회/render 반복 모델과 함께 구현할 수 있다. 런타임의 `typeof` 검사만 바꾸면 미변환 JSX 함수가 render 함수를 반환하지 않으므로 컴파일러 변경이 필요하다.

이번 구현은 함수 이름이나 전역 값 흐름 추론에 정확성을 의존하지 않는다. JSX 반환 함수와 지원되는 export 반환을 정의 파일에서 준비하고, 같은 파일의 태그·props·AEUI 호출에서 local binding을 추가로 추적한다. 원래 callable을 유지한 채 별도 setup을 WeakMap에 등록한다. 이를 통해 별칭·import·props 전달과 일반 함수 호출을 함께 지원한다.

컴파일러 출력에는 원본과 setup이 모두 포함되므로 코드 크기가 증가한다. 두 경로를 모두 준비할 필요가 없는 함수의 제거·축소는 후속 최적화 범위다.

## 자동 회귀 검증

`example/test/src/__tests__/component-type.test.js`의 31개 테스트는 실제 Babel 변환과 AEUI 런타임/DOM을 사용한다. 기존 147개 테스트와 함께 전체 178개가 통과했다.

| 범위 | 확인한 동작 |
|---|---|
| 별칭·재할당 | 소문자 함수 정의, const/let, 여러 대입 원본, shadowing, 객체 경유 |
| props | 구조 분해 태그와 member 태그의 최신 타입, children 갱신 |
| 일반 호출 | VNode 반환, 재귀, this/arguments/default, arrow lexical capture |
| identity | frozen 함수, 함수명 추론, 원본 참조 유지, key와 타입별 상태 |
| 모듈 | 실제 Vite fixture의 default/named/namespace import, re-export, live binding |
| 반환 형태 | JSX, null, 문자열, children, implicit return, inline/named 수동 render |
| 재컴파일 | 변환 결과를 다시 컴파일한 뒤 마운트, 호이스팅, 중첩 팩토리 |
| 오류 | 잘못된 타입, 미컴파일 VNode 반환, async/generator, rejected Promise |
| 정리 | setup/첫 render/뒤쪽 sibling 실패, cleanup 재진입, 50회 타입 교체에서 setup/cleanup 각각 51회 |
| Vite 경계 | 가상 bundler runtime과 node_modules 제외, 일반 앱 모듈 변환 |
| 등록 | 동결 함수와 Proxy의 속성 접근/본문 호출 없이 등록, 충돌 등록 거부 |

일반 호출용 함수와 setup 함수가 모두 생기므로 기존 Babel 테스트의 외부/local hook 호출 수 기대값은 두 경로를 검사하도록 갱신했다.

## 빌드·브라우저·패키지 검증

- `npm test`: 8개 파일, 178개 테스트 통과.
- `npm run build`: 코어, 예제 앱 3개, 랜딩 빌드 통과.
- `npm run typecheck`: 통과.
- 랜딩의 실제 컴파일러/런타임 테스트: 28개 통과.
- `npm run pack:core`: 패키지 포함 파일 확인.
- 실제 `npm pack` 결과를 별도 임시 폴더에 풀어, 패키지의 Babel CJS 플러그인과 CJS/ESM 런타임 각각으로 별칭·props 컴포넌트를 마운트하고 클릭 후 `packed:0 → packed:1`을 확인.
- Vite 개발 서버를 실제 브라우저에서 열어 `first:0 → first:1`, live import를 바꾼 위치의 `first:0 → second`, 교체하지 않은 위치의 `first:1` 유지 확인. 개발 서버 브라우저 console의 warning/error는 없었다. 최적화된 프로덕션 번들에서도 같은 마운트·클릭·타입 교체와 상태 보존을 확인했다.

빌드에는 랜딩의 500 kB 초과 chunk 경고가 남는다. 테스트용 Vite 개발 서버의 초기 의존성 스캔에는 `react/jsx-dev-runtime` 미해결 경고가 있었지만, 실제 요청의 AEUI Babel 변환과 브라우저 로딩/상호작용은 성공했다. React 의존성을 추가하지 않았다.

프로덕션 실행에서 bundler의 가상 보조 모듈까지 export 후보로 준비하여 AEUI 초기화 전 등록을 시도하는 오류를 발견했다. Vite transform에서 `\0`으로 시작하는 가상 모듈을 제외하고 회귀 테스트를 추가했으며, 재빌드한 프로덕션 번들의 실제 브라우저 실행으로 해결을 확인했다.

## 지원 경계

- 함수 준비에는 해당 정의 파일의 AEUI 컴파일이 필요하다. 불투명한 외부 함수나 bind/Proxy가 생성한 새 함수의 소스를 복원하지 않는다.
- 수동 setup/render 함수는 미등록 상태에서도 호환된다. 컴파일된 컴포넌트의 등록은 같은 런타임 모듈을 사용하는 앱 사이에서 공유한다.
- 객체/class 메서드와 async/generator 컴포넌트는 자동 실행 지원 범위 밖이다.
- setup에서 복사한 props 값이나 setup의 if 분기를 매 render마다 재계산하지 않는다. 동적 값·조건은 반환 표현식 안에서 읽는다.
- 순환 import의 모듈 평가 도중 등록보다 먼저 마운트하는 경우는 `AEUI-COMPILER-001`로 추적한다.
- HMR 상태 보존, 임의 제어 흐름 이동, 기존 subtree 변경의 완전한 rollback을 검증하거나 구현한 것은 아니다.
