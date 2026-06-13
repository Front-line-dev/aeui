
export default function StatCard({ kicker, title, value, hint }) {
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
