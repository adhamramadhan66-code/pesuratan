/* Bagian bersama semua halaman: tema, sesi login, logout, sidebar, ikon, dan fungsi bantu. */
(function () {
    'use strict';
    const SESSION_KEY = 'kampuslyCurrentUser';
    const $ = (id) => document.getElementById(id);

    // ---------- Sesi login (prototipe, sama seperti sebelumnya) ----------
    function cekSesi() {
        try {
            const u = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
            if (!u || u.email !== 'admin@tsu.ac.id') { window.location.replace('index.html'); return null; }
            return u;
        } catch (e) { window.location.replace('index.html'); return null; }
    }
    const user = cekSesi();
    if (user && $('currentUserLabel')) $('currentUserLabel').textContent = user.name || user.email;
    window.addEventListener('pageshow', cekSesi);
    if ($('logoutBtn')) $('logoutBtn').addEventListener('click', (ev) => {
        ev.preventDefault();
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
        window.location.replace('index.html?logout=1');
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
        let data = null;
        try { data = await res.json(); } catch (e) {}
        if (!res.ok || !data) {
            throw new Error((data && data.error) || 'Server PHP tidak aktif. Buka lewat Laragon (http://localhost/...) atau jalankan jalankan.bat.');
        }
        return data;
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

    window.App = { $, esc, tglIndo, hariIni, api, toast, BULAN };
})();
