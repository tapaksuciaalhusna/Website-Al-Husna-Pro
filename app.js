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
  const syncAccountBtn=()=>{const b=$('#accountBtn');if(b)b.textContent=user?'Portal saya':'Masuk / Daftar'};
  const wantsPortal=()=>window.ALP_ROUTER?window.ALP_ROUTER.wantsPortal():true;
  // router.js dimuat setelah app.js: tunggu halaman selesai dimuat sebelum memutuskan apakah portal boleh langsung dibuka
  const domReady=()=>document.readyState==='loading'?new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true})):Promise.resolve();
  const notice=(msg,type='')=>{const el=$('#portalNotice');if(el){el.textContent=msg;el.className='msg '+type}};
  const authMsg=(msg,type='')=>{const el=$('#authMessage');el.textContent=msg;el.className='msg '+type};
  const dataMsg=(msg,type='')=>{const el=$('#dataMessage');el.textContent=msg;el.className='msg '+type};
  const sayError=e=>{const m=e?.message||'';if(e?.code==='23503'||/foreign key/i.test(m))return 'Data ini masih dipakai oleh data lain (misalnya pendaftaran atlet). Hapus data yang terkait terlebih dahulu.';return m||'Terjadi kesalahan. Silakan coba lagi.'};
  const isAdmin=()=>['admin','super_admin'].includes(profile?.role);
  const fmtDate=v=>v?new Date(v+'T00:00:00').toLocaleDateString('id-ID'):'-';
  const statusLabel=v=>({open:'Dibuka',upcoming:'Segera dibuka',closed:'Ditutup',pending:'Menunggu verifikasi',verified:'Terverifikasi',rejected:'Perlu perbaikan'})[v]||v||'-';
  const AGE_GROUPS=['Pra Usia Dini 1','Pra Usia Dini 2','Usia Dini 1','Usia Dini 2','Pra Remaja','Remaja','Dewasa','Master'];
  const RULE_CATEGORIES={
    IPSI:['Tanding','Seni Tunggal IPSI','Seni Ganda IPSI','Seni Regu IPSI'],
    TAPAK_SUCI:['Tanding Perorangan','Tanding Bebas Beregu','Tunggal Tangan Kosong','Tunggal Bersenjata','Ganda Tangan Kosong','Ganda Bersenjata','Trio Tangan Kosong','Trio Bersenjata','Beregu Tangan Kosong','Beregu Bersenjata','Jurus']
  };
  const publicAsset=path=>path?client.storage.from('championship-assets').getPublicUrl(path).data.publicUrl:'';
  const isTanding=v=>/^Tanding/.test(v);
  const isGroupCategory=v=>/Ganda|Trio|Beregu/.test(v)||v==='Jurus';
  const needsClass=v=>v==='Tanding'||v==='Tanding Perorangan';
  const defaultWeightClasses=()=>['A','B','C','D','E','F','G','H','I','J','Bebas'].map(n=>({name:n,min_kg:'',max_kg:'',label:n}));
  const configIsEmpty=c=>!(c&&Array.isArray(c.categories)&&c.categories.length);
  const effectiveConfig=c=>{const raw=c||{},rule=RULE_CATEGORIES[raw.ruleset]?raw.ruleset:'IPSI';return{ruleset:rule,categories:raw.categories?.length?raw.categories:RULE_CATEGORIES[rule],age_groups:raw.age_groups?.length?raw.age_groups:AGE_GROUPS,weight_classes:raw.weight_classes?.length?raw.weight_classes:defaultWeightClasses(),fees:raw.fees||{},payment_info:raw.payment_info||''}};
  const defaultWeightLines=()=>['A','B','C','D','E','F','G','H','I','J','Bebas'].map(x=>x+'| | ').join('\n');
  /* ---- Kejuaraan publik: slug alamat, kartu, daftar ---- */
  const slugify=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'kejuaraan';
  const assignSlugs=list=>{const used=new Map();list.forEach(c=>{const s=slugify(c.name),n=used.get(s)||0;used.set(s,n+1);c._slug=n?`${s}-${n+1}`:s})};
  const publicStatusOf=c=>c.status==='open'?'buka':c.status==='upcoming'?'segera':'tutup';
  let championshipsLoaded=false;
  const cardHTML=c=>{
    const flyer=publicAsset(c.flyer_path),guide=publicAsset(c.technical_guide_path),isPdf=/\.pdf$/i.test(c.flyer_path||'');
    const flyerBlock=!flyer?'':(isPdf?`<a class="flyer-pdf" href="${flyer}" target="_blank" rel="noopener">📄 Lihat flyer (PDF)</a>`:`<button type="button" class="flyer-thumb" data-flyer="${escapeHTML(flyer)}" data-title="${escapeHTML(c.name)}" aria-label="Perbesar flyer ${escapeHTML(c.name)}"><img src="${flyer}" alt="Flyer ${escapeHTML(c.name)}" loading="lazy"></button>`);
    const detailHref=window.alpHref?window.alpHref('/kejuaraan/'+c._slug):'#';
    return `<article class="card">${flyerBlock}<span class="st ${c.publicStatus}">${statusLabel(c.status)}</span><h3><a class="clink" href="${detailHref}" data-link>${escapeHTML(c.name)}</a></h3><p class="meta">${fmtDate(c.start_date)}${c.end_date?' – '+fmtDate(c.end_date):''}<br>${escapeHTML(c.location||'-')}</p><p class="meta">Batas daftar: ${fmtDate(c.registration_deadline)}</p>${c.description?`<p>${escapeHTML(c.description)}</p>`:''}<p class="meta">${flyer&&!isPdf?`<a href="${flyer}" target="_blank" rel="noopener">Buka flyer ukuran penuh</a>`:''}${flyer&&!isPdf&&guide?' · ':''}${guide?`<a href="${guide}" target="_blank" rel="noopener">Unduh juknis</a>`:''}</p><div class="card-act"><a class="btn ghost" href="${detailHref}" data-link>Lihat detail</a><button class="btn" data-register="${c.id}" ${c.status!=='open'?'disabled':''}>${c.status==='open'?'Daftar atlet':c.status==='upcoming'?'Segera dibuka':'Ditutup'}</button></div></article>`;
  };
  function renderPublic(list){
    assignSlugs(list);
    $$('[data-cards]').forEach(box=>{
      let mapped=list.map(c=>({...c,publicStatus:publicStatusOf(c)}));
      if(box.dataset.cards==='latest'){
        // beranda: yang dibuka dulu, lalu segera dibuka, lalu yang sudah selesai; maksimal 3
        const rank={buka:0,segera:1,tutup:2},t=c=>new Date(c.start_date).getTime()||0;
        mapped=mapped.sort((a,b)=>(rank[a.publicStatus]-rank[b.publicStatus])||(a.publicStatus==='tutup'?t(b)-t(a):t(a)-t(b))).slice(0,3);
      }else{
        const filter=$('.chip[data-f][aria-pressed="true"]')?.dataset.f||'semua';
        mapped=mapped.filter(c=>filter==='semua'||c.publicStatus===filter);
      }
      box.innerHTML=mapped.length?mapped.map(cardHTML).join(''):'<p class="meta">Belum ada kejuaraan pada kategori ini.</p>';
    });
  }
  async function loadChampionships(){
    const done=()=>{championshipsLoaded=true;window.dispatchEvent(new CustomEvent('alp:championships'))};
    if(!client){renderPublic([]);done();return}
    const {data,error}=await client.from('championships').select('*').order('start_date',{ascending:true});
    if(error){console.error(error);done();return}
    championships=data||[];renderPublic(championships);done();
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
    $('#portal').hidden=false;$$('.public-section').forEach(el=>el.hidden=true);syncAccountBtn();window.dispatchEvent(new CustomEvent('alp:portal',{detail:true}));
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
  function leavePortal(){ $('#portal').hidden=true;syncAccountBtn();if(window.ALP_ROUTER)window.dispatchEvent(new CustomEvent('alp:portal',{detail:false}));else $$('.public-section').forEach(el=>el.hidden=false); }
  let resolveReady;const ready=new Promise(r=>{resolveReady=r});
  async function refreshSession(){
    try{
      if(!client){notice('Supabase belum dikonfigurasi. Isi SUPABASE_ANON_KEY di config.js setelah menyalin key publik dari Supabase.','error');return}
      const {data:{session}}=await client.auth.getSession();
      if(session){user=session.user;syncAccountBtn();try{await loadProfile();await domReady();if(wantsPortal())await enterPortal()}catch(e){notice(sayError(e),'error')}}
    }finally{resolveReady()}
  }
  /* ===== Pembaruan: NIK, foto, berkas, pembayaran keseluruhan, ekspor Excel ===== */
  const REQUIRE={nik:true,photo:true,doc:true}; // ubah menjadi false jika salah satu tidak wajib
  const MAX_UPLOAD=8*1024*1024;
  let adminChamp='',adminVerified='all';
  const rupiah=n=>'Rp\u00a0'+Math.round(Number(n)||0).toLocaleString('id-ID');
  const feeOf=(cfg,cat)=>Number(cfg&&cfg.fees&&cfg.fees[cat])||0;
  const kategoriUmum=c=>/^Tanding/.test(c||'')?'Tanding':'Seni';
  const nikOk=v=>/^\d{16}$/.test(String(v||'').trim());
  const payLabel=v=>({pending:'Menunggu verifikasi admin',verified:'Terverifikasi',rejected:'Ditolak, perlu perbaikan'})[v]||v||'-';
  // Status yang dibaca kontingen: sebelum bukti bayar dikirim, pendaftaran berstatus "Belum dibayar".
  const regStatusText=r=>r.status==='verified'?'Terverifikasi':r.status==='rejected'?'Perlu perbaikan':(r.payment_id?'Menunggu verifikasi admin':'Belum dibayar');
  // Tagihan: perorangan dihitung per baris; ganda/trio/regu dihitung sekali per tim (group_code).
  const billable=(rows,cfg)=>{const seen=new Set();let total=0,items=0;rows.forEach(r=>{if(r.group_code){if(seen.has(r.group_code))return;seen.add(r.group_code)}total+=feeOf(cfg,r.competition_category);items++});return{total,items}};
  const todayISO=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  async function compressImage(file,maxSide=1600,quality=.82){
    try{
      const bmp=await createImageBitmap(file);
      const s=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*s));c.height=Math.max(1,Math.round(bmp.height*s));
      c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',quality));
      if(!blob||blob.size>=file.size)return file;
      return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
    }catch(e){return file}
  }
  async function prepareFile(file,opt={}){
    if(!file||!file.size)return null;
    const isImg=/^image\//.test(file.type),isPdf=file.type==='application/pdf';
    if(opt.image&&!isImg)throw new Error('Foto harus berupa gambar (JPG atau PNG).');
    if(!isImg&&!isPdf)throw new Error(`Berkas "${file.name}" harus berupa gambar atau PDF.`);
    const out=(isImg&&file.size>1.2*1024*1024)?await compressImage(file):file;
    if(out.size>MAX_UPLOAD)throw new Error(`Ukuran "${file.name}" maksimal 8 MB.`);
    return out;
  }
  async function fetchAll(make){
    const out=[],step=1000;
    for(let from=0;;from+=step){
      const {data,error}=await make().range(from,from+step-1);
      if(error)throw error;
      out.push(...(data||[]));
      if(!data||data.length<step)break;
    }
    return out;
  }
  async function openPrivate(path){
    if(!path)throw new Error('File belum diunggah.');
    const {data,error}=await client.storage.from('private-files').createSignedUrl(path,300);
    if(error||!data)throw error||new Error('File tidak ditemukan.');
    window.open(data.signedUrl,'_blank','noopener');
  }
  function downloadFile(bytes,name,mime){
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:mime}));a.download=name;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }

/* ============ EKSPOR EXCEL (.xlsx) – pembuat berkas mandiri, tanpa library ============ */
var CRCT=(function(){var t=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=CRCT[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zipStore(files){
  var enc=new TextEncoder(),parts=[],central=[],offset=0;
  files.forEach(function(f){
    var nm=enc.encode(f.name),crc=crc32(f.data),sz=f.data.length;
    var h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);
    h.setUint32(14,crc,true);h.setUint32(18,sz,true);h.setUint32(22,sz,true);h.setUint16(26,nm.length,true);
    parts.push(new Uint8Array(h.buffer),nm,f.data);
    var c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(14,0x21,true);
    c.setUint32(16,crc,true);c.setUint32(20,sz,true);c.setUint32(24,sz,true);c.setUint16(28,nm.length,true);c.setUint32(42,offset,true);
    central.push(new Uint8Array(c.buffer),nm);
    offset+=30+nm.length+sz;
  });
  var csz=0;central.forEach(function(x){csz+=x.length});
  var e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csz,true);e.setUint32(16,offset,true);
  var all=parts.concat(central,[new Uint8Array(e.buffer)]),tot=0;all.forEach(function(x){tot+=x.length});
  var out=new Uint8Array(tot),p=0;all.forEach(function(x){out.set(x,p);p+=x.length});
  return out;
}
function xe(s){return String(s==null?'':s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function colName(i){var s='';i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s}
/* gaya: 0 biasa, 1 judul, 2 header, 3 sel teks, 4 sel tengah, 5 baris kelompok, 6 catatan */
function sheetXml(sh){
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">'+
    (sh.freeze?'<pane ySplit="'+sh.freeze+'" topLeftCell="A'+(sh.freeze+1)+'" activePane="bottomLeft" state="frozen"/>':'')+'</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
  x+='<cols>'+sh.widths.map(function(w,i){return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>'}).join('')+'</cols><sheetData>';
  sh.rows.forEach(function(row,ri){
    x+='<row r="'+(ri+1)+'">';
    row.forEach(function(cell,ci){
      if(cell==null)return;
      var v=typeof cell==='object'?cell.v:cell,s=typeof cell==='object'&&cell.s?cell.s:0,ref=colName(ci)+(ri+1);
      if(v===''||v==null)x+='<c r="'+ref+'" s="'+s+'"/>';
      else if(typeof v==='number'&&isFinite(v))x+='<c r="'+ref+'" s="'+s+'"><v>'+v+'</v></c>';
      else x+='<c r="'+ref+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+xe(v)+'</t></is></c>';
    });
    x+='</row>';
  });
  x+='</sheetData>';
  if(sh.filter)x+='<autoFilter ref="'+sh.filter+'"/>';
  if(sh.merges&&sh.merges.length)x+='<mergeCells count="'+sh.merges.length+'">'+sh.merges.map(function(m){return '<mergeCell ref="'+m+'"/>'}).join('')+'</mergeCells>';
  return x+'<pageSetup orientation="landscape"/></worksheet>';
}
var XSTYLES='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font></fonts>'+
 '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2B600"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAEAEA"/><bgColor indexed="64"/></patternFill></fill></fills>'+
 '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB0B0B0"/></left><right style="thin"><color rgb="FFB0B0B0"/></right><top style="thin"><color rgb="FFB0B0B0"/></top><bottom style="thin"><color rgb="FFB0B0B0"/></bottom><diagonal/></border></borders>'+
 '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
 '<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
 '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'+
 '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'+
 '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
 '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>'+
 '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'+
 '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'+
 '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
function buildXlsx(sheets){
  var enc=new TextEncoder(),names=[],used={};
  sheets.forEach(function(sh){
    var n=sh.name.replace(/[\[\]:*?\/\\]/g,' ').trim().slice(0,31)||'Sheet',b=n,k=2;
    while(used[n.toLowerCase()]){n=b.slice(0,28)+' '+k++}
    used[n.toLowerCase()]=1;names.push(n);
  });
  var files=[
   {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map(function(s,i){return '<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'}).join('')+'</Types>'},
   {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
   {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+names.map(function(n,i){return '<sheet name="'+xe(n)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>'}).join('')+'</sheets></workbook>'},
   {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map(function(s,i){return '<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>'}).join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
   {name:'xl/styles.xml',data:XSTYLES}
  ];
  sheets.forEach(function(s,i){files.push({name:'xl/worksheets/sheet'+(i+1)+'.xml',data:sheetXml(s)})});
  files.forEach(function(f){if(typeof f.data==='string')f.data=enc.encode(f.data)});
  return zipStore(files);
}


  const EXCEL_HEAD=['No','Nama Peserta','Jenis Kelamin','Kelompok Usia','Kategori','Nomor Pertandingan','Kelas Tanding','Nama Kontingen','NIK','Tanggal Lahir','Berat Badan (kg)','Tim','Status Pendaftaran','Status Pembayaran'];
  const EXCEL_WIDTHS=[5,28,12,17,10,24,24,28,19,13,10,10,22,24];
  function kelasText(cfg,r){
    if(!needsClass(r.competition_category)||!r.weight_class)return '-';
    const w=(cfg.weight_classes||[]).find(x=>x.name===r.weight_class);
    const base=r.weight_class==='Bebas'?'Bebas':'Kelas '+r.weight_class;
    return w&&w.min_kg!==''&&w.max_kg!==''&&w.min_kg!=null&&w.max_kg!=null?`${base} (${w.min_kg}–${w.max_kg} kg)`:base;
  }
  function pesertaSheet(name,title,sub,list){
    const rows=[[{v:title,s:1}],[{v:sub,s:6}],[],EXCEL_HEAD.map(h=>({v:h,s:2}))];
    if(!list.length)rows.push([{v:'Belum ada peserta pada kelompok ini.',s:6}]);
    list.forEach((x,i)=>rows.push([{v:i+1,s:4},{v:x.nama,s:3},{v:x.jk,s:3},{v:x.usia,s:3},{v:x.kat,s:3},{v:x.nomor,s:3},{v:x.kelas,s:3},{v:x.kontingen,s:3},{v:x.nik,s:3},{v:x.lahir,s:4},{v:x.bb,s:4},{v:x.tim,s:4},{v:x.status,s:3},{v:x.bayar,s:3}]));
    return {name,rows,merges:[],freeze:4,filter:list.length?'A4:N'+(4+list.length):'',widths:EXCEL_WIDTHS};
  }
  function rekapSheet(title,list,perK){
    const rows=[[{v:'Rekap Kontingen – '+title,s:1}],[{v:'Diunduh '+fmtDate(todayISO()),s:6}],[],
      ['No','Nama Kontingen','Manajer / Pelatih','WhatsApp','Jumlah Atlet','Jumlah Nomor / Tim','Total Biaya (Rp)','Rincian Status Pembayaran'].map(h=>({v:h,s:2}))];
    list.forEach((k,i)=>rows.push([{v:i+1,s:4},{v:k.nama,s:3},{v:k.manajer,s:3},{v:k.hp,s:3},{v:k.atlet,s:4},{v:k.nomor,s:4},{v:k.total,s:3},{v:k.rincian,s:3}]));
    return {name:'Rekap Kontingen',rows,merges:[],freeze:4,filter:'',widths:[5,30,24,16,13,17,17,50]};
  }
  async function exportExcel(champId,onlyVerified){
    const {data:c,error:ce}=await client.from('championships').select('*').eq('id',champId).single();
    if(ce||!c)throw ce||new Error('Kejuaraan tidak ditemukan.');
    const cfg=effectiveConfig(c.competition_config);
    const [regsAll,pays,profs]=await Promise.all([
      fetchAll(()=>client.from('registrations').select('*, athletes(full_name,nik,gender,birth_date,weight_kg)').eq('championship_id',champId).order('created_at').order('id')),
      fetchAll(()=>client.from('payments').select('*').eq('championship_id',champId).order('created_at').order('id')),
      fetchAll(()=>client.from('profiles').select('id,kontingen_name,manager_name,phone').order('id'))]);
    const prof=new Map(profs.map(p=>[p.id,p])),payById=new Map(pays.map(p=>[p.id,p]));
    const regs=regsAll.filter(r=>!onlyVerified||r.status==='verified');
    if(!regs.length)throw new Error(onlyVerified?'Belum ada peserta yang terverifikasi untuk kejuaraan ini.':'Belum ada pendaftar untuk kejuaraan ini.');
    const bayarText=r=>{if(r.payment_id){const p=payById.get(r.payment_id);return p?payLabel(p.status):'Menunggu verifikasi admin'}return r.status==='verified'?'Terverifikasi':'Belum dibayar'};
    const order=(arr,v)=>{const i=arr.indexOf(v);return i<0?999:i};
    const clsOrder=r=>{const i=(cfg.weight_classes||[]).findIndex(w=>w.name===r.weight_class);return i<0?999:i};
    const items=regs.map(r=>{const a=r.athletes||{},p=prof.get(r.kontingen_id)||{};return {r,
      nama:a.full_name||'-',jk:a.gender||'-',usia:r.age_group||'-',kat:kategoriUmum(r.competition_category),nomor:r.competition_category||'-',kelas:kelasText(cfg,r),
      kontingen:p.kontingen_name||'-',nik:a.nik||'',lahir:a.birth_date?a.birth_date.split('-').reverse().join('-'):'',bb:a.weight_kg!=null?Number(a.weight_kg):'',tim:'',
      status:regStatusText(r),bayar:bayarText(r)}});
    items.sort((x,y)=>order(AGE_GROUPS,x.usia)-order(AGE_GROUPS,y.usia)||(x.kat===y.kat?0:x.kat==='Tanding'?-1:1)||x.nomor.localeCompare(y.nomor,'id')||clsOrder(x.r)-clsOrder(y.r)||x.jk.localeCompare(y.jk,'id')||x.kontingen.localeCompare(y.kontingen,'id')||x.nama.localeCompare(y.nama,'id'));
    const teamNo=new Map(),teamCount=new Map();
    items.forEach(x=>{const g=x.r.group_code;if(!g)return;if(!teamNo.has(g)){const k=x.r.kontingen_id+'|'+x.nomor,n=(teamCount.get(k)||0)+1;teamCount.set(k,n);teamNo.set(g,'Tim '+n)}x.tim=teamNo.get(g)});
    const sub=`${fmtDate(c.start_date)}${c.end_date?' – '+fmtDate(c.end_date):''} · ${c.location||''} · diunduh ${fmtDate(todayISO())} · ${onlyVerified?'hanya yang terverifikasi':'semua pendaftar'}`;
    const sheets=[pesertaSheet('Semua Peserta','Daftar Peserta – '+c.name,sub,items)];
    const usiaList=[...new Set(items.map(x=>x.usia))].sort((a,b)=>order(AGE_GROUPS,a)-order(AGE_GROUPS,b));
    usiaList.forEach(u=>sheets.push(pesertaSheet(u,'Daftar Peserta – '+c.name,'Kelompok usia: '+u,items.filter(x=>x.usia===u))));
    const perK=new Map();
    regs.forEach(r=>{if(!perK.has(r.kontingen_id))perK.set(r.kontingen_id,[]);perK.get(r.kontingen_id).push(r)});
    const rekap=[...perK.entries()].map(([kid,rs])=>{
      const p=prof.get(kid)||{},b=billable(rs,cfg),cnt={};rs.forEach(r=>{const t=bayarText(r);cnt[t]=(cnt[t]||0)+1});
      return {nama:p.kontingen_name||'-',manajer:p.manager_name||'',hp:p.phone||'',atlet:new Set(rs.map(r=>r.athlete_id)).size,nomor:b.items,total:b.total,rincian:Object.entries(cnt).map(([k,v])=>`${k}: ${v}`).join(' · ')};
    }).sort((a,b)=>a.nama.localeCompare(b.nama,'id'));
    sheets.push(rekapSheet(c.name,rekap));
    const slug=String(c.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'kejuaraan';
    downloadFile(buildXlsx(sheets),`peserta-${slug}-${todayISO()}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
  function openData(title,fields,type,id=null){dataDialog.classList.toggle('wide',type==='registration-multi');editingType=type;editingId=id;$('#dataTitle').textContent=title;$('#dataFields').innerHTML=fields;dataMsg('');dataDialog.showModal()}
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
    const ok=v=>v?'✓':'—';
    root.innerHTML=`<div class="toolbar"><p class="meta">Daftar atlet milik kontingen Anda. Lengkapi NIK, foto, dan berkas setiap atlet.</p><button class="btn" id="addAthlete">+ Tambah atlet</button></div><div class="panel table-wrap">${data?.length?`<table class="data-table"><thead><tr><th>Nama atlet</th><th>NIK</th><th>Jenis kelamin</th><th>Berat</th><th>Foto</th><th>Berkas</th><th>Kategori</th><th>Pelatih</th><th>Aksi</th></tr></thead><tbody>${data.map(a=>`<tr><td>${escapeHTML(a.full_name)}</td><td>${escapeHTML(a.nik||'—')}</td><td>${escapeHTML(a.gender)}</td><td>${a.weight_kg} kg</td><td>${ok(a.photo_path)}</td><td>${ok(a.document_path)}</td><td>${escapeHTML(a.category)}</td><td>${escapeHTML(a.coach_name||'-')}</td><td><button class="small-btn" data-edit-athlete="${a.id}">Edit</button><button class="small-btn danger" data-delete-athlete="${a.id}">Hapus</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Belum ada data atlet. Tambahkan atlet pertama Anda.</div>'}</div>`;
    $('#addAthlete').onclick=()=>athleteForm();
    $$('[data-edit-athlete]',root).forEach(b=>b.onclick=()=>athleteForm(data.find(a=>a.id===b.dataset.editAthlete)));
    $$('[data-delete-athlete]',root).forEach(b=>b.onclick=async()=>{if(!confirm('Hapus data atlet ini?'))return;const {error}=await client.from('athletes').delete().eq('id',b.dataset.deleteAthlete);if(error)notice(sayError(error),'error');else renderTab('athletes')});
  }
  function athleteForm(a={}){
    openData(a.id?'Edit atlet':'Tambah atlet',`<div class="field-grid">${formField('Nama lengkap','full_name','text',true,`value="${escapeHTML(a.full_name||'')}"`)}${formField('NIK (16 digit)','nik','text',true,`inputmode="numeric" autocomplete="off" value="${escapeHTML(a.nik||'')}"`)}${formField('Tanggal lahir','birth_date','date',true,`value="${a.birth_date||''}"`)}${selectField('Jenis kelamin','gender',[['Putra','Putra'],['Putri','Putri']])}${formField('Berat badan (kg)','weight_kg','number',true,`step="0.1" min="10" max="150" value="${a.weight_kg||''}"`)}${selectField('Kategori','category',[['Tanding','Tanding'],['Tunggal','Tunggal'],['Ganda','Ganda'],['Regu','Regu']])}${formField('Nama pelatih','coach_name','text',false,`value="${escapeHTML(a.coach_name||'')}"`)}${formField('Nomor HP','phone','tel',false,`value="${escapeHTML(a.phone||'')}"`)}<label>Foto atlet${a.photo_path?' (sudah ada, pilih file untuk mengganti)':''}<input name="photo" type="file" accept="image/*"></label><label>Berkas persyaratan (KK / akta / kartu pelajar; gambar atau PDF)${a.document_path?' (sudah ada, pilih file untuk mengganti)':''}<input name="document" type="file" accept="image/*,.pdf"></label></div><p class="meta">Foto dan berkas maksimal 8 MB. Foto yang besar dikecilkan otomatis.</p>`,'athlete',a.id||null);
    if(a.gender)dataForm.elements.gender.value=a.gender;if(a.category)dataForm.elements.category.value=a.category;
  }
  async function tabRegistrations(root,admin){
    if(admin)return tabAllRegistrations(root);
    const [r1,r2]=await Promise.all([
      client.from('registrations').select('*, championships(id,name,start_date,competition_config), athletes(full_name,nik,photo_path,document_path)').eq('kontingen_id',user.id).order('created_at',{ascending:false}),
      client.from('payments').select('*').eq('kontingen_id',user.id).order('created_at',{ascending:false})]);
    if(r1.error)throw r1.error;if(r2.error)throw r2.error;
    const regs=r1.data||[],pays=r2.data||[],byChamp=new Map();
    regs.forEach(r=>{if(!byChamp.has(r.championship_id))byChamp.set(r.championship_id,[]);byChamp.get(r.championship_id).push(r)});
    const panels=[...byChamp.entries()].map(([cid,rows])=>{
      const ch=rows[0].championships||{},cfg=effectiveConfig(ch.competition_config);
      const unpaid=rows.filter(r=>!r.payment_id&&r.status!=='verified'),bill=billable(unpaid,cfg),myPays=pays.filter(p=>p.championship_id===cid);
      const table=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Atlet</th><th>Nomor / kelas</th><th>Kelompok usia</th><th>Kelengkapan</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHTML(r.athletes?.full_name||'-')}<br><small>${escapeHTML(r.group_code?'Satu regu · '+r.group_size+' peserta':'Perorangan')}</small></td><td>${escapeHTML(r.competition_category||'-')}${r.weight_class?`<br><small>Kelas ${escapeHTML(r.weight_class)}</small>`:''}</td><td>${escapeHTML(r.age_group||'-')}</td><td><small>NIK ${r.athletes?.nik?'✓':'—'} · Foto ${r.athletes?.photo_path?'✓':'—'} · Berkas ${r.athletes?.document_path?'✓':'—'}</small></td><td>${regStatusText(r)}${r.admin_note?`<br><small>${escapeHTML(r.admin_note)}</small>`:''}</td><td>${!r.payment_id&&r.status!=='verified'?`<button type="button" class="small-btn danger" data-del-mine="${r.id}">Hapus</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
      const due=unpaid.length?(bill.total>0?`<div class="panel"><b>Tagihan belum dibayar: ${rupiah(bill.total)}</b><br><small>${bill.items} pendaftaran (ganda, trio, dan regu dihitung satu kali per tim).</small><div style="margin-top:8px"><button class="btn" data-pay="${cid}">Bayar semua tagihan</button></div></div>`:'<p class="msg error">Biaya pendaftaran belum ditetapkan panitia untuk kejuaraan ini. Hubungi panitia sebelum membayar.</p>'):'';
      const history=myPays.map(p=>`<div class="panel"><b>Pembayaran ${rupiah(p.amount)}</b> · ${payLabel(p.status)}<br><small>${p.paid_at?fmtDate(p.paid_at)+' · ':''}${escapeHTML(p.sender_name||'')} · <button type="button" class="small-btn" data-open-file="${escapeHTML(p.proof_path||'')}">Lihat bukti</button></small>${p.admin_note?`<br><small class="msg error">Catatan admin: ${escapeHTML(p.admin_note)}</small>`:''}${p.status==='rejected'?`<div style="margin-top:8px"><button class="btn sm" data-repay="${p.id}">Kirim ulang bukti</button></div>`:''}</div>`).join('');
      return `<div class="panel"><h3>${escapeHTML(ch.name||'Kejuaraan')}</h3>${table}${due}${history}</div>`;
    }).join('');
    root.innerHTML=`<div class="toolbar"><p class="meta">Alur: (1) daftarkan semua atlet, (2) bayar seluruh tagihan sekaligus dan unggah bukti, (3) tunggu verifikasi admin.</p><button class="btn" id="newRegistration">+ Daftarkan atlet</button></div>${panels||'<div class="panel"><div class="empty">Belum ada pendaftaran.</div></div>'}`;
    $('#newRegistration').onclick=()=>registrationForm();
    $$('[data-pay]',root).forEach(b=>b.onclick=()=>{const rows=byChamp.get(b.dataset.pay).filter(r=>!r.payment_id&&r.status!=='verified');paymentForm(rows[0].championships,rows)});
    $$('[data-repay]',root).forEach(b=>b.onclick=()=>repayForm(b.dataset.repay));
    $$('[data-del-mine]',root).forEach(b=>b.onclick=async()=>{
      const r=regs.find(x=>x.id===b.dataset.delMine);if(!r)return;
      const grp=r.group_code?regs.filter(x=>x.group_code===r.group_code&&!x.payment_id&&x.status!=='verified'):[r];
      if(!confirm(`Hapus pendaftaran ${grp.map(x=>x.athletes?.full_name||'-').join(', ')} pada nomor ${r.competition_category||'-'}?`+(grp.length>1?`\n\nIni satu tim (${grp.length} peserta); seluruh anggota tim ikut dihapus.`:'')+'\n\nData atlet tetap tersimpan.'))return;
      try{await removeRegistrations(grp.map(x=>x.id));notice('Pendaftaran dihapus.','success');renderTab('registrations')}catch(err){notice(sayError(err),'error')}
    });
    $$('[data-open-file]',root).forEach(b=>b.onclick=()=>openPrivate(b.dataset.openFile).catch(e=>notice(sayError(e),'error')));
  }
  async function deleteChampionship(c){
    if(!c)return;
    const cnt=async t=>{const {count,error}=await client.from(t).select('id',{count:'exact',head:true}).eq('championship_id',c.id);if(error)throw error;return count||0};
    try{
      const nr=await cnt('registrations'),np=await cnt('payments');
      if(!nr&&!np){if(!confirm(`Hapus kejuaraan "${c.name}"?`))return}
      else{
        const t=prompt(`Kejuaraan "${c.name}" memiliki ${nr} pendaftaran peserta dan ${np} pembayaran.\n\nSemuanya akan ikut DIHAPUS PERMANEN dan tidak bisa dibatalkan. Data atlet milik kontingen tetap tersimpan.\n\nKetik HAPUS untuk melanjutkan.`);
        if(String(t||'').trim().toUpperCase()!=='HAPUS')return;
      }
      if(nr){const {error}=await client.from('registrations').delete().eq('championship_id',c.id);if(error)throw error}
      const {error}=await client.from('championships').delete().eq('id',c.id);if(error)throw error;
      notice('Kejuaraan dihapus.','success');await loadChampionships();renderTab('championships');
    }catch(err){notice(sayError(err),'error')}
  }
  // Hapus pendaftaran; pembayaran yang tidak lagi punya pendaftaran ikut dihapus (khusus admin).
  async function removeRegistrations(ids,payIds=[]){
    if(!ids.length)return;
    const {error}=await client.from('registrations').delete().in('id',ids);if(error)throw error;
    for(const pid of payIds){
      const {count,error:ce}=await client.from('registrations').select('id',{count:'exact',head:true}).eq('payment_id',pid);
      if(!ce&&!count){const {error:pe}=await client.from('payments').delete().eq('id',pid);if(pe)throw pe}
    }
  }
  function paymentForm(ch,rows,payId=null){
    const cfg=effectiveConfig(ch.competition_config),bill=billable(rows,cfg),byCat={},seen=new Set();
    if(bill.total<=0){notice('Biaya pendaftaran belum ditetapkan panitia untuk kejuaraan ini. Hubungi panitia.','error');return}
    rows.forEach(r=>{if(r.group_code){if(seen.has(r.group_code))return;seen.add(r.group_code)}const k=r.competition_category||'-';(byCat[k]=byCat[k]||{n:0,fee:feeOf(cfg,r.competition_category)}).n++});
    const lines=Object.entries(byCat).map(([k,v])=>`<tr><td>${escapeHTML(k)}</td><td>${v.n} × ${rupiah(v.fee)}</td><td>${rupiah(v.n*v.fee)}</td></tr>`).join('');
    openData(payId?'Kirim ulang bukti pembayaran':'Pembayaran keseluruhan',`<h4>${escapeHTML(ch.name||'')}</h4><div class="table-wrap"><table class="data-table"><thead><tr><th>Nomor</th><th>Rincian</th><th>Subtotal</th></tr></thead><tbody>${lines}<tr><td colspan="2"><b>Total yang dibayar</b></td><td><b>${rupiah(bill.total)}</b></td></tr></tbody></table></div><p class="meta">Transfer sesuai total di atas untuk seluruh atlet, lalu unggah bukti transfer.</p>${cfg.payment_info?`<div class="panel" style="white-space:pre-line"><b>Tujuan pembayaran</b><br>${escapeHTML(cfg.payment_info)}</div>`:'<p class="msg error">Informasi rekening belum diisi panitia. Hubungi panitia sebelum mentransfer.</p>'}<div class="field-grid">${formField('Nama pengirim / pemilik rekening','sender_name','text',true,`value="${escapeHTML(profile?.manager_name||'')}"`)}${formField('Tanggal transfer','paid_at','date',true,`value="${todayISO()}"`)}<label>Bukti transfer (gambar atau PDF)<input name="proof" type="file" accept="image/*,.pdf" required></label></div>`,payId?'payment-resubmit':'payment',payId||ch.id);
  }
  async function repayForm(payId){
    const {data,error}=await client.from('registrations').select('*, championships(id,name,competition_config)').eq('payment_id',payId);
    if(error){notice(sayError(error),'error');return}
    if(!data?.length){notice('Data pendaftaran untuk pembayaran ini tidak ditemukan.','error');return}
    paymentForm(data[0].championships,data,payId);
  }
  async function tabAllRegistrations(root){
    const [regs,pays,profs,chs]=await Promise.all([
      fetchAll(()=>client.from('registrations').select('*, championships(id,name,start_date,competition_config), athletes(full_name,nik,gender,photo_path,document_path)').order('created_at',{ascending:false}).order('id')),
      fetchAll(()=>client.from('payments').select('*').order('created_at',{ascending:false}).order('id')),
      fetchAll(()=>client.from('profiles').select('id,kontingen_name,manager_name,phone').order('id')),
      client.from('championships').select('id,name').order('start_date',{ascending:false})]);
    if(chs.error)throw chs.error;
    const prof=new Map(profs.map(p=>[p.id,p])),champs=chs.data||[];
    if(adminChamp&&!champs.some(c=>c.id===adminChamp))adminChamp='';
    const fRegs=adminChamp?regs.filter(r=>r.championship_id===adminChamp):regs,fPays=adminChamp?pays.filter(p=>p.championship_id===adminChamp):pays;
    const payRows=fPays.map(p=>{
      const rs=regs.filter(r=>r.payment_id===p.id),cfg=effectiveConfig(rs[0]?.championships?.competition_config),calc=billable(rs,cfg).total,pr=prof.get(p.kontingen_id);
      return `<tr><td>${escapeHTML(pr?.kontingen_name||'-')}<br><small>${escapeHTML(pr?.manager_name||'')} ${escapeHTML(pr?.phone||'')}</small></td><td>${escapeHTML(rs[0]?.championships?.name||'-')}</td><td>${rs.length} peserta</td><td>${rupiah(calc)}${Math.round(calc)!==Math.round(p.amount)?`<br><small class="msg error">Tercatat ${rupiah(p.amount)}</small>`:''}</td><td>${p.paid_at?fmtDate(p.paid_at):'-'}<br><small>${escapeHTML(p.sender_name||'')}</small></td><td><button type="button" class="small-btn" data-open-file="${escapeHTML(p.proof_path||'')}">Lihat bukti</button></td><td>${payLabel(p.status)}${p.admin_note?`<br><small>${escapeHTML(p.admin_note)}</small>`:''}</td><td>${p.status==='verified'?'':`<button class="small-btn" data-pay-review="verified" data-pay-id="${p.id}">Verifikasi</button>`}${p.status==='rejected'?'':`<button class="small-btn danger" data-pay-review="rejected" data-pay-id="${p.id}">Tolak</button>`}<button class="small-btn danger" data-pay-delete="${p.id}">Hapus</button></td></tr>`;
    }).join('');
    const unpaidMap=new Map();
    fRegs.filter(r=>!r.payment_id&&r.status!=='verified').forEach(r=>{const k=r.kontingen_id+'|'+r.championship_id;if(!unpaidMap.has(k))unpaidMap.set(k,[]);unpaidMap.get(k).push(r)});
    const unpaidRows=[...unpaidMap.values()].map(rs=>{const pr=prof.get(rs[0].kontingen_id),cfg=effectiveConfig(rs[0].championships?.competition_config),b=billable(rs,cfg);return `<tr><td>${escapeHTML(pr?.kontingen_name||'-')}</td><td>${escapeHTML(rs[0].championships?.name||'-')}</td><td>${b.items}</td><td>${rupiah(b.total)}</td><td><button type="button" class="small-btn danger" data-del-unpaid="${rs[0].kontingen_id}|${rs[0].championship_id}">Hapus</button></td></tr>`}).join('');
    const regRows=fRegs.map(r=>{const pr=prof.get(r.kontingen_id);return `<tr><td>${escapeHTML(pr?.kontingen_name||'-')}</td><td>${escapeHTML(r.championships?.name||'-')}</td><td>${escapeHTML(r.athletes?.full_name||'-')}<br><small>NIK ${escapeHTML(r.athletes?.nik||'—')} · ${escapeHTML(r.group_code?'Satu regu · '+r.group_size+' peserta':'Perorangan')}</small></td><td>${escapeHTML(r.competition_category||'-')}${r.weight_class?`<br><small>Kelas ${escapeHTML(r.weight_class)}</small>`:''}</td><td>${escapeHTML(r.age_group||'-')}</td><td>${regStatusText(r)}</td><td><button type="button" class="small-btn" data-open-file="${escapeHTML(r.athletes?.photo_path||'')}" ${r.athletes?.photo_path?'':'disabled'}>Foto</button><button type="button" class="small-btn" data-open-file="${escapeHTML(r.athletes?.document_path||'')}" ${r.athletes?.document_path?'':'disabled'}>Berkas</button></td><td><select data-status="${r.id}"><option value="pending" ${r.status==='pending'?'selected':''}>Menunggu</option><option value="verified" ${r.status==='verified'?'selected':''}>Terverifikasi</option><option value="rejected" ${r.status==='rejected'?'selected':''}>Perlu perbaikan</option></select><br><button type="button" class="small-btn danger" data-del-reg="${r.id}">Hapus</button></td></tr>`}).join('');
    root.innerHTML=`<div class="toolbar"><label>Kejuaraan<select id="admChamp"><option value="">Semua kejuaraan</option>${champs.map(c=>`<option value="${c.id}" ${c.id===adminChamp?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}</select></label><label>Isi file Excel<select id="admVerified"><option value="all" ${adminVerified==='all'?'selected':''}>Semua pendaftar</option><option value="verified" ${adminVerified==='verified'?'selected':''}>Hanya yang terverifikasi</option></select></label><button class="btn" id="exportXlsx">Unduh Excel</button></div><p class="meta">Untuk mengunduh Excel, pilih satu kejuaraan lebih dulu.</p>
      <div class="panel"><h3>Pembayaran kontingen</h3>${payRows?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Kontingen</th><th>Kejuaraan</th><th>Isi</th><th>Tagihan</th><th>Transfer</th><th>Bukti</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${payRows}</tbody></table></div>`:'<div class="empty">Belum ada pembayaran masuk.</div>'}</div>
      ${unpaidRows?`<div class="panel"><h3>Belum mengirim pembayaran</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Kontingen</th><th>Kejuaraan</th><th>Pendaftaran</th><th>Tagihan</th><th></th></tr></thead><tbody>${unpaidRows}</tbody></table></div></div>`:''}
      <div class="panel"><h3>Seluruh peserta</h3>${regRows?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Kontingen</th><th>Kejuaraan</th><th>Atlet</th><th>Nomor / kelas</th><th>Kelompok usia</th><th>Status</th><th>Berkas atlet</th><th>Ubah status</th></tr></thead><tbody>${regRows}</tbody></table></div>`:'<div class="empty">Belum ada pendaftaran.</div>'}</div>`;
    $('#admChamp').onchange=e=>{adminChamp=e.target.value;renderTab('all-registrations')};
    $('#admVerified').onchange=e=>{adminVerified=e.target.value};
    $('#exportXlsx').onclick=async e=>{
      if(!adminChamp){notice('Pilih satu kejuaraan dulu untuk mengunduh Excel.','error');return}
      const b=e.currentTarget;b.disabled=true;notice('Menyiapkan file Excel…');
      try{await exportExcel(adminChamp,adminVerified==='verified');notice('File Excel diunduh.','success')}
      catch(err){notice(sayError(err),'error')}finally{b.disabled=false}
    };
    $$('[data-open-file]',root).forEach(b=>b.onclick=()=>openPrivate(b.dataset.openFile).catch(e=>notice(sayError(e),'error')));
    $$('[data-pay-review]',root).forEach(b=>b.onclick=async()=>{
      const st=b.dataset.payReview;let note=null;
      if(st==='rejected'){note=prompt('Alasan penolakan (wajib, akan dibaca kontingen):');if(!note||!note.trim())return;note=note.trim()}
      else if(!confirm('Verifikasi pembayaran ini? Semua pendaftaran di dalamnya menjadi Terverifikasi.'))return;
      const {error}=await client.rpc('review_payment',{p_payment:b.dataset.payId,p_status:st,p_note:note});
      notice(error?sayError(error):'Status pembayaran diperbarui.',error?'error':'success');if(!error)renderTab('all-registrations');
    });
    const afterDelete=async(fn,okMsg)=>{try{await fn();notice(okMsg,'success');renderTab('all-registrations')}catch(err){notice(sayError(err),'error')}};
    $$('[data-del-reg]',root).forEach(b=>b.onclick=()=>{
      const r=regs.find(x=>x.id===b.dataset.delReg);if(!r)return;
      const grp=r.group_code?regs.filter(x=>x.group_code===r.group_code):[r];
      if(!confirm(`Hapus pendaftaran ${grp.map(x=>x.athletes?.full_name||'-').join(', ')} pada nomor ${r.competition_category||'-'}?`+(grp.length>1?`\n\nIni satu tim (${grp.length} peserta); seluruh anggota tim ikut dihapus.`:'')+(grp.some(x=>x.status==='verified')?'\n\nPendaftaran ini sudah TERVERIFIKASI.':'')+'\n\nData atlet tetap tersimpan. Tindakan ini tidak bisa dibatalkan.'))return;
      afterDelete(()=>removeRegistrations(grp.map(x=>x.id),[...new Set(grp.map(x=>x.payment_id).filter(Boolean))]),'Pendaftaran dihapus.');
    });
    $$('[data-pay-delete]',root).forEach(b=>b.onclick=()=>{
      const id=b.dataset.payDelete,rs=regs.filter(r=>r.payment_id===id);
      if(!confirm(`Hapus pembayaran ini beserta ${rs.length} pendaftaran peserta di dalamnya?\n\nData atlet tetap tersimpan. Tindakan ini tidak bisa dibatalkan.`))return;
      afterDelete(async()=>{await removeRegistrations(rs.map(r=>r.id),[id]);const {error}=await client.from('payments').delete().eq('id',id);if(error)throw error},'Pembayaran dan pendaftarannya dihapus.');
    });
    $$('[data-del-unpaid]',root).forEach(b=>b.onclick=()=>{
      const [kid,cid]=b.dataset.delUnpaid.split('|'),rs=fRegs.filter(r=>r.kontingen_id===kid&&r.championship_id===cid&&!r.payment_id&&r.status!=='verified');
      if(!confirm(`Hapus ${rs.length} pendaftaran yang belum dibayar milik kontingen ini?\n\nData atlet tetap tersimpan. Tindakan ini tidak bisa dibatalkan.`))return;
      afterDelete(()=>removeRegistrations(rs.map(r=>r.id)),'Pendaftaran dihapus.');
    });
    $$('[data-status]',root).forEach(sel=>sel.onchange=async()=>{const {error}=await client.from('registrations').update({status:sel.value}).eq('id',sel.dataset.status);notice(error?sayError(error):'Status pendaftaran diperbarui.',error?'error':'success')});
  }
  /* ===== Formulir pendaftaran multi-peserta (satu kali kirim, banyak peserta) ===== */
  const allowedSizes=c=>{if(!c)return[1];if(c==='Tanding Bebas Beregu'||/^Beregu/.test(c))return[5];if(/Ganda/.test(c))return[2];if(/Trio/.test(c))return[3];if(c==='Jurus')return[1,3];if(c==='Seni Regu IPSI')return[3,5];return[1]};
  const athleteCategoryFor=(c,size)=>/^Tanding/.test(c)?'Tanding':/Ganda/.test(c)?'Ganda':(/Trio|Beregu|Regu/.test(c)||(c==='Jurus'&&size>1))?'Regu':'Tunggal';
  const normName=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
  async function registrationForm(selectedChampionshipId=null){
    const [{data:athletes,error:e1},{data:events,error:e2}]=await Promise.all([
      client.from('athletes').select('id,full_name,gender,birth_date,weight_kg,coach_name,phone,nik,photo_path,document_path').order('full_name'),
      client.from('championships').select('id,name,competition_config').eq('status','open').order('start_date')]);
    if(e1||e2){notice(sayError(e1||e2),'error');return}
    if(!events?.length){notice('Belum ada kejuaraan yang dibuka pendaftarannya.','error');return}
    const saved=athletes||[];let seq=0,event=events.find(x=>x.id===selectedChampionshipId)||(events.length===1?events[0]:null);
    const newMember=()=>({athlete_id:'',name:'',birth:'',gender:'',bb:'',nik:'',photo:null,doc:null,saved:null});
    const newEntry=(from)=>{const e={id:++seq,category:from?.category||'',age:from?.age||'',weight:from?.weight||'',weightTouched:false,size:from?.size||1,members:[]};const n=e.size;for(let i=0;i<n;i++)e.members.push(newMember());return e};
    let entries=[newEntry()];
    const cfgOf=()=>effectiveConfig(event?.competition_config);
    const opts=events.map(x=>`<option value="${x.id}" ${event&&x.id===event.id?'selected':''}>${escapeHTML(x.name)}</option>`).join('');
    openData('Pendaftaran peserta',`<div class="field-grid"><label>Kejuaraan<select name="championship_id" required><option value="">Pilih kejuaraan</option>${opts}</select></label>${formField('Nama pelatih / pendamping (opsional)','coach_name','text',false,'')}${formField('Nomor HP pelatih / manajer (opsional)','phone','tel',false,`value="${escapeHTML(profile?.phone||'')}"`)}</div><p class="meta">Isi data peserta lengkap: nomor pertandingan, kelompok usia, kelas tanding, NIK, foto, dan berkas persyaratan. Klik <b>+ Tambah peserta</b> untuk mendaftarkan banyak peserta sekaligus, lalu tekan Simpan satu kali.</p><div id="regEntries"></div><div class="reg-actions"><button type="button" class="btn ghost sm" id="addEntry">+ Tambah peserta</button><span class="meta" id="regCount"></span></div>`,'registration-multi');
    const box=$('#regEntries'),champSel=dataForm.elements.championship_id;
    const optList=(arr,sel,ph)=>`<option value="">${ph}</option>`+arr.map(v=>`<option value="${escapeHTML(v[0])}" ${String(v[0])===String(sel)?'selected':''}>${escapeHTML(v[1])}</option>`).join('');
    const classRange=w=>{const lo=parseFloat(w.min_kg),hi=parseFloat(w.max_kg);return(Number.isFinite(lo)&&Number.isFinite(hi))?[lo,hi]:null};
    const suggestClass=bb=>{const v=parseFloat(bb);if(!Number.isFinite(v))return null;return (cfgOf().weight_classes||[]).find(w=>{const r=classRange(w);return r&&v>=r[0]&&v<=r[1]})||null};
    function memberHTML(e,m,i){
      const group=e.size>1,ex=saved.length?`<label class="wide-field">Pilih dari atlet tersimpan (opsional)<select data-eid="${e.id}" data-mi="${i}" data-f="athlete_id">${optList(saved.map(a=>[a.id,`${a.full_name} (${a.gender})`]),m.athlete_id,'— Peserta baru —')}</select></label>`:'';
      const note=(file,has,what)=>file?`✓ ${escapeHTML(file.name)} (${Math.max(1,Math.round(file.size/1024))} KB)`:has?`✓ ${what} sudah tersimpan (pilih file untuk mengganti)`:'Belum dipilih';
      const at=`data-eid="${e.id}" data-mi="${i}"`;
      return `<div class="reg-member"><b class="reg-member-t">${group?'Anggota':'Peserta'} ${i+1}</b>${ex}<div class="field-grid"><label>Nama lengkap<input required ${at} data-f="name" value="${escapeHTML(m.name)}" autocomplete="off"></label><label>NIK (16 digit)<input required inputmode="numeric" ${at} data-f="nik" value="${escapeHTML(m.nik)}" autocomplete="off"></label><label>Tanggal lahir<input type="date" required ${at} data-f="birth" value="${escapeHTML(m.birth)}"></label><label>Jenis kelamin<select required ${at} data-f="gender">${optList([['Putra','Putra'],['Putri','Putri']],m.gender,'Pilih')}</select></label><label>Berat badan (kg)<input type="number" step="0.1" min="10" max="150" required ${at} data-f="bb" value="${escapeHTML(m.bb)}"></label><label>Foto atlet<input type="file" accept="image/*" ${at} data-f="photo"><small class="meta">${note(m.photo,m.saved&&m.saved.photo,'foto')}</small></label><label>Berkas persyaratan (KK / akta / kartu pelajar)<input type="file" accept="image/*,.pdf" ${at} data-f="doc"><small class="meta">${note(m.doc,m.saved&&m.saved.doc,'berkas')}</small></label></div></div>`;
    }
    function entryHTML(e,idx){
      const dis=event?'':'disabled',cfg=cfgOf(),cats=event?cfg.categories:[],ages=event?cfg.age_groups:[],cls=event?cfg.weight_classes:[],sizes=allowedSizes(e.category),tanding=needsClass(e.category);
      const clsOpts=cls.map(w=>[w.name,w.label||w.name+(w.min_kg!==''&&w.max_kg!==''?` (${w.min_kg}–${w.max_kg} kg)`:'')]);
      const hint=tanding?(()=>{const s=suggestClass(e.members[0]?.bb);return s?`Sesuai berat badan: kelas ${escapeHTML(s.name)}`:''})():'';
      return `<fieldset class="reg-entry" data-entry="${e.id}"><div class="reg-entry-head"><b>Pendaftaran #${idx+1}</b>${entries.length>1?`<button type="button" class="small-btn danger" data-del-entry="${e.id}">Hapus</button>`:''}</div>${event?'':'<p class="msg error">Pilih kejuaraan terlebih dahulu agar pilihan nomor pertandingan, kelompok usia, dan kelas tampil.</p>'}<div class="field-grid"><label>Nomor pertandingan<select required data-eid="${e.id}" data-f="category" ${dis}>${optList(cats.map(x=>[x,x]),e.category,'Pilih nomor')}</select></label><label>Kelompok usia<select required data-eid="${e.id}" data-f="age" ${dis}>${optList(ages.map(x=>[x,x]),e.age,'Pilih kelompok usia')}</select></label>${tanding?`<label>Kelas tanding<select required data-eid="${e.id}" data-f="weight">${optList(clsOpts,e.weight,'Pilih kelas')}</select></label>`:''}${sizes.length>1?`<label>Jumlah peserta dalam nomor ini<select data-eid="${e.id}" data-f="size">${sizes.map(n=>`<option value="${n}" ${n===e.size?'selected':''}>${n} orang</option>`).join('')}</select></label>`:''}</div>${e.size>1?`<p class="meta">Satu regu/tim berisi ${e.size} anggota.${e.category==='Tanding Bebas Beregu'?' Harus satu regu putera saja atau satu regu puteri saja.':/^Beregu/.test(e.category)?' Harus campuran putera dan puteri.':''}</p>`:''}<p class="meta reg-hint" data-hint="${e.id}">${hint}</p>${e.members.map((m,i)=>memberHTML(e,m,i)).join('')}</fieldset>`;
    }
    const paint=()=>{box.innerHTML=(event&&configIsEmpty(event.competition_config)?'<p class="msg error">Panitia belum menyimpan pengaturan nomor pertandingan untuk kejuaraan ini, jadi yang tampil adalah pilihan standar (kelas A sampai J dan Bebas tanpa batas berat). Hubungi panitia untuk memastikan kelas yang berlaku.</p>':'')+entries.map(entryHTML).join('');const total=entries.reduce((s,e)=>s+e.members.length,0);const est=entries.reduce((a,e)=>a+feeOf(cfgOf(),e.category),0);$('#regCount').textContent=`${entries.length} pendaftaran · ${total} atlet${est?` · perkiraan biaya ${rupiah(est)}`:''}`};
    const resize=e=>{const n=e.size;while(e.members.length<n)e.members.push(newMember());e.members.length=n};
    champSel.onchange=()=>{event=events.find(x=>x.id===champSel.value)||null;entries=[newEntry()];paint()};
    $('#addEntry').onclick=()=>{const last=entries[entries.length-1];const n=newEntry(last&&{category:last.category,age:last.age,weight:last.weight,size:last.size});entries.push(n);paint();box.lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'})};
    box.onclick=ev=>{const d=ev.target.closest('[data-del-entry]');if(!d)return;entries=entries.filter(x=>x.id!==Number(d.dataset.delEntry));paint()};
    box.onchange=ev=>{
      const t=ev.target,f=t.dataset.f;if(!f)return;const e=entries.find(x=>x.id===Number(t.dataset.eid));if(!e)return;
      if(f==='category'){e.category=t.value;e.size=allowedSizes(t.value)[0];e.weight='';e.weightTouched=false;resize(e);paint();return}
      if(f==='size'){e.size=Number(t.value);resize(e);paint();return}
      if(f==='age'){e.age=t.value;return}
      if(f==='weight'){e.weight=t.value;e.weightTouched=true;return}
      const m=e.members[Number(t.dataset.mi)];if(!m)return;
      if(f==='athlete_id'){m.athlete_id=t.value;const a=saved.find(x=>x.id===t.value);if(a){m.name=a.full_name;m.birth=a.birth_date||'';m.gender=a.gender||'';m.bb=a.weight_kg!=null?String(a.weight_kg):'';m.nik=a.nik||'';m.saved={photo:!!a.photo_path,doc:!!a.document_path}}else{m.name='';m.birth='';m.gender='';m.bb='';m.nik='';m.saved=null}m.photo=null;m.doc=null;
        if(needsClass(e.category)&&!e.weightTouched){const s=suggestClass(m.bb);if(s)e.weight=s.name}paint();return}
      if(f==='photo'||f==='doc'){
        const file=(t.files&&t.files[0])||null,small=t.parentElement.querySelector('small');
        if(file&&!(f==='photo'?/^image\//.test(file.type):(/^image\//.test(file.type)||file.type==='application/pdf'))){t.value='';m[f]=null;if(small)small.textContent=f==='photo'?'Format tidak didukung. Pilih gambar (JPG atau PNG).':'Format tidak didukung. Pilih gambar atau PDF.';return}
        m[f]=file;
        if(small)small.textContent=file?`✓ ${file.name} (${Math.max(1,Math.round(file.size/1024))} KB)`:(m.saved&&m.saved[f]?'✓ sudah tersimpan':'Belum dipilih');
        return;
      }
      m[f]=t.value;
      if(f==='bb'&&needsClass(e.category)){const s=suggestClass(t.value);const h=box.querySelector(`[data-hint="${e.id}"]`);if(h)h.textContent=s?`Sesuai berat badan: kelas ${s.name}`:'';if(s&&!e.weightTouched){e.weight=s.name;const sel=box.querySelector(`select[data-eid="${e.id}"][data-f="weight"]`);if(sel)sel.value=s.name}}
    };
    box.oninput=ev=>{const t=ev.target,f=t.dataset.f;if(!f||t.tagName==='SELECT'||t.type==='file')return;const e=entries.find(x=>x.id===Number(t.dataset.eid));const m=e?.members[Number(t.dataset.mi)];if(m){if(f==='nik')t.value=t.value.replace(/\D/g,'').slice(0,16);m[f]=t.value;if(m.athlete_id&&(f==='name'||f==='birth')){m.athlete_id='';m.saved=null;const sel=box.querySelector(`select[data-eid="${e.id}"][data-mi="${t.dataset.mi}"][data-f="athlete_id"]`);if(sel)sel.value=''}}};
    regState={get:()=>({event,entries,saved,form:dataForm})};
    paint();
  }
  let regState=null;
  async function saveRegistrations(){
    const {event,entries,saved}=regState.get(),fd=new FormData(dataForm);
    if(!event)throw new Error('Pilih kejuaraan terlebih dahulu.');
    if(!entries.length)throw new Error('Tambahkan minimal satu peserta.');
    const cfg=effectiveConfig(event.competition_config),coach=String(fd.get('coach_name')||'').trim()||null,phone=String(fd.get('phone')||'').trim()||null;
    const keyOf=m=>normName(m.name)+'|'+m.birth;
    const savedKey=a=>normName(a.full_name)+'|'+a.birth_date;
    const byKey=new Map(saved.map(a=>[savedKey(a),a.id]));
    const savedById=new Map(saved.map(a=>[a.id,a]));
    const preKey=new Map(byKey);
    const exOf=m=>savedById.get(m.athlete_id)||savedById.get(byKey.get(keyOf(m)))||null;
    const nikOf=m=>String(m.nik||'').trim()||(exOf(m)&&exOf(m).nik)||'';
    const seen=new Set(),nikSeen=new Map();
    entries.forEach((e,i)=>{
      const label=`Pendaftaran #${i+1}`;
      if(!e.category)throw new Error(`${label}: pilih nomor pertandingan.`);
      if(!e.age)throw new Error(`${label}: pilih kelompok usia.`);
      if(needsClass(e.category)&&!e.weight)throw new Error(`${label}: pilih kelas tanding.`);
      if(e.members.length!==e.size)throw new Error(`${label}: jumlah peserta harus ${e.size} orang.`);
      const genders=new Set(e.members.map(m=>m.gender));
      if(e.category==='Tanding Bebas Beregu'&&genders.size!==1)throw new Error(`${label}: tanding bebas beregu harus satu regu putera saja atau satu regu puteri saja.`);
      if(/^Beregu (Tangan|Bersenjata)/.test(e.category)&&genders.size<2)throw new Error(`${label}: beregu Tapak Suci harus berisi campuran putera dan puteri.`);
      const names=new Set();
      e.members.forEach((m,j)=>{
        const who=`${label}, peserta ${j+1}`;
        if(!m.name.trim()||!m.birth||!m.gender||!m.bb)throw new Error(`${who}: lengkapi nama, tanggal lahir, jenis kelamin, dan berat badan.`);
        const w=parseFloat(m.bb);if(!(w>=10&&w<=150))throw new Error(`${who}: berat badan harus 10–150 kg.`);
        if(names.has(keyOf(m)))throw new Error(`${label}: atlet ${m.name} dimasukkan dua kali dalam satu nomor.`);names.add(keyOf(m));
        const dup=e.category+'|'+keyOf(m);if(seen.has(dup))throw new Error(`Atlet ${m.name} dimasukkan dua kali pada nomor ${e.category}.`);seen.add(dup);
        const nik=nikOf(m);
        if(REQUIRE.nik&&!nikOk(nik))throw new Error(`${who}: NIK harus 16 digit angka.`);
        if(nik){
          if(nikSeen.has(nik)&&nikSeen.get(nik)!==keyOf(m))throw new Error(`${who}: NIK ${nik} dipakai atlet lain pada formulir ini.`);
          nikSeen.set(nik,keyOf(m));
          const other=saved.find(a=>a.nik&&a.nik===nik&&savedKey(a)!==keyOf(m));
          if(other)throw new Error(`${who}: NIK ${nik} sudah tercatat atas nama ${other.full_name}.`);
        }
        const ex=exOf(m);
        if(REQUIRE.photo&&!m.photo&&!(ex&&ex.photo_path))throw new Error(`${who}: unggah foto atlet.`);
        if(REQUIRE.doc&&!m.doc&&!(ex&&ex.document_path))throw new Error(`${who}: unggah berkas persyaratan.`);
      });
      if(needsClass(e.category)){
        const cl=(cfg.weight_classes||[]).find(x=>x.name===e.weight),lo=parseFloat(cl?.min_kg),hi=parseFloat(cl?.max_kg),w=parseFloat(e.members[0].bb);
        if(Number.isFinite(lo)&&Number.isFinite(hi)&&(w<lo||w>hi))throw new Error(`${label}: berat ${w} kg tidak masuk kelas ${cl.name} (${lo}–${hi} kg). Pilih kelas yang sesuai.`);
      }
    });
    // 1) kumpulkan data per atlet (satu atlet dapat tampil di beberapa nomor) lalu unggah foto/berkas satu kali
    const info=new Map();
    entries.forEach(e=>e.members.forEach(m=>{
      const k=keyOf(m),cur=info.get(k)||{m,nik:'',photo:null,doc:null,cat:athleteCategoryFor(e.category,e.size)};
      cur.nik=cur.nik||nikOf(m);cur.photo=cur.photo||m.photo;cur.doc=cur.doc||m.doc;info.set(k,cur);
    }));
    let n=0;
    for(const it of info.values()){
      n++;
      const pf=await prepareFile(it.photo,{image:true}),df=await prepareFile(it.doc);
      if(pf){dataMsg(`Mengunggah foto ${it.m.name} (${n}/${info.size})…`);it.photo_path=await uploadPrivate(pf,'athletes')}
      if(df){dataMsg(`Mengunggah berkas ${it.m.name} (${n}/${info.size})…`);it.document_path=await uploadPrivate(df,'athletes')}
    }
    // 2) simpan atlet baru dan perbarui data atlet lama (NIK/foto/berkas)
    dataMsg('Menyimpan data…');
    const toCreate=[];
    for(const [k,it] of info){
      const exId=it.m.athlete_id||preKey.get(k);
      if(!exId){toCreate.push({kontingen_id:user.id,full_name:it.m.name.trim(),birth_date:it.m.birth,gender:it.m.gender,weight_kg:parseFloat(it.m.bb),category:it.cat,coach_name:coach,phone,nik:it.nik||null,photo_path:it.photo_path||null,document_path:it.document_path||null});continue}
      const ex=savedById.get(exId)||{},patch={};
      if(it.nik&&it.nik!==ex.nik)patch.nik=it.nik;
      if(it.photo_path)patch.photo_path=it.photo_path;
      if(it.document_path)patch.document_path=it.document_path;
      if(Object.keys(patch).length){const {error}=await client.from('athletes').update(patch).eq('id',exId);if(error)throw error}
    }
    let createdIds=[];
    if(toCreate.length){
      const {data:ins,error}=await client.from('athletes').insert(toCreate).select('id,full_name,birth_date');if(error)throw error;
      ins.forEach(a=>{byKey.set(savedKey(a),a.id);createdIds.push(a.id)});
    }
    // 3) daftarkan semua peserta ke kejuaraan sekaligus
    const rows=[];
    entries.forEach(e=>{const gc=e.size>1?crypto.randomUUID():null;e.members.forEach(m=>{rows.push({championship_id:event.id,athlete_id:m.athlete_id||byKey.get(keyOf(m)),kontingen_id:user.id,status:'pending',competition_category:e.category,age_group:e.age,weight_class:needsClass(e.category)?e.weight:null,group_code:gc,group_size:e.size})})});
    const {error:regErr}=await client.from('registrations').insert(rows);
    if(regErr){
      if(createdIds.length)await client.from('athletes').delete().in('id',createdIds);
      if(regErr.code==='23505')throw new Error('Salah satu atlet sudah terdaftar pada nomor pertandingan yang sama di kejuaraan ini.');
      throw regErr;
    }
    return rows.length;
  }
  function uploadForm(id){openData('Unggah dokumen dan bukti pembayaran',`<label>Jenis file<select name="kind" required><option value="payment">Bukti pembayaran</option><option value="document">Dokumen atlet</option></select></label><label>Pilih file<input name="file" type="file" required accept="image/*,.pdf"></label><p class="meta">Format gambar atau PDF, maksimal 8 MB.</p>`,'upload',id)}
  async function tabProfile(root){const p=profile;root.innerHTML=`<div class="panel"><h3>Informasi kontingen / perguruan</h3><form id="profileForm"><div class="field-grid">${formField('Nama kontingen','kontingen_name','text',true,`value="${escapeHTML(p.kontingen_name||'')}"`)}${formField('Nama pengelola','manager_name','text',true,`value="${escapeHTML(p.manager_name||'')}"`)}${formField('Nomor HP / WhatsApp','phone','tel',false,`value="${escapeHTML(p.phone||'')}"`)}${formField('Kota / Kabupaten','city','text',false,`value="${escapeHTML(p.city||'')}"`)}${formField('Provinsi','province','text',false,`value="${escapeHTML(p.province||'')}"`)}</div><button class="btn" type="submit">Simpan profil</button></form><p class="meta">Email akun: ${escapeHTML(user.email)}</p></div>`;$('#profileForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));const {error}=await client.from('profiles').update(d).eq('id',user.id);notice(error?sayError(error):'Profil berhasil diperbarui.',error?'error':'success');if(!error)await loadProfile()}}
  async function tabChampionships(root){const {data,error}=await client.from('championships').select('*').order('start_date',{ascending:false});if(error)throw error;root.innerHTML=`<div class="toolbar"><p class="meta">Atur flyer, juknis, peraturan, dan nomor pertandingan untuk setiap kejuaraan.</p><button class="btn" id="addEvent">+ Kejuaraan baru</button></div><div class="panel table-wrap">${data?.length?`<table class="data-table"><thead><tr><th>Kejuaraan</th><th>Tanggal</th><th>Lokasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${data.map(c=>`<tr><td>${escapeHTML(c.name)}<br><small>${c.flyer_path?'Flyer ✓':'Flyer —'} · ${c.technical_guide_path?'Juknis ✓':'Juknis —'}</small></td><td>${fmtDate(c.start_date)}</td><td>${escapeHTML(c.location||'-')}</td><td>${statusLabel(c.status)}</td><td><button class="small-btn" data-edit-event="${c.id}">Edit</button><button class="small-btn danger" data-delete-event="${c.id}">Hapus</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Belum ada kejuaraan.</div>'}</div>`;$('#addEvent').onclick=()=>eventForm();$$('[data-edit-event]',root).forEach(b=>b.onclick=()=>eventForm(data.find(c=>c.id===b.dataset.editEvent)));$$('[data-delete-event]',root).forEach(b=>b.onclick=()=>deleteChampionship(data.find(c=>c.id===b.dataset.deleteEvent)))}
  function eventForm(c={}){
    const cfg=c.competition_config||{},rule=cfg.ruleset||'IPSI',categories=cfg.categories||RULE_CATEGORIES[rule],ages=cfg.age_groups||AGE_GROUPS;
    const categoryChecks=(r,selected)=>RULE_CATEGORIES[r].map(x=>`<div class="check-option" style="flex-wrap:wrap"><label class="check-option"><input type="checkbox" name="event_categories" value="${escapeHTML(x)}" ${selected.includes(x)?'checked':''}> ${escapeHTML(x)}</label><input type="number" min="0" step="1000" inputmode="numeric" data-fee-cat="${escapeHTML(x)}" placeholder="Biaya (Rp)" aria-label="Biaya ${escapeHTML(x)} (Rp)" value="${cfg.fees&&cfg.fees[x]?cfg.fees[x]:''}" style="max-width:130px"></div>`).join('');
    openData(c.id?'Edit kejuaraan':'Tambah kejuaraan',`<div class="field-grid">${formField('Nama kejuaraan','name','text',true,`value="${escapeHTML(c.name||'')}"`)}${formField('Tanggal mulai','start_date','date',true,`value="${c.start_date||''}"`)}${formField('Tanggal selesai','end_date','date',false,`value="${c.end_date||''}"`)}${formField('Batas pendaftaran','registration_deadline','date',false,`value="${c.registration_deadline||''}"`)}${formField('Lokasi','location','text',false,`value="${escapeHTML(c.location||'')}"`)}${selectField('Status','status',[['upcoming','Segera dibuka'],['open','Dibuka'],['closed','Ditutup']])}</div><label>Deskripsi<textarea name="description" rows="3">${escapeHTML(c.description||'')}</textarea></label><hr><h3>Dokumen kejuaraan</h3><div class="field-grid"><label>Flyer kejuaraan (gambar/PDF)<input name="flyer_file" type="file" accept="image/*,.pdf"></label><label>Juknis kejuaraan (PDF)<input name="guide_file" type="file" accept="application/pdf,.pdf"></label></div><p class="meta">Maksimal 12 MB per file. Kosongkan jika tidak ingin mengganti file yang sudah ada.</p><hr><h3>Pengaturan peraturan dan nomor pertandingan</h3>${selectField('Peraturan yang digunakan','ruleset', [['IPSI','Peraturan IPSI'],['TAPAK_SUCI','Peraturan Tapak Suci']])}${c.id&&configIsEmpty(c.competition_config)?'<p class="msg error">Pengaturan nomor pertandingan kejuaraan ini <b>belum pernah disimpan</b>. Centang yang diperlukan di bawah ini, lalu tekan Simpan agar pilihannya tampil bagi kontingen.</p>':''}<p class="meta">Centang nomor yang dibuka dan isi <b>biaya pendaftaran</b> tiap nomor dalam rupiah. Perorangan dihitung per atlet; ganda, trio, dan regu dihitung per tim.</p><div id="categoryChoices" class="check-grid">${categoryChecks(rule,categories)}</div><h4>Kelompok usia tanding</h4><div class="check-grid">${AGE_GROUPS.map(x=>`<label class="check-option"><input type="checkbox" name="event_ages" value="${x}" ${ages.includes(x)?'checked':''}> ${x}</label>`).join('')}</div><h4>Kelas berat tanding</h4><p class="meta">Isi batas berat resmi sesuai juknis kejuaraan. Format satu baris: <b>Nama kelas|min kg|max kg</b>. Jangan isi angka perkiraan jika belum ditetapkan panitia.</p><textarea name="weight_classes" rows="7" placeholder="A|39|42&#10;B|42|45&#10;...&#10;J|...|...&#10;Bebas||">${escapeHTML((cfg.weight_classes||[]).map(x=>`${x.name}|${x.min_kg??''}|${x.max_kg??''}`).join('\n')||defaultWeightLines())}</textarea><h4>Informasi pembayaran</h4><p class="meta">Tampil kepada kontingen saat membayar. Isi nama bank, nomor rekening, dan atas nama.</p><textarea name="payment_info" rows="4" placeholder="Bank ... No. rekening ... a.n. ...">${escapeHTML(cfg.payment_info||'')}</textarea>`, 'championship',c.id||null);
    if(c.status)dataForm.elements.status.value=c.status;dataForm.elements.ruleset.value=rule;
    const renderChecks=(r,selected)=>{$('#categoryChoices').innerHTML=categoryChecks(r,selected)};
    dataForm.elements.ruleset.onchange=()=>renderChecks(dataForm.elements.ruleset.value,RULE_CATEGORIES[dataForm.elements.ruleset.value]);
  }
  async function tabAdmins(root){root.innerHTML=`<div class="panel"><h3>Buat administrator tambahan</h3><p class="meta">Hanya administrator utama yang dapat membuat akun administrator baru.</p><form id="adminForm"><div class="field-grid">${formField('Nama administrator','full_name')}${formField('Email','email','email')}${formField('Kata sandi sementara','password','password',true,'minlength="10"')}</div><button class="btn" type="submit">Buat akun administrator</button></form></div>`;$('#adminForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));const {data,error}=await client.functions.invoke('create-admin',{body:{email:d.email,password:d.password,full_name:d.full_name}});notice(error?sayError(error):(data?.message||'Akun administrator berhasil dibuat.'),error?'error':'success');if(!error)e.currentTarget.reset()}}
  let saving=false;
  async function saveData(e){e.preventDefault();if(saving)return;saving=true;const sb=dataForm.querySelector('[type=submit]');if(sb)sb.disabled=true;try{await saveDataInner(e)}finally{saving=false;if(sb)sb.disabled=false}}
  async function saveDataInner(e){e.preventDefault();const fd=new FormData(dataForm);let payload=Object.fromEntries(fd);let error=null;
    try{
      if(editingType==='athlete'){
        const nik=String(payload.nik||'').replace(/\D/g,'');if(!nikOk(nik))throw new Error('NIK harus 16 digit angka.');payload.nik=nik;
        const pf=await prepareFile(fd.get('photo'),{image:true}),df=await prepareFile(fd.get('document'));delete payload.photo;delete payload.document;
        if(pf){dataMsg('Mengunggah foto…');payload.photo_path=await uploadPrivate(pf,'athletes')}
        if(df){dataMsg('Mengunggah berkas…');payload.document_path=await uploadPrivate(df,'athletes')}
        if(!editingId&&REQUIRE.photo&&!payload.photo_path)throw new Error('Foto atlet wajib diunggah.');
        if(!editingId&&REQUIRE.doc&&!payload.document_path)throw new Error('Berkas persyaratan wajib diunggah.');
        if(editingId){({error}=await client.from('athletes').update(payload).eq('id',editingId))}else{payload.kontingen_id=user.id;({error}=await client.from('athletes').insert(payload))}
      } else if(editingType==='registration-multi'){
        const n=await saveRegistrations();dataDialog.close();notice(`${n} peserta berhasil didaftarkan. Setelah semua atlet terdaftar, klik "Bayar semua tagihan" di bawah untuk membayar sekaligus.`,'success');await renderTab('registrations');return;
      } else if(editingType==='registration'){
        const athleteIds=fd.getAll('athlete_ids');const category=payload.competition_category;const requiredCount=Number(payload.group_size||1);if(athleteIds.length!==requiredCount)throw new Error(`Kategori ini harus memilih tepat ${requiredCount} atlet.`);
        if(isTanding(category)&&!payload.age_group)throw new Error('Pilih kelompok usia tanding.');if(category==='Tanding'&&!payload.weight_class)throw new Error('Pilih kelas berat tanding.');
        const {data:selectedAthletes,error:athleteLookupError}=await client.from('athletes').select('id,gender').in('id',athleteIds);if(athleteLookupError)throw athleteLookupError;const selectedGenders=new Set((selectedAthletes||[]).map(a=>a.gender));if(category==='Tanding Bebas Beregu'&&selectedGenders.size!==1)throw new Error('Tanding bebas beregu harus satu regu putera saja atau satu regu puteri saja.');if(/^Beregu Tangan/.test(category)&&selectedGenders.size<2)throw new Error('Beregu Tapak Suci harus berisi campuran atlet putera dan puteri.');
        const groupCode=athleteIds.length>1?crypto.randomUUID():null;const rows=athleteIds.map(athlete_id=>({championship_id:payload.championship_id,athlete_id,kontingen_id:user.id,status:'pending',competition_category:category,age_group:payload.age_group||null,weight_class:payload.weight_class||null,group_code:groupCode,group_size:requiredCount}));
        ({error}=await client.from('registrations').insert(rows));
      } else if(editingType==='championship'){
        const ruleset=payload.ruleset;const categories=fd.getAll('event_categories');const ageGroups=fd.getAll('event_ages');const weightClasses=String(payload.weight_classes||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split('|').map(x=>x.trim());return {name:parts[0],min_kg:parts[1]||'',max_kg:parts[2]||'',label:parts[1]&&parts[2]?`${parts[1]}–${parts[2]} kg`:parts[0]}});
        if(!categories.length)throw new Error('Pilih minimal satu kategori pertandingan.');
        if(!ageGroups.length)throw new Error('Pilih minimal satu kelompok usia.');
        if(categories.some(needsClass)&&!weightClasses.length)throw new Error('Isi minimal satu kelas berat untuk nomor tanding.');
        const fees={};$$('input[data-fee-cat]',dataForm).forEach(i=>{if(categories.includes(i.dataset.feeCat)){const v=Number(i.value);fees[i.dataset.feeCat]=Number.isFinite(v)&&v>0?Math.round(v):0}});
        payload.competition_config={ruleset,categories,age_groups:ageGroups,weight_classes:weightClasses,fees,payment_info:String(payload.payment_info||'').trim()};delete payload.payment_info;delete payload.ruleset;delete payload.event_categories;delete payload.event_ages;delete payload.weight_classes;delete payload.flyer_file;delete payload.guide_file;
        let saved;if(editingId){({data:saved,error}=await client.from('championships').update(payload).eq('id',editingId).select('id').single())}else{({data:saved,error}=await client.from('championships').insert(payload).select('id').single())}if(error)throw error;
        for(const [field,col] of [['flyer_file','flyer_path'],['guide_file','technical_guide_path']]){const file=fd.get(field);if(file?.size){if(file.size>12*1024*1024)throw new Error('Ukuran flyer/juknis maksimal 12 MB.');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${saved.id}/${col}/${crypto.randomUUID()}-${safe}`;const {error:upErr}=await client.storage.from('championship-assets').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(upErr)throw upErr;const {error:updateErr}=await client.from('championships').update({[col]:path}).eq('id',saved.id);if(updateErr)throw updateErr}}
      } else if(editingType==='payment'||editingType==='payment-resubmit'){
        const file=await prepareFile(fd.get('proof'));if(!file)throw new Error('Pilih file bukti transfer.');
        const sender=String(payload.sender_name||'').trim();if(!sender)throw new Error('Isi nama pengirim.');
        dataMsg('Mengunggah bukti pembayaran…');
        const path=await uploadPrivate(file,`payments/${editingId}`);
        const args={p_proof:path,p_sender:sender,p_paid:payload.paid_at||null};
        const {error:rpcErr}=editingType==='payment'?await client.rpc('submit_payment',{p_championship:editingId,...args}):await client.rpc('resubmit_payment',{p_payment:editingId,...args});
        if(rpcErr)throw rpcErr;
        dataDialog.close();notice('Bukti pembayaran terkirim. Admin akan memverifikasi pembayaran dan seluruh pendaftaran Anda.','success');await renderTab('registrations');return;
      } else if(editingType==='upload'){
        const file=fd.get('file');const path=await uploadPrivate(file,`registrations/${editingId}`);const kind=payload.kind;
        if(kind==='payment')({error}=await client.from('registrations').update({payment_path:path}).eq('id',editingId));else({error}=await client.from('registration_documents').insert({registration_id:editingId,file_path:path,file_name:file.name,document_type:'other'}));
      }
      if(error)throw error;dataDialog.close();notice('Data berhasil disimpan.','success');if(editingType==='championship')await loadChampionships();await renderTab(activeTab);
    }catch(err){dataMsg(sayError(err),'error')}
  }
  authForm.onsubmit=async e=>{e.preventDefault();if(!client){authMsg('Konfigurasi Supabase belum lengkap. Isi config.js terlebih dahulu.','error');return}const d=Object.fromEntries(new FormData(authForm));$('#authSubmit').disabled=true;authMsg('Memproses…');try{
    if(authMode==='signup'){
      const {data,error}=await client.auth.signUp({email:d.email,password:d.password,options:{data:{kontingen_name:d.kontingen,manager_name:d.manager,phone:d.phone},emailRedirectTo:location.origin+(window.ALP_BASE||'/')}});if(error)throw error;
      if(data.session){user=data.user;await loadProfile();authDialog.close();await enterPortal()}else authMsg('Akun berhasil dibuat. Silakan verifikasi email, lalu masuk menggunakan akun tersebut. Kejuaraan yang dipilih akan tetap tersimpan.','success');
    }else{const {data,error}=await client.auth.signInWithPassword({email:d.email,password:d.password});if(error)throw error;user=data.user;await loadProfile();authDialog.close();await enterPortal()}
  }catch(err){authMsg(sayError(err),'error')}finally{$('#authSubmit').disabled=false}};
  $('#authSwitch').onclick=()=>showAuth(authMode==='login'?'signup':'login');$('#accountBtn').onclick=()=>user?enterPortal():showAuth('login');$('#authClose').onclick=()=>authDialog.close();$('#dataClose').onclick=()=>dataDialog.close();$('#flyerClose').onclick=()=>$('#flyerDialog').close();$('#flyerDialog').addEventListener('click',e=>{if(e.target.id==='flyerDialog')e.target.close()});dataForm.onsubmit=saveData;$('#logoutBtn').onclick=async()=>{await client.auth.signOut();user=null;profile=null;leavePortal();location.hash='#top'};
  // Saat portal aktif, bagian publik disembunyikan. Tampilkan kembali sebelum mengikuti tautan navigasi header.
  $('header').addEventListener('click',e=>{const link=e.target.closest('a[href^="#"]');if(link&&!$('#portal').hidden)leavePortal()});
  $$('.portal-tabs .chip').forEach(b=>b.onclick=()=>renderTab(b.dataset.tab));
  $$('.chip[data-f]').forEach(b=>b.onclick=()=>{$$('.chip[data-f]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderPublic(championships)});
  const startRegistration=async championshipId=>{
    localStorage.setItem('alp_pending_championship',championshipId);
    if(!user){
      showAuth('login');
      authMsg('Untuk mendaftar kejuaraan ini, silakan masuk. Belum punya akun? Pilih “Daftar kontingen” di bawah.');
      return;
    }
    await enterPortal(); // enterPortal melanjutkan ke formulir pendaftaran kejuaraan yang dipilih
  };
  $('main').addEventListener('click',e=>{
    const fl=e.target.closest('[data-flyer]');if(fl){$('#flyerImg').src=fl.dataset.flyer;$('#flyerImg').alt='Flyer '+fl.dataset.title;$('#flyerTitle').textContent=fl.dataset.title;$('#flyerDialog').showModal();return}
    const b=e.target.closest('[data-register]');if(!b||b.disabled)return;
    startRegistration(b.dataset.register);
  });
  $('#contactBtn').href=`https://wa.me/${cfg.ADMIN_WHATSAPP||'6281234567890'}?text=${encodeURIComponent('Halo, saya ingin memakai Al Husna Pro untuk kejuaraan kami.')}`;
  if(client){client.auth.onAuthStateChange((_event,session)=>{if(session&&!user){user=session.user;syncAccountBtn();setTimeout(async()=>{try{await loadProfile();await domReady();if(wantsPortal())await enterPortal()}catch(e){notice(sayError(e),'error')}},0)}else if(!session&&user){user=null;profile=null;leavePortal()}})}
  window.ALP={getChampionships:()=>championships,isLoaded:()=>championshipsLoaded,publicAsset,escapeHTML,fmtDate,statusLabel,effectiveConfig,configIsEmpty,showAuth,hasUser:()=>!!user,openPortal:()=>enterPortal(),leavePortal,ready,whatsapp:cfg.ADMIN_WHATSAPP||''};
  syncAccountBtn();
  loadChampionships();refreshSession();
})();
