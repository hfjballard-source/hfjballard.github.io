/* Small, self-contained controls for the illustrated close-up scenes. */
window.BookshopScenes = (()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const arm=`<div class="shelf-arm" aria-hidden="true"><div class="coat-sleeve"></div><svg class="reaching-hand" viewBox="0 0 80 100" shape-rendering="crispEdges"><path d="M20 100V65L14 56V40H22V54L27 60V20H35V46H38V10H46V45H49V16H57V49H60V28H68V68L60 80V100Z" fill="#c69b74"/><path d="M25 90V67L31 60V29H34V65H39V19H44V64H50V25H55V65H61V39H65V69L56 82V98Z" fill="#dbb38b"/><path d="M26 89H57V100H26Z" fill="#a77957"/><path d="M19 92H63V100H19Z" fill="#d9cdaa"/></svg></div>`;
  function shelf(stage,selector='.book-button'){const arm=stage.querySelector('.shelf-arm');
    function aim(x,y){const r=stage.getBoundingClientRect(),dx=x-r.left-r.width/2,dy=r.height+70-(y-r.top);arm.style.height=Math.hypot(dx,dy)+'px';arm.style.transform=`rotate(${Math.atan2(dx,dy)*180/Math.PI}deg)`;stage.classList.add('hand-visible')}
    const rest=()=>{const book=stage.classList.contains('magazine-held')?stage.querySelector('.magazine-book'):null,r=book?book.getBoundingClientRect():stage.getBoundingClientRect();aim(r.left+r.width*(book?.88:.72),r.top+r.height*(book?.9:.78))};
    const pointer=e=>{if(e.pointerType==='mouse')aim(e.clientX,e.clientY)},down=e=>aim(e.clientX,e.clientY),focus=e=>{const b=e.target.closest(selector);if(b){if(stage.classList.contains('magazine-held')&&b.closest('.magazine-controls')){rest();return}const r=b.getBoundingClientRect();aim(r.x+r.width/2,r.y+r.height*.35)}},leave=()=>{if(stage.classList.contains('bathroom-scene'))rest();else stage.classList.remove('hand-visible')};
    stage.addEventListener('pointermove',pointer);stage.addEventListener('pointerdown',down);stage.addEventListener('focusin',focus);stage.addEventListener('pointerleave',leave);
    const initialFrame=stage.classList.contains('bathroom-scene')?requestAnimationFrame(rest):0;
    return ()=>{cancelAnimationFrame(initialFrame);stage.removeEventListener('pointermove',pointer);stage.removeEventListener('pointerdown',down);stage.removeEventListener('focusin',focus);stage.removeEventListener('pointerleave',leave)};
  }
  function wall(viewport,count){const track=viewport.querySelector('.wall-track'),panel=viewport.closest('#panel-body'),keyTarget=viewport.closest('dialog'),pressed=new Set();
    let raf=0,last=performance.now(),px=0,py=0,pointerZoom=null,x=0,y=0,zoom=.92,targetZoom=.92,phase=0;
    const width=Math.max(1120,count*370+110);track.style.width=width+'px';
    function bounds(){x=Math.max(0,Math.min(x,Math.max(0,width*zoom-viewport.clientWidth)));y=Math.max(0,Math.min(y,Math.max(0,600*zoom-viewport.clientHeight)))}
    function frame(now){const dt=Math.min((now-last)/1000,.04);last=now;const dx=(pressed.has('right')?1:0)-(pressed.has('left')?1:0)+px,dy=(pressed.has('down')?1:0)-(pressed.has('up')?1:0)+py;const oldX=x,oldY=y;x+=dx*230*dt;y+=dy*160*dt;const desired=pointerZoom??targetZoom;zoom=reduced.matches?desired:zoom+(desired-zoom)*Math.min(1,dt*7);bounds();const walking=Math.abs(x-oldX)+Math.abs(y-oldY)>.2;if(walking)phase+=dt*12;const bob=walking&&!reduced.matches?Math.sin(phase)*3:0;track.style.transform=`translate(${-x}px,${-y+bob}px) scale(${zoom})`;viewport.dataset.camera=`${Math.round(x)},${Math.round(y)},${zoom.toFixed(2)}`;raf=requestAnimationFrame(frame)}
    const pointer=e=>{if(e.pointerType!=='mouse')return;const r=viewport.getBoundingClientRect(),nx=(e.clientX-r.x)/r.width,ny=(e.clientY-r.y)/r.height;px=nx<.2?-(.2-nx)*5:nx>.8?(nx-.8)*5:0;py=ny<.15?-.4:ny>.85?.4:0;pointerZoom=ny<.22?Math.max(.5,Math.min(.92,(viewport.clientWidth/width)+.08)):null};
    const reset=()=>{px=py=0;pointerZoom=null;pressed.clear()},keyDown=e=>{if(!e.key.startsWith('Arrow')||e.altKey||e.metaKey||e.ctrlKey)return;e.preventDefault();px=py=0;pointerZoom=null;pressed.add(e.key.slice(5).toLowerCase())},keyUp=e=>pressed.delete(e.key.slice(5).toLowerCase());
    viewport.addEventListener('pointermove',pointer);viewport.addEventListener('pointerleave',reset);keyTarget.addEventListener('keydown',keyDown);keyTarget.addEventListener('keyup',keyUp);window.addEventListener('blur',reset);
    const overview=()=>{px=py=0;pointerZoom=null;targetZoom=Math.min(.92,(viewport.clientWidth-24)/width,(viewport.clientHeight-16)/600);x=y=0},closer=()=>{pointerZoom=null;targetZoom=Math.min(1.25,targetZoom+.18)};
    panel.querySelector('#wall-overview').addEventListener('click',overview);panel.querySelector('#wall-closer').addEventListener('click',closer);
    const panStops=[];panel.querySelectorAll('[data-pan]').forEach(b=>{const down=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);pointerZoom=null;px=py=0;pressed.add(b.dataset.pan)},up=()=>pressed.delete(b.dataset.pan),click=e=>{if(e.detail===0){const d=b.dataset.pan;x+=d==='right'?90:d==='left'?-90:0;y+=d==='down'?65:d==='up'?-65:0}};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);b.addEventListener('click',click);panStops.push(()=>{b.removeEventListener('pointerdown',down);b.removeEventListener('pointerup',up);b.removeEventListener('pointercancel',up);b.removeEventListener('lostpointercapture',up);b.removeEventListener('click',click)})});
    const focus=e=>{const b=e.target.closest('.wall-frame');if(!b)return;px=py=0;pointerZoom=null;x=Math.max(0,(parseInt(b.style.getPropertyValue('--frame-left'))+150)*zoom-viewport.clientWidth/2);bounds()};viewport.addEventListener('focusin',focus);
    raf=requestAnimationFrame(frame);
    return ()=>{cancelAnimationFrame(raf);reset();viewport.removeEventListener('pointermove',pointer);viewport.removeEventListener('pointerleave',reset);viewport.removeEventListener('focusin',focus);keyTarget.removeEventListener('keydown',keyDown);keyTarget.removeEventListener('keyup',keyUp);window.removeEventListener('blur',reset);panStops.forEach(stop=>stop())};
  }
  function magazine(stage,getPage,turn,maxPage,preview){
    let drag=null,settling=false;const timers=new Set();
    const later=(fn,ms)=>{const timer=setTimeout(()=>{timers.delete(timer);fn()},ms);timers.add(timer)};
    function discard(){if(!drag)return;drag.leaf?.remove();drag.underlay?.remove();drag.book.classList.remove('page-dragging');drag=null;stage.classList.remove('dragging-page')}
    function down(e){const book=e.target.closest('.magazine-book');if(!book||drag||settling||!e.isPrimary||e.button!==0||e.target.closest('button,a'))return;
      const r=book.getBoundingClientRect(),page=getPage();const direction=page===0?1:page===maxPage?-1:(e.clientX>r.x+r.width/2?1:-1);
      drag={book,id:e.pointerId,start:e.clientX,width:r.width,direction,page,progress:0,leaf:null};book.setPointerCapture(e.pointerId);
    }
    function move(e){if(!drag||drag.id!==e.pointerId)return;const distance=(drag.start-e.clientX)*drag.direction;
      if(!drag.leaf&&distance<8)return;e.preventDefault();
      if(!drag.leaf){const source=drag.book.querySelector(drag.direction===1?'.page-right':'.page-left')||drag.book.querySelector('.mag-cover');
        const leaf=source.cloneNode(true);leaf.removeAttribute('id');leaf.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));leaf.querySelectorAll('button').forEach(b=>b.remove());leaf.setAttribute('aria-hidden','true');leaf.className='paper-page drag-leaf '+(drag.direction===1?'drag-forward':'drag-back')+(drag.book.classList.contains('magazine-closed')?' drag-cover':'');
        if(preview&&drag.book.classList.contains('open-magazine')){const underlay=document.createElement('div');underlay.className='drag-underlay';underlay.setAttribute('aria-hidden','true');underlay.innerHTML=preview(Math.max(0,Math.min(maxPage,drag.page+drag.direction)));underlay.querySelectorAll('button').forEach(b=>b.remove());drag.book.append(underlay);drag.underlay=underlay}
        drag.book.append(leaf);drag.leaf=leaf;drag.book.classList.add('page-dragging');stage.classList.add('dragging-page');}
      drag.progress=Math.max(0,Math.min(1,distance/(drag.width*.6)));drag.leaf.style.transform=`rotateY(${-drag.direction*drag.progress*170}deg)`;drag.leaf.style.filter=`brightness(${1-drag.progress*.25})`;
    }
    function up(e){if(!drag||drag.id!==e.pointerId)return;const gesture=drag;drag=null;gesture.book.classList.remove('page-dragging');stage.classList.remove('dragging-page');if(gesture.book.hasPointerCapture(e.pointerId))gesture.book.releasePointerCapture(e.pointerId);if(!gesture.leaf)return;
      const commit=gesture.progress>.28,next=gesture.page+gesture.direction;
      settling=true;const finish=()=>{settling=false;gesture.leaf.remove();gesture.underlay?.remove();if(commit&&getPage()===gesture.page&&stage.isConnected&&stage.closest('dialog')?.open)turn(Math.max(0,Math.min(maxPage,next)))};
      if(reduced.matches){finish();return}gesture.leaf.style.transition='transform 160ms ease-out';gesture.leaf.style.transform=`rotateY(${commit?-gesture.direction*179:0}deg)`;later(finish,170);
    }
    const cancel=e=>{if(drag?.id===e.pointerId)discard()};
    stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',cancel);stage.addEventListener('lostpointercapture',cancel);
    return ()=>{discard();timers.forEach(clearTimeout);stage.querySelectorAll('.drag-leaf,.drag-underlay').forEach(el=>el.remove());stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',cancel);stage.removeEventListener('lostpointercapture',cancel)};
  }
  return {arm,shelf,wall,magazine};
})();
