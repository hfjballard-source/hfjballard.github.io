/* Dedicated visitor-project adapter. Queue metadata only in Postgres; speech/poses use
   private WebSocket Broadcast. Anonymous auth stays in memory, separate from
   any shop login. Reuses the protocol's bounded packet validation. */
(() => {
  'use strict';
  const validId=s=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
  class SupabaseEncounter extends BookshopEncounterProtocol {
    constructor(events){super(events);this.network=true;this.client=null;this.channel=null;this.channelReady=false;this.polling=false;this.lastPoll=0;this.generation=0}
    get supported(){return !!(globalThis.supabase&&crypto.randomUUID&&window.bookshopCommunityConfigReady)}
    async ensureClient(){
      if(this.ready)return this.ready;
      this.ready=this.initialize().catch(error=>{this.ready=null;throw error});
      return this.ready;
    }
    async initialize(){
      const config=await window.bookshopCommunityConfigReady;
      if(!config?.url)throw Error("Visitor encounters are not configured yet.");
      this.client=supabase.createClient(config.url,config.publishableKey,{
        auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'bookshop-visitor-'+this.id},
        realtime:{params:{eventsPerSecond:6}}
      });
      const {data,error}=await this.client.auth.signInAnonymously();
      if(error){this.client.auth.stopAutoRefresh();this.client=null;throw error}
      this.id=data.user.id;
      await this.client.realtime.setAuth(data.session.access_token);
      this.authenticated=true;
    }
    join(){
      if(this.dead||!this.supported)return false;
      if(this.state!=='idle')return true;
      const attempt=this.attempt=crypto.randomUUID(),generation=++this.generation;
      this.state='waiting';this.lastPoll=0;this.events.state?.('waiting');
      this.pulse=setInterval(()=>this.tick(),2000);this.motion=setInterval(()=>this.sendPosition(),250);
      (async()=>{
        try{await this.ensureClient();if(generation!==this.generation||this.attempt!==attempt)return;
          const result=await this.rpc('join',attempt);
          if(this.attempt!==attempt||this.dead){this.rpc('leave',attempt).catch(()=>{});return}
          this.applyQueue(result);
        }catch(error){if(this.attempt===attempt)this.fail(error)}
      })();
      return true;
    }
    rpc(action,attempt){
      const run=async()=>{
        if(!this.client)throw Error('The visitor connection is unavailable.');
        const {data,error}=await this.client.rpc('bookshop_encounter',{p_action:action,p_attempt:attempt}).abortSignal(AbortSignal.timeout(10000));
        if(error)throw error;return data;
      };
      const task=(this.rpcTail||Promise.resolve()).then(run,run);
      this.rpcTail=task.catch(()=>{});return task;
    }
    applyQueue(p){
      if(p?.state==='paired'&&this.state==='waiting'&&validId(p.room)&&validId(p.peer)&&p.peer!==this.id&&(p.role===0||p.role===1)){this.connect(p);return}
      if(p?.state==='ended')this.finish('The other reader left or the connection expired. You’re back in your own shop.',false);
      else if(p?.state==='busy')this.finish('The little shop is full just now. Please try again in a moment.',true);
    }
    async poll(){
      if(this.polling||!this.authenticated||!this.attempt||this.state==='idle')return;
      const attempt=this.attempt;this.polling=true;this.lastPoll=Date.now();
      try{const p=await this.rpc('status',attempt);if(this.attempt===attempt)this.applyQueue(p)}
      catch(error){if(this.attempt===attempt)this.fail(error)}
      finally{this.polling=false}
    }
    connect(p){
      this.room=p.room;this.peer=p.peer;this.role=p.role;this.state='connecting';this.peerSeq=-1;this.seq=0;
      this.lastSpeech=this.lastPeerSpeech=-Infinity;this.peerSeen=this.pairedAt=Date.now();this.lastSent=null;
      this.events.state?.('connecting',this.role);this.events.prepare?.(this.role);
      const start=this.events.position();this.lastSent={x:Math.round(start.x*4)/4,y:Math.round(start.y*4)/4};
      const attempt=this.attempt;
      this.channel=this.client.channel('bookshop-live:'+p.room,{config:{private:true,broadcast:{self:false,ack:false}}})
        .on('broadcast',{event:'visitor'},({payload})=>{if(this.attempt===attempt)this.receive(payload)})
        .subscribe((status,error)=>{
          if(this.attempt!==attempt)return;
          if(status==='SUBSCRIBED'){this.channelReady=true;this.sendHello()}
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
            console.warn('Bookshop visitor connection:',status,error?.message||'Connection closed');
            this.finish('The live connection was interrupted. You’re back in your own shop.',true);
          }
        });
    }
    // Only send through an already joined WebSocket: no HTTP fallback or replay.
    post(type,data={}){
      if(!this.channelReady||!this.channel||!this.client?.realtime.isConnected())return false;
      this.channel.send({type:'broadcast',event:'visitor',payload:{type,from:this.id,seq:++this.seq,...data}}).catch(()=>{});
      return true;
    }
    // Protocol calls request('ready') after the two-way hello. No browser bus online.
    request(){}
    tick(){
      if(this.dead||this.state==='idle')return;
      if(this.state==='waiting'){if(Date.now()-this.lastPoll>=2000)this.poll();return}
      if(Date.now()-this.lastPoll>=10000)this.poll();
      if(this.state==='connecting'){
        if(Date.now()-this.pairedAt>16000){this.finish('That reader couldn’t connect. You’re back in your own shop.',true);return}
        this.sendHello();
      }else if(this.state==='active'){
        if(Date.now()-this.peerSeen>14000){this.finish('The other reader disconnected. You’re back in your own shop.',true);return}
        this.post('pulse');
      }
    }
    fail(error){
      const detail=String(error?.message||'');
      const message=/anonymous.*(disabled|not allowed)/i.test(detail)?'Anonymous visitor access needs to be enabled in the visitor project. The solo shop still works.':
        /rate|429/i.test(detail)?'The visitor service needs a short breather. Please try again later.':
        'Couldn’t reach the visitor bookshop. Check your connection and try again. The solo shop still works.';
      this.finish(message,true);
    }
    cancel(){if(this.state==='waiting'||this.state==='connecting')this.finish('Waiting cancelled.',true)}
    finish(message,notify){
      if(this.state==='idle')return;
      const attempt=this.attempt,channel=this.channel;
      if(notify)this.post('leave');
      this.state='idle';this.attempt=null;this.generation++;this.channel=null;this.channelReady=false;
      clearInterval(this.pulse);clearInterval(this.motion);this.room=this.peer=null;this.lastSent=null;
      if(channel)this.client.removeChannel(channel).catch(()=>{});
      // Best effort on unload; peer heartbeat and expiring membership cover dropped requests.
      if(attempt&&this.client)this.rpc('leave',attempt).catch(()=>{});
      this.events.end?.(message);this.events.state?.('idle');
    }
    dispose(){if(this.dead)return;this.finish('Encounter ended.',true);this.dead=true;this.client?.auth.stopAutoRefresh();this.client?.realtime.disconnect();window.removeEventListener('pagehide',this.shutdown);window.removeEventListener('beforeunload',this.shutdown)}
  }
  window.SupabaseBookshopEncounter=SupabaseEncounter;
})();
