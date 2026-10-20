import { stripe, db, check, allSkus, env, json } from '../../server/services.mjs';
import { normalizeEmail, validEmail, paymentState } from '../../server/logic.mjs';
async function fulfill(id, client, database) {
  const session = await client.checkout.sessions.retrieve(id, { expand: ['payment_intent.latest_charge'] });
  if (session.metadata?.store !== 'hfj-store-v1' || session.mode !== 'payment' || session.payment_status !== 'paid') return;
  const payment = session.payment_intent, charge = payment?.latest_charge;
  if (!payment?.id || !charge || typeof charge === 'string') throw new Error('Paid charge missing');
  const email = normalizeEmail(session.customer_details?.email);
  if (!validEmail(email)) throw new Error('Checkout email missing');
  const skus = allSkus(), items = [];
  // Auto-pagination prevents silently dropping an order's line items.
  for await (const line of client.checkout.sessions.listLineItems(id, { limit: 100 })) {
    const price = await client.prices.retrieve(line.price.id);
    const sku = skus.get(price.metadata.sku);
    // Retired SKUs remain in the catalog/files mapping for webhook retries.
    if (!sku || !sku.files.length || line.quantity !== 1) throw new Error('Unknown purchased edition');
    items.push({ sku: sku.id, title: sku.title, cover: sku.cover, format: sku.label, files: sku.files });
  }
  if (!items.length) throw new Error('Empty paid order');
  check(await database.rpc('record_store_order', {
    p_session: session.id, p_payment: payment.id, p_email: email,
    p_amount: session.amount_total, p_currency: session.currency,
    p_status: paymentState(charge), p_refunded: charge.amount_refunded,
    p_items: items, p_purchased: new Date(session.created * 1000).toISOString()
  }));
  if (session.metadata?.newsletter_opt_in === 'yes') {
    check(await database.rpc('queue_store_newsletter', {
      p_email: email, p_desired: true, p_event: session.id,
      p_at: new Date(session.created * 1000).toISOString()
    }));
  }
}
export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const client = stripe(); let notification;
  try {
    const payload = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
    notification = client.webhooks.constructEvent(payload, event.headers['stripe-signature'], env('STRIPE_WEBHOOK_SECRET'));
  } catch { return json(400, { error: 'Invalid payment notification.' }); }
  try {
    const database = db();
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(notification.type)) await fulfill(notification.data.object.id, client, database);
    if (['charge.refunded', 'charge.dispute.created'].includes(notification.type)) {
      const object = notification.data.object;
      const chargeId = notification.type === 'charge.refunded' ? object.id : (typeof object.charge === 'string' ? object.charge : object.charge.id);
      const charge = await client.charges.retrieve(chargeId);
      const paymentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentId) {
        const payment = await client.paymentIntents.retrieve(paymentId);
        if (payment.metadata?.store === 'hfj-store-v1') check(await database.rpc('update_store_payment', {
          p_payment: paymentId, p_status: notification.type === 'charge.dispute.created' && paymentState(charge) !== 'refunded' ? 'disputed' : paymentState(charge), p_refunded: charge.amount_refunded
        }));
      }
    }
    return json(200, { received: true });
  } catch (error) {
    console.error('Payment fulfillment failed:', notification.id, error.code || error.name || 'Error');
    // Non-2xx makes Stripe retry. Never acknowledge a purchase we failed to save.
    return json(500, { error: 'Payment recording will be retried.' });
  }
}
