import { makeId } from "../lib/id.js";
import { calcCartTotals, formatKRW } from "../lib/money.js";
import { asArray, findOrder, findProduct } from "./query.js";
import { pushActivity, pushToast } from "./notify.js";

function cancelOrder(state, orderId) {
  const o = findOrder(state, orderId);
  if (!o) return;

  if (o.status !== "PAID") {
    pushToast(state, { tone: "danger", title: "주문", message: "결제 완료 상태(PAID)에서만 취소할 수 있습니다." });
    return;
  }

  o.status = "CANCELED";

  for (const it of o.items || []) {
    const p = findProduct(state, it.productId);
    if (!p) continue;
    p.stock = Math.max(0, (p.stock || 0) + (it.qty || 0));
    p.updatedAt = Date.now();
  }

  pushActivity(state, "ORDER", `주문 취소: ${orderId} (재고 복구)`);
  pushToast(state, { tone: "ok", title: "주문", message: "주문이 취소되었습니다." });
}

export function selectOrder(state, orderId) {
  state.selectedOrderId = orderId;
}

export function completeCheckout(state, { customer, payment }) {
  const items = asArray(state.cart?.items);
  if (!items.length) {
    pushToast(state, { tone: "danger", title: "체크아웃", message: "장바구니가 비어있습니다." });
    state.route = "cart";
    return;
  }

  // Validate stock at commit time.
  for (const it of items) {
    const p = findProduct(state, it.productId);
    if (!p || !p.active) {
      pushToast(state, { tone: "danger", title: "체크아웃", message: "상품이 변경되어 결제를 완료할 수 없습니다." });
      state.route = "cart";
      return;
    }
    if (p.stock < it.qty) {
      pushToast(state, { tone: "danger", title: "체크아웃", message: `재고가 부족합니다: ${p.name} (재고 ${p.stock})` });
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
      const p = findProduct(state, it.productId);
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
    const p = findProduct(state, it.productId);
    if (!p) continue;
    p.stock = Math.max(0, p.stock - it.qty);
    p.updatedAt = Date.now();
  }

  state.orders = [order, ...asArray(state.orders)];
  state.cart.items = [];
  state.cart.couponCode = "";

  pushActivity(state, "ORDER", `주문 생성: ${orderId} (결제 ${payment?.paymentId || "n/a"})`);
  pushToast(state, { tone: "ok", title: "주문 완료", message: `주문이 생성되었습니다: ${orderId}` });

  state.route = "orders";
  state.selectedOrderId = orderId;
}

export function setOrderStatus(state, orderId, nextStatus) {
  const o = findOrder(state, orderId);
  if (!o) return;
  if (o.status === "CANCELED") return;
  if (nextStatus === "CANCELED") {
    openOrderCancel(state, orderId);
    return;
  }

  const prev = o.status;
  o.status = nextStatus;
  pushActivity(state, "ORDER", `상태 변경: ${orderId} (${prev} -> ${nextStatus})`);
  pushToast(state, { tone: "ok", title: "주문", message: `상태가 변경되었습니다: ${orderId}` });
}

export function openOrderCancel(state, orderId) {
  const o = findOrder(state, orderId);
  state.modal = {
    type: "confirm",
    kind: "orderCancel",
    tone: "danger",
    title: "주문 취소",
    message: "정말 주문을 취소할까요?",
    detail: o ? `${o.id} · ${formatKRW(o.totals?.total || 0)}` : orderId,
    confirmLabel: "취소",
    onConfirm: () => {
      cancelOrder(state, orderId);
      state.modal = null;
    },
  };
}

