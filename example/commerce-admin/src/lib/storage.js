const STORAGE_KEY = "aeui-commerce-admin:v1";
const STORAGE_VERSION = 1;

export function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== STORAGE_VERSION) return null;
    return parsed.data || null;
  } catch {
    return null;
  }
}

export function savePersistedState(data) {
  const payload = {
    version: STORAGE_VERSION,
    savedAt: Date.now(),
    data,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearPersistedState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportPersistedState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw || "";
}

