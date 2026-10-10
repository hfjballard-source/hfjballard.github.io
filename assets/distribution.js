import { api, el, cover, status } from './common.js';
const message = document.querySelector('#library-status');
const access = document.querySelector('#access');
const library = document.querySelector('#library');
const emailForm = document.querySelector('#email-form');
const codeForm = document.querySelector('#code-form');
let email = '', token = sessionStorage.getItem('hfj-library-token') || '';
if (new URL(location.href).searchParams.has('checkout')) {
  document.querySelector('#payment-note').hidden = false;
  history.replaceState(null, '', location.pathname);
}
emailForm.addEventListener('submit', async event => {
  event.preventDefault(); email = document.querySelector('#email').value.trim().toLowerCase();
  const button = emailForm.querySelector('button'); button.disabled = true;
  status(message, 'Requesting your code…');
  try {
    await api('access', { action: 'send', email });
    emailForm.hidden = true; codeForm.hidden = false;
    document.querySelector('#code').value = ''; document.querySelector('#code').focus();
    status(message, 'If delivery is available, a code will arrive shortly. Check your spam folder too.');
  } catch (error) { status(message, error.message, true); } finally { button.disabled = false; }
});
document.querySelector('#change-email').addEventListener('click', () => { codeForm.hidden = true; emailForm.hidden = false; document.querySelector('#email').focus(); status(message, ''); });
codeForm.addEventListener('submit', async event => {
  event.preventDefault(); const button = codeForm.querySelector('button'); button.disabled = true;
  try {
    const data = await api('access', { action: 'verify', email, code: document.querySelector('#code').value.trim() });
    token = data.token; sessionStorage.setItem('hfj-library-token', token); await loadLibrary();
  } catch (error) { status(message, error.message, true); } finally { button.disabled = false; }
});
function signOut() { token = ''; sessionStorage.removeItem('hfj-library-token'); library.hidden = true; document.querySelector('#library-items').replaceChildren(); access.hidden = false; emailForm.hidden = false; codeForm.hidden = true; document.querySelector('#code').value = ''; }
document.querySelector('#sign-out').addEventListener('click', () => { signOut(); status(message, 'You are signed out.'); });
document.querySelector('#refresh').addEventListener('click', loadLibrary);
async function loadLibrary() {
  status(message, 'Finding your stories…');
  try {
    const data = await api('library', undefined, token);
    access.hidden = true; library.hidden = false;
    document.querySelector('#signed-in').textContent = `Library for ${data.email}`;
    const list = document.querySelector('#library-items'); list.replaceChildren();
    if (!data.items.length) list.append(el('p', 'notice', 'No completed purchases are linked to this email yet. If you just paid, refresh in a moment. If you used another checkout email, sign out and try that address.'));
    for (const item of data.items) {
      const book = el('article', 'library-book'); book.append(cover(item));
      const content = el('div'); content.append(el('h3', '', item.title), el('p', 'fine-print', item.format));
      const downloads = el('div', 'download-list');
      item.files.forEach((file, index) => {
        const button = el('button', 'button', `Download ${file.label} ↓`);
        button.addEventListener('click', async () => {
          button.disabled = true; status(message, 'Preparing your download…');
          try {
            const { url } = await api('download', { sku: item.sku, index }, token);
            const target = new URL(url); if (target.protocol !== 'https:') throw new Error('Download unavailable.');
            const link = el('a'); link.href = target.href; link.rel = 'noopener noreferrer'; link.target = '_blank'; link.click();
            status(message, 'Your download is ready. If it did not open, use the link below.');
            const fallback = el('a', 'text-link', 'Open download'); fallback.href = target.href; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer'; message.append(document.createTextNode(' '), fallback);
          } catch (error) { status(message, error.message, true); } finally { button.disabled = false; }
        }); downloads.append(button);
      }); content.append(downloads); book.append(content); list.append(book);
    }
    status(message, '');
  } catch (error) {
    if (/verify|expired|sign in/i.test(error.message)) signOut();
    status(message, error.message, true);
  }
}
if (token) loadLibrary();
