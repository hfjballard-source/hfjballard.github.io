import { createHmac } from 'node:crypto';
import { route, parse, userEmail, rateLimit, db, check, json, env } from '../../server/services.mjs';
import { editionItems, signedFiles } from '../../server/edition-services.mjs';
import { placeholderPage,replaceSigningPage } from '../../server/signing-pdf.mjs';
export async function handler(event) {
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed.'});
  return route(event.httpMethod,async event=>{
    const email=await userEmail(event);
    await rateLimit(event,'sign-book',15,60,email);
    const items=await editionItems(email);
    if(event.httpMethod==='GET')return {items:items.map(({sku,title,format,signed,signingAvailable,signingPreview})=>({sku,title,format,signed,preview:signingPreview,available:signingAvailable}))};
    const {sku,name=''}=parse(event), item=items.find(item=>item.sku===sku);
    if(!item)throw Object.assign(new Error('Please choose a book you own in your library.'),{status:403});
    if(!item.signingAvailable)throw Object.assign(new Error('A signed edition of this book is not available yet.'),{status:409});
    if(item.signed)return {signed:true,title:item.title,preview:item.signedPreview};
    if(typeof name!=='string'||Array.from(name).length>60)throw Object.assign(new Error('Use a dedication name of 60 characters or fewer.'),{status:400});
    // Resolve only the server-owned mapping; no client-supplied paths or identity.
    const database=db();
    const spec=signedFiles[sku],bucket=database.storage.from('digital-assets');
    let files,version=null,preview=false;
    if(Array.isArray(spec)) {
      await Promise.all(spec.map(file=>bucket.createSignedUrl(file.path,1).then(check)));files=spec;
    } else {
      const source=item.files.find(file=>file.path.toLowerCase().endsWith('.pdf'));
      if(!source)throw Object.assign(new Error('This signing template needs a purchased PDF edition.'),{status:409});
      const book=check(await bucket.download(source.path));
      if(book.size>35*1024*1024)throw Object.assign(new Error('This book needs a pre-prepared signed edition. Please contact the author.'),{status:409});
      let pageBytes;
      if(spec.signaturePage){const page=check(await bucket.download(spec.signaturePage));if(page.size>2*1024*1024)throw new Error('Signing page exceeds size limit');pageBytes=await page.arrayBuffer();}
      else pageBytes=await placeholderPage(item.title);
      const dedication=name.replace(/[\u0000-\u001f\u007f]/g,' ').trim()||'A fellow reader';
      let fontBytes;
      if(spec.personalization?.fontPath){
        const fontPath=spec.personalization.fontPath;
        if(typeof fontPath!=='string'||!fontPath.startsWith('fonts/')||fontPath.includes('..')||!/\.(ttf|otf)$/i.test(fontPath))
          throw new Error('Use a TTF or OTF font in the private fonts folder.');
        const font=check(await bucket.download(fontPath));
        if(font.size>5*1024*1024)throw new Error('Personalization font exceeds the 5 MB limit.');
        fontBytes=await font.arrayBuffer();
      }
      const pdf=await replaceSigningPage(await book.arrayBuffer(),pageBytes,{name:dedication,personalization:spec.personalization,fontBytes});
      version=spec.version||spec.signaturePage||'placeholder-v1';preview=!!spec.placeholder;
      const key=createHmac('sha256',env('RATE_LIMIT_SECRET')).update(JSON.stringify([email,sku,version,dedication])).digest('hex');
      const path=`signed-editions/${key}.pdf`;
      check(await bucket.upload(path,pdf,{contentType:'application/pdf',upsert:true}));
      files=item.files.map(file=>file===source?{label:spec.label||(preview?'Personalized PDF preview':'Signed PDF'),path}:file);
    }
    check(await database.from('store_signed_editions').upsert({email,sku,files,template_version:version,placeholder:preview},{onConflict:'email,sku'}));
    return {signed:true,title:item.title,preview};
  })(event);
}

