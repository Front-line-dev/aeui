# AEUI Commerce + Admin Showcase

AEUI가 “실제 앱 형태”에서 잘 동작하는지 보여주기 위한 **오프라인 E-commerce + Admin** 예제입니다.

- 네트워크 API 없음: `seed` + `localStorage`만 사용
- AEUI 코어 수정 없음: 기본 tick(1초) 특성을 그대로 노출
- 검증 포인트: `let` 상태, props 반응성, `watch`(autosave), `clean`(타이머 정리), 조건부 렌더링, 리스트 렌더링

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
