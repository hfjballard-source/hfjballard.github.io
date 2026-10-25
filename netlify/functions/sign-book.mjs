import { route, parse, userEmail, rateLimit, db, check, json, entitlements } from '../../server/services.mjs';
import { editionItems, signedFiles } from '../../server/edition-services.mjs';
import { placeholderPage, validateSigningTemplate } from '../../server/signing-pdf.mjs';
import { dedicationName, nameFilePath, personalizationFont, privateUrl } from '../../server/personalization.mjs';
export async function handler(event) {
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed.'});
  return route(event.httpMethod,async event=>{
    const email=await userEmail(event);
    await rateLimit(event,'sign-book',15,60,email);
    const items=await editionItems(email);
    if(event.httpMethod==='GET')return {items:items.map(({sku,title,format,signed,canResign,signingAvailable,signingPreview})=>({sku,title,format,signed:signed&&!canResign,preview:signingPreview,available:signingAvailable}))};
    const {sku,name=''}=parse(event),item=items.find(item=>item.sku===sku);
    if(!item)throw Object.assign(new Error('Please choose a book you own in your library.'),{status:403});
    if(!item.signingAvailable)throw Object.assign(new Error('A signed edition of this book is not available yet.'),{status:409});
    if(item.signed&&!item.canResign)return {signed:true,title:item.title,preview:item.signedPreview};
    const dedication=dedicationName(name);
    const database=db(),bucket=database.storage.from('digital-assets'),spec=signedFiles[sku];
    let files,version=null,preview=false;
    if(Array.isArray(spec)) {
      await Promise.all(spec.map(file=>privateUrl(bucket,file.path)));files=spec;
    } else {
      // Always use the purchased original, including when converting an older saved copy.
      const original=(await entitlements(email)).find(book=>book.sku===sku);
      const source=original?.files.find(file=>file.path.toLowerCase().endsWith('.pdf'));
      if(!source)throw Object.assign(new Error('This signing template needs a purchased PDF edition.'),{status:409});
      await privateUrl(bucket,source.path);
      let pageBytes;
      if(spec.signaturePage){
        const page=check(await bucket.download(spec.signaturePage));
        if(page.size>2*1024*1024)throw new Error('Signing page exceeds size limit');
        pageBytes=await page.arrayBuffer();
      } else pageBytes=await placeholderPage(item.title);
      let fontBytes;const fontPath=personalizationFont(spec);
      if(fontPath){
        const font=check(await bucket.download(fontPath));
        if(font.size>5*1024*1024)throw new Error('Personalization font exceeds the 5 MB limit.');
        fontBytes=await font.arrayBuffer();
      }
      // Validate only the title page. No complete generated PDF is uploaded.
      await validateSigningTemplate(pageBytes,{name:dedication,personalization:spec.personalization,fontBytes});
      const namePath=nameFilePath(email,sku);
      check(await bucket.upload(namePath,dedication,{contentType:'text/plain; charset=utf-8',cacheControl:'0',upsert:true}));
      files=[{kind:'on-demand-v1',namePath}];
      version=spec.version||spec.signaturePage||'placeholder-v1';preview=!!spec.placeholder;
    }
    check(await database.from('store_signed_editions').upsert({email,sku,files,template_version:version,placeholder:preview},{onConflict:'email,sku'}));
    return {signed:true,title:item.title,preview};
  })(event);
}
