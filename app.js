(() => {
  'use strict';
  const sample = [
    {id:'demo-1',title:'Quarterly Parent-Teacher Conference',category:'Event',audience:'Parents & Guardians',date:'2026-11-06',time:'1:00 PM',location:'School covered court',priority:'Normal',status:'Published',body:'Parents and guardians are invited to attend the quarterly conference. Please coordinate with your child’s adviser for the schedule.',created_at:'2026-11-01T08:00:00Z'},
    {id:'demo-2',title:'Campus Clean-Up Drive',category:'General',audience:'Students & Staff',date:'2026-11-08',time:'7:30 AM',location:'MNHS – Poblacion campus',priority:'Normal',status:'Published',body:'Join our campus clean-up drive. Bring reusable gloves and water. Participants should check in with their class adviser.',created_at:'2026-11-01T07:00:00Z'},
    {id:'demo-3',title:'Class Suspension Advisory',category:'Advisory',audience:'Everyone',date:'2026-11-03',time:'All day',location:'',priority:'Urgent',status:'Published',body:'Please monitor official school and local government channels for verified updates regarding class operations.',created_at:'2026-11-01T06:00:00Z'}
  ];
  const CATEGORIES = [
    {name:'Examination', icon:'book-open'},
    {name:'Competition', icon:'trophy'},
    {name:'Holiday', icon:'calendar-days'},
    {name:'Event', icon:'calendar-check'},
    {name:'Advisory', icon:'megaphone'},
    {name:'Deadline', icon:'clock'},
    {name:'Schedule Change', icon:'arrow-left-right'},
    {name:'General', icon:'info'}
  ];
  const CATEGORY_PATHS = {
    'book-open':'<path d="M12 7v14M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4 4 4 0 0 1 4-4h3a2 2 0 0 1 2 2v13h-5a4 4 0 0 0-4 3 4 4 0 0 0-4-3H3z"/>',
    'trophy':'<path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4"/>',
    'calendar-days':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
    'calendar-check':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m4 4-3 3-2-2"/>',
    'megaphone':'<path d="m3 11 18-5v12L3 13v-2zM5 14l2 7h4l-2-6M21 10h1a2 2 0 0 1 0 4h-1"/>',
    'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'arrow-left-right':'<path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4m14 4H3"/>',
    'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>'
  };
  const categoryInfo = name => CATEGORIES.find(c=>c.name===name) || CATEGORIES[7];
  const categoryIcon = name => { const c=categoryInfo(name); return `<span class="category-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${CATEGORY_PATHS[c.icon]}</svg></span>`; };
  const $ = id => document.getElementById(id);
  const config = window.MNHS_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  let client = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  let items = [], profile = null, session = null, page = 'feed', demoRole = 'Recipient', installPrompt = null;
  let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedCalendarDate = [new Date().getFullYear(), String(new Date().getMonth()+1).padStart(2,'0'), String(new Date().getDate()).padStart(2,'0')].join('-');
  const isDemo = !config.supabaseUrl || !config.supabaseAnonKey;
  const pages = {feed:['Latest Announcements','Important updates for students, parents, and staff.'],calendar:['Announcement calendar','Browse upcoming school activities and advisories.'],manage:['Manage announcements','Create, edit, publish, or archive official announcements.'],admin:['Manage staff accounts','Create and manage authorized ACTA Administrator and Staff accounts.']};
  const role = () => isDemo ? demoRole : (profile?.role || 'Visitor');
  const canManage = () => ['Staff','Admin','Announcer'].includes(role());
  const isAdmin = () => role() === 'Admin';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => value ? new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'Date not set';
  const formatTime = value => { const raw=String(value||'').trim(); if(!raw || /^(all\s*day|full\s*day)$/i.test(raw)) return raw; const m=raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/); if(m){const h=Number(m[1]),mi=Number(m[2]); if(h<=23&&mi<=59)return new Date(2000,0,1,h,mi).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',hour12:true});} return raw; };
  const timeInputValue = value => {
    const raw=String(value||'').trim(); if(!raw || /^all\s*day$/i.test(raw)) return '';
    let m=raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if(m){const h=Number(m[1]),mi=Number(m[2]);return h<=23&&mi<=59?`${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`:'';}
    m=raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if(!m)return ''; let h=Number(m[1])%12; if(m[3].toUpperCase()==='PM')h+=12; const mi=Number(m[2]||0); return h<=23&&mi<=59?`${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`:'';
  };
  const OFFLINE_ANNOUNCEMENTS_KEY='acta-public-announcements-v1';
  function cachePublicAnnouncements(list){ try{const published=list.filter(a=>String(a.status||'').toLowerCase()==='published');localStorage.setItem(OFFLINE_ANNOUNCEMENTS_KEY,JSON.stringify({savedAt:Date.now(),items:published}));}catch(e){console.warn('ACTA could not save offline announcements:',e);} }
  function readCachedAnnouncements(){ try{const data=JSON.parse(localStorage.getItem(OFFLINE_ANNOUNCEMENTS_KEY)||'null');return Array.isArray(data?.items)?data.items.filter(a=>String(a.status||'').toLowerCase()==='published'):[];}catch{return [];} }
  const toast = message => { $('toast').textContent = message; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').textContent = '', 2800); };
  const setNotice = message => { $('notice').textContent = message || ''; $('notice').hidden = !message; };
  function updateChrome() {
    $('connectionState').classList.toggle('online', Boolean(client));
    $('connectionState').lastElementChild.textContent = isDemo ? 'Preview mode' : client ? 'Connected' : 'Offline';
    $('loginBtn').hidden = isDemo;
    $('loginBtn').innerHTML = session ? '↪ <span>Log out</span>' : '⚙ <span>Administrator</span>' ;
    $('logoutBtn').hidden = !session;
    document.querySelectorAll('.staff-only').forEach(el => el.hidden = !canManage());
    document.querySelectorAll('.admin-only').forEach(el => el.hidden = !isAdmin());
    $('newBtn').hidden = !canManage();
  }
  async function loadItems() {
    if (isDemo) {
      try { items = JSON.parse(localStorage.getItem('mnhsPreviewItems')) || sample.map(x=>({...x})); }
      catch { items = sample.map(x=>({...x})); }
      return;
    }
    try {
      const {data,error} = await client.from('announcements').select('*').order('date',{ascending:true});
      if (error) throw error;
      items=data || []; cachePublicAnnouncements(items); setNotice('');
    } catch (error) {
      const cached=readCachedAnnouncements(); items=cached;
      setNotice(cached.length ? `Offline mode: showing ${cached.length} previously loaded published announcement${cached.length===1?'':'s'}. Reconnect to refresh.` : 'You are offline and no announcements have been saved on this device yet. Connect once to load them.');
      console.warn('ACTA announcement refresh failed; using device cache:', error?.message || error);
    }
  }
  async function loadProfile() {
    if (isDemo || !session) { profile=null; return; }
    const {data,error} = await client.from('profiles').select('display_name,role').eq('id',session.user.id).maybeSingle();
    if (error || !data) { profile=null; setNotice('Your account is signed in but has no assigned school role. Ask the system administrator to configure your profile.'); }
    else { profile=data; setNotice(''); }
  }
  async function refresh() { await loadItems(); updateChrome(); render(); }
  function card(a) {
    const management = page==='manage' && canManage();
    return `<article class="announcement"><div class="announcement-head">${categoryIcon(a.category)}<div class="announcement-heading"><div class="meta"><span class="tag category-tag">${esc(a.category||'General')}</span>${a.priority==='Urgent'?'<span class="tag urgent">Urgent</span>':''}${management?`<span class="tag ${a.status==='Published'?'published':''}">${esc(a.status)}</span>`:''}</div><h3>${esc(a.title)}</h3></div></div><p>${esc((a.body||'').slice(0,190))}${(a.body||'').length>190?'…':''}</p><div class="row bottom"><div class="meta"><span>◷ ${fmt(a.date)} · ${esc(formatTime(a.time) || 'Time not set')}</span><span>⌖ ${esc(a.location || 'School-wide')}</span></div><button class="button secondary" data-view="${esc(a.id)}">Read more</button></div>${management?`<div class="announcement-actions"><button class="button secondary" data-edit="${esc(a.id)}">Edit</button><button class="button secondary" data-status="${esc(a.id)}">${a.status==='Published'?'Archive':'Publish'}</button></div>`:''}</article>`;
  }
  function render() {
    document.body.dataset.page = page;
    $('pageTitle').textContent=pages[page][0]; $('pageSubtitle').textContent=pages[page][1];
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    $('newBtn').hidden=!canManage() || !['manage','feed'].includes(page);
    if(page==='feed') {
      const published=items.filter(a=>a.status==='Published');
      $('content').innerHTML=`<div class="toolbar"><input id="search" type="search" placeholder="Search announcements…" aria-label="Search announcements"><select id="filter" aria-label="Filter by category"><option>All categories</option>${CATEGORIES.map(x=>`<option>${x.name}</option>`).join('')}</select></div><div id="feedCards" class="cards"></div>`;
      const update=()=>{const q=$('search').value.toLowerCase(),cat=$('filter').value;const list=published.filter(a=>(cat==='All categories'||a.category===cat)&&(`${a.title} ${a.body} ${a.location||''}`).toLowerCase().includes(q)).sort((a,b)=>a.date.localeCompare(b.date));$('feedCards').innerHTML=list.length?list.map(card).join(''):'<div class="empty">No matching announcements.</div>';};
      $('search').addEventListener('input',update);$('filter').addEventListener('change',update);update();
    } else if(page==='calendar') {
      const renderCalendar = () => {
        const year=calendarCursor.getFullYear(), month=calendarCursor.getMonth();
        const monthName=calendarCursor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
        const firstDay=new Date(year,month,1).getDay(), daysInMonth=new Date(year,month+1,0).getDate();
        const published=items.filter(a=>a.status==='Published' && a.date);
        const byDate={}; published.forEach(a=>{(byDate[a.date] ||= []).push(a);});
        const cells=Array.from({length:firstDay},()=>'<span class="calendar-blank"></span>');
        for(let day=1;day<=daysInMonth;day++){
          const date=[year,String(month+1).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
          const count=(byDate[date]||[]).length;
          const today=date===selectedCalendarDate && date===[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-');
          cells.push(`<button type="button" class="calendar-day ${date===selectedCalendarDate?'selected':''} ${today?'today':''} ${count?'has-events':''}" data-calendar-date="${date}" aria-label="${date}, ${count} announcements"><span>${day}</span>${count?`<i>${count}</i>`:''}</button>`);
        }
        const selected=(byDate[selectedCalendarDate]||[]);
        const monthEvents=published.filter(a=>a.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}-`)).sort((a,b)=>a.date.localeCompare(b.date));
        $('content').innerHTML=`<section class="panel calendar-full"><div class="calendar-toolbar"><button class="button secondary" type="button" data-calendar-nav="prev" aria-label="Previous month">‹</button><h2>${monthName}</h2><button class="button secondary" type="button" data-calendar-nav="next" aria-label="Next month">›</button><button class="button secondary calendar-today-btn" type="button" data-calendar-nav="today">Today</button></div><div class="calendar-weekdays"><b>Sun</b><b>Mon</b><b>Tue</b><b>Wed</b><b>Thu</b><b>Fri</b><b>Sat</b></div><div class="calendar-month-grid">${cells.join('')}</div><div class="calendar-selected"><h3>${new Date(selectedCalendarDate+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</h3><div class="calendar-list">${selected.length?selected.map(a=>`<div class="calendar-event"><div class="date-block"><small>${esc(a.category||'Announcement')}</small>${esc(formatTime(a.time)||'All day')}</div><div><strong>${esc(a.title)}</strong><div class="meta">${esc(a.location||'School-wide')}</div></div><button class="button secondary" data-view="${esc(a.id)}">View</button></div>`).join(''):'<div class="empty">No published announcements on this date. Select a marked date to see its events.</div>'}</div></div><div class="calendar-month-events"><h3>All announcements this month <span>${monthEvents.length}</span></h3><div class="calendar-list">${monthEvents.length?monthEvents.map(a=>`<div class="calendar-event"><div class="date-block"><small>${new Date(a.date+'T12:00:00').toLocaleDateString(undefined,{month:'short'})}</small>${new Date(a.date+'T12:00:00').getDate()}</div><div><strong>${esc(a.title)}</strong><div class="meta">${esc(formatTime(a.time)||'Time not set')} · ${esc(a.location||'School-wide')}</div></div><button class="button secondary" data-view="${esc(a.id)}">View</button></div>`).join(''):'<div class="empty">No published announcements this month.</div>'}</div></div></section>`;
      };
      renderCalendar();
    } else if(page==='manage' && canManage()) {
      const published=items.filter(a=>a.status==='Published').length;
      $('content').innerHTML=`<div class="stats"><div class="stat"><small>Total announcements</small><strong>${items.length}</strong></div><div class="stat"><small>Published</small><strong>${published}</strong></div><div class="stat"><small>Drafts / archived</small><strong>${items.length-published}</strong></div></div><div class="cards">${items.length?items.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(card).join(''):'<div class="empty">No announcements yet. Create your first announcement.</div>'}</div>`;
    } else if(page==='admin' && isAdmin()) {
      $('content').innerHTML=`<div class="stats"><div class="stat"><small>All announcements</small><strong>${items.length}</strong></div><div class="stat"><small>Published</small><strong>${items.filter(a=>a.status==='Published').length}</strong></div><div class="stat"><small>Urgent</small><strong>${items.filter(a=>a.priority==='Urgent'&&a.status==='Published').length}</strong></div></div>
      <section class="panel admin-account-panel"><h2 style="margin-top:0;color:var(--navy)">Invite a staff member or administrator</h2><p class="muted">Only an Administrator can invite staff or another Administrator. Visitors do not need accounts.</p>
      <form id="createStaffForm" class="form-grid"><div class="field"><label for="staffName">Full name</label><input id="staffName" name="display_name" maxlength="100" required placeholder="Staff member name"></div><div class="field"><label for="staffEmail">School email</label><input id="staffEmail" name="email" type="email" required placeholder="name@school.edu.ph"></div><div class="field"><label for="staffRole">Account role</label><select id="staffRole" name="role"><option value="Staff">Staff</option><option value="Admin">Administrator</option></select></div><div class="field full"><button class="button primary" type="submit">Send invitation</button><p id="inviteFeedback" class="muted" role="status" aria-live="polite">An invitation email will be sent. The invited person sets their own password.</p></div></form></section>
      <section class="panel"><h2 style="margin-top:0;color:var(--navy)">Account access</h2><p class="muted">Students, parents, and visitors can browse published announcements without signing in. Staff accounts are created only through this page by an authenticated Administrator.</p></section>`;
      $('createStaffForm').addEventListener('submit', async e=>{
        e.preventDefault(); const form=e.currentTarget; const submit=form.querySelector('button[type="submit"]'); const feedback=$('inviteFeedback');
        if(!session || !isAdmin()){feedback.textContent='Only an authenticated Administrator can invite accounts.';return;}
        const values=Object.fromEntries(new FormData(form)); submit.disabled=true; submit.textContent='Sending invitation…'; feedback.textContent='';
        try {
          const {data,error}=await client.functions.invoke('admin-create-staff',{body:values});
          if(error) throw error;
          if(data?.error) throw new Error(data.error);
          feedback.textContent=`Invitation sent to ${values.email}. The account role is ${values.role==='Admin'?'Administrator':'Staff'}.`;
          form.reset(); toast('Invitation sent.');
        } catch(err) {
          const msg=String(err?.message||'');
          feedback.textContent=msg.toLowerCase().includes('failed to send')?'Could not send the invitation. Check the email address and Supabase email settings.':msg.toLowerCase().includes('function')?'Account invitation service is not deployed yet. Follow the Supabase setup instructions included with this update.':`Could not create account: ${msg}`;
        } finally {submit.disabled=false;submit.textContent='Send invitation';}
      });
    } else {
      page='feed'; render();
    }
  }
  function showModal(html) { $('modalContent').innerHTML=html; $('modal').hidden=false; document.body.style.overflow='hidden'; }
  function closeModal() { $('modal').hidden=true; document.body.style.overflow=''; }
  async function viewItem(id) {
    const a=items.find(x=>String(x.id)===String(id)); if(!a)return;
    showModal(`<div class="row"><span class="tag category-tag">${esc(a.category||'General')}</span><span class="tag ${a.priority==='Urgent'?'urgent':''}">${esc(a.priority)}</span><button class="button secondary" data-close>Close</button></div><h2 id="modalTitle" style="margin-top:16px">${esc(a.title)}</h2><div class="meta">${fmt(a.date)} · ${esc(formatTime(a.time)||'')} · ${esc(a.audience)}</div><div class="detail-body">${esc(a.body)}</div><p class="meta">⌖ ${esc(a.location||'School-wide')}</p>`);
  }
  function announcementForm(a={}) {
    if(!canManage())return;
    showModal(`<h2 id="modalTitle">${a.id?'Edit announcement':'Create announcement'}</h2><form id="announcementForm"><div class="form-grid"><div class="field full"><label for="title">Announcement title *</label><input id="title" name="title" maxlength="120" required value="${esc(a.title||'')}"></div><div class="field"><label for="category">Announcement type *</label><select id="category" name="category" required>${CATEGORIES.map(x=>`<option ${((a.category||'General')===x.name)?'selected':''}>${x.name}</option>`).join('')}</select></div><div class="field"><label for="audience">Audience</label><select id="audience" name="audience">${['Everyone','Students','Parents & Guardians','Students & Staff','Teaching Staff'].map(x=>`<option ${a.audience===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label for="date">Date *</label><input id="date" type="date" name="date" required value="${esc(a.date||new Date().toISOString().slice(0,10))}"></div><div class="field"><label for="time">Event time</label><input id="time" name="time" type="time" step="60" value="${esc(timeInputValue(a.time))}"><small class="muted">Optional for all-day announcements. Required for timed event reminders.</small></div><div class="field"><label for="location">Location</label><input id="location" name="location" maxlength="120" value="${esc(a.location||'')}"></div><div class="field"><label for="priority">Priority</label><select id="priority" name="priority"><option ${a.priority!=='Urgent'?'selected':''}>Normal</option><option ${a.priority==='Urgent'?'selected':''}>Urgent</option></select></div><div class="field full"><label for="body">Details *</label><textarea id="body" name="body" required maxlength="10000">${esc(a.body||'')}</textarea></div></div><div class="form-actions"><button type="button" class="button secondary" data-close>Cancel</button><button type="submit" class="button primary">${a.id?'Save changes':'Publish announcement'}</button></div></form>`);
    $('announcementForm').addEventListener('submit',async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));values.time=values.time||'';const payload={...values,status:'Published'};let error;
      if(isDemo){if(a.id)items=items.map(x=>String(x.id)===String(a.id)?{...x,...payload}:x);else items.unshift({id:'preview-'+Date.now(),...payload,created_at:new Date().toISOString()});localStorage.setItem('mnhsPreviewItems',JSON.stringify(items));}
      else if(a.id){({error}=await client.from('announcements').update(payload).eq('id',a.id));}
      else {({error}=await client.from('announcements').insert({...payload,created_by:session.user.id}));}
      if(error){toast('Could not save: '+error.message);return;}closeModal();toast(isDemo?'Saved in this browser preview.':'Announcement published.');await refresh();
    });
  }
  async function toggleStatus(id) {
    const a=items.find(x=>String(x.id)===String(id));if(!a||!canManage())return;const status=a.status==='Published'?'Archived':'Published';
    if(isDemo){items=items.map(x=>String(x.id)===String(id)?{...x,status}:x);localStorage.setItem('mnhsPreviewItems',JSON.stringify(items));}
    else {const {error}=await client.from('announcements').update({status}).eq('id',id);if(error){toast('Could not update status: '+error.message);return;}}
    toast('Announcement status updated.');await refresh();
  }
  async function signIn() {
    if(session){await signOut();return;}
    showModal(`<h2 id="modalTitle">Administrator / Staff sign in</h2><p class="muted" style="margin-top:-7px">Visitors can view announcements without an account. Accounts are issued by an ACTA Administrator.</p><form id="loginForm" novalidate><div id="loginError" class="form-error" role="alert" hidden></div><div class="field" style="margin:13px 0"><label for="email">School email</label><input id="email" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><div class="form-actions"><button type="button" class="button secondary" data-close>Cancel</button><button class="button primary" type="submit">Sign in</button></div></form>`);
    $('loginForm').addEventListener('submit',async e=>{
      e.preventDefault(); const form=e.currentTarget; const email=$('email').value.trim(); const password=$('password').value; const errBox=$('loginError');
      const showError=msg=>{errBox.textContent=msg;errBox.hidden=false;}; errBox.hidden=true;
      if(!email){showError('Enter your school email address.');$('email').focus();return;}
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showError('The email address format is invalid. Check for a missing name, @ symbol, or domain.');$('email').focus();return;}
      if(!password){showError('Enter your password.');$('password').focus();return;}
      const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Signing in…';
      let result;
      try {
        result = await client.auth.signInWithPassword({email,password});
      } catch (networkError) {
        console.error('ACTA sign-in request could not reach Supabase:', networkError);
        const detail = String(networkError?.message || networkError || 'Network request failed');
        showError(`Could not reach the ACTA sign-in service. Check your connection and reload the page. Technical detail: ${detail}.`);
        submit.disabled=false;submit.textContent='Sign in';return;
      }
      const {data,error}=result;
      if(error){const m=String(error.message||'').toLowerCase();showError(m.includes('invalid login credentials')?'Incorrect email or password. Check both fields and try again.':m.includes('email not confirmed')?'This email address has not been confirmed. Ask the Administrator for help.':m.includes('too many requests')?'Too many attempts. Please wait a while before trying again.':`Sign-in failed: ${error.message}`);submit.disabled=false;submit.textContent='Sign in';return;}
      session=data.session;await loadProfile();
      if(!profile){await client.auth.signOut();session=null;updateChrome();showError('This account has no ACTA staff role. Ask an Administrator to issue or repair your account.');submit.disabled=false;submit.textContent='Sign in';return;}
      closeModal();page=profile.role==='Admin'?'admin':'manage';await refresh();toast('Signed in successfully.');
    });
  }
  async function signOut(){await client.auth.signOut();session=null;profile=null;page='feed';setNotice('');await refresh();toast('Signed out.');}
  $('nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b)return;if((b.dataset.page==='manage'&&!canManage())||(b.dataset.page==='admin'&&!isAdmin()))return;page=b.dataset.page;render();});
  $('content').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.calendarNav){if(b.dataset.calendarNav==='today'){const now=new Date();calendarCursor=new Date(now.getFullYear(),now.getMonth(),1);selectedCalendarDate=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');}else{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+(b.dataset.calendarNav==='next'?1:-1),1);selectedCalendarDate=[calendarCursor.getFullYear(),String(calendarCursor.getMonth()+1).padStart(2,'0'),'01'].join('-');}render();return;}if(b.dataset.calendarDate){selectedCalendarDate=b.dataset.calendarDate;render();return;}if(b.dataset.view)viewItem(b.dataset.view);if(b.dataset.edit)announcementForm(items.find(x=>String(x.id)===String(b.dataset.edit)));if(b.dataset.status)toggleStatus(b.dataset.status);});
  $('newBtn').addEventListener('click',()=>announcementForm());$('loginBtn').addEventListener('click',()=>session?signOut():signIn());$('logoutBtn').addEventListener('click',signOut);document.querySelector('.calendar-link')?.addEventListener('click',()=>{page='calendar';render();window.scrollTo({top:0,behavior:'smooth'});});
  $('modal').addEventListener('click',e=>{if(e.target.matches('[data-close]'))closeModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').hidden)closeModal();});
  if(isDemo){setNotice('Preview mode: this version uses sample announcements and saves edits only in this browser. Connect Supabase to enable secure staff accounts and shared school-wide publishing.');$('loginBtn').hidden=true;$('connectionState').lastElementChild.textContent='Preview mode';
    const demoRoleButton=document.createElement('button');demoRoleButton.className='button top-button';demoRoleButton.textContent='Preview as: Recipient';demoRoleButton.id='demoRoleBtn';$('topbar');document.querySelector('.top-actions').insertBefore(demoRoleButton,$('loginBtn'));demoRoleButton.addEventListener('click',()=>{demoRole=demoRole==='Recipient'?'Staff':demoRole==='Staff'?'Admin':'Recipient';demoRoleButton.textContent='Preview as: '+demoRole;page=demoRole==='Admin'?'admin':demoRole==='Staff'?'manage':'feed';updateChrome();render();});
  } else if (client) {
    client.auth.getSession().then(async({data,error})=>{if(error)console.warn('ACTA could not restore the saved session:',error);session=data?.session||null;await loadProfile();await refresh();}).catch(err=>{console.error('ACTA session initialization failed:',err);setNotice('ACTA could not contact Supabase. Check your connection and reload the page.');});
    client.auth.onAuthStateChange(async(_event,newSession)=>{session=newSession;await loadProfile();await refresh();});
  } else {
    profile=null; session=null;
  }
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const raw = atob((base64String + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  }
  async function showNotificationSettings() {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const configuredPush = config.vapidPublicKey && !config.vapidPublicKey.includes('PASTE_');
    const permission = supported ? Notification.permission : 'unsupported';
    // Opening the settings must never depend on a working service worker.
    // A missing or temporarily unavailable registration is handled inside the modal.
    let reg = null, subscription = null, registrationIssue = '';
    if (supported) {
      try { reg = await navigator.serviceWorker.getRegistration(); }
      catch (err) { registrationIssue = 'The service worker is not available yet. Reload ACTA and try enabling reminders again.'; }
      if (reg) {
        try { subscription = await reg.pushManager.getSubscription(); }
        catch (err) { registrationIssue = 'ACTA could not read this device’s notification subscription. You can still review the setup status below.'; }
      }
    }
    showModal(`<h2 id="modalTitle">ACTA event reminders</h2>
      <p>Get a phone notification before published school events. ACTA needs notification permission and an internet connection to receive reminders.</p>
      ${!supported?'<div class="form-error">Push notifications are not supported by this browser. Try installing ACTA through Chrome on Android.</div>':''}
      ${!configuredPush?'<div class="form-error">Push service setup is not complete yet. The administrator must add the VAPID public key and deploy the notification service.</div>':''}
      ${registrationIssue?`<div class="form-error">${registrationIssue}</div>`:''}
      <p class="muted">Status: <strong>${subscription?'Enabled':permission==='granted'?'Permission granted':permission==='denied'?'Blocked in browser settings':'Not enabled'}</strong></p>
      <div class="form-actions"><button type="button" class="button secondary" data-close>Close</button><button type="button" id="enablePushBtn" class="button primary" ${(!supported||!configuredPush||!!subscription)?'disabled':''}>${subscription?'Reminders enabled':'Enable notifications'}</button>${subscription?'<button type="button" id="disablePushBtn" class="button secondary">Turn off</button>':''}</div>
      <p class="muted" style="font-size:.85rem">Reminder timing: 1 day and 1 hour before an event. Your device subscription is stored securely for delivery; no student account is required.</p>`);
    $('enablePushBtn')?.addEventListener('click', async () => {
      const btn=$('enablePushBtn'); btn.disabled=true; btn.textContent='Enabling…';
      try {
        if (!configured || !client) throw new Error('ACTA is not connected to Supabase yet.');
        const permissionResult=await Notification.requestPermission();
        if(permissionResult!=='granted') throw new Error('Notification permission was not granted. You can enable it in your browser site settings.');
        const registration=await navigator.serviceWorker.ready;
        const sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(config.vapidPublicKey)});
        const json=sub.toJSON();
        const {error}=await client.from('push_subscriptions').insert({endpoint:json.endpoint,subscription:json,remind_24h:true,remind_1h:true,user_agent:navigator.userAgent.slice(0,250)});
        if(error && error.code!=='23505') throw error;
        closeModal(); toast('ACTA event reminders enabled on this device.');
      } catch(err) { btn.disabled=false; btn.textContent='Try again'; alert(err.message||'Could not enable notifications.'); }
    });
    $('disablePushBtn')?.addEventListener('click', async () => {
      try {
        const registration=await navigator.serviceWorker.ready; const sub=await registration.pushManager.getSubscription();
        if(sub){const endpoint=sub.endpoint; await sub.unsubscribe(); if(client) await client.from('push_subscriptions').delete().eq('endpoint',endpoint);}
        closeModal(); toast('ACTA reminders turned off on this device.');
      } catch(err){alert(err.message||'Could not turn off reminders.');}
    });
  }
  $('notifyBtn').addEventListener('click', () => {closeAppMenu();showNotificationSettings();});
  function closeAppMenu(){ $('appMenu').hidden=true; $('menuToggle').setAttribute('aria-expanded','false'); }
  $('menuToggle').addEventListener('click',()=>{const open=$('appMenu').hidden;$('appMenu').hidden=!open;$('menuToggle').setAttribute('aria-expanded',String(open));});
  document.addEventListener('click',e=>{if(!$('appMenu').contains(e.target)&&!$('menuToggle').contains(e.target))closeAppMenu();});
  const themeKey='acta-theme';
  function applyTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem(themeKey,theme);$('themeToggle').innerHTML=theme==='dark'?'☀ <span>Light mode</span>':'☾ <span>Dark mode</span>';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#101827':'#132b4f');}
  applyTheme(localStorage.getItem(themeKey)==='dark'?'dark':'light');
  $('themeToggle').addEventListener('click',()=>{applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');});
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const installButton = $('installBtn');
  if (isStandalone()) installButton.hidden = true;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; installButton.hidden = isStandalone(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; installButton.hidden = true; toast('ACTA has been installed.'); });
  installButton.addEventListener('click', async () => {
    closeAppMenu();
    if (isStandalone()) { installButton.hidden = true; return; }
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') installButton.hidden = true;
      installPrompt = null;
      return;
    }
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSamsung = /SamsungBrowser/i.test(ua);
    const steps = isIOS
      ? '<ol><li>Open this website in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> button.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol>'
      : isSamsung
        ? '<ol><li>Open the browser menu (☰ or ⋮).</li><li>Choose <strong>Add page to</strong> or <strong>Install app</strong>.</li><li>Choose <strong>Home screen</strong> or confirm installation.</li></ol>'
        : '<ol><li>Open ACTA in <strong>Chrome</strong> or another supported browser.</li><li>Tap the browser menu (⋮).</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm <strong>Install</strong> or <strong>Add</strong>.</li></ol>';
    showModal(`<h2 id="modalTitle">Install ACTA</h2><p>Install ACTA on your device for an app-like experience.</p>${steps}<p class="muted">If the install option is missing, make sure you are using the browser (not an in-app preview) and that the website has finished loading over HTTPS.</p><div class="form-actions"><button class="button primary" data-close>Got it</button></div>`);
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(err => console.warn('ACTA service worker:', err)));
  }
  window.addEventListener('offline',()=>{const cached=readCachedAnnouncements();if(!isDemo&&cached.length){items=cached;setNotice(`Offline mode: showing ${cached.length} previously loaded published announcement${cached.length===1?'':'s'}. Reconnect to refresh.`);render();}});
  window.addEventListener('online',()=>{if(!isDemo)refresh();});
  refresh();
})();
