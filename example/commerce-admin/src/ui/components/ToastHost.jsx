import { AEUI } from "aeui";

export default function ToastHost({ toasts, onDismiss }) {
  const onClickToast = (e) => {
    const id = e.currentTarget.getAttribute("data-toast-id");
    if (!id) return;
    if (typeof onDismiss === "function") onDismiss(id);
  };

  return (
    <div className="toastHost" aria-live="polite" aria-relevant="additions removals">
      {(toasts || []).map((t) => (
        <div
          className={`toast ${t.tone === "ok" ? "toast--ok" : ""} ${
            t.tone === "danger" ? "toast--danger" : ""
          }`}
          data-toast-id={t.id}
          onClick={onClickToast}
        >
          <div className="toast__title">{t.title || "알림"}</div>
          <div className="toast__body">{t.message}</div>
        </div>
      ))}
    </div>
  );
}
