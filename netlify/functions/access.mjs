import { route, parse, rateLimit, authClient } from '../../server/services.mjs';
import { normalizeEmail, validEmail } from '../../server/logic.mjs';
export const handler = route('POST', async event => {
  const body = parse(event), email = normalizeEmail(body.email);
  if (!validEmail(email) || !['send', 'verify'].includes(body.action)) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
  const client = authClient();
  if (body.action === 'send') {
    await rateLimit(event, 'email-ip', 10);
    await rateLimit(event, 'email-address-minute', 1, 60, email);
    await rateLimit(event, 'email-address-hour', 5, 3600, email);
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    // Same response for purchasers/nonpurchasers. Library membership stays private.
    if (error) console.error('OTP delivery failed:', error.code || 'provider_error');
    return { ok: true };
  }
  await rateLimit(event, 'verify-ip', 15);
  await rateLimit(event, 'verify-email', 10, 600, email);
  if (!/^[0-9]{6,10}$/.test(body.code || '')) throw Object.assign(new Error('Enter the code from your email.'), { status: 400 });
  const { data, error } = await client.auth.verifyOtp({ email, token: body.code, type: 'email' });
  if (error || !data.session) throw Object.assign(new Error('That code is invalid or expired. Request a new code and try again.'), { status: 401 });
  return { token: data.session.access_token };
});
