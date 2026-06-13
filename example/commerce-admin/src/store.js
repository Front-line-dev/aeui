import { makeSeedState } from "@/lib/seed.js";
import { clearPersistedState, exportPersistedState } from "@/lib/storage.js";

import { loadInitialData, normalizeCart } from "@/models/persistence.js";
import { asArray, findOrder, findProduct } from "@/models/query.js";
import { dismissToast, pushToast } from "@/models/notify.js";

import * as cartModel from "@/models/cart.js";
import * as ordersModel from "@/models/orders.js";
import * as productsModel from "@/models/products.js";

const initial = loadInitialData();

export const state = {
  products: initial.products,
  cart: initial.cart,
  orders: initial.orders,
  activity: initial.activity,

  selectedOrderId: initial.orders[0]?.id || null,

  modal: null, // { type: "productEditor" | "confirm", ... }
  toasts: [],

  clockNow: Date.now(),
  lastSavedAt: 0,
  lastSaveError: "",
};

export const select = {
  cartCount() {
    return asArray(state.cart?.items).reduce((acc, it) => acc + (it?.qty || 0), 0);
  },
  product(productId) {
    return findProduct(state, productId);
  },
  order(orderId) {
    return findOrder(state, orderId);
  },
};

export const actions = {
  // cart
  addToCart(productId, qty) {
    cartModel.addToCart(state, productId, qty);
  },

  adjustCartQty(productId, delta) {
    cartModel.adjustCartQty(state, productId, delta);
  },

  removeFromCart(productId) {
    cartModel.removeFromCart(state, productId);
  },

  setCoupon(code) {
    cartModel.setCoupon(state, code);
  },

  // checkout/orders
  selectOrder(orderId) {
    ordersModel.selectOrder(state, orderId);
  },

  completeCheckout({ customer, payment }) {
    ordersModel.completeCheckout(state, { customer, payment });
  },

  // admin products
  openProductCreate() {
    productsModel.openProductCreate(state);
  },

  openProductEdit(productId) {
    productsModel.openProductEdit(state, productId);
  },

  openProductDelete(productId) {
    productsModel.openProductDelete(state, productId);
  },

  toggleProductActive(productId) {
    productsModel.toggleProductActive(state, productId);
  },

  saveProductFromEditor({ mode, productId, draft }) {
    productsModel.saveProductFromEditor(state, { mode, productId, draft });
  },

  // admin orders
  setOrderStatus(orderId, nextStatus) {
    ordersModel.setOrderStatus(state, orderId, nextStatus);
  },

  openOrderCancel(orderId) {
    ordersModel.openOrderCancel(state, orderId);
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
    dismissToast(state, toastId);
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

    state.selectedOrderId = state.orders[0]?.id || null;
    state.modal = null;
    state.toasts = [];

    state.lastSavedAt = 0;
    state.lastSaveError = "";

    pushToast(state, { tone: "ok", title: "초기화", message: "데이터가 초기화되었습니다." });
  },

  exportData() {
    try {
      const raw = exportPersistedState();
      if (!raw) {
        pushToast(state, {
          tone: "danger",
          title: "내보내기",
          message: "내보낼 데이터가 없습니다. 먼저 상태를 변경해 저장을 발생시켜주세요.",
        });
        return;
      }
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard
          .writeText(raw)
          .then(() => pushToast(state, { tone: "ok", title: "내보내기", message: "클립보드에 복사되었습니다." }))
          .catch(() => pushToast(state, { tone: "danger", title: "내보내기", message: "클립보드 복사에 실패했습니다." }));
      } else {
        pushToast(state, { tone: "danger", title: "내보내기", message: "이 브라우저는 클립보드 API를 지원하지 않습니다." });
      }
    } catch (e) {
      pushToast(state, { tone: "danger", title: "내보내기", message: e?.message || "실패" });
    }
  },
};
