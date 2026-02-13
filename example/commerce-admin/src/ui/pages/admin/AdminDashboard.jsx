import { AEUI, watch } from "aeui";
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
    return String(ts || "");
  }
}

function sumRevenue(orders) {
  return asArray(orders)
    .filter((o) => o && o.status !== "CANCELED")
    .reduce((acc, o) => acc + Number(o?.totals?.total || 0), 0);
}

function StatCard({ kicker, title, value, hint }) {
  return (
    <div className="card">
      <div className="card__kicker">{kicker}</div>
      <div className="card__title" style="font-size: 22px;">
        {value}
      </div>
      <div style="font-weight: 900; letter-spacing: -0.01em;">{title}</div>
      {hint ? <div className="help" style="margin-top: 6px;">{hint}</div> : null}
    </div>
  );
}

function ActivityRow({ event }) {
  return (
    <div className="pill" style="justify-content: space-between; gap: 12px;">
      <span style="font-weight: 900; letter-spacing: -0.01em;">{event?.message || "-"}</span>
      <span className="help">{formatDateTime(event?.at)}</span>
    </div>
  );
}

function ActivityFeed({ items }) {
  return (
    <div className="card" style="align-self: start;">
      <div className="card__kicker">최근 활동</div>
      <div style="font-weight: 900; letter-spacing: -0.01em; margin-bottom: 8px;">활동</div>
      {asArray(items).length === 0 ? (
        <div className="help">아직 활동이 없습니다.</div>
      ) : (
        <div className="grid" style="gap: 8px;">
          {asArray(items).map((e) => (
            <ActivityRow event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard({ products, orders, activity, actions }) {
  let productCount = 0;
  let activeCount = 0;
  let inactiveCount = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;

  let orderCount = 0;
  let paidCount = 0;
  let shippedCount = 0;
  let deliveredCount = 0;
  let canceledCount = 0;
  let revenue = 0;

  let recentActivity = [];

  const recompute = (nextProducts, nextOrders, nextActivity) => {
    const ps = asArray(nextProducts);
    productCount = ps.length;
    activeCount = ps.filter((p) => p && p.active).length;
    inactiveCount = productCount - activeCount;
    outOfStockCount = ps.filter((p) => p && p.active && Number(p.stock || 0) <= 0).length;
    lowStockCount = ps.filter((p) => p && p.active && Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 3).length;

    const os = asArray(nextOrders);
    orderCount = os.length;
    paidCount = os.filter((o) => o && o.status === "PAID").length;
    shippedCount = os.filter((o) => o && o.status === "SHIPPED").length;
    deliveredCount = os.filter((o) => o && o.status === "DELIVERED").length;
    canceledCount = os.filter((o) => o && o.status === "CANCELED").length;
    revenue = sumRevenue(os);

    recentActivity = asArray(nextActivity)
      .filter(Boolean)
      .slice()
      .sort((a, b) => (b?.at || 0) - (a?.at || 0))
      .slice(0, 8);
  };

  recompute(products, orders, activity);
  watch(() => {
    recompute(products, orders, activity);
  }, [products, orders, activity]);

  const onNewProduct = () => actions.openProductCreate();
  const onGoProducts = () => actions.goAdminProducts();
  const onGoOrders = () => actions.goAdminOrders();
  const onExport = () => actions.exportData();
  const onGoShop = () => actions.goShop();

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">대시보드</h2>
          <div className="panel__sub">요약 통계 + 최근 activity</div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
          <button className="btn" type="button" onClick={onGoShop}>
            스토어 보기
          </button>
          <button className="btn" type="button" onClick={onExport}>
            데이터 내보내기
          </button>
          <button className="btn btn--primary" type="button" onClick={onNewProduct}>
            새 상품
          </button>
        </div>
      </div>

      <div className="panel__body">
        <div className="grid" style="grid-template-columns: repeat(12, 1fr); gap: 12px;">
          <div style="grid-column: span 6;">
            <StatCard
              kicker="상품"
              value={String(productCount)}
              title="상품"
              hint={`활성 ${activeCount} · 비활성 ${inactiveCount}`}
            />
          </div>
          <div style="grid-column: span 6;">
            <StatCard
              kicker="재고"
              value={`${outOfStockCount}/${lowStockCount}`}
              title="품절/저재고(활성)"
              hint="품절/저재고는 재고를 기준으로 계산합니다."
            />
          </div>
          <div style="grid-column: span 6;">
            <StatCard
              kicker="주문"
              value={String(orderCount)}
              title="주문"
              hint={`PAID ${paidCount} · SHIPPED ${shippedCount} · DELIVERED ${deliveredCount} · CANCELED ${canceledCount}`}
            />
          </div>
          <div style="grid-column: span 6;">
            <StatCard kicker="매출" value={formatKRW(revenue)} title="매출(스냅샷 합)" hint="취소 주문은 제외합니다." />
          </div>

          <div style="grid-column: span 12;">
            <div className="split">
              <div className="card" style="align-self: start;">
                <div className="card__kicker">빠른 이동</div>
                <div style="font-weight: 900; letter-spacing: -0.01em; margin-bottom: 8px;">Admin</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button className="btn btn--primary" type="button" onClick={onGoProducts}>
                    상품 관리
                  </button>
                  <button className="btn btn--primary" type="button" onClick={onGoOrders}>
                    주문 관리
                  </button>
                </div>
                <div className="help" style="margin-top: 10px;">
                  상품/주문 데이터는 localStorage에 저장됩니다.
                </div>
              </div>

              <ActivityFeed items={recentActivity} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
