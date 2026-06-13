import { watch, clean } from "aeui";
import { state, actions } from "@/store.js";
import { asArray } from "@/models/query.js";

export default function ToastHost() {
  const timers = new Map();

  const syncTimers = () => {
    const list = asArray(state.toasts);

    const alive = new Set(list.map((t) => t?.id).filter(Boolean));

    // Clear removed timers first.
    for (const [id, timerId] of timers.entries()) {
      if (!alive.has(id)) {
        clearTimeout(timerId);
        timers.delete(id);
      }
    }

    // Add new timers.
    for (const t of list) {
      if (!t?.id) continue;
      if (timers.has(t.id)) continue;

      const ttlMs = Number(t.ttlMs || 0);
      if (ttlMs <= 0) continue;

      const createdAt = Number(t.createdAt || Date.now());
      const remainingMs = Math.max(0, createdAt + ttlMs - Date.now());
      const timerId = setTimeout(() => actions.dismissToast(t.id), remainingMs);
      timers.set(t.id, timerId);
    }
  };

  syncTimers();
  watch(syncTimers, [state.toasts]);
  clean(() => {
    for (const timerId of timers.values()) clearTimeout(timerId);
    timers.clear();
  });

  const handleToastClick = (toastId) => {
    if (!toastId) return;
    actions.dismissToast(toastId);
  };

  return (
    <div className="toastHost" aria-live="polite" aria-relevant="additions removals">
      {asArray(state.toasts).map((t) => (
        <div
          className={`toast ${t.tone === "ok" ? "toast--ok" : ""} ${t.tone === "danger" ? "toast--danger" : ""
            }`}
          onClick={() => handleToastClick(t.id)}
        >
          <div className="toast__title">{t.title || "알림"}</div>
          <div className="toast__body">{t.message}</div>
        </div>
      ))}
    </div>
  );
}
