# 11. 예제 애플리케이션 계약

## 1. 역할과 범위

예제는 프레임워크 공개 API의 추가 명세가 아니라, 여러 기능이 실제 번들 및 브라우저에서 함께 동작하는지 확인하는 참조 애플리케이션이다. 호환 구현은 동일한 상태 흐름과 검증 시나리오를 재현해야 한다. 문구, 그림자, 여백 같은 시각 세부는 별도 UI 변경이 없는 한 그대로 유지하는 편이 좋지만 코어 적합성 기준은 아니다.

| 예제 | 주 역할 |
|---|---|
| `example/vite-demo` | classic JSX 수동 설정, local state, props, watch, clean, keyed list |
| `example/deep-compare-test` | 새 참조의 동일 데이터와 직접 변이의 deep snapshot 검증 |
| `example/commerce-admin` | `aeui/vite`, 디렉터리 라우터, alias, 전역 mutable store, 실제 CRUD 흐름 |
| `example/letProps` | Babel Standalone에서 부모 local `let`과 자식 props 전달 |
| `example/shoppingCart` | Babel Standalone에서 배열 직접 변이, keyed component, computed watch |
| `example/test` | 현재 구현 회귀를 조사하는 기존 suite. 적합성 suite는 문서 기준으로 처음부터 다시 작성할 예정이며 상세 원칙은 10 문서 참조 |

## 2. 공통 빌드 방식

`vite-demo`와 `deep-compare-test`는 Vite의 React 플러그인을 JSX 변환 운반체로만 사용한다. React 런타임은 사용하지 않는다.

```text
include: /\.[jt]sx$/
jsxRuntime: classic
Babel plugin 1: aeui/babel-plugin
Babel plugin 2: @babel/plugin-transform-react-jsx
pragma: AEUI.createElement
pragmaFrag: AEUI.Fragment
```

두 앱의 `main.js`는 `AEUI`와 `App`을 import하고 `AEUI.init(App, document.getElementById('root'))`를 호출한다.

`commerce-admin`은 `plugins: [aeui()]`만 사용한다. `index.html`에는 `#root`만 있고 수동 module script가 없으므로 Vite 플러그인이 가상 entry, route glob, style import와 init을 생성한다.

## 3. Vite Demo

### 3.1 component tree

```text
App
├─ Counter(title="Counter 1")
├─ Counter(title="Counter 2")
├─ TreeTest
│  ├─ Child(name="A")
│  └─ Child(name="B")
├─ ComplexExample
│  └─ ListItem * N
└─ TestingContainer
   ├─ DestructuredCounter
   ├─ AliasedCounter
   └─ DirectCounter
```

### 3.2 필수 동작

- 각 `Counter`는 독립 `count = 0` closure를 가지고 클릭으로 증가한다. `[count]` watcher는 변경 후 title과 count를 로그한다.
- `TreeTest`의 두 Child도 독립 count를 가진다. Child 클릭 때문에 Parent setup 로그가 다시 출력되어서는 안 된다.
- `ComplexExample`은 count, text input, list visibility, `items = ['Apple', 'Banana', 'Cherry']`, timer를 local 상태로 둔다.
- timer는 1초마다 직접 증가하고 unmount 시 interval을 해제한다.
- list add는 trim 결과가 비어 있지 않을 때 `push`, delete는 `splice`를 사용한다.
- checkbox `checked`와 text input `value`는 controlled property 복구 경로를 사용한다.
- list item key는 데모 단순화를 위해 index다.
- `TestingContainer`는 2초 interval로 `globalCount`를 증가시키고 cleanup에서 해제한다. 같은 값을 object pattern, 임의 identifier, 일반 props identifier 세 방식으로 자식에게 전달하여 최신 props와 watcher를 확인한다.

## 4. Deep Compare Test

`App`은 네 개의 `TestSection`을 렌더한다.

1. **Watch Deduplication**: 2초 후 `state = { count: 1 }`로 새 참조지만 같은 내용을 할당한다. 현재 runtime 의미상 초기 snapshot은 callback을 실행하지 않으므로 목표 계약은 4초 시점 trigger 0이다. 다만 현재 진단 UI는 역사적 문구를 보존해 trigger가 0이면 `PASS: Watch did not re-trigger`, 1이면 `PASS: Watch triggered once (initial) and ignored duplicate.`, 2 이상이면 FAIL로 표시한다. 이 UI 문구는 적합성 판정 기준이 아니며 새 suite는 문서의 목표 계약을 직접 검증해야 한다.
2. **Set In-Place Mutation**: `new Set([1])`에 2초 후 `add(2)` 한다. watcher는 정확히 한 번 실행되어야 한다.
3. **Object In-Place Mutation**: `{ a: 1, nested: { b: 2 } }`의 `nested.b`를 3으로 바꾼다. watcher는 한 번 이상 실행되어야 한다.
4. **DOM Prop Test**: `{ style: 'color: blue' }`의 `style` 값을 2초 후 `'color: red'`로 직접 바꾸고 DOM style 변화를 보여준다.

이 앱의 세 interval과 DOM Prop Test의 timeout은 기존 참조 구현에서 cleanup하지 않는다. 페이지 수명 동안 실행되는 진단 fixture라는 현재 동작을 재현하되, 새 기능 설계의 모범 cleanup 예시로 간주하지 않는다.

## 5. Commerce Admin

### 5.1 route map

| 파일 | URL | 역할 |
|---|---|---|
| `pages/index.jsx` | `/` | 상품 검색, category/stock/sort filter, 장바구니 담기 |
| `pages/products/[id].jsx` | `/products/:id` | 상품 상세, 수량 선택, 장바구니 담기 |
| `pages/cart.jsx` | `/cart` | 수량 조정, 삭제, `AEUI10` coupon, 합계 |
| `pages/checkout.jsx` | `/checkout` | 고객 입력, 검증, 비동기 결제 승인, 주문 생성 |
| `pages/orders.jsx` | `/orders` | 사용자 주문 목록과 선택 상세 |
| `pages/admin/index.jsx` | `/admin` | 상품/주문/매출/activity 통계 |
| `pages/admin/products.jsx` | `/admin/products` | 상품 filter, 생성, 수정, 활성 전환, 삭제 |
| `pages/admin/orders.jsx` | `/admin/orders` | 상태 filter, 상태 변경, 주문 취소 |
| `pages/404.jsx` | fallback | 찾지 못한 pathname 표시 |
| `pages/_layout.jsx` | 모든 route | `App` shell에 `{route, children}` 전달 |

루트 layout은 단순히 `<App route={route}>{children}</App>`을 반환한다.

### 5.2 전역 state

`store.js`는 Proxy나 setter 없는 단일 mutable object를 export한다.

```text
products: Product[]
cart: { items: { productId, qty }[], couponCode: string }
orders: Order[]
activity: { at, type, message }[]
selectedOrderId: string | null
modal: null | ProductEditorModalState | ConfirmModalState
toasts: { id, title, message, tone, ttlMs, createdAt }[]
clockNow: number
lastSavedAt: number
lastSaveError: string
```

selector는 `cartCount()`, `product(id)`, `order(id)` 세 개다. action object는 model 함수를 얇게 위임하며 page/component는 state를 직접 읽고 action을 호출한다.

### 5.3 App shell과 지속성

App setup은 다음 수명 자원을 만든다.

- 1초 clock interval로 `state.clockNow` 갱신, cleanup에서 해제
- pathname 변경 watcher: modal을 닫고 `body.mode--admin`을 pathname의 `/admin` prefix에 맞춤
- products/cart/orders/activity watcher: localStorage에 저장하고 성공 시 `lastSavedAt`, 실패 시 `lastSaveError` 갱신

top bar에는 store/cart/orders/admin 링크, cart 수량, 저장 상태, reset 버튼이 있다. admin pathname에서는 sidebar를 표시한다. 본문 뒤에 `ToastHost`, 조건부 ProductEditor/Confirm modal을 둔다.

localStorage 계약은 다음과 같다.

```text
key: aeui-commerce-admin:v1
payload: { version: 1, savedAt: number, data: { products, cart, orders, activity } }
```

parse 오류, key 부재, version 불일치는 null로 처리한다. 초기 데이터는 각 persisted 배열이 실제 배열일 때만 사용하고 나머지는 seed로 대체한다. cart는 항상 `{items: array, couponCode: string}`으로 정규화한다.

### 5.4 상품과 장바구니 규칙

- 상품은 id, name, category, price, stock, rating, tags, active, description, createdAt, updatedAt을 가진다.
- 고정 seed에는 `p_aeui_mug`, `p_aeui_note`, `p_brewing_beans`, `p_vdom_poster`, `p_sticker_pack`, `p_let_state_tshirt`, `p_tick_keycaps`, `p_inactive_sample`이 있다.
- Store의 local filter 기본값은 `query = ''`, `category = 'ALL'`, `inStockOnly = true`, `sort = 'FEATURED'`다. active 상품만 보이고, category exact match와 stock 양수 조건을 적용한다. 검색어는 trim/lowercase 후 name, description, 각 tag의 case-insensitive substring으로 찾는다.
- Store 정렬 option은 `PRICE_ASC`, `PRICE_DESC`, `RATING_DESC`, `NEW_DESC`를 각각 price/rating/createdAt 숫자 비교로 처리한다. 그 외 값과 기본 `FEATURED`는 `hot` tag 2점 + `new` tag 1점, rating 내림차순, createdAt 내림차순 순으로 비교한다.
- `addToCart`의 요청 수량은 `floor(Number(qty))` 후 1~999, 기존 cart 수량은 0~999로 clamp하고 최종 수량은 product stock을 넘지 않는다.
- `adjustCartQty`는 `(현재 qty + delta)`를 0~`product.stock`으로 clamp한다. 이 경로에는 999 상한이 없으므로 stock이 더 크면 cart 수량도 999를 넘을 수 있다.
- 비활성/없는 상품과 재고 0은 담기를 거절하고 danger toast를 만든다.
- 담기 수량은 현재 재고를 넘지 않는다. 변화가 없으면 재고 부족 toast를 만든다.
- 수량 감소 결과가 0 이하면 cart에서 제거한다.
- coupon action은 입력 원문을 `String(code || '')`로 `state.cart.couponCode`에 보존한다. 유효성 판정과 합계 계산에서만 trim 후 대문자로 정규화하며 유효한 demo code는 `AEUI10` 하나다.
- 합계는 `subtotal = Σ product.price * item.qty`, `discount = AEUI10 ? floor(subtotal * 0.10) : 0`, `taxable = max(0, subtotal - discount)`, `tax = floor(taxable * 0.10)` 순서다. 배송비는 taxable이 0 또는 20,000 이상이면 0, 그 사이면 3,000이고 total은 `taxable + tax + shipping`이다.

### 5.5 주문 규칙

- checkout commit 직전에 모든 상품의 존재, active, stock을 다시 검증한다.
- 성공 주문은 PAID 상태이며 상품 이름/가격 snapshot, customer, totals를 저장한다.
- 재고를 차감하고 주문을 배열 앞에 넣은 뒤 cart와 coupon을 비운다.
- order status가 CANCELED이면 이후 일반 상태 변경을 무시한다.
- 그 외 status 변경은 허용 값이나 전이 순서를 검사하지 않고 `nextStatus`를 그대로 대입한다. UI select는 PAID/SHIPPED/DELIVERED만 제공하지만 model을 직접 호출하면 역전이나 임의 문자열도 저장될 수 있다.
- CANCELED 요청은 confirm modal을 연다. 실제 취소는 PAID에서만 허용하고 각 주문 item 수량만큼 재고를 복원한다.
- checkout의 fake authorization 함수는 `{ promise, cancel }` controller를 즉시 반환한다. promise는 900~1999ms 뒤 18% 확률로 오류를 reject하고, 성공하면 `{ paymentId: 'pay_*', amount, approvedAt }`을 resolve한다. controller의 `cancel()`은 pending timer만 해제하며 promise를 별도로 reject하지 않는다.
- checkout page cleanup은 진행 중 payment 요청을 cancel해야 한다.
- Checkout local 기본값은 step 1, 모든 text field 빈 문자열, agree/processing false다. step 1의 다음 이동과 최종 주문은 trim한 name/address1/zip이 비어 있지 않고 email 문자열에 `@`와 `.`이 모두 있는지 검사한다. step 2와 최종 주문은 agree가 true여야 한다. `onNext`는 최대 3, `onPrev`는 최소 1로 clamp한다.
- 최종 주문은 빈 cart와 중복 processing도 거부한다. 성공 customer snapshot은 name/email/address1/address2/zip을 모두 trim하고, 실패하면 fake API error message 또는 기본 오류를 local `error`에 둔다.
- Admin Orders의 기본 status filter는 `ALL`이며 exact status로 filter한 뒤 `createdAt` 내림차순 정렬한다. UI는 CANCELED order의 select를 비활성화하고 cancel 버튼은 PAID에서만 활성화한다.

### 5.6 상품 관리 규칙

- create modal의 기본값은 category `굿즈`, price 1000, stock 0, rating 4.2, active true다.
- edit modal은 현재 상품을 draft로 복사하고 tags를 comma-separated `tagsText`로 바꾼다.
- editor submit은 name/category/description을 trim한다. name과 category는 필수이고, price는 정수 floor 후 0~100,000,000으로 clamp한 뒤 1 이상이어야 하며, stock은 정수 floor 후 0~1,000,000, rating은 숫자 변환 후 0~5로 clamp한다.
- tagsText는 comma로 나누고 각 항목을 trim한 뒤 빈 값 제거, 앞 10개 제한을 적용한다. active는 boolean으로 강제한다. validation 실패는 modal의 `error`만 바꾸고 저장 action을 호출하지 않는다.
- create는 `p_*` id와 생성/수정 시간을 만들고 products 앞에 추가한다.
- edit는 같은 object를 직접 수정하고 `updatedAt`을 갱신한다.
- delete는 confirm 뒤 products와 cart에서 해당 id를 제거한다.
- 활성 전환은 object의 `active`를 직접 뒤집는다.
- Admin Products의 local 기본값은 query 빈 문자열, category `ALL`, `showInactive = true`다. category 후보는 active 여부와 무관한 전체 상품 category의 정렬된 unique 목록이다. visible 목록은 inactive/category/search를 순서대로 filter하고 `updatedAt` 내림차순 정렬한다. 검색 필드는 Store와 같은 name/description/tag substring이다.

### 5.7 notification과 modal

- activity는 최대 220개다. 초과 시 앞의 오래된 항목을 splice로 버린다.
- toast 기본값은 title `알림`, tone `info`, TTL 3600ms다. 새 toast는 배열 spread로 추가한다.
- `ToastHost`는 id별 timer Map을 유지한다. 사라진 toast timer를 먼저 제거하고 새 toast의 남은 TTL을 계산해 등록하며 unmount 시 모두 정리한다.
- toast 클릭은 즉시 dismiss한다.
- Modal overlay는 click target과 currentTarget이 같을 때만 닫힌다.
- confirm action은 `state.modal.type === 'confirm'`일 때만 저장된 `onConfirm`을 호출한다.

### 5.8 필수 수동 시나리오

1. Admin Products에서 새 상품을 만든다.
2. Store에서 새 상품을 확인하고 cart에 담는다.
3. `AEUI10`을 적용하고 checkout을 완료한다.
4. Orders에서 생성된 주문을 확인한다.
5. Admin Orders에서 PAID → SHIPPED → DELIVERED 전이를 확인한다.
6. 새로고침 뒤 products/cart/orders/activity가 유지되는지 확인한다.
7. checkout 처리 중 route를 떠나 pending timer가 cleanup되는지 확인한다.
8. `/products/p_aeui_mug`를 직접 새로고침해 dynamic route와 안정적인 seed id를 확인한다.

## 6. Babel Standalone 예제

`letProps/index.html`과 `shoppingCart/index.html`은 CDN Babel Standalone을 로드하고 다음 순서로 실행한다.

1. core source의 `AEUI`, `watch`, `clean`과 Babel plugin source를 ESM import한다.
2. 세 runtime 값을 `window`에 둔다.
3. plugin을 `aeui-transform` 이름으로 등록한다.
4. `type="text/aeui-code"` script text를 React preset과 AEUI plugin으로 변환한다.
5. 결과를 eval하고 오류를 console 및 빨간 `<pre>`로 표시한다.

두 embedded source는 `/** @jsx AEUI.createVNode */` pragma를 가진다. `letProps`는 부모 count를 자식 callback으로 변경하고 최신 props를 확인한다. `shoppingCart`는 세 고정 상품의 quantity를 직접 바꾸고 total watcher와 20,000원 이상 무료배송 조건을 확인한다.

이 두 HTML은 외부 CDN과 eval을 사용하는 개발 진단용이다. npm 배포 템플릿이나 production 보안 모델로 복제하지 않는다.
