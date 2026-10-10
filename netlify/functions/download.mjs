import { route, parse, userEmail, entitlements, rateLimit, db, check } from '../../server/services.mjs';
export const handler = route('POST', async event => {
  await rateLimit(event, 'download', 60);
  const email = await userEmail(event), { sku, index } = parse(event);
  const item = (await entitlements(email)).find(item => item.sku === sku);
  if (!item || !Number.isInteger(index) || index < 0 || !item.files[index]) throw Object.assign(new Error('This file is not available in your library.'), { status: 403 });
  const file = item.files[index];
  const signed = check(await db().storage.from('digital-assets').createSignedUrl(file.path, 300, { download: true }));
  return { url: signed.signedUrl };
});
