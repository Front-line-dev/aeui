import { formatKRW } from "@/lib/money.js";

function CartEmptyState() {
  return (
    <div className="card">
      <div style="font-weight: 900; letter-spacing: -0.02em;">장바구니가 비어있습니다.</div>
      <div className="help">스토어에서 상품을 담아보세요.</div>
      <div style="margin-top: 10px;">
        <a className="btn btn--primary" href="/">
          스토어로 이동
        </a>
      </div>
    </div>
  );
}

function CartLineRow({
  productId,
  name,
  price,
  stock,
  qty,
  productFound,
  lineTotal,
  disableInc,
  disableDec,
  onInc,
  onDec,
  onRemove,
}) {
  return (
    <tr>
      <td>
        <div style="font-weight: 900; letter-spacing: -0.01em;">{name}</div>
        <div className="help">{!productFound ? "상품을 찾을 수 없습니다." : stock > 0 ? `재고 ${stock}` : "현재 품절"}</div>
      </td>
      <td>{formatKRW(price)}</td>
      <td>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button className="btn" type="button" onClick={() => onDec(productId)} disabled={disableDec}>
            -
          </button>
          <span style="font-weight: 900; min-width: 24px; text-align: center;">{qty}</span>
          <button className="btn" type="button" onClick={() => onInc(productId)} disabled={disableInc}>
            +
          </button>
        </div>
      </td>
      <td>{formatKRW(lineTotal)}</td>
      <td style="text-align: right;">
        <button className="btn btn--danger" type="button" onClick={() => onRemove(productId)}>
          삭제
        </button>
      </td>
    </tr>
  );
}

export default function CartTable({ rows, onInc, onDec, onRemove }) {
  return (
    <>
      {Array.isArray(rows) && rows.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>상품</th>
              <th>가격</th>
              <th>수량</th>
              <th>합계</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(rows) ? rows.map((r) => (
              <CartLineRow
                productId={r.productId}
                name={r.name}
                price={r.price}
                stock={r.stock}
                qty={r.qty}
                productFound={r.productFound}
                lineTotal={r.lineTotal}
                disableInc={r.disableInc}
                disableDec={r.disableDec}
                onInc={onInc}
                onDec={onDec}
                onRemove={onRemove}
              />
            )) : null}
          </tbody>
        </table>
      ) : (
        <CartEmptyState />
      )}
    </>
  );
}
