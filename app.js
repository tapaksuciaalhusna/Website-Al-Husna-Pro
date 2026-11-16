/* Al Husna Pro · Supabase client application */
(() => {
  const cfg = window.ALP_CONFIG || {};
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const escapeHTML = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith('GANTI_');
  const client = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const authDialog=$('#authDialog'), authForm=$('#authForm'), dataDialog=$('#dataDialog'), dataForm=$('#dataForm');
  let user=null, profile=null, authMode='login', activeTab='athletes', editingId=null, editingType=null, championships=[];
  const notice=(msg,type='')=>{const el=$('#portalNotice');if(el){el.textContent=msg;el.className='msg '+type}};
  const authMsg=(msg,type='')=>{const el=$('#authMessage');el.textContent=msg;el.className='msg '+type};
  const dataMsg=(msg,type='')=>{const el=$('#dataMessage');el.textContent=msg;el.className='msg '+type};
  const sayError=e=>e?.message || 'Terjadi kesalahan. Silakan coba lagi.';
  const isAdmin=()=>['admin','super_admin'].includes(profile?.role);
  const fmtDate=v=>v?new Date(v+'T00:00:00').toLocaleDateString('id-ID'):'-';
  const statusLabel=v=>({open:'Dibuka',upcoming:'Segera dibuka',closed:'Ditutup',pending:'Menunggu verifikasi',verified:'Terverifikasi',rejected:'Perlu perbaikan'})[v]||v||'-';
  const AGE_GROUPS=['Pra Usia Dini','Usia Dini 1','Usia Dini 2','Pra Remaja','Remaja','Dewasa','Master'];
  const RULE_CATEGORIES={
    IPSI:['Tanding','Seni Tunggal IPSI','Seni Ganda IPSI','Seni Regu IPSI'],
    TAPAK_SUCI:['Tanding Perorangan','Tanding Bebas Beregu','Tunggal Tangan Kosong','Tunggal Bersenjata','Ganda Tangan Kosong','Ganda Bersenjata','Trio Tangan Kosong','Trio Bersenjata','Beregu Tangan Kosong','Beregu Bersenjata','Jurus']
  };
  const publicAsset=path=>path?client.storage.from('championship-assets').getPublicUrl(path).data.publicUrl:'';
  const isTanding=v=>/^Tanding/.test(v);
  const isGroupCategory=v=>/Ganda|Trio|Beregu/.test(v)||v==='Jurus';
  const defaultWeightLines=()=>['A','B','C','D','E','F','G','H','I','J','Bebas'].map(x=>x+'| | ').join('\n');
  function renderPublic(list){
    const cards=$('#cards'); if(!cards)return;
    const filter=$('.chip[aria-pressed="true"]')?.dataset.f || 'semua';
    const mapped=list.map(c=>({...c, publicStatus:c.status==='open'?'buka':c.status==='upcoming'?'segera':'tutup'})).filter(c=>filter==='semua'||c.publicStatus===filter);
    cards.innerHTML=mapped.length?mapped.map(c=>{const flyer=publicAsset(c.flyer_path),guide=publicAsset(c.technical_guide_path);return `<article class="card"><span class="st ${c.publicStatus}">${statusLabel(c.status)}</span><h3>${escapeHTML(c.name)}</h3><p class="meta">${fmtDate(c.start_date)}${c.end_date?' – '+fmtDate(c.end_date):''}<br>${escapeHTML(c.location||'-')}</p><p class="meta">Batas daftar: ${fmtDate(c.registration_deadline)}</p>${c.description?`<p>${escapeHTML(c.description)}</p>`:''}<p class="meta">${flyer?`<a href="${flyer}" target="_blank" rel="noopener">Lihat flyer</a>`:''}${flyer&&guide?' · ':''}${guide?`<a href="${guide}" target="_blank" rel="noopener">Unduh juknis</a>`:''}</p><button class="btn" data-register="${c.id}" ${c.status!=='open'?'disabled':''}>${c.status==='open'?'Daftar atlet':'Pendaftaran tidak tersedia'}</button></article>`}).join(''):'<p class="meta">Belum ada kejuaraan pada kategori ini.</p>';
  }
  async function loadChampionships(){
    if(!client){renderPublic([]);return}
    const {data,error}=await client.from('championships').select('*').order('start_date',{ascending:true});
    if(error){console.error(error);return}
    championships=data||[];renderPublic(championships);
  }
  function showAuth(mode='login'){
    authMode=mode;$('#authTitle').textContent=mode==='signup'?'Daftar akun kontingen':'Masuk ke akun';$('#signupFields').hidden=mode!=='signup';
    ['kontingen','manager','phone'].forEach(n=>{const el=authForm.elements[n];el.required=mode==='signup'});
    authForm.elements.password.autocomplete=mode==='signup'?'new-password':'current-password';
    $('#authSubmit').textContent=mode==='signup'?'Buat akun':'Masuk';$('#authSwitchText').textContent=mode==='signup'?'Sudah punya akun?':'Belum punya akun?';$('#authSwitch').textContent=mode==='signup'?'Masuk':'Daftar kontingen';authMsg('');authDialog.showModal();
  }
  async function loadProfile(){
    const {data,error}=await client.from('profiles').select('*').eq('id',user.id).single();
    if(error)throw error;profile=data;
  }
  async function enterPortal(){
    $('#portal').hidden=false;$('#kejuaraan').hidden=true;$('#fitur').hidden=true;$('#alur').hidden=true;$('#kontak').hidden=true;
    $('#portalIdentity').textContent=`${profile?.kontingen_name||user.email} · ${profile?.role||'kontingen'}`;
    $$('.admin-only').forEach(el=>el.hidden=!isAdmin());
    await loadChampionships();await renderTab('athletes');$('#portal').scrollIntoView({behavior:'smooth'});
    await continuePendingRegistration();
  }
  async function continuePendingRegistration(){
    const championshipId=localStorage.getItem('alp_pending_championship');
    if(!championshipId||!user)return;
    localStorage.removeItem('alp_pending_championship');
    await renderTab('registrations');
    await registrationForm(championshipId);
  }
  function leavePortal(){ $('#portal').hidden=true;$('#kejuaraan').hidden=false;$('#fitur').hidden=false;$('#alur').hidden=false;$('#kontak').hidden=false; }
  async function refreshSession(){
    if(!client){notice('Supabase belum dikonfigurasi. Isi SUPABASE_ANON_KEY di config.js setelah menyalin key publik dari Supabase.','error');return}
    const {data:{session}}=await client.auth.getSession();
    if(session){user=session.user;try{await loadProfile();await enterPortal()}catch(e){notice(sayError(e),'error')}}
  }
  async function uploadPrivate(file,folder){
    if(!file) return null;
    if(file.size>8*1024*1024)throw new Error('Ukuran file maksimal 8 MB.');
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${user.id}/${folder}/${crypto.randomUUID()}-${safe}`;
    const {error}=await client.storage.from('private-files').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
    if(error)throw error;return path;
  }
  async function signedLink(path){if(!path)return '-';const {data,error}=await client.storage.from('private-files').createSignedUrl(path,300);if(error)return '-';return `<a class="file-link" target="_blank" rel="noopener" href="${data.signedUrl}">Lihat file</a>`}
  function formField(label,name,type='text',required=true,extra=''){return `<label>${label}<input name="${name}" type="${type}" ${required?'required':''} ${extra}></label>`}
  function selectField(label,name,options,required=true){return `<label>${label}<select name="${name}" ${required?'required':''}><option value="">Pilih</option>${options.map(o=>`<option value="${escapeHTML(o[0])}">${escapeHTML(o[1])}</option>`).join('')}</select></label>`}
  function openData(title,fields,type,id=null){editingType=type;editingId=id;$('#dataTitle').textContent=title;$('#dataFields').innerHTML=fields;dataMsg('');dataDialog.showModal()}
  async function renderTab(tab){
    activeTab=tab;$$('.portal-tabs .chip').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
    $('#portalTitle').textContent=({athletes:'Data atlet',registrations:'Pendaftaran kejuaraan',profile:'Profil kontingen',championships:'Kelola kejuaraan','all-registrations':'Data seluruh pendaftar',admins:'Administrator'})[tab]||'Dashboard';
    const root=$('#portalContent');root.innerHTML='<div class="panel">Memuat data…</div>';
    try{
      if(tab==='athletes')await tabAthletes(root);
      else if(tab==='registrations')await tabRegistrations(root,false);
      else if(tab==='profile')await tabProfile(root);
      else if(tab==='championships'&&isAdmin())await tabChampionships(root);
      else if(tab==='all-registrations'&&isAdmin())await tabRegistrations(root,true);
      else if(tab==='admins'&&profile?.role==='super_admin')await tabAdmins(root);
      else root.innerHTML='<div class="panel">Akses tidak tersedia.</div>';
    }catch(e){root.innerHTML=`<div class="panel msg error">${escapeHTML(sayError(e))}</div>`}
  }
  async function tabAthletes(root){
    const {data,error}=await client.from('athletes').select('*').order('created_at',{ascending:false});if(error)throw error;
    root.innerHTML=`<div class="toolbar"><p class="meta">Daftar atlet milik kontingen Anda.</p><button class="btn" id="addAthlete">+ Tambah atlet</button></div><div class="panel table-wrap">${data?.length?`<table class="data-table"><thead><tr><th>Nama atlet</th><th>Jenis kelamin</th><th>Berat</th><th>Kategori</th><th>Pelatih</th><th>Aksi</th></tr></thead><tbody>${data.map(a=>`<tr><td>${escapeHTML(a.full_name)}</td><td>${escapeHTML(a.gender)}</td><td>${a.weight_kg} kg</td><td>${escapeHTML(a.category)}</td><td>${escapeHTML(a.coach_name||'-')}</td><td><button class="small-btn" data-edit-athlete="${a.id}">Edit</button><button class="small-btn danger" data-delete-athlete="${a.id}">Hapus</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Belum ada data atlet. Tambahkan atlet pertama Anda.</div>'}</div>`;
    $('#addAthlete').onclick=()=>athleteForm();
    $$('[data-edit-athlete]',root).forEach(b=>b.onclick=()=>athleteForm(data.find(a=>a.id===b.dataset.editAthlete)));
    $$('[data-delete-athlete]',root).forEach(b=>b.onclick=async()=>{if(!confirm('Hapus data atlet ini?'))return;const {error}=await client.from('athletes').delete().eq('id',b.dataset.deleteAthlete);if(error)notice(sayError(error),'error');else renderTab('athletes')});
  }
  function athleteForm(a={}){openData(a.id?'Edit atlet':'Tambah atlet',`<div class="field-grid">${formField('Nama lengkap','full_name','text',true,`value="${escapeHTML(a.full_name||'')}"`)}${formField('Tanggal lahir','birth_date','date',true,`value="${a.birth_date||''}"`)}${selectField('Jenis kelamin','gender',[['Putra','Putra'],['Putri','Putri']])}${formField('Berat badan (kg)','weight_kg','number',true,`step="0.1" min="10" max="150" value="${a.weight_kg||''}"`)}${selectField('Kategori','category',[['Tanding','Tanding'],['Tunggal','Tunggal'],['Ganda','Ganda'],['Regu','Regu']])}${formField('Nama pelatih','coach_name','text',false,`value="${escapeHTML(a.coach_name||'')}"`)}${formField('Nomor HP','phone','tel',false,`value="${escapeHTML(a.phone||'')}"`)}<label>Foto atlet (opsional)<input name="photo" type="file" accept="image/*"></label></div>`, 'athlete',a.id||null);if(a.gender)dataForm.elements.gender.value=a.gender;if(a.category)dataForm.elements.category.value=a.category;}
  async function tabRegistrations(root,admin){
    let query=client.from('registrations').select('*, championships(name,start_date), athletes(full_name)').order('created_at',{ascending:false});if(!admin)query=query.eq('kontingen_id',user.id);
    const {data,error}=await query;if(error)throw error;
    const table=data?.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Kejuaraan</th><th>Atlet</th><th>Kategori / kelas</th><th>Kelompok usia</th><th>Tanggal</th><th>Status</th><th>Dokumen / pembayaran</th>${admin?'<th>Ubah status</th>':''}</tr></thead><tbody>${data.map(r=>`<tr><td>${escapeHTML(r.championships?.name||'-')}</td><td>${escapeHTML(r.athletes?.full_name||'-')}<br><small>${escapeHTML(r.group_code?'Satu regu · '+r.group_size+' peserta':'Perorangan')}</small></td><td>${escapeHTML(r.competition_category||'-')}${r.weight_class?`<br><small>Kelas ${escapeHTML(r.weight_class)}</small>`:''}</td><td>${escapeHTML(r.age_group||'-')}</td><td>${fmtDate(r.created_at?.slice(0,10))}</td><td>${statusLabel(r.status)}</td><td><button class="small-btn" data-upload="${r.id}">Unggah file</button> ${r.payment_path?'<span>✓ Bukti bayar</span>':''}</td>${admin?`<td><select data-status="${r.id}"><option value="pending" ${r.status==='pending'?'selected':''}>Menunggu</option><option value="verified" ${r.status==='verified'?'selected':''}>Terverifikasi</option><option value="rejected" ${r.status==='rejected'?'selected':''}>Perlu perbaikan</option></select></td>`:''}</tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada pendaftaran.</div>';
    root.innerHTML=`${admin?'':'<div class="toolbar"><p class="meta">Pilih kejuaraan dan atlet untuk mendaftarkan peserta.</p><button class="btn" id="newRegistration">+ Daftarkan atlet</button></div>'}<div class="panel">${table}</div>`;
    if(!admin)$('#newRegistration').onclick=()=>registrationForm();
    $$('[data-upload]',root).forEach(b=>b.onclick=()=>uploadForm(b.dataset.upload));
    $$('[data-status]',root).forEach(sel=>sel.onchange=async()=>{const {error}=await client.from('registrations').update({status:sel.value}).eq('id',sel.dataset.status);notice(error?sayError(error):'Status pendaftaran diperbarui.',error?'error':'success')});
  }
  async function registrationForm(selectedChampionshipId=null){
    const [{data:athletes,error:e1},{data:events,error:e2}]=await Promise.all([client.from('athletes').select('id,full_name,gender').order('full_name'),client.from('championships').select('id,name,competition_config').eq('status','open').order('start_date')]);if(e1||e2){notice(sayError(e1||e2),'error');return}
    if(!athletes?.length||!events?.length){notice('Pastikan sudah menambahkan atlet dan tersedia kejuaraan yang dibuka.','error');return}
    const opts=events.map(x=>`<option value="${x.id}" ${x.id===selectedChampionshipId?'selected':''}>${escapeHTML(x.name)}</option>`).join('');
    openData('Daftarkan atlet',`<div class="field-grid"><label>Kejuaraan<select name="championship_id" required><option value="">Pilih kejuaraan</option>${opts}</select></label><label>Kategori pertandingan<select name="competition_category" required><option value="">Pilih kategori</option></select></label><label id="ageWrap">Kelompok usia<select name="age_group"><option value="">Pilih kelompok usia</option></select></label><label id="weightWrap">Kelas tanding<select name="weight_class"><option value="">Pilih kelas</option></select></label><label id="groupSizeWrap" hidden>Jumlah peserta dalam satu nomor<select name="group_size"><option value="1">1 orang</option><option value="2">2 orang</option><option value="3">3 orang</option><option value="5">5 orang</option></select></label></div><label>Atlet peserta<select name="athlete_ids" multiple size="6" required>${athletes.map(a=>`<option value="${a.id}">${escapeHTML(a.full_name)} (${escapeHTML(a.gender)})</option>`).join('')}</select></label><p class="meta">Untuk nomor beregu/ganda/trio, pilih semua atlet dalam satu nomor sekaligus. Pilihan jumlah peserta akan disesuaikan dengan kategori. Tekan Ctrl (komputer) atau pilih beberapa nama (ponsel) sesuai kemampuan browser.</p><p class="meta" id="categoryHelp"></p>`,'registration');
    const champ=dataForm.elements.championship_id, cat=dataForm.elements.competition_category, age=dataForm.elements.age_group, weight=dataForm.elements.weight_class, size=dataForm.elements.group_size;
    const updateOptions=()=>{const ev=events.find(x=>x.id===champ.value),cfg=ev?.competition_config||{},categories=cfg.categories||[];cat.innerHTML='<option value="">Pilih kategori</option>'+categories.map(x=>`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join('');age.innerHTML='<option value="">Pilih kelompok usia</option>'+(cfg.age_groups||[]).map(x=>`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join('');weight.innerHTML='<option value="">Pilih kelas</option>'+(cfg.weight_classes||[]).map(x=>`<option value="${escapeHTML(x.name)}">${escapeHTML(x.label||x.name+(x.min_kg!==''&&x.max_kg!==''?` (${x.min_kg}–${x.max_kg} kg)`:''))}</option>`).join('');cat.value='';syncCategory()};
    const syncCategory=()=>{const c=cat.value,tanding=isTanding(c),group=isGroupCategory(c);$('#ageWrap').hidden=!tanding;$('#weightWrap').hidden=!(tanding&&c==='Tanding');$('#groupSizeWrap').hidden=!group;age.required=tanding;weight.required=tanding&&c==='Tanding';let allowed=['1'];if(c==='Tanding Bebas Beregu'||/Beregu Tangan/.test(c))allowed=['5'];else if(/Ganda/.test(c))allowed=['2'];else if(/Trio/.test(c))allowed=['3'];else if(c==='Jurus')allowed=['1','3'];else if(c==='Seni Regu IPSI')allowed=['3','5'];else if(group)allowed=['2','3','5'];size.innerHTML=allowed.map(n=>`<option value="${n}">${n} orang</option>`).join('');size.disabled=false;size.value=allowed[0];if(c==='Jurus')$('#categoryHelp').textContent='Nomor jurus dapat diikuti 1 orang (tunggal jurus) atau 3 orang (regu jurus).';else if(c==='Seni Regu IPSI')$('#categoryHelp').textContent='Pilih jumlah peserta regu sesuai juknis kejuaraan.';else if(group)$('#categoryHelp').textContent=`Kategori ini membutuhkan ${allowed.length===1?allowed[0]:'jumlah peserta sesuai pilihan'} atlet dalam satu nomor.`;else $('#categoryHelp').textContent='Kategori perorangan: pilih satu atlet.'};
    champ.onchange=updateOptions;cat.onchange=syncCategory;updateOptions();
  }
  function uploadForm(id){openData('Unggah dokumen dan bukti pembayaran',`<label>Jenis file<select name="kind" required><option value="payment">Bukti pembayaran</option><option value="document">Dokumen atlet</option></select></label><label>Pilih file<input name="file" type="file" required accept="image/*,.pdf"></label><p class="meta">Format gambar atau PDF, maksimal 8 MB.</p>`,'upload',id)}
  async function tabProfile(root){const p=profile;root.innerHTML=`<div class="panel"><h3>Informasi kontingen / perguruan</h3><form id="profileForm"><div class="field-grid">${formField('Nama kontingen','kontingen_name','text',true,`value="${escapeHTML(p.kontingen_name||'')}"`)}${formField('Nama pengelola','manager_name','text',true,`value="${escapeHTML(p.manager_name||'')}"`)}${formField('Nomor HP / WhatsApp','phone','tel',false,`value="${escapeHTML(p.phone||'')}"`)}${formField('Kota / Kabupaten','city','text',false,`value="${escapeHTML(p.city||'')}"`)}${formField('Provinsi','province','text',false,`value="${escapeHTML(p.province||'')}"`)}</div><button class="btn" type="submit">Simpan profil</button></form><p class="meta">Email akun: ${escapeHTML(user.email)}</p></div>`;$('#profileForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));const {error}=await client.from('profiles').update(d).eq('id',user.id);notice(error?sayError(error):'Profil berhasil diperbarui.',error?'error':'success');if(!error)await loadProfile()}}
  async function tabChampionships(root){const {data,error}=await client.from('championships').select('*').order('start_date',{ascending:false});if(error)throw error;root.innerHTML=`<div class="toolbar"><p class="meta">Atur flyer, juknis, peraturan, dan nomor pertandingan untuk setiap kejuaraan.</p><button class="btn" id="addEvent">+ Kejuaraan baru</button></div><div class="panel table-wrap">${data?.length?`<table class="data-table"><thead><tr><th>Kejuaraan</th><th>Tanggal</th><th>Lokasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${data.map(c=>`<tr><td>${escapeHTML(c.name)}<br><small>${c.flyer_path?'Flyer ✓':'Flyer —'} · ${c.technical_guide_path?'Juknis ✓':'Juknis —'}</small></td><td>${fmtDate(c.start_date)}</td><td>${escapeHTML(c.location||'-')}</td><td>${statusLabel(c.status)}</td><td><button class="small-btn" data-edit-event="${c.id}">Edit</button><button class="small-btn danger" data-delete-event="${c.id}">Hapus</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Belum ada kejuaraan.</div>'}</div>`;$('#addEvent').onclick=()=>eventForm();$$('[data-edit-event]',root).forEach(b=>b.onclick=()=>eventForm(data.find(c=>c.id===b.dataset.editEvent)));$$('[data-delete-event]',root).forEach(b=>b.onclick=async()=>{if(!confirm('Hapus kejuaraan ini?'))return;const {error}=await client.from('championships').delete().eq('id',b.dataset.deleteEvent);notice(error?sayError(error):'Kejuaraan dihapus.',error?'error':'success');if(!error){await loadChampionships();renderTab('championships')}})}
  function eventForm(c={}){
    const cfg=c.competition_config||{},rule=cfg.ruleset||'IPSI',categories=cfg.categories||RULE_CATEGORIES[rule],ages=cfg.age_groups||AGE_GROUPS;
    const categoryChecks=(r,selected)=>RULE_CATEGORIES[r].map(x=>`<label class="check-option"><input type="checkbox" name="event_categories" value="${escapeHTML(x)}" ${selected.includes(x)?'checked':''}> ${escapeHTML(x)}</label>`).join('');
    openData(c.id?'Edit kejuaraan':'Tambah kejuaraan',`<div class="field-grid">${formField('Nama kejuaraan','name','text',true,`value="${escapeHTML(c.name||'')}"`)}${formField('Tanggal mulai','start_date','date',true,`value="${c.start_date||''}"`)}${formField('Tanggal selesai','end_date','date',false,`value="${c.end_date||''}"`)}${formField('Batas pendaftaran','registration_deadline','date',false,`value="${c.registration_deadline||''}"`)}${formField('Lokasi','location','text',false,`value="${escapeHTML(c.location||'')}"`)}${selectField('Status','status',[['upcoming','Segera dibuka'],['open','Dibuka'],['closed','Ditutup']])}</div><label>Deskripsi<textarea name="description" rows="3">${escapeHTML(c.description||'')}</textarea></label><hr><h3>Dokumen kejuaraan</h3><div class="field-grid"><label>Flyer kejuaraan (gambar/PDF)<input name="flyer_file" type="file" accept="image/*,.pdf"></label><label>Juknis kejuaraan (PDF)<input name="guide_file" type="file" accept="application/pdf,.pdf"></label></div><p class="meta">Maksimal 12 MB per file. Kosongkan jika tidak ingin mengganti file yang sudah ada.</p><hr><h3>Pengaturan peraturan dan nomor pertandingan</h3>${selectField('Peraturan yang digunakan','ruleset', [['IPSI','Peraturan IPSI'],['TAPAK_SUCI','Peraturan Tapak Suci']])}<div id="categoryChoices" class="check-grid">${categoryChecks(rule,categories)}</div><h4>Kelompok usia tanding</h4><div class="check-grid">${AGE_GROUPS.map(x=>`<label class="check-option"><input type="checkbox" name="event_ages" value="${x}" ${ages.includes(x)?'checked':''}> ${x}</label>`).join('')}</div><h4>Kelas berat tanding</h4><p class="meta">Isi batas berat resmi sesuai juknis kejuaraan. Format satu baris: <b>Nama kelas|min kg|max kg</b>. Jangan isi angka perkiraan jika belum ditetapkan panitia.</p><textarea name="weight_classes" rows="7" placeholder="A|39|42&#10;B|42|45&#10;...&#10;J|...|...&#10;Bebas||">${escapeHTML((cfg.weight_classes||[]).map(x=>`${x.name}|${x.min_kg??''}|${x.max_kg??''}`).join('\n')||defaultWeightLines())}</textarea>`, 'championship',c.id||null);
    if(c.status)dataForm.elements.status.value=c.status;dataForm.elements.ruleset.value=rule;
    const renderChecks=(r,selected)=>{$('#categoryChoices').innerHTML=categoryChecks(r,selected)};
    dataForm.elements.ruleset.onchange=()=>renderChecks(dataForm.elements.ruleset.value,RULE_CATEGORIES[dataForm.elements.ruleset.value]);
  }
  async function tabAdmins(root){root.innerHTML=`<div class="panel"><h3>Buat administrator tambahan</h3><p class="meta">Hanya administrator utama yang dapat membuat akun administrator baru.</p><form id="adminForm"><div class="field-grid">${formField('Nama administrator','full_name')}${formField('Email','email','email')}${formField('Kata sandi sementara','password','password',true,'minlength="10"')}</div><button class="btn" type="submit">Buat akun administrator</button></form></div>`;$('#adminForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));const {data,error}=await client.functions.invoke('create-admin',{body:{email:d.email,password:d.password,full_name:d.full_name}});notice(error?sayError(error):(data?.message||'Akun administrator berhasil dibuat.'),error?'error':'success');if(!error)e.currentTarget.reset()}}
  async function saveData(e){e.preventDefault();const fd=new FormData(dataForm);let payload=Object.fromEntries(fd);let error=null;
    try{
      if(editingType==='athlete'){
        const file=fd.get('photo');delete payload.photo;let photo_path=undefined;if(file?.size)photo_path=await uploadPrivate(file,'athletes');if(photo_path)payload.photo_path=photo_path;
        if(editingId){({error}=await client.from('athletes').update(payload).eq('id',editingId))}else{payload.kontingen_id=user.id;({error}=await client.from('athletes').insert(payload))}
      } else if(editingType==='registration'){
        const athleteIds=fd.getAll('athlete_ids');const category=payload.competition_category;const requiredCount=Number(payload.group_size||1);if(athleteIds.length!==requiredCount)throw new Error(`Kategori ini harus memilih tepat ${requiredCount} atlet.`);
        if(isTanding(category)&&!payload.age_group)throw new Error('Pilih kelompok usia tanding.');if(category==='Tanding'&&!payload.weight_class)throw new Error('Pilih kelas berat tanding.');
        const {data:selectedAthletes,error:athleteLookupError}=await client.from('athletes').select('id,gender').in('id',athleteIds);if(athleteLookupError)throw athleteLookupError;const selectedGenders=new Set((selectedAthletes||[]).map(a=>a.gender));if(category==='Tanding Bebas Beregu'&&selectedGenders.size!==1)throw new Error('Tanding bebas beregu harus satu regu putera saja atau satu regu puteri saja.');if(/^Beregu Tangan/.test(category)&&selectedGenders.size<2)throw new Error('Beregu Tapak Suci harus berisi campuran atlet putera dan puteri.');
        const groupCode=athleteIds.length>1?crypto.randomUUID():null;const rows=athleteIds.map(athlete_id=>({championship_id:payload.championship_id,athlete_id,kontingen_id:user.id,status:'pending',competition_category:category,age_group:payload.age_group||null,weight_class:payload.weight_class||null,group_code:groupCode,group_size:requiredCount}));
        ({error}=await client.from('registrations').insert(rows));
      } else if(editingType==='championship'){
        const ruleset=payload.ruleset;const categories=fd.getAll('event_categories');const ageGroups=fd.getAll('event_ages');const weightClasses=String(payload.weight_classes||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split('|').map(x=>x.trim());return {name:parts[0],min_kg:parts[1]||'',max_kg:parts[2]||'',label:parts[1]&&parts[2]?`${parts[1]}–${parts[2]} kg`:parts[0]}});
        if(!categories.length)throw new Error('Pilih minimal satu kategori pertandingan.');
        payload.competition_config={ruleset,categories,age_groups:ageGroups,weight_classes};delete payload.ruleset;delete payload.event_categories;delete payload.event_ages;delete payload.weight_classes;delete payload.flyer_file;delete payload.guide_file;
        let saved;if(editingId){({data:saved,error}=await client.from('championships').update(payload).eq('id',editingId).select('id').single())}else{({data:saved,error}=await client.from('championships').insert(payload).select('id').single())}if(error)throw error;
        for(const [field,col] of [['flyer_file','flyer_path'],['guide_file','technical_guide_path']]){const file=fd.get(field);if(file?.size){if(file.size>12*1024*1024)throw new Error('Ukuran flyer/juknis maksimal 12 MB.');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${saved.id}/${col}/${crypto.randomUUID()}-${safe}`;const {error:upErr}=await client.storage.from('championship-assets').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(upErr)throw upErr;const {error:updateErr}=await client.from('championships').update({[col]:path}).eq('id',saved.id);if(updateErr)throw updateErr}}
      } else if(editingType==='upload'){
        const file=fd.get('file');const path=await uploadPrivate(file,`registrations/${editingId}`);const kind=payload.kind;
        if(kind==='payment')({error}=await client.from('registrations').update({payment_path:path}).eq('id',editingId));else({error}=await client.from('registration_documents').insert({registration_id:editingId,file_path:path,file_name:file.name,document_type:'other'}));
      }
      if(error)throw error;dataDialog.close();notice('Data berhasil disimpan.','success');if(editingType==='championship')await loadChampionships();await renderTab(activeTab);
    }catch(err){dataMsg(sayError(err),'error')}
  }
  authForm.onsubmit=async e=>{e.preventDefault();if(!client){authMsg('Konfigurasi Supabase belum lengkap. Isi config.js terlebih dahulu.','error');return}const d=Object.fromEntries(new FormData(authForm));$('#authSubmit').disabled=true;authMsg('Memproses…');try{
    if(authMode==='signup'){
      const {data,error}=await client.auth.signUp({email:d.email,password:d.password,options:{data:{kontingen_name:d.kontingen,manager_name:d.manager,phone:d.phone},emailRedirectTo:location.origin+location.pathname}});if(error)throw error;
      if(data.session){user=data.user;await loadProfile();authDialog.close();await enterPortal()}else authMsg('Akun berhasil dibuat. Silakan verifikasi email, lalu masuk menggunakan akun tersebut. Kejuaraan yang dipilih akan tetap tersimpan.','success');
    }else{const {data,error}=await client.auth.signInWithPassword({email:d.email,password:d.password});if(error)throw error;user=data.user;await loadProfile();authDialog.close();await enterPortal()}
  }catch(err){authMsg(sayError(err),'error')}finally{$('#authSubmit').disabled=false}};
  $('#authSwitch').onclick=()=>showAuth(authMode==='login'?'signup':'login');$('#accountBtn').onclick=()=>user?enterPortal():showAuth('login');$('#authClose').onclick=()=>authDialog.close();$('#dataClose').onclick=()=>dataDialog.close();dataForm.onsubmit=saveData;$('#logoutBtn').onclick=async()=>{await client.auth.signOut();user=null;profile=null;leavePortal();location.hash='#top'};
  $$('.portal-tabs .chip').forEach(b=>b.onclick=()=>renderTab(b.dataset.tab));
  $$('.chip[data-f]').forEach(b=>b.onclick=()=>{$$('.chip[data-f]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderPublic(championships)});
  $('#cards').onclick=e=>{
    const b=e.target.closest('[data-register]');if(!b)return;
    const championshipId=b.dataset.register;
    if(!user){
      localStorage.setItem('alp_pending_championship',championshipId);
      showAuth('login');
      authMsg('Untuk mendaftar kejuaraan ini, silakan masuk. Belum punya akun? Pilih “Daftar kontingen” di bawah.');
      return;
    }
    renderTab('registrations').then(()=>registrationForm(championshipId));
  };
  $('#contactBtn').href=`https://wa.me/${cfg.ADMIN_WHATSAPP||'6281234567890'}?text=${encodeURIComponent('Halo, saya ingin memakai Al Husna Pro untuk kejuaraan kami.')}`;
  if(client){client.auth.onAuthStateChange((_event,session)=>{if(session&&!user){user=session.user;setTimeout(async()=>{try{await loadProfile();await enterPortal()}catch(e){notice(sayError(e),'error')}},0)}else if(!session&&user){user=null;profile=null;leavePortal()}})}
  loadChampionships();refreshSession();
})();
