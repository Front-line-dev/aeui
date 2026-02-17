import { clampInt, normalizeCoupon } from "../lib/money.js";
import { asArray, findProduct } from "./query.js";
import { pushActivity, pushToast } from "./notify.js";

function ensureCart(state) {
  if (!state.cart || typeof state.cart !== "object") state.cart = { items: [], couponCode: "" };
  if (!Array.isArray(state.cart.items)) state.cart.items = asArray(state.cart.items);
  if (typeof state.cart.couponCode !== "string") state.cart.couponCode = String(state.cart.couponCode || "");
}

export function addToCart(state, productId, qty) {
  ensureCart(state);

  const p = findProduct(state, productId);
  const nQty = clampInt(qty, 1, 999);

  if (!p || !p.active) {
    pushToast(state, { tone: "danger", title: "담기 실패", message: "상품을 찾을 수 없거나 비활성화되었습니다." });
    return;
  }
  if (p.stock <= 0) {
    pushToast(state, { tone: "danger", title: "품절", message: "현재 재고가 없습니다." });
    return;
  }

  const items = asArray(state.cart.items);
  const item = items.find((it) => it?.productId === productId) || null;
  const current = item ? clampInt(item.qty, 0, 999) : 0;
  const next = Math.min(p.stock, current + nQty);

  if (next === current) {
    pushToast(state, { tone: "danger", title: "재고 부족", message: `현재 재고(${p.stock})를 초과할 수 없습니다.` });
    return;
  }

  if (item) item.qty = next;
  else state.cart.items.push({ productId, qty: next });

  pushActivity(state, "CART", `장바구니 담기: ${p.name} × ${next - current}`);
  pushToast(state, { tone: "ok", title: "장바구니", message: `${p.name} 담김 (수량 ${next})` });
}

export function adjustCartQty(state, productId, delta) {
  ensureCart(state);

  const items = asArray(state.cart.items);
  const item = items.find((it) => it?.productId === productId) || null;
  if (!item) return;

  const p = findProduct(state, productId);
  const max = p ? Math.max(0, p.stock) : 999;
  const next = clampInt((item.qty || 0) + delta, 0, max);

  if (next <= 0) {
    state.cart.items = items.filter((it) => it?.productId !== productId);
    pushActivity(state, "CART", `장바구니 제거: ${productId}`);
    return;
  }

  item.qty = next;
}

export function removeFromCart(state, productId) {
  ensureCart(state);
  state.cart.items = asArray(state.cart.items).filter((it) => it?.productId !== productId);
  pushActivity(state, "CART", `장바구니 제거: ${productId}`);
}

export function setCoupon(state, code) {
  ensureCart(state);

  state.cart.couponCode = String(code || "");
  const normalized = normalizeCoupon(state.cart.couponCode);

  if (normalized && normalized !== "AEUI10") {
    pushToast(state, { tone: "danger", title: "쿠폰", message: "알 수 없는 쿠폰입니다. (데모 쿠폰: AEUI10)" });
  }
  if (normalized === "AEUI10") {
    pushToast(state, { tone: "ok", title: "쿠폰", message: "AEUI10 쿠폰이 적용되었습니다." });
  }
  pushActivity(state, "CART", `쿠폰 변경: ${normalized || "-"}`);
}

