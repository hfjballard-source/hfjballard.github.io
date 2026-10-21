/* The helper-created second reader has a separate demo shelf, never a real account. */
(() => {
  const reader=new URLSearchParams(location.search).get('demo-reader');
  if(!reader||!/^[a-f0-9-]{36}$/.test(reader))return;
  const prefix='hfj-isolated-demo-'+reader+':';
  window.bookshopPersonalStorage={getItem:key=>sessionStorage.getItem(prefix+key),setItem:(key,value)=>sessionStorage.setItem(prefix+key,value),removeItem:key=>sessionStorage.removeItem(prefix+key)};
})();
