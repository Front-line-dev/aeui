import { AEUI, watch } from "aeui";
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

export default function ProductEditorModal({ mode, product, nonce, onClose, onSave }) {
  let lastNonce = nonce;

  let currentMode = mode;
  let currentProductId = product?.id || null;
  let currentOnSave = onSave;

  let name = product?.name || "";
  let category = product?.category || "굿즈";
  let price = product?.price ?? 1000;
  let stock = product?.stock ?? 0;
  let rating = product?.rating ?? 4.2;
  let active = product?.active ?? true;
  let description = product?.description || "";
  let tagsText = (product?.tags || []).join(", ");

  let error = "";

  const resetFromProduct = (p) => {
    name = p?.name || "";
    category = p?.category || "굿즈";
    price = p?.price ?? 1000;
    stock = p?.stock ?? 0;
    rating = p?.rating ?? 4.2;
    active = p?.active ?? true;
    description = p?.description || "";
    tagsText = (p?.tags || []).join(", ");
    error = "";
  };

  watch(() => {
    currentMode = mode;
    currentProductId = product?.id || null;
    currentOnSave = onSave;

    if (nonce !== lastNonce) {
      lastNonce = nonce;
      resetFromProduct(product);
    }
  }, [nonce, mode, product?.id, onSave]);

  const onSubmit = () => {
    const cleanName = String(name).trim();
    const cleanCategory = String(category).trim();
    const cleanDesc = String(description).trim();

    const nPrice = clampInt(price, 0, 100000000);
    const nStock = clampInt(stock, 0, 1000000);
    const nRating = Math.max(0, Math.min(5, Number(rating) || 0));
    const tags = parseTags(tagsText);

    if (!cleanName) {
      error = "상품명을 입력해주세요.";
      return;
    }
    if (!cleanCategory) {
      error = "카테고리를 입력해주세요.";
      return;
    }
    if (nPrice <= 0) {
      error = "가격은 1원 이상이어야 합니다.";
      return;
    }

    if (typeof currentOnSave === "function") {
      currentOnSave({
        mode: currentMode,
        productId: currentProductId,
        draft: {
          name: cleanName,
          category: cleanCategory,
          price: nPrice,
          stock: nStock,
          rating: nRating,
          active: !!active,
          description: cleanDesc,
          tags,
        },
      });
    }
  };

  return (
    <Modal
      title={mode === "edit" ? "상품 수정" : "새 상품"}
      onClose={onClose}
      footer={<ProductEditorFooter onClose={onClose} onSubmit={onSubmit} />}
      wide
    >
      <div className="split">
        <div>
          <div className="formRow">
            <div className="label">상품명</div>
            <input className="input" value={name} onInput={(e) => (name = e.target.value)} />
          </div>

          <div className="formRow">
            <div className="label">설명</div>
            <textarea
              className="textarea"
              value={description}
              onInput={(e) => (description = e.target.value)}
              placeholder="스토어 상세 페이지에 보여줄 설명을 적어주세요."
            />
          </div>

          <div className="formRow">
            <div className="label">태그</div>
            <input
              className="input"
              value={tagsText}
              onInput={(e) => (tagsText = e.target.value)}
              placeholder="new, hot, low-stock"
            />
          </div>
        </div>

        <div>
          <div className="formRow">
            <div className="label">카테고리</div>
            <input className="input" value={category} onInput={(e) => (category = e.target.value)} />
          </div>

          <div className="formRow">
            <div className="label">가격 (원)</div>
            <input
              className="input"
              type="number"
              min="0"
              value={price}
              onInput={(e) => (price = e.target.value)}
            />
          </div>

          <div className="formRow">
            <div className="label">재고</div>
            <input
              className="input"
              type="number"
              min="0"
              value={stock}
              onInput={(e) => (stock = e.target.value)}
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
              value={rating}
              onInput={(e) => (rating = e.target.value)}
            />
            <div className="help">단순 데모용 값입니다.</div>
          </div>

          <div className="formRow">
            <label className="pill" style="display: inline-flex;">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => (active = e.target.checked)}
                style="margin-right: 8px;"
              />
              스토어에 노출(활성)
            </label>
          </div>

          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>
    </Modal>
  );
}
