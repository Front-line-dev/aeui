import { state, actions } from "@/store.js";
import { formatKRW } from "@/lib/money.js";
import { asArray } from "@/models/query.js";

import ActivityFeed from "@/components/admin/ActivityFeed.jsx";
import StatCard from "@/components/admin/StatCard.jsx";

function sumRevenue(orders) {
  return asArray(orders)
    .filter((o) => o && o.status !== "CANCELED")
    .reduce((acc, o) => acc + Number(o?.totals?.total || 0), 0);
}

export default function AdminDashboard() {
  const onNewProduct = () => actions.openProductCreate();
  const onExport = () => actions.exportData();

  return () => {
    const ps = asArray(state.products);
    const productCount = ps.length;
    const activeCount = ps.filter((p) => p && p.active).length;
    const inactiveCount = productCount - activeCount;
    const outOfStockCount = ps.filter((p) => p && p.active && Number(p.stock || 0) <= 0).length;
    const lowStockCount = ps.filter((p) => p && p.active && Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 3).length;

    const os = asArray(state.orders);
    const orderCount = os.length;
    const paidCount = os.filter((o) => o && o.status === "PAID").length;
    const shippedCount = os.filter((o) => o && o.status === "SHIPPED").length;
    const deliveredCount = os.filter((o) => o && o.status === "DELIVERED").length;
    const canceledCount = os.filter((o) => o && o.status === "CANCELED").length;
    const revenue = sumRevenue(os);

    const recentActivity = asArray(state.activity)
      .filter(Boolean)
      .slice()
      .sort((a, b) => (b?.at || 0) - (a?.at || 0))
      .slice(0, 8);

    return (
      <div className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">대시보드</h2>
            <div className="panel__sub">요약 통계 + 최근 activity</div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <a className="btn" href="/">
              스토어 보기
            </a>
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
              <StatCard kicker="상품" value={String(productCount)} title="상품" hint={`활성 ${activeCount} · 비활성 ${inactiveCount}`} />
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
                    <a className="btn btn--primary" href="/admin/products">
                      상품 관리
                    </a>
                    <a className="btn btn--primary" href="/admin/orders">
                      주문 관리
                    </a>
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
  };
}
