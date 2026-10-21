/* Read public content from the primary website. Private files remain behind the library. */
window.SHOP_CONTENT = { books: [], portfolio: [], author: { name: 'HFJ Ballard', bio: '', image: '', note: '' }, magazine: { title: 'The Reading Room', issue: 'Short stories from HFJ Ballard', stories: [] }, news: [] };
window.bookshopContentReady = (async () => {
  const content = window.SHOP_CONTENT;
  const safeURL = (value, base = location.origin + '/') => {
    try { const u = new URL(value, base); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
  };
  async function page(path) {
    const r = await fetch(path, { signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error('Page unavailable');
    return new DOMParser().parseFromString(await r.text(), 'text/html');
  }
  const results = await Promise.allSettled([
    (async () => {
      let catalog;
      try { const r = await fetch('/.netlify/functions/catalog', { signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error(); catalog = await r.json(); }
      catch { const r = await fetch('/assets/catalog.json', { signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error(); catalog = await r.json(); catalog.products.forEach(p => p.formats.forEach(f => { f.available = false; })); }
      content.currency = catalog.currency || 'usd'; content.news = catalog.news || [];
      content.books = catalog.products.map(p => ({ ...p, genre: p.eyebrow || 'From the author', blurb: p.description, cover: safeURL(p.cover), color: '#3c5145', formats: p.formats || [] }));
    })(),
    (async () => {
      const doc = await page('/index.html');
      const author = doc.querySelector('#about');
      if (author) {
        content.author.bio = [...author.querySelectorAll('p')].map(p => p.textContent.trim()).join('\n\n');
        content.author.image = safeURL(author.querySelector('img')?.getAttribute('src') || '');
      }
      content.homeDocument = doc;
    })(),
    (async () => {
      const doc = await page('/portfolio.html'), seen = new Set();
      content.portfolio = [...doc.querySelectorAll('main img, .portfolio-grid img, .gallery img, .portfolio-item img, .gallery-item img, .infinite-gallery img')].flatMap(img => {
        const image = safeURL(img.getAttribute('src') || img.getAttribute('data-src'));
        if (!image || seen.has(image)) return []; seen.add(image);
        const card = img.closest('article, figure, .portfolio-item, .gallery-item, .portfolio-card, .gallery-card') || img.parentElement;
        return [{ image, title: card.querySelector('h2,h3,figcaption')?.textContent.trim() || img.alt || 'Portfolio artwork', type: 'HFJ BALLARD Â· PORTFOLIO', description: card.querySelector('p')?.textContent.trim() || img.alt || '' }];
      });
    })()
  ]);
  // Homepage works that are sold elsewhere remain available without inventing digital editions.
  const doc = content.homeDocument;
  if (doc) for (const card of doc.querySelectorAll('#books .book-card')) {
    const title = card.querySelector('h3')?.textContent.trim();
    const href = card.closest('a[href]')?.getAttribute('href');
    const found = content.books.find(b => b.title.toLowerCase() === title?.toLowerCase());
    if (found) { found.externalURL = href ? safeURL(href) : ''; continue; }
    if (title) content.books.push({ id: 'work-' + content.books.length, title, cover: safeURL(card.querySelector('img')?.getAttribute('src')), genre: card.querySelector('p')?.textContent.trim() || 'Literary work', blurb: '', externalURL: href ? safeURL(href) : '', formats: [], color: '#3c5145' });
  }
  content.magazine.readingLinks = content.books.filter(b => /short story/i.test(b.title) && b.externalURL).map(b => ({title:b.title,url:b.externalURL}));
  try {
    const r=await fetch('/bookshop/reading-room.json', { signal: AbortSignal.timeout(12000) });
    if(r.ok){const issue=await r.json(); if(Array.isArray(issue.stories)&&issue.stories.length) Object.assign(content.magazine,issue);}
  } catch {}
  delete content.homeDocument;
  content.loadWarnings = results.filter(r => r.status === 'rejected').length;
  return content;
})();
