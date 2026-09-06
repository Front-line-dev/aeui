# 릴리즈 절차

## 버전 확인

코어, CLI, CLI 템플릿의 AEUI 의존성 버전을 맞춘다. README와 시작 문서의 설치 명령도 같은 버전을 가리켜야 한다. 이미 npm에 발행된 버전은 덮어쓸 수 없다.

## 수동 확인과 패키징

저장소 루트에서 실행한다.

```bash
npm ci
npm test
npm run typecheck
npm run build
mkdir -p release-artifacts
npm pack --workspace a-easy-ui --workspace create-aeui-app --pack-destination release-artifacts
```

## 발행

확인한 소스를 커밋하고 해당 커밋에 릴리즈 태그를 붙인다. npm 발행 권한과 버전을 확인한 뒤 코어, CLI 순서로 발행한다.

```bash
npm publish release-artifacts/a-easy-ui-0.1.0-alpha.1.tgz --tag next --access public
npm publish release-artifacts/create-aeui-app-0.1.0-alpha.1.tgz --tag next --access public
```

GitHub Release는 같은 태그를 대상으로 pre-release로 작성한다. 발행 후 문서의 설치 명령과 앱 실행을 확인하고 README의 ‘준비 중’ 표기를 갱신한다.
