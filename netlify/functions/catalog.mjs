import { route, readCatalog, allSkus, stripe } from '../../server/services.mjs';
let cached;
export const handler = route('GET', async () => {
  if (cached && cached.until > Date.now()) return cached.data;
  const catalog = readCatalog(), skus = allSkus(), client = stripe();
  await Promise.all(catalog.products.flatMap(product => product.formats.map(async format => {
    const sku = skus.get(format.id); format.available = false;
    if (!format.saleEnabled || !sku.priceId || !sku.files.length) return;
    const price = await client.prices.retrieve(sku.priceId);
    if (price.active && price.type === 'one_time' && price.currency === catalog.currency && price.unit_amount > 0 && price.metadata.sku === format.id) {
      format.price = price.unit_amount / 100; format.available = true;
    }
  })));
  cached = { until: Date.now() + 60000, data: catalog }; return catalog;
});
