import { route,parse,userEmail,rateLimit,db,check } from '../../server/services.mjs';
import { editionItems } from '../../server/edition-services.mjs';
export const handler=route('POST',async event=>{
  await rateLimit(event,'download',60);
  const email=await userEmail(event),{sku,index}=parse(event);
  const item=(await editionItems(email)).find(item=>item.sku===sku);
  if(!item||!Number.isInteger(index)||index<0||!item.files[index])throw Object.assign(new Error('This file is not available in your library.'),{status:403});
  const result=check(await db().storage.from('digital-assets').createSignedUrl(item.files[index].path,300,{download:true}));
  return {url:result.signedUrl};
});
