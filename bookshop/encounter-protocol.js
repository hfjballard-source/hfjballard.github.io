/* Bounded two-reader packet protocol. No transcript or browser storage. */
(() => {
 'use strict';
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=51&&p.x<=428&&p.y>=72&&p.y<=268;
 class EncounterProtocol {
  constructor(events){this.events=events;this.id=crypto.randomUUID();this.state='idle';this.role=0;this.metrics={positionsSent:0,speechesSent:0};this.seq=0;this.peerSeq=-1;this.lastSpeech=-Infinity;this.lastPeerSpeech=-Infinity;this.dead=false;this.attempt=null;this.room=null;this.peer=null;this.lastSent=null;this.pairedAt=0;this.shutdown=()=>this.dispose();window.addEventListener('pagehide',this.shutdown);window.addEventListener('beforeunload',this.shutdown);}
    sendHello(){const p=this.events.position();this.post('hello',{x:p.x,y:p.y})}
    activate(){if(this.state!=='connecting')return;this.state='active';this.request('ready');this.events.state?.('active',this.role)}
    receive(p){if(!p||p.from!==this.peer||!Number.isSafeInteger(p.seq)||p.seq<=this.peerSeq||!['hello','pulse','position','speech','leave'].includes(p.type))return;
      if((p.type==='hello'||p.type==='position')&&!point(p))return;
      this.peerSeq=p.seq;this.peerSeen=Date.now();
      if(p.type==='leave'){this.finish('The other reader left. You’re back in your own shop.',false);return}
      if(p.type==='hello'){this.events.pose?.({x:p.x,y:p.y});if(this.state==='connecting'){this.sendHello();this.activate()}return}
      if(p.type==='pulse'){if(this.state==='connecting'){this.sendHello();this.activate()}return}
      if(this.state!=='active')return;
      if(p.type==='position')this.events.pose?.({x:p.x,y:p.y});
      if(p.type==='speech'){
        const now=Date.now();if(typeof p.text!=='string'||!p.text.trim()||Array.from(p.text).length>100||!Number.isFinite(p.sentAt)||now-p.sentAt>3000||p.sentAt>now+1000||now-this.lastPeerSpeech<1200)return;
        this.lastPeerSpeech=now;this.events.speech?.(p.text,Math.min(3000,Math.max(0,p.sentAt+3000-now)));
      }
    }
    sendPosition(){if(this.state!=='active')return;const raw=this.events.position(),p={x:Math.round(raw.x*4)/4,y:Math.round(raw.y*4)/4};if(!point(p))return;if(this.lastSent&&this.lastSent.x===p.x&&this.lastSent.y===p.y)return;this.lastSent=p;this.post('position',p);this.metrics.positionsSent++}
    say(text){const now=Date.now();if(this.state!=='active'||now-this.lastSpeech<1200)return false;text=String(text).replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(!text||Array.from(text).length>100)return false;this.lastSpeech=now;this.post('speech',{text,sentAt:now});this.metrics.speechesSent++;return true}
  leave(){this.finish('Encounter ended. You’re back in your own shop.',true);}
 }
 window.BookshopEncounterProtocol=EncounterProtocol;
})();
