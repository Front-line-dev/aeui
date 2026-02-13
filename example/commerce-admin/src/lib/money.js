export function formatKRW(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `${new Intl.NumberFormat("ko-KR").format(safe)}원`;
}

export function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function normalizeCoupon(code) {
  if (!code) return "";
  return String(code).trim().toUpperCase();
}

export function calcCartTotals({ cart, products }) {
  const coupon = normalizeCoupon(cart?.couponCode);
  const items = Array.isArray(cart?.items) ? cart.items : [];

  const byId = new Map();
  (products || []).forEach((p) => byId.set(p.id, p));

  let subtotal = 0;
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) continue;
    subtotal += p.price * item.qty;
  }

  const discount = coupon === "AEUI10" ? Math.floor(subtotal * 0.10) : 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.floor(taxable * 0.10);
  const shipping = taxable === 0 ? 0 : taxable >= 20000 ? 0 : 3000;
  const total = taxable + tax + shipping;

  return { subtotal, discount, shipping, tax, total, coupon };
}

