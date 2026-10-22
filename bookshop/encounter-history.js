/* Four messages at most, held only in this page's memory. Never written to storage. */
(() => {
  'use strict';
  class EncounterHistory {
    #messages=[];
    #next=0;
    add(text,who){
      const entry={id:++this.#next,text,who,settled:false};
      this.#messages.push(entry);
      if(this.#messages.length>4)this.#messages.shift();
      return entry.id;
    }
    settle(id){
      const entry=this.#messages.find(item=>item.id===id);
      if(!entry)return false;
      entry.settled=true;
      return true;
    }
    get entries(){return this.#messages.filter(item=>item.settled).map(item=>({...item}));}
    clear(){this.#messages=[];}
  }
  window.BookshopEncounterHistory=EncounterHistory;
})();
