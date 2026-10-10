import { api, el, cover, status, money } from './common.js';
let catalog, filter = 'all';
const cart = new Map();
let requestId = crypto.randomUUID();
const bag = document.querySelector('#bag');
const storeStatus = document.querySelector('#store-status');
const checkoutStatus = document.querySelector('#checkout-status');
const checkout = document.querySelector('#checkout');
function buyCard(product, featured = false) {
  const root = el(featured ? 'div' : 'article', featured ? 'featured-copy' : 'product-card');
  if (!featured) { const art = el('div', 'product-art'); art.append(cover(product)); root.append(art); }
  root.append(el('p', 'eyebrow', product.eyebrow), el('h3', '', product.title));
  if (featured) root.append(el('p', '', product.description));
  const formats = product.formats.filter(format => filter === 'all' || featured || format.kind === filter);
  if (!formats.length) { root.append(el('p', 'fine-print', 'Digital edition coming soon')); return root; }
  const tabs = el('div', 'format-buttons'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', `${product.title} format`);
  const detail = el('p', 'format-detail'), price = el('p', 'price'), button = el('button', 'button');
  let selected = formats[0];
  const choose = format => {
    selected = format;
    [...tabs.children].forEach((tab, index) => tab.setAttribute('aria-pressed', String(formats[index].id === format.id)));
    detail.textContent = format.detail;
    price.replaceChildren(document.createTextNode(money(format.available ? format.price : format.previewPrice, catalog.currency)));
    if (!format.available) price.append(el('span', 'preview-label', 'Illustrative price · not yet on sale'));
    button.disabled = !format.available;
    button.textContent = format.available ? 'Add to book bag +' : 'Coming soon';
    button.setAttribute('aria-label', format.available ? `Add ${product.title}, ${format.label} to bag` : `${product.title}, ${format.label}: coming soon`);
  };
  formats.forEach(format => { const tab = el('button', '', format.label); tab.addEventListener('click', () => choose(format)); tabs.append(tab); });
  choose(selected);
  button.addEventListener('click', () => {
    cart.set(selected.id, { ...selected, title: product.title });
    requestId = crypto.randomUUID();
    renderBag(); status(checkoutStatus, ''); bag.showModal();
  });
  root.append(tabs, detail, price, button);
  return root;
}
function renderCollection() {
  const grid = document.querySelector('#products'); grid.replaceChildren();
  catalog.products.filter(product => filter === 'all' || product.formats.some(format => format.kind === filter)).forEach(product => grid.append(buyCard(product)));
  if (!grid.children.length) grid.append(el('p', '', 'More stories are on the way. Check back soon.'));
}
function renderBag() {
  const list = document.querySelector('#bag-items'); list.replaceChildren();
  document.querySelector('#bag-count').textContent = cart.size;
  let total = 0;
  for (const [id, item] of cart) {
    total += item.price;
    const row = el('div', 'bag-row'), info = el('div');
    info.append(el('p', '', item.title), el('small', '', `${item.label} · ${money(item.price, catalog.currency)}`));
    const remove = el('button', 'text-button', 'Remove'); remove.setAttribute('aria-label', `Remove ${item.title}, ${item.label}`);
    remove.addEventListener('click', () => { cart.delete(id); requestId = crypto.randomUUID(); renderBag(); }); row.append(info, remove); list.append(row);
  }
  if (!cart.size) list.append(el('p', '', 'Your next adventure starts with a book.'));
  document.querySelector('#bag-total').textContent = `Subtotal ${money(total, catalog?.currency || 'usd')}`;
  checkout.disabled = !cart.size;
}
document.querySelector('#open-bag').addEventListener('click', () => { renderBag(); bag.showModal(); });
['#close-bag', '#continue-browsing'].forEach(selector => document.querySelector(selector).addEventListener('click', () => bag.close()));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  if (!catalog) return;
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(node => node.setAttribute('aria-pressed', String(node === button)));
  renderCollection();
}));
checkout.addEventListener('click', async () => {
  if (!cart.size) return;
  checkout.disabled = true; status(checkoutStatus, 'Opening secure checkout…');
  try {
    const { url } = await api('checkout', { items: [...cart.keys()], requestId });
    const destination = new URL(url);
    if (destination.protocol !== 'https:' || destination.hostname !== 'checkout.stripe.com') throw new Error('Checkout is temporarily unavailable.');
    location.assign(destination.href);
  } catch (error) { status(checkoutStatus, error.message, true); checkout.disabled = false; }
});
async function init() {
  let preview = false;
  try { catalog = await api('catalog'); }
  catch {
    try {
      const response = await fetch('assets/catalog.json');
      if (!response.ok) throw new Error();
      catalog = await response.json(); preview = true;
      catalog.products.forEach(product => product.formats.forEach(format => { format.available = false; }));
    } catch { status(storeStatus, 'The bookstore could not load. Please refresh or contact the author.', true); document.querySelector('#featured').textContent = 'Please check back shortly.'; return; }
  }
  if (preview) status(storeStatus, 'The bookstore is being prepared. Checkout is not available yet.');
  else if (!catalog.products.some(product => product.formats.some(format => format.available))) status(storeStatus, 'Digital editions are on the way. Check back for availability.');
  const product = catalog.products.find(product => product.id === catalog.featuredId) || catalog.products[0];
  const featured = document.querySelector('#featured'); featured.replaceChildren();
  if (product) { const art = el('div', 'featured-art'); art.append(cover(product)); featured.append(art, buyCard(product, true)); }
  renderCollection();
  for (const item of catalog.news) {
    const article = el('article'); article.append(el('p', 'eyebrow', item.label), el('h3', '', item.title), el('p', '', item.text));
    if (item.url && /^https:\/\//.test(item.url)) { const a = el('a', '', `${item.linkLabel || 'Learn more'} ↗`); a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; article.append(a); }
    document.querySelector('#news').append(article);
  }
}
init();
