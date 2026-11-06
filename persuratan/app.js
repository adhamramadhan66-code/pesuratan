/* Bagian bersama semua halaman: tema, sesi login, logout, sidebar, ikon, dan fungsi bantu. */
(function () {
    'use strict';
    const SESSION_KEY = 'kampuslyCurrentUser';
    const $ = (id) => document.getElementById(id);

    // ---------- Sesi login (akun & peran dari server: api/auth.php) ----------
    const NAMA_PERAN = { admin: 'Admin', pimpinan: 'Pimpinan', staf: 'Staf' };
    // Menu per peran: Penomoran hanya untuk admin.
    const MENU_ADMIN_SAJA = ['penomoran.html'];

    function keLogin() {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
        window.location.replace('index.html');
    }
    function bacaSesi() {
        try {
            const u = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
            return u && u.peran && u.id ? u : null;
        } catch (e) { return null; }
    }
    function cekSesi() { const u = bacaSesi(); if (!u) keLogin(); return u; }
    const user = cekSesi();
    if (user) {
        if ($('currentUserLabel')) $('currentUserLabel').textContent = user.nama;
        document.querySelectorAll('.nav-menu a.nav-item').forEach((a) => {
            if (user.peran !== 'admin' && MENU_ADMIN_SAJA.includes((a.getAttribute('href') || '').split('?')[0])) a.style.display = 'none';
        });
        // Halaman khusus admin: peran lain dikembalikan ke dashboard.
        if (user.peran !== 'admin' && MENU_ADMIN_SAJA.some((h) => location.pathname.endsWith(h))) location.replace('dashboard.html');
        // Pastikan sesi server masih berlaku (mis. server dimulai ulang).
        fetch('api/auth.php?aksi=saya', { cache: 'no-store' }).then((r) => { if (r.status === 401) keLogin(); }).catch(() => {});
    }
    window.addEventListener('pageshow', cekSesi);
    if ($('logoutBtn')) $('logoutBtn').addEventListener('click', (ev) => {
        ev.preventDefault();
        fetch('api/auth.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aksi: 'logout' }) })
            .catch(() => {}).finally(() => {
                try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
                window.location.replace('index.html?logout=1');
            });
    });

    // ---------- Tema gelap/terang ----------
    const root = document.documentElement, tbtn = $('themeToggle');
    if (tbtn) {
        const sync = () => {
            const dark = root.dataset.theme !== 'light';
            tbtn.setAttribute('aria-pressed', String(dark));
            tbtn.title = dark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap';
        };
        sync();
        tbtn.addEventListener('click', () => {
            root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
            try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
            sync();
        });
    }

    // ---------- Sidebar buka/tutup ----------
    const sb = $('mainSidebar'), tg = $('sidebarToggle');
    if (sb && tg) {
        const set = (open) => {
            sb.classList.toggle('expanded', open);
            tg.classList.toggle('expanded', open);
            tg.setAttribute('aria-expanded', String(open));
            tg.setAttribute('aria-label', open ? 'Tutup sidebar' : 'Buka sidebar');
        };
        set(true);
        tg.addEventListener('click', () => set(!sb.classList.contains('expanded')));
    }

    if (window.lucide) lucide.createIcons();
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('preload')));

    // ---------- Fungsi bantu untuk halaman ----------
    const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const tglIndo = (iso) => {                       // 2026-10-03 -> 03 Oktober 2026
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
        return m ? m[3] + ' ' + BULAN[+m[2] - 1] + ' ' + m[1] : '-';
    };
    const hariIni = () => {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };

    // Panggilan ke API. 'badan' bisa object (dikirim JSON), FormData, atau kosong (GET).
    async function api(url, badan) {
        let opsi = { cache: 'no-store' };
        if (badan instanceof FormData) opsi = { method: 'POST', body: badan };
        else if (badan) opsi = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(badan) };
        let res;
        try { res = await fetch(url, opsi); } catch (e) { throw new Error('Tidak dapat terhubung ke server.'); }
        if (res.status === 401) { keLogin(); throw new Error('Sesi login berakhir.'); }
        let data = null;
        try { data = await res.json(); } catch (e) {}
        if (!res.ok || !data) {
            throw new Error((data && data.error) || 'Server PHP tidak aktif. Buka lewat Laragon (http://localhost/...) atau jalankan jalankan.bat.');
        }
        return data;
    }

    // Ikon untuk kartu (SVG langsung, karena kartu digambar ulang lewat JavaScript)
    const SVG = (isi) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + isi + '</svg>';
    const IKON = {
        plus: SVG('<path d="M12 5v14M5 12h14"/>'),
        file: SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
    };

    // Pratinjau pada kartu: gambar asli untuk JPG/PNG, ikon dokumen untuk PDF, dan penanda bila belum ada file.
    function thumb(urlFile, namaFile) {
        if (!namaFile) return '<span class="kartu-isi">' + IKON.file + '<small>Belum ada file</small></span>';
        if (/\.(jpe?g|png)$/i.test(namaFile)) return '<img src="' + esc(urlFile) + '" alt="" loading="lazy">';
        return '<span class="kartu-isi">' + IKON.file + '<small>PDF</small></span>';
    }

    // Kartu seragam untuk semua halaman. o: {kelas, thumb (HTML), judul, sub: [HTML...], status (HTML), aksi (HTML)}
    function kartuHtml(o) {
        return '<div class="kartu ' + (o.kelas || '') + '">' + o.thumb +
            '<div class="kartu-judul mono" title="' + esc(o.judulTeks || '') + '">' + o.judul + '</div>' +
            (o.sub || []).map((s, i) => '<div class="kartu-sub' + (i ? ' satu' : '') + '">' + s + '</div>').join('') +
            (o.status ? '<div class="kartu-status">' + o.status + '</div>' : '') +
            (o.aksi ? '<div class="aksi">' + o.aksi + '</div>' : '') + '</div>';
    }
    // Pratinjau yang bisa diklik: membuka file bila ada, bila tidak tampil penanda "Belum ada file"
    function thumbFile(urlFile, namaFile, ada) {
        return ada
            ? '<a class="kartu-thumb" href="' + esc(urlFile) + '" target="_blank" rel="noopener" title="Buka file surat">' + thumb(urlFile, namaFile) + '</a>'
            : '<div class="kartu-thumb kosong">' + thumb('', '') + '</div>';
    }

    // Validasi file unggahan di sisi peramban (server tetap memeriksa ulang). Mengembalikan pesan galat atau ''.
    const MAKS_FILE = 10 * 1024 * 1024;
    function cekFile(f) {
        if (!f) return '';
        if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return 'Format file harus PDF, JPG, atau PNG.';
        if (f.size > MAKS_FILE) return 'Ukuran file maksimal 10 MB.';
        return '';
    }

    let tt;
    function toast(pesan, galat) {
        const t = $('toast');
        if (!t) return;
        t.textContent = pesan;
        t.className = 'toast show' + (galat ? ' error' : '');
        clearTimeout(tt);
        tt = setTimeout(() => t.classList.remove('show'), 3200);
    }

    const bisa = (...p) => !!user && (user.peran === 'admin' || p.includes(user.peran));   // admin boleh semua
    window.App = { bisa, user, peran: user ? user.peran : '', NAMA_PERAN, $, esc, tglIndo, hariIni, api, toast, BULAN, IKON, thumb, cekFile, kartuHtml, thumbFile };
})();
