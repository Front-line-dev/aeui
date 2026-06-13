import { AEUI } from "aeui";
import { formatKRW } from "../../../lib/money.js";

export default function CartSummary({ totals, couponDraft, onCouponInput, onApplyCoupon, canCheckout }) {
  return (
    <div className="card" style="align-self: start;">
      <div className="card__kicker">요약</div>
      <div className="grid" style="gap: 10px;">
        <div className="pill" style="justify-content: space-between;">
          <span>소계</span>
          <span style="font-weight: 900;">{formatKRW(totals?.subtotal || 0)}</span>
        </div>
        <div className="pill" style="justify-content: space-between;">
          <span>할인</span>
          <span style="font-weight: 900;">-{formatKRW(totals?.discount || 0)}</span>
        </div>
        <div className="pill" style="justify-content: space-between;">
          <span>배송</span>
          <span style="font-weight: 900;">{formatKRW(totals?.shipping || 0)}</span>
        </div>
        <div className="pill" style="justify-content: space-between;">
          <span>부가세</span>
          <span style="font-weight: 900;">{formatKRW(totals?.tax || 0)}</span>
        </div>
        <div className="pill" style="justify-content: space-between; border-color: rgba(0,0,0,0.22);">
          <span style="font-weight: 900;">총액</span>
          <span style="font-weight: 900;">{formatKRW(totals?.total || 0)}</span>
        </div>

        <div className="formRow" style="margin-bottom: 0;">
          <div className="label">쿠폰</div>
          <div style="display: flex; gap: 8px;">
            <input className="input" value={couponDraft} onInput={onCouponInput} placeholder="AEUI10" />
            <button className="btn" type="button" onClick={onApplyCoupon}>
              적용
            </button>
          </div>
          <div className="help">쿠폰 `AEUI10`은 소계의 10% 할인입니다. (데모)</div>
        </div>

        {canCheckout ? (
          <a className="btn btn--primary" href="/checkout">
            체크아웃
          </a>
        ) : (
          <button className="btn btn--primary" type="button" disabled>
            체크아웃
          </button>
        )}
      </div>
    </div>
  );
}
