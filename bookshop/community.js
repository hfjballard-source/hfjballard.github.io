(() => {
  'use strict';
  const game=bookshopGame,form=document.querySelector('#fan-speech-form'),input=document.querySelector('#fan-speech-input'),send=document.querySelector('#fan-send'),counter=document.querySelector('#fan-count'),hud=document.querySelector('#fan-hud'),status=document.querySelector('#fan-status'),waiting=document.querySelector('#fan-waiting'),active=document.querySelector('#fan-active'),endCard=document.querySelector('#fan-ended'),endText=document.querySelector('#fan-ended-text'),selfBubble=document.querySelector('#speech-self'),peerBubble=document.querySelector('#speech-peer');
  let muted=false,savedPosition=null,cooldown=0,selfTimer,peerTimer,cooldownTimer,animation=0;
  const deadlines=new WeakMap();
  // Modal dialogs make outside controls inert, so keep leave/mute available inside too.
  const panelControls=document.createElement('div');panelControls.className='encounter-panel-controls';panelControls.hidden=true;
  const panelLeave=document.createElement('button');panelLeave.type='button';panelLeave.textContent='Leave encounter';
  const panelMute=document.createElement('button');panelMute.type='button';panelMute.textContent='Mute reader';panelMute.setAttribute('aria-pressed','false');
  panelControls.append(panelLeave,panelMute);document.querySelector('#panel').prepend(panelControls);
  panelLeave.addEventListener('click',()=>document.querySelector('#fan-leave').click());
  panelMute.addEventListener('click',()=>document.querySelector('#fan-mute').click());

  const online=true;
  document.querySelector('.fan-mode').textContent='TWO READERS · PRIVATE ROOM';
  document.querySelector('.fan-waiting-note').textContent='Waiting for someone else to choose “Meet a fellow fan.” You can cancel at any time.';
  function clearBubble(el,which){clearTimeout(which==='self'?selfTimer:peerTimer);deadlines.delete(el);el.hidden=true;el.textContent=''}
  function bubble(el,text,ttl,which){clearBubble(el,which);deadlines.set(el,Date.now()+ttl);el.textContent=text;el.hidden=false;layoutBubbles();const timer=setTimeout(()=>clearBubble(el,which),ttl);if(which==='self')selfTimer=timer;else peerTimer=timer}
  function clearSpeech(){clearBubble(selfBubble,'self');clearBubble(peerBubble,'peer');input.value='';counter.textContent='0 / 100';clearTimeout(cooldownTimer);cooldown=0;send.disabled=false;send.textContent='Send';game.typing(false)}
  function layoutBubbles(){
    if(!selfBubble.hidden&&Date.now()>=(deadlines.get(selfBubble)||0))clearBubble(selfBubble,'self');
    if(!peerBubble.hidden&&Date.now()>=(deadlines.get(peerBubble)||0))clearBubble(peerBubble,'peer');
    if(selfBubble.hidden&&peerBubble.hidden)return;
    const poses=game.encounterPositions(),r=document.querySelector('#room-wrap').getBoundingClientRect(),boxes=[];
    for(const [el,p,other] of [[selfBubble,poses.self,poses.peer],[peerBubble,poses.peer,poses.self]]){
      if(!p||el.hidden)continue;const w=el.offsetWidth,h=el.offsetHeight,onLeft=other?p.x<other.x||(p.x===other.x&&game.coat==='#537961'):true;
      const px=r.left+p.x/480*r.width,py=r.top+(p.y-30)/300*r.height;
      boxes.push({el,w,h,left:Math.max(10,Math.min(innerWidth-w-10,px+(onLeft?-w-14:14))),top:Math.max(10,Math.min(innerHeight-h-10,py-h)),onLeft});
    }
    if(boxes.length===2){const [a,b]=boxes;if(a.left<b.left+b.w+8&&a.left+a.w+8>b.left&&a.top<b.top+b.h+8&&a.top+a.h+8>b.top){const above=a.top-b.h-12;b.top=above>=10?above:Math.min(innerHeight-b.h-10,a.top+a.h+12)}}
    for(const box of boxes){box.el.style.left=(box.left-r.left)/r.width*100+'%';box.el.style.top=(box.top-r.top)/r.height*100+'%';box.el.classList.toggle('speech-left',box.onLeft)}
  }
  function frame(){layoutBubbles();animation=requestAnimationFrame(frame)}
  document.addEventListener('visibilitychange',layoutBubbles);window.addEventListener('focus',layoutBubbles);
  const Encounter=SupabaseBookshopEncounter;
  const client=new Encounter({
    position:()=>({x:game.player.x,y:game.player.y}),
    prepare:role=>{if(!savedPosition)savedPosition={x:game.player.x,y:game.player.y};document.querySelector('#panel').close();game.startEncounter(role);clearSpeech();muted=false;document.querySelector('#fan-mute').setAttribute('aria-pressed','false');document.querySelector('#fan-mute').textContent='Mute reader';panelMute.textContent='Mute reader';panelMute.setAttribute('aria-pressed','false');endCard.hidden=true;if(!animation)animation=requestAnimationFrame(frame)},
    pose:p=>game.remotePosition(p),
    speech:(text,ttl)=>{if(!muted)bubble(peerBubble,text,ttl,'peer')},
    end:message=>{cancelAnimationFrame(animation);animation=0;clearSpeech();game.endEncounter(savedPosition);savedPosition=null;endText.textContent=message;endCard.hidden=false;document.querySelector('#room').focus()},
    state:state=>{panelControls.hidden=state!=='active';hud.dataset.state=state;hud.hidden=state==='idle';waiting.hidden=state!=='waiting'&&state!=='connecting';active.hidden=state!=='active';status.textContent=state==='waiting'?'Waiting for another reader…':state==='connecting'?'Opening your shared bookshop…':'A fellow reader is here';document.querySelector('#fan-cancel').textContent=state==='connecting'?'Cancel connection':'Cancel waiting';document.querySelector('#meet-fan').setAttribute('aria-pressed',String(state!=='idle'));if(state!=='active')clearSpeech()}
  });
  function join(){document.querySelector('#room-menu').open=false;endCard.hidden=true;if(!client.join()){endText.textContent='Visitor encounters could not load. Please reload in a current browser.';endCard.hidden=false}}
  document.querySelector('#meet-fan').addEventListener('click',join);document.querySelector('#fan-menu-join').addEventListener('click',join);document.querySelector('#fan-again').addEventListener('click',join);document.querySelector('#fan-cancel').addEventListener('click',()=>client.cancel());document.querySelector('#fan-leave').addEventListener('click',()=>client.leave());document.querySelector('#fan-dismiss').addEventListener('click',()=>endCard.hidden=true);

  document.querySelector('#fan-mute').addEventListener('click',e=>{muted=!muted;clearBubble(peerBubble,'peer');e.currentTarget.setAttribute('aria-pressed',String(muted));e.currentTarget.textContent=muted?'Unmute reader':'Mute reader';panelMute.textContent=e.currentTarget.textContent;panelMute.setAttribute('aria-pressed',String(muted))});
  input.addEventListener('focus',()=>game.typing(true));input.addEventListener('blur',()=>game.typing(false));input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();input.blur();document.querySelector('#room').focus()}});
  input.addEventListener('input',()=>{const chars=Array.from(input.value);if(chars.length>100)input.value=chars.slice(0,100).join('');counter.textContent=Array.from(input.value).length+' / 100'});
  form.addEventListener('submit',e=>{e.preventDefault();const text=input.value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(!text||performance.now()<cooldown||!client.say(text))return;bubble(selfBubble,text,3000,'self');input.value='';counter.textContent='0 / 100';cooldown=performance.now()+1200;send.disabled=true;send.textContent='…';cooldownTimer=setTimeout(()=>{send.disabled=false;send.textContent='Send'},1200)});
  new MutationObserver(()=>{if(!document.querySelector('#panel').open&&client.state==='active'&&document.activeElement===input)game.typing(true)}).observe(document.querySelector('#panel'),{attributes:true,attributeFilter:['open']});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
  // No transcript is retained; these diagnostics contain only state and counters.
  window.bookshopCommunity={join,leave:()=>client.leave(),mode:online?'supabase':'local',get state(){return client.state},get muted(){return muted},get metrics(){return {...client.metrics}}};
})();
