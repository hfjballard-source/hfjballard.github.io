import { route, userEmail, rateLimit, parse, db, check, env, json } from '../../server/services.mjs';
import { mailerLite } from '../../server/mailerlite.mjs';
export async function handler(event) {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed.' });
  return route(event.httpMethod, async event => {
    const email = await userEmail(event);
    await rateLimit(event, 'newsletter', 15, 60, email);
    const database = db();
    if (event.httpMethod === 'POST') {
      const { subscribed } = parse(event);
      if (typeof subscribed !== 'boolean') throw Object.assign(new Error('Choose a newsletter preference.'), { status: 400 });
      check(await database.rpc('queue_store_newsletter', { p_email: email, p_desired: subscribed }));
      return { pending: true };
    }
    const row = check(await database.from('store_newsletter').select('desired,revision,synced_revision,result').eq('email', email).maybeSingle());
    if (row && row.revision > row.synced_revision) return { subscribed: row.desired, pending: true };
    const provider = mailerLite({ token: env('MAILERLITE_API_TOKEN'), groupId: env('MAILERLITE_GROUP_ID') });
    return { subscribed: provider.subscribed(await provider.get(email)), pending: false, confirmationNeeded: row?.result === 'confirmation_needed' };
  })(event);
}
