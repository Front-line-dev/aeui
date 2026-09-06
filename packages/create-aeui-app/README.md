# create-aeui-app

AEUI 프로젝트를 생성하는 CLI입니다. Node.js `^22.12.0 || >=24.0.0`이 필요합니다.

이 버전의 npm 발행 완료 후 실행합니다.

```bash
npx create-aeui-app@0.1.0-alpha.1 my-app
cd my-app
npm install
npm run dev
```

`src/pages` 기반 라우터와 Vite 8 설정이 생성됩니다. 템플릿은 동일 버전의 `a-easy-ui`를 `aeui` alias로 설치합니다. 프로젝트 이름에는 소문자, 숫자, `.`, `_`, `-`를 사용할 수 있으며 경로 입력과 이미 존재하는 디렉터리는 거부합니다.

AEUI는 alpha 단계로 API가 변경될 수 있습니다.

[문서와 소스](https://github.com/Front-line-dev/aeui) · [문제 신고](https://github.com/Front-line-dev/aeui/issues)

라이선스: [ISC](LICENSE).
