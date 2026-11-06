/* Surat Masuk: Admin input (diterima) -> Pimpinan disposisi ke staf (proses_staf) -> Staf selesaikan (selesai). */
(function () {
    'use strict';
    const { $, esc, tglIndo, api, toast, peran } = App;
    const URL_API = 'api/surat_masuk.php';
    const LABEL = { diterima: 'Diterima', proses_staf: 'Proses staf', selesai: 'Selesai' };
    const KELAS = { diterima: 'abu', proses_staf: 'bad', selesai: 'ok' };
    const BADGE = { diterima: 'warn', proses_staf: 'warn', selesai: 'ok' };
    let data = [], ubahId = null, mulaiMemuat = 0;

    const INFO = {
        admin: 'Klik <b>Input surat masuk</b>, lalu tekan <b>Disposisi</b> pada surat <span class="chip bad">diterima</span> untuk meneruskannya. Tandai selesai di menu <b>Disposisi</b>.',
        pimpinan: 'Surat <b>diterima</b> menunggu disposisi Anda. Tekan <b>Disposisi</b> untuk meneruskannya ke staf.',
        staf: 'Hanya surat yang didisposisikan kepada Anda yang tampil di sini. Selesaikan tugasnya di menu <b>Disposisi</b>.'
    };
    $('alurInfo').innerHTML = INFO[peran] || '';
    if (peran === 'admin') $('btnTambah').style.display = '';
    const status = () => document.querySelector('#segStatus input:checked').value;

    async function muat() {
        const my = ++mulaiMemuat;
        const q = new URLSearchParams({ aksi: 'daftar', status: status(), q: $('q').value.trim(), tahun: $('fTahun').value, bulan: $('fBulan').value });
        try {
            const d = await api(URL_API + '?' + q);
            if (my !== mulaiMemuat) return;
            data = d.data; gambar();
            const s = await api('api/statistik.php');
            $('sTerima').textContent = s.masuk.diterima; $('sProses').textContent = s.masuk.proses_staf; $('sSelesai').textContent = s.masuk.selesai;
        } catch (e) { toast(e.message, true); $('galeri').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>'; }
    }

    function aksi(r) {
        let h = r.ada_file ? '<a class="btn sm" href="' + esc(URL_API + '?aksi=file&id=' + r.id) + '" target="_blank" rel="noopener">Lihat</a>' : '';
        if (App.bisa('pimpinan') && r.status === 'diterima') h += '<a class="btn sm primary" href="disposisi.html?surat=' + r.id + '">Disposisi</a>';
        if (peran === 'admin' && r.status === 'diterima')
            h += '<button type="button" class="btn sm" data-a="ubah" data-id="' + r.id + '">Ubah</button><button type="button" class="btn sm danger" data-a="hapus" data-id="' + r.id + '">Hapus</button>';
        return h;
    }

    function gambar() {
        $('galeri').innerHTML = data.length ? data.map((r) => App.kartuHtml({
            kelas: KELAS[r.status], judulTeks: r.nomor_agenda, judul: esc(r.nomor_agenda),
            thumb: App.thumbFile(URL_API + '?aksi=file&id=' + r.id, r.ada_file ? 'x.' + r.file_tipe : '', r.ada_file),
            sub: [esc(r.perihal), 'Dari: ' + esc(r.pengirim),
                  esc(tglIndo(r.tanggal_terima)) + (r.sifat !== 'biasa' ? ' · ' + esc(r.sifat) : '') + (r.disposisi ? ' · Staf: ' + esc(r.disposisi.staf) : '')],
            status: '<span class="badge ' + BADGE[r.status] + '">' + LABEL[r.status] + '</span>',
            aksi: aksi(r),
        })).join('') : '<p class="galeri-kosong">Belum ada surat masuk pada filter ini.</p>';
        if (window.lucide) lucide.createIcons();
    }

    // ---------- Input / ubah (admin) ----------
    function buka(r) {
        ubahId = r ? r.id : null;
        $('mJudul').textContent = r ? 'Ubah surat masuk' : 'Input surat masuk';
        $('m_pengirim').value = r ? r.pengirim : ''; $('m_perihal').value = r ? r.perihal : '';
        $('m_asal').value = r ? r.nomor_surat_asal : ''; $('m_sifat').value = r ? r.sifat : 'biasa';
        $('m_tglSurat').value = r ? (r.tanggal_surat || '') : ''; $('m_tglTerima').value = r ? r.tanggal_terima : App.hariIni();
        $('m_file').value = ''; $('m_help').textContent = r ? 'Kosongkan bila file tidak diganti.' : '';
        $('dlgMasuk').showModal();
    }
    $('btnTambah').addEventListener('click', () => buka(null));
    $('mBatal').addEventListener('click', () => $('dlgMasuk').close());
    $('masukForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = $('m_file').files[0], g = App.cekFile(f);
        if (!$('m_pengirim').value.trim() || !$('m_perihal').value.trim()) return toast('Pengirim dan perihal wajib diisi.', true);
        if (g) return toast(g, true);
        const fd = new FormData();
        fd.append('aksi', ubahId ? 'ubah' : 'tambah'); if (ubahId) fd.append('id', ubahId);
        [['pengirim', 'm_pengirim'], ['perihal', 'm_perihal'], ['nomor_surat_asal', 'm_asal'], ['sifat', 'm_sifat'], ['tanggal_surat', 'm_tglSurat'], ['tanggal_terima', 'm_tglTerima']]
            .forEach(([k, id]) => fd.append(k, $(id).value));
        if (f) fd.append('file', f);
        $('mSimpan').disabled = true;
        try {
            const d = await api(URL_API, fd);
            $('dlgMasuk').close();
            toast(ubahId ? 'Surat masuk diperbarui.' : 'Tersimpan dengan nomor agenda ' + d.surat.nomor_agenda + '.');
            muat();
        } catch (e) { toast(e.message, true); }
        $('mSimpan').disabled = false;
    });

    $('galeri').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button[data-a]');
        if (!b) return;
        const r = data.find((x) => x.id === +b.dataset.id);
        if (!r) return;
        if (b.dataset.a === 'ubah') return buka(r);
        if (!confirm('Hapus surat masuk ' + r.nomor_agenda + '?')) return;
        try { await api(URL_API, { aksi: 'hapus', id: r.id }); toast('Surat masuk dihapus.'); } catch (e) { toast(e.message, true); }
        muat();
    });

    const th = new Date().getFullYear();
    for (let y = th; y >= th - 4; y--) $('fTahun').insertAdjacentHTML('beforeend', '<option value="' + y + '">' + y + '</option>');
    $('fBulan').innerHTML = '<option value="">Semua bulan</option>' + App.BULAN.map((n, i) => '<option value="' + (i + 1) + '">' + n + '</option>').join('');
    ['fTahun', 'fBulan'].forEach((id) => $(id).addEventListener('change', muat));
    $('segStatus').addEventListener('change', muat);
    let t; $('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(muat, 250); });
    muat();
})();
