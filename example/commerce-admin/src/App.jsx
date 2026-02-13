import { AEUI, watch, clean } from "aeui";

import { makeSeedState } from "./lib/seed.js";
import { makeId } from "./lib/id.js";
import {
  clearPersistedState,
  exportPersistedState,
  loadPersistedState,
  savePersistedState,
} from "./lib/storage.js";
import { calcCartTotals, clampInt, formatKRW, normalizeCoupon } from "./lib/money.js";

import ToastHost from "./ui/components/ToastHost.jsx";
import ShopPage from "./ui/pages/ShopPage.jsx";
import ProductPage from "./ui/pages/ProductPage.jsx";
import CartPage from "./ui/pages/CartPage.jsx";
import CheckoutPage from "./ui/pages/CheckoutPage.jsx";
import OrdersPage from "./ui/pages/OrdersPage.jsx";
import AdminDashboard from "./ui/pages/admin/AdminDashboard.jsx";
import AdminProducts from "./ui/pages/admin/AdminProducts.jsx";
import AdminOrders from "./ui/pages/admin/AdminOrders.jsx";
import ProductEditorModal from "./ui/modals/ProductEditorModal.jsx";
import ConfirmModal from "./ui/modals/ConfirmModal.jsx";

function formatShortTime(ts) {
  if (!ts) return "-";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(ts));
  } catch {
    return String(ts);
  }
}

export default function App() {
  const seed = makeSeedState();
  const persisted = loadPersistedState();

  let products = Array.isArray(persisted?.products) ? persisted.products : seed.products;
  let cart = persisted?.cart && typeof persisted.cart === "object" ? persisted.cart : seed.cart;
  let orders = Array.isArray(persisted?.orders) ? persisted.orders : seed.orders;
  let activity = Array.isArray(persisted?.activity) ? persisted.activity : seed.activity;

  if (!cart || typeof cart !== "object") cart = { items: [], couponCode: "" };
  if (!Array.isArray(cart.items)) cart.items = [];
  if (typeof cart.couponCode !== "string") cart.couponCode = "";

  let route = "shop";
  let selectedProductId = null;
  let selectedOrderId = orders[0]?.id || null;

  let modal = null;

  let toasts = [];
  const toastTimers = new Map();

  let lastSavedAt = 0;
  let lastSaveError = "";

  let clockNow = Date.now();
  const clockTimer = setInterval(() => {
    clockNow = Date.now();
  }, 1000);
  clean(() => clearInterval(clockTimer));

  clean(() => {
    for (const timerId of toastTimers.values()) clearTimeout(timerId);
    toastTimers.clear();
  });

  const pushActivity = (type, message) => {
    activity.push({ at: Date.now(), type, message });
    if (activity.length > 220) activity.splice(0, activity.length - 220);
  };

  const dismissToast = (toastId) => {
    const timerId = toastTimers.get(toastId);
    if (timerId) clearTimeout(timerId);
    toastTimers.delete(toastId);
    toasts = toasts.filter((t) => t.id !== toastId);
  };

  const pushToast = ({ title = "알림", message, tone = "info", ttlMs = 3600 }) => {
    const id = makeId("t");
    toasts = [...toasts, { id, title, message, tone }];
    const timerId = setTimeout(() => dismissToast(id), ttlMs);
    toastTimers.set(id, timerId);
  };

  const findProduct = (productId) => products.find((p) => p.id === productId) || null;
  const findOrder = (orderId) => orders.find((o) => o.id === orderId) || null;

  const getCartCount = () => (cart.items || []).reduce((acc, it) => acc + (it.qty || 0), 0);

  const closeModal = () => {
    modal = null;
  };

  const goShop = () => {
    modal = null;
    route = "shop";
    selectedProductId = null;
  };
  const goProduct = (productId) => {
    modal = null;
    selectedProductId = productId;
    route = "product";
  };
  const goCart = () => {
    modal = null;
    route = "cart";
  };
  const goCheckout = () => {
    modal = null;
    route = "checkout";
  };
  const goOrders = () => {
    modal = null;
    route = "orders";
  };
  const goAdminDashboard = () => {
    modal = null;
    route = "admin.dashboard";
  };
  const goAdminProducts = () => {
    modal = null;
    route = "admin.products";
  };
  const goAdminOrders = () => {
    modal = null;
    route = "admin.orders";
  };

  const syncAdminMode = () => {
    const admin = String(route).startsWith("admin.");
    if (document?.body?.classList) {
      document.body.classList.toggle("mode--admin", admin);
    }
  };
  syncAdminMode();
  watch(() => syncAdminMode(), [route]);

  const addToCart = (productId, qty) => {
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

    const item = cart.items.find((it) => it.productId === productId) || null;
    const current = item ? clampInt(item.qty, 0, 999) : 0;
    const next = Math.min(p.stock, current + nQty);

    if (next === current) {
      pushToast({
        tone: "danger",
        title: "재고 부족",
        message: `현재 재고(${p.stock})를 초과할 수 없습니다.`,
      });
      return;
    }

    if (item) item.qty = next;
    else cart.items.push({ productId, qty: next });

    pushActivity("CART", `장바구니 담기: ${p.name} × ${next - current}`);
    pushToast({ tone: "ok", title: "장바구니", message: `${p.name} 담김 (수량 ${next})` });
  };

  const adjustCartQty = (productId, delta) => {
    const item = cart.items.find((it) => it.productId === productId) || null;
    if (!item) return;

    const p = findProduct(productId);
    const max = p ? Math.max(0, p.stock) : 999;
    const next = clampInt((item.qty || 0) + delta, 0, max);

    if (next <= 0) {
      cart.items = cart.items.filter((it) => it.productId !== productId);
      pushActivity("CART", `장바구니 제거: ${productId}`);
      return;
    }

    item.qty = next;
  };

  const removeFromCart = (productId) => {
    cart.items = cart.items.filter((it) => it.productId !== productId);
    pushActivity("CART", `장바구니 제거: ${productId}`);
  };

  const setCoupon = (code) => {
    cart.couponCode = String(code || "");
    const normalized = normalizeCoupon(cart.couponCode);
    if (normalized && normalized !== "AEUI10") {
      pushToast({ tone: "danger", title: "쿠폰", message: "알 수 없는 쿠폰입니다. (데모 쿠폰: AEUI10)" });
    }
    if (normalized === "AEUI10") {
      pushToast({ tone: "ok", title: "쿠폰", message: "AEUI10 쿠폰이 적용되었습니다." });
    }
    pushActivity("CART", `쿠폰 변경: ${normalized || "-"}`);
  };

  const selectOrder = (orderId) => {
    selectedOrderId = orderId;
  };

  const completeCheckout = ({ customer, payment }) => {
    const items = cart.items || [];
    if (!items.length) {
      pushToast({ tone: "danger", title: "체크아웃", message: "장바구니가 비어있습니다." });
      route = "cart";
      return;
    }

    // Validate stock at commit time.
    for (const it of items) {
      const p = findProduct(it.productId);
      if (!p || !p.active) {
        pushToast({ tone: "danger", title: "체크아웃", message: "상품이 변경되어 결제를 완료할 수 없습니다." });
        route = "cart";
        return;
      }
      if (p.stock < it.qty) {
        pushToast({
          tone: "danger",
          title: "체크아웃",
          message: `재고가 부족합니다: ${p.name} (재고 ${p.stock})`,
        });
        route = "cart";
        return;
      }
    }

    const totals = calcCartTotals({ cart, products });
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

    orders = [order, ...orders];
    cart.items = [];
    cart.couponCode = "";

    pushActivity("ORDER", `주문 생성: ${orderId} (결제 ${payment?.paymentId || "n/a"})`);
    pushToast({ tone: "ok", title: "주문 완료", message: `주문이 생성되었습니다: ${orderId}` });

    route = "orders";
    selectedOrderId = orderId;
  };

  const openProductCreate = () => {
    modal = { type: "productEditor", mode: "create", productId: null, nonce: makeId("m") };
  };
  const openProductEdit = (productId) => {
    modal = { type: "productEditor", mode: "edit", productId, nonce: makeId("m") };
  };
  const openProductDelete = (productId) => {
    const p = findProduct(productId);
    modal = {
      type: "confirm",
      kind: "productDelete",
      tone: "danger",
      title: "상품 삭제",
      message: p ? `정말 삭제할까요?` : "정말 삭제할까요?",
      detail: p ? p.name : productId,
      confirmLabel: "삭제",
      productId,
    };
  };

  const toggleProductActive = (productId) => {
    const p = findProduct(productId);
    if (!p) return;
    p.active = !p.active;
    p.updatedAt = Date.now();
    pushActivity("PRODUCT", `상품 ${p.active ? "활성" : "비활성"}: ${p.name}`);
  };

  const saveProductFromEditor = ({ mode, productId, draft }) => {
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
      products = [p, ...products];
      pushActivity("PRODUCT", `상품 생성: ${p.name}`);
      pushToast({ tone: "ok", title: "상품", message: "새 상품이 생성되었습니다." });
      modal = null;
      return;
    }

    const p = findProduct(productId);
    if (!p) {
      pushToast({ tone: "danger", title: "상품", message: "상품을 찾을 수 없습니다." });
      modal = null;
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
    modal = null;
  };

  const setOrderStatus = (orderId, nextStatus) => {
    const o = findOrder(orderId);
    if (!o) return;
    if (o.status === "CANCELED") return;
    if (nextStatus === "CANCELED") {
      openOrderCancel(orderId);
      return;
    }

    const prev = o.status;
    o.status = nextStatus;
    pushActivity("ORDER", `상태 변경: ${orderId} (${prev} -> ${nextStatus})`);
    pushToast({ tone: "ok", title: "주문", message: `상태가 변경되었습니다: ${orderId}` });
  };

  const openOrderCancel = (orderId) => {
    const o = findOrder(orderId);
    modal = {
      type: "confirm",
      kind: "orderCancel",
      tone: "danger",
      title: "주문 취소",
      message: "정말 주문을 취소할까요?",
      detail: o ? `${o.id} · ${formatKRW(o.totals?.total || 0)}` : orderId,
      confirmLabel: "취소",
      orderId,
    };
  };

  const cancelOrder = (orderId) => {
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
  };

  const confirmModal = () => {
    if (!modal || modal.type !== "confirm") return;
    if (modal.kind === "productDelete") {
      const p = findProduct(modal.productId);
      products = products.filter((x) => x.id !== modal.productId);
      cart.items = cart.items.filter((it) => it.productId !== modal.productId);
      pushActivity("PRODUCT", `상품 삭제: ${p ? p.name : modal.productId}`);
      pushToast({ tone: "ok", title: "상품", message: "상품이 삭제되었습니다." });
      modal = null;
      return;
    }
    if (modal.kind === "orderCancel") {
      cancelOrder(modal.orderId);
      modal = null;
      return;
    }
  };

  const resetAll = () => {
    const ok = typeof confirm === "function" ? confirm("정말 초기화할까요? (localStorage 포함)") : true;
    if (!ok) return;
    clearPersistedState();
    for (const timerId of toastTimers.values()) clearTimeout(timerId);
    toastTimers.clear();
    const s = makeSeedState();
    products = s.products;
    cart = s.cart;
    orders = s.orders;
    activity = s.activity;
    route = "shop";
    selectedProductId = null;
    selectedOrderId = orders[0]?.id || null;
    modal = null;
    toasts = [];
    lastSavedAt = 0;
    lastSaveError = "";
    pushToast({ tone: "ok", title: "초기화", message: "데이터가 초기화되었습니다." });
  };

  const exportData = () => {
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
  };

  const actions = {
    // navigation
    goShop,
    goProduct,
    goCart,
    goCheckout,
    goOrders,
    goAdminDashboard,
    goAdminProducts,
    goAdminOrders,

    // cart
    addToCart,
    adjustCartQty,
    removeFromCart,
    setCoupon,

    // checkout/orders
    completeCheckout,
    selectOrder,

    // admin products
    openProductCreate,
    openProductEdit,
    openProductDelete,
    toggleProductActive,
    saveProductFromEditor,

    // admin orders
    setOrderStatus,
    openOrderCancel,

    // modal/toast
    closeModal,
    confirmModal,
    dismissToast,

    // misc
    resetAll,
    exportData,
  };

  watch(() => {
    try {
      savePersistedState({ products, cart, orders, activity });
      lastSavedAt = Date.now();
      lastSaveError = "";
    } catch (e) {
      lastSaveError = e?.message || "localStorage 저장에 실패했습니다.";
    }
  }, [products, cart, orders, activity]);

  const isAdmin = () => String(route).startsWith("admin.");
  const layoutClass = () => `layout ${isAdmin() ? "layout--admin" : ""}`;
  const sidebarStyle = () => (isAdmin() ? "" : "display:none;");

  const adminTab = () =>
    route === "admin.products" ? "products" : route === "admin.orders" ? "orders" : "dashboard";

  const productDetailVisible = () => {
    const productForDetail = route === "product" && selectedProductId ? findProduct(selectedProductId) : null;
    return productForDetail && productForDetail.active ? productForDetail : null;
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <div className="brand__mark" />
            <div>
              <div className="brand__title">AEUI Commerce + Admin</div>
              <div className="brand__sub">오프라인 쇼케이스 · tick 1초 · 현재 {formatShortTime(clockNow)}</div>
            </div>
          </div>

          <div className="nav">
            <button
              className={`btn btn--tab ${route === "shop" || route === "product" ? "is-active" : ""}`}
              type="button"
              onClick={goShop}
            >
              스토어
            </button>
            <button className={`btn btn--tab ${route === "cart" ? "is-active" : ""}`} type="button" onClick={goCart}>
              장바구니 <span className="pill">{getCartCount()}</span>
            </button>
            <button className={`btn btn--tab ${route === "orders" ? "is-active" : ""}`} type="button" onClick={goOrders}>
              주문
            </button>
            <button className={`btn btn--tab ${isAdmin() ? "is-active" : ""}`} type="button" onClick={goAdminDashboard}>
              Admin
            </button>

            <span className={`pill ${lastSaveError ? "pill--danger" : "pill--ok"}`}>
              저장 {lastSavedAt ? formatShortTime(lastSavedAt) : "-"}
            </span>
            <button className="btn btn--ghost" type="button" onClick={resetAll}>
              초기화
            </button>
          </div>
        </div>
      </div>

      <div className="main">
        <div className={layoutClass()}>
          <div className="sidebar" style={sidebarStyle()}>
            <div className="sidebar__title">Admin</div>
            <div className="sidebar__items">
              <button className={`btn btn--tab ${adminTab() === "dashboard" ? "is-active" : ""}`} type="button" onClick={goAdminDashboard}>
                대시보드
              </button>
              <button className={`btn btn--tab ${adminTab() === "products" ? "is-active" : ""}`} type="button" onClick={goAdminProducts}>
                상품
              </button>
              <button className={`btn btn--tab ${adminTab() === "orders" ? "is-active" : ""}`} type="button" onClick={goAdminOrders}>
                주문
              </button>
            </div>
          </div>

          <div className="grid">
            <div className="card" style={lastSaveError ? "" : "display:none;"}>
              <div style="font-weight: 900; letter-spacing: -0.02em;">저장 오류</div>
              <div className="help">{lastSaveError}</div>
            </div>

            {route === "shop" ? <ShopPage products={products} actions={actions} /> : null}
            {route === "product" ? <ProductPage product={productDetailVisible()} actions={actions} /> : null}
            {route === "cart" ? <CartPage cart={cart} products={products} actions={actions} /> : null}
            {route === "checkout" ? <CheckoutPage cart={cart} products={products} actions={actions} /> : null}
            {route === "orders" ? <OrdersPage orders={orders} selectedOrderId={selectedOrderId} actions={actions} /> : null}

            {route === "admin.dashboard" ? <AdminDashboard products={products} orders={orders} activity={activity} actions={actions} /> : null}
            {route === "admin.products" ? <AdminProducts products={products} actions={actions} /> : null}
            {route === "admin.orders" ? <AdminOrders orders={orders} selectedOrderId={selectedOrderId} actions={actions} /> : null}
          </div>
        </div>
      </div>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />

      {modal && modal.type === "productEditor" ? (
        <ProductEditorModal
          mode={modal.mode}
          product={modal.productId ? findProduct(modal.productId) : null}
          nonce={modal.nonce}
          onClose={closeModal}
          onSave={saveProductFromEditor}
        />
      ) : null}

      {modal && modal.type === "confirm" ? (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          detail={modal.detail}
          confirmLabel={modal.confirmLabel}
          tone={modal.tone}
          onConfirm={confirmModal}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}
