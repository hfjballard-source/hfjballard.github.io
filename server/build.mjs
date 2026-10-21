import { mkdir, cp, access, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
await mkdir('dist', { recursive: true });
// Keep the regular homepage as the default. Publish only public website files.
const rootPages = (await readdir('.')).filter(name => name.endsWith('.html'));
for (const path of [...rootPages, 'style.css', 'assets', 'images', 'videos', 'pdfs', 'bookshop']) {
  try { await access(path); } catch { continue; }
  await cp(path, `dist/${path}`, { recursive: true });
}
try { await access('dist/index.html'); } catch {
  await writeFile('dist/index.html', '<!doctype html><html lang="en"><meta charset="utf-8"><title>HFJ Ballard</title><p><a href="store.html">Visit the bookstore</a></p></html>');
}
// Reuse the CURRENT library implementation at every build, including newsletter controls.
try {
  await access('bookshop/index.html');
  const library = await readFile('distribution.html', 'utf8');
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(library)?.[1];
  if (!main) throw new Error('Cannot find the library main content.');
  await writeFile('dist/bookshop/library-fragment.html', main.replaceAll('href="index.html', 'href="/index.html'));
  let common = await readFile('assets/common.js', 'utf8');
  common = common.replace("'./.netlify/functions/'", "'/.netlify/functions/'");
  common = common.replace('img.src = product.cover;', "img.src = new URL(product.cover, location.origin + '/').href;");
  await writeFile('dist/bookshop/library-common.js', common);
  const session = (await readFile('assets/distribution.js', 'utf8')).replace("'./common.js'", "'./library-common.js'")
    .replaceAll('Ballard\uFFFDs', "Ballard’s").replaceAll('preferences\uFFFD', 'preferences…');
  await writeFile('dist/bookshop/library-session.js', session);
} catch (error) {
  // A malformed integration must fail deployment instead of publishing a broken library.
  try { await access('bookshop/index.html'); } catch { /* Existing non-bookshop site. */ }
  if (rootPages.includes('distribution.html')) throw error;
}
// Add the dresser portal without replacing or hand-editing the primary pages.
async function addPortal(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['bookshop', 'assets', 'images', 'videos', 'pdfs'].includes(entry.name)) await addPortal(path);
    } else if (entry.name.endsWith('.html')) {
      let html = await readFile(path, 'utf8');
      if (/<body\b/i.test(html) && !html.includes('/assets/bookshop-portal.js')) {
        html = html.replace(/<\/body>/i, '<script defer src="/assets/bookshop-portal.js"></script></body>');
        await writeFile(path, html);
      }
    }
  }
}
await addPortal('dist');
