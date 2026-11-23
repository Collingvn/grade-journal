import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut,updateProfile} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {getDatabase,ref,get,runTransaction} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';
import {firebaseConfig} from './firebase-config.js';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const el=id=>document.getElementById(id);
let journalRef,version=0,pending=false,running=false,blocked=false,timer,loadedUid;
window.accountJournal={student:'',courses:[],demo:false};
function status(message){el('account-status').textContent=message;}
function errorMessage(e){return ({'auth/invalid-credential':'Email or password is incorrect.','auth/email-already-in-use':'This email already has an account. Sign in instead.','auth/weak-password':'Choose a password with at least six characters.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/network-request-failed':'Check your connection and try again.'})[e.code] || 'Unable to complete this request. '+(e.code || 'Please try again.');}
async function authenticate(){
 el('auth-error').textContent='';
 if(!el('auth-form').reportValidity())return;
 for(const b of el('auth-form').querySelectorAll('button'))b.disabled=true;
 try{await signInWithEmailAndPassword(auth,el('email').value.trim(),el('password').value);}
 catch(e){el('auth-error').textContent=errorMessage(e);}
 finally{for(const b of el('auth-form').querySelectorAll('button'))b.disabled=false;}
}
el('auth-form').onsubmit=e=>{e.preventDefault();authenticate();};
const signupForm=el('signup-form');
let registering=false;
let newUser;

el('signup').onclick=()=>{
 el('signup-email').value=el('email').value.trim();
 el('auth-error').textContent='';
 el('auth-view').hidden=true;
 el('signup-view').hidden=false;
 el('signup-title').focus();
};
el('back-to-login').onclick=()=>{
 signupForm.reset();
 el('signup-error').textContent='';
 el('signup-view').hidden=true;
 el('auth-view').hidden=false;
 el('signup').focus();
};
for(const name of [el('first-name'),el('last-name')]){
 name.oninput=()=>name.setCustomValidity('');
}
signupForm.onsubmit=async event=>{
 event.preventDefault();
 if(registering)return;

 const firstName=el('first-name'),lastName=el('last-name');
 firstName.setCustomValidity(firstName.value.trim()?'':'Enter your first name.');
 lastName.setCustomValidity(lastName.value.trim()?'':'Enter your last name.');
 if(!signupForm.reportValidity())return;

 const displayName=[firstName.value.trim(),lastName.value.trim()].join(' ');
 const email=el('signup-email'),password=el('signup-password');
 const error=el('signup-error'),submit=signupForm.querySelector('[type="submit"]');
 error.textContent='';
 registering=true;
 submit.disabled=true;
 el('back-to-login').disabled=true;
 try{
  if(!newUser){
   const credential=await createUserWithEmailAndPassword(auth,email.value.trim(),password.value);
   newUser=credential.user;
   email.readOnly=true;
   password.readOnly=true;
   password.value='';
  }
  await updateProfile(newUser,{displayName});
  const user=newUser;
  newUser=undefined;
  signupForm.reset();
  await loadJournal(user);
 }catch(e){
  error.textContent=newUser?'Your account was created. Submit again to save your name.':errorMessage(e);
 }finally{
  registering=false;
  submit.disabled=false;
  el('back-to-login').disabled=Boolean(newUser);
 }
};
el('reset').onclick=async()=>{if(!el('email').reportValidity())return;try{await sendPasswordResetEmail(auth,el('email').value.trim());el('auth-error').textContent='If an account exists, a reset email will arrive shortly.';}catch(e){el('auth-error').textContent=errorMessage(e);}};
// Category names are values because Firebase keys cannot contain characters like "." or "/".
function encodeJournal(journal){
 const courses=journal.courses.map(course=>({
  ...course,
  categoryWeights:Object.entries(course.categoryWeights||{}).map(([name,weight])=>({name,weight})),
  folderColors:Object.entries(course.folderColors||{}).map(([name,color])=>({name,color}))
 }));
 return {...journal,courses,schemaVersion:1};
}

function decodeJournal(saved){
 if(saved.schemaVersion!==1){
  if(typeof saved.document!=='string')throw Error('Invalid journal');
  const journal=JSON.parse(saved.document);
  if(!Array.isArray(journal.courses))throw Error('Invalid journal');
  return journal;
 }

 const {schemaVersion,version,courses,...journal}=saved;
 return {
  ...journal,
  courses:Object.values(courses||{}).map(course=>({
   ...course,
   assignments:Object.values(course.assignments||{}).map(assignment=>({
    ...assignment,earned:assignment.earned??null
   })),
   categoryWeights:Object.fromEntries(Object.values(course.categoryWeights||{}).map(({name,weight})=>[name,weight])),
   folderColors:Object.fromEntries(Object.values(course.folderColors||{}).map(({name,color})=>[name,color]))
  }))
 };
}

window.queueJournalSave=()=>{if(blocked)return;pending=true;status('Saving…');clearTimeout(timer);timer=setTimeout(flush,400);};
async function flush(){
 if(running||blocked||!pending||!journalRef)return;
 running=true;pending=false;
 const expected=version;
 try{
  const journal=encodeJournal(window.readJournal());
  const result=await runTransaction(journalRef,current=>{
   if((current?.version||0)!==expected)return;
   return {...journal,version:expected+1};
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
onAuthStateChanged(auth,user=>{
 if(registering || newUser)return;
 loadJournal(user);
});
async function loadJournal(user){
 if(!user){if(loadedUid){location.reload();return;}el('auth-view').hidden=false;return;}
 if(loadedUid){if(loadedUid!==user.uid)location.reload();return;}
 loadedUid=user.uid;window.journalUserId=user.uid;
 try{
  journalRef=ref(db,'users/'+user.uid+'/journal');
  const snapshot=await get(journalRef),saved=snapshot.val();
  version=saved?.version||0;
  if(saved)window.accountJournal=decodeJournal(saved);
  const journal=window.accountJournal;
  if(typeof journal.student!=='string' || !journal.student.trim())journal.student=user.displayName?.trim() || '';
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./app.js';script.onload=resolve;script.onerror=reject;document.body.append(script);});
  el('auth-view').hidden=true;el('signup-view').hidden=true;document.querySelector('header').hidden=false;document.querySelector('main').hidden=false;status('Saved to your account');
 }catch(e){
  const error=el(el('signup-view').hidden?'auth-error':'signup-error');
  error.textContent='Could not load your journal. '+(e.code||'Please reload and try again.');
  const button=document.createElement('button');
  button.textContent='Sign out';
  button.type='button';
  button.onclick=()=>signOut(auth).then(()=>location.reload());
  error.append(button);
 }
}
