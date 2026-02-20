import { AEUI } from "aeui";
import { formatKRW } from "../../../lib/money.js";

function ProductCard({ product, onView, onAdd }) {
  return (
    <div className="card card--product">
      <div className="card__kicker">
        {product.category} · 평점 {Number(product.rating).toFixed(1)}/5
      </div>
      <div className="card__title">{product.name}</div>
      <div className="card__meta">
        <span className="pill">{formatKRW(product.price)}</span>
        {product.stock > 0 ? (
          <span className={`pill ${product.stock <= 3 ? "pill--danger" : "pill--ok"}`}>재고 {product.stock}</span>
        ) : (
          <span className="pill pill--danger">품절</span>
        )}
      </div>
      <div className="help" style="margin-top: 8px;">
        {product.description}
      </div>
      <div className="card__actions">
        <button className="btn btn--tab" type="button" onClick={() => onView(product.id)}>
          상세
        </button>
        <button
          className="btn btn--primary"
          type="button"
          onClick={() => onAdd(product.id)}
          disabled={product.stock <= 0}
        >
          장바구니 담기
        </button>
      </div>
      {product.tags && product.tags.length ? (
        <div className="card__meta" style="margin-top: 10px;">
          {product.tags.slice(0, 6).map((t) => (
            <span className="pill">{t}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ProductGrid({ items, onView, onAdd }) {
  return (
    <div className="grid grid--cards" style="margin-top: 14px;">
      {!Array.isArray(items) || items.length === 0 ? (
        <div className="card" style="grid-column: span 12;">
          <div style="font-weight: 900; letter-spacing: -0.02em;">표시할 상품이 없습니다.</div>
          <div className="help">필터를 조정하거나, 어드민에서 상품을 활성화해보세요.</div>
        </div>
      ) : (
        items.map((p) => <ProductCard product={p} onView={onView} onAdd={onAdd} />)
      )}
    </div>
  );
}
