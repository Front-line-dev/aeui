import { AEUI } from "aeui";
import { state, actions } from "../../../store.js";
import { formatKRW } from "../../../lib/money.js";

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function ProductsEmptyRow() {
  return (
    <tr>
      <td colSpan="6" className="help">
        표시할 상품이 없습니다.
      </td>
    </tr>
  );
}

function ProductRow({ product, onEdit, onDelete, onToggleActive }) {
  return (
    <tr>
      <td>
        <div style="font-weight: 900; letter-spacing: -0.01em;">{product?.name}</div>
        <div className="help">{(product?.tags || []).slice(0, 5).join(", ")}</div>
      </td>
      <td>{product?.category}</td>
      <td>{formatKRW(product?.price || 0)}</td>
      <td>
        <span className={`pill ${Number(product?.stock || 0) <= 3 ? "pill--danger" : "pill--ok"}`}>
          {Number(product?.stock || 0)}
        </span>
      </td>
      <td>
        <button
          className={`btn btn--tab ${product?.active ? "is-active" : ""}`}
          type="button"
          data-product-id={product?.id}
          onClick={onToggleActive}
        >
          {product?.active ? "활성" : "비활성"}
        </button>
      </td>
      <td>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button className="btn" type="button" data-product-id={product?.id} onClick={onEdit}>
            수정
          </button>
          <button className="btn btn--danger" type="button" data-product-id={product?.id} onClick={onDelete}>
            삭제
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProductsTableView({ products, onEdit, onDelete, onToggleActive }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>이름</th>
          <th>카테고리</th>
          <th>가격</th>
          <th>재고</th>
          <th>상태</th>
          <th>액션</th>
        </tr>
      </thead>
      <tbody>
        {products.length === 0 ? (
          <ProductsEmptyRow />
        ) : (
          products.map((p) => (
            <ProductRow product={p} onEdit={onEdit} onDelete={onDelete} onToggleActive={onToggleActive} />
          ))
        )}
      </tbody>
    </table>
  );
}

function ProductsTable({ products, onEdit, onDelete, onToggleActive }) {
  return (
    <ProductsTableView products={asArray(products)} onEdit={onEdit} onDelete={onDelete} onToggleActive={onToggleActive} />
  );
}

function ProductsFilters({
  query,
  category,
  showInactive,
  categories,
  onQueryInput,
  onCategoryChange,
  onShowInactive,
}) {
  return (
    <div className="split" style="grid-template-columns: 1fr 1fr;">
      <div className="formRow" style="margin-bottom: 0;">
        <div className="label">검색</div>
        <input className="input" value={query} onInput={onQueryInput} placeholder="상품명/설명/태그" />
      </div>
      <div className="grid" style="gap: 10px;">
        <div className="formRow" style="margin-bottom: 0;">
          <div className="label">카테고리</div>
          <select className="select" value={category} onChange={onCategoryChange}>
            <option value="ALL">전체</option>
            {asArray(categories).map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
        </div>
        <label className="pill" style="display: inline-flex;">
          <input type="checkbox" checked={showInactive} onChange={onShowInactive} style="margin-right: 8px;" />
          비활성도 표시
        </label>
      </div>
    </div>
  );
}

export default function AdminProducts() {
  let query = "";
  let category = "ALL";
  let showInactive = true;

  const onQueryInput = (e) => (query = e.target.value);
  const onCategoryChange = (e) => (category = e.target.value);
  const onShowInactive = (e) => (showInactive = e.target.checked);

  const onNew = () => actions.openProductCreate();

  const onEdit = (e) => {
    const id = e.currentTarget.getAttribute("data-product-id");
    if (!id) return;
    actions.openProductEdit(id);
  };

  const onDelete = (e) => {
    const id = e.currentTarget.getAttribute("data-product-id");
    if (!id) return;
    actions.openProductDelete(id);
  };

  const onToggleActive = (e) => {
    const id = e.currentTarget.getAttribute("data-product-id");
    if (!id) return;
    actions.toggleProductActive(id);
  };

  const getCategories = (list) =>
    Array.from(new Set(list.map((p) => p.category))).sort((a, b) => cmp(a, b));

  const getVisible = (list) =>
    list
      .filter((p) => (showInactive ? true : p.active))
      .filter((p) => (category === "ALL" ? true : p.category === category))
      .filter((p) => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          String(p.name).toLowerCase().includes(q) ||
          String(p.description || "").toLowerCase().includes(q) ||
          (p.tags || []).some((t) => String(t).toLowerCase().includes(q))
        );
      })
      .slice()
      .sort((a, b) => cmp(b.updatedAt, a.updatedAt));

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">상품 관리</h2>
          <div className="panel__sub">CRUD + 필터/검색 + 활성 토글 + 모달 편집</div>
        </div>
        <button className="btn btn--primary" type="button" onClick={onNew}>
          새 상품
        </button>
      </div>
      <div className="panel__body">
        <ProductsFilters
          query={query}
          category={category}
          showInactive={showInactive}
          categories={getCategories(asArray(state.products))}
          onQueryInput={onQueryInput}
          onCategoryChange={onCategoryChange}
          onShowInactive={onShowInactive}
        />

        <div style="margin-top: 14px;">
          <ProductsTable
            products={getVisible(asArray(state.products))}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
          />
        </div>
      </div>
    </div>
  );
}
