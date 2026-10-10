import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, validEmail, selectedSkus, paymentState, libraryItems, sheetValues } from '../server/logic.mjs';
test('email case/whitespace is normalized without altering aliases', () => {
  assert.equal(normalizeEmail(' Reader+books@Example.com '), 'reader+books@example.com');
  assert.equal(validEmail('reader@example.com'), true); assert.equal(validEmail('not-an-email'), false);
});
test('checkout rejects arbitrary SKUs, duplicate quantities and empty bags', () => {
  const allowed = new Set(['monster-ebook']);
  assert.deepEqual(selectedSkus(['monster-ebook'], allowed), ['monster-ebook']);
  for (const bag of [[], ['free-book'], ['monster-ebook','monster-ebook'], 'monster-ebook']) assert.throws(() => selectedSkus(bag, allowed));
});
test('full refund and dispute deny access; partial refund retains access', () => {
  assert.equal(paymentState({ amount: 599, amount_refunded: 599, disputed: true }), 'refunded');
  assert.equal(paymentState({ amount: 599, amount_refunded: 0, disputed: true }), 'disputed');
  assert.equal(paymentState({ amount: 599, amount_refunded: 100, disputed: false }), 'paid');
});
test('library combines paid purchases, deduplicates editions, and excludes revoked orders', () => {
  const ebook = { sku: 'monster-ebook' }, audio = { sku: 'monster-audio' };
  assert.deepEqual(libraryItems([
    { status: 'refunded', entitlements: [audio] }, { status: 'disputed', entitlements: [{ sku: 'other' }] },
    { status: 'paid', entitlements: [ebook] }, { status: 'paid', entitlements: [ebook, audio] }
  ]), [ebook, audio]);
});
test('sheet export records purchase/email/refunds and preserves raw text', () => {
  const row = sheetValues({ session_id:'cs_123',purchased_at:'2026-10-10',email:'=formula@example.com',entitlements:[{title:'Monster',format:'Ebook',sku:'monster-ebook'}],amount_total:599,currency:'usd',status:'paid',payment_intent:'pi_123',refunded_amount:100 });
  assert.equal(row.length, 10); assert.equal(row[2], '=formula@example.com'); assert.equal(row[5],5.99); assert.equal(row[9],1);
});
