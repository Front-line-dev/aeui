import { AEUI } from "aeui";
import { formatKRW } from "../../../lib/money.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDateTime(ts) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
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

function AdminOrdersRow({ order, selectedOrderId, onSelect }) {
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

function AdminOrdersTableView({ orders, selectedOrderId, onSelect }) {
  return (
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
        {orders.length === 0 ? (
          <tr>
            <td colSpan="4" className="help">
              표시할 주문이 없습니다.
            </td>
          </tr>
        ) : (
          orders.map((o) => <AdminOrdersRow order={o} selectedOrderId={selectedOrderId} onSelect={onSelect} />)
        )}
      </tbody>
    </table>
  );
}

function AdminOrdersTable({ orders, selectedOrderId, onSelect }) {
  return <AdminOrdersTableView orders={asArray(orders)} selectedOrderId={selectedOrderId} onSelect={onSelect} />;
}

function AdminOrderDetailView({ order, onStatusChange, onCancel }) {
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
            <span>총액</span>
            <span style="font-weight: 900;">{formatKRW(order.totals?.total || 0)}</span>
          </div>

          <div className="formRow" style="margin-bottom: 0;">
            <div className="label">상태 변경</div>
            <select
              className="select"
              value={order.status}
              data-order-id={order.id}
              onChange={onStatusChange}
              disabled={order.status === "CANCELED"}
            >
              <option value="PAID">결제 완료</option>
              <option value="SHIPPED">배송 중</option>
              <option value="DELIVERED">배송 완료</option>
            </select>
            <div className="help">상태 변경은 activity 로그로 기록됩니다.</div>
          </div>

          <button
            className="btn btn--danger"
            type="button"
            data-order-id={order.id}
            onClick={onCancel}
            disabled={order.status !== "PAID"}
          >
            주문 취소(재고 복구)
          </button>

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
        </div>
      )}
    </>
  );
}

function AdminOrderDetail({ orders, selectedOrderId, onStatusChange, onCancel }) {
  return (
    <AdminOrderDetailView
      order={asArray(orders).find((o) => o.id === selectedOrderId) || null}
      onStatusChange={onStatusChange}
      onCancel={onCancel}
    />
  );
}

function AdminOrdersFilter({ value, onChange }) {
  return (
    <div className="formRow">
      <div className="label">상태 필터</div>
      <select className="select" value={value} onChange={onChange}>
        <option value="ALL">전체</option>
        <option value="PAID">결제 완료</option>
        <option value="SHIPPED">배송 중</option>
        <option value="DELIVERED">배송 완료</option>
        <option value="CANCELED">취소</option>
      </select>
    </div>
  );
}

export default function AdminOrders({ orders, selectedOrderId, actions }) {
  let statusFilter = "ALL";

  const onFilter = (e) => (statusFilter = e.target.value);

  const onSelect = (e) => {
    const id = e.currentTarget.getAttribute("data-order-id");
    if (!id) return;
    actions.selectOrder(id);
  };

  const onStatusChange = (e) => {
    const id = e.currentTarget.getAttribute("data-order-id");
    if (!id) return;
    const next = e.target.value;
    actions.setOrderStatus(id, next);
  };

  const onCancel = (e) => {
    const id = e.currentTarget.getAttribute("data-order-id");
    if (!id) return;
    actions.openOrderCancel(id);
  };

  const getVisible = (list) =>
    list
      .filter((o) => (statusFilter === "ALL" ? true : o.status === statusFilter))
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">주문 관리</h2>
          <div className="panel__sub">상태 변경/취소 + 상세 확인</div>
        </div>
        <div className="pill">총 {asArray(orders).length}건</div>
      </div>
      <div className="panel__body">
        <div className="split">
          <div>
            <AdminOrdersFilter value={statusFilter} onChange={onFilter} />

            <AdminOrdersTable orders={getVisible(asArray(orders))} selectedOrderId={selectedOrderId} onSelect={onSelect} />
          </div>

          <div className="card" style="align-self: start;">
            <div className="card__kicker">선택 주문</div>
            <AdminOrderDetail
              orders={orders}
              selectedOrderId={selectedOrderId}
              onStatusChange={onStatusChange}
              onCancel={onCancel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
