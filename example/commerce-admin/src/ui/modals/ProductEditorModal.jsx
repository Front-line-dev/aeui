import { AEUI } from "aeui";
import { state, actions } from "../../store.js";
import Modal from "../components/Modal.jsx";
import { clampInt } from "../../lib/money.js";

function parseTags(text) {
  return String(text || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function ProductEditorFooter({ onClose, onSubmit }) {
  return (
    <div style="display: flex; gap: 8px; justify-content: space-between; width: 100%;">
      <div className="help">태그는 쉼표로 구분합니다. 예: new, hot, low-stock</div>
      <div style="display: flex; gap: 8px;">
        <button className="btn btn--ghost" type="button" onClick={onClose}>
          취소
        </button>
        <button className="btn btn--primary" type="button" onClick={onSubmit}>
          저장
        </button>
      </div>
    </div>
  );
}

export default function ProductEditorModal() {
  if (state.modal?.type !== "productEditor") return null;

  const handleClose = () => actions.closeModal();

  const handleNameInput = (e) => (state.modal.draft.name = e.target.value);
  const handleDescInput = (e) => (state.modal.draft.description = e.target.value);
  const handleTagsInput = (e) => (state.modal.draft.tagsText = e.target.value);
  const handleCategoryInput = (e) => (state.modal.draft.category = e.target.value);
  const handlePriceInput = (e) => (state.modal.draft.price = e.target.value);
  const handleStockInput = (e) => (state.modal.draft.stock = e.target.value);
  const handleRatingInput = (e) => (state.modal.draft.rating = e.target.value);
  const handleActiveChange = (e) => (state.modal.draft.active = e.target.checked);

  const handleSubmit = () => {
    if (state.modal?.type !== "productEditor") return;

    const m = state.modal;
    const d = m.draft || {};

    const cleanName = String(d.name || "").trim();
    const cleanCategory = String(d.category || "").trim();
    const cleanDesc = String(d.description || "").trim();

    const nPrice = clampInt(d.price, 0, 100000000);
    const nStock = clampInt(d.stock, 0, 1000000);
    const nRating = Math.max(0, Math.min(5, Number(d.rating) || 0));
    const tags = parseTags(d.tagsText);

    if (!cleanName) return (m.error = "상품명을 입력해주세요.");
    if (!cleanCategory) return (m.error = "카테고리를 입력해주세요.");
    if (nPrice <= 0) return (m.error = "가격은 1원 이상이어야 합니다.");

    m.error = "";
    actions.saveProductFromEditor({
      mode: m.mode,
      productId: m.productId,
      draft: {
        name: cleanName,
        category: cleanCategory,
        price: nPrice,
        stock: nStock,
        rating: nRating,
        active: !!d.active,
        description: cleanDesc,
        tags,
      },
    });
  };

  return (
    <Modal
      title={state.modal.mode === "edit" ? "상품 수정" : "새 상품"}
      onClose={handleClose}
      footer={<ProductEditorFooter onClose={handleClose} onSubmit={handleSubmit} />}
      wide
    >
      <div className="split">
        <div>
          <div className="formRow">
            <div className="label">상품명</div>
            <input className="input" value={state.modal.draft.name} onInput={handleNameInput} />
          </div>

          <div className="formRow">
            <div className="label">설명</div>
            <textarea
              className="textarea"
              value={state.modal.draft.description}
              onInput={handleDescInput}
              placeholder="스토어 상세 페이지에 보여줄 설명을 적어주세요."
            />
          </div>

          <div className="formRow">
            <div className="label">태그</div>
            <input
              className="input"
              value={state.modal.draft.tagsText}
              onInput={handleTagsInput}
              placeholder="new, hot, low-stock"
            />
          </div>
        </div>

        <div>
          <div className="formRow">
            <div className="label">카테고리</div>
            <input className="input" value={state.modal.draft.category} onInput={handleCategoryInput} />
          </div>

          <div className="formRow">
            <div className="label">가격 (원)</div>
            <input
              className="input"
              type="number"
              min="0"
              value={state.modal.draft.price}
              onInput={handlePriceInput}
            />
          </div>

          <div className="formRow">
            <div className="label">재고</div>
            <input
              className="input"
              type="number"
              min="0"
              value={state.modal.draft.stock}
              onInput={handleStockInput}
            />
          </div>

          <div className="formRow">
            <div className="label">평점 (0~5)</div>
            <input
              className="input"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={state.modal.draft.rating}
              onInput={handleRatingInput}
            />
            <div className="help">단순 데모용 값입니다.</div>
          </div>

          <div className="formRow">
            <label className="pill" style="display: inline-flex;">
              <input
                type="checkbox"
                checked={state.modal.draft.active}
                onChange={handleActiveChange}
                style="margin-right: 8px;"
              />
              스토어에 노출(활성)
            </label>
          </div>

          {state.modal.error ? <div className="error">{state.modal.error}</div> : null}
        </div>
      </div>
    </Modal>
  );
}
