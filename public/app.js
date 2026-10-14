/* Esteshari multi-project cloud app © Nexus Solutions */
const STATUS={submitted:{label:'Submitted',cls:'b-submitted'},under_review:{label:'Under Review',cls:'b-under_review'},approved:{label:'Approved',cls:'b-approved'},approved_as_noted:{label:'Approved as Noted',cls:'b-approved_as_noted'},revise_resubmit:{label:'Revise & Resubmit',cls:'b-revise_resubmit'},rejected:{label:'Rejected',cls:'b-rejected'},info_required:{label:'Info Required',cls:'b-info_required'}};
const DECISIONS={A:{label:'Approved',status:'approved'},B:{label:'Approved as Noted',status:'approved_as_noted'},C:{label:'Revise & Resubmit',status:'revise_resubmit'},D:{label:'Rejected',status:'rejected'},E:{label:'Additional Information Required',status:'info_required'}};
const DISCIPLINES=['HVAC','Firefighting','Plumbing and Drainage','Medical Gases','Elevators','MEP Coordination','Other / General'];
const CATEGORIES=['IR – Inspection Request','MIR – Material Inspection Request','QSS – Quantity Survey Sheet','Shop Drawings','Material Submittals','Method Statements','Technical Data Sheets','Inspection & Test Plans','Coordination Drawings','As-Built Drawings','Other'];
/* v2.1 – document types (IR / MIR / QSS). Labels are editable by you. */
const DOC_TYPES={
  Submittal:{label:'Submittal',short:'Submittal',cls:'badge-t-submittal'},
  IR:{label:'IR – Inspection Request',short:'IR',cls:'badge-t-ir'},
  MIR:{label:'MIR – Material Inspection Request',short:'MIR',cls:'badge-t-mir'},
  QSS:{label:'QSS – Quantity Survey Sheet',short:'QSS',cls:'badge-t-qss'}
};
const CFG=()=>window.ESTESHARI_CONFIG||{};
const BUCKET=()=>CFG().STORAGE_BUCKET||'documents';
const MAX_MB=()=>CFG().MAX_FILE_MB||25;
let sb=null,currentUser=null,profile=null,page='dashboard',confirmDecision=false,myProjects=[],activeProjectId=null;
let updateInfo=null,updateBusy=false;
let regFilters={q:'',type:'',status:'',disc:''};

function configured(){const c=window.ESTESHARI_CONFIG||{};return c.SUPABASE_URL&&c.SUPABASE_ANON_KEY&&!String(c.SUPABASE_URL).includes('PASTE_')&&!String(c.SUPABASE_ANON_KEY).includes('PASTE_');}
function initSupabase(){if(!configured()){document.getElementById('configWarn')?.classList.remove('hidden');return false;}document.getElementById('configWarn')?.classList.add('hidden');sb=window.supabase.createClient(window.ESTESHARI_CONFIG.SUPABASE_URL,window.ESTESHARI_CONFIG.SUPABASE_ANON_KEY);return true;}
function esc(s){if(!s)return'';const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function fmt(ts){if(!ts)return'—';return new Date(ts).toLocaleString('en-GB',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function showTab(w){document.getElementById('loginForm').classList.toggle('hidden',w!=='login');document.getElementById('regForm').classList.toggle('hidden',w!=='register');document.getElementById('tabLogin').classList.toggle('active',w==='login');document.getElementById('tabReg').classList.toggle('active',w==='register');document.getElementById('authError').classList.add('hidden');document.getElementById('authHeading').textContent=w==='login'?'Welcome back':'Create your account';document.getElementById('authLead').textContent=w==='login'?'Sign in to your Esteshari cloud account':'Register as Consultant or Contractor';}
function selectRole(r){document.getElementById('regRole').value=r;document.getElementById('roleConsultant').classList.toggle('selected',r==='consultant');document.getElementById('roleContractor').classList.toggle('selected',r==='contractor');}
function showErr(m){const el=document.getElementById('authError');el.textContent=m;el.classList.remove('hidden');}

async function doRegister(){if(!sb)return showErr('Configure cloud keys in config.js first.');const role=document.getElementById('regRole').value,fullName=document.getElementById('regName').value.trim(),email=document.getElementById('regEmail').value.trim(),password=document.getElementById('regPass').value;if(!role)return showErr('Select Consultant or Contractor.');if(!fullName||!email||!password)return showErr('All fields required.');if(password.length<6)return showErr('Password min 6 characters.');const{data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:fullName,role}}});if(error)return showErr(error.message);if(!data.user)return showErr('Registration failed.');await sb.from('profiles').upsert({id:data.user.id,full_name:fullName,role});if(!data.session)return showErr('Account created. Disable Confirm email in Supabase Auth for instant login, or confirm email then sign in.');currentUser=data.user;await loadProfile();await enterApp();}
async function doLogin(){if(!sb)return showErr('Configure cloud keys in config.js first.');const{data,error}=await sb.auth.signInWithPassword({email:document.getElementById('loginEmail').value.trim(),password:document.getElementById('loginPass').value});if(error)return showErr(error.message);currentUser=data.user;await loadProfile();await enterApp();}
async function loadProfile(){const{data}=await sb.from('profiles').select('*').eq('id',currentUser.id).single();profile=data||{id:currentUser.id,full_name:currentUser.user_metadata?.full_name||currentUser.email,role:currentUser.user_metadata?.role||'contractor'};}
async function doLogout(){if(sb)await sb.auth.signOut();currentUser=null;profile=null;myProjects=[];activeProjectId=null;document.getElementById('appScreen').classList.add('hidden');document.getElementById('authScreen').classList.remove('hidden');showTab('login');}
async function loadProjects(){const{data:mems}=await sb.from('project_members').select('project_id,member_role,projects(id,code,name,client,location,description,created_by,created_at)').eq('user_id',currentUser.id);myProjects=(mems||[]).map(m=>({...m.projects,member_role:m.member_role})).filter(p=>p&&p.id);if(activeProjectId&&!myProjects.find(p=>p.id===activeProjectId))activeProjectId=null;if(!activeProjectId&&myProjects.length)activeProjectId=myProjects[0].id;try{sessionStorage.setItem('esteshari_project',activeProjectId||'');}catch(_){}}
function activeProject(){return myProjects.find(p=>p.id===activeProjectId)||null;}
function isProjectAdmin(){const p=activeProject();return p&&p.member_role==='admin';}
function canConsultOnProject(){const p=activeProject();return p&&(p.member_role==='admin'||p.member_role==='consultant');}
function canSubmitOnProject(){const p=activeProject();return p&&(p.member_role==='admin'||p.member_role==='contractor');}
async function enterApp(){document.getElementById('authScreen').classList.add('hidden');document.getElementById('appScreen').classList.remove('hidden');try{const s=sessionStorage.getItem('esteshari_project');if(s)activeProjectId=s;}catch(_){}await loadProjects();page=myProjects.length?'dashboard':'projects';renderApp();}
function openSide(){document.getElementById('sidebar').classList.add('open');document.getElementById('sideOverlay').classList.remove('hidden');}
function closeSide(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sideOverlay').classList.add('hidden');}
function navItems(){return[{id:'dashboard',label:'Dashboard'},{id:'projects',label:'Projects'},{id:'register',label:'Document Register'},{id:'submit',label:'Submit Document',need:'submit'},{id:'reviews',label:'Pending Reviews',need:'consult'},{id:'notifications',label:'Notifications'},{id:'profile',label:'My Profile'}].filter(i=>{if(i.need==='submit')return canSubmitOnProject();if(i.need==='consult')return canConsultOnProject();return true;});}
async function unreadCount(){const{count}=await sb.from('notifications').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id).eq('read',false);return count||0;}
async function renderNav(){const unread=await unreadCount();const proj=activeProject();document.getElementById('navLinks').innerHTML=`<div class="nav-sec">Project</div><div style="padding:0 10px 12px"><select id="projectSelect" onchange="switchProject(this.value)" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text)"><option value="">— Select project —</option>${myProjects.map(p=>`<option value="${p.id}" ${p.id===activeProjectId?'selected':''}>${esc(p.code)} – ${esc(p.name)}</option>`).join('')}</select></div><div class="nav-sec">Menu</div>`+navItems().map(i=>{const badge=(i.id==='notifications'&&unread>0)?`<span class="badge-n">${unread>9?'9+':unread}</span>`:'';return `<a href="#" class="${page===i.id?'active':''}" onclick="go('${i.id}');return false;">${i.label}${badge}</a>`;}).join('');document.getElementById('userName').textContent=profile.full_name;document.getElementById('userRole').textContent=(profile.role==='consultant'?'Consultant':'Contractor')+(proj?' · '+proj.member_role:'');const sv=document.getElementById('sideVersion');if(sv&&!sv.textContent)sv.textContent='v'+currentVersion();}
async function switchProject(id){activeProjectId=id||null;try{sessionStorage.setItem('esteshari_project',activeProjectId||'');}catch(_){}page='dashboard';renderApp();}
function go(p){page=p;confirmDecision=false;closeSide();renderApp();}
async function renderApp(){await renderNav();const el=document.getElementById('pageContent');try{if(page==='dashboard')el.innerHTML=await viewDashboard();else if(page==='projects')el.innerHTML=await viewProjects();else if(page==='register')el.innerHTML=await viewRegister();else if(page==='submit')el.innerHTML=viewSubmit();else if(page==='reviews')el.innerHTML=await viewReviews();else if(page==='notifications')el.innerHTML=await viewNotifications();else if(page.startsWith('doc:'))el.innerHTML=await viewDoc(page.slice(4));else if(page.startsWith('members:'))el.innerHTML=await viewMembers(page.slice(8));else if(page==='profile')el.innerHTML=viewProfile();}catch(e){el.innerHTML=`<div class="alert alert-err">${esc(e.message)}</div>`;}}
/* ---------- v2.1: profile ---------- */
function viewProfile(){
  const email=currentUser.email||'',name=profile.full_name||'';
  const roleOpts=['consultant','contractor'].map(r=>`<option value="${r}" ${profile.role===r?'selected':''}>${r==='consultant'?'Consultant – review & approve':'Contractor – submit documents'}</option>`).join('');
  return`<h1 class="page-title">My Profile</h1><p class="page-sub">Update your name, e-mail address and password. Changes apply on every device.</p>
  <div class="card"><div class="card-h">Account</div><div class="card-b"><div id="profMsg"></div>
    <div class="fg"><label>Full name *</label><input id="pfName" value="${esc(name)}"></div>
    <div class="fg"><label>E-mail address *</label><input id="pfEmail" type="email" value="${esc(email)}"></div>
    <div class="fg"><label>Account type</label><select id="pfRole">${roleOpts}</select></div>
    <button class="btn btn-primary btn-sm" onclick="saveProfile()">Save profile</button>
  </div></div>
  <div class="card"><div class="card-h">Change password</div><div class="card-b"><div id="pwMsg"></div>
    <div class="fg"><label>Current password</label><input id="pwCur" type="password" autocomplete="current-password"></div>
    <div class="fg"><label>New password</label><input id="pwNew" type="password" autocomplete="new-password" oninput="pwStrength(this.value)"><div class="pw-meter"><i id="pwBar"></i></div><div id="pwHint" style="font-size:11px;color:var(--muted);margin-top:4px">Min 6 characters</div></div>
    <div class="fg"><label>Confirm new password</label><input id="pwNew2" type="password" autocomplete="new-password"></div>
    <button class="btn btn-primary btn-sm" onclick="changePassword()">Update password</button>
  </div></div>
  <div class="card"><div class="card-h">Application</div><div class="card-b"><div class="meta-grid"><div><div class="label">Version</div><span id="profVersion">${esc(CFG().APP_VERSION||'2.1.0')}</span></div><div><div class="label">Desktop build</div><span id="profDesktop">—</span></div></div><div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="checkUpdate(true)">Check for updates</button></div></div></div>`;
}
function pwStrength(v){
  let s=0;if(v.length>=6)s++;if(v.length>=10)s++;if(/[A-Z]/.test(v)&&/[a-z]/.test(v))s++;if(/\d/.test(v))s++;if(/[^\w]/.test(v))s++;
  const bar=document.getElementById('pwBar');if(!bar)return;
  const cols=['#ef4444','#f97316','#eab308','#84cc16','#22c55e'];
  bar.style.width=Math.min(100,s*20)+'%';bar.style.background=cols[Math.max(0,s-1)];
}
async function saveProfile(){
  const msg=document.getElementById('profMsg'),name=document.getElementById('pfName').value.trim(),email=document.getElementById('pfEmail').value.trim(),role=document.getElementById('pfRole').value;
  if(!name||!email)return msg.innerHTML=`<div class="alert alert-err">Name and e-mail are required.</div>`;
  msg.innerHTML=`<div class="alert alert-warn">Saving…</div>`;
  const{error:e1}=await sb.from('profiles').update({full_name:name,role}).eq('id',currentUser.id);
  if(e1)return msg.innerHTML=`<div class="alert alert-err">${esc(e1.message)}</div>`;
  let emailNote='';
  if(email!==(currentUser.email||'')){
    const{error:e2}=await sb.auth.updateUser({email,data:{full_name:name,role}});
    if(e2)msg.innerHTML=`<div class="alert alert-warn">Profile saved, but the e-mail change was rejected: ${esc(e2.message)}</div>`;
    else{emailNote=' A confirmation link was sent to the new e-mail if confirmation is enabled in Supabase.';const{data:{user}}=await sb.auth.getUser();if(user)currentUser=user;}
  }else{
    await sb.auth.updateUser({data:{full_name:name,role}});
  }
  await loadProfile();renderNav();
  msg.innerHTML=`<div class="alert alert-ok">Profile updated.${esc(emailNote)}</div>`;
}
async function changePassword(){
  const msg=document.getElementById('pwMsg'),cur=document.getElementById('pwCur').value,n1=document.getElementById('pwNew').value,n2=document.getElementById('pwNew2').value;
  if(!cur)return msg.innerHTML=`<div class="alert alert-err">Enter your current password.</div>`;
  if(n1.length<6)return msg.innerHTML=`<div class="alert alert-err">New password must be at least 6 characters.</div>`;
  if(n1!==n2)return msg.innerHTML=`<div class="alert alert-err">The two new passwords do not match.</div>`;
  msg.innerHTML=`<div class="alert alert-warn">Updating…</div>`;
  const{error:re}=await sb.auth.signInWithPassword({email:currentUser.email,password:cur});
  if(re)return msg.innerHTML=`<div class="alert alert-err">Current password is wrong.</div>`;
  const{error}=await sb.auth.updateUser({password:n1});
  if(error)return msg.innerHTML=`<div class="alert alert-err">${esc(error.message)}</div>`;
  ['pwCur','pwNew','pwNew2'].forEach(i=>document.getElementById(i).value='');
  msg.innerHTML=`<div class="alert alert-ok">Password updated.</div>`;
}

async function viewProjects(){const listHtml=myProjects.map(p=>`<tr><td class="mono">${esc(p.code)}</td><td>${esc(p.name)}</td><td>${esc(p.client||'—')}</td><td><span class="badge b-submitted">${esc(p.member_role)}</span></td><td><div class="row-actions"><a href="#" onclick="switchProject('${p.id}');go('dashboard');return false;">Open</a>${p.member_role==='admin'?`<a href="#" onclick="go('members:${p.id}');return false;">Members</a><a href="#" onclick="openProjectEdit('${p.id}');return false;">Edit</a><a href="#" class="link-danger" onclick="askDeleteProject('${p.id}');return false;">Delete</a>`:''}</div></td></tr>`).join('')||`<tr><td colspan="5" class="empty">No projects yet. Create one below.</td></tr>`;return `<h1 class="page-title">Projects</h1><p class="page-sub">Only members of a project can see its documents. Project admins can edit or delete their projects.</p><div class="card"><div class="card-h">My projects</div><div style="overflow-x:auto"><table><thead><tr><th>Code</th><th>Name</th><th>Client</th><th>Your role</th><th></th></tr></thead><tbody>${listHtml}</tbody></table></div></div><div class="card"><div class="card-h">Create new project</div><div class="card-b"><div id="projMsg"></div><div class="grid-3"><div class="fg"><label>Project code *</label><input id="pCode" class="mono" placeholder="PRJ-001"></div><div class="fg" style="grid-column:span 2"><label>Project name *</label><input id="pName" placeholder="Building MEP works"></div></div><div class="grid-3"><div class="fg"><label>Client</label><input id="pClient"></div><div class="fg" style="grid-column:span 2"><label>Location</label><input id="pLoc"></div></div><div class="fg"><label>Description</label><textarea id="pDesc" rows="2"></textarea></div><button class="btn btn-primary btn-sm" onclick="createProject()">Create Project</button></div></div>`;}

/* ---------- v2.1: edit / delete project ---------- */
function openProjectEdit(id){const p=myProjects.find(x=>x.id===id);if(!p||p.member_role!=='admin')return alert('Only the project admin can edit it.');closeModal();document.body.insertAdjacentHTML('beforeend',`<div class="modal-back" id="projModal" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-h"><span>Edit project</span><button class="modal-x" onclick="closeModal()">×</button></div><div class="modal-b"><div id="pmMsg"></div><div class="fg"><label>Project code *</label><input id="eCode" class="mono" value="${esc(p.code)}"></div><div class="fg"><label>Project name *</label><input id="eName" value="${esc(p.name)}"></div><div class="grid-3"><div class="fg"><label>Client</label><input id="eClient" value="${esc(p.client||'')}"></div><div class="fg" style="grid-column:span 2"><label>Location</label><input id="eLoc" value="${esc(p.location||'')}"></div></div><div class="fg"><label>Description</label><textarea id="eDesc" rows="3">${esc(p.description||'')}</textarea></div><div style="display:flex;gap:10px"><button class="btn btn-primary btn-sm" onclick="saveProject('${p.id}')">Save changes</button><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button></div></div></div></div>`);}
async function saveProject(id){const msg=document.getElementById('pmMsg'),code=document.getElementById('eCode').value.trim(),name=document.getElementById('eName').value.trim();if(!code||!name){msg.innerHTML=`<div class="alert alert-err">Code and name are required.</div>`;return;}const{error}=await sb.from('projects').update({code,name,client:document.getElementById('eClient').value.trim(),location:document.getElementById('eLoc').value.trim(),description:document.getElementById('eDesc').value.trim()}).eq('id',id);if(error){msg.innerHTML=`<div class="alert alert-err">${esc(error.message)}</div>`;return;}closeModal();await loadProjects();go('projects');toastFlash('Project updated.');}
function askDeleteProject(id){const p=myProjects.find(x=>x.id===id);if(!p||p.member_role!=='admin')return alert('Only the project admin can delete it.');closeModal();document.body.insertAdjacentHTML('beforeend',`<div class="modal-back" id="projModal" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-h"><span class="link-danger">Delete project</span><button class="modal-x" onclick="closeModal()">×</button></div><div class="modal-b"><div class="alert alert-warn">This permanently deletes <strong>${esc(p.code)} – ${esc(p.name)}</strong> with all of its documents, files, decisions and history. This cannot be undone.</div><div class="fg"><label>Type the project code <span class="mono">${esc(p.code)}</span> to confirm</label><input id="dConfirm" class="mono" placeholder="${esc(p.code)}"></div><div id="pmMsg"></div><div style="display:flex;gap:10px"><button class="btn btn-danger btn-sm" onclick="deleteProject('${p.id}')">Delete permanently</button><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button></div></div></div></div>`);}
async function deleteProject(id){const p=myProjects.find(x=>x.id===id),msg=document.getElementById('pmMsg'),typed=(document.getElementById('dConfirm').value||'').trim();if(typed!==p.code){msg.innerHTML=`<div class="alert alert-err">The code does not match.</div>`;return;}const{error}=await sb.from('projects').delete().eq('id',id);if(error){msg.innerHTML=`<div class="alert alert-err">${esc(error.message)}</div>`;return;}closeModal();activeProjectId=null;await loadProjects();go('projects');toastFlash('Project deleted.');}
function closeModal(){document.getElementById('projModal')?.remove();}
function toastFlash(text){const el=document.createElement('div');el.textContent=text;el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:10px 18px;border-radius:10px;font-size:13px;z-index:200';document.body.appendChild(el);setTimeout(()=>el.remove(),2500);}
async function createProject(){const code=document.getElementById('pCode').value.trim(),name=document.getElementById('pName').value.trim(),msg=document.getElementById('projMsg');if(!code||!name){msg.innerHTML=`<div class="alert alert-err">Code and name are required.</div>`;return;}const{data,error}=await sb.from('projects').insert({code,name,client:document.getElementById('pClient').value.trim(),location:document.getElementById('pLoc').value.trim(),description:document.getElementById('pDesc').value.trim(),created_by:currentUser.id}).select().single();if(error){msg.innerHTML=`<div class="alert alert-err">${esc(error.message)}</div>`;return;}const{error:e2}=await sb.from('project_members').insert({project_id:data.id,user_id:currentUser.id,member_role:'admin'});if(e2){msg.innerHTML=`<div class="alert alert-err">${esc(e2.message)}</div>`;return;}await loadProjects();activeProjectId=data.id;msg.innerHTML=`<div class="alert alert-ok">Project created. You are admin.</div>`;setTimeout(()=>go('members:'+data.id),500);}

async function viewMembers(projectId){const proj=myProjects.find(p=>p.id===projectId);if(!proj||proj.member_role!=='admin')return`<div class="alert alert-err">Only project admins can manage members.</div>`;const{data:members}=await sb.from('project_members').select('id,member_role,user_id,profiles(full_name,role)').eq('project_id',projectId);const{data:allProfiles}=await sb.from('profiles').select('id,full_name,role');const rows=(members||[]).map(m=>`<tr><td>${esc(m.profiles?.full_name||m.user_id)}</td><td>${esc(m.profiles?.role||'')}</td><td>${esc(m.member_role)}</td><td>${m.user_id!==currentUser.id?`<a href="#" onclick="removeMember('${m.id}','${projectId}');return false;">Remove</a>`:'—'}</td></tr>`).join('');const opts=(allProfiles||[]).filter(p=>!(members||[]).find(m=>m.user_id===p.id)).map(p=>`<option value="${p.id}">${esc(p.full_name)} (${esc(p.role)})</option>`).join('');return `<div style="margin-bottom:10px"><a href="#" onclick="go('projects');return false;">← Projects</a></div><h1 class="page-title">Members – ${esc(proj.name)}</h1><p class="page-sub">${esc(proj.code)} · Only listed members see this project.</p><div class="card"><div class="card-h">Current members</div><div style="overflow-x:auto"><table><thead><tr><th>Name</th><th>Account</th><th>Project role</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="4" class="empty">No members</td></tr>`}</tbody></table></div></div><div class="card"><div class="card-h">Add member</div><div class="card-b"><div id="memMsg"></div><p style="font-size:13px;color:var(--muted);margin-bottom:12px">User must already have an Esteshari account.</p><div class="grid-3"><div class="fg" style="grid-column:span 2"><label>User</label><select id="memUser"><option value="">Select user</option>${opts}</select></div><div class="fg"><label>Project role</label><select id="memRole"><option value="consultant">Consultant</option><option value="contractor">Contractor</option><option value="admin">Admin</option></select></div></div><button class="btn btn-primary btn-sm" onclick="addMember('${projectId}')">Add Member</button></div></div>`;}
async function addMember(projectId){const userId=document.getElementById('memUser').value,role=document.getElementById('memRole').value,msg=document.getElementById('memMsg');if(!userId){msg.innerHTML=`<div class="alert alert-err">Select a user.</div>`;return;}const{error}=await sb.from('project_members').insert({project_id:projectId,user_id:userId,member_role:role});if(error){msg.innerHTML=`<div class="alert alert-err">${esc(error.message)}</div>`;return;}await sb.from('notifications').insert({user_id:userId,title:'Added to project',body:'You were added to a project on Esteshari.',link:null});go('members:'+projectId);}
async function removeMember(memberId,projectId){if(!confirm('Remove this member?'))return;await sb.from('project_members').delete().eq('id',memberId);go('members:'+projectId);}

async function fetchSubmissions(){if(!activeProjectId)return[];const{data,error}=await sb.from('submissions').select('*').eq('project_id',activeProjectId).order('updated_at',{ascending:false});if(error)throw new Error(error.message);return data||[];}
async function viewDashboard(){if(!activeProjectId)return`<h1 class="page-title">Dashboard</h1><div class="alert alert-warn">No project selected. <a href="#" onclick="go('projects');return false;">Create or open a project</a>.</div>`;const docs=await fetchSubmissions(),proj=activeProject();const pending=docs.filter(d=>d.status==='submitted'||d.status==='under_review').length,approved=docs.filter(d=>d.status==='approved'||d.status==='approved_as_noted').length,revise=docs.filter(d=>d.status==='revise_resubmit'||d.status==='info_required').length,rejected=docs.filter(d=>d.status==='rejected').length,under=docs.filter(d=>d.status==='under_review').length;const rows=docs.slice(0,8).map(d=>{const st=STATUS[d.status]||STATUS.submitted;return`<tr><td class="mono">${esc(d.document_number)}</td><td>${esc(d.title)}</td><td>${esc(d.revision)}</td><td><span class="badge ${st.cls}">${st.label}</span></td><td><a href="#" onclick="go('doc:${d.id}');return false;">Open</a></td></tr>`;}).join('')||`<tr><td colspan="5" class="empty">No documents in this project yet</td></tr>`;return`<div class="cloud-badge">☁ Cloud · Project isolation</div><h1 class="page-title">Dashboard</h1><p class="page-sub">${esc(proj.code)} – ${esc(proj.name)}</p><div class="stats"><div class="stat c1"><div class="num">${myProjects.length}</div><div class="lbl">My Projects</div></div><div class="stat c2"><div class="num">${pending}</div><div class="lbl">Awaiting</div></div><div class="stat c3"><div class="num">${under}</div><div class="lbl">Under Review</div></div><div class="stat c4"><div class="num">${approved}</div><div class="lbl">Approved</div></div><div class="stat c5"><div class="num">${revise}</div><div class="lbl">Resubmit</div></div><div class="stat c6"><div class="num">${rejected}</div><div class="lbl">Rejected</div></div></div><div class="actions-row">${canSubmitOnProject()?`<button class="btn btn-primary btn-sm" onclick="go('submit')">+ Submit Document</button>`:''}${canConsultOnProject()?`<button class="btn btn-ghost btn-sm" onclick="go('reviews')">Pending Reviews (${pending})</button>`:''}<button class="btn btn-ghost btn-sm" onclick="go('projects')">Projects</button></div><div class="card"><div class="card-h">Recent documents</div><div style="overflow-x:auto"><table><thead><tr><th>Doc No.</th><th>Title</th><th>Rev</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;}

async function viewRegister(){
  if(!activeProjectId)return`<div class="alert alert-warn">Select a project first.</div>`;
  const docs=await fetchSubmissions(),proj=activeProject(),f=regFilters;
  let list=docs;
  if(f.q)list=list.filter(d=>((d.document_number||'')+' '+(d.title||'')+' '+(d.discipline||'')+' '+(d.category||'')+' '+(d.file_name||'')).toLowerCase().includes(f.q.toLowerCase()));
  if(f.type)list=list.filter(d=>(d.doc_type||'Submittal')===f.type);
  if(f.status)list=list.filter(d=>d.status===f.status);
  if(f.disc)list=list.filter(d=>d.discipline===f.disc);
  const rows=list.map(d=>{
    const st=STATUS[d.status]||STATUS.submitted,dt=DOC_TYPES[d.doc_type||'Submittal']||DOC_TYPES.Submittal;
    return`<tr><td><span class="badge ${dt.cls}">${esc(dt.short||dt.label.split(' – ')[0])}</span></td><td class="mono">${esc(d.document_number)}</td><td>${esc(d.title)}</td><td>${esc(d.revision)}</td><td>${esc(d.discipline)}</td><td class="center">${d.file_path?'📄':''}</td><td><span class="badge ${st.cls}">${st.label}</span></td><td><div class="row-actions"><a href="#" onclick="go('doc:${d.id}');return false;">Open</a>${d.file_path?`<a href="#" onclick="openPdf('${d.id}')">PDF</a>`:''}</div></td></tr>`;
  }).join('')||`<tr><td colspan="8" class="empty">No documents match</td></tr>`;
  const typeOpts=Object.keys(DOC_TYPES).map(k=>`<option value="${k}" ${f.type===k?'selected':''}>${esc(DOC_TYPES[k].label)}</option>`).join('');
  const statusOpts=Object.keys(STATUS).map(k=>`<option value="${k}" ${f.status===k?'selected':''}>${esc(STATUS[k].label)}</option>`).join('');
  const discOpts=DISCIPLINES.map(d=>`<option value="${esc(d)}" ${f.disc===d?'selected':''}>${esc(d)}</option>`).join('');
  return`<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-bottom:16px"><h1 class="page-title" style="margin:0">Document Register</h1><div class="table-tools">${canSubmitOnProject()?`<button class="btn btn-primary btn-sm" onclick="go('submit')">+ New</button>`:''}<button class="btn btn-ghost btn-sm" onclick="exportApprovalsPdf()">⬇ Export approvals (PDF)</button></div></div>
  <p class="page-sub">${esc(proj.code)} – ${esc(proj.name)} · ${list.length} of ${docs.length} documents</p>
  <div class="filters">
    <input id="fq" placeholder="Search number, title, file…" value="${esc(f.q)}" oninput="setRegFilter('q',this.value)">
    <select onchange="setRegFilter('type',this.value)"><option value="">All types</option>${typeOpts}</select>
    <select onchange="setRegFilter('status',this.value)"><option value="">All statuses</option>${statusOpts}</select>
    <select onchange="setRegFilter('disc',this.value)"><option value="">All disciplines</option>${discOpts}</select>
    <button class="btn btn-ghost btn-sm" onclick="clearRegFilters()">Clear</button>
  </div>
  <div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Type</th><th>Doc No.</th><th>Title</th><th>Rev</th><th>Discipline</th><th>File</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function setRegFilter(k,v){regFilters[k]=v;go('register');setTimeout(()=>{const el=document.getElementById('fq');if(el&&k==='q'){el.focus();el.setSelectionRange(v.length,v.length);}},0);}
function clearRegFilters(){regFilters={q:'',type:'',status:'',disc:''};go('register');}
function viewSubmit(){if(!activeProjectId||!canSubmitOnProject())return`<div class="alert alert-err">Select a project where you can submit.</div>`;const proj=activeProject();const discOpts=DISCIPLINES.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');const catOpts=CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');const typeOpts=Object.keys(DOC_TYPES).map(k=>`<option value="${k}">${esc(DOC_TYPES[k].label)}</option>`).join('');return`<h1 class="page-title">Submit Document</h1><p class="page-sub">${esc(proj.code)} – ${esc(proj.name)}</p><div class="card"><div class="card-b"><div id="submitMsg"></div><div class="fg"><label>Document type *</label><select id="fType" onchange="syncTypeFields()"><option value="Submittal">${esc(DOC_TYPES.Submittal.label)}</option><option value="IR">${esc(DOC_TYPES.IR.label)}</option><option value="MIR">${esc(DOC_TYPES.MIR.label)}</option><option value="QSS">${esc(DOC_TYPES.QSS.label)}</option></select></div><div class="grid-3"><div class="fg"><label>Discipline *</label><select id="fDisc"><option value="">Select</option>${discOpts}</select></div><div class="fg" style="grid-column:span 2"><label>Category *</label><select id="fCat"><option value="">Select</option>${catOpts}</select></div></div><div class="grid-3"><div class="fg"><label>Document Number *</label><input id="fNum" class="mono"></div><div class="fg"><label>Revision *</label><input id="fRev" value="A"></div><div class="fg"><label>File name</label><input id="fFile" placeholder="auto from the PDF"></div></div><div class="fg"><label>Title *</label><input id="fTitle"></div><div class="fg"><label>Description</label><textarea id="fDesc" rows="2"></textarea></div><div class="fg"><label>Notes</label><textarea id="fNotes" rows="2"></textarea></div><div class="fg"><label>Attach PDF (technical sheets / drawings) — optional, max ${MAX_MB()} MB</label><input type="file" id="fPdf" accept="application/pdf,.pdf" onchange="pickPdf(this)"></div><div id="fPdfInfo"></div><button class="btn btn-primary btn-sm" onclick="doSubmit()" id="btnSubmit">Submit Document</button></div></div>`;}
function syncTypeFields(){const t=document.getElementById('fType').value,needRef=(t==='IR'||t==='MIR'||t==='QSS');const hold=document.getElementById('fRefHold');if(needRef&&!hold){const box=document.createElement('div');box.id='fRefHold';box.innerHTML=`<div class="grid-3"><div class="fg"><label>Reference / Transmittal no.</label><input id="fRef" class="mono" placeholder="REF-0001"></div><div class="fg"><label>Requested by</label><input id="fReqBy" placeholder="Name / company"></div><div class="fg"><label>Priority</label><select id="fPrio"><option>Normal</option><option>High</option><option>Urgent</option></select></div></div>`;document.getElementById('fType').closest('.card-b').insertBefore(box,document.getElementById('fPdf').closest('.fg'));}else if(!needRef&&hold){hold.remove();}}
function pickPdf(inp){const info=document.getElementById('fPdfInfo');const f=inp.files&&inp.files[0];if(!f){info.innerHTML='';return;}if(f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name)){info.innerHTML=`<div class="alert alert-err">Only PDF files are accepted.</div>`;inp.value='';return;}if(f.size>MAX_MB()*1024*1024){info.innerHTML=`<div class="alert alert-err">File is larger than ${MAX_MB()} MB.</div>`;inp.value='';return;}const fn=document.getElementById('fFile');if(!fn.value)fn.value=f.name;info.innerHTML=`<div class="doc-file" style="margin-bottom:14px"><span class="fi">📄</span><div><div class="fn">${esc(f.name)}</div><div class="fs">${(f.size/1024).toFixed(0)} KB · PDF</div></div></div>`;}
async function uploadPdf(file,projectId){const safe=(file.name||'document.pdf').replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${projectId}/${Date.now()}_${safe}`;const{error}=await sb.storage.from(BUCKET()).upload(path,file,{contentType:'application/pdf',upsert:false});if(error)throw new Error(error.message);return path;}
async function doSubmit(){
  const msg=document.getElementById('submitMsg'),btn=document.getElementById('btnSubmit');
  const document_number=document.getElementById('fNum').value.trim();
  const title=document.getElementById('fTitle').value.trim();
  const revision=document.getElementById('fRev').value.trim()||'A';
  const discipline=document.getElementById('fDisc').value;
  const category=document.getElementById('fCat').value;
  const doc_type=document.getElementById('fType')?.value||'Submittal';
  const ref_no=document.getElementById('fRef')?.value.trim()||'';
  const requested_by=document.getElementById('fReqBy')?.value.trim()||'';
  const priority=document.getElementById('fPrio')?.value||'Normal';
  if(!document_number||!title||!discipline||!category){msg.innerHTML=`<div class="alert alert-err">Required fields missing.</div>`;return;}
  const pdfInput=document.getElementById('fPdf');
  const file=pdfInput&&pdfInput.files&&pdfInput.files[0]?pdfInput.files[0]:null;
  btn.disabled=true;btn.textContent=file?'Uploading PDF…':'Submitting…';
  try{
    let filePath='';
    if(file) filePath=await uploadPdf(file,activeProjectId);
    const fileName=document.getElementById('fFile').value.trim()||(file?file.name:(document_number+'-Rev'+revision+'.pdf'));
    const base={
      project_id:activeProjectId,document_number,title,revision,discipline,category,doc_type,
      description:document.getElementById('fDesc').value,
      notes:document.getElementById('fNotes').value,
      ref_no,requested_by,priority,
      file_name:fileName,
      file_path:filePath,
      file_size:file?file.size:(0),
      status:'submitted',
      updated_at:new Date().toISOString()
    };
    const{data:existing}=await sb.from('submissions').select('*').eq('project_id',activeProjectId).eq('document_number',document_number).maybeSingle();
    let id;
    if(existing){
      if(!file) {base.file_path=existing.file_path||'';base.file_size=existing.file_size||0;base.file_name=existing.file_name||fileName;}
      const{error}=await sb.from('submissions').update(base).eq('id',existing.id);
      if(error) throw new Error(error.message);
      id=existing.id;
    }else{
      const{data,error}=await sb.from('submissions').insert({...base,submitted_by:currentUser.id,submitted_by_name:profile.full_name}).select().single();
      if(error) throw new Error(error.message);
      id=data.id;
    }
    await sb.from('revision_history').insert({submission_id:id,revision,status:'submitted',by_user:currentUser.id});
    const{data:cons}=await sb.from('project_members').select('user_id').eq('project_id',activeProjectId).in('member_role',['admin','consultant']);
    if(cons&&cons.length) await sb.from('notifications').insert(cons.filter(c=>c.user_id!==currentUser.id).map(c=>({user_id:c.user_id,title:'New '+doc_type+': '+document_number,body:title+' — Rev '+revision+' by '+profile.full_name,link:id})));
    msg.innerHTML=`<div class="alert alert-ok">Submitted.</div>`;
    setTimeout(()=>go('doc:'+id),600);
  }catch(e){msg.innerHTML=`<div class="alert alert-err">${esc(e.message)}</div>`;btn.disabled=false;btn.textContent='Submit Document';}
}

async function viewReviews(){if(!activeProjectId||!canConsultOnProject())return`<div class="alert alert-err">No access.</div>`;const{data:docs,error}=await sb.from('submissions').select('*').eq('project_id',activeProjectId).in('status',['submitted','under_review']).order('updated_at',{ascending:false});if(error)throw new Error(error.message);const list=docs||[];const rows=list.map(d=>{const st=STATUS[d.status];return`<tr><td class="mono">${esc(d.document_number)}</td><td>${esc(d.title)}</td><td>${esc(d.revision)}</td><td><span class="badge ${st.cls}">${st.label}</span></td><td><a href="#" onclick="go('doc:${d.id}');return false;">Review</a></td></tr>`;}).join('')||`<tr><td colspan="5" class="empty">No pending reviews</td></tr>`;return`<h1 class="page-title">Pending Reviews</h1><p class="page-sub">${list.length} in current project</p><div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Doc No.</th><th>Title</th><th>Rev</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;}

async function viewDoc(id){
  const{data:d,error}=await sb.from('submissions').select('*').eq('id',id).single();
  if(error||!d)return`<div class="alert alert-err">Not found or no access</div>`;
  const{data:decisions}=await sb.from('decisions').select('*').eq('submission_id',id).order('created_at',{ascending:false});
  const{data:history}=await sb.from('revision_history').select('*').eq('submission_id',id).order('created_at',{ascending:true});
  const st=STATUS[d.status]||STATUS.submitted;
  const dt=DOC_TYPES[d.doc_type||'Submittal']||DOC_TYPES.Submittal;
  const canReview=canConsultOnProject()&&(d.status==='submitted'||d.status==='under_review');
  const needsResubmit=(d.status==='revise_resubmit'||d.status==='info_required')&&canSubmitOnProject();
  const canDelete=(d.submitted_by===currentUser.id)||isProjectAdmin();
  const decisionsHtml=(decisions||[]).map(dec=>`<div style="padding:12px 0;border-bottom:1px solid var(--border)"><span class="badge ${(STATUS[DECISIONS[dec.code]?.status]||STATUS.submitted).cls}">${esc(dec.label)} (${esc(dec.code)})</span> <span class="mono">${fmt(dec.created_at)}</span>${dec.comments?`<p style="margin-top:8px;font-size:13px">${esc(dec.comments)}</p>`:''}${dec.reasons?`<p style="margin-top:6px;font-size:13px"><strong>Reasons:</strong> ${esc(dec.reasons)}</p>`:''}<p style="font-size:11px;color:var(--muted);margin-top:6px">${esc(dec.reviewed_by_name)} · ${esc(dec.report_ref)}</p></div>`).join('')||`<p class="empty" style="padding:16px">No decisions yet</p>`;
  const historyHtml=(history||[]).map(h=>{const s=STATUS[h.status]||STATUS.submitted;return`<div style="font-size:13px;padding:6px 0"><span class="mono">Rev ${esc(h.revision)}</span> · <span class="badge ${s.cls}">${s.label}</span> · ${fmt(h.created_at)}</div>`;}).join('');
  let reviewForm='';
  if(canReview)reviewForm=`<div class="card" style="border-color:rgba(59,130,246,.4)"><div class="card-h">Issue Review Decision</div><div class="card-b"><div id="revMsg"></div><div class="fg"><label>Decision *</label>${['A','B','C','D','E'].map(c=>`<label class="decision-opt" id="opt${c}"><input type="radio" name="dec" value="${c}" ${c==='B'?'checked':''} onchange="highlightOpt('${c}')"><span><strong>${c}</strong> – ${DECISIONS[c].label}</span></label>`).join('')}</div><div class="fg"><label>Comments</label><textarea id="revComments" rows="3"></textarea></div><div class="fg" id="reasonsGroup" style="display:none"><label style="color:#fca5a5">Reasons *</label><textarea id="revReasons" rows="3"></textarea></div><button class="btn btn-primary btn-sm" id="btnIssue" onclick="doDecision('${d.id}')">Issue Decision</button></div></div>`;
  const resubmitBtn=needsResubmit?`<div class="card" style="border-color:rgba(245,158,11,.4)"><div class="card-b"><p style="margin-bottom:12px;color:var(--muted)">Revision required.</p><button class="btn btn-primary btn-sm" onclick="prepareResubmit('${esc(d.document_number)}','${esc(d.doc_type||'Submittal')}')">Resubmit</button></div></div>`:'';
  const filePanel=d.file_path?`<div class="card"><div class="card-h">Attached file</div><div class="card-b"><div class="doc-file"><span class="fi">📄</span><div style="flex:1"><div class="fn">${esc(d.file_name||'document.pdf')}</div><div class="fs">PDF${d.file_size?' · '+(d.file_size/1024).toFixed(0)+' KB':''}</div></div><button class="btn btn-primary btn-sm" onclick="openPdf('${d.id}')">Open</button><button class="btn btn-ghost btn-sm" onclick="downloadPdf('${d.id}')">Download</button></div></div></div>`
    :`<div class="card"><div class="card-h">Attached file</div><div class="card-b"><p style="color:var(--muted);font-size:13px;margin-bottom:10px">No PDF attached to this document.</p>${canSubmitOnProject()?`<input type="file" id="upPdf" accept="application/pdf,.pdf" onchange="attachPdf('${d.id}',this)"><div id="upMsg"></div>`:'—'}</div></div>`;
  const refRows=(d.ref_no||d.requested_by||(d.priority&&d.priority!=='Normal'))?`<div><div class="label">Reference</div>${esc(d.ref_no||'—')}</div><div><div class="label">Requested by</div>${esc(d.requested_by||'—')}</div><div><div class="label">Priority</div>${esc(d.priority||'Normal')}</div>`:'';
  return`<div style="margin-bottom:10px"><a href="#" onclick="go('register');return false;">← Register</a></div>
  <div class="mono">${esc(d.document_number)} · Rev ${esc(d.revision)}</div>
  <h1 class="page-title">${esc(d.title)}</h1>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px"><span class="badge ${st.cls}">${st.label}</span><span class="badge ${dt.cls}">${esc(dt.label)}</span></div>
  <div class="actions-row"><button class="btn btn-ghost btn-sm" onclick="exportDecisionPdf('${d.id}')">⬇ Export approval sheet (PDF)</button>${canDelete?`<button class="btn btn-danger btn-sm" onclick="deleteDocument('${d.id}')">Delete document</button>`:''}</div>
  <div class="card"><div class="card-b"><div class="meta-grid"><div><div class="label">Discipline</div>${esc(d.discipline)}</div><div><div class="label">Category</div>${esc(d.category)}</div><div><div class="label">Contractor</div>${esc(d.submitted_by_name)}</div><div><div class="label">Submitted</div>${fmt(d.created_at)}</div>${refRows}<div style="grid-column:1/-1"><div class="label">Description</div>${esc(d.description||'—')}</div>${d.notes?`<div style="grid-column:1/-1"><div class="label">Notes</div>${esc(d.notes)}</div>`:''}</div></div></div>
  ${filePanel}${resubmitBtn}${reviewForm}
  <div class="card"><div class="card-h">Decisions</div><div class="card-b">${decisionsHtml}</div></div>
  <div class="card"><div class="card-h">History</div><div class="card-b">${historyHtml}</div></div>`;
}
async function attachPdf(id,inp){
  const msg=document.getElementById('upMsg'),f=inp.files&&inp.files[0];
  if(!f)return;
  if(f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name)){msg.innerHTML=`<div class="alert alert-err">Only PDF files are accepted.</div>`;return;}
  if(f.size>MAX_MB()*1024*1024){msg.innerHTML=`<div class="alert alert-err">File is larger than ${MAX_MB()} MB.</div>`;return;}
  msg.innerHTML=`<div class="alert alert-warn">Uploading…</div>`;
  try{const path=await uploadPdf(f,activeProjectId);const{error}=await sb.from('submissions').update({file_path:path,file_name:f.name,file_size:f.size,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw new Error(error.message);go('doc:'+id);}
  catch(e){msg.innerHTML=`<div class="alert alert-err">${esc(e.message)}</div>`;}
}
async function deleteDocument(id){
  if(!confirm('Delete this document, its decisions and history?'))return;
  const{data:d}=await sb.from('submissions').select('file_path').eq('id',id).single();
  if(d&&d.file_path){try{await sb.storage.from(BUCKET()).remove([d.file_path]);}catch(_){}}
  const{error}=await sb.from('submissions').delete().eq('id',id);
  if(error)return alert(error.message);
  go('register');
}
async function pdfUrl(id){
  const{data:d,error}=await sb.from('submissions').select('file_path,file_name').eq('id',id).single();
  if(error||!d||!d.file_path)return null;
  const{data:s,error:e}=await sb.storage.from(BUCKET()).createSignedUrl(d.file_path,300,'inline');
  if(e)throw new Error(e.message);
  return{url:s.signedUrl,name:d.file_name||'document.pdf'};
}
async function openPdf(id){
  try{const f=await pdfUrl(id);if(!f)return alert('No file attached.');window.open(f.url,'_blank');}
  catch(e){alert(e.message);}
}
async function downloadPdf(id){
  try{const f=await pdfUrl(id);if(!f)return alert('No file attached.');const a=document.createElement('a');a.href=f.url;a.download=f.name;a.target='_blank';a.click();}
  catch(e){alert(e.message);}
}
function highlightOpt(c){['A','B','C','D','E'].forEach(x=>{const el=document.getElementById('opt'+x);if(el)el.classList.toggle('selected',x===c);});document.getElementById('reasonsGroup').style.display=['C','D','E'].includes(c)?'block':'none';confirmDecision=false;const btn=document.getElementById('btnIssue');if(btn){btn.textContent='Issue Decision';btn.classList.remove('btn-danger');}}
async function doDecision(id){const code=(document.querySelector('input[name=dec]:checked')||{}).value;if(!code)return;const comments=document.getElementById('revComments').value,reasons=document.getElementById('revReasons')?.value||'',msg=document.getElementById('revMsg');if(['C','D','E'].includes(code)&&!reasons.trim()){msg.innerHTML=`<div class="alert alert-err">Reasons required.</div>`;return;}if(!confirmDecision){confirmDecision=true;msg.innerHTML=`<div class="alert alert-warn">Click again to confirm.</div>`;const btn=document.getElementById('btnIssue');btn.textContent='Confirm Issue Decision';btn.classList.add('btn-danger');return;}confirmDecision=false;const map=DECISIONS[code];const{data:sub}=await sb.from('submissions').select('*').eq('id',id).single();const ref='RR-'+sub.document_number+'-'+sub.revision+'-'+Date.now().toString(36).toUpperCase();const{error:e1}=await sb.from('decisions').insert({submission_id:id,code,label:map.label,comments,reasons,report_ref:ref,reviewed_by:currentUser.id,reviewed_by_name:profile.full_name});if(e1){msg.innerHTML=`<div class="alert alert-err">${esc(e1.message)}</div>`;return;}await sb.from('submissions').update({status:map.status,updated_at:new Date().toISOString()}).eq('id',id);await sb.from('revision_history').insert({submission_id:id,revision:sub.revision,status:map.status,by_user:currentUser.id});await sb.from('notifications').insert({user_id:sub.submitted_by,title:'Decision: '+map.label+' – '+sub.document_number,body:'Rev '+sub.revision+' by '+profile.full_name,link:id});go('doc:'+id);}
function prepareResubmit(n,type){go('submit');setTimeout(()=>{const el=document.getElementById('fNum');if(el)el.value=n;const t=document.getElementById('fType');if(t&&type){t.value=type;syncTypeFields();}},200);}
async function viewNotifications(){const{data:notifs}=await sb.from('notifications').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(50);await sb.from('notifications').update({read:true}).eq('user_id',currentUser.id).eq('read',false);await renderNav();if(!notifs?.length)return`<h1 class="page-title">Notifications</h1><div class="empty">No notifications</div>`;return`<h1 class="page-title">Notifications</h1><div style="margin-top:16px">${notifs.map(n=>`<div class="notif-item ${n.read?'':'unread'}"><div class="t">${esc(n.title)}</div><div class="b">${esc(n.body)}</div><div class="d">${fmt(n.created_at)}${n.link?` · <a href="#" onclick="go('doc:${n.link}');return false;">Open</a>`:''}</div></div>`).join('')}</div>`;}

/* ============================================================
   v2.1 – PDF export  (approval sheets & approvals register)
   ============================================================ */
function reportCss(){return `body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#111827;margin:0;padding:26px;background:#fff;font-size:12px;line-height:1.5}
h1{font-size:19px;margin:0 0 2px}
.sub{color:#4b5563;font-size:11px;margin-bottom:14px}
.brand{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111827;padding-bottom:8px;margin-bottom:14px}
.brand .bn{font-weight:800;font-size:16px}
table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
th,td{border:1px solid #9ca3af;padding:6px 7px;text-align:left;vertical-align:top}
th{background:#e5e7eb;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
.kv{width:100%;border-collapse:collapse}
.kv td{border:1px solid #9ca3af;padding:6px 7px;width:25%}
.kv td.k{background:#f3f4f6;font-weight:600;width:18%}
.block{border:1px solid #9ca3af;margin-bottom:12px;padding:12px;page-break-inside:avoid}
.block h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.sig{margin-top:22px;display:flex;gap:24px}
.sig div{flex:1;border-top:1px solid #111827;padding-top:6px;font-size:10px;color:#4b5563}
.foot{margin-top:20px;font-size:10px;color:#6b7280;border-top:1px solid #d1d5db;padding-top:8px}
.badge{display:inline-block;border:1px solid #9ca3af;border-radius:99px;padding:1px 9px;font-size:10px;font-weight:700}`;}
function reportShell(title,body){return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${reportCss()}</style></head><body>${body}<div class="foot">Esteshari – MEP Document Portal · © Nexus Solutions · generated ${fmt(new Date().toISOString())}</div></body></html>`;}
function reportHead(title,sub){return `<div class="brand"><div><div class="bn">ESTESHARI</div><div class="sub">MEP Document Portal</div></div><div style="text-align:right"><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div></div>`;}

async function exportHtmlPdf(html,filename){
  if(window.esteshari&&window.esteshari.exportPdf){
    try{const r=await window.esteshari.exportPdf(html,filename);if(r&&r.ok){toastFlash('PDF saved');return true;}}
    catch(e){console.warn('desktop export failed',e);}
  }
  if(window.html2canvas&&window.jspdf&&window.jspdf.jsPDF){
    toastFlash('Preparing PDF…');
    const holder=document.createElement('div');
    holder.style.cssText='position:fixed;left:-99999px;top:0;width:820px;background:#fff;padding:26px;z-index:-1';
    holder.innerHTML=html;
    document.body.appendChild(holder);
    try{
      const canvas=await window.html2canvas(holder,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});
      const pdf=new window.jspdf.jsPDF('p','mm','a4');
      const pw=210,ph=297,m=8,pw2=pw-m*2,ih=canvas.height*pw2/canvas.width;
      const img=canvas.toDataURL('image/jpeg',0.92);
      pdf.addImage(img,'JPEG',m,m,pw2,ih);
      let left=ih,pos=m;
      while(left>ph-m*2){pos=m+(left-ih);pdf.addPage();pdf.addImage(img,'JPEG',m,pos,pw2,ih);left-=(ph-m*2);}
      pdf.save(filename);
      return true;
    }catch(e){console.warn(e);toastFlash('Direct download failed – opening print dialog instead.');}
    finally{holder.remove();}
  }
  const w=window.open('','_blank');
  if(!w){alert('Please allow pop-ups to export the PDF, or choose File → Print → Save as PDF.');return false;}
  w.document.open();w.document.write(html);w.document.close();
  setTimeout(()=>{w.focus();w.print();},500);
  return true;
}

async function exportDecisionPdf(id){
  try{
    const{data:d,error}=await sb.from('submissions').select('*').eq('id',id).single();
    if(error||!d)return alert('Document not found.');
    const proj=activeProject();
    const{data:decisions}=await sb.from('decisions').select('*').eq('submission_id',id).order('created_at',{ascending:false});
    const st=STATUS[d.status]||STATUS.submitted,dt=DOC_TYPES[d.doc_type||'Submittal']||DOC_TYPES.Submittal;
    const decRows=(decisions||[]).map(x=>`<tr><td style="white-space:nowrap">${fmt(x.created_at)}</td><td style="text-align:center"><strong>${esc(x.code)}</strong></td><td>${esc(x.label)}</td><td>${esc(x.comments||'—')}</td><td>${esc(x.reasons||'—')}</td><td>${esc(x.reviewed_by_name)}</td><td class="mono">${esc(x.report_ref)}</td></tr>`).join('')||`<tr><td colspan="7">No decision issued yet.</td></tr>`;
    const body=reportHead('Submittal Review / Approval Sheet',`${proj?proj.code+' – '+proj.name:''}`)+`
      <table class="kv"><tr><td class="k">Document No.</td><td>${esc(d.document_number)}</td><td class="k">Revision</td><td>${esc(d.revision)}</td></tr>
      <tr><td class="k">Title</td><td>${esc(d.title)}</td><td class="k">Type</td><td>${esc(dt.label)}</td></tr>
      <tr><td class="k">Discipline</td><td>${esc(d.discipline)}</td><td class="k">Category</td><td>${esc(d.category)}</td></tr>
      <tr><td class="k">Submitted by</td><td>${esc(d.submitted_by_name)}</td><td class="k">Submitted on</td><td>${fmt(d.created_at)}</td></tr>
      <tr><td class="k">File</td><td>${esc(d.file_name||'—')}</td><td class="k">Current status</td><td><span class="badge">${esc(st.label)}</span></td></tr>
      ${d.description?`<tr><td class="k">Description</td><td colspan="3">${esc(d.description)}</td></tr>`:''}</table>
      <div class="block"><h3>Decision history</h3><table><thead><tr><th>Date</th><th>Code</th><th>Decision</th><th>Comments</th><th>Reasons</th><th>Reviewer</th><th>Report ref.</th></tr></thead><tbody>${decRows}</tbody></table></div>
      <div class="sig"><div>Consultant signature</div><div>Contractor acknowledgement</div><div>Date</div></div>`;
    await exportHtmlPdf(reportShell(`Approval – ${d.document_number}`,body),`Esteshari_Approval_${d.document_number}_Rev${d.revision}.pdf`);
  }catch(e){alert('Export failed: '+e.message);}
}

async function exportApprovalsPdf(){
  if(!activeProjectId)return alert('Select a project first.');
  try{
    const proj=activeProject(),docs=await fetchSubmissions();
    const ids=docs.map(d=>d.id);
    const{data:decisions}=ids.length?await sb.from('decisions').select('*').in('submission_id',ids).order('created_at',{ascending:false}):{data:[]};
    const approved=docs.filter(d=>d.status==='approved'||d.status==='approved_as_noted');
    const pending=docs.filter(d=>d.status==='submitted'||d.status==='under_review');
    const revise=docs.filter(d=>d.status==='revise_resubmit'||d.status==='info_required');
    const rejected=docs.filter(d=>d.status==='rejected');
    const byId={};docs.forEach(d=>byId[d.id]=d);
    const rows=docs.map(d=>{
      const st=STATUS[d.status]||STATUS.submitted,dt=DOC_TYPES[d.doc_type||'Submittal']||DOC_TYPES.Submittal;
      const last=(decisions||[]).filter(x=>x.submission_id===d.id)[0];
      return`<tr><td>${esc(dt.short||dt.label)}</td><td>${esc(d.document_number)}</td><td>${esc(d.title)}</td><td>${esc(d.discipline)}</td><td>${esc(d.revision)}</td><td>${esc(st.label)}</td><td>${esc(d.submitted_by_name)}</td><td>${fmt(d.created_at)}</td><td class="mono">${esc(last?last.report_ref:'—')}</td></tr>`;
    }).join('')||`<tr><td colspan="9">No documents.</td></tr>`;
    const decRows=(decisions||[]).map(x=>{const d=byId[x.submission_id]||{};return`<tr><td>${fmt(x.created_at)}</td><td>${esc(d.document_number||'')}</td><td>${esc(x.code)}</td><td>${esc(x.label)}</td><td>${esc(x.comments||'—')}</td><td>${esc(x.reasons||'—')}</td><td>${esc(x.reviewed_by_name)}</td><td class="mono">${esc(x.report_ref)}</td></tr>`;}).join('')||`<tr><td colspan="8">No decisions.</td></tr>`;
    const body=reportHead('Approvals Register',`${proj.code} – ${proj.name}`)+`
      <table class="kv"><tr><td class="k">Project</td><td>${esc(proj.code)} – ${esc(proj.name)}</td><td class="k">Client</td><td>${esc(proj.client||'—')}</td></tr>
      <tr><td class="k">Approved</td><td>${approved.length}</td><td class="k">Pending</td><td>${pending.length}</td></tr>
      <tr><td class="k">Revise / Info</td><td>${revise.length}</td><td class="k">Rejected</td><td>${rejected.length}</td></tr></table>
      <div class="block"><h3>1. Document status list</h3><table><thead><tr><th>Type</th><th>Doc No.</th><th>Title</th><th>Discipline</th><th>Rev</th><th>Status</th><th>Submitted by</th><th>Submitted on</th><th>Report ref.</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="block"><h3>2. Full decision log</h3><table><thead><tr><th>Date</th><th>Doc No.</th><th>Code</th><th>Decision</th><th>Comments</th><th>Reasons</th><th>Reviewer</th><th>Report ref.</th></tr></thead><tbody>${decRows}</tbody></table></div>
      <div class="sig"><div>Consultant signature</div><div>Contractor acknowledgement</div><div>Date</div></div>`;
    await exportHtmlPdf(reportShell(`Approvals – ${proj.code}`,body),`Esteshari_Approvals_${proj.code}.pdf`);
  }catch(e){alert('Export failed: '+e.message);}
}

/* ============================================================
   v2.1 – automatic updates
   ============================================================ */
function currentVersion(){return String(CFG().APP_VERSION||'0.0.0');}
function verParts(v){return String(v).replace(/[^0-9.]/g,'').split('.').map(n=>parseInt(n,10)||0);}
function isNewer(remote,local){const a=verParts(remote),b=verParts(local);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0);}return false;}
function showUpdateBanner(msg,btnLabel,onClick,progress){
  const b=document.getElementById('updateBanner');if(!b)return;
  document.getElementById('ubMsg').textContent=msg;
  const btn=document.getElementById('ubBtn');
  if(btnLabel&&onClick){btn.style.display='inline-flex';btn.textContent=btnLabel;btn.onclick=onClick;}
  else btn.style.display='none';
  const wrap=document.getElementById('ubBarWrap');
  if(typeof progress==='number'){wrap.style.display='inline-block';document.getElementById('ubBar').style.width=progress+'%';}
  else wrap.style.display='none';
  b.classList.add('show');
}
function hideUpdateBanner(){document.getElementById('updateBanner')?.classList.remove('show');}
function ubPrimary(){if(updateInfo&&updateInfo.action)updateInfo.action();}
function desktopBridge(){return window.esteshari||null;}
async function initUpdater(){
  const sv=document.getElementById('sideVersion');if(sv)sv.textContent='v'+(desktopBridge()&&desktopBridge().version?desktopBridge().version():currentVersion());
  const pv=document.getElementById('profVersion');if(pv)pv.textContent='v'+(desktopBridge()&&desktopBridge().version?desktopBridge().version():currentVersion());
  const pd=document.getElementById('profDesktop');if(pd)pd.textContent=desktopBridge()?'Desktop app '+desktopBridge().version():'Web browser';
  const b=desktopBridge();
  if(b&&b.onUpdate){
    b.onUpdate(st=>{
      if(!st)return;
      if(st.state==='available')showUpdateBanner('نسخة جديدة متوفرة: '+st.version,()=>b.downloadUpdate?b.downloadUpdate():b.installUpdate&&b.installUpdate());
      else if(st.state==='downloading')showUpdateBanner('جارٍ تحميل التحديث…','',null,st.percent||0);
      else if(st.state==='downloaded')showUpdateBanner('التحديث جاهز — أعد تشغيل البرنامج للتثبيت',()=>b.installUpdate&&b.installUpdate());
      else if(st.state==='error')showUpdateBanner('تعذّر التحقق من التحديثات: '+(st.error||''),'إعادة المحاولة',()=>checkUpdate(true));
      else if(st.state==='checking')showUpdateBanner('جارٍ البحث عن تحديثات…','',null,0);
    });
  }
  setTimeout(()=>checkUpdate(false),1500);
}
async function checkUpdate(manual){
  if(updateBusy)return;
  const b=desktopBridge();
  if(b&&b.checkForUpdates){
    updateBusy=true;
    const r=await b.checkForUpdates();
    updateBusy=false;
    if(r&&r.upToDate&&manual)toastFlash('أنت على أحدث إصدار ('+(b.version?b.version():currentVersion())+')');
    return;
  }
  const feed=CFG().UPDATE_MANIFEST_URL;
  if(!feed){if(manual)toastFlash('لا يوجد رابط تحديثات مُعرّف في config.js');return;}
  updateBusy=true;
  try{
    const res=await fetch(feed,{cache:'no-store'});
    const info=await res.json();
    const v=info.version||'';
    if(v&&isNewer(v,currentVersion())){
      updateInfo={version:v,url:info.url,notes:info.notes};
      showUpdateBanner('إصدار جديد متوفر: '+v+' — '+(info.notes||''),'تحميل',()=>{if(updateInfo&&updateInfo.url)window.open(updateInfo.url,'_blank');});
    }else if(manual){toastFlash('أنت على أحدث إصدار ('+currentVersion()+')');}
  }catch(e){if(manual)toastFlash('تعذّر الوصول لصفحة التحديثات');}
  finally{updateBusy=false;}
}

(async function init(){initUpdater();if(!initSupabase())return;const{data:{session}}=await sb.auth.getSession();if(session?.user){currentUser=session.user;await loadProfile();await enterApp();}})();
