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
  let magazineSpreads=[],magazineCompact=false,magazineLayoutKey="";
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
  let authorTree={};
  try {const response=await fetch('author-dialogue.json');if(response.ok)authorTree=await response.json();} catch {}
  function about(nodeId='welcome') {
    const node=authorTree[nodeId]||authorTree.welcome||{text:'Welcome. What would you like to explore?',choices:[]};
    let reply=node.text||'';
    if(node.source==='bio')reply=content.author.bio;
    if(node.source==='books')reply=content.books.map(b=>b.title).join('\n');
    if(node.source==='news')reply=content.news.map(n=>n.title+' — '+n.text).join('\n\n');
    show(title('A conversation with HFJ Ballard')+`<div class="retro-conversation"><img class="dialogue-portrait" src="art/author-pixel.png" alt="Pixel portrait of HFJ Ballard"><div class="retro-dialogue"><p class="dialogue-speaker">HFJ BALLARD</p><p class="dialogue-reply" tabindex="-1" role="status">${esc(reply)}</p><div class="dialogue-choices" role="group" aria-label="Questions to ask">${(node.choices||[]).map(c=>`<button ${c.next?`data-talk="${esc(c.next)}"`:`data-switch="${esc(c.action)}"`}>▸ ${esc(c.question)}</button>`).join('')}<button id="ask-sign-book">✎ Would you sign my book?</button>${nodeId==='welcome'?'':'<button data-talk="welcome">↩ May I ask something else?</button>'}</div></div></div>`,'immersive conversation-view');
    if(nodeId!=='welcome')body.querySelector('.dialogue-reply').focus();
  }
  async function signing() {
    show(title('A signature for your bookshelf')+'<p id="signing-status" role="status">Finding your purchased books…</p><div id="signing-books"></div><button data-talk="welcome" class="back">← Back to our conversation</button>','immersive');
    const status=body.querySelector('#signing-status'),list=body.querySelector('#signing-books');
    const token=sessionStorage.getItem('hfj-library-token');
    if(!token){status.textContent='Please verify your library email first, then return to ask for a signature.';list.innerHTML='<button class="action" data-switch="library">Open My Library</button>';return;}
    try {
      const r=await fetch('/.netlify/functions/sign-book',{headers:{Authorization:`Bearer ${token}`}}),data=await r.json();
      if(!r.ok)throw new Error(data.error||'Signing is unavailable.');
      if(!status.isConnected)return;
      status.textContent=data.items.length?'Choose a purchased edition. Preview pages are clearly labeled and will be replaced with the author’s signed pages later.':'No purchased books are linked to this library email yet.';
      const nameLabel=document.createElement('label');nameLabel.textContent='Name for the dedication (optional)';const nameInput=document.createElement('input');nameInput.id='dedication-name';nameInput.type='text';nameInput.maxLength=60;nameInput.autocomplete='off';nameLabel.append(nameInput);list.before(nameLabel);
      list.innerHTML=data.items.map(item=>`<div class="signing-book"><strong>${esc(item.title)}</strong><span>${esc(item.format)}</span><button class="action" data-sign="${esc(item.sku)}" ${item.signed||!item.available?'disabled':''}>${item.signed?(item.preview?'Preview already in library':'Already signed'):item.available?(item.preview?'Try the placeholder signed page':'Please sign this book'):'Signed edition not available yet'}</button></div>`).join('');
    }catch(error){status.textContent=error.message;list.innerHTML='<button class="action" data-switch="library">Verify my library email</button>';}
  }
  async function signBook(sku,button) {
    button.disabled=true;const token=sessionStorage.getItem('hfj-library-token');
    try {
      const r=await fetch('/.netlify/functions/sign-book',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({sku,name:body.querySelector('#dedication-name')?.value||''})}),data=await r.json();
      if(!r.ok)throw new Error(data.error||'Signing is unavailable.');
      if(!button.isConnected)return;
      body.querySelector('#signing-status').textContent=data.preview?`Your personalized preview of ${data.title} is waiting in My Library. Its first page is a placeholder, not an autograph.`:`There you are. Your signed edition of ${data.title} is waiting in My Library.`;
      button.textContent=data.preview?'Preview ready in My Library':'Signed — ready in My Library';
      const link=document.createElement('button');link.className='action';link.dataset.switch='library';link.textContent='Open My Library';body.querySelector('#signing-books').append(link);
    }catch(error){toast(error.message);button.disabled=false;}
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
      const alreadyInitialized=!!libraryInit;if(!libraryInit)libraryInit=import('./library-session.js');await libraryInit;if(alreadyInitialized&&sessionStorage.getItem('hfj-library-token'))libraryNode.querySelector('#refresh')?.click();
    } catch { if(activePanel==='library')body.innerHTML=title('Your library')+'<p>Please <a href="/distribution.html">open your secure library here</a> to sign in and download your books.</p>'; }
  }
  function magazine(){magazinePage=0;magazineHeld=false;magazineSpreads=[];magazineLayoutKey="";
    show(label+title('The bathroom.')+'<p class="lede">A moment of peace. A peculiar little magazine. All the time in the world.</p><div class="bathroom-scene"><img class="bathroom-background" src="art/bathroom.svg" alt="From your seat: a warm tiled bathroom, green door, washbasin and towel. Bare knees are visible in the foreground."><div class="bathroom-caption">OCCUPIED · TAKE YOUR TIME</div><button id="pick-magazine" class="magazine-rack" aria-label="Pick up The Reading Room"><span class="rack-label">READING MATERIAL</span><span class="mini-magazine"><small>THE</small><strong>READING<br>ROOM</strong><i>☾</i><em>HFJ BALLARD<br>SHORT READS</em></span><span class="pick-hint">Pick up the magazine ↗</span></button><div id="magazine-holder"></div></div><p class="note">The character stays seated while you’re here. Pick up the magazine to read, then use the page corners, buttons, or ← → keys to turn pages. Close this view to stand up.</p>','immersive bathroom-view');
    const stage=body.querySelector('.bathroom-scene');stage.insertAdjacentHTML('beforeend',BookshopScenes.arm);
    const stopArm=BookshopScenes.shelf(stage,'#pick-magazine, .cover-open, .magazine-controls button'),stopPages=BookshopScenes.magazine(stage,()=>magazinePage,next=>{renderMagazine(next,false);body.querySelector('.magazine-controls button:not([disabled])')?.focus()},()=>magazineSpreads.length+1,magazineHTML);
    let reflowTimer=0;
    const reflow=()=>{clearTimeout(reflowTimer);reflowTimer=setTimeout(()=>{if(magazineHeld&&dialog.open)refreshMagazineLayout()},100)};
    const observer=new ResizeObserver(reflow);observer.observe(stage);window.addEventListener('resize',reflow);window.visualViewport?.addEventListener('resize',reflow);
    document.fonts?.ready.then(()=>{if(stage.isConnected&&magazineHeld){magazineLayoutKey='';reflow()}});
    cleanup=()=>{clearTimeout(reflowTimer);observer.disconnect();window.removeEventListener('resize',reflow);window.visualViewport?.removeEventListener('resize',reflow);stopArm();stopPages();dialog.classList.remove('magazine-reading')};
  }
  function storyTextHTML(text){return String(text).split(/\n[ \t]*\n/).map(p=>`<p>${esc(p)}</p>`).join('')}
  function textLeaf(story,text,number,side='left',chunk=null){return `<div class="paper-page page-${side}" ${chunk?`data-story-index="${chunk.storyIndex}" data-start="${chunk.start}" data-end="${chunk.end}"`:''}><span class="mag-running">${esc(content.magazine.title)} · ${esc(content.magazine.issue)}</span><h3 class="mag-page-title" title="${esc(story.title)}">${esc(story.title)}</h3><div class="mag-story">${storyTextHTML(text)}</div><span class="page-number">${number}</span><button class="page-corner" data-page="${magazinePage+1}" aria-label="Turn the page">↗</button></div>`}
  function refreshMagazineLayout(){
    if(!magazineHeld)return;
    const stage=body.querySelector('.bathroom-scene');if(!stage)return;
    magazineCompact=matchMedia('(max-width:720px)').matches;
    const encounter=dialog.querySelector('.encounter-panel-controls'),reserved=encounter&&!encounter.hidden?encounter.offsetHeight:0;
    const height=Math.max(200,Math.min(560,Math.floor((window.visualViewport?.height||innerHeight)-(magazineCompact?180:160)-reserved)));
    const css=getComputedStyle(stage),width=Math.max(160,stage.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)),leafWidth=magazineCompact?width:width/2;
    const key=[Math.round(width),height,magazineCompact].join(':');if(key===magazineLayoutKey)return;
    const anchor=magazineSpreads[magazinePage-1]?.find(p=>p.kind==='text'),wasBack=magazineSpreads.length&&magazinePage>magazineSpreads.length,wasCover=magazinePage===0;
    dialog.style.setProperty('--mag-leaf-height',height+'px');
    const measure=document.createElement('div');measure.className='magazine-measure';measure.style.width=leafWidth+'px';measure.style.setProperty('--mag-leaf-height',height+'px');measure.setAttribute('aria-hidden','true');document.body.append(measure);
    let lastStory=null,area;
    try{
      magazineSpreads=BookshopMagazinePages.spreads(content.magazine.stories,(story,text)=>{
        if(story!==lastStory){measure.innerHTML='<div class="magazine-book open-magazine paged-magazine">'+textLeaf(story,'',0)+'</div>';lastStory=story;area=measure.querySelector('.mag-story')}
        area.innerHTML=storyTextHTML(text);return area.scrollHeight<=area.clientHeight;
      },magazineCompact);
      magazineLayoutKey=key;
      magazinePage=wasCover?0:wasBack?magazineSpreads.length+1:BookshopMagazinePages.locate(magazineSpreads,anchor)||1;
    }finally{measure.remove()}
    renderMagazine(magazinePage,false);
  }

  function magazineHTML(page=magazinePage){const m=content.magazine;
    if(page===0)return `<div class="magazine-book magazine-closed"><div class="mag-cover"><small>THE AFTERHOURS BOOKSHOP PRESENTS</small><h3>${esc(m.title)}</h3><div class="cover-emblem">☾</div><p>Brief reads.<br>Extraordinary little worlds.</p><span>${esc(m.issue)}</span>${magazineSpreads.length?'<button class="cover-open" data-page="1">Open the magazine →</button>':'<p>No magazine issue has been published yet.</p>'}${(m.readingLinks||[]).map(link=>`<a class="reading-room-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">Read ${esc(link.title)} ↗</a>`).join('')}</div></div>`;
    if(page>magazineSpreads.length)return `<div class="magazine-book magazine-closed"><div class="mag-cover back-cover"><small>UNTIL NEXT TIME</small><h3>Some stories<br>are worth<br>sitting with.</h3><div class="cover-emblem">✦</div><p>End of this issue.</p><button class="cover-open" data-page="0">Read it again ↺</button></div></div>`;
    const illustration=page%2?'<svg viewBox="0 0 220 150"><path d="M65 143V29Q110-14 155 29V143Z" fill="#bba46c"/><path d="M74 141V35Q110 1 146 35V141Z" fill="#3c5843"/><path d="M84 135V39Q110 16 136 39V135Z" stroke="#93a17b" fill="none"/><path d="M83 79H138" stroke="#9d9668"/><circle cx="128" cy="101" r="3" fill="#cfb779"/><path d="M52 144H168" stroke="#baa471" stroke-width="3"/></svg>':'<svg viewBox="0 0 220 150"><ellipse cx="110" cy="124" rx="65" ry="9" fill="#263e2c" opacity=".5"/><ellipse cx="110" cy="116" rx="59" ry="8" fill="#b5b48c"/><path d="M64 62H143L138 100Q106 130 72 100Z" fill="#d7cb9f"/><path d="M141 69Q177 63 164 91Q156 104 140 99" stroke="#d7cb9f" stroke-width="9" fill="none"/><ellipse cx="104" cy="64" rx="39" ry="9" fill="#8c7955"/><ellipse cx="104" cy="63" rx="34" ry="6" fill="#5d5340"/><path d="M89 48Q78 35 93 24M108 46Q122 33 111 18M125 49Q137 39 129 30" stroke="#c5c09a" stroke-width="2" fill="none"/></svg>';
    const pair=magazineSpreads[page-1];
    return `<div class="magazine-book open-magazine paged-magazine ${magazineCompact?'magazine-single':''}">`+pair.map((leaf,index)=>{
      const number=magazineCompact?page:(page-1)*2+index+1,side=index===0?'left':'right';
      if(leaf.kind==='text')return textLeaf(leaf.story,leaf.text,number,side,leaf);
      if(leaf.kind==='blank')return `<div class="paper-page page-${side} mag-empty"><p>End of this story.</p><span class="page-number">${number}</span><button class="page-corner" data-page="${page+1}" aria-label="Turn the page">↗</button></div>`;
      return `<div class="paper-page page-left mag-opening"><span class="mag-running">THE READING ROOM</span><div class="mag-illustration" aria-hidden="true">${illustration}</div><span class="sample-label">${esc(leaf.story.length||'A short story')}</span><h3>${esc(leaf.story.title)}</h3><p class="mag-intro">Stories from HFJ Ballard.</p><span class="page-number">${number}</span></div>`;
    }).join('')+'</div>';
  }

  function renderMagazine(next,animate=false){
    if(!magazineHeld)return;const prev=magazinePage,old=body.querySelector(next>prev?'.page-right':'.page-left')?.innerHTML;magazinePage=Math.max(0,Math.min(magazineSpreads.length+1,next));
    const holder=body.querySelector('#magazine-holder');holder.innerHTML='<div class="magazine-on-lap">'+magazineHTML()+`<div class="magazine-controls"><button class="action secondary" data-page="${magazinePage-1}" ${magazinePage===0?'disabled':''}>← Previous page</button><span role="status">${magazinePage===0?'Front cover':magazinePage>magazineSpreads.length?'Back cover':`${magazineCompact?"Page":"Spread"} ${magazinePage} of ${magazineSpreads.length}`}</span><button class="action secondary" data-page="${magazinePage+1}" ${(!magazineSpreads.length||magazinePage>magazineSpreads.length)?'disabled':''}>Next page →</button><button class="put-down" id="put-magazine">Put magazine down</button></div></div>`;
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
    if(d.talk){about(d.talk);return;}if(button.id==='ask-sign-book'){signing();return;}if(d.sign){signBook(d.sign,button);return;}if(d.switch){openPanel(d.switch);return;}if(d.book){const stage=body.querySelector('.shelf-stage');if(stage){if(stage.dataset.grabbing)return;stage.dataset.grabbing='true';button.classList.add('book-grabbed');stage.classList.add('grabbing');if(!reduced.matches)await new Promise(r=>setTimeout(r,320));if(!dialog.open||!stage.isConnected)return;}book(d.book);}if(d.back)views[d.back]();if(d.art!==undefined)artDetail(Number(d.art));
    if(d.add){const f=sku(d.add);if(f?.available){bag.set(f.id,true);persist();toast('Book set aside at the counter.');book(content.books.find(b=>b.formats.some(x=>x.id===f.id)).id);}}
    if(d.remove){bag.delete(d.remove);persist();checkout();}
    if(button.id==='pick-magazine'){magazineHeld=true;button.hidden=true;body.querySelector('.bathroom-scene').classList.add('magazine-held');dialog.classList.add('magazine-reading');refreshMagazineLayout();body.querySelector('.cover-open')?.focus();}
    if(d.page!==undefined)renderMagazine(Number(d.page),true);
    if(button.id==='put-magazine'){magazineHeld=false;dialog.classList.remove('magazine-reading');magazineLayoutKey='';body.querySelector('.bathroom-scene').classList.remove('magazine-held');body.querySelector('#magazine-holder').innerHTML='';const pick=body.querySelector('#pick-magazine');pick.hidden=false;pick.focus();}
  });
  if(content.loadWarnings)toast('Some content is unavailable. The regular-site links are available in each section.');
})();
