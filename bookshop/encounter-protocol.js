/* Bounded two-reader packet protocol. No transcript or browser storage. */
(() => {
 'use strict';
 // Durations use this device's monotonic clock. Peer wall clocks need not agree.
 const localTime=()=>performance.now();
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=51&&p.x<=428&&p.y>=72&&p.y<=268;
 class EncounterProtocol {
  constructor(events){this.events=events;this.id=crypto.randomUUID();this.state='idle';this.role=0;this.metrics={positionsSent:0,speechesSent:0};this.seq=0;this.peerSeq=-1;this.peerPoint=null;this.outgoingFive=null;this.incomingFive=null;this.lastFive=this.lastPeerFive=-Infinity;this.lastSpeech=-Infinity;this.lastPeerSpeech=-Infinity;this.dead=false;this.attempt=null;this.room=null;this.peer=null;this.lastSent=null;this.pairedAt=0;this.shutdown=()=>this.dispose();window.addEventListener('pagehide',this.shutdown);window.addEventListener('beforeunload',this.shutdown);}
    sendHello(){const p=this.events.position();this.post('hello',{x:p.x,y:p.y})}
    activate(){if(this.state!=='connecting')return;this.state='active';this.request('ready');this.events.state?.('active',this.role)}
    receive(p){if(!p||p.from!==this.peer||!Number.isSafeInteger(p.seq)||p.seq<=this.peerSeq||!['hello','pulse','position','speech','highfive','leave'].includes(p.type))return;
      if((p.type==='hello'||p.type==='position')&&!point(p))return;
      this.peerSeq=p.seq;this.peerSeen=Date.now();
      if(p.type==='leave'){this.finish('The other reader left. You’re back in your own shop.',false);return}
      if(p.type==='hello'){this.peerPoint={x:p.x,y:p.y};this.events.pose?.({x:p.x,y:p.y});if(this.state==='connecting'){this.sendHello();this.activate()}return}
      if(p.type==='pulse'){if(this.state==='connecting'){this.sendHello();this.activate()}return}
      if(this.state!=='active')return;
      if(p.type==='position'){this.peerPoint={x:p.x,y:p.y};this.events.pose?.(this.peerPoint)}
      if(p.type==='highfive')this.receiveHighFive(p);
      if(p.type==='speech'){
        const now=localTime();if(typeof p.text!=='string'||!p.text.trim()||Array.from(p.text).length>100||!Number.isFinite(p.sentAt)||now-this.lastPeerSpeech<1200)return;
        this.lastPeerSpeech=now;this.events.speech?.(p.text,3000);
      }
    }
    sendPosition(){if(this.state!=='active')return;const raw=this.events.position(),p={x:Math.round(raw.x*4)/4,y:Math.round(raw.y*4)/4};if(!point(p))return;if(this.lastSent&&this.lastSent.x===p.x&&this.lastSent.y===p.y)return;this.lastSent=p;this.post('position',p);this.metrics.positionsSent++}
    say(text){const now=localTime();if(this.state!=='active'||now-this.lastSpeech<1200)return false;text=String(text).replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(!text||Array.from(text).length>100)return false;if(!this.post('speech',{text,sentAt:Date.now()}))return false;this.lastSpeech=now;this.metrics.speechesSent++;return true}
    canHighFive(){const p=this.events.position();return this.state==='active'&&point(p)&&point(this.peerPoint)&&Math.hypot(p.x-this.peerPoint.x,p.y-this.peerPoint.y)<=48}
    highFive(){
      const now=localTime();if(!this.canHighFive())return false;
      const incoming=this.incomingFive;
      if(incoming&&now<=incoming.expires){
        if(!this.post('highfive',{action:'accept',gesture:incoming.id,sentAt:Date.now()}))return false;
        this.incomingFive=this.outgoingFive=null;this.lastFive=now;
        this.events.gesture?.({kind:'complete'});return true;
      }
      if(now-this.lastFive<2500)return false;
      const id=crypto.randomUUID();
      if(!this.post('highfive',{action:'offer',gesture:id,sentAt:Date.now()}))return false;
      this.lastFive=now;this.outgoingFive={id,expires:now+5000};this.incomingFive=null;
      this.events.gesture?.({kind:'offer',actor:'self'});return true;
    }
    receiveHighFive(p){
      const now=localTime();
      if(!this.canHighFive()||!Number.isFinite(p.sentAt)||typeof p.gesture!=='string'||!/^[0-9a-f-]{36}$/i.test(p.gesture)||!['offer','accept'].includes(p.action))return;
      if(p.action==='offer'){
        if(now-this.lastPeerFive<2500)return;this.lastPeerFive=now;
        // Simultaneous offers count as both people agreeing.
        if(this.outgoingFive&&now<=this.outgoingFive.expires){
          this.post('highfive',{action:'accept',gesture:p.gesture,sentAt:Date.now()});this.incomingFive=this.outgoingFive=null;this.lastFive=now;
          this.events.gesture?.({kind:'complete'});return;
        }
        this.incomingFive={id:p.gesture,expires:now+5000};
        this.events.gesture?.({kind:'offer',actor:'peer'});
      }else if(this.outgoingFive&&this.outgoingFive.id===p.gesture&&now<=this.outgoingFive.expires){
        this.incomingFive=this.outgoingFive=null;this.lastFive=now;this.events.gesture?.({kind:'complete'});
      }
    }
  leave(){this.finish('Encounter ended. You’re back in your own shop.',true);}
 }
 window.BookshopEncounterProtocol=EncounterProtocol;
})();
