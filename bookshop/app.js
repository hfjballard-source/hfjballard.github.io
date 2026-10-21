(async () => {
  'use strict';
  const dialog = document.querySelector('#panel'), body = document.querySelector('#panel-body');
  const loading = document.createElement('p'); loading.className = 'bookshop-loading'; loading.textContent = 'Opening the bookshop…'; loading.setAttribute('role', 'status'); document.body.append(loading);
  await window.bookshopContentReady; loading.remove();
  const content = window.SHOP_CONTENT, reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title = text => `<h2 id="panel-title">${esc(text)}</h2>`;
  const label = '';
  const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: content.currency || 'usd' }).format(n);
  let returnFocus, activePanel, cleanup = () => {}, timer, magazinePage = 0, magazineHeld = false;
  let libraryNode=null, libraryInit=null;
  const libraryParking=document.createElement('div'); libraryParking.hidden=true; document.body.append(libraryParking);
  const bag = new Map(); let requestId = crypto.randomUUID(), newsletter = false;
  const sku = id => content.books.flatMap(b => b.formats.map(f => ({...f, title:b.title}))).find(f => f.id === id);
  function toast(message) { const e = document.querySelector('#toast'); e.textContent = message; e.classList.add('visible'); clearTimeout(timer); timer = setTimeout(() => e.classList.remove('visible'), 6000); }
  function show(html, kind='') { cleanup(); cleanup=()=>{}; if(libraryNode?.parentElement===body)libraryParking.append(libraryNode); body.replaceChildren(); body.innerHTML=html; dialog.className=kind; dialog.scrollTop=0; }
  function persist() { document.querySelector('#bag-count').textContent=bag.size ? `(${bag.size})` : ''; requestId=crypto.randomUUID(); }
  function cover(b) { return `<div class="cover real-cover">${b.cover ? `<img src="${esc(b.cover)}" alt="${esc(b.title)} cover" loading="lazy">` : `<strong>${esc(b.title)}</strong>`}</div>`; }
  function store() {
    show(title('The author’s bookshelf') + (content.books.length ? '<div class="shelf-stage"><div class="books physical-shelf">' + content.books.map(b => `<button class="book-button" data-book="${esc(b.id)}" aria-label="Browse ${esc(b.title)}">${cover(b)}<strong>${esc(b.title)}</strong><small>${esc(b.genre)}</small></button>`).join('') + '</div>' + BookshopScenes.arm + '</div>' : '<p class="bookshop-notice">The bookshelf could not load. Please visit the regular store.</p>') + '<div class="scene-actions"><button class="action" data-switch="checkout">Go to the counter</button><a class="action secondary" href="/store.html">Regular store</a></div>', 'immersive shelf-view');
    const stage=body.querySelector('.shelf-stage'); if(stage) cleanup=BookshopScenes.shelf(stage);
  }
  function book(id) {
    const b=content.books.find(b=>b.id===id); if(!b)return;
    show('<button class="back" data-back="store">← Put it back on the shelf</button><div class="book-detail">'+cover(b)+'<div>'+title(b.title)+`<p>${esc(b.genre)}</p><p class="body-copy">${esc(b.blurb)}</p><div class="edition-list">`+b.formats.map(f=>`<div><strong>${esc(f.label)}</strong> · ${esc(f.detail || '')} ${f.available ? money(f.price) : '— Not currently available direct'}<br><button class="action" data-add="${esc(f.id)}" ${f.available?'':'disabled'}>${bag.has(f.id)?'In your book bag':f.available?'Take to the counter':'Coming soon'}</button></div>`).join('')+'</div>'+(b.externalURL?`<a class="action secondary" href="${esc(b.externalURL)}" target="_blank" rel="noopener noreferrer">${b.externalURL.endsWith('.pdf')?'Read this story':'View on the original website'} ↗</a>`:'')+'<button class="action secondary" data-switch="checkout">View book bag</button></div></div>');
  }
  function checkout() {
    show(title('At the counter')+'<div class="counter-closeup"><div class="register-art" aria-hidden="true"><div class="register-screen">STRIPE</div><div class="register-keys">▦ ▦ ▦</div><div class="register-drawer">AFTERHOURS</div></div><div class="receipt"><div class="receipt-top">HFJ BALLARD<br><small>DIRECT DIGITAL EDITIONS</small></div>'+(bag.size?[...bag.keys()].map(id=>{const f=sku(id);return `<div class="receipt-row"><span>${esc(f.title)}<small>${esc(f.label)} · ${money(f.price)}</small></span><button data-remove="${esc(id)}">Remove</button></div>`;}).join('')+`<p class="receipt-total">SUBTOTAL <strong>${money([...bag.keys()].reduce((n,id)=>n+sku(id).price,0))}</strong></p><label class="newsletter-option"><input id="newsletter-opt-in" type="checkbox" ${newsletter?'checked':''}>Email me HFJ Ballard’s monthly newsletter with new stories, book news, and upcoming events. Optional; unsubscribe anytime.</label><button class="action" id="secure-checkout">Continue to secure checkout ↗</button><p>Use the email you want for My Library. Any applicable tax is shown at Stripe checkout.</p><p id="checkout-status" role="status" aria-live="polite"></p>`:'<p>Your book bag is empty.</p><button class="action" data-switch="store">Browse books</button>')+'</div></div>', 'immersive');
    body.querySelector('#newsletter-opt-in')?.addEventListener('change', e=>{newsletter=e.target.checked;requestId=crypto.randomUUID();});
    body.querySelector('#secure-checkout')?.addEventListener('click', async e=>{
      const button=e.currentTarget, status=body.querySelector('#checkout-status'); button.disabled=true; status.textContent='Opening secure checkout…';
      try {
        const r=await fetch('/.netlify/functions/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[...bag.keys()],requestId,newsletterOptIn:newsletter})});
        const result=await r.json(); if(!r.ok)throw new Error(result.error||'Checkout unavailable.');
        const url=new URL(result.url); if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Checkout unavailable.');
        location.assign(url.href);
      } catch(error){status.textContent=error.message;button.disabled=false;}
    });
  }
  function about() {
    show(title('Meet HFJ Ballard')+`<div class="real-about">${content.author.image?`<img src="${esc(content.author.image)}" alt="HFJ Ballard">`:''}<p>${esc(content.author.bio || 'Visit the main website to meet the author.')}</p><a href="/index.html#about">About the author on the regular site ↗</a><h3>From the writing desk</h3>${content.news.map(n=>`<article><h4>${esc(n.title)}</h4><p>${esc(n.text)}</p></article>`).join('')}<a href="/index.html#contact">Contact & newsletter signup ↗</a></div>`, 'immersive');
  }
  function artImage(p) { return `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">`; }
  function portfolio() {
    if(!content.portfolio.length) {show(title('The display wall')+'<p class="portfolio-empty">The gallery could not load. <a href="/portfolio.html">Open the portfolio on the regular site.</a></p>');return;}
    show(title('The display wall')+'<div class="wall-viewport" tabindex="0" role="region" aria-label="Portfolio wall. Arrow keys pan; Tab reaches each frame."><div class="wall-track">'+content.portfolio.map((p,i)=>`<button class="wall-frame frame-${i%3}" style="--frame-left:${80+i*370}px;--frame-top:${i%2?160:90}px" data-art="${i}" aria-label="View ${esc(p.title)}"><span class="frame-chain" aria-hidden="true"></span><span class="frame-mat">${artImage(p)}</span><span class="frame-plaque">${esc(p.title)}</span></button>`).join('')+'</div><div class="wall-vignette" aria-hidden="true"></div></div><div class="wall-controls"><div class="pan-buttons" role="group" aria-label="Pan gallery"><button data-pan="left" aria-label="Pan left">←</button><button data-pan="up" aria-label="Pan up">↑</button><button data-pan="down" aria-label="Pan down">↓</button><button data-pan="right" aria-label="Pan right">→</button></div><button class="action secondary" id="wall-overview">Overview</button><button class="action secondary" id="wall-closer">Step closer</button><a href="/portfolio.html">Regular portfolio</a></div>','immersive gallery-view');
    cleanup=BookshopScenes.wall(body.querySelector('.wall-viewport'),content.portfolio.length);
  }
  function artDetail(i) {const p=content.portfolio[i];if(p)show('<button class="back" data-back="portfolio">← Back to the wall</button>'+title(p.title)+`<div class="framed-detail">${artImage(p)}</div><p>${esc(p.description)}</p>`,'immersive');}
  async function myLibrary() {
    show(title('Your digital library')+'<p id="library-loading" role="status">Opening your library…</p>', 'immersive');
    try {
      if(!libraryNode){
        const r=await fetch('library-fragment.html');if(!r.ok)throw new Error();
        const html=await r.text(); libraryNode=document.createElement('div');libraryNode.className='real-library';libraryNode.innerHTML=html;
      }
      if(activePanel!=='library')return;
      body.querySelector('#library-loading')?.remove();body.append(libraryNode);
      if(!libraryInit)libraryInit=import('./library-session.js'); await libraryInit;
    } catch { if(activePanel==='library')body.innerHTML=title('Your library')+'<p>Please <a href="/distribution.html">open your secure library here</a> to sign in and download your books.</p>'; }
  }
  function magazine(){magazinePage=0;magazineHeld=false;
    show(label+title('The bathroom.')+'<p class="lede">A moment of peace. A peculiar little magazine. All the time in the world.</p><div class="bathroom-scene"><img class="bathroom-background" src="art/bathroom.svg" alt="From your seat: a warm tiled bathroom, green door, washbasin and towel. Bare knees are visible in the foreground."><div class="bathroom-caption">OCCUPIED · TAKE YOUR TIME</div><button id="pick-magazine" class="magazine-rack" aria-label="Pick up The Reading Room"><span class="rack-label">READING MATERIAL</span><span class="mini-magazine"><small>THE</small><strong>READING<br>ROOM</strong><i>☾</i><em>HFJ BALLARD<br>SHORT READS</em></span><span class="pick-hint">Pick up the magazine ↗</span></button><div id="magazine-holder"></div></div><p class="note">The character stays seated while you’re here. Pick up the magazine to read, then use the page corners, buttons, or ← → keys to turn pages. Close this view to stand up.</p>','immersive bathroom-view');
    const stage=body.querySelector('.bathroom-scene');stage.insertAdjacentHTML('beforeend',BookshopScenes.arm);const stopArm=BookshopScenes.shelf(stage,'#pick-magazine, .cover-open, .magazine-controls button'),stopPages=BookshopScenes.magazine(stage,()=>magazinePage,next=>{renderMagazine(next,false);body.querySelector('.magazine-controls button:not([disabled])')?.focus()},content.magazine.stories.length+1,magazineHTML);cleanup=()=>{stopArm();stopPages()};
  }
  function magazineHTML(page=magazinePage){const m=content.magazine;
    if(page===0)return `<div class="magazine-book magazine-closed"><div class="mag-cover"><small>THE AFTERHOURS BOOKSHOP PRESENTS</small><h3>${esc(m.title)}</h3><div class="cover-emblem">☾</div><p>Brief reads.<br>Extraordinary little worlds.</p><span>${esc(m.issue)}</span>${m.stories.length?'<button class="cover-open" data-page="1">Open the magazine →</button>':'<p>No magazine issue has been published yet.</p>'}${(m.readingLinks||[]).map(link=>`<a class="reading-room-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">Read ${esc(link.title)} ↗</a>`).join('')}</div></div>`;
    if(page>m.stories.length)return `<div class="magazine-book magazine-closed"><div class="mag-cover back-cover"><small>UNTIL NEXT TIME</small><h3>Some stories<br>are worth<br>sitting with.</h3><div class="cover-emblem">✦</div><p>End of this issue.</p><button class="cover-open" data-page="0">Read it again ↺</button></div></div>`;
    const illustration=page%2?'<svg viewBox="0 0 220 150"><path d="M65 143V29Q110-14 155 29V143Z" fill="#bba46c"/><path d="M74 141V35Q110 1 146 35V141Z" fill="#3c5843"/><path d="M84 135V39Q110 16 136 39V135Z" stroke="#93a17b" fill="none"/><path d="M83 79H138" stroke="#9d9668"/><circle cx="128" cy="101" r="3" fill="#cfb779"/><path d="M52 144H168" stroke="#baa471" stroke-width="3"/></svg>':'<svg viewBox="0 0 220 150"><ellipse cx="110" cy="124" rx="65" ry="9" fill="#263e2c" opacity=".5"/><ellipse cx="110" cy="116" rx="59" ry="8" fill="#b5b48c"/><path d="M64 62H143L138 100Q106 130 72 100Z" fill="#d7cb9f"/><path d="M141 69Q177 63 164 91Q156 104 140 99" stroke="#d7cb9f" stroke-width="9" fill="none"/><ellipse cx="104" cy="64" rx="39" ry="9" fill="#8c7955"/><ellipse cx="104" cy="63" rx="34" ry="6" fill="#5d5340"/><path d="M89 48Q78 35 93 24M108 46Q122 33 111 18M125 49Q137 39 129 30" stroke="#c5c09a" stroke-width="2" fill="none"/></svg>';
    const s=m.stories[page-1];return `<div class="magazine-book open-magazine"><div class="paper-page page-left"><span class="mag-running">THE READING ROOM</span><div class="mag-illustration ${page%2?'door-illustration':'tea-illustration'}" aria-hidden="true">${illustration}</div><span class="sample-label">${esc(s.length)}</span><h3>${esc(s.title)}</h3><p class="mag-intro">Stories from HFJ Ballard.</p><span class="page-number">${page*2-1}</span></div><div class="paper-page page-right"><span class="mag-running">SHORT STORIES FOR LONG SITS</span><div class="mag-story">${s.text.split('\n\n').map(p=>`<p>${esc(p)}</p>`).join('')}</div><span class="page-number">${page*2}</span><button class="page-corner" data-page="${page+1}" aria-label="Turn the page">↗</button></div></div>`;
  }
  function renderMagazine(next,animate=false){
    if(!magazineHeld)return;const prev=magazinePage,old=body.querySelector(next>prev?'.page-right':'.page-left')?.innerHTML;magazinePage=Math.max(0,Math.min(content.magazine.stories.length+1,next));
    const holder=body.querySelector('#magazine-holder');holder.innerHTML='<div class="magazine-on-lap">'+magazineHTML()+`<div class="magazine-controls"><button class="action secondary" data-page="${magazinePage-1}" ${magazinePage===0?'disabled':''}>← Previous page</button><span role="status">${magazinePage===0?'Front cover':magazinePage>content.magazine.stories.length?'Back cover':`Spread ${magazinePage} of ${content.magazine.stories.length}`}</span><button class="action secondary" data-page="${magazinePage+1}" ${(!content.magazine.stories.length||magazinePage>content.magazine.stories.length)?'disabled':''}>Next page →</button><button class="put-down" id="put-magazine">Put magazine down</button></div></div>`;
    if(animate&&old&&!reduced.matches){const book=holder.querySelector('.open-magazine');if(book){const leaf=document.createElement('div');leaf.className='paper-page turning-leaf '+(next>prev?'turn-forward':'turn-back');leaf.setAttribute('aria-hidden','true');leaf.innerHTML=old;leaf.querySelectorAll('button').forEach(b=>b.remove());book.append(leaf);leaf.addEventListener('animationend',()=>leaf.remove(),{once:true})}}
  }

  const views={store,checkout,about,portfolio,magazine,library:myLibrary};
  window.openPanel=id=>{
    if(!views[id])return;
    if(!dialog.open){returnFocus=document.activeElement; const menu=document.querySelector('#room-menu');if(menu.contains(returnFocus)){returnFocus=menu.querySelector('summary');menu.open=false;}}
    activePanel=id;bookshopGame.pause(true);bookshopGame.seat(id==='magazine');bookshopGame.lounge(id==='library');views[id]();
    if(!dialog.open)dialog.showModal();document.querySelector('#close-panel').focus();document.querySelector('#arrival').hidden=true;
  };
  document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>openPanel(b.dataset.panel)));
  document.querySelector('#close-panel').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{cleanup();cleanup=()=>{};bookshopGame.seat(false);bookshopGame.lounge(false);bookshopGame.pause(false);activePanel=null;magazineHeld=false;if(returnFocus?.isConnected){if(returnFocus.disabled)document.querySelector('#room').focus();else returnFocus.focus();}});
  dialog.addEventListener('keydown',e=>{
    if(activePanel==='magazine'&&magazineHeld&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();renderMagazine(magazinePage+(e.key==='ArrowRight'?1:-1),true);return;}
    if(e.key!=='Tab')return;const nodes=[...dialog.querySelectorAll('button:not([disabled]),a[href],summary,input:not([disabled]),[tabindex="0"]')].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);
    if(e.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!nodes.includes(document.activeElement))){e.preventDefault();first?.focus();}
  });
  body.addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;const d=button.dataset;
    if(d.switch){openPanel(d.switch);return;}if(d.book){const stage=body.querySelector('.shelf-stage');if(stage){if(stage.dataset.grabbing)return;stage.dataset.grabbing='true';button.classList.add('book-grabbed');stage.classList.add('grabbing');if(!reduced.matches)await new Promise(r=>setTimeout(r,320));if(!dialog.open||!stage.isConnected)return;}book(d.book);}if(d.back)views[d.back]();if(d.art!==undefined)artDetail(Number(d.art));
    if(d.add){const f=sku(d.add);if(f?.available){bag.set(f.id,true);persist();toast('Book set aside at the counter.');book(content.books.find(b=>b.formats.some(x=>x.id===f.id)).id);}}
    if(d.remove){bag.delete(d.remove);persist();checkout();}
    if(button.id==='pick-magazine'){magazineHeld=true;button.hidden=true;body.querySelector('.bathroom-scene').classList.add('magazine-held');renderMagazine(0);body.querySelector('.cover-open')?.focus();}
    if(d.page!==undefined)renderMagazine(Number(d.page),true);
    if(button.id==='put-magazine'){magazineHeld=false;body.querySelector('.bathroom-scene').classList.remove('magazine-held');body.querySelector('#magazine-holder').innerHTML='';const pick=body.querySelector('#pick-magazine');pick.hidden=false;pick.focus();}
  });
  if(content.loadWarnings)toast('Some content is unavailable. The regular-site links are available in each section.');
})();
