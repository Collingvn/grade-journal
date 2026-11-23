import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {getDatabase,ref,get,runTransaction} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';
import {firebaseConfig} from './firebase-config.js';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const el=id=>document.getElementById(id);
let journalRef,version=0,pending=false,running=false,blocked=false,timer,loadedUid;
window.accountJournal={student:'',courses:[],demo:false};
function status(message){el('account-status').textContent=message;}
function errorMessage(e){return ({'auth/invalid-credential':'Email or password is incorrect.','auth/email-already-in-use':'This email already has an account. Sign in instead.','auth/weak-password':'Choose a password with at least six characters.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/network-request-failed':'Check your connection and try again.'})[e.code] || 'Unable to complete this request. '+(e.code || 'Please try again.');}
async function authenticate(signup=false){
 el('auth-error').textContent='';
 if(!el('auth-form').reportValidity())return;
 for(const b of el('auth-form').querySelectorAll('button'))b.disabled=true;
 try{await (signup?createUserWithEmailAndPassword:signInWithEmailAndPassword)(auth,el('email').value.trim(),el('password').value);}
 catch(e){el('auth-error').textContent=errorMessage(e);}
 finally{for(const b of el('auth-form').querySelectorAll('button'))b.disabled=false;}
}
el('auth-form').onsubmit=e=>{e.preventDefault();authenticate();};
el('signup').onclick=()=>authenticate(true);
el('reset').onclick=async()=>{if(!el('email').reportValidity())return;try{await sendPasswordResetEmail(auth,el('email').value.trim());el('auth-error').textContent='If an account exists, a reset email will arrive shortly.';}catch(e){el('auth-error').textContent=errorMessage(e);}};
window.queueJournalSave=()=>{if(blocked)return;pending=true;status('Saving…');clearTimeout(timer);timer=setTimeout(flush,400);};
async function flush(){
 if(running||blocked||!pending||!journalRef)return;
 running=true;pending=false;
 const document=JSON.stringify(window.readJournal()),expected=version;
 try{
  const result=await runTransaction(journalRef,current=>{
   if((current?.version||0)!==expected)return;
   return {document,version:expected+1};
  },{applyLocally:false});
  if(!result.committed){blocked=true;pending=true;status('Journal changed in another tab. Export your changes, then reload.');return;}
  version=expected+1;status(pending?'Saving…':'Saved to your account');el('retry-save').hidden=true;
 }catch(e){pending=true;status('Not saved. Check your connection and retry.');el('retry-save').hidden=false;}
 finally{running=false;}
 if(pending&&!blocked&&el('retry-save').hidden)await flush();
}
el('retry-save').onclick=flush;
el('signout').onclick=async()=>{clearTimeout(timer);await flush();if(pending||running||blocked){status('Save or export your changes before signing out.');return;}await signOut(auth);location.reload();};
window.addEventListener('beforeunload',e=>{if(pending||running){e.preventDefault();e.returnValue='';}});
onAuthStateChanged(auth,async user=>{
 if(!user){if(loadedUid){location.reload();return;}el('auth-view').hidden=false;return;}
 if(loadedUid){if(loadedUid!==user.uid)location.reload();return;}
 loadedUid=user.uid;window.journalUserId=user.uid;
 try{
  journalRef=ref(db,'users/'+user.uid+'/journal');
  const snapshot=await get(journalRef),saved=snapshot.val();
  version=saved?.version||0;
  if(saved?.document){const journal=JSON.parse(saved.document);if(!Array.isArray(journal.courses))throw Error('Invalid journal');window.accountJournal=journal;}
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./app.js';script.onload=resolve;script.onerror=reject;document.body.append(script);});
  el('auth-view').hidden=true;document.querySelector('header').hidden=false;document.querySelector('main').hidden=false;status('Saved to your account');
 }catch(e){el('auth-error').textContent='Could not load your journal. '+(e.code||'Please reload and try again.');const button=document.createElement('button');button.textContent='Sign out';button.onclick=()=>signOut(auth).then(()=>location.reload());el('auth-error').append(button);}
});
