import { AEUI } from "aeui";
import { formatKRW } from "../../lib/money.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDateTime(ts) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return String(ts);
  }
}

function statusLabel(status) {
  if (status === "PAID") return "결제 완료";
  if (status === "SHIPPED") return "배송 중";
  if (status === "DELIVERED") return "배송 완료";
  if (status === "CANCELED") return "취소";
  return status || "-";
}

function OrdersEmptyState() {
  return (
    <div className="card">
      <div style="font-weight: 900; letter-spacing: -0.02em;">주문이 없습니다.</div>
      <div className="help">체크아웃을 완료하면 주문이 생성됩니다.</div>
    </div>
  );
}

function OrdersTableRow({ order, selectedOrderId, onSelect }) {
  return (
    <tr
      data-order-id={order?.id}
      onClick={onSelect}
      style={order?.id === selectedOrderId ? "background: rgba(0,0,0,0.03);" : ""}
    >
      <td style="font-weight: 900; cursor: pointer;">{String(order?.id || "").slice(0, 12)}…</td>
      <td>
        <span className={`pill ${order?.status === "CANCELED" ? "pill--danger" : "pill--ok"}`}>
          {statusLabel(order?.status)}
        </span>
      </td>
      <td>{formatKRW(order?.totals?.total || 0)}</td>
      <td className="help">{formatDateTime(order?.createdAt)}</td>
    </tr>
  );
}

function OrdersTableView({ orders, selectedOrderId, onSelect }) {
  return (
    <>
      {orders.length === 0 ? (
        <OrdersEmptyState />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>주문</th>
              <th>상태</th>
              <th>총액</th>
              <th>일시</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <OrdersTableRow order={o} selectedOrderId={selectedOrderId} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function OrdersTable({ orders, selectedOrderId, onSelect }) {
  return <OrdersTableView orders={asArray(orders)} selectedOrderId={selectedOrderId} onSelect={onSelect} />;
}

function OrderDetailView({ order }) {
  return (
    <>
      {!order ? (
        <div className="help">왼쪽에서 주문을 선택하세요.</div>
      ) : (
        <div className="grid" style="gap: 10px;">
          <div className="pill" style="justify-content: space-between;">
            <span>주문 ID</span>
            <span style="font-weight: 900;">{order.id}</span>
          </div>
          <div className="pill" style="justify-content: space-between;">
            <span>상태</span>
            <span style="font-weight: 900;">{statusLabel(order.status)}</span>
          </div>
          <div className="pill" style="justify-content: space-between;">
            <span>일시</span>
            <span style="font-weight: 900;">{formatDateTime(order.createdAt)}</span>
          </div>
          <div className="pill" style="justify-content: space-between;">
            <span>총액</span>
            <span style="font-weight: 900;">{formatKRW(order.totals?.total || 0)}</span>
          </div>

          <div style="font-weight: 900; letter-spacing: -0.01em; margin-top: 4px;">품목</div>
          <div className="grid" style="gap: 6px;">
            {(order.items || []).map((it) => (
              <div className="pill" style="justify-content: space-between;">
                <span>{it.nameSnapshot}</span>
                <span style="font-weight: 900;">
                  {it.qty} × {formatKRW(it.priceSnapshot)}
                </span>
              </div>
            ))}
          </div>

          <div style="font-weight: 900; letter-spacing: -0.01em; margin-top: 4px;">수령인</div>
          <div className="help" style="line-height: 1.6;">
            {order.customer?.name} · {order.customer?.email}
            <br />
            {order.customer?.address1} {order.customer?.address2}
            <br />
            {order.customer?.zip}
          </div>
        </div>
      )}
    </>
  );
}

function OrderDetail({ orders, selectedOrderId }) {
  return <OrderDetailView order={asArray(orders).find((o) => o.id === selectedOrderId) || null} />;
}

export default function OrdersPage({ orders, selectedOrderId, actions }) {
  const onSelect = (e) => {
    const id = e.currentTarget.getAttribute("data-order-id");
    if (!id) return;
    actions.selectOrder(id);
  };

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">주문 내역</h2>
          <div className="panel__sub">
            주문 {(Array.isArray(orders) ? orders : []).length}건 · 클릭해서 상세를 확인하세요
          </div>
        </div>
      </div>
      <div className="panel__body">
        <div className="split">
          <div>
            <OrdersTable orders={orders} selectedOrderId={selectedOrderId} onSelect={onSelect} />
          </div>

          <div className="card" style="align-self: start;">
            <div className="card__kicker">상세</div>
            <OrderDetail orders={orders} selectedOrderId={selectedOrderId} />
          </div>
        </div>
      </div>
    </div>
  );
}
