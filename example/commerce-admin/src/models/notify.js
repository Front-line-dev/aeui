import { makeId } from "../lib/id.js";
import { asArray } from "./query.js";

export function pushActivity(state, type, message) {
  if (!state) return;

  const list = asArray(state.activity);
  if (!Array.isArray(state.activity)) state.activity = list;

  state.activity.push({ at: Date.now(), type, message });
  if (state.activity.length > 220) state.activity.splice(0, state.activity.length - 220);
}

export function pushToast(state, { title = "알림", message, tone = "info", ttlMs = 3600 }) {
  if (!state) return;

  const id = makeId("t");
  const createdAt = Date.now();
  state.toasts = [...asArray(state.toasts), { id, title, message, tone, ttlMs, createdAt }];
}

export function dismissToast(state, toastId) {
  if (!state) return;
  state.toasts = asArray(state.toasts).filter((t) => t?.id !== toastId);
}

