import { state, actions } from "@/store.js";
import { asArray } from "@/models/query.js";

import ShopFilters from "@/components/shop/ShopFilters.jsx";
import ProductGrid from "@/components/shop/ProductGrid.jsx";

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
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

  const onAdd = (productId) => {
    if (!productId) return;
    actions.addToCart(productId, 1);
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
          <div className="panel__sub">실제 네트워크 없이 동작합니다. DOM 이벤트는 즉시 반영되고, 비동기 변경은 polling fallback이 감지합니다.</div>
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

        <ProductGrid items={visibleProducts()} onAdd={onAdd} />
      </div>
    </div>
  );
}
