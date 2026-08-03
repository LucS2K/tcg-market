// The binder lives in localStorage on this device — no accounts. A
// "binder code" (base64 JSON) is the backup/portability layer.
const KEY = "neighborstcg-binder";
const listeners = new Set();

export function loadBinder() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function save(binder) {
  try {
    localStorage.setItem(KEY, JSON.stringify(binder));
  } catch {
    // storage full or blocked — the UI still works for this session
  }
  listeners.forEach((fn) => fn(binder));
}

export function setQty(gid, qty) {
  const binder = loadBinder();
  if (qty > 0) binder[gid] = qty;
  else delete binder[gid];
  save(binder);
}

export function getQty(gid) {
  return loadBinder()[gid] || 0;
}

export function binderSize(binder = loadBinder()) {
  return Object.values(binder).reduce((a, b) => a + b, 0);
}

export function onBinderChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function exportCode(binder = loadBinder()) {
  return btoa(JSON.stringify(binder));
}

export function decodeCode(code) {
  try {
    const parsed = JSON.parse(atob(code.trim()));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const clean = {};
    for (const [gid, qty] of Object.entries(parsed)) {
      if (/^[0-9a-f]{6,12}$/.test(gid) && Number.isFinite(qty) && qty > 0) {
        clean[gid] = Math.min(Math.floor(qty), 9999);
      }
    }
    return clean;
  } catch {
    return null;
  }
}

export function importCode(code) {
  const parsed = decodeCode(code);
  if (!parsed) return false;
  save(parsed);
  return true;
}
