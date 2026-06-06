import { AEUI, watch } from "aeui";
import { state, actions, select } from "../../store.js";
import { clampInt, formatKRW } from "../../lib/money.js";

function maxQtyFor(product) {
  const stock = product ? Number(product.stock || 0) : 0;
  return Math.max(1, stock);
}

export default function ProductPage() {
  let qty = 1;
  let maxQty = maxQtyFor(select.currentProduct());
  let lastProductId = select.currentProduct()?.id || null;

  const getProduct = () => select.currentProduct();

  const onBack = () => {
    actions.goShop();
  };

  const onInc = () => {
    maxQty = maxQtyFor(getProduct());
    qty = clampInt(qty + 1, 1, maxQty);
  };

  const onDec = () => {
    qty = clampInt(qty - 1, 1, 999);
  };

  const onAdd = () => {
    const p = getProduct();
    if (!p?.id) return;
    actions.addToCart(p.id, qty);
  };

  watch(() => {
    const p = getProduct();
    maxQty = maxQtyFor(p);
    const currentProductId = p?.id || null;

    if (currentProductId !== lastProductId) {
      lastProductId = currentProductId;
      qty = 1;
    }
    if (qty > maxQty) qty = maxQty;
  }, [state.route, state.selectedProductId, getProduct()?.stock]);

  const product = () => getProduct();

  return (
    <div className="panel">
      {product() ? (
        <>
          <div className="panel__head">
            <div>
              <h2 className="panel__title">{product().name}</h2>
              <div className="panel__sub">
                {product().category} · 평점 {Number(product().rating).toFixed(1)}/5 · {formatKRW(product().price)}
              </div>
            </div>
            <button className="btn" type="button" onClick={onBack}>
              뒤로
            </button>
          </div>
          <div className="panel__body">
            <div className="split">
              <div>
                <div style="font-weight: 900; letter-spacing: -0.02em; margin-bottom: 8px;">설명</div>
                <div style="line-height: 1.65;">{product().description}</div>
                {product().tags && product().tags.length ? (
                  <div className="card__meta" style="margin-top: 12px;">
                    {product().tags.map((t) => (
                      <span className="pill">{t}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="card" style="align-self: start;">
                <div className="card__kicker">구매</div>
                <div className="card__title">{formatKRW(product().price)}</div>
                <div className="card__meta" style="margin-bottom: 10px;">
                  {product().stock > 0 ? (
                    <span className={`pill ${product().stock <= 3 ? "pill--danger" : "pill--ok"}`}>
                      재고 {product().stock}
                    </span>
                  ) : (
                    <span className="pill pill--danger">품절</span>
                  )}
                </div>
                <div className="grid" style="gap: 10px;">
                  <div className="pill" style="justify-content: space-between;">
                    <span>수량</span>
                    <span style="font-weight: 900;">{qty}</span>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button className="btn" type="button" onClick={onDec} disabled={qty <= 1}>
                      -
                    </button>
                    <button className="btn" type="button" onClick={onInc} disabled={qty >= maxQty}>
                      +
                    </button>
                  </div>
                  <button className="btn btn--primary" type="button" onClick={onAdd} disabled={product().stock <= 0}>
                    장바구니 담기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="panel__head">
            <h2 className="panel__title">상품을 찾을 수 없습니다</h2>
            <button className="btn" type="button" onClick={onBack}>
              스토어로
            </button>
          </div>
          <div className="panel__body">
            <div className="help">삭제되었거나 비활성화된 상품일 수 있습니다.</div>
          </div>
        </>
      )}
    </div>
  );
}
