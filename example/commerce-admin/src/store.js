import { makeSeedState } from "./lib/seed.js";
import { makeId } from "./lib/id.js";
import { clearPersistedState, exportPersistedState, loadPersistedState } from "./lib/storage.js";
import { calcCartTotals, clampInt, formatKRW, normalizeCoupon } from "./lib/money.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCart(value) {
  const cart = value && typeof value === "object" ? value : {};
  const items = Array.isArray(cart.items) ? cart.items : [];
  const couponCode = typeof cart.couponCode === "string" ? cart.couponCode : "";
  return { items, couponCode };
}

function loadInitialData() {
  const seed = makeSeedState();
  const persisted = loadPersistedState();

  const products = Array.isArray(persisted?.products) ? persisted.products : seed.products;
  const cart = normalizeCart(persisted?.cart || seed.cart);
  const orders = Array.isArray(persisted?.orders) ? persisted.orders : seed.orders;
  const activity = Array.isArray(persisted?.activity) ? persisted.activity : seed.activity;

  return { products, cart, orders, activity };
}

const initial = loadInitialData();

export const state = {
  products: initial.products,
  cart: initial.cart,
  orders: initial.orders,
  activity: initial.activity,

  route: "shop",
  selectedProductId: null,
  selectedOrderId: initial.orders[0]?.id || null,

  modal: null, // { type: "productEditor" | "confirm", ... }
  toasts: [],

  clockNow: Date.now(),
  lastSavedAt: 0,
  lastSaveError: "",
};

function pushActivity(type, message) {
  state.activity.push({ at: Date.now(), type, message });
  if (state.activity.length > 220) state.activity.splice(0, state.activity.length - 220);
}

function pushToast({ title = "알림", message, tone = "info", ttlMs = 3600 }) {
  const id = makeId("t");
  const createdAt = Date.now();
  state.toasts = [...state.toasts, { id, title, message, tone, ttlMs, createdAt }];
}

function findProduct(productId) {
  return state.products.find((p) => p?.id === productId) || null;
}

function findOrder(orderId) {
  return state.orders.find((o) => o?.id === orderId) || null;
}

function cancelOrder(orderId) {
  const o = findOrder(orderId);
  if (!o) return;
  if (o.status !== "PAID") {
    pushToast({ tone: "danger", title: "주문", message: "결제 완료 상태(PAID)에서만 취소할 수 있습니다." });
    return;
  }

  o.status = "CANCELED";

  for (const it of o.items || []) {
    const p = findProduct(it.productId);
    if (!p) continue;
    p.stock = Math.max(0, (p.stock || 0) + (it.qty || 0));
    p.updatedAt = Date.now();
  }

  pushActivity("ORDER", `주문 취소: ${orderId} (재고 복구)`);
  pushToast({ tone: "ok", title: "주문", message: "주문이 취소되었습니다." });
}

export const select = {
  isAdmin() {
    return String(state.route).startsWith("admin.");
  },
  cartCount() {
    return asArray(state.cart?.items).reduce((acc, it) => acc + (it?.qty || 0), 0);
  },
  product(productId) {
    return findProduct(productId);
  },
  order(orderId) {
    return findOrder(orderId);
  },
  currentProduct() {
    if (state.route !== "product" || !state.selectedProductId) return null;
    const p = findProduct(state.selectedProductId);
    if (!p || !p.active) return null;
    return p;
  },
};

export const actions = {
  // navigation
  goShop() {
    state.modal = null;
    state.route = "shop";
    state.selectedProductId = null;
  },
  goProduct(productId) {
    state.modal = null;
    state.selectedProductId = productId;
    state.route = "product";
  },
  goCart() {
    state.modal = null;
    state.route = "cart";
  },
  goCheckout() {
    state.modal = null;
    state.route = "checkout";
  },
  goOrders() {
    state.modal = null;
    state.route = "orders";
  },
  goAdminDashboard() {
    state.modal = null;
    state.route = "admin.dashboard";
  },
  goAdminProducts() {
    state.modal = null;
    state.route = "admin.products";
  },
  goAdminOrders() {
    state.modal = null;
    state.route = "admin.orders";
  },

  // cart
  addToCart(productId, qty) {
    const p = findProduct(productId);
    const nQty = clampInt(qty, 1, 999);

    if (!p || !p.active) {
      pushToast({ tone: "danger", title: "담기 실패", message: "상품을 찾을 수 없거나 비활성화되었습니다." });
      return;
    }
    if (p.stock <= 0) {
      pushToast({ tone: "danger", title: "품절", message: "현재 재고가 없습니다." });
      return;
    }

    const items = asArray(state.cart.items);
    const item = items.find((it) => it?.productId === productId) || null;
    const current = item ? clampInt(item.qty, 0, 999) : 0;
    const next = Math.min(p.stock, current + nQty);

    if (next === current) {
      pushToast({ tone: "danger", title: "재고 부족", message: `현재 재고(${p.stock})를 초과할 수 없습니다.` });
      return;
    }

    if (item) item.qty = next;
    else state.cart.items.push({ productId, qty: next });

    pushActivity("CART", `장바구니 담기: ${p.name} × ${next - current}`);
    pushToast({ tone: "ok", title: "장바구니", message: `${p.name} 담김 (수량 ${next})` });
  },

  adjustCartQty(productId, delta) {
    const items = asArray(state.cart.items);
    const item = items.find((it) => it?.productId === productId) || null;
    if (!item) return;

    const p = findProduct(productId);
    const max = p ? Math.max(0, p.stock) : 999;
    const next = clampInt((item.qty || 0) + delta, 0, max);

    if (next <= 0) {
      state.cart.items = items.filter((it) => it?.productId !== productId);
      pushActivity("CART", `장바구니 제거: ${productId}`);
      return;
    }

    item.qty = next;
  },

  removeFromCart(productId) {
    state.cart.items = asArray(state.cart.items).filter((it) => it?.productId !== productId);
    pushActivity("CART", `장바구니 제거: ${productId}`);
  },

  setCoupon(code) {
    state.cart.couponCode = String(code || "");
    const normalized = normalizeCoupon(state.cart.couponCode);
    if (normalized && normalized !== "AEUI10") {
      pushToast({ tone: "danger", title: "쿠폰", message: "알 수 없는 쿠폰입니다. (데모 쿠폰: AEUI10)" });
    }
    if (normalized === "AEUI10") {
      pushToast({ tone: "ok", title: "쿠폰", message: "AEUI10 쿠폰이 적용되었습니다." });
    }
    pushActivity("CART", `쿠폰 변경: ${normalized || "-"}`);
  },

  // checkout/orders
  selectOrder(orderId) {
    state.selectedOrderId = orderId;
  },

  completeCheckout({ customer, payment }) {
    const items = asArray(state.cart.items);
    if (!items.length) {
      pushToast({ tone: "danger", title: "체크아웃", message: "장바구니가 비어있습니다." });
      state.route = "cart";
      return;
    }

    // Validate stock at commit time.
    for (const it of items) {
      const p = findProduct(it.productId);
      if (!p || !p.active) {
        pushToast({ tone: "danger", title: "체크아웃", message: "상품이 변경되어 결제를 완료할 수 없습니다." });
        state.route = "cart";
        return;
      }
      if (p.stock < it.qty) {
        pushToast({ tone: "danger", title: "체크아웃", message: `재고가 부족합니다: ${p.name} (재고 ${p.stock})` });
        state.route = "cart";
        return;
      }
    }

    const totals = calcCartTotals({ cart: state.cart, products: state.products });
    const orderId = makeId("o");
    const order = {
      id: orderId,
      createdAt: Date.now(),
      status: "PAID",
      customer,
      items: items.map((it) => {
        const p = findProduct(it.productId);
        return {
          productId: it.productId,
          nameSnapshot: p ? p.name : "(unknown)",
          priceSnapshot: p ? p.price : 0,
          qty: it.qty,
        };
      }),
      totals: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping: totals.shipping,
        tax: totals.tax,
        total: totals.total,
      },
    };

    // Deduct stock
    for (const it of items) {
      const p = findProduct(it.productId);
      if (!p) continue;
      p.stock = Math.max(0, p.stock - it.qty);
      p.updatedAt = Date.now();
    }

    state.orders = [order, ...state.orders];
    state.cart.items = [];
    state.cart.couponCode = "";

    pushActivity("ORDER", `주문 생성: ${orderId} (결제 ${payment?.paymentId || "n/a"})`);
    pushToast({ tone: "ok", title: "주문 완료", message: `주문이 생성되었습니다: ${orderId}` });

    state.route = "orders";
    state.selectedOrderId = orderId;
  },

  // admin products
  openProductCreate() {
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
  },

  openProductEdit(productId) {
    const p = findProduct(productId);
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
  },

  openProductDelete(productId) {
    const p = findProduct(productId);
    state.modal = {
      type: "confirm",
      tone: "danger",
      title: "상품 삭제",
      message: "정말 삭제할까요?",
      detail: p ? p.name : productId,
      confirmLabel: "삭제",
      onConfirm: () => {
        const px = findProduct(productId);
        state.products = state.products.filter((x) => x?.id !== productId);
        state.cart.items = asArray(state.cart.items).filter((it) => it?.productId !== productId);
        pushActivity("PRODUCT", `상품 삭제: ${px ? px.name : productId}`);
        pushToast({ tone: "ok", title: "상품", message: "상품이 삭제되었습니다." });
        state.modal = null;
      },
    };
  },

  toggleProductActive(productId) {
    const p = findProduct(productId);
    if (!p) return;
    p.active = !p.active;
    p.updatedAt = Date.now();
    pushActivity("PRODUCT", `상품 ${p.active ? "활성" : "비활성"}: ${p.name}`);
  },

  saveProductFromEditor({ mode, productId, draft }) {
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
      state.products = [p, ...state.products];
      pushActivity("PRODUCT", `상품 생성: ${p.name}`);
      pushToast({ tone: "ok", title: "상품", message: "새 상품이 생성되었습니다." });
      state.modal = null;
      return;
    }

    const p = findProduct(productId);
    if (!p) {
      pushToast({ tone: "danger", title: "상품", message: "상품을 찾을 수 없습니다." });
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

    pushActivity("PRODUCT", `상품 수정: ${p.name}`);
    pushToast({ tone: "ok", title: "상품", message: "수정이 저장되었습니다." });
    state.modal = null;
  },

  // admin orders
  setOrderStatus(orderId, nextStatus) {
    const o = findOrder(orderId);
    if (!o) return;
    if (o.status === "CANCELED") return;
    if (nextStatus === "CANCELED") {
      actions.openOrderCancel(orderId);
      return;
    }

    const prev = o.status;
    o.status = nextStatus;
    pushActivity("ORDER", `상태 변경: ${orderId} (${prev} -> ${nextStatus})`);
    pushToast({ tone: "ok", title: "주문", message: `상태가 변경되었습니다: ${orderId}` });
  },

  openOrderCancel(orderId) {
    const o = findOrder(orderId);
    state.modal = {
      type: "confirm",
      kind: "orderCancel",
      tone: "danger",
      title: "주문 취소",
      message: "정말 주문을 취소할까요?",
      detail: o ? `${o.id} · ${formatKRW(o.totals?.total || 0)}` : orderId,
      confirmLabel: "취소",
      onConfirm: () => {
        cancelOrder(orderId);
        state.modal = null;
      },
    };
  },

  // modal/toast
  closeModal() {
    state.modal = null;
  },

  confirmModal() {
    const m = state.modal;
    if (m?.type !== "confirm") return;
    if (typeof m.onConfirm === "function") m.onConfirm();
  },

  dismissToast(toastId) {
    state.toasts = asArray(state.toasts).filter((t) => t?.id !== toastId);
  },

  // misc
  resetAll() {
    const ok = typeof confirm === "function" ? confirm("정말 초기화할까요? (localStorage 포함)") : true;
    if (!ok) return;

    clearPersistedState();
    const s = makeSeedState();
    state.products = s.products;
    state.cart = normalizeCart(s.cart);
    state.orders = s.orders;
    state.activity = s.activity;

    state.route = "shop";
    state.selectedProductId = null;
    state.selectedOrderId = state.orders[0]?.id || null;
    state.modal = null;
    state.toasts = [];

    state.lastSavedAt = 0;
    state.lastSaveError = "";

    pushToast({ tone: "ok", title: "초기화", message: "데이터가 초기화되었습니다." });
  },

  exportData() {
    try {
      const raw = exportPersistedState();
      if (!raw) {
        pushToast({ tone: "danger", title: "내보내기", message: "내보낼 데이터가 없습니다. 먼저 상태를 변경해 저장을 발생시켜주세요." });
        return;
      }
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard
          .writeText(raw)
          .then(() => pushToast({ tone: "ok", title: "내보내기", message: "클립보드에 복사되었습니다." }))
          .catch(() => pushToast({ tone: "danger", title: "내보내기", message: "클립보드 복사에 실패했습니다." }));
      } else {
        pushToast({ tone: "danger", title: "내보내기", message: "이 브라우저는 클립보드 API를 지원하지 않습니다." });
      }
    } catch (e) {
      pushToast({ tone: "danger", title: "내보내기", message: e?.message || "실패" });
    }
  },
};

