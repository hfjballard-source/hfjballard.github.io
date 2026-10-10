import { randomUUID } from 'node:crypto';
import { GoogleAuth } from 'google-auth-library';
import { db, env, check, json } from '../../server/services.mjs';
import { sheetValues } from '../../server/logic.mjs';
// Scheduled functions are invoked by Netlify, not from the customer's browser.
export async function handler() {
  const database = db(), token = randomUUID(); let orders = [];
  try {
    orders = check(await database.rpc('claim_store_sheet_rows', { p_token: token }));
    if (!orders.length) return json(200, { synced: 0 });
    const auth = new GoogleAuth({ credentials: {
      client_email: env('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      private_key: env('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n')
    }, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const client = await auth.getClient();
    const sheetId = encodeURIComponent(env('GOOGLE_SHEET_ID'));
    // Fixed database-assigned rows + RAW input make retries idempotent and prevent formula injection.
    await client.request({ method: 'POST', url: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, timeout: 15000, data: {
      valueInputOption: 'RAW', data: [
        { range: "'Purchases'!A1:J1", values: [['Order ID','Purchased at (UTC)','Email','Products','SKUs','Paid total','Currency','Status','Payment ID','Refunded total']] },
        ...orders.map(order => ({ range: `'Purchases'!A${Number(order.sheet_row) + 1}:J${Number(order.sheet_row) + 1}`, values: [sheetValues(order)] }))
      ]
    }});
    for (const order of orders) check(await database.from('store_orders').update({ sheet_synced_revision: order.revision, sheet_sync_token: null, sheet_lease_until: null }).eq('session_id', order.session_id).eq('sheet_sync_token', token));
    return json(200, { synced: orders.length });
  } catch (error) {
    // Leave records pending; the next scheduled run will retry. Purchases remain usable.
    if (orders.length) await database.from('store_orders').update({ sheet_sync_token: null, sheet_lease_until: null }).eq('sheet_sync_token', token);
    console.error('Spreadsheet sync failed:', error.code || error.name || 'Error');
    return json(500, { error: 'Spreadsheet synchronization will retry.' });
  }
}
