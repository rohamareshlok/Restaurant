/* Bridge: gives the app the same window.claude.use(...) it had inside Claude,
   backed by Firebase (database + Google sign-in) instead. */
(function(){
  const R={};const wait=k=>new Promise(r=>R[k]=r);
  const pDb=wait('db'),pUser=wait('user');
  const downloads={save:async({filename,data})=>{
    const blob=data instanceof Blob?data:new Blob([data]);const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},4000);return {status:'saved'}}};
  window.claude={use:async n=>n==='db'?pDb:n==='user'?pUser:n==='downloads'?downloads:null};
  window.__fbReady=(db,user)=>{R.db(db);R.user(user)};
})();
