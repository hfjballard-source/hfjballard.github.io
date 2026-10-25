import { placeholderPage,replaceSigningPage } from '../server/signing-pdf.mjs';
async function fetchBytes(url,max,label) {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'&&parsed.origin!==self.location.origin)throw new Error('Download unavailable.');
  const response=await fetch(parsed.href,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`Could not load the ${label}. Please try downloading again.`);
  if(Number(response.headers.get('content-length'))>max)throw new Error(`The ${label} exceeds its supported size.`);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength>max)throw new Error(`The ${label} exceeds its supported size.`);
  return bytes;
}
self.onmessage=async({data:recipe})=>{
  try {
    if(recipe.kind!=='signed-pdf-v1'||typeof recipe.name!=='string'||Array.from(recipe.name).length>60)
      throw new Error('This signed download needs a page refresh.');
    self.postMessage({progress:'Loading your book and signed title page…'});
    const [book,page,font]=await Promise.all([
      fetchBytes(recipe.bookUrl,35*1024*1024,'book (35 MB maximum)'),
      recipe.pageUrl?fetchBytes(recipe.pageUrl,2*1024*1024,'signed title page'):placeholderPage(recipe.title),
      recipe.fontUrl?fetchBytes(recipe.fontUrl,5*1024*1024,'personalization font'):undefined
    ]);
    self.postMessage({progress:'Adding your personalized title page…'});
    const pdf=await replaceSigningPage(book,page,{name:recipe.name,personalization:recipe.personalization,fontBytes:font});
    const bytes=pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength);
    self.postMessage({pdf:bytes},[bytes]);
  }catch(error){self.postMessage({error:error.message||'The signed book could not be prepared. Please try again.'});}
};
