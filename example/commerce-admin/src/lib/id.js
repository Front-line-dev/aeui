export function makeId(prefix = "id") {
  // Prefer crypto.randomUUID when available (modern browsers).
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  const rnd = Math.random().toString(16).slice(2);
  const ts = Date.now().toString(16);
  return `${prefix}_${ts}_${rnd}`;
}

