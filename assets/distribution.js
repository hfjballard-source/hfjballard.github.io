import { api, el, cover, status } from './common.js';
import { prepareLibraryDownload, clearLibraryDownload } from '/assets/library-download.js?v=20261025';
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
function signOut() { clearLibraryDownload(); token = ''; sessionStorage.removeItem('hfj-library-token'); library.hidden = true; document.querySelector('#library-items').replaceChildren(); access.hidden = false; emailForm.hidden = false; codeForm.hidden = true; document.querySelector('#code').value = ''; }
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
            const downloadToken=token;
            const data = await api('download', { sku: item.sku, index }, downloadToken);
            if(token!==downloadToken)return;
            const download=await prepareLibraryDownload(data,text=>status(message,text));
            if(token!==downloadToken){clearLibraryDownload();return;}
            const link = el('a'); link.href = download.url; link.rel = 'noopener noreferrer'; link.target = '_blank';
            if(download.filename)link.download=download.filename;
            document.body.append(link);link.click();link.remove();
            status(message, 'Your download is ready. If it did not open, use the link below.');
            const fallback = el('a', 'text-link', 'Open download'); fallback.href = download.url; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer';
            if(download.filename)fallback.download=download.filename;
            message.append(document.createTextNode(' '), fallback);
          } catch (error) { status(message, error.message, true); } finally { button.disabled = false; }
        }); downloads.append(button);
      }); content.append(downloads); book.append(content); list.append(book);
    }
    status(message, '');
    loadNewsletter();
  } catch (error) {
    if (/verify|expired|sign in/i.test(error.message)) signOut();
    status(message, error.message, true);
  }
}
// Newsletter errors do not block library access.
const newsletterPanel = el('section', 'notice'); newsletterPanel.style.marginTop = '2rem';
newsletterPanel.append(el('h3', '', 'Your monthly newsletter'));
const newsletterForm = el('form');
const newsletterBox = el('input'); newsletterBox.type = 'checkbox'; newsletterBox.disabled = true;
newsletterBox.style.cssText = 'width:auto;margin:0 .6rem 0 0;accent-color:#d4af37';
const newsletterLabel = el('label');
newsletterLabel.append(newsletterBox, document.createTextNode('Email me HFJ Ballard’s monthly newsletter with new stories, book news, and upcoming events.'));
const newsletterSave = el('button', 'button', 'Save preferences'); newsletterSave.type = 'submit'; newsletterSave.disabled = true; newsletterSave.style.marginTop = '1rem';
const newsletterMessage = el('p', 'fine-print'); newsletterMessage.setAttribute('role', 'status');
newsletterForm.append(newsletterLabel, el('br'), newsletterSave);
newsletterPanel.append(newsletterForm, newsletterMessage); library.append(newsletterPanel);
async function loadNewsletter() {
  const currentToken = token;
  newsletterBox.disabled = true; newsletterSave.disabled = true;
  newsletterMessage.textContent = 'Checking newsletter preferences…';
  try {
    const data = await api('newsletter', undefined, currentToken);
    if (token !== currentToken) return;
    newsletterBox.checked = data.subscribed;
    newsletterMessage.textContent = data.pending ? 'Your preference is saved and will sync shortly. Refresh your library in a few minutes to check.' : data.confirmationNeeded ? 'Please contact the author for a fresh newsletter signup link to confirm your subscription. Your book access is unaffected.' : 'Optional. Uncheck to leave the monthly newsletter. Your books remain available.';
    newsletterBox.disabled = false; newsletterSave.disabled = false;
  } catch { if (token === currentToken) newsletterMessage.textContent = 'Newsletter settings are unavailable. Refresh your library to try again. Your downloads still work.'; }
}
newsletterForm.addEventListener('submit', async event => {
  event.preventDefault(); const currentToken = token;
  newsletterBox.disabled = true; newsletterSave.disabled = true;
  try {
    await api('newsletter', { subscribed: newsletterBox.checked }, currentToken);
    if (token === currentToken) newsletterMessage.textContent = 'Preference saved. Please allow about five minutes for MailerLite to update.';
  } catch (error) { if (token === currentToken) newsletterMessage.textContent = error.message; }
  finally { if (token === currentToken) { newsletterBox.disabled = false; newsletterSave.disabled = false; } }
});
if (token) loadLibrary();
