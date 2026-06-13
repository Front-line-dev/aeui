import { makeSeedState } from "@/lib/seed.js";
import { loadPersistedState } from "@/lib/storage.js";

export function normalizeCart(value) {
  const cart = value && typeof value === "object" ? value : {};
  const items = Array.isArray(cart.items) ? cart.items : [];
  const couponCode = typeof cart.couponCode === "string" ? cart.couponCode : "";
  return { items, couponCode };
}

export function loadInitialData() {
  const seed = makeSeedState();
  const persisted = loadPersistedState();

  const products = Array.isArray(persisted?.products) ? persisted.products : seed.products;
  const cart = normalizeCart(persisted?.cart || seed.cart);
  const orders = Array.isArray(persisted?.orders) ? persisted.orders : seed.orders;
  const activity = Array.isArray(persisted?.activity) ? persisted.activity : seed.activity;

  return { products, cart, orders, activity };
}
