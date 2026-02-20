import { AEUI, watch } from "aeui";
import { state, actions, select } from "../../store.js";
import { calcCartTotals, clampInt } from "../../lib/money.js";
import { asArray } from "../../models/query.js";

import CartTable from "../components/cart/CartTable.jsx";
import CartSummary from "../components/cart/CartSummary.jsx";

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

  const onInc = (productId) => {
    if (!productId) return;
    actions.adjustCartQty(productId, +1);
  };

  const onDec = (productId) => {
    if (!productId) return;
    actions.adjustCartQty(productId, -1);
  };

  const onRemove = (productId) => {
    if (!productId) return;
    actions.removeFromCart(productId);
  };

  const onGoShop = () => actions.goShop();
  const onGoCheckout = () => actions.goCheckout();

  const items = () => asArray(state.cart.items);
  const totals = () => calcCartTotals({ cart: state.cart, products: asArray(state.products) });
  const rows = () => {
    const byId = new Map(asArray(state.products).filter(p => p?.id).map(p => [p.id, p]));
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
            아이템 {select.cartCount()}개 · 쿠폰 {totals().coupon || "없음"}
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
