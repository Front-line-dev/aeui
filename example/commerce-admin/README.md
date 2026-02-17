# AEUI Commerce + Admin Showcase

AEUI가 “실제 앱 형태”에서 잘 동작하는지, 그리고 **React보다 더 단순한 코드 스타일**로도 충분히 앱을 만들 수 있다는 걸 보여주기 위한 **오프라인 E-commerce + Admin** 예제입니다.

- 네트워크 API 없음: `seed` + `localStorage`만 사용
- AEUI 코어 수정 없음: 기본 tick(1초) 특성을 그대로 노출
- 핵심 포인트
  - `setState` 없음: 페이지/모달 내부 UI는 그냥 `let`으로 상태를 둡니다.
  - 글로벌 스토어: 각 컴포넌트가 `state.products`처럼 직접 읽습니다. (props 드릴링 최소화)
  - 이펙트는 컴포넌트에서만: `watch`(autosave 등), `clean`(타이머/pending 정리)

## 코드 읽는 순서

- `src/store.js`: 글로벌 `state` + `actions` (그냥 오브젝트, 페이지에서는 `state.products`처럼 직접 접근)
- `src/models/*`: 비즈니스 로직(카트/주문/상품)을 파일 단위로 분리
- `src/App.jsx`: 레이아웃 + `watch/clean`(clock/autosave/admin mode)
- `src/ui/pages/*`: 화면. `state`를 읽고 `actions.*`를 호출
- `src/ui/components/*`: 페이지가 커지면 view 컴포넌트를 분리(예: `components/shop`, `components/cart`, `components/admin`)
- `src/ui/components/ToastHost.jsx`: toast TTL 타이머(`watch/clean`)
- `src/ui/modals/*`: `state.modal` 기반 모달
- `src/lib/util.js`: 날짜/시간 포맷 같은 공용 유틸

## 실행

```bash
cd example/commerce-admin
npm install
npm run dev
```

## 데모 시나리오 (추천)

1. `Admin → Products`에서 `새 상품` 생성 (재고/가격 설정)
2. `스토어`로 이동해서 새 상품 노출 확인 → 장바구니 담기
3. `장바구니`에서 쿠폰 `AEUI10` 적용 → `체크아웃`
4. 체크아웃 완료 → `주문 내역`에서 주문 생성 확인
5. `Admin → Orders`에서 상태 변경(PAID→SHIPPED→DELIVERED) 확인
6. 새로고침 후에도 데이터가 유지되는지 확인 (localStorage)
7. 체크아웃 처리 중 다른 페이지로 이동해 `clean`이 타이머를 정리하는지 확인

## tick(1초) 안내

AEUI는 기본적으로 **1초마다 tick**으로 상태를 확인하고 화면을 갱신합니다.

- 이 예제는 코어 옵션을 추가하지 않고 기본 동작 그대로를 사용합니다.
