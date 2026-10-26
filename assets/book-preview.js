let manifestPromise,active;
export async function loadBookPreviews(){
  if(!manifestPromise)manifestPromise=fetch('/assets/book-previews.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Preview list unavailable');return r.json();});
  return manifestPromise;
}
function sampleURL(entry){
  if(!entry||entry.enabled===false||!entry.file)return null;
  try{const url=new URL(entry.file,location.origin);return url.origin===location.origin&&url.pathname.startsWith('/assets/previews/')&&url.pathname.endsWith('.pdf')?url.href:null;}catch{return null;}
}
export function previewSpreads(count,firstPage=1){
  if(!Number.isInteger(count)||count<1)return [];
  firstPage=Math.max(1,Math.min(count,Number.isInteger(firstPage)?firstPage:1));
  const pairs=[[null,firstPage]];for(let page=firstPage+1;page<=count;page+=2)pairs.push([page,page+1<=count?page+1:null]);return pairs;
}
function styles(){if(document.querySelector('[data-book-preview-style]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/book-preview.css?v=20261026';link.dataset.bookPreviewStyle='';document.head.append(link);}
export async function attachPreviewButton(parent,product,mode='scroll'){
  let entries;try{entries=await loadBookPreviews();}catch{return;}
  if(!parent.isConnected||!sampleURL(entries[product.id]))return;
  styles();const button=document.createElement('button');button.type='button';button.className='bp-open';button.textContent='Read a preview';button.setAttribute('aria-label',`Preview ${product.title}`);
  button.addEventListener('click',()=>openBookPreview(product,mode));parent.append(button);
}
export async function openBookPreview(product,mode='scroll'){
  if(active?.open)return;
  const entry=(await loadBookPreviews())[product.id],url=sampleURL(entry);if(!url||active?.open)return;
  styles();const before=document.activeElement,dialog=document.createElement('dialog');active=dialog;dialog.className='bp-dialog'+(mode==='book'?' bp-pixel':'');dialog.setAttribute('aria-label',`${product.title} preview`);
  dialog.innerHTML='<header class="bp-heading"><div><p>READ A LITTLE, WANDER A WHILE</p><h2></h2></div><button type="button" class="bp-close" aria-label="Close book preview">×</button></header><p class="bp-status" role="status">Opening the preview…</p><div class="bp-reader"></div><footer class="bp-controls"><button type="button" class="bp-prev">← Previous spread</button><span class="bp-position" aria-live="polite"></span><button type="button" class="bp-next">Next spread →</button><button type="button" class="bp-zoom" aria-pressed="false">Enlarge pages</button><a class="bp-pdf" target="_blank" rel="noopener">Open sample PDF ↗</a></footer>';
  dialog.querySelector('h2').textContent=product.title;dialog.querySelector('.bp-pdf').href=url;
  const reader=dialog.querySelector('.bp-reader'),message=dialog.querySelector('.bp-status'),prev=dialog.querySelector('.bp-prev'),next=dialog.querySelector('.bp-next'),position=dialog.querySelector('.bp-position');
  prev.hidden=next.hidden=mode!=='book';prev.disabled=next.disabled=true;
  let documentTask,pdf,observer,closed=false,busy=false,index=0,pairs=[],turnTimer,pageRatio=1;
  const tasks=new Set();
  function release(){closed=true;clearTimeout(turnTimer);observer?.disconnect();for(const task of tasks)task.cancel();tasks.clear();documentTask?.destroy().catch(()=>{});dialog.remove();if(active===dialog)active=null;if(before?.isConnected)before.focus();}
  dialog.addEventListener('close',release,{once:true});dialog.querySelector('.bp-close').onclick=()=>dialog.close();document.body.append(dialog);dialog.showModal();dialog.querySelector('.bp-close').focus();
  async function leaf(number){
    const figure=document.createElement('figure');figure.className='bp-page';figure.style.aspectRatio=String(pageRatio);
    if(!number){figure.classList.add('bp-blank');figure.setAttribute('aria-hidden','true');return figure;}
    figure.dataset.page=number;figure.setAttribute('aria-label',`Page ${number}`);
    const caption=document.createElement('figcaption');caption.textContent=`Page ${number}`;figure.append(caption);return figure;
  }
  async function render(figure){
    if(closed||figure.dataset.loaded||!figure.dataset.page)return;
    figure.dataset.loaded='yes';const generation=String(Number(figure.dataset.generation||0)+1);figure.dataset.generation=generation;
    try{
      const page=await pdf.getPage(Number(figure.dataset.page));if(closed||figure.dataset.generation!==generation)return;
      const viewport=page.getViewport({scale:1}),width=Math.max(150,Math.min(640,figure.getBoundingClientRect().width||400)),scale=width*Math.min(devicePixelRatio||1,2)/viewport.width;
      figure.style.aspectRatio=viewport.width+'/'+viewport.height;
      const canvas=document.createElement('canvas'),sized=page.getViewport({scale});canvas.width=Math.ceil(sized.width);canvas.height=Math.ceil(sized.height);canvas.setAttribute('aria-hidden','true');figure.prepend(canvas);
      const task=page.render({canvasContext:canvas.getContext('2d'),viewport:sized});tasks.add(task);
      try{await task.promise;}finally{tasks.delete(task);}
      if(closed||figure.dataset.generation!==generation)return;
      const text=await page.getTextContent();if(closed||figure.dataset.generation!==generation)return;const description=document.createElement('p');description.className='bp-sr';description.textContent=text.items.map(t=>t.str||'').join(' ');figure.append(description);
    }catch(error){if(!closed&&error.name!=='RenderingCancelledException'){const p=document.createElement('p');p.textContent='This page could not load. Use Open sample PDF below.';figure.append(p);}}
  }
  function control(){prev.disabled=busy||index===0;next.disabled=busy||index===pairs.length-1;position.textContent=index===0?`Opening · ${pdf.numPages}-page preview`:`Pages ${pairs[index].filter(Boolean).join('–')} of ${pdf.numPages}`;}
  function clonePaper(source){const clone=source.cloneNode(true);const from=source.querySelector('canvas'),to=clone.querySelector('canvas');if(from&&to)to.getContext('2d').drawImage(from,0,0);clone.querySelectorAll('.bp-sr,figcaption').forEach(n=>n.remove());return clone;}
  async function showSpread(target,animate=true){
    if(closed||busy||target<0||target>=pairs.length)return;busy=true;control();
    const old=reader.querySelector('.bp-spread'),previous=index;index=target;
    const spread=document.createElement('div');spread.className='bp-spread bp-book';for(const n of pairs[index])spread.append(await leaf(n));reader.append(spread);if(old)old.style.display='none';
    await Promise.all([...spread.children].map(render));if(closed)return;
    if(old&&animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const forward=index>previous,turn=document.createElement('div');turn.className='bp-turn '+(forward?'bp-forward':'bp-backward');turn.setAttribute('aria-hidden','true');
      for(const [paper,face]of [[old.children[forward?1:0],'bp-front'],[spread.children[forward?0:1],'bp-back']]){const side=document.createElement('div');side.className='bp-face '+face;side.append(clonePaper(paper));turn.append(side);}
      spread.append(turn);turnTimer=setTimeout(()=>{turn.remove();old.remove();busy=false;control();},540);
    }else{old?.remove();busy=false;control();}
  }
  prev.onclick=()=>showSpread(index-1);next.onclick=()=>showSpread(index+1);
  dialog.querySelector('.bp-zoom').onclick=event=>{
    if(busy)return;
    const enlarged=reader.classList.toggle('bp-enlarged');event.currentTarget.setAttribute('aria-pressed',String(enlarged));event.currentTarget.textContent=enlarged?'Fit pages':'Enlarge pages';
    for(const task of tasks)task.cancel();tasks.clear();
    reader.querySelectorAll('.bp-page[data-loaded]').forEach(figure=>{delete figure.dataset.loaded;figure.querySelectorAll('canvas,.bp-sr').forEach(node=>node.remove());render(figure);});
  };
  dialog.addEventListener('keydown',event=>{if(mode==='book'&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();showSpread(index+(event.key==='ArrowRight'?1:-1));}});
  let touch;reader.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touch={x:e.clientX,y:e.clientY};});
  reader.addEventListener('pointerup',e=>{if(mode==='book'&&!reader.classList.contains('bp-enlarged')&&touch){const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.abs(dx)>50&&Math.abs(dy)<70)showSpread(index+(dx<0?1:-1));}});reader.addEventListener('pointercancel',()=>touch=null);
  try{
    const lib=await import('/assets/vendor/pdfjs-6.4.299/pdf.min.mjs');if(closed)return;lib.GlobalWorkerOptions.workerSrc='/assets/vendor/pdfjs-6.4.299/pdf.worker.min.mjs';
    documentTask=lib.getDocument({url,isEvalSupported:false,iccUrl:'/assets/vendor/pdfjs-6.4.299/iccs/',standardFontDataUrl:'/assets/vendor/pdfjs-6.4.299/standard_fonts/',wasmUrl:'/assets/vendor/pdfjs-6.4.299/wasm/'});
    pdf=await documentTask.promise;if(closed)return;pairs=previewSpreads(pdf.numPages,entry.firstPage||1);const firstView=(await pdf.getPage(pairs[0][1])).getViewport({scale:1});pageRatio=firstView.width/firstView.height;message.textContent='The first '+pdf.numPages+' pages. '+(mode==='book'?'Turn pages with the buttons, arrow keys, or a swipe.':'Scroll through the two-page spreads.');
    if(mode==='book'){
      const fit=()=>reader.style.setProperty('--bp-book-width',Math.max(120,Math.min(reader.clientWidth-24,(reader.clientHeight-48)*pageRatio*2))+'px');
      fit();observer=new ResizeObserver(fit);observer.observe(reader);await showSpread(0,false);
    }
    else{
      position.textContent=`${pdf.numPages}-page preview`;
      observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.querySelectorAll('.bp-page').forEach(render);observer.unobserve(entry.target);}},{root:reader,rootMargin:'400px'});
      for(const pair of pairs){const spread=document.createElement('div');spread.className='bp-spread';for(const n of pair)spread.append(await leaf(n));if(closed)return;reader.append(spread);observer.observe(spread);}
    }
  }catch(error){if(!closed){message.textContent='This sample could not open. Try Open sample PDF below, or come back shortly.';message.classList.add('bp-error');}}
}
