/* Bagian bersama semua halaman: tema, sesi login, logout, sidebar, ikon, dan fungsi bantu. */
(function () {
    'use strict';
    const SESSION_KEY = 'kampuslyCurrentUser';
    const $ = (id) => document.getElementById(id);

    // ---------- Sesi login (prototipe) ----------
    // Halaman boleh dibuka tanpa login. Popup login (login-modal.js) muncul saat pengunjung
    // menekan sesuatu. Di sini hanya menampilkan nama bila sudah login.
    function bacaSesi() {
        try {
            const u = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
            return u && u.email === 'admin@tsu.ac.id' ? u : null;
        } catch (e) { return null; }
    }
    const user = bacaSesi();
    if (user && $('currentUserLabel')) $('currentUserLabel').textContent = user.name || user.email;
    // Bila sesi hilang saat kembali lewat tombol Back (cache halaman), muat ulang agar status benar.
    window.addEventListener('pageshow', (e) => { if (e.persisted && !!bacaSesi() !== !!user) window.location.reload(); });

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

    // Kartu seragam untuk semua halaman, gaya toko online: di galeri hanya pratinjau + nomor + perihal.
    // Klik kartu membuka detail (status, keterangan, dan semua tombol aksi) dalam dialog.
    // o: {kelas, thumb (HTML), judul, judulTeks, sub: [HTML...], status (HTML), aksi (HTML)}
    function kartuHtml(o) {
        const w = document.createElement('div');
        w.innerHTML = o.thumb || '';
        const asli = w.firstElementChild;                       // pratinjau asli (tautan ke file / tombol unggah) dipindah ke dialog
        const isi = asli ? asli.innerHTML : '';
        const petunjuk = asli && asli.getAttribute('title') ? '<p class="detail-petunjuk">' + esc(asli.getAttribute('title')) + '</p>' : '';
        const sub = o.sub || [];
        return '<article class="kartu kartu-klik" tabindex="0" role="button" aria-label="Lihat detail ' + esc(o.judulTeks || '') + '">' +
            '<div class="kartu-thumb tampil">' + isi + '</div>' +
            '<div class="kartu-judul mono" title="' + esc(o.judulTeks || '') + '">' + o.judul + '</div>' +
            (sub[0] ? '<div class="kartu-sub">' + sub[0] + '</div>' : '') +
            '<dialog class="modal detail">' +
                '<div class="modal-head detail-head"><h3 class="mono">' + o.judul + '</h3><span class="detail-tutup" role="button" tabindex="0" aria-label="Tutup">&times;</span></div>' +
                '<div class="modal-body">' + (asli ? asli.outerHTML + petunjuk : '') +
                    sub.map((s) => '<p class="detail-baris">' + s + '</p>').join('') +
                    (o.status ? '<div class="kartu-status">' + o.status + '</div>' : '') +
                '</div>' +
                (o.aksi ? '<div class="modal-foot aksi">' + o.aksi + '</div>' : '') +
            '</dialog></article>';
    }
    // Buka/tutup dialog detail kartu (satu pendengar untuk seluruh halaman)
    document.addEventListener('click', (e) => {
        const dlg = e.target.closest('dialog.detail');
        if (dlg) {
            if (e.target === dlg || e.target.closest('.detail-tutup') || e.target.closest('button')) dlg.close();   // tombol aksi: tutup, lalu pengendali halaman bekerja
            return;
        }
        const k = e.target.closest('.kartu-klik');
        if (k && !e.target.closest('a, button')) k.querySelector('dialog.detail').showModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const t = e.target;
        if (t.classList && t.classList.contains('detail-tutup')) { t.closest('dialog').close(); e.preventDefault(); }
        else if (t.classList && t.classList.contains('kartu-klik')) { t.querySelector('dialog.detail').showModal(); e.preventDefault(); }
    });
    // Pratinjau yang bisa diklik: membuka file bila ada, bila tidak tampil penanda "Belum ada file"
    function thumbFile(urlFile, namaFile, ada) {
        return ada
            ? '<a class="kartu-thumb" href="' + esc(urlFile) + '" target="_blank" rel="noopener" title="Buka file surat">' + thumb(urlFile, namaFile) + '</a>'
            : '<div class="kartu-thumb kosong">' + thumb('', '') + '</div>';
    }


    // ---------- Link Google Drive (pengganti unggah file) ----------
    // Ambil ID file dari tautan Drive (/file/d/ID/ atau ?id=ID)
    function driveId(link) {
        const m = String(link || '').match(/\/d\/([A-Za-z0-9_-]{10,})/) || String(link || '').match(/[?&]id=([A-Za-z0-9_-]{10,})/);
        return m ? m[1] : '';
    }
    // Pratinjau dari link Drive: gambar mini dari Drive, bila gagal tampil ikon dokumen
    function thumbLink(link) {
        const id = driveId(link);
        const ikon = '<span class="kartu-isi">' + IKON.file + '<small>Surat (Drive)</small></span>';
        if (!id) return ikon;
        return '<img src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&amp;sz=w600" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=this.dataset.ikon" data-ikon="' + esc(ikon) + '">';
    }
    // Pratinjau yang bisa diklik. Bila ada file/link: klik membuka (atau, jika `ganti` diisi, menawarkan Buka/Ganti).
    // o: {url (file lama), nama, link, ada, ganti (id surat, opsional), unggah (id surat, opsional)}
    function thumbSurat(o) {
        const url = o.link || o.url;
        if (!o.ada) {
            return o.unggah
                ? '<button type="button" class="kartu-thumb" data-unggah="' + o.unggah + '" title="Klik gambar di atas untuk menempel link Google Drive surat">' + thumb('', '') + '</button>'
                : '<div class="kartu-thumb kosong">' + thumb('', '') + '</div>';
        }
        const isi = o.link ? thumbLink(o.link) : thumb(o.url, o.nama);
        if (o.ganti) return '<button type="button" class="kartu-thumb" data-pilih="' + o.ganti + '" title="Klik untuk membuka atau mengganti file surat">' + isi + '</button>';
        return '<a class="kartu-thumb" href="' + esc(url) + '" target="_blank" rel="noopener" title="Buka file surat">' + isi + '</a>';
    }
    function dlgDinamis(html) {
        const d = document.createElement('dialog');
        d.className = 'modal'; d.innerHTML = html;
        document.body.appendChild(d);
        d.addEventListener('close', () => d.remove());
        d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
        d.showModal();
        return d;
    }
    // Popup pilihan untuk file yang sudah ada: Buka atau Ganti
    function pilihBukaGanti(url, onGanti) {
        const d = dlgDinamis('<div class="modal-head"><h3>File surat</h3></div><div class="modal-body"><p>Surat sudah memiliki file. Mau dibuka atau diganti?</p></div>' +
            '<div class="modal-foot aksi"><button type="button" class="btn" data-x="batal">Batal</button><button type="button" class="btn" data-x="ganti">Ganti</button><button type="button" class="btn primary" data-x="buka">Buka</button></div>');
        d.addEventListener('click', (e) => {
            const x = e.target.closest('button'); if (!x) return;
            if (x.dataset.x === 'buka') window.open(url, '_blank', 'noopener');
            d.close();
            if (x.dataset.x === 'ganti') onGanti();
        });
    }
    // Dialog tempel link Drive. Mengembalikan Promise<string|null>
    function mintaLink(judul, awal) {
        return new Promise((selesai) => {
            let hasil = null;
            const d = dlgDinamis('<form method="dialog"><div class="modal-head"><h3>' + esc(judul || 'Link Google Drive surat') + '</h3></div><div class="modal-body">' +
                '<div class="field full"><label for="dl_link">Link Google Drive</label><input type="url" id="dl_link" placeholder="https://drive.google.com/file/d/..." value="' + esc(awal || '') + '" required></div>' +
                '<p class="detail-petunjuk">Unggah surat ke Google Drive, klik kanan &rarr; Bagikan &rarr; ubah akses menjadi <b>"Siapa saja yang memiliki link"</b>, lalu salin dan tempel link di sini agar suratnya bisa tampil.</p></div>' +
                '<div class="modal-foot aksi"><button type="button" class="btn" data-x="batal">Batal</button><button type="submit" class="btn primary">Simpan</button></div></form>');
            const inp = d.querySelector('#dl_link'); inp.focus();
            d.querySelector('[data-x=batal]').addEventListener('click', () => d.close());
            d.querySelector('form').addEventListener('submit', (e) => {
                e.preventDefault(); const v = inp.value.trim();
                if (!driveId(v) || !/^https:\/\/(drive|docs)\.google\.com\//i.test(v)) { toast('Link harus dari Google Drive (https://drive.google.com/...).', true); return; }
                hasil = v; d.close();
            });
            d.addEventListener('close', () => selesai(hasil));
        });
    }

    // Validasi file unggahan di sisi peramban (server tetap memeriksa ulang). Mengembalikan pesan galat atau ''.
    const MAKS_FILE = 10 * 1024 * 1024;
    function cekFile(f) {
        if (!f) return '';
        if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return 'Format file harus PDF, JPG, atau PNG.';
        if (f.size > MAKS_FILE) return 'Ukuran file maksimal 10 MB.';
        return '';
    }


    // ---------- Kartu surat (dipakai halaman Data Surat dan "Surat terbaru" di dashboard) ----------
    // Keterangan (judul, nomor, dll.) di kiri supaya mudah dibaca; pratinjau kertas A4 utuh di kanan.
    // Kartu tidak punya tombol: klik kartu -> menu Buka / Ganti / Hapus. Hapus = menghapus seluruh kartu (surat).
    const urlSurat = (r) => r.link_drive || (+r.ada_file && r.file_nama ? 'api/arsip.php?aksi=file&id=' + r.id : '');

    function pratinjauA4(r) {
        const ikon = (teks) => '<span class="kartu-isi">' + IKON.file + '<small>' + teks + '</small></span>';
        if (r.link_drive) {
            const id = driveId(r.link_drive);
            return id ? '<img src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&amp;sz=w800" alt="" loading="lazy" referrerpolicy="no-referrer">' : ikon('Surat (Drive)');
        }
        if (+r.ada_file && r.file_nama) return /\.(jpe?g|png)$/i.test(r.file_nama) ? '<img src="' + esc(urlSurat(r)) + '" alt="" loading="lazy">' : ikon('PDF');
        return ikon('Belum ada file');
    }
    // Bila gambar pratinjau gagal dimuat (mis. akses Drive belum dibuka), ganti dengan ikon dokumen
    document.addEventListener('error', (e) => {
        const im = e.target;
        if (!im || im.tagName !== 'IMG' || !im.closest || !im.closest('.dk-thumb')) return;
        const s = document.createElement('span');
        s.className = 'kartu-isi';
        s.innerHTML = IKON.file + '<small>Pratinjau tidak tersedia</small>';
        im.replaceWith(s);
    }, true);

    function buatKartu(r, dgnHapus) {
        const judul = r.judul || r.perihal || r.nomor_surat;
        const desk = r.judul && r.perihal && r.perihal !== r.judul ? '<p class="dk-desk">' + esc(r.perihal) + '</p>' : '';
        const ada = !!+r.ada_file;
        const internal = r.kode_tujuan === 'A';
        return '<article class="dk-card" tabindex="0" role="button" data-id="' + esc(r.id) + '" title="Klik untuk memperbesar kartu" aria-label="' + esc('Perbesar kartu surat ' + judul) + '">' +
            '<div class="dk-info">' +
                '<div class="dk-top"><span class="dk-nomor mono">' + esc(r.nomor_surat) + '</span>' +
                    '<span class="badge ' + (internal ? 'ok' : '') + '">' + (internal ? 'Internal' : 'Eksternal') + '</span>' +
                '</div>' +
                '<h3 class="dk-judul">' + esc(judul) + '</h3>' + desk +
                '<dl class="dk-meta">' +
                    '<div><dt>Tanggal surat</dt><dd>' + esc(tglIndo(r.tanggal_surat)) + '</dd></div>' +
                    '<div><dt>Jenis surat</dt><dd>' + esc(r.jenis_nama || r.jenis_kode) + '</dd></div>' +
                    '<div><dt>Unit pembuat</dt><dd>' + esc(r.unit_nama || r.unit_kode) + '</dd></div>' +
                    '<div><dt>Link Drive</dt><dd><span class="badge ' + (ada ? 'ok' : 'warn') + '">' + (ada ? 'Tersedia' : 'Belum ada') + '</span></dd></div>' +
                '</dl>' + (dgnHapus ? '<button type="button" class="dk-hapus" data-hapus="' + esc(r.id) + '" title="Hapus seluruh kartu ini" aria-label="' + esc('Hapus kartu surat ' + judul) + '">' + IKON_HAPUS + ' Hapus</button>' : '') +
            '</div>' +
            '<div class="dk-thumb">' + pratinjauA4(r) + '</div>' +
        '</article>';
    }

    const IKON_HAPUS = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';
    const kartuSurat = (r) => buatKartu(r, false);          // dashboard: hanya dibuka
    const kartuSuratDgnHapus = (r) => buatKartu(r, true);   // Data Surat: ada tombol Hapus tersendiri

    // Pasang pendengar klik pada daftar kartu. opsi: { cari(id) -> baris data, selesai() -> muat ulang daftar }
    function pasangKartuSurat(wadah, opsi) {
        const cari = (el) => opsi.cari(el.dataset.id || el.dataset.hapus);
        const perbesar = (k) => { const r = cari(k); if (r) besarkanSurat(k, r, opsi); };
        wadah.addEventListener('click', (e) => {
            const h = e.target.closest('[data-hapus]');
            if (h) { e.stopPropagation(); const r = cari(h); if (r) hapusSurat(r, opsi.selesai); return; }
            const k = e.target.closest('.dk-card'); if (k) perbesar(k);
        });
        wadah.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('dk-card')) { e.preventDefault(); perbesar(e.target); }
        });
    }

    // Kartu diklik -> kartu membesar (pratinjau A4 besar + keterangan), lalu pilih Buka (atau Ganti link di Data Surat)
    function besarkanSurat(kartu, r, opsi) {
        const judul = r.judul || r.perihal || r.nomor_surat, url = urlSurat(r), ada = !!+r.ada_file;
        const desk = r.judul && r.perihal && r.perihal !== r.judul ? '<p class="dk-desk">' + esc(r.perihal) + '</p>' : '';
        const d = dlgDinamis('<div class="dk-besar-isi">' +
            '<button type="button" class="dk-tutup" data-x="batal" aria-label="Tutup">&times;</button>' +
            '<div class="dk-info"><p class="dk-nomor mono" style="margin:0">' + esc(r.nomor_surat) + '</p>' +
                '<h3 class="dk-judul">' + esc(judul) + '</h3>' + desk +
                '<dl class="dk-meta">' +
                    '<div><dt>Tanggal surat</dt><dd>' + esc(tglIndo(r.tanggal_surat)) + '</dd></div>' +
                    '<div><dt>Jenis surat</dt><dd>' + esc(r.jenis_nama || r.jenis_kode) + '</dd></div>' +
                    '<div><dt>Unit pembuat</dt><dd>' + esc(r.unit_nama || r.unit_kode) + '</dd></div>' +
                    '<div><dt>Tujuan</dt><dd>' + (r.kode_tujuan === 'A' ? 'Internal' : 'Eksternal') + '</dd></div>' +
                    '<div><dt>Link Drive</dt><dd><span class="badge ' + (ada ? 'ok' : 'warn') + '">' + (ada ? 'Tersedia' : 'Belum ada') + '</span></dd></div>' +
                '</dl>' +
                '<div class="dk-besar-aksi">' +
                    (opsi.hanyaBuka ? '' : '<button type="button" class="btn" data-x="ganti">Ganti link</button>') +
                    '<button type="button" class="btn primary" data-x="buka"' + (url ? '' : ' disabled title="Surat ini belum punya link Drive"') + '>Buka surat</button>' +
                '</div></div>' +
            '<div class="dk-thumb">' + pratinjauA4(r) + '</div></div>');
        d.classList.add('dk-besar');
        d.addEventListener('click', (e) => {
            const x = e.target.closest('button[data-x]');
            if (!x || x.disabled) return;
            d.close();
            if (x.dataset.x === 'buka') window.open(url, '_blank', 'noopener');
            else if (x.dataset.x === 'ganti') gantiSurat(r, opsi.selesai);
        });
    }

    // Ganti = tempel link Google Drive yang baru
    async function gantiSurat(r, selesai) {
        const link = await mintaLink('Ganti link Google Drive surat', r.link_drive);
        if (!link) return;
        const f = new FormData();
        f.append('aksi', 'unggah'); f.append('id', r.id); f.append('link', link);
        try { await api('api/arsip.php', f); toast('Link surat ' + r.nomor_surat + ' diganti'); if (selesai) selesai(); }
        catch (e) { toast(e.message, true); }
    }

    // Hapus = menghapus seluruh kartu (data surat), dengan konfirmasi dulu
    function hapusSurat(r, selesai) {
        const judul = r.judul || r.perihal || r.nomor_surat;
        const d = dlgDinamis('<div class="modal-head"><h3>Hapus seluruh kartu ini?</h3></div>' +
            '<div class="modal-body"><p style="margin:0">Apakah Anda yakin ingin menghapus <b>seluruh kartu</b> surat ini?</p>' +
            '<p class="mono" style="margin:.6rem 0 0">' + esc(r.nomor_surat) + '</p><p style="margin:0;font-weight:600">' + esc(judul) + '</p>' +
            '<p class="detail-petunjuk" style="text-align:left;margin-top:.6rem">Semua data surat ini ikut terhapus, nomornya tidak dipakai lagi, dan tidak bisa dikembalikan. File di Google Drive tidak ikut terhapus.</p></div>' +
            '<div class="modal-foot aksi"><button type="button" class="btn" data-x="batal">Tidak, batal</button>' +
            '<button type="button" class="btn danger" data-x="ya">Ya, hapus kartu</button></div>');
        d.addEventListener('click', async (e) => {
            const x = e.target.closest('button[data-x]');
            if (!x) return;
            if (x.dataset.x === 'batal') { d.close(); return; }
            x.disabled = true;
            try {
                await api('api/surat.php', { aksi: 'hapus', id: r.id });
                d.close();
                toast('Kartu surat ' + r.nomor_surat + ' dihapus');
                if (selesai) selesai();
            } catch (err) { d.close(); toast(err.message, true); }
        });
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

    window.App = { $, esc, tglIndo, hariIni, api, toast, BULAN, IKON, thumb, cekFile, kartuHtml, thumbFile, driveId, thumbLink, thumbSurat, pilihBukaGanti, mintaLink, kartuSurat, kartuSuratDgnHapus, pasangKartuSurat };
})();
