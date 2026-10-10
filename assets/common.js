export const apiBase = './.netlify/functions/';
export async function api(name, body, token) {
  const response = await fetch(apiBase + name, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The service is temporarily unavailable. Please try again.'); }
  if (!response.ok) throw new Error(data.error || 'Please try again in a moment.');
  return data;
}
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function cover(product) {
  const img = el('img'); img.src = product.cover; img.alt = `${product.title} cover`; img.loading = 'lazy';
  img.addEventListener('error', () => { img.replaceWith(el('span', 'cover-fallback', product.title)); }, { once: true });
  return img;
}
export function status(node, text, error = false) { node.textContent = text; node.classList.toggle('error', error); }
export function money(amount, currency = 'usd') { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
document.querySelectorAll('.year').forEach(node => { node.textContent = new Date().getFullYear(); });
