import { AEUI } from "aeui";
import { formatDateTimeShort } from "../../../lib/util.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function ActivityRow({ event }) {
  return (
    <div className="pill" style="justify-content: space-between; gap: 12px;">
      <span style="font-weight: 900; letter-spacing: -0.01em;">{event?.message || "-"}</span>
      <span className="help">{formatDateTimeShort(event?.at)}</span>
    </div>
  );
}

export default function ActivityFeed({ items }) {
  const list = asArray(items);

  return (
    <div className="card" style="align-self: start;">
      <div className="card__kicker">최근 활동</div>
      <div style="font-weight: 900; letter-spacing: -0.01em; margin-bottom: 8px;">활동</div>
      {list.length === 0 ? (
        <div className="help">아직 활동이 없습니다.</div>
      ) : (
        <div className="grid" style="gap: 8px;">
          {list.map((e) => (
            <ActivityRow event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

