/* Original code-drawn placeholder pixel art. World units are 2 screen pixels. */
(() => {
  'use strict';
  const canvas = document.querySelector('#room'), ctx = canvas.getContext('2d');
  const art = document.createElement('canvas'); art.width=480; art.height=300;
  const g = art.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const player={x:240,y:246,dir:0,seated:false,reading:false};
  const keys=new Set(); let waypoints=[],target=null, paused=false, mouseFollow=true, last=0, nearest=null, step=0;
  let typing=false,coat='#537961',remote=null,encounter=false;
  let joystick=null,stick={x:0,y:0},highFiveUntil=0;const raisedUntil={self:0,peer:0};
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const solids=[
    {x:62,y:51,w:165,h:42},{x:122,y:77,w:19,h:36},{x:288,y:69,w:111,h:49},
    {x:50,y:113,w:17,h:62},{x:79,y:190,w:62,h:23},
    {x:204,y:151,w:54,h:36},{x:168,y:190,w:18,h:19},
    {x:345,y:182,w:91,h:6},{x:345,y:182,w:6,h:38},{x:345,y:255,w:6,h:24},
    {x:386,y:205,w:25,h:33},{x:420,y:190,w:15,h:21},
    {x:56,y:244,w:20,h:20},
    {x:278,y:53,w:17,h:16},{x:380,y:150,w:48,h:22},{x:103,y:244,w:18,h:11},{x:79,y:249,w:12,h:10},{x:137,y:249,w:12,h:10}
  ];
  const zones=[{id:'store',x:157,y:110,label:'Browse the bookshelves'}, {id:'checkout',x:340,y:133,label:'Checkout at the counter'}, {id:'about',x:399,y:179,label:'Visit the author’s signing table'}, {id:'portfolio',x:82,y:150,label:'Explore the display wall'}, {id:'magazine',x:384,y:251,label:'The bathroom'}, {id:'library',x:111,y:223,label:'Read My Library on the couch'},{id:'community',x:112,y:244,label:'Meet a fellow fan at the café'}];
  const areas={store:[60,48,167,51],checkout:[286,56,116,65],about:[378,118,52,59],portfolio:[72,112,96,39],magazine:[351,188,82,82],library:[77,184,66,33]};
  const spots=[...document.querySelectorAll('.spot')];
  spots.forEach(button=>{const [x,y,w,h]=areas[button.dataset.panel];button.replaceChildren();Object.assign(button.style,{left:x/480*100+'%',top:y/300*100+'%',width:w/480*100+'%',height:h/300*100+'%'});button.disabled=true;button.tabIndex=-1});
  function rect(x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h)}
  function ellipse(x,y,rx,ry,c){g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill()}
  let seed=42;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
  function glow(x,y,r){const gr=g.createRadialGradient(x,y,3,x,y,r);gr.addColorStop(0,'#f9bd5542');gr.addColorStop(1,'#d7a34300');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2)}
  function plant(x,y){rect(x-5,y+1,12,8,'#281d17');rect(x-4,y,10,7,'#a47148');rect(x-2,y+2,6,5,'#71503b');rect(x,y-15,2,16,'#67834b');for(let i=0;i<7;i++){const a=i*2.4;rect(x+Math.sin(a)*7-3,y-5-i*2,7,4,i%2?'#6c8951':'#466541')} }
  function lamp(x,y){ellipse(x,y+2,8,4,'#191a15');rect(x-1,y-16,3,18,'#9e814a');rect(x-7,y-23,15,3,'#d4b06a');rect(x-5,y-29,11,6,'#d9ba76');rect(x-3,y-32,7,3,'#e6cf91');rect(x-5,y-20,11,2,'#f3d994');glow(x,y-16,37)}
  function shelf(x,y,w){rect(x+3,y+6,w,36,'#191712');rect(x,y,w,35,'#694930');rect(x+3,y+3,w-6,27,'#251e19');for(let row=0;row<2;row++){let pos=x+5;while(pos<x+w-8){const h=8+Math.floor(random()*5),width=3+Math.floor(random()*4);const colors=['#8f4a3d','#b59d62','#567165','#626b86','#a97646','#817452'];rect(pos,y+15+row*14-h,width,h,colors[Math.floor(random()*colors.length)]);rect(pos+1,y+17+row*14-h,1,2,'#d6bd7a');pos+=width+1}rect(x+2,y+15+row*14,w-4,3,'#986941')}rect(x,y+33,w,4,'#a8784c');rect(x,y+37,4,3,'#34271d');rect(x+w-4,y+37,4,3,'#34271d')}
  function picture(x,y,w,h,c,symbol){rect(x+2,y+2,w,h,'#161b15');rect(x,y,w,h,'#af8950');rect(x+2,y+2,w-4,h-4,'#392d22');rect(x+4,y+4,w-8,h-8,c);if(symbol==='moon'){ellipse(x+w/2,y+h/2,5,6,'#d8bd7c');ellipse(x+w/2+3,y+h/2-2,4,5,c)}else{rect(x+w/2-1,y+7,2,h-14,'#b3ab7b');rect(x+7,y+h/2,w-14,2,'#b3ab7b')}}
  function person(x,y,author=false,walking=0,shirt='#537961',arm=0){x=Math.round(x);y=Math.round(y);ellipse(x,y+1,7,3,'#171c1680');const leg=Math.sin(walking)*2;rect(x-4,y-6+leg,3,7-leg,'#302b27');rect(x+2,y-6-leg,3,7+leg,'#302b27');rect(x-6,y-17,12,12,author?'#946447':shirt);if(arm===-1){rect(x-8,y-24,3,12,'#c9a277');rect(x-9,y-28,5,6,'#dfb98d')}else rect(x-7,y-15,2,7,'#c9a277');if(arm===1){rect(x+6,y-24,3,12,'#c9a277');rect(x+5,y-28,5,6,'#dfb98d')}else rect(x+6,y-15,2,7,'#c9a277');rect(x-5,y-26,10,10,'#c9a277');rect(x-6,y-28,12,5,author?'#c9a277':'#503b2d');rect(x-6,y-24,3,6,author?'#c9a277':'#503b2d');rect(x-2,y-20,2,2,'#302921');rect(x+3,y-20,2,2,'#302921');rect(x,y-16,2,4,'#d0b779');if(author){rect(x-4,y-20,2,4,'#875531');rect(x+3,y-20,2,4,'#875531');rect(x-3,y-17,7,2,'#875531')}}
  function background(){
    seed=42;rect(0,0,480,300,'#111a17');
    // Floating room footprint, stepped edges, timber wall and floorboards.
    rect(35,39,410,249,'#0b1210');rect(39,43,402,242,'#473c2b');rect(43,47,394,232,'#7e583a');
    for(let y=65;y<278;y+=12){for(let x=45-(y%24?19:0);x<437;x+=39){rect(Math.max(45,x),y,Math.min(38,437-Math.max(45,x)),11,['#725037','#7b563a','#815b3e','#765237'][Math.floor(random()*4)]);rect(Math.max(46,x+3),y+3,Math.min(29,437-Math.max(46,x+3)),1,'#bd8b5130');if(random()>.65)rect(Math.max(47,x+12),y+8,9,1,'#412f263a')}}
    rect(42,41,396,17,'#374436');rect(42,43,396,2,'#647050');rect(44,58,392,5,'#af8050');rect(44,62,392,3,'#453725');
    rect(38,43,8,237,'#3d4937');rect(38,43,2,237,'#738061');rect(434,43,8,238,'#2c392d');rect(433,61,3,218,'#a77b4d');
    // North shelves and a little ladder.
    shelf(63,53,75);shelf(144,53,79);rect(122,77,3,36,'#a68151');rect(138,77,3,36,'#a68151');for(let y=81;y<111;y+=8)rect(123,y,17,2,'#c29b60');
    picture(239,45,28,22,'#3b514b','moon');plant(285,64);
    // Bookseller behind the checkout counter, with a blue shirt and cream apron.
    rect(290,82,112,40,'#30251d66');person(337,85);rect(331,68,12,13,'#617780');rect(334,72,7,11,'#d2c09a');rect(336,72,2,2,'#8b7755');rect(288,88,111,29,'#69452e');rect(291,94,105,17,'#815539');for(let x=296;x<393;x+=20){rect(x,96,16,13,'#62412c');rect(x+1,97,14,1,'#a87e4d')}rect(286,85,115,9,'#b2854c');rect(287,84,113,3,'#c89e61');rect(296,87,17,4,'#d5cda4');rect(305,87,1,4,'#9b8656');rect(367,78,15,8,'#37433a');rect(370,73,9,6,'#576353');rect(371,74,7,3,'#b7bd8b');rect(349,82,5,4,'#dbc78e');rect(354,82,2,3,'#dbc78e');lamp(389,83);
    // Windows, pictures and a low wall bookcase.
    rect(46,111,16,65,'#332c23');rect(48,115,12,55,'#9d7b49');rect(50,118,8,21,'#314b4c');rect(50,144,8,22,'#3d5456');rect(52,119,2,6,'#a6bcb06b');
    picture(75,118,27,24,'#3b5850','moon');picture(109,118,22,29,'#635447','star');picture(139,119,26,23,'#514752','moon');
    // Central faded Persian rug.
    rect(174,133,124,91,'#3e302c77');rect(171,130,124,91,'#705044');rect(173,132,120,87,'#b28c5a');rect(176,135,114,81,'#85594b');rect(180,139,106,73,'#64443e');rect(184,143,98,65,'#8c6650');for(let x=181;x<287;x+=11){rect(x,136,4,3,'#d3a974');rect(x,212,4,3,'#d3a974')}for(let y=146;y<209;y+=10){rect(177,y,3,4,'#c39d68');rect(287,y,3,4,'#c39d68')}g.fillStyle='#b89a6b';g.beginPath();g.moveTo(234,146);g.lineTo(269,175);g.lineTo(234,204);g.lineTo(199,175);g.fill();g.fillStyle='#69453d';g.beginPath();g.moveTo(234,155);g.lineTo(259,175);g.lineTo(234,195);g.lineTo(209,175);g.fill();for(let x=173;x<294;x+=4){rect(x,128,1,2,'#a78e64');rect(x,221,1,3,'#a78e64')}
    // Table and stacked books.
    rect(208,161,52,28,'#211d1866');rect(209,178,4,12,'#443024');rect(251,178,4,12,'#443024');rect(204,151,54,32,'#523e2c');rect(202,149,57,29,'#a07b4b');rect(205,151,51,25,'#b28b56');rect(207,154,45,1,'#cfac6a');rect(216,156,14,12,'#3b564e');rect(217,157,12,2,'#83977a');rect(235,160,13,10,'#6c3f3c');rect(236,161,11,1,'#d5be8d');rect(232,153,5,5,'#d3bf88');
    // Reading sofa, stool, warm standing lamp and snoozing cat.
    rect(80,193,64,24,'#251f19aa');rect(79,189,62,20,'#314c40');rect(82,187,56,7,'#698069');rect(83,195,23,12,'#516d57');rect(109,195,25,12,'#58715b');rect(78,192,6,18,'#7b8a64');rect(135,192,6,18,'#7b8a64');rect(82,208,4,5,'#453726');rect(133,208,4,5,'#453726');rect(87,194,11,9,'#b39c65');rect(123,194,9,9,'#8e6a54');rect(168,190,18,16,'#5d4931');rect(170,187,15,15,'#a17f50');lamp(155,204);ellipse(109,229,11,5,'#372b2480');rect(100,220,17,8,'#a77c4d');rect(112,216,8,9,'#b9925a');rect(112,214,2,4,'#b9925a');rect(118,214,2,4,'#b9925a');rect(114,221,2,1,'#392c23');rect(99,222,4,3,'#ceb281');
    // Corner signing table, author, open book and fountain pen.
    person(403,150,true);rect(380,150,48,22,"#68462e");rect(378,148,52,8,"#bb9259");rect(385,151,17,4,"#e7d7af");rect(393,151,1,4,"#9c8053");rect(409,151,12,1,"#322d29");rect(418,150,3,2,"#d6b771");rect(383,170,4,5,"#493525");rect(422,170,4,5,"#493525");glow(403,148,31);
    // Bathroom partition, checked tiles and porcelain throne.
    rect(351,188,82,89,'#b0a887');for(let y=190;y<276;y+=12)for(let x=352;x<433;x+=12)rect(x,y,11,11,((x-352)/12+(y-190)/12)%2?'#9eaa8f':'#c2bea0');rect(346,182,89,8,'#394b3e');rect(346,181,89,2,'#8d9b78');rect(345,184,6,36,'#4a5944');rect(345,254,6,26,'#4a5944');rect(345,218,5,3,'#ceb080');rect(345,252,5,3,'#ceb080');rect(356,218,1,37,'#7a785a');rect(357,218,15,2,'#7a785a');
    rect(388,205,20,11,'#d9dac1');rect(390,207,16,7,'#f0e9d0');rect(396,209,4,2,'#aa975c');ellipse(398,226,11,12,'#e2dfc8');ellipse(398,225,7,8,'#929f8b');ellipse(398,225,4,5,'#495d53');rect(393,235,10,5,'#b6bda3');rect(420,192,14,15,'#d9dac1');ellipse(427,199,5,4,'#829e96');rect(426,191,2,4,'#c8ad6d');rect(365,195,10,13,'#5c6653');rect(366,194,8,10,'#d7b373');rect(367,196,6,1,'#65573d');rect(368,199,5,1,'#65573d');rect(414,227,8,3,'#cbbb89');rect(415,230,6,6,'#dfd5b5');
    plant(65,257);rect(52,272,380,7,'#493c2b');rect(52,272,380,2,'#c0975a');rect(221,272,35,7,'#433c44');rect(224,273,29,3,'#8c819b');
    // A two-chair café nook at the southwest corner, beside the reading sofa.
    rect(76,239,78,29,'#3f4c3c');rect(78,241,74,25,'#7c8660');rect(80,243,70,1,'#bec398');
    ellipse(112,255,15,5,'#28312488');rect(110,250,4,10,'#513b2c');
    ellipse(112,247,14,8,'#6b4930');ellipse(112,245,14,7,'#b28a52');ellipse(112,244,12,5,'#c39b62');
    for(const x of [79,137]){rect(x,249,12,10,'#354f41');rect(x,247,12,4,'#7b9672');rect(x+1,252,10,5,'#58775a');rect(x+1,258,2,3,'#453628');rect(x+9,258,2,3,'#453628')}
    rect(106,241,5,4,'#e4d4af');rect(111,242,2,2,'#e4d4af');rect(116,244,4,3,'#e4d4af');rect(120,244,2,2,'#e4d4af');
    rect(106,236,1,3,'#cabd9a');rect(118,239,1,3,'#cabd9a');glow(112,248,28);
    rect(76,260,74,12,'#815d36');rect(77,260,72,2,'#c8a56b');
    // Welcome mat at the entrance.
    rect(211,249,54,18,'#4f5b43');rect(214,252,48,12,'#75805a');g.fillStyle='#d8c396';g.font='5px monospace';g.textAlign='center';g.fillText('COME ON IN',238,260);
    glow(129,99,54);glow(337,117,58);glow(96,192,40);glow(401,222,40);
    // Vignette keeps the room warm against the surrounding dark.
    const vignette=g.createRadialGradient(240,165,85,240,165,244);vignette.addColorStop(0,'#07140c00');vignette.addColorStop(1,'#07140c88');g.fillStyle=vignette;g.fillRect(0,0,480,300);
  }
  background();const scenery=g.getImageData(0,0,480,300);
  function blocked(x,y){return x<51||x>428||y<97&&x<230||y<72||y>268||solids.some(r=>x+5>r.x&&x-5<r.x+r.w&&y+2>r.y&&y-6<r.y+r.h)}
  // Tap destinations route around furniture instead of stopping against it.
  function clearLine(a,b){
    const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2);
    for(let i=1;i<=steps;i++)if(blocked(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;
    return true;
  }
  function tapRoute(destination){
    if(clearLine(player,destination))return [];
    const point=(x,y)=>({x:56+x*8,y:72+y*8}),queue=[],previous=new Map();
    const sx=Math.round((player.x-56)/8),sy=Math.round((player.y-72)/8);
    for(let x=sx-1;x<=sx+1;x++)for(let y=sy-1;y<=sy+1;y++){
      const p=point(x,y),key=x+','+y;
      if(x<0||x>46||y<0||y>24||blocked(p.x,p.y)||!clearLine(player,p))continue;
      previous.set(key,null);queue.push({x,y,key});
    }
    for(let i=0;i<queue.length;i++){
      const current=queue[i],p=point(current.x,current.y);
      if(Math.hypot(p.x-destination.x,p.y-destination.y)<=16&&clearLine(p,destination)){
        const path=[];let key=current.key;
        while(key!==null){const [x,y]=key.split(',').map(Number);path.push(point(x,y));key=previous.get(key)}
        return path.reverse();
      }
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const x=current.x+dx,y=current.y+dy,key=x+','+y,next=point(x,y);
        if(x<0||x>46||y<0||y>24||previous.has(key)||blocked(next.x,next.y)||!clearLine(p,next))continue;
        previous.set(key,current.key);queue.push({x,y,key});
      }
    }
    return null;
  }
  function move(dx,dy){if(!blocked(player.x+dx,player.y))player.x+=dx;if(!blocked(player.x,player.y+dy))player.y+=dy;step+=Math.hypot(dx,dy)*.25;}
  function updateNear(){const sorted=zones.map(z=>({...z,d:Math.hypot(player.x-z.x,player.y-z.y)})).sort((a,b)=>a.d-b.d);nearest=sorted[0].d<42?sorted[0]:null;const active=nearest&&!paused?nearest:null;const b=document.querySelector('#interact');b.disabled=!active;b.textContent='✦';b.setAttribute('aria-label',active?active.label:'Explore the shop');const location=document.querySelector('#location'),text=active?active.label:'A quiet corner of somewhere';if(location.textContent!==text)location.textContent=text;document.querySelector("#meet-fan").classList.toggle("is-near",active?.id==="community");spots.forEach(button=>{const near=active?.id===button.dataset.panel;button.classList.toggle('is-near',near);button.disabled=!near;button.tabIndex=near?0:-1})}
  function raisedArm(who){const now=performance.now();if(now>=raisedUntil[who])return 0;const p=who==='self'?player:remote,other=who==='self'?remote:player;return p&&other&&p.x>other.x?-1:1}
  function highFiveSpark(){if(!remote||performance.now()>=highFiveUntil)return;const x=(player.x+remote.x)/2,y=Math.min(player.y,remote.y)-30;rect(x-1,y-5,2,10,'#f3dc91');rect(x-5,y-1,10,2,'#f3dc91');rect(x-7,y-7,2,2,'#d8b66c');rect(x+6,y-7,2,2,'#d8b66c');rect(x-7,y+6,2,2,'#d8b66c');rect(x+6,y+6,2,2,'#d8b66c')}
  function frame(time){let dt=Math.min((time-last)/1000,.04);last=time;let dx=0,dy=0;if(!paused&&!typing&&!player.seated){dx=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));dy=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));if(!dx&&!dy){dx=stick.x;dy=stick.y}if(!dx&&!dy&&target){while(waypoints.length&&Math.hypot(waypoints[0].x-player.x,waypoints[0].y-player.y)<1.5)waypoints.shift();const aim=waypoints[0]||target,dist=Math.hypot(aim.x-player.x,aim.y-player.y);if(dist>(waypoints.length?1:2)){const speed=Math.min(1,dist/(72*dt||1));dx=(aim.x-player.x)/dist*speed;dy=(aim.y-player.y)/dist*speed}}if(dx||dy){const length=Math.hypot(dx,dy);move(dx/Math.max(1,length)*72*dt,dy/Math.max(1,length)*72*dt)}}updateNear();g.putImageData(scenery,0,0);if(remote){const dx=remote.targetX-remote.x,dy=remote.targetY-remote.y,t=Math.min(1,dt*14);if(!blocked(remote.x+dx*t,remote.y))remote.x+=dx*t;if(!blocked(remote.x,remote.y+dy*t))remote.y+=dy*t;remote.step+=Math.hypot(dx*t,dy*t)*.25;if(remote.y<=player.y)person(remote.x,remote.y,false,reduce.matches?0:remote.step,remote.coat,raisedArm('peer'));}if(player.seated){person(398,232,false,0,coat);rect(391,226,14,7,'#d8c995');rect(398,226,1,7,'#9e8b60')}else if(player.reading){person(111,204,false,0,coat);rect(104,193,15,8,"#ded0aa");rect(111,193,1,8,"#aa9262")}else person(player.x,player.y,false,reduce.matches?0:(dx||dy?step:0),coat,raisedArm('self'));if(remote&&remote.y>player.y)person(remote.x,remote.y,false,reduce.matches?0:remote.step,remote.coat,raisedArm('peer'));if(nearest&&!paused){rect(player.x-2,player.y-36,5,5,'#ead08b');rect(player.x,player.y-38,1,9,'#ead08b')}
    highFiveSpark();ctx.drawImage(art,0,0,960,600);requestAnimationFrame(frame)}requestAnimationFrame(frame);
  function clear(){joystick?.reset();waypoints=[];target=null;touchStart=null;keys.clear()}
  function interact(){if(!nearest)return;if(nearest.id==='community')window.bookshopCommunity?.join();else window.openPanel?.(nearest.id)}
  document.querySelector('#room-wrap').addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||!mouseFollow||paused||typing)return;const r=canvas.getBoundingClientRect();waypoints=[];target={x:(e.clientX-r.left)/r.width*480,y:(e.clientY-r.top)/r.height*300}},{capture:true});
  document.querySelector('#room-wrap').addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){target=null;waypoints=[]}});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')canvas.focus()});
  // A touch destination survives the pointerleave browsers emit after lifting a finger.
  const roomWrap=document.querySelector('#room-wrap');let touchStart=null;
  roomWrap.addEventListener('pointerdown',e=>{
    if(!['touch','pen'].includes(e.pointerType)||paused||typing||e.isPrimary===false)return;
    if(e.target.closest?.('button:not(:disabled),a,input,textarea,summary'))return;
    touchStart={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()};
  },{capture:true});
  roomWrap.addEventListener('pointerup',e=>{
    const start=touchStart;if(!start||start.id!==e.pointerId)return;touchStart=null;
    if(paused||typing||performance.now()-start.time>600||Math.hypot(e.clientX-start.x,e.clientY-start.y)>12)return;
    const r=canvas.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width*480,y=(e.clientY-r.top)/r.height*300;
    if(x<0||x>480||y<0||y>300||blocked(x,y))return;
    const route=tapRoute({x,y});if(route===null)return;waypoints=route;target={x,y};document.querySelector('#arrival').hidden=true;
  },{capture:true});
  roomWrap.addEventListener('pointercancel',()=>touchStart=null,{capture:true});
  document.addEventListener('keydown',e=>{if(paused||typing||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key.startsWith('Arrow')&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();target=null;waypoints=[];keys.add(e.key);document.querySelector('#arrival').hidden=true}if((e.key.toLowerCase()==='e'||e.key==='Enter')&&nearest&&(document.activeElement===canvas||document.activeElement===document.body)){e.preventDefault();interact()}});
  document.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  joystick=new window.BookshopJoystick(document.querySelector('#walk-joystick'),vector=>{stick=vector;waypoints=[];target=null},()=>!paused&&!typing);
  document.querySelector('#interact').addEventListener('click',interact);
  document.querySelector('#mouse-toggle').addEventListener('click',e=>{mouseFollow=!mouseFollow;target=null;waypoints=[];e.currentTarget.textContent='Mouse follow: '+(mouseFollow?'on':'off');e.currentTarget.setAttribute('aria-pressed',String(mouseFollow))});
  // Highlighted hotspots remain part of the room, so hovering them keeps mouse-follow active.
  // Keep the public interface tiny; it is also used by the prototype checks.
  window.bookshopGame={player,solids,zones,blocked,move,pause(value){paused=value;clear()},seat(value){player.seated=value},lounge(value){player.reading=value},typing(value){typing=value;clear()},
    startEncounter(role){clear();encounter=true;coat=role===0?'#537961':'#8a719e';remote=null;raisedUntil.self=raisedUntil.peer=highFiveUntil=0;player.x=role===0?95:129;player.y=240},
    remotePosition(p){if(!encounter||!Number.isFinite(p.x)||!Number.isFinite(p.y)||blocked(p.x,p.y))return;if(!remote)remote={x:p.x,y:p.y,targetX:p.x,targetY:p.y,coat:coat==='#537961'?'#8a719e':'#537961',step:0};else{remote.targetX=p.x;remote.targetY=p.y}},
    endEncounter(position){clear();raisedUntil.self=raisedUntil.peer=highFiveUntil=0;encounter=false;coat='#537961';remote=null;if(position&&!blocked(position.x,position.y)){player.x=position.x;player.y=position.y}},
    highFive(kind,actor='self'){if(!encounter)return;if(kind==='complete'){highFiveUntil=performance.now()+1400;raisedUntil.self=raisedUntil.peer=highFiveUntil}else if(kind==='offer')raisedUntil[actor]=performance.now()+5000;else raisedUntil.self=raisedUntil.peer=highFiveUntil=0},
    encounterPositions(){return {self:{x:player.x,y:player.y},peer:remote?{x:remote.x,y:remote.y}:null}},
    get paused(){return paused},get target(){return target},get isTyping(){return typing},get coat(){return coat},get remote(){return remote?{...remote}:null}};
})();



