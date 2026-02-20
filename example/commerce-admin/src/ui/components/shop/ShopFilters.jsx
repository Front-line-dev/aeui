import { AEUI } from "aeui";

export default function ShopFilters({
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
            {Array.isArray(categories) ? categories.map((c) => (
              <option value={c}>{c}</option>
            )) : null}
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

