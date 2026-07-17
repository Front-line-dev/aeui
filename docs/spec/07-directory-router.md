# 07. 디렉터리 라우터 명세

이 문서는 AEUI core 제품에 포함되는 디렉터리 라우터의 목표 계약과 현재 구현을 함께 설명한다. 라우터는 선택적 외부 통합이 아니며 공식 Vite bootstrap과 `create-aeui-app`의 기본 앱 구조를 구성한다. 공개 `Router`, `Link`, `navigate` API는 제공하지 않고, `aeui/vite`가 만든 숨은 entry, 일반 `<a href>`와 `AEUI.__runtime.initDirectoryRouter` 내부 bridge로 동작한다. 상태는 **규범**, **현재 구현**, **계획 기능**, **수정 필요**로 구분한다. **수정 필요**로 표시한 현재 동작은 재구현 시 보존하지 않고 목표 계약에 맞게 고쳐야 한다.

기준 소스는 다음과 같다.

- `packages/core/src/vite-plugin.js`
- `packages/core/src/router.js`
- `packages/core/src/app-runtime.js`
- `packages/core/src/runtime.js`
- `packages/core/src/runtime-state.js`
- `example/test/src/__tests__/router.test.js`
- `example/test/src/__tests__/component.test.jsx`

## 1. 전체 경계

```text
index.html
  -> aeui/vite가 /@aeui-entry module script 주입
  -> virtual entry가 src/pages 모듈을 eager import
  -> AEUI.__runtime.initDirectoryRouter(routeModules, #root, options)
  -> createRouteTable(routeModules)
  -> 현재 location을 최초 match
  -> 공통 AEUI init으로 RouterRoot 마운트
  -> container click + window popstate listener 부착
```

라우터가 소유하는 책임은 다음과 같다.

- route module map을 정렬된 route table로 변환
- 현재 URL을 static/dynamic/catch-all route에 매칭
- page와 선택적 전역 layout에 `route` prop 전달
- 일치하지 않는 URL을 사용자 `404` 또는 내장 404에 연결
- 앱 container 내부의 같은 origin anchor click 위임
- `history.pushState`와 `popstate`를 runtime render 요청에 연결
- 재마운트 또는 runtime reset 시 listener 정리

라우터가 제공하지 않는 것은 nested layout, imperative navigation API, route guard, loader, lazy route import, HTTP status 변경, server routing이다.

## 2. Vite 자동 부트스트랩

이 절은 라우터가 받는 hidden-entry handoff를 한 문서에서 이해하기 위한 요약이다. alias, HTML attribute parser, virtual module, source transform의 규범적 원본은 08 §2~10이다. 중복 설명이 달라지면 08의 plugin mechanics를 먼저 고치고 이 절을 동기화한다. 3절 이후의 route table/runtime 의미는 이 문서가 규범적 원본이다.

### 2.1 플러그인 기본값

`aeui/vite` default export는 `aeui(options = {})` 함수다. 관련 option과 기본값은 다음과 같다.

| option | 기본값 | 용도 |
| --- | --- | --- |
| `alias` | `'@'` | Vite resolve alias 이름. `false`, 빈 문자열, 비문자열이면 추가하지 않음 |
| `aliasDir` | `'src'` | alias replacement 경로. 상대값은 project root 기준이고 absolute 값은 그대로 허용 |
| `appEntry` | `'src/App.jsx'` | route file이 없을 때 import할 default 앱 |
| `rootId` | `'root'` | `document.getElementById`에 전달할 id |
| `styles` | `'src/styles.css'` | 존재할 때만 import할 style entry. `false`이면 비활성화 |

플러그인 이름은 `aeui:vite`, 실행 순서는 `enforce: 'pre'`다. `config` hook은 사용자가 동일 alias를 이미 선언하지 않은 경우에만 `<root>/<aliasDir>`를 추가한다. object alias는 own key 존재 여부로, array alias는 `entry.find === aliasName`으로 검사한다.

replacement는 `path.resolve(rootDir, aliasDir)`로 계산하며 project root containment를 검사하지 않는다. 따라서 absolute `aliasDir`이나 `..`를 포함한 상대값은 root 밖을 가리킬 수 있다.

라우터 디렉터리는 option으로 바꿀 수 없고 항상 project root의 `src/pages`다.

### 2.2 HTML entry 주입

`transformIndexHtml`은 `order: 'pre'`에서 실행된다. 목표 계약에서는 다음 중 하나면 원래 HTML 문자열을 그대로 반환한다.

1. internal id `virtual:aeui-entry`가 이미 사용됨
2. 실제 `<script type="module">`의 `src`가 public path `/@aeui-entry` 또는 internal id `virtual:aeui-entry`임
3. 실제 `<script>` tag 중 `type="module"`이고 `src`가 `src/main.<무언가>` 형태인 manual entry가 있음

entry 검사는 attribute 순서와 큰따옴표/작은따옴표/unquoted 값을 허용한다. `src`에서 query와 hash를 제거하고 앞의 `./` 하나를 제거한다. AEUI public/internal id와 비교할 때는 정확히 해당 id인지 확인하고, manual main은 `(^|/)src/main\.[^/]+$`와 대소문자 무시로 비교한다. 그러므로 `/src/main.js`, `/base/src/main.jsx`, `./src/main.js?x=1#entry`는 manual entry다. `data-src`, `data-type`는 실제 `src`, `type` attribute로 오인하지 않는다.

위 조건이 아니면 body에 다음 tag descriptor를 주입한다.

```javascript
{
  tag: 'script',
  attrs: { type: 'module', src: '/@aeui-entry' },
  injectTo: 'body',
}
```

`resolveId`는 `virtual:aeui-entry`와 `/@aeui-entry`를 모두 NUL prefix가 붙은 `\0virtual:aeui-entry`로 해석한다. `load`는 이 resolved id에만 bootstrap source를 반환한다.

#### **수정 필요**: public entry 중복 주입

현재 구현은 raw HTML에 `virtual:aeui-entry`가 포함되었는지만 검사하고 public path `/@aeui-entry`는 검사하지 않는다. 따라서 사용자가 이미 다음 tag를 넣었어도 plugin이 같은 public entry를 한 번 더 주입할 수 있다.

```html
<script type="module" src="/@aeui-entry"></script>
```

이는 보존할 동작이 아니다. 수정 구현은 internal id와 public path를 모두 기존 AEUI entry로 판정해야 한다.

### 2.3 router mode 선택

plugin이 resolve한 project root 아래 `src/pages`를 재귀 순회한다. 목표 계약에서 router mode를 선택할 수 있는 공식 확장자는 다음 여섯 개뿐이다.

```text
.js .jsx .ts .tsx .mjs .cjs
```

디렉터리가 없거나 공식 확장자 파일이 하나도 없으면 single-app mode다. 파일 내용, default export 유무, `_` prefix, `404`, 유효한 catch-all 위치는 mode 선택 단계에서 검사하지 않는다.

router mode entry는 의미상 다음 코드다.

```javascript
import { AEUI } from 'aeui';
// 설정된 style 파일이 실제로 존재하면 여기에서 import

const routes = import.meta.glob(
  '/src/pages/**/*.{js,jsx,ts,tsx,mjs,cjs}',
  { eager: true }
);

AEUI.__runtime.initDirectoryRouter(
  routes,
  document.getElementById(rootId),
  { rootDir: '/src/pages' }
);
```

detector, eager glob, source transform filter, parser 선택, runtime route parser는 모두 `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`라는 하나의 공식 목록을 공유해야 한다. 이 목록 밖의 `.mts`, `.cts`, `.mjsx`, `.cjsx` 등은 route mode를 선택하지 않고 route table 후보도 아니며 AEUI Vite source transform 대상도 아니다.

#### **수정 필요**: detector/parser와 eager glob의 확장자 불일치

현재 detector와 runtime route parser의 `/\.[cm]?[jt]sx?$/`는 12개 suffix를 허용하지만 eager glob은 공식 여섯 개만 import한다. 예를 들어 `index.mts`만 있으면 현재 구현은 router mode를 선택하면서도 해당 module을 route map에 넣지 못하고 TypeScript parser도 활성화하지 못한다. 이 불일치는 현재 잘못된 부분이며 재구현 시 유지하지 않는다.

`{ eager: true }`이므로 모든 route module은 시작 시점에 평가되고 module namespace object map이 생성된다. lazy import나 route별 code splitting은 하지 않는다.

single-app mode entry는 의미상 다음 코드다.

```javascript
import { AEUI } from 'aeui';
import App from '/src/App.jsx'; // appEntry option으로 변경 가능
// 설정된 style 파일이 실제로 존재하면 여기에서 import

AEUI.init(App, document.getElementById(rootId));
```

`src/pages` 디렉터리가 단순히 존재하는지만 보는 것이 아니라 공식 여섯 확장자에 맞는 파일 존재 여부로 두 mode를 나눈다.

### 2.4 source transform

Vite plugin은 query를 제거한 id가 공식 여섯 확장자 중 하나이고 `/node_modules/`를 포함하지 않으면 project 전역에서 transform한다. route directory 안으로 한정하지 않는다.

변환 순서는 다음과 같다.

1. Babel config와 project babelrc를 끈다.
2. `.ts`/`.tsx`이면 TypeScript parser plugin을 켠다. `.jsx`/`.tsx`에는 JSX parser를 켠다.
3. AEUI Babel plugin을 적용한다.
4. classic JSX transform을 `pragma: 'AEUI.createElement'`, `pragmaFrag: 'AEUI.Fragment'`로 적용한다.
5. source map과 함께 code를 Vite에 돌려준다.

별도 TypeScript strip plugin은 없다. AEUI rewrite가 교체한 parameter 위치의 annotation은 결과에서 사라질 수 있지만, 변환 뒤 남은 TypeScript syntax의 최종 제거는 이후 Vite pipeline이 담당한다.

## 3. route module map과 root path

`createRouteTable(routeModules, options = {})`는 다음 형태의 객체를 입력으로 받는다.

```javascript
{
  '/src/pages/index.jsx': { default: HomePage },
  '/src/pages/products/[id].jsx': { default: ProductPage },
}
```

`routeModules`가 nullish이면 빈 객체처럼 처리한다. key는 file path이고 value는 module-like 값이다.

### 3.1 root directory 결정

- `options.rootDir`가 truthy이면 backslash를 slash로 바꾸고 trailing slash를 모두 제거한 뒤 leading slash를 보장한다.
- option이 없으면 `/src/pages`를 사용한다.
- 현재 `inferRootDir`은 key를 확인하지만 다른 root를 실제로 추론하지는 않는다. 명시 option이 없으면 항상 `/src/pages`다.

각 key를 root-relative path로 바꾸는 순서는 다음과 같다.

1. backslash를 slash로 바꾼다.
2. `?` 뒤와 `#` 뒤를 제거한다.
3. key가 `<normalizedRoot>/`로 시작하면 그 prefix를 제거한다.
4. 아니면 key에서 마지막 `/pages/` marker를 찾아 그 뒤만 사용한다.
5. marker도 없으면 앞의 `./` 또는 `/` 하나를 제거한 전체 key를 사용한다.

이 fallback은 absolute test fixture나 Windows-normalized key도 처리하기 위한 것이다. root 밖의 key를 무조건 거부하는 보안 경계는 아니다.

### 3.2 component export 선택

일반 route와 special module 모두 다음 식으로 component candidate를 고른다.

```javascript
const component = mod && (mod.default || mod.Page || mod);
```

선택 결과가 함수일 때만 유효하다. 우선순위는 truthy `default`, truthy `Page`, module 값 자체다. 예를 들어 truthy지만 함수가 아닌 `default`가 있으면 함수형 `Page`가 함께 있어도 그 route는 무효다.

## 4. route table 생성

### 4.1 공식 지원 확장자 제거

목표 runtime parser는 detector와 같은 공식 여섯 확장자만 제거한다. 의미상 패턴은 다음과 같다.

```javascript
const ROUTE_EXT_RE = /\.(?:js|jsx|ts|tsx|mjs|cjs)$/;
```

relative path가 이 정규식으로 끝나지 않으면 route 후보가 아니다. 일치한 마지막 확장자를 제거하고 `/`로 나눈 뒤 빈 segment를 버린다. detector와 runtime parser가 서로 다른 정규식을 별도로 관리해서는 안 되며 2.3의 공식 목록을 공유해야 한다. 현재 runtime의 넓은 `/\.[cm]?[jt]sx?$/`는 위 **수정 필요** 항목의 일부다.

### 4.2 파일 규칙

| 파일 basename 또는 형태 | 결과 |
| --- | --- |
| `index.<ext>` | 마지막 `index` segment를 제거. root index는 `/`, `docs/index`는 `/docs` |
| `[name].<ext>` | 한 segment 동적 parameter `:name` |
| `[...name].<ext>` | 하나 이상의 나머지 segment를 받는 catch-all `*name` |
| `404.<ext>` | 일반 route에서 제외. root의 정확한 `404`만 global fallback 후보 |
| `_layout.<ext>` | `_` basename 규칙으로 일반 route에서 제외. root의 정확한 `_layout`만 global layout 후보 |
| `_anything.<ext>` | 일반 route에서 제외 |
| 그 외 basename | literal static segment |

`_` 제외 규칙은 마지막 file basename에만 적용한다. `_private/page.jsx`처럼 underscore로 시작하는 디렉터리는 제외되지 않고 `/_private/page` static route가 된다.

`404`와 `_layout` special 검색은 확장자를 제거한 relative path 전체가 정확히 각각 `404`, `_layout`일 때만 성공한다. 따라서 nested `blog/404.jsx`는 fallback이 아니며 일반 route에서도 제외된다. nested `blog/_layout.jsx`도 layout이 아니고 일반 route에서도 제외된다. layout과 fallback은 각각 최대 한 개의 root-global component다.

같은 special basename을 여러 지원 확장자로 제공하면 `Object.entries(routeModules)`에서 처음 만난 exact special이 결정권을 가진다. 첫 candidate가 함수면 즉시 반환하고, 최종 선택값이 함수가 아니어도 즉시 `null`을 반환하므로 뒤의 유효한 duplicate special을 계속 찾지 않는다.

### 4.3 segment parser

segment는 다음 순서로 분류한다.

1. `/^\[\.\.\.([^\]]+)\]$/`에 맞으면 `{ kind: 'catchAll', name, raw }`
2. `/^\[([^\]]+)\]$/`에 맞으면 `{ kind: 'dynamic', name, raw }`
3. 그 외는 `{ kind: 'static', value: segment, raw }`

parameter name은 빈 문자열일 수 없고 `]`를 포함할 수 없다. catch-all segment가 마지막이 아니면 파일 전체를 route table에서 조용히 제외한다. 예를 들어 `[...slug]/edit.jsx`는 오류를 던지지 않고 무시한다.

### 4.4 route record

유효한 파일 하나는 다음 record가 된다.

```javascript
{
  component,            // 선택한 함수
  filePath,             // 입력 map의 원래 key
  path,                 // '/', '/products/:id', '/docs/*slug' 형식
  segments,             // parsed segment 배열
}
```

`path`는 matching에 다시 parse하지 않는 설명용 metadata다. matching은 `segments` 배열을 직접 사용한다.

### 4.5 table 결과

최종 반환값은 다음 모양이다.

```javascript
{
  fallback: Function | null,
  layout: Function | null,
  routes: RouteRecord[],
}
```

일반 routes를 만든 뒤 priority comparator로 정렬한다. fallback과 layout은 routes 배열에 들어가지 않는다.

## 5. route 우선순위

segment rank는 static 30, dynamic 20, catch-all 0이다. comparator는 첫 segment부터 두 route를 사전식으로 비교한다.

1. 같은 index에서 rank가 다르면 rank가 높은 route가 먼저 온다.
2. 한 route만 해당 index의 segment가 없으면 segment가 더 남은, 즉 더 깊은 route가 먼저 온다.
3. 모든 비교가 같으면 segment 수 차이를 다시 비교한다.
4. 동일 pattern은 comparator가 0을 반환하므로 JavaScript stable sort 기준으로 원래 `Object.entries` 순서를 유지한다.

대표 결과는 다음과 같다.

```text
/products/new       static
/products/:id       dynamic
/products/*rest     catch-all
```

서로 다른 static literal은 rank가 같으므로 comparator가 이름을 알파벳순으로 정렬하지 않는다. 어차피 exact static 비교에서 맞는 route만 성공한다. `[id]`와 `[slug]`처럼 구조가 같은 중복 dynamic pattern은 module map 삽입 순서에서 앞선 route가 모든 URL을 선점한다.

더 깊은 catch-all이 index route보다 정렬상 앞설 수 있지만 catch-all은 빈 remainder를 허용하지 않으므로 `/docs`는 `docs/index`에 매칭되고 `/docs/a`부터 `docs/[...slug]`에 매칭된다.

## 6. URL 해석과 route matching

### 6.1 URL 생성

`matchRoute(routeTable, href)`는 먼저 `href`를 `URL`로 바꾼다.

- browser에 `window.location`이 있으면 base는 `window.location.origin`이다.
- browser가 없으면 base는 `http://aeui.local`이다.
- `href`가 falsy이면 `/`를 사용한다.
- absolute URL도 받을 수 있으며 이 함수 자체는 origin을 제한하지 않고 pathname만 route에 맞춘다. same-origin 제한은 click interception 단계의 별도 계약이다.

`new URL` 자체가 해석할 수 없는 입력은 그대로 예외를 던진다. 반면 URL은 유효하지만 path segment의 percent encoding만 깨진 경우는 아래의 safe decode 규칙으로 fallback 처리한다.

### 6.2 pathname 정규화

URL의 `pathname || '/'`에 `trimTrailingSlash`를 적용한다.

- 빈 값과 `/`는 `/`
- 그 외 path가 `/`로 끝나면 마지막 slash 하나만 제거
- 나머지는 그대로

그 뒤 `/`로 나누고 빈 문자열을 버려 match용 `pathSegments`를 만든다. 따라서 일반적인 단일 trailing slash는 exact route와 동일하게 취급하고, 연속 slash는 segment matching에서 무시된다. 다만 `route.pathname`에는 마지막 slash 하나만 제거한 문자열이 들어가므로 여러 trailing slash가 있으면 일부가 남을 수 있다.

URL 생성 단계가 dot segment 등의 표준 URL 정규화를 먼저 수행한다.

### 6.3 percent decoding

각 path segment는 비교 또는 parameter 저장 직전에 독립적으로 `decodeURIComponent`한다.

```javascript
function safeDecodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
```

- static: decode 결과가 파일명 literal과 strict equality여야 함
- dynamic: decode 결과 문자열을 `params[name]`에 저장
- catch-all: 나머지 각 segment를 decode해 문자열 배열로 저장
- 하나라도 decode가 실패하면 해당 route 전체가 불일치

matching은 대소문자를 구분한다. path를 segment로 나눈 뒤 decode하므로 `%2F`는 하나의 parameter 값 안에서 `/` 문자열이 될 수 있지만 새로운 path segment를 만들지는 않는다.

### 6.4 segment matching

일반 static/dynamic route는 모든 route segment를 순서대로 소비한 후 route segment 수와 path segment 수가 정확히 같아야 성공한다.

catch-all을 만나면 현재 index부터 끝까지를 `rest`로 취한다.

- `rest.length === 0`이면 불일치
- 모두 decode 가능하면 `params[name] = decodedRestArray`
- catch-all은 route 생성 때 마지막 위치로 제한했으므로 즉시 성공 반환

root index route는 빈 segments와 빈 pathSegments가 정확히 일치해 성공한다.

### 6.5 `matchRoute` 반환값

첫 성공 route는 다음 객체를 반환한다.

```javascript
{
  component: route.component,
  filePath: route.filePath,
  isFallback: false,
  path: route.path,
  route: routeInfo,
}
```

어느 route도 성공하지 않으면 다음 객체다.

```javascript
{
  component: routeTable.fallback || null,
  filePath: null,
  isFallback: true,
  path: '404',
  route: routeInfoWithEmptyParams,
}
```

custom `404`가 있어도 fallback 결과의 `filePath`는 그 파일 경로가 아니라 항상 `null`이다. `404`는 requested URL이나 History entry를 바꾸지 않고 보여 줄 component만 선택한다.

## 7. page에 전달하는 `route` prop

`routeInfo`는 항상 새 객체이며 다음 네 필드를 가진다.

```javascript
{
  href: `${url.pathname}${url.search}${url.hash}`,
  pathname: trimTrailingSlash(url.pathname || '/'),
  params,
  query: parseQuery(url.searchParams),
}
```

| 필드 | 정확한 의미 |
| --- | --- |
| `href` | origin을 제외한 pathname + query + hash. pathname은 URL 객체의 값을 그대로 써서 trailing slash를 제거하지 않음 |
| `pathname` | 위 규칙으로 trailing slash 하나를 제거한 pathname |
| `params` | dynamic은 문자열, catch-all은 문자열 배열. fallback은 빈 객체 |
| `query` | `URLSearchParams` iteration으로 만든 plain object |

query parser는 첫 key를 문자열 값으로 저장한다. 같은 key가 다시 나오면 `[첫 값, 둘째 값]` 배열로 바꾸고 이후 값은 새 배열에 이어 붙인다. key와 value decoding, `+` 처리, 빈 값 처리는 `URLSearchParams` 표준 동작을 따른다.

예:

```text
/products/p-1?tab=details&tag=a&tag=b#reviews
```

```javascript
{
  href: '/products/p-1?tab=details&tag=a&tag=b#reviews',
  pathname: '/products/p-1',
  params: { id: 'p-1' },
  query: { tab: 'details', tag: ['a', 'b'] },
}
```

page에는 이 `route` prop만 라우터가 직접 제공한다. params를 별도 props로 펼치거나 navigation 함수를 넣지 않는다.

## 8. Router root, page, layout, 404

### 8.1 router state

`createDirectoryRouter(state, routeModules, options = {})`는 table을 한 번 만들고 다음 mutable router 객체를 만든다.

```javascript
const router = {
  current: matchRoute(routeTable, currentHref()),
  routeTable,
};
```

`currentHref()`는 browser에서 `pathname + search + hash`, browser가 없으면 `/`다. `syncFromLocation()`만 `router.current`를 현재 location의 새 match로 교체한다.

반환값은 `{ Root, attach, router }`다. 이 함수 자체는 소스 내부 테스트/조립용이고 package root public export는 아니다. app-runtime bridge는 `Root`와 `attach`만 사용하고 반환 객체를 외부에 돌려주지 않는다.

### 8.2 `Root` component

`Root`는 setup에서 별도 상태를 만들지 않고 render function을 반환한다. 각 render의 순서는 다음과 같다.

1. `router.current`를 사용한다. 이 값이 falsy일 때만 현재 href를 다시 match한다.
2. `match.component`가 있으면 Page, 없으면 내장 `DefaultNotFound`를 선택한다.
3. `state.createVNode(Page, { route: match.route })`로 page VNode을 만든다.
4. global layout 함수가 있으면 `state.createVNode(layout, { route: match.route }, pageVNode)`를 반환한다.
5. layout이 없으면 page VNode을 직접 반환한다.

layout과 page는 같은 `route` 객체를 받는다. layout의 `children`에는 page VNode 하나가 들어간다. layout은 custom 404와 내장 404에도 항상 적용된다.

layout은 root-global 한 단계뿐이다. 디렉터리마다 layout을 중첩하거나 가장 가까운 layout을 선택하지 않는다.

같은 component 함수에 다른 params가 매칭되면 reconciler는 component type이 같으므로 인스턴스를 유지하고 새 route props를 render에 전달할 수 있다. 다른 page component로 바뀌면 이전 page는 unmount되고 새 page가 setup된다. global layout component type은 navigation 동안 같으므로 일반적으로 인스턴스를 유지한다.

### 8.3 내장 404

root `404` component가 없으면 `DefaultNotFound`가 사용된다. 이 함수는 AEUI compiler를 거치지 않아도 동작하도록 직접 render factory를 반환하며 의미상 다음 DOM을 만든다.

```html
<main>
  <h1>404</h1>
  <p>Page not found: {route.pathname}</p>
</main>
```

내장 404도 일반 page와 마찬가지로 `{ route }`를 받는다.

## 9. anchor click 위임

### 9.1 listener 위치와 anchor 탐색

`attach(container)`는 container가 falsy이거나 `window`가 없으면 아무 것도 하지 않는다. 그 외에는 container에 단 하나의 bubbling `click` listener를 등록한다.

click target에 `closest` 함수가 있어야 하며 `target.closest('a[href]')`로 가장 가까운 anchor를 찾는다. 그 anchor가 `container.contains(anchor)`를 만족해야 한다. 따라서 다음 특성이 생긴다.

- 처음 mount할 때 없던 anchor도 event delegation으로 처리됨
- container 밖 anchor는 처리하지 않음
- target이나 ancestor가 실제 `a[href]`가 아니면 처리하지 않음
- anchor나 그 자식의 handler가 먼저 `preventDefault()`하면 router는 처리하지 않음
- bubbling을 중단하면 container listener까지 도달하지 않음

### 9.2 가로채는 조건

`shouldHandleAnchorClick(event, anchor)`는 아래 조건을 모두 만족할 때만 true다.

1. event와 anchor가 존재
2. `event.defaultPrevented === false`
3. `event.button === 0`
4. meta/alt/ctrl/shift modifier가 모두 false
5. anchor에 `download` attribute가 없음
6. `target` attribute가 없거나 대소문자 무시 `_self`
7. raw `href` attribute가 truthy
8. raw href가 `#`로 시작하지 않음
9. `new URL(anchor.href).origin === window.location.origin`
10. protocol이 `http:` 또는 `https:`

따라서 external origin, middle/right click, modifier click, `download`, `_blank` 등 다른 browsing context, hash-only 링크, `mailto:`, `tel:`, `javascript:`는 browser 기본 동작을 유지한다.

`?query` 링크와 `/path#hash` 링크는 처리 대상이다. raw href가 정확히 `#...`로 시작할 때만 hash-only로 제외한다. 라우터는 scroll restoration이나 fragment target으로의 명시적 scroll을 구현하지 않는다.

## 10. History와 render 동기화

### 10.1 router click

처리 대상 anchor click의 순서는 다음과 같다.

1. `event.preventDefault()`를 즉시 호출한다.
2. anchor의 resolved absolute `href`로 `URL`을 만든다.
3. `nextHref = pathname + search + hash`를 만든다.
4. 현재 location의 같은 조합과 완전히 같으면 종료한다.
5. 다르면 `window.history.pushState({}, '', nextHref)`를 호출한다.
6. 현재 location을 다시 match해 `router.current`를 교체한다.
7. `state.requestRender()`로 다음 animation frame 렌더를 요청한다.

현재 URL과 같은 링크도 이미 1단계에서 preventDefault되지만 pushState와 render는 하지 않는다. pushState state payload는 항상 새 빈 객체다.

`pushState`는 `popstate`를 발생시키지 않으므로 click handler가 직접 sync해야 한다. render 요청은 비동기 frame 예약이며 즉시 DOM을 바꾸지 않는다. 사용자가 public `AEUI.render()`를 이어 호출하면 현재 `router.current`로 동기 렌더할 수 있다.

### 10.2 back/forward

`window`의 `popstate` listener는 다음 두 작업만 한다.

1. 현재 `window.location`을 다시 match해 `router.current` 교체
2. `state.requestRender()` 호출

별도 `hashchange` listener는 없다.

### 10.3 직접 History API 사용 시 한계

router는 오직 delegated click과 `popstate`에서 `syncFromLocation()`을 호출한다. 앱 코드가 직접 `history.pushState()` 또는 `history.replaceState()`만 호출하면 location은 바뀌지만 `router.current`는 바뀌지 않는다. 그 상태에서 `AEUI.render()`만 호출해도 Root는 truthy인 기존 `router.current`를 사용한다.

직접 History API를 사용할 때는 별도로 `popstate`를 dispatch하는 등 sync 경로를 실행해야 한다. 이 제한은 imperative `navigate` API가 없다는 현재 설계의 일부다.

## 11. teardown과 재마운트

`attach()`는 두 listener를 등록한 뒤 `state.routerTeardown`에 closure를 저장한다.

```javascript
state.routerTeardown = () => {
  window.removeEventListener('popstate', onPopState);
  container.removeEventListener('click', onClick);
  if (state.routerTeardown) {
    state.routerTeardown = null;
  }
};
```

정상 생명주기에서 이 closure는 다음 두 경로로 호출된다.

- `runtime.js:init()` 시작부: 새 일반 앱 또는 새 router 앱을 마운트하기 전
- `runtime-state.js:resetRuntimeState()`: 테스트나 명시적 runtime reset 시

`initDirectoryRouter`는 `init()`을 먼저 호출하므로 기존 router의 listener가 제거된 뒤 새 listener가 attach된다. 일반 `AEUI.init()`으로 router 앱을 교체해도 listener가 남지 않는다.

`resetRuntimeState()`는 router teardown을 호출하고 모든 mount/scheduler/router field를 초기값으로 되돌리지만, 실행 중인 RAF 취소 자체는 하지 않는다. component tree unmount, component cleanup, container DOM 제거도 하지 않는다. 정상 테스트 cleanup은 먼저 `stopScheduler()`와 필요한 unmount를 수행해야 한다.

`createDirectoryRouter(...).attach()`를 공통 `init()` 없이 임의로 여러 번 부르는 것은 지원 계약이 아니다. 새 teardown이 이전 closure를 덮어써 listener가 누적될 수 있다.

## 12. 오류와 무효 입력 계약

라우터는 일부 무효 route를 조용히 제외하지만 모든 오류를 흡수하지는 않는다.

### fallback으로 처리하거나 무시하는 경우

- component candidate가 함수가 아닌 일반 route: table에서 제외
- 마지막이 아닌 catch-all: table에서 제외
- 지원하지 않는 확장자: table에서 제외
- malformed percent encoding이 있는 static/dynamic/catch-all segment: 해당 route 불일치, 최종 fallback
- 일치 route 없음: custom 또는 내장 404
- `routeModules`가 nullish: 빈 route table과 내장 404 가능

### 그대로 예외가 날 수 있는 경우

- `options`에 명시적으로 `null`을 넘겨 `options.rootDir`를 읽는 경우
- `new URL(href, origin)`이 해석할 수 없는 href/origin
- module property getter나 `Object.entries` 과정의 사용자 예외
- 잘못된 container로 공통 `init`을 호출한 경우
- `window`, anchor, History API가 예상 DOM interface를 만족하지 않는 경우
- `history.pushState`, listener 등록/제거가 던지는 platform 예외

page/layout setup 또는 render 중 예외는 공통 runtime `tick()`이 `[AEUI] Render error:`로 기록한다. 라우터가 별도로 error page로 바꾸거나 fallback route로 재매칭하지는 않는다.

404는 render fallback일 뿐 HTTP response status와 무관하다.

## 13. 예제에서 확인하는 구성

### create-aeui-app template

- `vite.config.js`는 `plugins: [aeui()]`만 설정한다.
- `index.html`은 `<div id="root"></div>`만 두고 manual main script가 없다.
- `src/pages/index.jsx`, `about.jsx`, `products/[id].jsx`가 route가 된다.
- navigation은 모두 일반 `<a href>`다.
- 동적 page는 `route.params.id`를 읽는다.

### commerce-admin

- root `_layout.jsx`가 `App` shell을 import해 `<App route={route}>{children}</App>`로 모든 page와 404를 감싼다.
- shell은 `route.pathname`으로 active navigation과 admin layout을 계산한다.
- `products/[id].jsx`는 같은 page component에서 id가 바뀔 수 있으므로 watcher로 `route.params.id` 변경을 처리한다.
- root `404.jsx`는 requested `route.pathname`을 표시하고 일반 anchor로 홈에 돌아간다.

## 14. 재구현 불변식

- router는 `aeui/vite`의 hidden virtual entry와 `AEUI.__runtime` bridge 뒤에 숨고 public router API를 추가하지 않는다.
- route modules는 eager glob으로 시작 시 모두 로드한다.
- root-global `_layout`과 `404`만 special이며 nested special file은 지원하지 않는다.
- 일반 file basename이 `_`로 시작하면 제외하지만 underscore directory는 제외하지 않는다.
- component 선택은 `default || Page || module` 순서이며 최종 값이 함수여야 한다.
- sort는 segment rank `static > dynamic > catch-all`이고 동일 rank literal을 alphabetic sort하지 않는다.
- catch-all은 마지막 segment에서만 유효하며 하나 이상의 remainder를 요구한다.
- static, dynamic, catch-all을 모두 segment 단위 URL decode하고 실패하면 fallback으로 보낸다.
- repeated query key는 문자열 배열로 보존한다.
- layout과 page는 같은 `route` 객체를 받고 layout child는 page VNode 하나다.
- internal click은 `pushState` 후 match를 갱신하고 `requestRender()`를 호출한다.
- back/forward는 `popstate`에서 match를 갱신한다.
- listener closure는 `state.routerTeardown` 하나로 소유하며 다음 `init` 전에 제거한다.
- route detector, eager glob, Vite transform/parser와 runtime parser는 `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` 여섯 확장자만 동일하게 지원한다.
- 이미 internal `virtual:aeui-entry` 또는 public `/@aeui-entry`가 있으면 hidden entry를 중복 주입하지 않는다.

## 15. **현재 구현** 테스트가 제공하는 참고 증거

`example/test/src/__tests__/router.test.js`는 현재 구현의 다음 경로를 독립 검증한다. 이 목록은 새 명세 기반 test suite가 완성되기 전의 참고 증거일 뿐 최종 적합성 계약이 아니다. 새 suite 작성은 별도의 **계획 기능**이다.

- root index, static, dynamic, catch-all, query, fallback
- `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` route file
- static이 dynamic보다 먼저 매칭
- index와 empty catch-all remainder 분리
- malformed dynamic/catch-all decode의 fallback
- percent-encoded static literal match
- 마지막이 아닌 catch-all 제외
- same-origin anchor와 browser 기본 동작을 유지할 click 분리
- hidden entry 주입과 manual main entry 보존
- `data-*` attribute false positive 방지
- default alias와 사용자 alias 보존
- router bootstrap eager glob 생성
- JSX/TSX/TS route source transform

확장자와 hidden entry 결함을 수정할 때는 다음 계약도 자동 검증해야 한다.

- `.mts`, `.cts`, `.mjsx`, `.cjsx`만 있는 `src/pages`는 router mode를 선택하지 않음
- 공식 여섯 확장자는 detector, glob, transform과 runtime parser에서 동일하게 처리됨
- HTML에 `/@aeui-entry` 또는 `virtual:aeui-entry`가 이미 있으면 추가 tag를 주입하지 않음

`example/test/src/__tests__/component.test.jsx`의 통합 테스트는 다음 실제 흐름을 고정한다.

- initial location의 page와 root layout 렌더
- anchor click으로 pathname, params, query와 DOM 변경
- `popstate`로 unknown URL의 custom 404 렌더
