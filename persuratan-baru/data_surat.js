(function () {
    'use strict';
    const { $, esc, tglIndo, api, toast } = App;
    const API = 'api/surat.php';
    const BATAS = 50;
    const FILTER = { q: 'dsQ', jenis: 'dsJenis', unit: 'dsUnit', tujuan: 'dsTujuan', tahun: 'dsTahun', urut: 'dsUrut' };
    let baris = [], total = 0, tunggu = 0;

    function kartuSurat(r) {
        const judul = r.judul || r.perihal;
        const desk = r.judul && r.perihal && r.perihal !== r.judul ? '<p class="dk-desk">' + esc(r.perihal) + '</p>' : '';
        const ada = !!+r.ada_file;
        const thumb = App.thumbSurat({ ada: r.ada_file, link: r.link_drive, url: 'api/arsip.php?aksi=file&id=' + r.id, nama: r.file_nama });
        return '<article class="dk-card">' +
            '<div class="dk-info">' +
                '<div class="dk-top"><span class="dk-nomor mono">' + esc(r.nomor_surat) + '</span>' +
                    '<span class="badge ' + (r.kode_tujuan === 'A' ? 'ok' : '') + '">' + (r.kode_tujuan === 'A' ? 'Internal' : 'Eksternal') + '</span></div>' +
                '<h3 class="dk-judul">' + esc(judul) + '</h3>' + desk +
                '<dl class="dk-meta">' +
                    '<div><dt>Tanggal surat</dt><dd>' + esc(tglIndo(r.tanggal_surat)) + '</dd></div>' +
                    '<div><dt>Jenis surat</dt><dd>' + esc(r.jenis_nama || r.jenis_kode) + '</dd></div>' +
                    '<div><dt>Unit pembuat</dt><dd>' + esc(r.unit_nama || r.unit_kode) + '</dd></div>' +
                    '<div><dt>Link Drive</dt><dd><span class="badge ' + (ada ? 'ok' : 'warn') + '">' + (ada ? 'Tersedia' : 'Belum ada') + '</span></dd></div>' +
                '</dl>' +
                '<div class="dk-aksi">' +
                    (r.link_drive ? '<a class="btn sm primary" href="' + esc(r.link_drive) + '" target="_blank" rel="noopener">Buka surat</a>' : '') +
                    '<a class="btn sm" href="upload_surat.html?ubah=' + r.id + '">Ubah</a>' +
                    '<button type="button" class="btn sm danger" data-hapus="' + r.id + '">Hapus</button>' +
                '</div>' +
            '</div>' +
            '<div class="dk-thumb">' + thumb + '</div>' +
        '</article>';
    }

    function gambar() {
        $('dsList').innerHTML = baris.length ? baris.map(kartuSurat).join('')
            : '<p class="galeri-kosong">' + (Object.values(FILTER).some((id) => $(id).value) ? 'Tidak ada surat yang cocok dengan filter.' : 'Belum ada surat yang diupload.') + '</p>';
        $('infoJumlah').textContent = total ? 'Menampilkan ' + baris.length + ' dari ' + total + ' surat' : 'Belum ada surat';
        $('dsLagi').hidden = baris.length >= total;
    }

    async function muat(tambah) {
        const my = ++tunggu;
        const p = new URLSearchParams({ aksi: 'daftar', limit: BATAS, offset: tambah ? baris.length : 0 });
        Object.entries(FILTER).forEach(([k, id]) => { const v = $(id).value.trim(); if (v) p.set(k, v); });
        try {
            const d = await api(API + '?' + p);
            if (my !== tunggu) return;
            baris = tambah ? baris.concat(d.surat) : d.surat;
            total = d.total;
            gambar();
        } catch (e) {
            if (my !== tunggu) return;
            toast(e.message, true);
            $('dsList').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>';
        }
    }

    $('dsCari').addEventListener('submit', (ev) => { ev.preventDefault(); muat(false); });
    let tm;
    $('dsQ').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => muat(false), 300); });
    Object.values(FILTER).filter((id) => id !== 'dsQ').forEach((id) => $(id).addEventListener('change', () => muat(false)));
    $('dsReset').addEventListener('click', () => { Object.values(FILTER).forEach((id) => { $(id).value = ''; }); muat(false); });
    $('dsLagi').addEventListener('click', () => muat(true));

    $('dsList').addEventListener('click', async (ev) => {
        const b = ev.target.closest('[data-hapus]');
        if (!b) return;
        const r = baris.find((x) => String(x.id) === b.dataset.hapus);
        if (!r || !confirm('Hapus surat ' + r.nomor_surat + '?\n\n' + (r.judul || r.perihal) + '\n\nNomor ini tidak akan dipakai lagi.')) return;
        b.disabled = true;
        try {
            await api(API, { aksi: 'hapus', id: r.id });
            toast('Surat ' + r.nomor_surat + ' dihapus');
            muat(false);
        } catch (e) { toast(e.message, true); b.disabled = false; }
    });

    (async function mulai() {
        try {
            const o = await api(API + '?aksi=opsi');
            $('dsJenis').insertAdjacentHTML('beforeend', o.jenis.map((x) => '<option value="' + esc(x.kode) + '">' + esc(x.nama) + '</option>').join(''));
            $('dsUnit').insertAdjacentHTML('beforeend', o.unit.map((x) => '<option value="' + esc(x.kode) + '">' + esc(x.nama) + '</option>').join(''));
            $('dsTahun').insertAdjacentHTML('beforeend', o.tahun.map((t) => '<option value="' + t + '">' + t + '</option>').join(''));
        } catch (e) { /* galat ditampilkan oleh muat() */ }
        muat(false);
    })();
})();
