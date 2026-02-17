import { AEUI } from "aeui";
import { state, actions } from "../../store.js";
import { formatKRW } from "../../lib/money.js";
import { formatDateTime } from "../../lib/util.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
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
    <tr onClick={() => onSelect(order?.id)} style={order?.id === selectedOrderId ? "background: rgba(0,0,0,0.03);" : ""}>
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

function OrderDetail() {
  return <OrderDetailView order={asArray(state.orders).find((o) => o.id === state.selectedOrderId) || null} />;
}

export default function OrdersPage() {
  const onSelect = (orderId) => {
    if (!orderId) return;
    actions.selectOrder(orderId);
  };

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">주문 내역</h2>
          <div className="panel__sub">
            주문 {asArray(state.orders).length}건 · 클릭해서 상세를 확인하세요
          </div>
        </div>
      </div>
      <div className="panel__body">
        <div className="split">
          <div>
            <OrdersTable orders={state.orders} selectedOrderId={state.selectedOrderId} onSelect={onSelect} />
          </div>

          <div className="card" style="align-self: start;">
            <div className="card__kicker">상세</div>
            <OrderDetail />
          </div>
        </div>
      </div>
    </div>
  );
}
