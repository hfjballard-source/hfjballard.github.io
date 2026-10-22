import mapping from './signed-files.json' with { type: 'json' };
import { db, check, entitlements } from './services.mjs';
import { applySignedEditions } from './edition-logic.mjs';
export { mapping as signedFiles };
export async function editionItems(email) {
  const items=await entitlements(email);
  // Before signed files are configured, existing libraries work without a schema dependency.
  const rows=[];
  if(Object.keys(mapping).length) {
    const database=db();
    for(let offset=0;;offset+=500) {
      const page=check(await database.from('store_signed_editions').select('sku,files,template_version,placeholder').eq('email',email).order('sku').range(offset,offset+499));
      rows.push(...page);if(page.length<500)break;
    }
  }
  return applySignedEditions(items,new Map(rows.map(row=>[row.sku,row])),mapping);
}
