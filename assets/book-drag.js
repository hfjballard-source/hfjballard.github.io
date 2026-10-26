export const turnProgress=(distance,pageWidth)=>Math.max(0,Math.min(1,distance/(pageWidth*1.4)));
export const shouldComplete=(progress,distance,velocity)=>distance>=14&&(progress>=.28||(distance>=45&&velocity>.5));

export async function mountDragBook({reader,pairs,makeLeaf,renderPage,clonePaper,onChange,onError,isClosed,pageRatio}){
  let index=0,busy=false,destroyed=false,current,gesture,settleTimer,resizeFrame;
  const cache=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  reader.classList.add('bp-drag-reader');reader.tabIndex=0;reader.setAttribute('aria-label','Book preview. Drag the right page left to turn forward, or the left page right to go back. Arrow keys also turn pages.');
  function fit(){
    const width=Math.max(100,Math.min(reader.clientWidth-24,(reader.clientHeight-24)*pageRatio*2));
    reader.style.setProperty('--bp-book-width',width+'px');
    reader.classList.toggle('bp-native-zoom',(window.visualViewport?.scale||1)>1.05);
  }
  fit();const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(fit)});observer.observe(reader);window.visualViewport?.addEventListener('resize',fit);
  function alive(){return !destroyed&&!isClosed();}
  function discard(spread){spread?.remove();spread?.querySelectorAll('canvas').forEach(canvas=>{canvas.width=canvas.height=1});}
  function trim(){for(const[key,entry]of cache)if(Math.abs(key-index)>1){cache.delete(key);entry.promise.then(spread=>{if(spread!==current)discard(spread)}).catch(()=>{});}}
  function build(target){
    if(target<0||target>=pairs.length)return Promise.resolve(null);
    if(cache.has(target))return cache.get(target).promise;
    const entry={};cache.set(target,entry);
    entry.promise=(async()=>{
      const spread=document.createElement('div');spread.className='bp-spread bp-book bp-drag-book bp-preloading';spread.setAttribute('aria-hidden','true');
      for(const page of pairs[target])spread.append(await makeLeaf(page));
      if(!alive())return spread;
      reader.append(spread);await Promise.all([...spread.children].map(renderPage));spread.remove();spread.classList.remove('bp-preloading');spread.removeAttribute('aria-hidden');
      if(!alive())discard(spread);return spread;
    })();
    entry.promise.then(spread=>entry.spread=spread).catch(()=>cache.delete(target));return entry.promise;
  }
  function preload(){trim();for(const n of [index-1,index+1])if(n>=0&&n<pairs.length)build(n).catch(onError);}
  function announce(){onChange(index,pairs[index]);}
  function leaf(front,back,forward){
    const turn=document.createElement('div');turn.className='bp-turn bp-drag-leaf '+(forward?'bp-drag-forward':'bp-drag-backward');turn.setAttribute('aria-hidden','true');
    const faces=[];for(const paper of [front,back]){const side=document.createElement('div');side.className='bp-face '+(faces.length?'bp-back':'bp-front');if(paper)side.append(clonePaper(paper));turn.append(side);faces.push(side);}
    return {turn,back:faces[1]};
  }
  function paint(g,p){g.progress=p;g.turn.style.transform=`rotateY(${(g.forward?-1:1)*180*p}deg)`;g.turn.style.setProperty('--bp-drag-shade',String(Math.sin(Math.PI*p)*.22));}
  function cleanGesture(g){
    g.turn.remove();g.under?.remove();g.source.style.visibility='';reader.classList.remove('bp-is-dragging');
  }
  function installUnder(g,target){
    if(!alive()||gesture!==g)return;
    const under=document.createElement('div');under.className='bp-drag-underlay';under.setAttribute('aria-hidden','true');
    for(const page of [...target.children].slice(0,2))under.append(clonePaper(page));g.spread.prepend(under);g.under=under;
    g.back.replaceChildren(clonePaper(target.children[g.forward?0:1]));
  }
  async function settle(g,complete){
    if(gesture!==g||g.settling)return;g.settling=true;busy=true;
    try{
      const target=await g.targetPromise;if(!alive())return;
      const end=complete?1:0,duration=reduced.matches?0:Math.round(140+Math.abs(end-g.progress)*230);
      g.turn.style.transition=`transform ${duration}ms cubic-bezier(.2,.65,.25,1)`;paint(g,end);
      settleTimer=setTimeout(()=>{
        if(!alive())return;
        cleanGesture(g);gesture=null;
        if(complete){current.remove();current=target;reader.append(current);index=g.target;announce();}
        busy=false;preload();
      },duration+20);
    }catch(error){if(alive()){cleanGesture(g);gesture=null;busy=false;onError(error);}}
  }
  function start(event){
    if(!alive()||busy||gesture||!current||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0)||(window.visualViewport?.scale||1)>1.05)return;
    if(!event.target.closest('.bp-drag-book')||event.target.closest('.bp-preloading'))return;
    const box=current.getBoundingClientRect(),forward=event.clientX>=box.left+box.width/2,target=index+(forward?1:-1);
    if(target<0||target>=pairs.length)return;
    event.preventDefault();reader.focus({preventScroll:true});
    const prepared=cache.get(target)?.spread,parts=leaf(current.children[forward?1:0],prepared?.children[forward?0:1],forward);
    const g={pointer:event.pointerId,start:event.clientX,last:event.clientX,time:performance.now(),lastTime:performance.now(),distance:0,velocity:0,progress:0,forward,target,spread:current,...parts,targetPromise:build(target)};
    g.source=current.children[forward?1:0];gesture=g;busy=true;
    current.children[forward?1:0].style.visibility='hidden';current.append(g.turn);reader.classList.add('bp-is-dragging');
    if(prepared)installUnder(g,prepared);else g.targetPromise.then(spread=>installUnder(g,spread)).catch(onError);
    reader.setPointerCapture(event.pointerId);paint(g,0);
  }
  function move(event){
    const g=gesture;if(!g||g.settling||event.pointerId!==g.pointer)return;event.preventDefault();
    const now=performance.now(),step=g.forward?g.last-event.clientX:event.clientX-g.last;
    g.velocity=step/Math.max(1,now-g.lastTime);g.last=event.clientX;g.lastTime=now;
    g.distance=g.forward?g.start-event.clientX:event.clientX-g.start;
    paint(g,turnProgress(g.distance,g.spread.getBoundingClientRect().width/2));
  }
  function end(event,cancel=false){
    const g=gesture;if(!g||g.settling||event.pointerId!==g.pointer)return;
    const recent=performance.now()-g.lastTime<100?g.velocity:0;
    settle(g,!cancel&&shouldComplete(g.progress,g.distance,recent));
    if(reader.hasPointerCapture(event.pointerId))reader.releasePointerCapture(event.pointerId);
  }
  reader.addEventListener('pointerdown',start);reader.addEventListener('pointermove',move);
  const up=e=>end(e),cancel=e=>end(e,true);reader.addEventListener('pointerup',up);reader.addEventListener('pointercancel',cancel);reader.addEventListener('lostpointercapture',cancel);
  function abort(){if(gesture&&!gesture.settling)settle(gesture,false)}
  window.addEventListener('blur',abort);const visibility=()=>{if(document.hidden)abort()};document.addEventListener('visibilitychange',visibility);
  async function turn(direction){
    if(!alive()||busy||gesture)return;const target=index+direction;if(target<0||target>=pairs.length)return;busy=true;
    try{const spread=await build(target);if(!alive())return;
      const forward=direction>0,parts=leaf(current.children[forward?1:0],spread.children[forward?0:1],forward);
      const g={forward,target,spread:current,...parts,progress:0,targetPromise:Promise.resolve(spread),distance:100,source:current.children[forward?1:0]};gesture=g;busy=false;
      current.children[forward?1:0].style.visibility='hidden';current.append(g.turn);installUnder(g,spread);paint(g,0);
      requestAnimationFrame(()=>{if(alive()&&gesture===g)settle(g,true)});
    }catch(error){busy=false;if(alive())onError(error);}
  }
  current=await build(0);if(alive()){reader.append(current);announce();preload();}
  return {turn,destroy(){
    destroyed=true;clearTimeout(settleTimer);cancelAnimationFrame(resizeFrame);observer.disconnect();window.visualViewport?.removeEventListener('resize',fit);
    if(gesture&&Number.isInteger(gesture.pointer)&&reader.hasPointerCapture(gesture.pointer))reader.releasePointerCapture(gesture.pointer);
    reader.removeEventListener('pointerdown',start);reader.removeEventListener('pointermove',move);reader.removeEventListener('pointerup',up);reader.removeEventListener('pointercancel',cancel);reader.removeEventListener('lostpointercapture',cancel);window.removeEventListener('blur',abort);document.removeEventListener('visibilitychange',visibility);
    for(const entry of cache.values())entry.promise.then(discard).catch(()=>{});cache.clear();reader.replaceChildren();
  }};
}
