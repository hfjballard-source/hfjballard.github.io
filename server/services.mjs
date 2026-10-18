import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { normalizeEmail, libraryItems, DOWNLOADABLE_ORDER_STATUSES } from './logic.mjs';
export function env(name) {
  const value = process.env[name];
  if (!value) throw Object.assign(new Error(`Missing environment setting: ${name}`), { name: 'StoreConfigurationError' });
  return value;
}
export function site() { return env('SITE_URL').replace(/\/$/, ''); }
export function db() { return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } }); }
export function authClient() { return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } }); }
export function stripe() { return new Stripe(env('STRIPE_SECRET_KEY'), { apiVersion: '2025-03-31.basil', maxNetworkRetries: 2, timeout: 10000 }); }
export function check(result) { if (result.error) throw result.error; return result.data; }
export function readCatalog() { return JSON.parse(readFileSync('assets/catalog.json', 'utf8')); }
export function allSkus() {
  const files = JSON.parse(readFileSync('server/files.json', 'utf8'));
  return new Map(readCatalog().products.flatMap(product => product.formats.map(format => [format.id, {
    ...format, title: product.title, cover: product.cover, files: files[format.id] || [],
    priceId: process.env[`PRICE_${format.id.toUpperCase().replaceAll('-', '_')}`]
  }])));
}
export function json(code, body) { return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(body) }; }
export function parse(event) {
  if (Buffer.byteLength(event.body || '') > 8192) throw Object.assign(new Error('Request too large.'), { status: 413 });
  try { return JSON.parse(event.body || '{}'); } catch { throw Object.assign(new Error('Invalid request.'), { status: 400 }); }
}
export function route(method, handler) {
  return async event => {
    if (event.httpMethod !== method) return json(405, { error: 'Method not allowed.' });
    try {
      // The public pages and API run on the same Netlify domain. No wildcard CORS.
      const origin = event.headers.origin;
      if (origin) {
        const expectedOrigin = new URL(site()).origin;
        if (origin !== expectedOrigin) return json(403, {
          error: `Website address mismatch. This page is using ${origin}, but the server's SITE_URL is configured for ${expectedOrigin}.`
        });
      }
      return json(200, await handler(event));
    } catch (error) {
      if (!error.status) console.error('Store operation failed:', error.name === 'StoreConfigurationError' ? error.message : (error.code || error.name || 'Error'));
      return json(error.status || 503, { error: error.status ? error.message : 'The service is temporarily unavailable. Please try again or contact the author.' });
    }
  };
}
export async function rateLimit(event, category, limit, seconds = 60, identity) {
  const ip = event.headers['x-nf-client-connection-ip'] || 'unknown';
  const key = createHmac('sha256', env('RATE_LIMIT_SECRET')).update(`${category}:${identity || ip}`).digest('hex');
  const allowed = check(await db().rpc('store_rate_limit', { p_key: key, p_seconds: seconds, p_limit: limit }));
  if (!allowed) throw Object.assign(new Error('Please wait a little before trying again.'), { status: 429 });
}
export async function userEmail(event) {
  const match = /^Bearer ([^\s]+)$/.exec(event.headers.authorization || '');
  if (!match) throw Object.assign(new Error('Please verify your email to open your library.'), { status: 401 });
  const { data, error } = await db().auth.getUser(match[1]);
  if (error || !data.user?.email || !data.user.email_confirmed_at) throw Object.assign(new Error('Your session expired. Please verify your email again.'), { status: 401 });
  return normalizeEmail(data.user.email);
}
export async function entitlements(email) {
  const database = db(); const orders = [];
  // Page past the API's default 1,000-row cap; a lifetime library includes every order.
  for (let offset = 0; ; offset += 500) {
    const page = check(await database.from('store_orders').select('status,entitlements').eq('email', email).in('status', DOWNLOADABLE_ORDER_STATUSES).order('sheet_row', { ascending: false }).range(offset, offset + 499));
    orders.push(...page); if (page.length < 500) break;
  }
  return libraryItems(orders);
}
