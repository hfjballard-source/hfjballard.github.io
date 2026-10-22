import { route,env } from '../../server/services.mjs';
export const handler=route('GET',async()=>{
  const url=env('BOOKSHOP_SUPABASE_URL').replace(/\/$/,''),publishableKey=env('BOOKSHOP_SUPABASE_PUBLISHABLE_KEY');
  if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)||!publishableKey.startsWith('sb_publishable_'))throw new Error('Invalid visitor project configuration');
  if(url===process.env.SUPABASE_URL?.replace(/\/$/,''))throw new Error('Visitor chat must use a separate Supabase project');
  return {mode:'supabase',url,publishableKey};
});
