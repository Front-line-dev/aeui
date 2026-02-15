import { AEUI } from "aeui";
import { state, actions } from "../../store.js";
import { formatKRW } from "../../lib/money.js";

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function computeCategories(products) {
  return Array.from(new Set(asArray(products).filter((p) => p?.active).map((p) => p.category))).sort((a, b) => cmp(a, b));
}

function normalizeQuery(query) {
  return String(query || "").trim().toLowerCase();
}

function scoreFeatured(p) {
  const tags = p?.tags || [];
  return (tags.includes("hot") ? 2 : 0) + (tags.includes("new") ? 1 : 0);
}

function isVisibleProduct(p, { q, category, inStockOnly }) {
  if (!p || !p.active) return false;
  if (category && category !== "ALL" && p.category !== category) return false;
  if (inStockOnly && p.stock <= 0) return false;

  if (!q) return true;
  if (String(p.name).toLowerCase().includes(q)) return true;
  if (String(p.description || "").toLowerCase().includes(q)) return true;
  if ((p.tags || []).some((t) => String(t).toLowerCase().includes(q))) return true;
  return false;
}

function compareForSort(a, b, sort) {
  if (sort === "PRICE_ASC") return cmp(a.price, b.price);
  if (sort === "PRICE_DESC") return cmp(b.price, a.price);
  if (sort === "RATING_DESC") return cmp(b.rating, a.rating);
  if (sort === "NEW_DESC") return cmp(b.createdAt, a.createdAt);

  const s = cmp(scoreFeatured(b), scoreFeatured(a));
  if (s) return s;
  const r = cmp(b.rating, a.rating);
  if (r) return r;
  return cmp(b.createdAt, a.createdAt);
}

function selectVisibleProducts(products, { query, category, inStockOnly, sort }) {
  const list = asArray(products);
  const q = normalizeQuery(query);
  return list.filter((p) => isVisibleProduct(p, { q, category, inStockOnly })).slice().sort((a, b) => compareForSort(a, b, sort));
}

function ShopFilters({
  query,
  sort,
  category,
  inStockOnly,
  categories,
  onQueryInput,
  onCategoryChange,
  onStockToggle,
  onSortChange,
}) {
  return (
    <div className="grid" style="gap: 10px;">
      <div className="split" style="grid-template-columns: 1fr 1fr;">
        <div className="formRow" style="margin-bottom: 0;">
          <div className="label">검색</div>
          <input className="input" value={query} onInput={onQueryInput} placeholder="상품명/설명/태그 검색" />
        </div>
        <div className="formRow" style="margin-bottom: 0;">
          <div className="label">정렬</div>
          <select className="select" value={sort} onChange={onSortChange}>
            <option value="FEATURED">추천(기본)</option>
            <option value="NEW_DESC">최신 등록</option>
            <option value="RATING_DESC">평점 높은 순</option>
            <option value="PRICE_ASC">가격 낮은 순</option>
            <option value="PRICE_DESC">가격 높은 순</option>
          </select>
        </div>
      </div>

      <div className="split" style="grid-template-columns: 1fr 1fr;">
        <div className="formRow" style="margin-bottom: 0;">
          <div className="label">카테고리</div>
          <select className="select" value={category} onChange={onCategoryChange}>
            <option value="ALL">전체</option>
            {asArray(categories).map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="formRow" style="margin-bottom: 0;">
          <div className="label">필터</div>
          <label className="pill" style="display: inline-flex;">
            <input type="checkbox" checked={inStockOnly} onChange={onStockToggle} style="margin-right: 8px;" />
            재고 있는 상품만
          </label>
        </div>
      </div>
    </div>
  );
}

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
        <button className="btn btn--tab" type="button" data-product-id={product.id} onClick={onView}>
          상세
        </button>
        <button className="btn btn--primary" type="button" data-product-id={product.id} onClick={onAdd} disabled={product.stock <= 0}>
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

function ProductGrid({ items, onView, onAdd }) {
  return (
    <div className="grid grid--cards" style="margin-top: 14px;">
      {items.length === 0 ? (
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

export default function ShopPage() {
  let query = "";
  let category = "ALL";
  let inStockOnly = true;
  let sort = "FEATURED";

  const onQueryInput = (e) => {
    query = e.target.value;
  };
  const onCategoryChange = (e) => {
    category = e.target.value;
  };
  const onStockToggle = (e) => {
    inStockOnly = e.target.checked;
  };
  const onSortChange = (e) => {
    sort = e.target.value;
  };

  const onView = (e) => {
    const id = e.currentTarget.getAttribute("data-product-id");
    if (!id) return;
    actions.goProduct(id);
  };

  const onAdd = (e) => {
    const id = e.currentTarget.getAttribute("data-product-id");
    if (!id) return;
    actions.addToCart(id, 1);
  };

  const products = () => asArray(state.products);
  const activeCount = () => products().filter((p) => p?.active).length;
  const categories = () => computeCategories(products());
  const visibleProducts = () =>
    selectVisibleProducts(products(), {
      query,
      category,
      inStockOnly,
      sort,
    });

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">스토어</h2>
          <div className="panel__sub">실제 네트워크 없이 동작합니다. AEUI는 tick 기반(기본 1초)으로 렌더링합니다.</div>
        </div>
        <div className="pill">활성 상품 {activeCount()}개</div>
      </div>
      <div className="panel__body">
        <ShopFilters
          query={query}
          category={category}
          inStockOnly={inStockOnly}
          sort={sort}
          categories={categories()}
          onQueryInput={onQueryInput}
          onCategoryChange={onCategoryChange}
          onStockToggle={onStockToggle}
          onSortChange={onSortChange}
        />

        <ProductGrid items={visibleProducts()} onView={onView} onAdd={onAdd} />
      </div>
    </div>
  );
}
