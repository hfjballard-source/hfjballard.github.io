import { route, parse, allSkus, readCatalog, stripe, db, check, site, rateLimit } from '../../server/services.mjs';
import { selectedSkus } from '../../server/logic.mjs';
export const handler = route('POST', async event => {
  await rateLimit(event, 'checkout', 15);
  const { items, requestId } = parse(event), skus = allSkus();
  if (!/^[0-9a-f-]{36}$/i.test(requestId || '')) throw Object.assign(new Error('Please refresh your book bag.'), { status: 400 });
  let selected;
  try { selected = selectedSkus(items, new Set([...skus].filter(([, sku]) => sku.saleEnabled && sku.priceId && sku.files.length).map(([id]) => id))); }
  catch (error) { throw Object.assign(error, { status: 400 }); }
  const client = stripe(), database = db(), currency = readCatalog().currency;
  const prices = await Promise.all(selected.map(async id => {
    const sku = skus.get(id), price = await client.prices.retrieve(sku.priceId);
    if (!price.active || price.type !== 'one_time' || price.currency !== currency || !price.unit_amount || price.metadata.sku !== id) throw Object.assign(new Error('An edition is unavailable. Please refresh the store.'), { status: 409 });
    // Refuse sales when promised files have not actually been uploaded.
    await Promise.all(sku.files.map(async file => check(await database.storage.from('digital-assets').createSignedUrl(file.path, 1))));
    return { price: price.id, quantity: 1 };
  }));
  const session = await client.checkout.sessions.create({
    mode: 'payment', payment_method_types: ['card'], line_items: prices,
    billing_address_collection: 'required', automatic_tax: { enabled: process.env.ENABLE_STRIPE_TAX === 'true' },
    metadata: { store: 'hfj-store-v1' },
    success_url: `${site()}/distribution.html?checkout=returned`, cancel_url: `${site()}/store.html`,
    payment_intent_data: {
  description:
    'HFJ Ballard digital books. ' +
    'Open your library: https://hfjballard.com/distribution.html ' +
    'Use your checkout email to sign in and download your books.',
  metadata: { store: 'hfj-store-v1' }
},
    custom_text: { submit: { message: 'Your digital books will be available at the My Library page using the email entered here.' } }
  }, { idempotencyKey: `hfj-checkout-${requestId}` });
  return { url: session.url };
});
