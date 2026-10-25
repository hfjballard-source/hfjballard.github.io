let activeDialog;
async function post(name,body,token){
  const response=await fetch('/.netlify/functions/'+name,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  let data;try{data=await response.json();}catch{throw new Error('The service is temporarily unavailable. Please try again.');}
  if(!response.ok)throw Object.assign(new Error(data.error||'Please try again in a moment.'),{status:response.status});
  return data;
}
export function openGiveaway({items,newsletterOptIn=false,onSuccess=()=>{}}){
  if(activeDialog?.open){activeDialog.querySelector('input:not([hidden])')?.focus();return;}
  if(!Array.isArray(items)||!items.length)return;
  if(!document.querySelector('link[data-giveaway-style]')){
    const style=document.createElement('link');style.rel='stylesheet';style.href='/assets/giveaway.css?v=20261025';style.dataset.giveawayStyle='';document.head.append(style);
  }
  const returnFocus=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='giveaway-dialog';dialog.setAttribute('aria-labelledby','giveaway-title');
  dialog.innerHTML=`<div class="giveaway-heading"><h2 id="giveaway-title">A gift for your bookshelf</h2><button type="button" class="giveaway-close" aria-label="Close giveaway">×</button></div>
    <p class="giveaway-intro">Use a giveaway code to add your selected books to My Library for free. No payment details needed.</p>
    <form data-step="coupon"><label for="giveaway-code">Giveaway code</label><input id="giveaway-code" type="text" maxlength="128" autocomplete="off" autocapitalize="none" spellcheck="false" required><button class="giveaway-primary" type="submit">Apply code</button></form>
    <form data-step="email" hidden><label for="giveaway-email">Your library email</label><input id="giveaway-email" type="email" maxlength="254" autocomplete="email" required><p>We’ll send a code to confirm this is your email before adding your books.</p><button class="giveaway-primary" type="submit">Send a verification code</button></form>
    <form data-step="verify" hidden><label for="giveaway-otp">Code from your email</label><input id="giveaway-otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required><button class="giveaway-primary" type="submit">Verify and add my free books</button><button class="giveaway-secondary" type="button" data-other-email>Use another email or request a new code</button></form>
    <section data-step="claim" hidden><p>Your library is signed in. Add these books to that library, or choose another email.</p><button class="giveaway-primary" type="button" data-claim>Add free books to My Library</button><button class="giveaway-secondary" type="button" data-other-email>Use another email</button></section>
    <section data-step="done" hidden><p>Your books are now in My Library. You can return there to download them whenever you like.</p><a class="giveaway-primary" href="/distribution.html">Open My Library ↗</a></section>
    <p class="giveaway-status" role="status" aria-live="polite"></p>`;
  const forms=Object.fromEntries([...dialog.querySelectorAll('[data-step]')].map(node=>[node.dataset.step,node]));
  const message=dialog.querySelector('.giveaway-status');
  let code='',email='',token=sessionStorage.getItem('hfj-library-token')||'',busy=false;
  function status(text,error=false){message.textContent=text;message.classList.toggle('giveaway-error',error);}
  function stage(name){for(const [key,node]of Object.entries(forms))node.hidden=key!==name;forms[name].querySelector('input,button,a')?.focus();}
  async function run(action){
    if(busy)return;busy=true;
    dialog.querySelectorAll('form button, [data-claim], [data-other-email]').forEach(button=>button.disabled=true);
    try{await action();}catch(error){if(dialog.open)status(error.message,true);}
    finally{busy=false;dialog.querySelectorAll('form button, [data-claim], [data-other-email]').forEach(button=>button.disabled=false);}
  }
  async function redeem(){
    status('Adding your books to My Library…');
    try{
      const result=await post('giveaway',{action:'redeem',code,items,newsletterOptIn},token);
      if(!dialog.open)return;
      stage('done');status(result.newsletterWarning?'Your books are ready. You can update newsletter preferences in My Library.':'Your books have been added for free.');
      onSuccess();
    }catch(error){
      if(error.status===401){token='';sessionStorage.removeItem('hfj-library-token');stage('email');throw new Error('Please verify your email to claim these books.');}
      throw error;
    }
  }
  forms.coupon.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
    code=dialog.querySelector('#giveaway-code').value.trim();status('Checking your giveaway code…');
    await post('giveaway',{action:'check',code,items});if(!dialog.open)return;
    stage(token?'claim':'email');status('Code accepted. Your selected books will be free.');
  });});
  forms.email.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
    email=dialog.querySelector('#giveaway-email').value.trim().toLowerCase();status('Requesting your verification code…');
    await post('access',{action:'send',email});if(!dialog.open)return;
    dialog.querySelector('#giveaway-otp').value='';stage('verify');status('Use the newest code sent to your email.');
  });});
  forms.verify.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
    status('Verifying your email…');const result=await post('access',{action:'verify',email,code:dialog.querySelector('#giveaway-otp').value.trim()});
    if(!dialog.open)return;token=result.token;sessionStorage.setItem('hfj-library-token',token);
    // Verification consumes the OTP. A failed grant retries only the grant, never the OTP.
    stage('claim');await redeem();
  });});
  dialog.querySelector('[data-claim]').addEventListener('click',()=>run(redeem));
  dialog.querySelectorAll('[data-other-email]').forEach(button=>button.addEventListener('click',()=>{token='';stage('email');status('Enter the email you want to use for your library.');}));
  dialog.querySelector('.giveaway-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{code='';dialog.remove();if(activeDialog===dialog)activeDialog=null;if(returnFocus?.isConnected)returnFocus.focus();},{once:true});
  document.body.append(dialog);activeDialog=dialog;dialog.showModal();dialog.querySelector('#giveaway-code').focus();
}
