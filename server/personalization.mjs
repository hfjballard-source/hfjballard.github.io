import { createHmac } from 'node:crypto';
import { check, env } from './services.mjs';

export function dedicationName(name) {
  if(typeof name!=='string'||Array.from(name).length>60)
    throw Object.assign(new Error('Use a dedication name of 60 characters or fewer.'),{status:400});
  return name.replace(/[\u0000-\u001f\u007f]/g,' ').normalize('NFC').trim()||'A fellow reader';
}
export function nameFilePath(email,sku) {
  const key=createHmac('sha256',env('RATE_LIMIT_SECRET')).update(JSON.stringify(['personalization-v1',email,sku])).digest('hex');
  return `personalizations/${key}.txt`;
}
export function personalizationFont(spec) {
  const path=spec.personalization?.fontPath;
  if(path!==undefined&&(typeof path!=='string'||!/^fonts\/.+\.(ttf|otf)$/i.test(path)||path.includes('..')))
    throw new Error('Use a TTF or OTF font in the private fonts folder.');
  return path;
}
export async function privateUrl(bucket,path) {
  return check(await bucket.createSignedUrl(path,300)).signedUrl;
}
export async function signedRecipe(bucket,item,file,email,spec) {
  if(file.namePath!==nameFilePath(email,item.sku))throw new Error('Personalization reference mismatch.');
  const text=check(await bucket.download(file.namePath));
  if(text.size>1024)throw new Error('Personalization record is too large.');
  const name=dedicationName(await text.text()),font=personalizationFont(spec);
  const [bookUrl,pageUrl,fontUrl]=await Promise.all([
    privateUrl(bucket,file.path),spec.signaturePage?privateUrl(bucket,spec.signaturePage):null,font?privateUrl(bucket,font):null
  ]);
  const {fontPath,...personalization}=spec.personalization||{};
  return {kind:'signed-pdf-v1',title:item.title,name,personalization,bookUrl,pageUrl,fontUrl,
    filename:`${item.title.replace(/[^a-z0-9 -]/gi,'').trim().slice(0,100)||'Book'} - signed.pdf`};
}
