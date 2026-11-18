/* Al Husna Pro · router halaman (alamat bersih seperti situs platform kejuaraan)
 *   /                    Beranda
 *   /kejuaraan           Daftar kejuaraan
 *   /kejuaraan/<slug>    Detail satu kejuaraan (flyer, jadwal, kategori, tombol daftar)
 *   /layanan  /tentang   Halaman informasi
 *   /masuk               Membuka dialog masuk / daftar kontingen
 *   /portal              Dashboard kontingen / admin (perlu login)
 * Data dan pendaftaran tetap dikelola app.js + Supabase; file ini hanya mengatur halaman dan alamat.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const A = () => window.ALP || {};
  const BASE = (window.ALP_BASE || '/').replace(/\/$/, '');
  const href = p => BASE + (p.startsWith('/') ? p : '/' + p);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const META = {
    home: { t: 'Al Husna Pro – Digital Scoring & Event Organizer Pencak Silat', d: 'Al Husna Pro: digital scoring, bagan, jadwal, dan pendaftaran online kejuaraan pencak silat. Daftarkan atlet dari HP.' },
    kejuaraan: { t: 'Kejuaraan Pencak Silat – Pendaftaran Online | Al Husna Pro', d: 'Daftar kejuaraan pencak silat yang memakai Al Husna Pro: cek jadwal, batas pendaftaran, flyer, juknis, lalu daftarkan atlet Anda secara online.' },
    layanan: { t: 'Layanan Digital Scoring & Manajemen Kejuaraan | Al Husna Pro', d: 'Penilaian sesuai aturan IPSI, rangkuman dewan, banyak gelanggang, TV skor, bagan dan jadwal otomatis untuk kejuaraan pencak silat.' },
    tentang: { t: 'Tentang Al Husna Pro', d: 'Al Husna Pro: aplikasi digital scoring dan event organizer kejuaraan pencak silat untuk panitia, manajer tim, dan penonton.' },
    masuk: { t: 'Masuk / Daftar Kontingen | Al Husna Pro', d: 'Masuk atau daftar akun kontingen untuk mendaftarkan atlet ke kejuaraan.', noindex: true },
    portal: { t: 'Portal | Al Husna Pro', d: 'Portal kontingen dan admin Al Husna Pro.', noindex: true },
  };
  const NAVKEY = { detail: 'kejuaraan', masuk: 'home' };
  let portalOpen = false, internalLeave = false;

  /* ---------- URL ---------- */
  function parse(pathname) {
    let p = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
    p = p.replace(/\/+$/, '') || '/';
    const seg = p.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    if (!seg.length) return { page: 'home' };
    if (seg[0] === 'kejuaraan') return seg[1] ? { page: 'detail', slug: seg[1] } : { page: 'kejuaraan' };
    if (['layanan', 'tentang', 'masuk', 'portal'].includes(seg[0])) return { page: seg[0] };
    return { page: 'unknown' };
  }
  const route = () => parse(location.pathname);

  function go(path, opt = {}) {
    const url = href(path);
    if (opt.replace) history.replaceState({}, '', url); else if (url !== location.pathname + location.search) history.pushState({}, '', url);
    render();
  }

  /* ---------- meta / SEO ---------- */
  function setTag(sel, make, attr, val) {
    let el = $(sel); if (!el) { el = make(); document.head.appendChild(el); }
    el.setAttribute(attr, val); return el;
  }
  function setMeta({ title, desc, image, path, noindex }) {
    document.title = title;
    setTag('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), 'content', desc);
    setTag('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }), 'content', noindex ? 'noindex,nofollow' : 'index,follow');
    const url = location.origin + href(path || '/');
    setTag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', url);
    const og = (p, v) => setTag(`meta[property="${p}"]`, () => { const m = document.createElement('meta'); m.setAttribute('property', p); return m; }, 'content', v);
    og('og:title', title); og('og:description', desc); og('og:url', url); og('og:type', 'website'); og('og:site_name', 'Al Husna Pro');
    if (image) og('og:image', image);
  }
  function setLd(obj) {
    let s = $('#ldjson');
    if (!obj) { if (s) s.remove(); return; }
    if (!s) { s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'ldjson'; document.head.appendChild(s); }
    s.textContent = JSON.stringify(obj);
  }

  /* ---------- tampilan ---------- */
  function applyVisibility(key) {
    $$('.public-section').forEach(el => { el.hidden = !(el.dataset.pages || '').split(/\s+/).includes(key); });
    $$('header nav a[data-route]').forEach(a => a.setAttribute('aria-current', a.dataset.route === (NAVKEY[key] || key) ? 'page' : 'false'));
  }

  function facts(c) {
    const a = A(), f = a.fmtDate;
    const tgl = f(c.start_date) + (c.end_date && c.end_date !== c.start_date ? ' – ' + f(c.end_date) : '');
    const rows = [['Tanggal pertandingan', tgl], ['Lokasi', c.location || '-'], ['Batas pendaftaran', f(c.registration_deadline)]];
    const rs = c.competition_config && c.competition_config.ruleset;
    if (rs) rows.push(['Peraturan', rs === 'TAPAK_SUCI' ? 'Tapak Suci' : 'IPSI']);
    return `<dl class="d-facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  }

  function categoriesBlock(c) {
    const a = A();
    if (!c.competition_config || a.configIsEmpty(c.competition_config)) return '';
    const cfg = a.effectiveConfig(c.competition_config);
    const chips = arr => `<div class="d-chips">${arr.map(x => `<span>${esc(x)}</span>`).join('')}</div>`;
    const wc = (cfg.weight_classes || []).filter(w => (w.min_kg !== '' && w.min_kg != null) || (w.max_kg !== '' && w.max_kg != null));
    const wtable = wc.length
      ? `<h3>Kelas berat</h3><div class="d-wrap"><table class="d-tbl"><thead><tr><th>Kelas</th><th>Berat (kg)</th></tr></thead><tbody>${wc.map(w => `<tr><td>${esc(w.label || w.name)}</td><td>${esc(w.min_kg === '' || w.min_kg == null ? '' : w.min_kg)} – ${esc(w.max_kg === '' || w.max_kg == null ? '' : w.max_kg)}</td></tr>`).join('')}</tbody></table></div>`
      : '';
    return `<section class="d-cat"><h3>Nomor pertandingan</h3>${chips(cfg.categories)}<h3>Kelompok usia</h3>${chips(cfg.age_groups)}${wtable}</section>`;
  }

  function detailHTML(c) {
    const a = A();
    const flyer = a.publicAsset(c.flyer_path), guide = a.publicAsset(c.technical_guide_path), isPdf = /\.pdf$/i.test(c.flyer_path || '');
    const pub = c.status === 'open' ? 'buka' : c.status === 'upcoming' ? 'segera' : 'tutup';
    const flyerBlock = !flyer ? '<div class="d-noflyer">Flyer belum diunggah</div>'
      : isPdf ? `<a class="flyer-pdf" href="${esc(flyer)}" target="_blank" rel="noopener">📄 Lihat flyer (PDF)</a>`
      : `<button type="button" class="flyer-thumb" data-flyer="${esc(flyer)}" data-title="${esc(c.name)}" aria-label="Perbesar flyer ${esc(c.name)}"><img src="${esc(flyer)}" alt="Flyer ${esc(c.name)}"></button>`;
    const wa = `https://wa.me/${esc(a.whatsapp || '')}?text=${encodeURIComponent('Halo, saya ingin bertanya tentang kejuaraan "' + c.name + '".')}`;
    const links = [flyer && !isPdf ? `<a href="${esc(flyer)}" target="_blank" rel="noopener">Buka flyer ukuran penuh</a>` : '', guide ? `<a href="${esc(guide)}" target="_blank" rel="noopener">Unduh juknis</a>` : ''].filter(Boolean).join(' · ');
    return `
      <nav class="crumb" aria-label="Navigasi"><a href="${href('/kejuaraan')}" data-link>← Semua kejuaraan</a></nav>
      <article class="detail">
        <div class="d-flyer">${flyerBlock}</div>
        <div class="d-main">
          <span class="st ${pub}">${esc(a.statusLabel(c.status))}</span>
          <h1 class="d-title">${esc(c.name)}</h1>
          ${facts(c)}
          ${c.description ? `<p class="d-desc">${esc(c.description)}</p>` : ''}
          <div class="d-cta">
            <button class="btn" data-register="${esc(c.id)}" ${c.status !== 'open' ? 'disabled' : ''}>${c.status === 'open' ? 'Daftar atlet' : c.status === 'upcoming' ? 'Segera dibuka' : 'Ditutup'}</button>
            ${a.whatsapp ? `<a class="btn ghost" href="${wa}" target="_blank" rel="noopener">Tanya admin via WhatsApp</a>` : ''}
            <button class="btn ghost" type="button" id="shareBtn">Bagikan</button>
          </div>
          <p class="meta" id="shareMsg" role="status"></p>
          ${links ? `<p class="meta">${links}</p>` : ''}
        </div>
      </article>
      ${categoriesBlock(c)}`;
  }

  function renderDetail(slug) {
    const a = A(), box = $('#detailBody');
    if (!a.isLoaded || !a.isLoaded()) { box.innerHTML = '<p class="meta">Memuat data kejuaraan…</p>'; setMeta({ title: 'Kejuaraan | Al Husna Pro', desc: META.kejuaraan.d, path: '/kejuaraan/' + slug }); return; }
    const c = (a.getChampionships() || []).find(x => x._slug === slug);
    if (!c) {
      box.innerHTML = `<nav class="crumb"><a href="${href('/kejuaraan')}" data-link>← Semua kejuaraan</a></nav><h1 class="d-title">Kejuaraan tidak ditemukan</h1><p class="lead">Tautan mungkin salah atau kejuaraan sudah dihapus.</p>`;
      setMeta({ title: 'Kejuaraan tidak ditemukan | Al Husna Pro', desc: META.kejuaraan.d, path: '/kejuaraan/' + slug, noindex: true }); setLd(null); return;
    }
    box.innerHTML = detailHTML(c);
    const flyer = a.publicAsset(c.flyer_path);
    setMeta({ title: `${c.name} – Pendaftaran Online | Al Husna Pro`, desc: `${c.name}${c.location ? ' di ' + c.location : ''}. Pertandingan ${a.fmtDate(c.start_date)}${c.registration_deadline ? ', batas pendaftaran ' + a.fmtDate(c.registration_deadline) : ''}. Daftarkan atlet secara online.`, image: flyer && !/\.pdf$/i.test(flyer) ? flyer : undefined, path: '/kejuaraan/' + c._slug });
    setLd({ '@context': 'https://schema.org', '@type': 'SportsEvent', name: c.name, startDate: c.start_date, ...(c.end_date ? { endDate: c.end_date } : {}), ...(c.location ? { location: { '@type': 'Place', name: c.location } } : {}), ...(c.description ? { description: c.description } : {}), ...(flyer && !/\.pdf$/i.test(flyer) ? { image: flyer } : {}), url: location.origin + href('/kejuaraan/' + c._slug), eventStatus: 'https://schema.org/EventScheduled' });
    const sb = $('#shareBtn');
    if (sb) sb.onclick = async () => {
      const url = location.origin + href('/kejuaraan/' + c._slug), msg = $('#shareMsg');
      try { if (navigator.share) { await navigator.share({ title: c.name, url }); return; } await navigator.clipboard.writeText(url); msg.textContent = 'Tautan disalin.'; }
      catch (e) { if (e && e.name !== 'AbortError') msg.textContent = url; }
    };
  }

  /* ---------- render utama ---------- */
  let seq = 0;
  async function render(opts = {}) {
    const my = ++seq, r = route();
    if (r.page === 'unknown') { history.replaceState({}, '', href('/')); return render(opts); }
    const a = A();
    if (r.page === 'portal') {
      if (a.ready) await a.ready;
      if (my !== seq) return;
      if (!a.hasUser || !a.hasUser()) { go('/masuk', { replace: true }); return; }
      setMeta({ ...META.portal, title: META.portal.t, desc: META.portal.d, path: '/portal' }); setLd(null);
      if (!portalOpen && a.openPortal) a.openPortal();
      return;
    }
    if (portalOpen && a.leavePortal) { internalLeave = true; a.leavePortal(); internalLeave = false; portalOpen = false; }
    const key = r.page === 'masuk' ? 'home' : r.page;
    applyVisibility(key);
    if (r.page === 'detail') renderDetail(r.slug);
    else { const m = META[r.page] || META.home; setMeta({ title: m.t, desc: m.d, path: r.page === 'home' ? '/' : '/' + r.page, noindex: m.noindex }); setLd(null); }
    if (!opts.keepScroll) window.scrollTo(0, 0);
    if (r.page === 'masuk') {
      if (a.ready) await a.ready;
      if (my !== seq) return;
      if (a.hasUser && a.hasUser()) { go('/portal', { replace: true }); return; }
      if (a.showAuth) a.showAuth('login');
    }
  }

  /* ---------- tautan & riwayat ---------- */
  function fixLinks(root = document) {
    $$('a[data-link]', root).forEach(a => {
      const h = a.getAttribute('href') || '/';
      if (h.startsWith('/') && !(BASE && h.startsWith(BASE + '/'))) a.setAttribute('href', href(h));
    });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-link]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const url = new URL(a.href, location.href);
    go(url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) || '/' : url.pathname);
  });
  window.addEventListener('popstate', () => render({ keepScroll: true }));

  window.addEventListener('alp:championships', () => { const r = route(); if (r.page === 'detail') renderDetail(r.slug); });
  window.addEventListener('alp:portal', e => {
    if (!e.detail && internalLeave) return;
    portalOpen = !!e.detail;
    if (portalOpen) {
      if (route().page !== 'portal') history.pushState({}, '', href('/portal'));
      setMeta({ title: META.portal.t, desc: META.portal.d, path: '/portal', noindex: true });
    } else if (route().page === 'portal') go('/', { replace: true });
    else render({ keepScroll: true });
  });
  const dlg = $('#authDialog');
  if (dlg) dlg.addEventListener('close', () => { if (route().page === 'masuk') go('/', { replace: true }); });

  window.ALP_ROUTER = {
    go, href,
    /* true bila setelah sesi ditemukan portal boleh langsung dibuka (halaman portal/masuk atau tautan verifikasi email) */
    wantsPortal() {
      const r = route();
      return r.page === 'portal' || r.page === 'masuk' || /access_token|[?&#]code=|type=(signup|recovery|magiclink|invite)/.test(location.hash + location.search);
    },
  };

  fixLinks();
  render({ keepScroll: true });
})();
