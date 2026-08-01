# 11. 예제 애플리케이션

예제는 여러 AEUI 기능이 **실제 bundle과 브라우저에서 함께 동작하는지** 확인하는 통합 검증용이다. 문구, 그림자, 여백 같은 시각 세부는 동작에 영향을 주지 않는 한 이 문서의 범위가 아니다.

---

## 1. 예제 목록

| 예제 | 빌드 방식 | 핵심 검증 |
|---|---|---|
| `example/vite-demo` | Vite + classic JSX | local state, props, watch, clean, keyed list |
| `example/deep-compare-test` | Vite + classic JSX | 동일 데이터 새 참조, 직접 변이의 deep snapshot |
| `example/commerce-admin` | `aeui/vite` (router mode) | 디렉터리 라우터, 전역 store, 실제 CRUD |
| `example/letProps` | Babel Standalone | 부모 local `let` → 자식 props |
| `example/shoppingCart` | Babel Standalone | 배열 직접 변이, keyed component, computed watch |

---

## 2. 빌드 방식

### Vite + classic JSX (`vite-demo`, `deep-compare-test`)

Vite의 React plugin을 **JSX 변환 운반체로만** 사용한다. React runtime은 사용하지 않는다.

```
include: /\.[jt]sx$/
jsxRuntime: classic
Babel plugin 1: aeui/babel-plugin
Babel plugin 2: @babel/plugin-transform-react-jsx
pragma: AEUI.createElement
pragmaFrag: AEUI.Fragment
```

`main.js`: `AEUI`와 `App`을 import → `AEUI.init(App, document.getElementById('root'))`

### `aeui/vite` (`commerce-admin`)

```js
plugins: [aeui()]
```

`index.html`에는 `<div id="root"></div>`만. 수동 module script 없음. Vite plugin이 virtual entry, route glob, style import, init을 생성한다.

### Babel Standalone (`letProps`, `shoppingCart`)

CDN Babel Standalone을 로드하고 다음 순서로 실행:

1. core source에서 `AEUI`, `watch`, `clean`과 Babel plugin source를 ESM import
2. 세 runtime 값을 `window`에 등록
3. plugin을 `aeui-transform` 이름으로 등록
4. `type="text/aeui-code"` script text를 React preset + AEUI plugin으로 변환
5. 결과를 eval, 오류는 console + 빨간 `<pre>`로 표시

> 이 두 HTML은 **개발 진단용**이며 npm 배포 템플릿/production 보안 스펙의 범위 밖이다.

---

## 3. Vite Demo

### 컴포넌트 트리

```
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

### 필수 동작

**Counter:**
- 독립 `count = 0` closure, 클릭으로 증가
- `[count]` watcher가 변경 후 title과 count를 console.log

**TreeTest:**
- 두 Child가 독립 count를 가짐
- Child 클릭이 Parent의 setup 로그를 **다시 출력해서는 안 됨**

**ComplexExample:**
- local 상태: count, text input, list visibility, `items = ['Apple', 'Banana', 'Cherry']`, timer
- timer: 1초마다 직접 증가, unmount 시 interval 해제
- list add: trim 결과가 비어 있지 않을 때 `push`, delete: `splice`
- checkbox `checked`와 text input `value`는 controlled property 복구 경로 사용
- list item key는 index (데모 단순화)

**TestingContainer:**
- 2초 interval로 `globalCount` 증가, cleanup에서 해제
- 같은 값을 세 방식(object pattern, 임의 identifier, 일반 props)으로 자식에게 전달
- 세 자식 모두 최신 props와 watcher 동작 확인

---

## 4. Deep Compare Test

`App`이 네 개의 `TestSection`을 렌더:

| 테스트 | 동작 | 기대 결과 |
|---|---|---|
| Watch Deduplication | 2초 후 `state = { count: 1 }` 새 참조/같은 내용 할당 | 4초까지 trigger count = 0 |
| Set In-Place Mutation | `new Set([1])`에 2초 후 `add(2)` | watcher 정확히 1회 |
| Object In-Place Mutation | `{ nested: { b: 2 } }`의 `nested.b`를 3으로 변경 | watcher 1회 이상 |
| DOM Prop Test | style을 `'color: blue'` → `'color: red'`로 직접 변경 | DOM style 변화 표시 |

---

## 5. Commerce Admin

### 5.1 route map

| 파일 | URL | 역할 |
|---|---|---|
| `pages/index.jsx` | `/` | 상품 검색, filter, 장바구니 담기 |
| `pages/products/[id].jsx` | `/products/:id` | 상품 상세, 수량 선택 |
| `pages/cart.jsx` | `/cart` | 수량 조정, 삭제, 쿠폰, 합계 |
| `pages/checkout.jsx` | `/checkout` | 고객 입력, 검증, 비동기 결제 |
| `pages/orders.jsx` | `/orders` | 주문 목록 |
| `pages/admin/index.jsx` | `/admin` | 통계 대시보드 |
| `pages/admin/products.jsx` | `/admin/products` | 상품 CRUD |
| `pages/admin/orders.jsx` | `/admin/orders` | 주문 상태 관리 |
| `pages/404.jsx` | fallback | 404 |
| `pages/_layout.jsx` | 모든 route | `<App route={route}>{children}</App>` |

### 5.2 전역 state (`store.js`)

Proxy나 setter 없는 **단일 mutable object**:

```
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

selector: `cartCount()`, `product(id)`, `order(id)`.
page/component는 state를 직접 읽고 action을 호출한다.

### 5.3 App shell과 localStorage

App setup 자원:

- 1초 clock interval → `state.clockNow` 갱신, cleanup에서 해제
- pathname 변경 watcher → modal 닫기 + `body.mode--admin` 토글
- products/cart/orders/activity watcher → localStorage 저장

localStorage 형식:

key: `"aeui-commerce-admin:v1"` (별도 상수)

value (JSON 문자열):

```json
{
  "version": 1,
  "savedAt": 1234567890123,
  "data": { "products": [], "cart": {}, "orders": [], "activity": [] }
}
```

key는 `localStorage.getItem`/`setItem`에 전달하는 문자열이고, value는 `version`, `savedAt`, `data`를 담은 JSON 객체다.

parse 오류, key 부재, version 불일치는 null 처리. 초기 데이터는 각 배열이 실제 배열일 때만 사용, 나머지는 seed 대체.

### 5.4 상품과 장바구니 규칙

**필터 기본값:** query `''`, category `ALL`, inStockOnly `true`, sort `FEATURED`.

**정렬:**
- `PRICE_ASC`/`PRICE_DESC`: price 순
- `RATING_DESC`: rating 내림차순
- `NEW_DESC`: createdAt 내림차순
- `FEATURED` (기본): `hot` tag 2점 + `new` tag 1점 → rating → createdAt

**장바구니 담기 (`addToCart`):**
1. `floor(Number(qty))` → 1~999 clamp
2. 기존 cart 수량은 0~999 clamp
3. 최종 수량은 product stock 이하
4. 비활성/없는 상품, 재고 0은 거절 + danger toast
5. 변화 없으면 재고 부족 toast

**수량 조정 (`adjustCartQty`):**
- `(현재 + delta)` → 0~stock clamp (999 상한 없음)
- 결과 0 이하면 cart에서 제거

**쿠폰:** 유효 코드는 `AEUI10` 하나. 입력 원문을 보존, 판정 시에만 trim+대문자로 비교.

**합계 계산:**
```
subtotal = Σ(price × qty)
discount = AEUI10 ? floor(subtotal × 0.10) : 0
taxable  = max(0, subtotal - discount)
tax      = floor(taxable × 0.10)
shipping = taxable이 0 또는 ≥20000 ? 0 : 3000
total    = taxable + tax + shipping
```

### 5.5 주문 규칙

- checkout commit 직전 모든 상품 재검증 (존재, active, stock)
- 성공 주문: PAID 상태, 상품 이름/가격 snapshot, customer, totals 저장
- 재고 차감, 주문을 배열 앞에 추가, cart/coupon 초기화
- CANCELED 주문은 이후 상태 변경 무시
- 취소는 PAID에서만, confirm modal 후 재고 복원
- 비CANCELED 상태 변경은 `nextStatus`를 그대로 대입 (순서 검증 없음)

**fake authorization:**
- `{ promise, cancel }` controller 즉시 반환
- 900~1999ms 후 18% 확률 reject, 성공 시 `{ paymentId, amount, approvedAt }`
- `cancel()`은 pending timer만 해제 (promise는 reject하지 않음)
- checkout page cleanup은 진행 중 payment를 cancel해야 함

**checkout validation:**
- step 1/최종: trim한 name/address1/zip 비어 있지 않고 email에 `@`와 `.` 존재
- step 2/최종: agree = true
- 빈 cart와 중복 processing도 거부

### 5.6 상품 관리

- create modal 기본값: category `굿즈`, price 1000, stock 0, rating 4.2, active true
- editor validation: name/category 필수, price 정수 0~100M clamp (≥1), stock 정수 0~1M, rating 0~5, tags는 comma split → trim → 빈 값 제거 → 앞 10개
- create: `p_*` id, 생성/수정 시간, products 앞에 추가
- edit: 같은 object 직접 수정, `updatedAt` 갱신
- delete: confirm 후 products와 cart에서 제거
- 활성 전환: `active` 직접 뒤집기

### 5.7 notification과 modal

- activity: 최대 220개, 초과 시 앞(오래된 항목)을 splice
- toast 기본값: title `알림`, tone `info`, TTL 3600ms, 배열 spread로 추가
- `ToastHost`: id별 timer Map, 사라진 toast timer 정리, 새 toast TTL 등록, unmount 시 전체 정리
- modal overlay: click target === currentTarget일 때만 닫힘
- confirm action: `state.modal.type === 'confirm'`일 때만 `onConfirm` 호출

### 5.8 필수 통합 시나리오

1. Admin Products에서 새 상품 생성
2. Store에서 새 상품 확인 후 cart에 담기
3. `AEUI10` 쿠폰 적용 + checkout 완료
4. Orders에서 생성된 주문 확인
5. Admin Orders에서 PAID → SHIPPED → DELIVERED 전이
6. 새로고침 후 products/cart/orders/activity 유지 확인
7. checkout 중 route 이탈 시 pending timer cleanup 확인
8. `/products/p_aeui_mug` 직접 새로고침 → dynamic route 확인

---

## 6. Babel Standalone 예제

두 embedded source는 `/** @jsx AEUI.createVNode */` pragma를 가진다.

**letProps:** 부모 count를 자식 callback으로 변경, 최신 props 확인.

**shoppingCart:** 세 고정 상품의 quantity를 직접 변경, total watcher, 20,000원 이상 무료배송 조건 확인.
