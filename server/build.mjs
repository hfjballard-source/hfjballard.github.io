import { mkdir, cp, access, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
// Only publish website assets. Database scripts, secrets and server source stay out.
for (const path of ['index.html', 'style.css', 'portfolio.html', 'store.html', 'distribution.html', 'assets', 'images', 'videos', 'pdfs']) {
  try { await access(path); } catch { continue; }
  await cp(path, `dist/${path}`, { recursive: true });
}
try { await access('dist/index.html'); } catch {
  await writeFile('dist/index.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HFJ Ballard</title><p><a href="store.html">Visit the HFJ Ballard bookstore</a></p></html>');
}
