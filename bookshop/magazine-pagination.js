/* Fit measured text to leaves without changing the author's JSON or losing characters. */
(() => {
  'use strict';
  const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
  function split(text,fits){
    const source=String(text??'').replace(/\r\n?/g,'\n').trim(),pages=[];
    let start=0;const segments=segmenter.segment(source);
    while(start<source.length){
      const last=segments.containing(Math.min(source.length-1,start+8191)),remaining=source.slice(start,last.index+last.segment.length),ends=Array.from(segmenter.segment(remaining),s=>s.index+s.segment.length);
      let low=0,high=ends.length;
      while(low<high){const mid=Math.ceil((low+high)/2);if(fits(remaining.slice(0,ends[mid-1]))){low=mid}else high=mid-1}
      if(!low)throw Error('The magazine text area is too small to display a character.');
      let length=ends[low-1];
      if(start+length<source.length){
        const candidate=remaining.slice(0,length),paragraph=candidate.lastIndexOf('\n\n');
        if(paragraph>=length*.6)length=paragraph+2;
        else {const breaks=[...candidate.matchAll(/\s+/g)],last=breaks.at(-1);if(last&&last.index>=length*.6)length=last.index+last[0].length}
      }
      pages.push({text:source.slice(start,start+length),start,end:start+length});start+=length;
    }
    return pages;
  }
  function spreads(stories,fit,compact){
    const result=[];
    stories.forEach((story,storyIndex)=>{
      const chunks=split(story.text,text=>fit(story,text)).map((chunk,index)=>({...chunk,kind:'text',story,storyIndex,part:index+1}));
      if(!chunks.length)return;
      if(compact){for(const chunk of chunks)result.push([chunk]);return}
      result.push([{kind:'opener',story,storyIndex},chunks[0]]);
      for(let i=1;i<chunks.length;i+=2)result.push([chunks[i],chunks[i+1]||{kind:'blank',story,storyIndex}]);
    });
    return result;
  }
  function locate(spreads,anchor){
    if(!anchor)return 0;
    const index=spreads.findIndex(pair=>pair.some(page=>page.kind==='text'&&page.storyIndex===anchor.storyIndex&&page.start<=anchor.start&&page.end>anchor.start));
    return index<0?0:index+1;
  }
  window.BookshopMagazinePages={split,spreads,locate};
})();
