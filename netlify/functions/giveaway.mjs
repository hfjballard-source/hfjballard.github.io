import { createHash, timingSafeEqual } from 'node:crypto';
import { route, parse, allSkus, readCatalog, db, check, rateLimit, userEmail } from '../../server/services.mjs';
import { selectedSkus } from '../../server/logic.mjs';

const fail=(message,status)=>Object.assign(new Error(message),{status});
function codeMatches(value) {
  const configured=process.env.GIVEAWAY_CODE?.trim().toLowerCase();
  if(!configured)throw fail('Giveaway codes are not available right now.',409);
  if(typeof value!=='string'||value.length>128||!value.trim())return false;
  const digest=text=>createHash('sha256').update(text).digest();
  return timingSafeEqual(digest(value.trim().toLowerCase()),digest(configured));
}
export const handler=route('POST',async event=>{
  await rateLimit(event,'giveaway-ip',15,60);
  const body=parse(event);
  if(!['check','redeem'].includes(body.action))throw fail('Please reopen the giveaway form.',400);
  if(!codeMatches(body.code))throw fail('That giveaway code is not valid. Check the spelling and try again.',400);
  const skus=allSkus();let selected;
  try{selected=selectedSkus(body.items,new Set([...skus].filter(([,sku])=>sku.saleEnabled&&sku.files.length).map(([id])=>id)));}
  catch(error){throw fail(error.message,400);}
  if(body.action==='check')return {valid:true};
  // Identity always comes from the verified library session, never a submitted email.
  const email=await userEmail(event);
  await rateLimit(event,'giveaway-email',10,600,email);
  const database=db(),bucket=database.storage.from('digital-assets'),currency=readCatalog().currency;
  const items=selected.map(id=>{const sku=skus.get(id);return {sku:id,title:sku.title,cover:sku.cover,format:sku.label,files:sku.files};});
  // Check every promised asset before granting any of the selected editions.
  await Promise.all(items.flatMap(item=>item.files.map(file=>bucket.createSignedUrl(file.path,1).then(check))));
  const purchased=new Date().toISOString(),orderIds=[];
  for(const item of items){
    // One giveaway order per reader and edition, even across retries or code rotations.
    const id='giveaway_'+createHash('sha256').update(JSON.stringify(['hfj-giveaway-v1',email,item.sku])).digest('hex');
    check(await database.rpc('record_store_order',{
      p_session:id,p_payment:id,p_email:email,p_amount:0,p_currency:currency,p_status:'paid',p_refunded:0,p_items:[item],p_purchased:purchased
    }));
    orderIds.push(id);
  }
  let newsletterWarning=false;
  if(body.newsletterOptIn===true){
    try{check(await database.rpc('queue_store_newsletter',{p_email:email,p_desired:true,p_event:'newsletter_'+orderIds[0],p_at:purchased}));}
    catch(error){newsletterWarning=true;console.error('Giveaway newsletter preference failed:',error.code||error.name||'Error');}
  }
  return {claimed:true,count:items.length,newsletterWarning};
});
