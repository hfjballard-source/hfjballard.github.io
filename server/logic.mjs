// Pure decisions kept separate so payment/access rules can be tested without accounts.
export const normalizeEmail = value => String(value || '').trim().toLowerCase();
export function validEmail(value) { return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function selectedSkus(items, allowed) {
  if (!Array.isArray(items) || !items.length || items.length > 10 || new Set(items).size !== items.length || items.some(id => typeof id !== 'string' || !allowed.has(id))) throw new Error('Invalid book bag. Please refresh the store.');
  return items;
}
export function paymentState(charge) {
  if (charge.amount_refunded >= charge.amount && charge.amount > 0) return 'refunded';
  if (charge.disputed) return 'disputed';
  return 'paid';
}
export function libraryItems(orders) {
  const bySku = new Map();
  for (const order of orders) {
    if (order.status !== 'paid') continue;
    for (const item of order.entitlements) if (!bySku.has(item.sku)) bySku.set(item.sku, item);
  }
  return [...bySku.values()];
}
export function sheetValues(order) {
  return [order.session_id, order.purchased_at, order.email,
    order.entitlements.map(item => `${item.title} (${item.format})`).join('; '),
    order.entitlements.map(item => item.sku).join('; '), order.amount_total / 100,
    order.currency.toUpperCase(), order.status, order.payment_intent, order.refunded_amount / 100];
}
