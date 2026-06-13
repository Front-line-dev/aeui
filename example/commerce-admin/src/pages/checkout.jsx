import { clean } from "aeui";
import { state, actions } from "@/store.js";
import { calcCartTotals, normalizeCoupon } from "@/lib/money.js";
import { fakeAuthorizePayment } from "@/lib/fakeApi.js";

function isEmail(v) {
  const s = String(v || "").trim();
  return s.includes("@") && s.includes(".");
}

export default function CheckoutPage() {
  let step = 1;

  let name = "";
  let email = "";
  let address1 = "";
  let address2 = "";
  let zip = "";
  let agree = false;

  let processing = false;
  let error = "";

  let pending = null;

  clean(() => {
    if (pending && typeof pending.cancel === "function") {
      pending.cancel();
    }
  });

  const hasItems = () => Array.isArray(state.cart?.items) && state.cart.items.length > 0;
  const totals = () => calcCartTotals({ cart: state.cart, products: state.products });
  const coupon = () => normalizeCoupon(state.cart?.couponCode || "");

  const onNameInput = (e) => (name = e.target.value);
  const onEmailInput = (e) => (email = e.target.value);
  const onAddress1Input = (e) => (address1 = e.target.value);
  const onAddress2Input = (e) => (address2 = e.target.value);
  const onZipInput = (e) => (zip = e.target.value);
  const onAgreeChange = (e) => (agree = e.target.checked);

  const onNext = () => {
    error = "";
    if (step === 1) {
      if (!String(name).trim()) return (error = "이름을 입력해주세요.");
      if (!isEmail(email)) return (error = "이메일 형식이 올바르지 않습니다.");
      if (!String(address1).trim()) return (error = "주소1을 입력해주세요.");
      if (!String(zip).trim()) return (error = "우편번호를 입력해주세요.");
    }
    if (step === 2) {
      if (!agree) return (error = "결제 진행에 동의해주세요.");
    }
    step = Math.min(3, step + 1);
  };

  const onPrev = () => {
    error = "";
    step = Math.max(1, step - 1);
  };

  const onPlaceOrder = () => {
    error = "";
    if (processing) return;

    if (!hasItems()) {
      error = "장바구니가 비어있습니다.";
      return;
    }
    if (!String(name).trim()) return (error = "이름을 입력해주세요.");
    if (!isEmail(email)) return (error = "이메일 형식이 올바르지 않습니다.");
    if (!String(address1).trim()) return (error = "주소1을 입력해주세요.");
    if (!String(zip).trim()) return (error = "우편번호를 입력해주세요.");
    if (!agree) return (error = "결제 진행에 동의해주세요.");

    processing = true;

    pending = fakeAuthorizePayment({ amount: totals().total });
    pending.promise
      .then((payment) => {
        processing = false;
        pending = null;
        actions.completeCheckout({
          customer: {
            name: String(name).trim(),
            email: String(email).trim(),
            address1: String(address1).trim(),
            address2: String(address2).trim(),
            zip: String(zip).trim(),
          },
          payment,
        });
      })
      .catch((e) => {
        processing = false;
        pending = null;
        error = e?.message || "체크아웃에 실패했습니다.";
      });
  };

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">체크아웃</h2>
          {hasItems() ? (
            <div className="panel__sub">
              단계 {step}/3 · 총액 {totals().total.toLocaleString("ko-KR")}원 · 쿠폰 {coupon() || "없음"}
            </div>
          ) : (
            <div className="panel__sub">장바구니가 비어있습니다.</div>
          )}
        </div>
        <a className="btn" href="/cart" style={processing ? "pointer-events:none; opacity:0.6;" : ""}>
          장바구니로
        </a>
      </div>
      <div className="panel__body">
        {!hasItems() ? (
          <div className="card">
            <div style="font-weight: 900; letter-spacing: -0.02em;">장바구니가 비어있습니다.</div>
            <div className="help">스토어에서 상품을 담아주세요.</div>
            <div style="margin-top: 10px;">
              <a className="btn btn--primary" href="/orders">
                주문 내역 보기
              </a>
            </div>
          </div>
        ) : (
          <div className="split">
            <div>
              {step === 1 ? (
                <div className="card">
                  <div style="font-weight: 900; letter-spacing: -0.02em; margin-bottom: 10px;">1) 배송 정보</div>
                  <div className="formRow">
                    <div className="label">이름</div>
                    <input className="input" value={name} onInput={onNameInput} />
                  </div>
                  <div className="formRow">
                    <div className="label">이메일</div>
                    <input className="input" value={email} onInput={onEmailInput} />
                  </div>
                  <div className="formRow">
                    <div className="label">주소 1</div>
                    <input className="input" value={address1} onInput={onAddress1Input} />
                  </div>
                  <div className="formRow">
                    <div className="label">주소 2</div>
                    <input className="input" value={address2} onInput={onAddress2Input} />
                  </div>
                  <div className="formRow" style="margin-bottom: 0;">
                    <div className="label">우편번호</div>
                    <input className="input" value={zip} onInput={onZipInput} />
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="card">
                  <div style="font-weight: 900; letter-spacing: -0.02em; margin-bottom: 10px;">2) 결제</div>
                  <div className="help" style="margin-bottom: 10px;">
                    실제 결제는 없고, Promise + setTimeout으로 승인/실패를 시뮬레이션합니다.
                  </div>
                  <label className="pill" style="display: inline-flex;">
                    <input
                      type="checkbox"
                      checked={agree}
                      onChange={onAgreeChange}
                      style="margin-right: 8px;"
                    />
                    결제 진행에 동의합니다
                  </label>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="card">
                  <div style="font-weight: 900; letter-spacing: -0.02em; margin-bottom: 10px;">3) 검토 및 주문</div>
                  <div className="help" style="margin-bottom: 10px;">주문 버튼을 누르면 결제 승인을 기다립니다.</div>
                  <div className="pill" style="justify-content: space-between;">
                    <span>수령인</span>
                    <span style="font-weight: 900;">{String(name).trim() || "-"}</span>
                  </div>
                  <div className="pill" style="justify-content: space-between; margin-top: 8px;">
                    <span>이메일</span>
                    <span style="font-weight: 900;">{String(email).trim() || "-"}</span>
                  </div>
                  <div className="pill" style="justify-content: space-between; margin-top: 8px;">
                    <span>배송지</span>
                    <span style="font-weight: 900;">
                      {String(address1).trim() ? `${address1} ${address2}` : "-"}
                    </span>
                  </div>
                  <div style="margin-top: 12px;">
                    <button className="btn btn--primary" type="button" onClick={onPlaceOrder} disabled={processing}>
                      {processing ? "처리 중..." : "주문하기"}
                    </button>
                  </div>
                  <div className="help" style="margin-top: 10px;">
                    팁: 체크아웃 도중 다른 페이지로 이동하면 `clean`으로 타이머가 정리됩니다.
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="error" style="margin-top: 10px;">
                  {error}
                </div>
              ) : null}

              <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
                <button className="btn" type="button" onClick={onPrev} disabled={processing || step <= 1}>
                  이전
                </button>
                <button className="btn btn--primary" type="button" onClick={onNext} disabled={processing || step >= 3}>
                  다음
                </button>
              </div>
            </div>

            <div className="card" style="align-self: start;">
              <div className="card__kicker">결제 요약</div>
              <div className="grid" style="gap: 10px;">
                <div className="pill" style="justify-content: space-between;">
                  <span>소계</span>
                  <span style="font-weight: 900;">{totals().subtotal.toLocaleString("ko-KR")}원</span>
                </div>
                <div className="pill" style="justify-content: space-between;">
                  <span>할인</span>
                  <span style="font-weight: 900;">-{totals().discount.toLocaleString("ko-KR")}원</span>
                </div>
                <div className="pill" style="justify-content: space-between;">
                  <span>배송</span>
                  <span style="font-weight: 900;">{totals().shipping.toLocaleString("ko-KR")}원</span>
                </div>
                <div className="pill" style="justify-content: space-between;">
                  <span>부가세</span>
                  <span style="font-weight: 900;">{totals().tax.toLocaleString("ko-KR")}원</span>
                </div>
                <div className="pill" style="justify-content: space-between; border-color: rgba(0,0,0,0.22);">
                  <span style="font-weight: 900;">총액</span>
                  <span style="font-weight: 900;">{totals().total.toLocaleString("ko-KR")}원</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
