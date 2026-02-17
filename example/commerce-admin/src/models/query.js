export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function findProduct(state, productId) {
  return asArray(state?.products).find((p) => p?.id === productId) || null;
}

export function findOrder(state, orderId) {
  return asArray(state?.orders).find((o) => o?.id === orderId) || null;
}

