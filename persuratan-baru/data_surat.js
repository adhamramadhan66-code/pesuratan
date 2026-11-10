(function () {
    'use strict';
    const { $, esc, tglIndo, api, toast } = App;
    const API = 'api/surat.php';
    const BATAS = 50;
    const FILTER = { q: 'dsQ', jenis: 'dsJenis', unit: 'dsUnit', tujuan: 'dsTujuan', tahun: 'dsTahun', urut: 'dsUrut' };
    let baris = [], total = 0, tunggu = 0;

    function gambar() {
        $('dsList').innerHTML = baris.length ? baris.map(App.kartuSuratDgnHapus).join('')
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

    App.pasangKartuSurat($('dsList'), { cari: (id) => baris.find((x) => String(x.id) === id), selesai: () => muat(false) });

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
