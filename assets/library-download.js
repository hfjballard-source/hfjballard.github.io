// Generated PDFs stay only in browser memory.
let pendingCancel=null,currentUrl=null,urlTimer=null;
export function clearLibraryDownload() {
  if(pendingCancel)pendingCancel();
  if(currentUrl)URL.revokeObjectURL(currentUrl);
  currentUrl=null;clearTimeout(urlTimer);
}
addEventListener('pagehide',clearLibraryDownload);
export async function prepareLibraryDownload(data,onProgress=()=>{}) {
  clearLibraryDownload();
  if(!data.recipe){
    const target=new URL(data.url);
    if(target.protocol!=='https:')throw new Error('Download unavailable.');
    return {url:target.href};
  }
  if(data.recipe.kind!=='signed-pdf-v1')throw new Error('This signed download needs a page refresh.');
  if(typeof Worker!=='function')throw new Error('Please use a current browser to download your personalized edition.');
  const recipe=data.recipe;
  onProgress('Preparing your signed book…');
  const pdf=await new Promise((resolve,reject)=>{
    const worker=new Worker('/assets/signed-download-worker.js?v=20261025-fontfix',{type:'module'});
    let settled=false;
    const finish=(error,bytes)=>{
      if(settled)return;settled=true;clearTimeout(timeout);worker.terminate();pendingCancel=null;
      error?reject(error):resolve(bytes);
    };
    const timeout=setTimeout(()=>finish(new Error('Preparing this book took too long. Please try downloading again.')),180000);
    pendingCancel=()=>finish(new Error('Download cancelled.'));
    worker.onmessage=({data:result})=>{
      if(result.progress){onProgress(result.progress);return;}
      if(result.error){finish(new Error(result.error));return;}
      if(!(result.pdf instanceof ArrayBuffer)){finish(new Error('The signed PDF could not be prepared.'));return;}
      finish(null,result.pdf);
    };
    worker.onerror=()=>finish(new Error('The signed PDF could not be prepared. Refresh the page and try again.'));
    worker.postMessage(recipe);
  });
  currentUrl=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));
  // Leave time for mobile Save/Open and the fallback link, then release memory.
  urlTimer=setTimeout(clearLibraryDownload,600000);
  return {url:currentUrl,filename:recipe.filename||'Signed book.pdf',local:true};
}
