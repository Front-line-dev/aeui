import { AEUI, watch, clean } from "aeui";

import { state, actions, select } from "./store.js";
import { savePersistedState } from "./lib/storage.js";
import { formatShortTime } from "./lib/util.js";

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

function NavItem({ active, onClick, children, className = "" }) {
  return (
    <button
      className={`btn btn--tab ${active ? "is-active" : ""} ${className}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function App() {
  const clockTimer = setInterval(() => {
    state.clockNow = Date.now();
  }, 1000);
  clean(() => clearInterval(clockTimer));

  const syncAdminMode = () => {
    const admin = select.isAdmin();
    if (document?.body?.classList) document.body.classList.toggle("mode--admin", admin);
  };
  syncAdminMode();
  watch(syncAdminMode, [state.route]);

  watch(() => {
    try {
      savePersistedState({ products: state.products, cart: state.cart, orders: state.orders, activity: state.activity });
      state.lastSavedAt = Date.now();
      state.lastSaveError = "";
    } catch (e) {
      state.lastSaveError = e?.message || "localStorage 저장에 실패했습니다.";
    }
  }, [state.products, state.cart, state.orders, state.activity]);

  const layoutClass = () => `layout ${select.isAdmin() ? "layout--admin" : ""}`;
  const sidebarStyle = () => (select.isAdmin() ? "" : "display:none;");
  const adminTab = () =>
    state.route === "admin.products" ? "products" : state.route === "admin.orders" ? "orders" : "dashboard";

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <div className="brand__mark" />
            <div>
              <div className="brand__title">AEUI Commerce + Admin</div>
              <div className="brand__sub">오프라인 쇼케이스 · DOM 이벤트 즉시 반영 · 현재 {formatShortTime(state.clockNow)}</div>
            </div>
          </div>

          <div className="nav">
            <NavItem active={state.route === "shop" || state.route === "product"} onClick={() => actions.goShop()}>
              스토어
            </NavItem>
            <NavItem active={state.route === "cart"} onClick={() => actions.goCart()}>
              장바구니 <span className="pill">{select.cartCount()}</span>
            </NavItem>
            <NavItem active={state.route === "orders"} onClick={() => actions.goOrders()}>
              주문
            </NavItem>
            <NavItem active={select.isAdmin()} onClick={() => actions.goAdminDashboard()}>
              Admin
            </NavItem>

            <span className={`pill ${state.lastSaveError ? "pill--danger" : "pill--ok"}`}>
              저장 {state.lastSavedAt ? formatShortTime(state.lastSavedAt) : "-"}
            </span>
            <button className="btn btn--ghost" type="button" onClick={() => actions.resetAll()}>
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
              <NavItem active={adminTab() === "dashboard"} onClick={() => actions.goAdminDashboard()}>
                대시보드
              </NavItem>
              <NavItem active={adminTab() === "products"} onClick={() => actions.goAdminProducts()}>
                상품
              </NavItem>
              <NavItem active={adminTab() === "orders"} onClick={() => actions.goAdminOrders()}>
                주문
              </NavItem>
            </div>
          </div>

          <div className="grid">
            <div className="card" style={state.lastSaveError ? "" : "display:none;"}>
              <div style="font-weight: 900; letter-spacing: -0.02em;">저장 오류</div>
              <div className="help">{state.lastSaveError}</div>
            </div>

            {state.route === "shop" ? <ShopPage /> : null}
            {state.route === "product" ? <ProductPage /> : null}
            {state.route === "cart" ? <CartPage /> : null}
            {state.route === "checkout" ? <CheckoutPage /> : null}
            {state.route === "orders" ? <OrdersPage /> : null}

            {state.route === "admin.dashboard" ? <AdminDashboard /> : null}
            {state.route === "admin.products" ? <AdminProducts /> : null}
            {state.route === "admin.orders" ? <AdminOrders /> : null}
          </div>
        </div>
      </div>

      <ToastHost />

      {state.modal?.type === "productEditor" ? <ProductEditorModal /> : null}
      {state.modal?.type === "confirm" ? <ConfirmModal /> : null}
    </div>
  );
}
