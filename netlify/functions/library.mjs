import { route,userEmail,rateLimit } from '../../server/services.mjs';
import { editionItems } from '../../server/edition-services.mjs';
export const handler=route('GET',async event=>{
  await rateLimit(event,'library',60);
  const email=await userEmail(event);
  const items=(await editionItems(email)).map(({sku,title,cover,format,files,signed,signedPreview})=>({
    sku,title,cover,format:format+(signed?(signedPreview?' · Signing preview':' · Signed edition'):''),signed,files:files.map(file=>({label:file.label}))
  }));
  return {email,items};
});
