(function () {
    'use strict';
    const { $, esc, tglIndo, api, toast } = App;
    const API = 'api/surat.php';
    const BATAS = 50;
    const FILTER = { q: 'dsQ', jenis: 'dsJenis', unit: 'dsUnit', tujuan: 'dsTujuan', tahun: 'dsTahun', urut: 'dsUrut' };
    let baris = [], total = 0, tunggu = 0;

    function barisHtml(r) {
        const judul = r.judul || r.perihal;
        const link = r.link_drive
            ? '<a class="btn sm" href="' + esc(r.link_drive) + '" target="_blank" rel="noopener">Buka</a>'
            : '<span class="badge warn">Belum ada</span>';
        return '<tr>' +
            '<td class="no-surat">' + esc(r.nomor_surat) + '</td>' +
            '<td><b>' + esc(judul) + '</b>' + (r.judul ? '<span class="sub">' + esc(r.perihal) + '</span>' : '') + '</td>' +
            '<td>' + esc(tglIndo(r.tanggal_surat)) + '<span class="sub">' + (r.kode_tujuan === 'A' ? 'Internal' : 'Eksternal') + '</span></td>' +
            '<td>' + esc(r.jenis_nama || r.jenis_kode) + '<span class="sub">' + esc(r.unit_nama || r.unit_kode) + '</span></td>' +
            '<td>' + link + '</td>' +
            '<td><div class="aksi"><a class="btn sm" href="upload_surat.html?ubah=' + r.id + '">Ubah</a>' +
            '<button type="button" class="btn sm danger" data-hapus="' + r.id + '">Hapus</button></div></td></tr>';
    }

    function gambar() {
        $('dsBody').innerHTML = baris.length ? baris.map(barisHtml).join('')
            : '<tr class="empty-row"><td colspan="6">' + (Object.values(FILTER).some((id) => $(id).value) ? 'Tidak ada surat yang cocok dengan filter.' : 'Belum ada surat yang diupload.') + '</td></tr>';
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
            $('dsBody').innerHTML = '<tr class="empty-row"><td colspan="6">' + esc(e.message) + '</td></tr>';
        }
    }

    $('dsCari').addEventListener('submit', (ev) => { ev.preventDefault(); muat(false); });
    let tm;
    $('dsQ').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => muat(false), 300); });
    Object.values(FILTER).filter((id) => id !== 'dsQ').forEach((id) => $(id).addEventListener('change', () => muat(false)));
    $('dsReset').addEventListener('click', () => { Object.values(FILTER).forEach((id) => { $(id).value = ''; }); muat(false); });
    $('dsLagi').addEventListener('click', () => muat(true));

    $('dsBody').addEventListener('click', async (ev) => {
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
