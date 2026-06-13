import { AEUI, watch, clean } from "aeui";

import { state, actions, select } from "./store.js";
import { savePersistedState } from "./lib/storage.js";
import { formatShortTime } from "./lib/util.js";

import ToastHost from "./ui/components/ToastHost.jsx";
import ProductEditorModal from "./ui/modals/ProductEditorModal.jsx";
import ConfirmModal from "./ui/modals/ConfirmModal.jsx";

function NavItem({ active, href, children, className = "" }) {
  return (
    <a
      className={`btn btn--tab ${active ? "is-active" : ""} ${className}`}
      href={href}
    >
      {children}
    </a>
  );
}

export default function App({ route, children }) {
  let lastPathname = route?.pathname || "/";

  const clockTimer = setInterval(() => {
    state.clockNow = Date.now();
  }, 1000);
  clean(() => clearInterval(clockTimer));

  const pathname = () => route?.pathname || "/";
  const syncPageShell = () => {
    if (pathname() !== lastPathname) {
      state.modal = null;
      lastPathname = pathname();
    }

    const admin = pathname().startsWith("/admin");
    if (document?.body?.classList) document.body.classList.toggle("mode--admin", admin);
  };
  syncPageShell();
  watch(syncPageShell, [pathname()]);

  watch(() => {
    try {
      savePersistedState({ products: state.products, cart: state.cart, orders: state.orders, activity: state.activity });
      state.lastSavedAt = Date.now();
      state.lastSaveError = "";
    } catch (e) {
      state.lastSaveError = e?.message || "localStorage 저장에 실패했습니다.";
    }
  }, [state.products, state.cart, state.orders, state.activity]);

  const isAdminPath = () => pathname().startsWith("/admin");
  const layoutClass = () => `layout ${isAdminPath() ? "layout--admin" : ""}`;
  const sidebarStyle = () => (isAdminPath() ? "" : "display:none;");
  const adminTab = () =>
    pathname() === "/admin/products" ? "products" : pathname() === "/admin/orders" ? "orders" : "dashboard";

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
            <NavItem active={pathname() === "/" || pathname().startsWith("/products/")} href="/">
              스토어
            </NavItem>
            <NavItem active={pathname() === "/cart"} href="/cart">
              장바구니 <span className="pill">{select.cartCount()}</span>
            </NavItem>
            <NavItem active={pathname() === "/orders"} href="/orders">
              주문
            </NavItem>
            <NavItem active={isAdminPath()} href="/admin">
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
              <NavItem active={adminTab() === "dashboard"} href="/admin">
                대시보드
              </NavItem>
              <NavItem active={adminTab() === "products"} href="/admin/products">
                상품
              </NavItem>
              <NavItem active={adminTab() === "orders"} href="/admin/orders">
                주문
              </NavItem>
            </div>
          </div>

          <div className="grid">
            <div className="card" style={state.lastSaveError ? "" : "display:none;"}>
              <div style="font-weight: 900; letter-spacing: -0.02em;">저장 오류</div>
              <div className="help">{state.lastSaveError}</div>
            </div>

            {children}
          </div>
        </div>
      </div>

      <ToastHost />

      {state.modal?.type === "productEditor" ? <ProductEditorModal /> : null}
      {state.modal?.type === "confirm" ? <ConfirmModal /> : null}
    </div>
  );
}
