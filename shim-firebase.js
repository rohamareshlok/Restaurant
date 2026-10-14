import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,addDoc,onSnapshot,query,where,runTransaction,FieldPath} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const C=window.APP_CONFIG||{},BASE=(C.owners||[C.owner]).filter(Boolean).map(x=>String(x).trim().toLowerCase());
const app=initializeApp(C.firebase);
const auth=getAuth(app);
let fs;
try{fs=initializeFirestore(app,{ignoreUndefinedProperties:true,localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})})}
catch(e){fs=initializeFirestore(app,{ignoreUndefinedProperties:true})}

/* the app expects update() to merge nested objects (like Claude's store); Firestore replaces them, so send each leaf as its own field path */
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length>0;
function leaves(o,p=[],out=[]){for(const k of Object.keys(o)){const v=o[k];if(v===undefined)continue;if(plain(v))leaves(v,[...p,k],out);else out.push(new FieldPath(...p,k),v)}return out}
const mergeUpdate=(ref,d)=>{const a=leaves(d);return a.length?updateDoc(ref,...a):Promise.resolve()};

/* ---- database wrapper with the same shape the app already uses ---- */
const sDoc=s=>({id:s.id,exists:s.exists(),data:()=>s.data(),metadata:s.metadata});
const sQ=q=>({docs:q.docs.map(sDoc),size:q.size,empty:q.empty,docChanges:()=>q.docChanges(),metadata:q.metadata});
function Q(path,cons=[]){
  const ref=collection(fs,path),qq=()=>cons.length?query(ref,...cons):ref;
  return {where:(f,op,v)=>Q(path,[...cons,where(f,op,v)]),orderBy:()=>Q(path,cons),limit:()=>Q(path,cons),
    get:async()=>sQ(await getDocs(qq())),
    onSnapshot:(n,e)=>onSnapshot(qq(),s=>n(sQ(s)),e||(()=>{})),
    add:async d=>{const r=await addDoc(ref,d);return {id:r.id}},
    doc:id=>D(id?doc(fs,path,id):doc(ref))};
}
function D(ref){
  return {id:ref.id,
    get:async()=>sDoc(await getDoc(ref)),
    set:(d,o)=>setDoc(ref,d,o||{}),update:d=>mergeUpdate(ref,d),delete:()=>deleteDoc(ref),
    onSnapshot:(n,e)=>onSnapshot(ref,s=>n(sDoc(s)),e||(()=>{})),
    collection:p=>Q(ref.path+'/'+p),
    /* safe counters: two phones can never take the same bill number or overwrite stock */
    txNext:()=>runTransaction(fs,async tx=>{const s=await tx.get(ref);const n=(s.exists()?+s.data().n||0:0)+1;tx.set(ref,{n,at:Date.now()});return n}),
    txBump:(f,dl)=>runTransaction(fs,async tx=>{const s=await tx.get(ref);if(!s.exists())return null;const data=s.data();const v=+((+data[f]||0)+dl).toFixed(3);tx.update(ref,{[f]:v,updatedAt:Date.now()});return {v,data}})};
}
const db={collection:p=>Q(p),doc:p=>{const i=p.lastIndexOf('/');return D(doc(fs,p.slice(0,i),p.slice(i+1)))}};

/* ---- sign-in screen ---- */
const gate=document.createElement('div');gate.id='gate';
gate.innerHTML=`<style>#gate{position:fixed;inset:0;z-index:100;background:var(--bg,#eef2ef);display:grid;place-items:center;padding:24px;font-family:Figtree,system-ui,sans-serif}
#gate .card{background:var(--surface,#fff);border-radius:18px;padding:26px 22px;max-width:360px;width:100%;display:grid;gap:14px;text-align:center;box-shadow:0 8px 30px rgb(0 0 0/.08)}
#gate h1{font-family:'Bricolage Grotesque',sans-serif;font-size:22px;margin:0}#gate p{margin:0;color:var(--muted,#5a6a62);font-size:14px;line-height:1.45}
#gate button{min-height:48px;border-radius:12px;border:1px solid var(--line,#d6ded9);background:#fff;font:600 16px Figtree,sans-serif;cursor:pointer;display:flex;gap:10px;align-items:center;justify-content:center}
#gate button.go{background:#17201c;color:#fff;border:0}</style><div class="card" id="gateCard"></div>`;
const show=html=>{if(!gate.isConnected)document.body.appendChild(gate);gate.querySelector('#gateCard').innerHTML=html};
const hide=()=>gate.remove();
const name=()=>(document.title||'Restaurant').replace(/</g,'&lt;');
const G='<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
async function doSignIn(){
  const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
  try{await signInWithPopup(auth,p)}
  catch(e){if(e&&(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment'))await signInWithRedirect(auth,p);
    else if(e&&e.code!=='auth/popup-closed-by-user'&&e.code!=='auth/cancelled-popup-request')show(`<h1>${name()}</h1><p>Sign-in did not work (${e.code||'error'}). Check the internet and try again.</p><button class="go" id="gIn">${G} Try again</button>`),bind()}
}
function bind(){const b=document.getElementById('gIn');if(b)b.onclick=doSignIn;const o=document.getElementById('gOut');if(o)o.onclick=()=>signOut(auth)}
getRedirectResult(auth).catch(()=>{});
window.__fbSignOut=()=>signOut(auth);

let started=false;
onAuthStateChanged(auth,async u=>{
  if(!u){if(started){location.reload();return}
    show(`<h1>${name()}</h1><p>Sign in with the Google account the owner has given access to.</p><button class="go" id="gIn">${G} Sign in with Google</button>`);bind();return}
  const email=String(u.email||'').toLowerCase();
  let acc={};try{const a=await getDoc(doc(fs,'access','main'));acc=a.exists()?a.data():{}}catch(e){}
  const low=k=>(acc[k]||[]).map(x=>String(x).toLowerCase());
  let baseOwner=false,offline=false;try{await getDoc(doc(fs,'ownercheck','me'));baseOwner=true}catch(e){if(!e||e.code!=='permission-denied')offline=true}
  const role=baseOwner||BASE.includes(email)||low('owners').includes(email)?'owner':low('managers').includes(email)?'manager':low('staff').includes(email)?'staff':null;
  let r2=role;const key='role:'+email;try{if(r2)localStorage.setItem(key,r2);else if(offline)r2=localStorage.getItem(key)}catch(e){}
  if(!r2){show(`<h1>${name()}</h1><p><b>${email.replace(/</g,'&lt;')}</b> does not have access yet.<br>Ask an owner to add this email in Menu → App access.</p><button id="gOut">Use another account</button>`);bind();return}
  const isOwner=r2==='owner';
  window.__fbUser={email,isOwner,role:r2,uid:u.uid,name:u.displayName||'',baseOwners:baseOwner?[...BASE,email]:BASE};
  const user={isOwner:async()=>isOwner,canEdit:async()=>isOwner,can:async c=>c==='data.write'?true:null,id:async()=>u.uid,me:async()=>({id:u.uid,name:u.displayName||'',email})};
  hide();
  if(!started){started=true;window.__fbReady(db,user)}
});
