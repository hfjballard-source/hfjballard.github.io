// Only the separate visitor project's PUBLIC settings are returned here.
window.BOOKSHOP_COMMUNITY={mode:'supabase'};
window.bookshopCommunityConfigReady=fetch('/.netlify/functions/community-config',{signal:AbortSignal.timeout(10000)})
  .then(async response=>{if(!response.ok)throw Error('Visitor encounters are not configured yet.');return response.json();})
  .then(config=>{window.BOOKSHOP_COMMUNITY=Object.freeze(config);return config;})
  .catch(error=>{window.BOOKSHOP_COMMUNITY={mode:'supabase',unavailable:true};return null;});
