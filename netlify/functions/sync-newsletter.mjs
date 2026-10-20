import { randomUUID } from 'node:crypto';
import { db, check, env, json } from '../../server/services.mjs';
import { mailerLite } from '../../server/mailerlite.mjs';
export async function handler() {
  const database = db(), token = randomUUID(); let rows = [];
  try {
    const provider = mailerLite({ token: env('MAILERLITE_API_TOKEN'), groupId: env('MAILERLITE_GROUP_ID') });
    rows = check(await database.rpc('claim_store_newsletter', { p_token: token }));
    for (const row of rows) {
      const result = await provider.apply(row.email, row.desired);
      check(await database.from('store_newsletter').update({ synced_revision: row.revision, sync_token: null, lease_until: null, result }).eq('email', row.email).eq('sync_token', token));
    }
    return json(200, { synced: rows.length });
  } catch (error) {
    await database.from('store_newsletter').update({ sync_token: null, lease_until: null }).eq('sync_token', token);
    console.error('Newsletter sync failed:', error.code || error.name);
    return json(500, { error: 'Newsletter synchronization will retry.' });
  }
}
