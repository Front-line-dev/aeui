# AEUI 랜딩 페이지

기능 소개와 프로젝트 생성 안내를 담은 랜딩 페이지와 편집 가능한 AEUI 예제입니다. 저장소의 실제 Babel 플러그인과 빌드된 런타임을 사용합니다.

## 실행

저장소 루트에서 Node.js `^22.12.0 || >=24.0.0`을 사용합니다.

```bash
npm ci
npm run dev:landing
```

```bash
npm run test:landing
npm run build:landing
npm run preview:landing
```

정적 빌드 결과는 `landing/dist`입니다. 상대 경로로 빌드하므로 `/aeui/`, 다른 저장소 이름, 커스텀 도메인에서 같은 결과물을 사용할 수 있습니다. 코어 소스를 수정했다면 개발 서버를 재시작해 런타임도 다시 빌드하세요.

## 내용과 예제 수정

- `index.html`: 영어 기본 문구, 섹션, 문서 링크, Simple Analytics 스크립트
- `src/locales.js`: 영어·한국어·일본어·중국어 번역
- `src/i18n.js`: 브라우저 언어 선택과 문구·메타데이터 적용
- `src/styles.css`: 모노톤 테마와 반응형 레이아웃
- `src/examples.js`: 네 가지 기본 예제
- `src/compile.js`: AEUI Babel 변환, JSX 변환, 예제 반복문 제한
- `src/playground.js`: CodeMirror 편집, 650ms 자동 실행, 초기화, 오류 표시
- `src/editor-highlight.js`: JavaScript/JSX 토큰별 하이라이트
- `src/sandbox.js`: 독립 실행 프레임과 런타임 연결

Babel은 Web Worker에서 실행되며 편집기는 해당 섹션 근처로 스크롤할 때 로드됩니다. 편집기와 컴파일러 의존성은 외부 CDN 없이 빌드에 포함합니다. 코드 수정과 다시 실행은 새 프레임에 새 컴포넌트를 마운트하므로 상태가 초기화됩니다. 문법 오류가 있으면 이전에 성공한 화면을 유지하고 오류를 표시합니다.

예제는 `export default` 함수 컴포넌트이며 `aeui` import를 지원합니다. watch 예제는 `classList.toggle()`을 호출해 실행 프레임의 밝은 테마와 어두운 테마를 전환합니다. 테마 스타일은 `src/sandbox.js`에 정의합니다. 외부 패키지와 네트워크 요청은 지원하지 않습니다. 프레임은 `sandbox="allow-scripts"`로 부모 DOM과 저장소 접근을 분리하고, CSP로 외부 연결을 차단합니다. 반복문에는 실행 횟수 제한을 주입합니다. 이 제한은 임의의 JavaScript에 대한 완전한 자원 격리를 제공하지 않으므로 무거운 계산용 실행 환경으로 사용하지 않습니다.

설치 영역은 `npx create-aeui-app@latest my-app`을 안내합니다. 현재 npm 공개 버전은 `0.0.1`이고 페이지 예제는 저장소의 다음 버전 기준임을 함께 표시합니다. 릴리스 후에는 이 안내를 공개 버전에 맞추세요.

## 언어와 하이라이트

브라우저의 `navigator.languages` 우선순위에서 지원하는 첫 언어를 선택합니다. `en`, `ko`, `ja`, `zh`와 해당 지역 태그를 지원하며, 일치하는 언어가 없으면 영어로 표시합니다. 중국어는 간체(`zh-Hans`)로 제공합니다. JavaScript를 사용할 수 없는 경우에도 기본 영어 소개를 읽을 수 있습니다.

페이지 본문, 제목·설명 메타데이터, 접근성 이름, 편집기 안내, 예제 내부 문구와 자체 오류 안내를 번역합니다. Babel과 AEUI 런타임이 직접 반환하는 진단 메시지는 원문을 유지합니다. 외부 문서 링크의 대상 문서는 기존 언어를 유지합니다.

CodeMirror의 JavaScript/JSX 구문 분석 결과에 토큰별 색상을 적용합니다. `src/styles.css`의 `.cmt-*` 규칙으로 키워드, 문자열, 숫자, 함수, 태그, 속성, 연산자와 주석 색상을 조정할 수 있습니다.

## Simple Analytics

부모 페이지에 공식 비동기 스크립트 `https://scripts.simpleanalyticscdn.com/latest.js`를 한 번 삽입합니다. 실행 예제의 iframe에는 넣지 않습니다. 사용자 코드나 편집 내용을 전송하는 커스텀 이벤트는 등록하지 않습니다.

배포 도메인을 Simple Analytics 대시보드에 등록하고 실제 방문 집계를 확인하세요. 표준 스크립트는 로컬 개발 주소의 방문을 집계하지 않습니다. 설정은 [공식 설치 안내](https://docs.simpleanalytics.com/script)를 따릅니다.

## GitHub Pages 자동 배포

`.github/workflows/landing-pages.yml`이 다음을 수행합니다.

1. `main`에 랜딩 페이지, 코어, 루트 의존성 또는 워크플로 변경이 push되면 설치 → 예제 검증 → 빌드 → Pages 배포를 실행합니다.
2. Pull request에서는 같은 검증과 빌드를 수행하고 배포하지 않습니다.
3. GitHub Actions의 **Landing page → Run workflow**로 `main`을 수동 배포할 수도 있습니다.

최초 한 번 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정해야 합니다. 조직에서 Actions 또는 `github-pages` 환경 보호 규칙을 적용한다면 해당 정책에 따라 허용 또는 승인이 필요합니다. 별도 배포 토큰 없이 기본 `GITHUB_TOKEN`과 OIDC를 사용합니다.

워크플로를 포함한 변경이 `main`에 push되어 첫 배포가 성공한 후 기본 주소는 `https://Front-line-dev.github.io/aeui/`입니다. 실제 배포 주소는 Actions의 `github-pages` 환경 링크에서 확인하세요.

공식 안내: [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
