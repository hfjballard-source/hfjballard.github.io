import { route, userEmail, entitlements, rateLimit } from '../../server/services.mjs';
export const handler = route('GET', async event => {
  await rateLimit(event, 'library', 60);
  const email = await userEmail(event);
  const items = (await entitlements(email)).map(({ sku, title, cover, format, files }) => ({ sku, title, cover, format, files: files.map(file => ({ label: file.label })) }));
  return { email, items };
});
