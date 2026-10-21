(() => {
  if (window.self !== window.top || document.querySelector('#bookshop-portal')) return;
  const inShop = location.pathname.startsWith('/bookshop/');
  let returnPath = '/';
  try {
    if (!inShop) sessionStorage.setItem('hfj-primary-return', location.pathname + location.search + location.hash);
    else {
      const stored = sessionStorage.getItem('hfj-primary-return');
      const url = stored ? new URL(stored, location.origin) : null;
      if (url?.origin === location.origin && !url.pathname.startsWith('/bookshop/')) returnPath = url.pathname + url.search + url.hash;
    }
  } catch {}
  const link = document.createElement('a'); link.id = 'bookshop-portal';
  link.href = inShop ? returnPath : '/bookshop/';
  link.setAttribute('aria-label', inShop ? 'Return to the regular website' : 'Enter the pixel art bookshop');
  link.title = link.getAttribute('aria-label');
  const dresser = '<path fill="#765033" d="M14 8h36v46H14z"/><path fill="#bb955e" d="M11 6h42v5H11zM12 53h40v5H12z"/><path fill="#342b3a" d="M18 14h28v35H18z"/><path fill="#614766" d="M21 17h22v29H21z"/><path fill="#b49bcd" d="M26 19h12v25H26z"/><path fill="#fff0b2" d="M30 21h4v21h-4z"/><path fill="#b68c50" d="M14 59h5v4h-5zM45 59h5v4h-5zM18 49h28v2H18z"/><path fill="#f7d98c" d="M45 28h3v3h-3z"/>';
  const lamp = '<path fill="#e1b764" d="M28 12h8v5h-8zM21 17h22v3H21z"/><path fill="#725e43" d="M23 20h18v19H23z"/><path fill="#fff0ac" d="M26 23h12v13H26z"/><path fill="#ffe9a0" d="M30 8h4v5h-4z"/><path fill="#bb955e" d="M21 38h22v4H21zM30 42h4v15h-4zM23 57h18v4H23z"/>';
  link.innerHTML = '<svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true" shape-rendering="crispEdges">' + (inShop ? lamp : dresser) + '</svg><span>' + (inShop ? 'Regular site' : 'Enter bookshop') + '</span>';
  document.body.append(link);
  const style = document.createElement('style'); style.textContent = '#bookshop-portal{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:900;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 5px;border:1px solid #b58f51;border-radius:9px;background:#211e26f2;color:#edddba;font:13px Georgia,serif;text-decoration:none;box-shadow:0 3px 20px #0008}#bookshop-portal:hover{background:#393042}#bookshop-portal:focus-visible{outline:3px solid #f4d889;outline-offset:4px}#bookshop-portal svg{flex:none}@media(max-width:600px){#bookshop-portal{padding:4px;bottom:max(8px,env(safe-area-inset-bottom));left:8px}#bookshop-portal span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}}'; document.head.append(style);
})();
