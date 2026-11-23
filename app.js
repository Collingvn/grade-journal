function newId(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')}
const KEY='composition-journal-v1';
const demo={student:'',courses:[{id:'cs',name:'Introduction to Programming',code:'CS 215',credits:3,semester:'Fall 2026',notes:'',assignments:[{id:'a1',name:'Assignment 01 · Fundamentals',earned:94,possible:100,weight:15},{id:'a2',name:'Midterm exam',earned:88,possible:100,weight:25},{id:'a3',name:'Final project',earned:null,possible:100,weight:35},{id:'a4',name:'Final exam',earned:null,possible:100,weight:25}]},{id:'math',name:'College Algebra',code:'MATH 120',credits:3,semester:'Fall 2026',notes:'',assignments:[{id:'m1',name:'Problem sets',earned:96,possible:100,weight:40},{id:'m2',name:'Midterm exam',earned:91,possible:100,weight:30},{id:'m3',name:'Final exam',earned:null,possible:100,weight:30}]},{id:'eng',name:'English Composition',code:'ENG 101',credits:3,semester:'Fall 2026',notes:'',assignments:[{id:'e1',name:'Personal narrative',earned:89,possible:100,weight:25},{id:'e2',name:'Research essay',earned:92,possible:100,weight:35},{id:'e3',name:'Final portfolio',earned:null,possible:100,weight:40}]}],demo:true};
let data=window.accountJournal;let active='all',editing=null;
let selectedSemester=null;
function semesterName(c){return String(c.semester||'').trim()||'Unspecified semester'}
function semesterCourses(){return selectedSemester===null?data.courses:data.courses.filter(c=>semesterName(c)===selectedSemester)}

const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATEGORIES=['Homework','Exams','Quizzes','Final Exam/Project','Extra Credit'];
function category(a){return a.category||'Homework'}
function categories(c){return Object.keys(c.categoryWeights||{}).length?Object.keys(c.categoryWeights):CATEGORIES}
function regularCategories(c){return categories(c).filter(cat=>cat!=='Extra Credit')}
// Preserve existing scores and weights while assigning legacy entries a category.
for(const c of data.courses)for(const a of c.assignments){if(!CATEGORIES.includes(a.category)&&!Object.hasOwn(c.categoryWeights||{},a.category))a.category=/extra credit/i.test(a.name)?'Extra Credit':/final/i.test(a.name)?'Final Exam/Project':/quiz/i.test(a.name)?'Quizzes':/exam|midterm/i.test(a.name)?'Exams':'Homework'}
function ensureWeights(c){if(!c.categoryWeights){c.categoryWeights=Object.fromEntries(CATEGORIES.map(cat=>[cat,c.assignments.filter(a=>category(a)===cat).reduce((sum,a)=>sum+(Number(a.weight)||0),0)]));}}
for(const c of data.courses)ensureWeights(c);
function examCount(c){return c.examCount||Math.max(1,c.assignments.filter(a=>category(a)==='Exams').length)}
function activeWeight(c,cat){const w=c.categoryWeights[cat]||0;return cat==='Exams'?w*c.assignments.filter(a=>category(a)===cat&&a.earned!==null).length/examCount(c):w}
function categoryAverage(c,cat){const items=c.assignments.filter(a=>category(a)===cat&&a.earned!==null);if(cat==='Exams')return items.length?items.reduce((sum,a)=>sum+a.earned/a.possible*100,0)/items.length:null;const possible=items.reduce((sum,a)=>sum+a.possible,0);return possible?items.reduce((sum,a)=>sum+a.earned,0)/possible*100:null}
function examSplit(weight,count){return count>0?`${weight}% ÷ ${count} exams = ${Number((weight/count).toFixed(4))}% per exam`:'Enter the number of exams.'}
function legacyWeightForm(c){return `<form id="category-weights" class="weights-panel"><div class="section-line"><h3>Category weights</h3><button type="submit" class="primary">Save weights</button></div><div class="weight-fields">${CATEGORIES.map((cat,i)=>`<label>${cat} (%)<input name="weight-${i}" aria-label="${cat} weight" type="number" min="0" max="100" step="any" required value="${c.categoryWeights[cat]||0}"></label>`).join('')}</div><div class="exam-settings"><label>Number of exams<input id="exam-count" name="exam-count" type="number" min="1" max="100" step="1" required value="${examCount(c)}"></label><p id="exam-split">${examSplit(c.categoryWeights.Exams||0,examCount(c))}</p></div><p class="category-help">Homework, Exams, Quizzes, and Final Exam/Project must total 100%. Extra Credit is added on top: 10% extra credit gives a 110% total. Enter 0 for categories not offered. Exams are weighted equally. Other categories use total earned points divided by total possible points. Ungraded work stays out of the current average.</p><p id="weight-status" role="status"></p></form>`}
function legacyPdfStore(action,key,value){return new Promise((resolve,reject)=>{const open=indexedDB.open('composition-pdfs',1);open.onupgradeneeded=()=>open.result.createObjectStore('files');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('files',action==='get'?'readonly':'readwrite'),store=tx.objectStore('files');const request=action==='get'?store.get(key):action==='put'?store.put(value,key):store.delete(key);tx.oncomplete=()=>{resolve(request.result);db.close()};tx.onerror=()=>{reject(tx.error);db.close()};tx.onabort=()=>{reject(tx.error);db.close()}}})}
async function validatePdf(file){if(file.size>20*1024*1024)throw Error('Choose a PDF smaller than 20 MB.');if(!/\.pdf$/i.test(file.name)||!(await file.slice(0,5).text()).startsWith('%PDF-'))throw Error('Choose a valid PDF file.');}
function assignmentAttachment(assignment) {
  if (!assignment.pdfId) return '';
  return `<button type="button" class="assignment-notebook" data-pdf="${esc(assignment.id)}" aria-label="Open PDF: ${esc(assignment.pdfName||'Assignment.pdf')}"><span aria-hidden="true"></span></button>`;
}
function assignmentDetails(a) {
  return `<span class="assignment-name">${esc(a.name)}</span>${a.feedback ? `<details class="assignment-notes"><summary>Notes / feedback</summary><p>${esc(a.feedback)}</p></details>` : ''}`;
}
const folderPalette = ['Sand', 'Blue', 'Mint', 'Rose', 'Lavender', 'Peach', 'Teal', 'Slate'];
let openAssignmentCategory = null;

function folderColor(course, name, index) {
  const savedColor = Object.hasOwn(course.folderColors || {}, name) && course.folderColors[name];
  return folderPalette.includes(savedColor) ? savedColor : folderPalette[index % 5];
}

function folderColorField(color, label, id = '') {
  const group = id || label;
  return `<div class="folder-color-field">
    <span>Folder color</span>
    <details class="folder-picker">
      <summary class="folder-color-trigger" data-color="${color}" aria-label="${label}: ${color}">
        <i class="folder-swatch" aria-hidden="true"></i><span>${color}</span>
      </summary>
      <div class="folder-options" role="group" aria-label="${label}">
        ${folderPalette.map(option => `<label class="folder-option" data-color="${option}">
          <input type="radio" name="${group}" value="${option}" ${option === color ? 'checked' : ''}>
          <i class="folder-swatch" aria-hidden="true"></i><span>${option}</span>
        </label>`).join('')}
      </div>
      <input type="hidden" ${id ? `id="${id}"` : ''} data-setting="color" value="${color}">
    </details>
  </div>`;
}

function assignmentFolders(course) {
  const names = categories(course);
  const activeIndex = Math.max(0, names.indexOf(openAssignmentCategory));
  const folders = names.map((name, index) => {
    const count = course.assignments.filter(item => category(item) === name).length;
    return `<button type="button" class="assignment-folder" data-folder="${index}"
      data-color="${folderColor(course, name, index)}" aria-controls="assignment-group-${index}"
      aria-pressed="${index === activeIndex}">
      <strong>${esc(name)}</strong>
      <span>${count} ${count === 1 ? 'assignment' : 'assignments'}</span>
    </button>`;
  }).join('');
  return `<div class="assignment-folders" role="group" aria-label="Assignment categories">${folders}</div>
    ${assignmentGroups(course, activeIndex)}`;
}

document.addEventListener('click', event => {
  const folder = event.target.closest('button[data-folder]');
  if (!folder) return;
  const course = data.courses.find(item => item.id === active);
  if (!course) return;
  openAssignmentCategory = categories(course)[Number(folder.dataset.folder)];
  for (const button of folder.parentElement.querySelectorAll('button[data-folder]')) {
    const selected = button === folder;
    button.setAttribute('aria-pressed', String(selected));
    document.getElementById(button.getAttribute('aria-controls')).hidden = !selected;
  }
});

function assignmentGroups(c,activeIndex){return categories(c).map((cat,index)=>{const items=c.assignments.filter(a=>category(a)===cat);return `<section class="assignment-group" id="assignment-group-${index}" ${index === activeIndex ? '' : 'hidden'}><div class="category-heading"><h4>${esc(cat)}</h4></div>${items.length?`<div class="table-wrap"><table><thead><tr><th scope="col">Assignment</th><th scope="col">Attachments</th><th scope="col">Score</th><th scope="col">Grade</th><th scope="col" aria-label="Actions"></th></tr></thead><tbody>${items.map(a=>`<tr><td>${assignmentDetails(a)}</td><td>${assignmentAttachment(a)}</td><td>${a.earned===null?'Ungraded':a.earned+' / '+a.possible}</td><td>${a.earned===null?'—':(a.earned/a.possible*100).toFixed(1)+'%'}</td><td><button type="button" class="assignment-edit" data-edit="${esc(a.id)}" aria-label="Edit assignment: ${esc(a.name)}"><span class="assignment-pencil" aria-hidden="true">✎</span><span class="assignment-edit-tooltip" aria-hidden="true">Edit</span></button></td></tr>`).join('')}</tbody></table></div>`:'<p class="category-empty">No assignments yet.</p>'}</section>`}).join('')}
function save(){window.queueJournalSave();}
window.readJournal=()=>data;
window.replaceJournal=value=>{
 data=value;
 for(const course of data.courses) ensureWeights(course);
 active='all';
 save();
 render();
};

function average(c){ensureWeights(c);let weighted=0,total=0;for(const cat of regularCategories(c)){const n=categoryAverage(c,cat),w=activeWeight(c,cat);if(n!==null&&w>0){weighted+=n*w;total+=w}}if(!total)return null;const extra=categoryAverage(c,'Extra Credit');return weighted/total+(extra===null?0:extra/100*(c.categoryWeights['Extra Credit']||0))}

function letter(n){return n===null?'—':n>=90?'A':n>=80?'B':n>=70?'C':n>=60?'D':'F'}
function points(n){return n>=90?4:n>=80?3:n>=70?2:n>=60?1:0}
function gpa(courses=data.courses){let sum=0,credits=0;courses.forEach(c=>{const n=average(c);if(n!==null){sum+=points(n)*c.credits;credits+=c.credits}});return credits?(sum/credits).toFixed(2):'—'}
const pct=n=>n===null?'—':n.toFixed(1)+'%';
function render(){
  const terms=[...new Set(data.courses.map(semesterName))];
  const current=data.courses.find(c=>c.id===active);
  if(current&&selectedSemester!==null)selectedSemester=semesterName(current);
  if(selectedSemester!==null&&!terms.includes(selectedSemester))selectedSemester=null;
  const courses=semesterCourses();
  $('#semester-tabs').innerHTML=`<button data-semester="all" aria-pressed="${selectedSemester===null}">All semesters</button>`+terms.map((term,index)=>`<button data-semester="${index}" aria-pressed="${selectedSemester===term}">${esc(term)} <span>${data.courses.filter(c=>semesterName(c)===term).length}</span></button>`).join('');
  $('#student').value=data.student;$('#tabs').innerHTML=`<button data-tab="all" class="${active==='all'?'active':''}">All Classes</button>`+courses.map(c=>`<button data-tab="${c.id}" class="${active===c.id?'active':''}">${esc(c.code)}</button>`).join('')+'<button data-action="new-class" aria-label="Add class">＋</button>';const c=data.courses.find(c=>c.id===active);$('#eyebrow').parentElement.hidden=Boolean(c);$('#eyebrow').textContent=c?`${c.semester} / ${c.code}`:(selectedSemester===null?'ALL SEMESTERS AT A GLANCE':selectedSemester.toUpperCase());$('#page-number').textContent=c?String(data.courses.indexOf(c)+2).padStart(2,'0'):'01';$('#content').innerHTML=c?classPage(c):allPage();}
function allPage(){const courses=semesterCourses();const graded=courses.reduce((s,c)=>s+c.assignments.filter(a=>a.earned!==null).length,0);return `<div class="heading"><div><h2>A clear view of your semester.</h2><div class="subtitle">Your classes, grades, and progress. All in one place.</div></div><button class="primary" data-action="new-class">＋ Add class</button></div><div class="stats"><div class="stat dashboard-folder" data-color="Lavender"><small>ESTIMATED GPA</small><strong>${gpa(courses)}</strong></div><div class="stat dashboard-folder" data-color="Sand"><small>YOUR CLASSES</small><strong>${courses.length.toString().padStart(2,'0')}</strong><span>${courses.reduce((s,c)=>s+c.credits,0)} credits</span></div><div class="stat dashboard-folder" data-color="Mint"><small>GRADES RECORDED</small><strong>${String(graded).padStart(2,'0')}</strong></div></div><div class="section-line"><h3>${selectedSemester===null?'Your classes':esc(selectedSemester)+' classes'}</h3><small>SELECT A CLASS TO EXPLORE</small></div>${courses.map(c=>`<button class="course" style="width:100%;text-align:left" data-tab="${c.id}"><span class="course-icon">${esc(c.code.split(' ')[0])}</span><span class="course-info"><strong>${esc(c.name)}</strong><p>${esc(c.code)} &nbsp; / &nbsp; ${c.credits} credits &nbsp; / &nbsp; ${esc(c.semester)}</p></span><span class="grade">${letter(average(c))}<small>${pct(average(c))}</small></span><span>↗</span></button>`).join('')||'<p class="empty">Your notebook is ready. Add your first class above.</p>'}<div class="note"><b>${data.demo?'Make this space your own.':'A note on your numbers'}</b>${data.demo?'Explore the sample classes, or <button class="text-btn" data-action="clear-demo">start with an empty notebook</button>. ':''}Grades use category weights and points earned within each category. GPA uses credit hours and A/B/C/D/F = 4/3/2/1/0, without plus/minus. Current estimates include graded work only. Categories set to 0% are excluded.</div>`}
function classPage(c){ensureWeights(c);const total=categories(c).reduce((sum,cat)=>sum+(c.categoryWeights[cat]||0),0);return `<div class="heading"><div><h2>${esc(c.name)}</h2><p class="subtitle">${esc(c.code)} · ${c.credits} credits · ${esc(c.semester)}</p></div><button class="primary" data-action="edit-class">Manage class</button></div><div class="class-grade">
  <div><span>Current grade</span><strong>${pct(average(c))}</strong></div>
  <span class="class-letter" aria-label="Letter grade: ${letter(average(c))}">${letter(average(c))}</span>
</div><div class="section-line"><h3>Assignments</h3><button class="primary" data-action="new-assignment">＋ Add assignment</button></div>${assignmentFolders(c)}<details class="class-grading-details">
  <summary><span class="weight-icon" aria-hidden="true">%</span><span>Category weights</span><span class="weight-chevron" aria-hidden="true"></span></summary>
  ${weightForm(c)}
  ${Math.abs(total-(100+(c.categoryWeights['Extra Credit']||0)))>0.00001
    ? '<p class="weight-warning">Regular category weights must total 100%, plus Extra Credit.</p>' : ''}
</details><div class="section-line"><h3>Notes to self</h3><small>Autosaved to your account</small></div><textarea id="notes" aria-label="Class journal notes" placeholder="Add a note…">${esc(c.notes)}</textarea>`}
function field(label,name,value='',type='text',extra=''){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`}
function semesterFields(value){
  const match=/^(Fall|Winter|Spring|Summer)\s+(\d{4})$/i.exec(String(value||'').trim());
  const seasons=['Fall','Winter','Spring','Summer'];
  const season=match?seasons.find(term=>term.toLowerCase()===match[1].toLowerCase()):'Fall';
  const year=match?Number(match[2]):new Date().getFullYear();
  const currentYear=new Date().getFullYear();
  const years=Array.from({length:Math.max(currentYear+10,year)-Math.min(currentYear-20,year)+1},(_,i)=>Math.min(currentYear-20,year)+i);
  return `<div class="semester-fields"><label>Semester<select name="semester-season" required>${seasons.map(term=>`<option value="${term}" ${term===season?'selected':''}>${term}</option>`).join('')}</select></label><label>Year<select name="semester-year" required>${years.map(value=>`<option value="${value}" ${value===year?'selected':''}>${value}</option>`).join('')}</select></label></div>`;
}
function openEditor(kind,id){const c=data.courses.find(c=>c.id===active),a=c?.assignments.find(a=>a.id===id);editing={kind,id};$('#error').textContent='';$('#fields').innerHTML=kind==='class'?`<h3>${c&&id?'Edit class':'A new chapter'}</h3>${field('Class name','name',id?c.name:'','text','required maxlength="80"')}${field('Course code','code',id?c.code:'','text','required maxlength="20"')}${field('Credit hours','credits',id?c.credits:3,'number','required min="0.5" max="30" step="0.5"')}${semesterFields(id?c.semester:selectedSemester)}`:`<h3>${a?'Edit assignment':'Into the ledger'}</h3>${field('Assignment name','name',a?.name||'','text','required maxlength="100"')}<label>Category<select name="category">${categories(c).map(cat=>`<option value="${esc(cat)}" ${cat===(a?category(a):(categories(c).includes(openAssignmentCategory)?openAssignmentCategory:categories(c)[0]))?'selected':''}>${esc(cat)}</option>`).join('')}</select></label>${field('Points earned (leave blank if ungraded)','earned',a?.earned??'','number','min="0" step="any"')}${field('Points possible','possible',a?.possible??100,'number','required min="0.01" step="any"')}<label class="pdf-question"><input id="attach-pdf" type="checkbox" ${a?.pdfId?'checked':''}> Would you like to attach a PDF?</label><div id="pdf-picker" ${a?.pdfId?'':'hidden'}>${a?.pdfId?`<p class="category-help">Attached: ${esc(a.pdfName)}. Choose a file to replace it, or uncheck the box to remove it.</p>`:''}<label>Select PDF<input name="pdf" type="file" accept="application/pdf,.pdf"></label><p class="category-help">Up to 20 MB. Saved to your account. PDF files are not included in the grade export.</p></div><label>Notes / feedback (optional)<textarea name="feedback" maxlength="10000" placeholder="Instructions, professor feedback, or reminders…">${esc(a?.feedback||'')}</textarea></label>${a?'<button class="text-btn danger" type="button" data-action="delete-assignment">Delete assignment</button>':''}`;$('#modal').showModal();}
$('#editor').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),c=data.courses.find(c=>c.id===active);if(editing.kind==='class'){const v={name:f.get('name').trim(),code:f.get('code').trim(),credits:Number(f.get('credits')),semester:f.get('semester-season')+' '+f.get('semester-year')};if(!v.name||!v.code||!v.semester)return; if(editing.id)Object.assign(c,v);else{const n={...v,id:newId(),assignments:[],notes:'',categoryWeights:{Homework:0,Exams:0,Quizzes:0,'Final Exam/Project':0,'Extra Credit':0}};data.courses.push(n);active=n.id}}else{const v={feedback:f.get('feedback').trim(),category:f.get('category'),name:f.get('name').trim(),earned:f.get('earned')===''?null:Number(f.get('earned')),possible:Number(f.get('possible'))};if(!v.name)return;if(v.category==='Exams'&&c.assignments.filter(a=>category(a)==='Exams'&&a.id!==editing.id).length>=examCount(c)){$('#error').textContent='Increase the Number of exams in Category weights before adding another exam.';return}const previous=c.assignments.find(a=>a.id===editing.id);v.pdfId=previous?.pdfId||null;v.pdfName=previous?.pdfName||'';if($('#attach-pdf').checked){const file=f.get('pdf');if(file?.size){try{await validatePdf(file);const key=newId();await pdfStore('put',key,file);v.pdfId=key;v.pdfName=file.name}catch(error){$('#error').textContent=error.message||'Unable to save PDF. Check browser storage and try again.';return}}else if(!v.pdfId){$('#error').textContent='Choose a PDF, or uncheck the attachment option.';return}}else{v.pdfId=null;v.pdfName=''}if(editing.id)Object.assign(previous,v);else c.assignments.push({...v,id:newId()});openAssignmentCategory=v.category}save();$('#modal').close();render()};
document.addEventListener('submit',e=>{if(e.target.id!=='category-weights')return;e.preventDefault();const f=new FormData(e.target),weights=Object.fromEntries(CATEGORIES.map((cat,i)=>[cat,Number(f.get('weight-'+i))]));const total=CATEGORIES.slice(0,-1).reduce((sum,cat)=>sum+weights[cat],0);if(Math.abs(total-100)>0.00001){$('#weight-status').textContent=`Regular category weights total ${total}%. Set them to 100%; Extra Credit is added on top.`;$('#weight-status').className='error';return}const course=data.courses.find(c=>c.id===active),count=Number(f.get('exam-count'));if(!Number.isInteger(count)||count<1||count>100||count<course.assignments.filter(a=>category(a)==='Exams').length){$('#weight-status').textContent='Enter a whole exam count at least as large as the number of exams already recorded.';$('#weight-status').className='error';return}course.examCount=count;course.categoryWeights=weights;save();render();$('#weight-status').textContent=`Category weights saved. Total: ${total+weights['Extra Credit']}% (100% regular + ${weights['Extra Credit']}% Extra Credit).`});
document.addEventListener('click' ,async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.pdf){const course=data.courses.find(c=>c.id===active),a=course?.assignments.find(a=>a.id===b.dataset.pdf);const win=window.open('about:blank','_blank');if(win)win.opener=null;try{const file=await pdfStore('get',a.pdfId);if(!file)throw Error('This PDF is not available in this browser. Edit the assignment to attach it again.');const url=URL.createObjectURL(file);if(win)win.location.href=url;else{const link=document.createElement('a');link.href=url;link.download=a.pdfName;link.click()}setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(error){if(win)win.close();alert(error.message||'Unable to open PDF.')}return}if(b.dataset.semester!==undefined){const terms=[...new Set(data.courses.map(semesterName))];selectedSemester=b.dataset.semester==='all'?null:terms[Number(b.dataset.semester)];active='all';render();return}if(b.dataset.tab){active=b.dataset.tab;render();return}if(b.dataset.edit){openEditor('assignment',b.dataset.edit);return}const action=b.dataset.action,c=data.courses.find(c=>c.id===active);if(action==='new-class')openEditor('class');if(action==='edit-class')openEditor('class',c.id);if(action==='new-assignment')openEditor('assignment');if(action==='clear-demo'&&confirm('Remove the sample classes and start an empty notebook?')){data.courses=[];data.demo=false;save();render()}if(action==='delete-class'&&c&&confirm('Delete this class and all of its grades and notes?')){data.courses=data.courses.filter(x=>x.id!==active);active='all';$('#modal').close();save();render()}if(action==='delete-assignment'&&confirm('Delete this assignment?')){c.assignments=c.assignments.filter(a=>a.id!==editing.id);save();$('#modal').close();render()}});
$('.close').onclick=()=>$('#modal').close();$('#student').oninput=e=>{data.student=e.target.value;save()};document.addEventListener('input',e=>{if(e.target.name==='weight-1'||e.target.id==='exam-count'){$('#exam-split').textContent=examSplit(Number(document.querySelector('[name="weight-1"]').value),Number($('#exam-count').value))}if(e.target.id==='notes'){data.courses.find(c=>c.id===active).notes=e.target.value;save()}});$('#backup').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='composition-notebook.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};render();

document.addEventListener('change',e=>{if(e.target.id==='attach-pdf')$('#pdf-picker').hidden=!e.target.checked});


// Per-class grading setup. Existing category weights and assignments remain intact.
let gradingDraft = [];
function gradingRow(row, index) {
  return `<div class="grading-row" data-row="${index}">
    <label>Category name<input data-setting="name" maxlength="60" required value="${esc(row.name)}" aria-label="Category ${index+1} name"></label>
    <label>Weight (%)<input data-setting="weight" type="number" min="0" max="100" step="any" required value="${row.weight}" aria-label="Category ${index+1} weight"></label>
    ${folderColorField(row.color, `Category ${index+1} folder color`)}
    <button type="button" class="text-btn danger" data-remove-category="${index}" aria-label="Remove category ${index+1}">Remove</button>
  </div>`;
}
function gradingSetup(c) {
  const names = categories(c);
  gradingDraft = names.map((name, index) => ({
    name, weight: c.categoryWeights[name] || 0, color: folderColor(c, name, index)
  })).filter(row => row.name !== 'Extra Credit');
  return `<fieldset class="grading-setup"><legend>Grading setup for this class</legend>
    <p class="category-help">Match your syllabus: rename categories, set their weights, or add your own. Each class has its own setup.</p>
    <div id="grading-rows">${gradingDraft.map(gradingRow).join('')}</div>
    <button type="button" class="text-btn" id="add-category">＋ Add custom category</button>
    <div class="extra-credit-settings"><label>Extra Credit (%) — optional<input id="setup-extra" type="number" min="0" max="100" step="any" value="${c.categoryWeights['Extra Credit']||0}"></label>
      ${folderColorField(folderColor(c, 'Extra Credit', Math.max(0,names.indexOf('Extra Credit'))), 'Extra Credit folder color', 'setup-extra-color')}
    </div>
    <label>Number of equally weighted exams<input id="setup-exams" type="number" min="1" max="100" step="1" value="${examCount(c)}"></label>
    <p class="category-help">The exam count applies to the category named Exams. Other categories use points earned ÷ points possible. Extra Credit is added on top of the regular 100%.</p>
    <p id="setup-total" role="status"></p></fieldset>`;
}
function readDraft() {
  return [...document.querySelectorAll('#grading-rows .grading-row')].map(row=>({name:row.querySelector('[data-setting="name"]').value.trim(),weight:Number(row.querySelector('[data-setting="weight"]').value),color:row.querySelector('[data-setting="color"]').value}));
}
function updateSetupTotal() {
  const total=readDraft().reduce((sum,row)=>sum+row.weight,0);
  $('#setup-total').textContent=`Regular category total: ${Number(total.toFixed(4))}% / 100%`;
  $('#setup-total').className=Math.abs(total-100)<0.00001?'setup-valid':'error';
}
function validateSetup(c) {
  const rows=readDraft(), names=rows.map(row=>row.name.toLowerCase());
  if(!rows.length||rows.some(row=>!row.name||!Number.isFinite(row.weight)||row.weight<0||row.weight>100))throw Error('Enter a name and a weight from 0 to 100 for each category.');
  if(new Set(names).size!==names.length||names.includes('extra credit'))throw Error('Use unique category names. Set Extra Credit in its separate field.');
  if(Math.abs(rows.reduce((sum,row)=>sum+row.weight,0)-100)>0.00001)throw Error('Regular category weights must total 100%.');
  const extra=Number($('#setup-extra').value),count=Number($('#setup-exams').value);
  if(!Number.isFinite(extra)||extra<0||extra>100)throw Error('Extra Credit must be from 0 to 100%.');
  if(!Number.isInteger(count)||count<1||count>100)throw Error('Enter a whole exam count from 1 to 100.');
  const weights=Object.fromEntries(rows.map(row=>[row.name,row.weight]));
  weights['Extra Credit']=extra;
  if(c?.assignments.some(a=>!Object.hasOwn(weights,category(a))))throw Error('A category with assignments cannot be removed or renamed yet. Move its assignments to another category first.');
  if(c&&count<c.assignments.filter(a=>category(a)==='Exams').length)throw Error('The exam count cannot be smaller than the exams already recorded.');
  const folderColors = Object.fromEntries(rows.map(row => [row.name, row.color]));
  folderColors['Extra Credit'] = $('#setup-extra-color').value;
  return {categoryWeights:weights,examCount:count,folderColors};
}
const originalOpenEditor=openEditor;
openEditor=function(kind,id){
  originalOpenEditor(kind,id);
  if(kind!=='class')return;
  const c=id?data.courses.find(c=>c.id===id):{assignments:[],categoryWeights:{Homework:20,Exams:40,Quizzes:10,'Final Exam/Project':30,'Extra Credit':0},examCount:2};
  $('#fields').insertAdjacentHTML('beforeend',gradingSetup(c));
  if (id) {
    $('#fields').insertAdjacentHTML('beforeend',
      '<div class="class-delete-action"><button type="button" class="text-btn danger" data-action="delete-class">Delete class</button></div>');
  }
  updateSetupTotal();
};
const originalSubmit=$('#editor').onsubmit;
$('#editor').onsubmit=async function(e){
  if(editing.kind!=='class')return originalSubmit(e);
  e.preventDefault();
  const existing=editing.id?data.courses.find(c=>c.id===editing.id):null;
  let settings;
  try{settings=validateSetup(existing)}catch(error){$('#error').textContent=error.message;return}
  await originalSubmit(e);
  if(!$('#modal').open){Object.assign(data.courses.find(c=>c.id===active),settings);save();render()}
};
function weightForm(course) {
  const cards = categories(course).map((name, index) => {
    const weight = Number(course.categoryWeights[name]) || 0;
    const barWidth = Math.max(0, Math.min(100, weight));
    return `<div class="weight-card" data-color="${folderColor(course, name, index)}">
      <span>${esc(name)}</span><strong>${weight}%</strong>
      <div class="weight-track" aria-hidden="true"><span style="width:${barWidth}%"></span></div>
    </div>`;
  }).join('');
  return `<div class="weight-summary">${cards}</div>`;
}
document.addEventListener('click',e=>{
  if(e.target.closest('#add-category')){
    gradingDraft=readDraft();gradingDraft.push({name:'',weight:0,color:folderPalette[gradingDraft.length % folderPalette.length]});
    $('#grading-rows').innerHTML=gradingDraft.map(gradingRow).join('');
    $('#grading-rows .grading-row:last-child input').focus();updateSetupTotal();
  }
  const remove=e.target.closest('[data-remove-category]');
  if(remove){gradingDraft=readDraft();gradingDraft.splice(Number(remove.dataset.removeCategory),1);$('#grading-rows').innerHTML=gradingDraft.map(gradingRow).join('');updateSetupTotal()}
});
document.addEventListener('input',e=>{if(e.target.closest('.grading-setup'))updateSetupTotal()});
render();

document.addEventListener('change', event => {
  if (!event.target.matches('.folder-option input')) return;
  const picker = event.target.closest('.folder-picker');
  const trigger = picker.querySelector('summary');
  const color = event.target.value;
  picker.querySelector('[data-setting="color"]').value = color;
  trigger.dataset.color = color;
  trigger.querySelector('span').textContent = color;
  trigger.setAttribute('aria-label', picker.querySelector('.folder-options').getAttribute('aria-label') + ': ' + color);
});
document.addEventListener('click', event => {
  for (const picker of document.querySelectorAll('.folder-picker[open]')) {
    if (!picker.contains(event.target)) picker.open = false;
  }
  const option = event.target.closest('.folder-option input');
  if (!option || event.detail === 0) return;
  const picker = option.closest('.folder-picker');
  picker.open = false;
  picker.querySelector('summary').focus();
});
document.addEventListener('keydown', event => {
  const picker = event.target.closest('.folder-picker[open]');
  if (!picker || event.key !== 'Escape') return;
  event.preventDefault();
  picker.open = false;
  picker.querySelector('summary').focus();
});

const pdfPreview = document.createElement('aside');
pdfPreview.className = 'assignment-pdf-preview';
pdfPreview.hidden = true;
pdfPreview.setAttribute('aria-hidden', 'true');
document.body.append(pdfPreview);
let previewButton = null;
let previewUrl = null;

function closePdfPreview() {
  previewButton = null;
  pdfPreview.hidden = true;
  pdfPreview.replaceChildren();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

async function showPdfPreview(button) {
  if (previewButton === button) return;
  closePdfPreview();
  previewButton = button;
  const course = data.courses.find(item => item.id === active);
  const assignment = course?.assignments.find(item => item.id === button.dataset.pdf);
  if (!assignment?.pdfId) return;
  try {
    const file = await pdfStore('get', assignment.pdfId);
    if (previewButton !== button || !button.isConnected || !file) return;
    previewUrl = URL.createObjectURL(file.slice(0, file.size, 'application/pdf'));
    const filename = document.createElement('strong');
    filename.textContent = assignment.pdfName || 'Assignment PDF';
    const frame = document.createElement('iframe');
    frame.title = filename.textContent;
    frame.tabIndex = -1;
    frame.src = previewUrl + '#page=1&view=Fit&toolbar=0';
    pdfPreview.replaceChildren(filename, frame);
    pdfPreview.hidden = false;
    const anchor = button.getBoundingClientRect();
    const width = pdfPreview.offsetWidth;
    const height = pdfPreview.offsetHeight;
    pdfPreview.style.left = Math.max(8, Math.min(anchor.left, innerWidth - width - 8)) + 'px';
    const top = anchor.bottom + 6 + height <= innerHeight ? anchor.bottom + 6 : anchor.top - height - 6;
    pdfPreview.style.top = Math.max(8, top) + 'px';
  } catch {
    if (previewButton === button) closePdfPreview();
  }
}

document.addEventListener('pointerover', event => {
  const button = event.target.closest('.assignment-notebook');
  if (button && event.pointerType !== 'touch') showPdfPreview(button);
});
document.addEventListener('pointerout', event => {
  const button = event.target.closest('.assignment-notebook');
  if (button && button === previewButton && !button.contains(event.relatedTarget) &&
      document.activeElement !== button) closePdfPreview();
});
document.addEventListener('focusin', event => {
  if (event.target.matches('.assignment-notebook:focus-visible')) showPdfPreview(event.target);
});
document.addEventListener('focusout', event => {
  if (event.target === previewButton) closePdfPreview();
});
document.addEventListener('click', closePdfPreview);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closePdfPreview();
});
window.addEventListener('scroll', closePdfPreview, true);
window.addEventListener('resize', closePdfPreview);

window.readLegacyPdf=key=>legacyPdfStore('get',key);
window.cloudPdfStore=(action,key,value)=>legacyPdfStore(action,window.journalUserId+':'+key,value);
function pdfStore(action,key,value){return window.cloudPdfStore(action,key,value);}
