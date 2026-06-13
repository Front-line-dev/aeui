import { makeId } from "@/lib/id.js";
import { asArray, findProduct } from "@/models/query.js";
import { pushActivity, pushToast } from "@/models/notify.js";

export function openProductCreate(state) {
  state.modal = {
    type: "productEditor",
    mode: "create",
    productId: null,
    draft: {
      name: "",
      category: "굿즈",
      price: 1000,
      stock: 0,
      rating: 4.2,
      active: true,
      description: "",
      tagsText: "",
    },
    error: "",
  };
}

export function openProductEdit(state, productId) {
  const p = findProduct(state, productId);
  state.modal = {
    type: "productEditor",
    mode: "edit",
    productId,
    draft: {
      name: p?.name || "",
      category: p?.category || "굿즈",
      price: p?.price ?? 1000,
      stock: p?.stock ?? 0,
      rating: p?.rating ?? 4.2,
      active: p?.active ?? true,
      description: p?.description || "",
      tagsText: asArray(p?.tags).join(", "),
    },
    error: "",
  };
}

export function openProductDelete(state, productId) {
  const p = findProduct(state, productId);
  state.modal = {
    type: "confirm",
    tone: "danger",
    title: "상품 삭제",
    message: "정말 삭제할까요?",
    detail: p ? p.name : productId,
    confirmLabel: "삭제",
    onConfirm: () => {
      const px = findProduct(state, productId);

      state.products = asArray(state.products).filter((x) => x?.id !== productId);
      if (state.cart && Array.isArray(state.cart.items)) {
        state.cart.items = asArray(state.cart.items).filter((it) => it?.productId !== productId);
      }

      pushActivity(state, "PRODUCT", `상품 삭제: ${px ? px.name : productId}`);
      pushToast(state, { tone: "ok", title: "상품", message: "상품이 삭제되었습니다." });
      state.modal = null;
    },
  };
}

export function toggleProductActive(state, productId) {
  const p = findProduct(state, productId);
  if (!p) return;
  p.active = !p.active;
  p.updatedAt = Date.now();
  pushActivity(state, "PRODUCT", `상품 ${p.active ? "활성" : "비활성"}: ${p.name}`);
}

export function saveProductFromEditor(state, { mode, productId, draft }) {
  if (mode === "create") {
    const t = Date.now();
    const p = {
      id: makeId("p"),
      name: draft.name,
      category: draft.category,
      price: draft.price,
      stock: draft.stock,
      rating: draft.rating,
      tags: draft.tags,
      active: draft.active,
      description: draft.description,
      createdAt: t,
      updatedAt: t,
    };
    state.products = [p, ...asArray(state.products)];
    pushActivity(state, "PRODUCT", `상품 생성: ${p.name}`);
    pushToast(state, { tone: "ok", title: "상품", message: "새 상품이 생성되었습니다." });
    state.modal = null;
    return;
  }

  const p = findProduct(state, productId);
  if (!p) {
    pushToast(state, { tone: "danger", title: "상품", message: "상품을 찾을 수 없습니다." });
    state.modal = null;
    return;
  }

  p.name = draft.name;
  p.category = draft.category;
  p.price = draft.price;
  p.stock = draft.stock;
  p.rating = draft.rating;
  p.tags = draft.tags;
  p.active = draft.active;
  p.description = draft.description;
  p.updatedAt = Date.now();

  pushActivity(state, "PRODUCT", `상품 수정: ${p.name}`);
  pushToast(state, { tone: "ok", title: "상품", message: "수정이 저장되었습니다." });
  state.modal = null;
}
