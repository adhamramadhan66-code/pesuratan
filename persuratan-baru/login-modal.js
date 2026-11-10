/* Popup login (tampilan terang). Halaman bisa dilihat tanpa login; begitu pengunjung menekan
   tombol/tautan/isian apa pun, popup ini muncul. Setelah login, halaman dimuat ulang (atau
   langsung membuka tautan yang tadi ditekan). Tidak aktif bila sesi login sudah ada. */
(function () {
    'use strict';
    const SESSION_KEY = 'kampuslyCurrentUser';
    const DEMO_EMAIL = 'admin@tsu.ac.id';
    const DEMO_PASSWORD = 'tsu12345';

    try {
        const u = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
        if (u && u.email === DEMO_EMAIL) return;   // sudah login
    } catch (e) {}

    // ---------- Gaya (terang, tidak ikut tema gelap halaman) ----------
    const css = document.createElement('style');
    css.textContent = `
    #lgModal { position: fixed; inset: 0; margin: auto; width: fit-content; height: fit-content; border: 0; padding: 0; background: transparent; max-width: none; max-height: none; overflow: visible; color: #1b2a22; font-family: 'Inter', system-ui, sans-serif; }
    #lgModal::backdrop { background: rgba(255,255,255,.62); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
    #lgModal .lg-card { position: relative; width: min(420px, calc(100vw - 2rem)); background: #fff; border: 1px solid #e3e8e5; border-radius: 18px; padding: 28px 28px 24px; box-shadow: 0 24px 60px rgba(20,40,30,.16), 0 2px 8px rgba(20,40,30,.06); }
    #lgModal .lg-x { position: absolute; top: 12px; right: 12px; width: 34px; height: 34px; border: 0; border-radius: 50%; background: transparent; color: #6b7a72; font-size: 22px; line-height: 1; cursor: pointer; }
    #lgModal .lg-x:hover { background: #f1f4f2; color: #1b2a22; }
    #lgModal .lg-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
    #lgModal .lg-mark { width: 34px; height: 34px; border-radius: 9px; background: #2E9E68; display: flex; align-items: center; justify-content: center; }
    #lgModal .lg-mark svg { width: 18px; height: 18px; }
    #lgModal .lg-name { font-size: 19px; font-weight: 700; }
    #lgModal h2 { margin: 0 0 4px; font-size: 22px; font-weight: 600; color: #1b2a22; }
    #lgModal .lg-sub { margin: 0 0 18px; font-size: 13.5px; color: #6b7a72; }
    #lgModal .lg-google { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 11px; background: #fff; border: 1px solid #d6ddd9; border-radius: 10px; font: inherit; font-size: 14.5px; font-weight: 500; color: #1b2a22; cursor: pointer; }
    #lgModal .lg-google:hover { background: #f6f8f7; }
    #lgModal .lg-google svg { width: 18px; height: 18px; }
    #lgModal .lg-or { display: flex; align-items: center; gap: 12px; margin: 16px 0; font-size: 13px; color: #8a978f; }
    #lgModal .lg-or::before, #lgModal .lg-or::after { content: ""; flex: 1; height: 1px; background: #e3e8e5; }
    #lgModal .lg-msg { display: none; margin: 0 0 12px; padding: 9px 12px; border-radius: 9px; font-size: 13px; background: #fdecec; color: #b42318; }
    #lgModal .lg-msg.show { display: block; }
    #lgModal .lg-msg.ok { background: #e8f6ee; color: #1F7A4D; }
    #lgModal label { display: block; margin-bottom: 6px; font-size: 13.5px; font-weight: 500; color: #44524b; }
    #lgModal .lg-field { margin-bottom: 14px; }
    #lgModal .lg-in { position: relative; }
    #lgModal .lg-in svg { position: absolute; left: 13px; top: 50%; width: 17px; height: 17px; transform: translateY(-50%); color: #8a978f; pointer-events: none; }
    #lgModal input { width: 100%; box-sizing: border-box; padding: 11px 12px 11px 40px; background: #fff; border: 1px solid #d6ddd9; border-radius: 10px; font: inherit; font-size: 14.5px; color: #1b2a22; }
    #lgModal input::placeholder { color: #9aa8a0; }
    #lgModal input:focus { outline: none; border-color: #2E9E68; box-shadow: 0 0 0 3px rgba(46,158,104,.18); }
    #lgModal .lg-forgot { display: block; text-align: right; margin: -2px 0 16px; font-size: 13px; font-weight: 500; color: #1F7A4D; text-decoration: none; }
    #lgModal .lg-forgot:hover { text-decoration: underline; }
    #lgModal .lg-go { width: 100%; padding: 12px; border: 0; border-radius: 10px; background: #2E9E68; color: #fff; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
    #lgModal .lg-go:hover { background: #1F7A4D; }
    #lgModal .lg-go:disabled { opacity: .7; cursor: default; }
    #lgModal .lg-note { margin: 16px 0 10px; text-align: center; font-size: 13px; color: #6b7a72; }
    #lgModal .lg-demo { margin: 0; padding: 10px; text-align: center; font-size: 12.5px; line-height: 1.6; color: #6b7a72; background: #f6f8f7; border: 1px solid #e3e8e5; border-radius: 10px; }
    #lgModal .lg-demo strong { color: #1b2a22; font-weight: 600; }`;
    document.head.appendChild(css);

    // ---------- Popup ----------
    const dlg = document.createElement('dialog');
    dlg.id = 'lgModal';
    dlg.setAttribute('aria-label', 'Masuk ke akunmu');
    dlg.innerHTML =
        '<div class="lg-card">' +
        '<button type="button" class="lg-x" aria-label="Tutup">&times;</button>' +
        '<div class="lg-brand"><div class="lg-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><span class="lg-name">Kampusly</span></div>' +
        '<h2>Masuk ke akunmu</h2>' +
        '<p class="lg-sub">Masuk dulu untuk melanjutkan.</p>' +
        '<button type="button" class="lg-google"><svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.4 29.4 35.5 24 35.5 16.5 35.5 10.5 29.5 10.5 22S16.5 8.5 24 8.5c3.6 0 6.8 1.4 9.3 3.6l5.7-5.7C35.6 3 30.1 1 24 1 11.8 1 2 10.8 2 23s9.8 22 22 22c11.3 0 21-8.2 21-22 0-1.5-.2-2.5-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.8 19 12.5 24 12.5c3.6 0 6.8 1.4 9.3 3.6l5.7-5.7C35.6 6.5 30.1 4.5 24 4.5c-7.4 0-13.8 4.1-17.1 10.2z"/><path fill="#4CAF50" d="M24 44.5c6 0 11.3-2 15-5.6l-6.9-5.7c-2 1.5-4.7 2.3-8.1 2.3-5.3 0-9.8-3.6-11.3-8.5l-6.7 5.2C9.2 39.8 16 44.5 24 44.5z"/><path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.9 2.9-2.9 5.1-5.4 6.7l6.9 5.7C41 37.5 44 30.9 44 23c0-1.5-.2-2.5-.4-2.5z"/></svg>Google</button>' +
        '<div class="lg-or">atau</div>' +
        '<p class="lg-msg" role="alert" aria-live="polite"></p>' +
        '<form novalidate>' +
        '<div class="lg-field"><label for="lgEmail">Alamat email</label><div class="lg-in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg><input type="email" id="lgEmail" placeholder="nama@contoh.com" autocomplete="email"></div></div>' +
        '<div class="lg-field"><label for="lgPass">Kata sandi</label><div class="lg-in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><input type="password" id="lgPass" placeholder="Masukkan kata sandi" autocomplete="current-password"></div></div>' +
        '<a href="#" class="lg-forgot">Lupa kata sandi?</a>' +
        '<button type="submit" class="lg-go">Masuk</button>' +
        '</form>' +
        '<p class="lg-note">Akun tunggal untuk prototipe demo ini.</p>' +
        '<p class="lg-demo">Akun demo: <strong>' + DEMO_EMAIL + '</strong><br>Kata sandi: <strong>' + DEMO_PASSWORD + '</strong></p>' +
        '</div>';
    document.body.appendChild(dlg);

    const msg = dlg.querySelector('.lg-msg'), form = dlg.querySelector('form'), go = dlg.querySelector('.lg-go');
    const email = dlg.querySelector('#lgEmail'), pass = dlg.querySelector('#lgPass');
    let tujuan = '';   // tautan yang tadi ditekan; dibuka setelah login

    const pesan = (t, ok) => { msg.textContent = t; msg.className = 'lg-msg show' + (ok ? ' ok' : ''); };
    function buka(href) {
        tujuan = href || '';
        msg.className = 'lg-msg'; email.value = ''; pass.value = '';
        if (!dlg.open) dlg.showModal();
        email.focus();
    }
    dlg.querySelector('.lg-x').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelector('.lg-google').addEventListener('click', () => pesan('Login Google belum dihubungkan pada prototipe ini. Gunakan akun demo di bawah form.'));
    dlg.querySelector('.lg-forgot').addEventListener('click', (e) => { e.preventDefault(); pesan('Fitur lupa kata sandi belum tersedia pada prototipe demo ini.'); });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const em = email.value.trim().toLowerCase(), pw = pass.value;
        if (!em || !pw) { pesan('Masukkan alamat email dan kata sandi terlebih dahulu.'); return; }
        if (em !== DEMO_EMAIL || pw !== DEMO_PASSWORD) { pesan('Email atau kata sandi salah. Gunakan akun demo yang ditampilkan di bawah form.'); return; }
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: DEMO_EMAIL, name: 'Admin TSU' })); }
        catch (err) { pesan('Sesi tidak dapat disimpan oleh browser. Jalankan lewat localhost.'); return; }
        go.disabled = true; pesan('Login berhasil...', true);
        setTimeout(() => { if (tujuan) window.location.href = tujuan; else window.location.reload(); }, 350);
    });

    // ---------- Penjaga: tekan apa pun (kecuali tema & buka/tutup sidebar) -> minta login ----------
    const BOLEH = '#themeToggle, #sidebarToggle, .sidebar-backdrop, #lgModal';
    const BISA_DITEKAN = 'a[href], button, input, select, textarea, label, summary, [role="button"], .kartu-klik, .jenis-card';
    function perluLogin(el) {
        if (!el || !el.closest || el.closest(BOLEH)) return null;
        const t = el.closest(BISA_DITEKAN);
        return t || null;
    }
    document.addEventListener('click', (e) => {
        const t = perluLogin(e.target);
        if (!t) return;
        const a = t.closest('a[href]');
        let href = '';
        if (a) {
            const h = a.getAttribute('href') || '';
            if (a.origin === location.origin && a.pathname === location.pathname && !a.search) { return; }   // tautan ke halaman ini sendiri
            // Tautan ke tab baru atau situs lain (mis. Google Drive): setelah login cukup muat ulang halaman ini.
            if (h && h.charAt(0) !== '#' && !/^javascript:/i.test(h) && a.origin === location.origin && a.target !== '_blank') href = a.href;
        }
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        buka(href);
    }, true);
    document.addEventListener('submit', (e) => {
        if (e.target.closest && e.target.closest('#lgModal')) return;
        e.preventDefault(); e.stopImmediatePropagation(); buka('');
    }, true);
    // Navigasi papan ketik pada kartu surat (Enter/Spasi) juga dijaga
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && (e.target.classList.contains('kartu-klik') || e.target.classList.contains('dk-card') || e.target.classList.contains('detail-tutup'))) {
            e.preventDefault(); e.stopImmediatePropagation(); buka('');
        }
    }, true);
})();
