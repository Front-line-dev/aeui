import { AEUI, watch } from "aeui";
import { state, actions, select } from "../../store.js";
import { calcCartTotals, clampInt, formatKRW } from "../../lib/money.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function makeProductIndex(products) {
  const map = new Map();
  for (const p of asArray(products)) {
    if (p && p.id) map.set(p.id, p);
  }
  return map;
}

function countCartItems() {
  return select.cartCount();
}

function CartEmptyState({ onGoShop }) {
  return (
    <div className="card">
      <div style="font-weight: 900; letter-spacing: -0.02em;">장바구니가 비어있습니다.</div>
      <div className="help">스토어에서 상품을 담아보세요.</div>
      <div style="margin-top: 10px;">
        <button className="btn btn--primary" type="button" onClick={onGoShop}>
          스토어로 이동
        </button>
      </div>
    </div>
  );
}

function CartLineRow({
  productId,
  name,
  price,
  stock,
  qty,
  productFound,
  lineTotal,
  disableInc,
  disableDec,
  onInc,
  onDec,
  onRemove,
}) {
  return (
    <tr>
      <td>
        <div style="font-weight: 900; letter-spacing: -0.01em;">{name}</div>
        <div className="help">
          {!productFound ? "상품을 찾을 수 없습니다." : stock > 0 ? `재고 ${stock}` : "현재 품절"}
        </div>
      </td>
      <td>{formatKRW(price)}</td>
      <td>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button className="btn" type="button" data-product-id={productId} onClick={onDec} disabled={disableDec}>
            -
          </button>
          <span style="font-weight: 900; min-width: 24px; text-align: center;">{qty}</span>
          <button className="btn" type="button" data-product-id={productId} onClick={onInc} disabled={disableInc}>
            +
          </button>
        </div>
      </td>
      <td>{formatKRW(lineTotal)}</td>
      <td style="text-align: right;">
        <button className="btn btn--danger" type="button" data-product-id={productId} onClick={onRemove}>
          삭제
        </button>
      </td>
    </tr>
  );
}

function CartTable({ rows, onGoShop, onInc, onDec, onRemove }) {
  return (
    <>
      {asArray(rows).length === 0 ? (
        <CartEmptyState onGoShop={onGoShop} />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>상품</th>
              <th>가격</th>
              <th>수량</th>
              <th>합계</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {asArray(rows).map((r) => (
              <CartLineRow
                productId={r.productId}
                name={r.name}
                price={r.price}
                stock={r.stock}
                qty={r.qty}
                productFound={r.productFound}
                lineTotal={r.lineTotal}
                disableInc={r.disableInc}
                disableDec={r.disableDec}
                onInc={onInc}
                onDec={onDec}
                onRemove={onRemove}
              />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function CartSummary({ totals, couponDraft, onCouponInput, onApplyCoupon, onGoCheckout, canCheckout }) {
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

        <button className="btn btn--primary" type="button" onClick={onGoCheckout} disabled={!canCheckout}>
          체크아웃
        </button>
      </div>
    </div>
  );
}

export default function CartPage() {
  let couponDraft = state.cart.couponCode;

  watch(() => {
    couponDraft = state.cart.couponCode;
  }, [state.cart.couponCode]);

  const onCouponInput = (e) => {
    couponDraft = e.target.value;
  };

  const onApplyCoupon = () => {
    actions.setCoupon(couponDraft);
  };

  const onInc = (e) => {
    const id = e.currentTarget.getAttribute("data-product-id");
    if (!id) return;
    actions.adjustCartQty(id, +1);
  };

  const onDec = (e) => {
    const id = e.currentTarget.getAttribute("data-product-id");
    if (!id) return;
    actions.adjustCartQty(id, -1);
  };

  const onRemove = (e) => {
    const id = e.currentTarget.getAttribute("data-product-id");
    if (!id) return;
    actions.removeFromCart(id);
  };

  const onGoShop = () => actions.goShop();
  const onGoCheckout = () => actions.goCheckout();

  const items = () => asArray(state.cart.items);
  const totals = () => calcCartTotals({ cart: state.cart, products: asArray(state.products) });
  const rows = () => {
    const byId = makeProductIndex(state.products);
    return items().map((it) => {
      const p = byId.get(it.productId) || null;
      const qty = clampInt(it?.qty, 0, 999);
      const price = p ? Number(p.price || 0) : 0;
      const stock = p ? Number(p.stock || 0) : 0;
      const name = p ? p.name : "(삭제된 상품)";
      const productFound = !!p;
      const disableInc = !productFound || stock <= qty;
      const disableDec = qty <= 1;

      return {
        productId: it?.productId,
        name,
        price,
        stock,
        qty,
        productFound,
        lineTotal: price * qty,
        disableInc,
        disableDec,
      };
    });
  };

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">장바구니</h2>
          <div className="panel__sub">
            아이템 {countCartItems()}개 · 쿠폰 {totals().coupon || "없음"}
          </div>
        </div>
        <button className="btn" type="button" onClick={onGoShop}>
          계속 쇼핑하기
        </button>
      </div>
      <div className="panel__body">
        <div className="split">
          <div>
            <CartTable
              rows={rows()}
              onGoShop={onGoShop}
              onInc={onInc}
              onDec={onDec}
              onRemove={onRemove}
            />
          </div>
          <div>
            <CartSummary
              totals={totals()}
              couponDraft={couponDraft}
              onCouponInput={onCouponInput}
              onApplyCoupon={onApplyCoupon}
              onGoCheckout={onGoCheckout}
              canCheckout={items().length > 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
