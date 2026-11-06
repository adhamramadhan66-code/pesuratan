/* Surat Keluar: Staf membuat draf -> Pimpinan ACC -> (Penomoran oleh Admin) -> Terbit. Tampil sebagai kotak-kotak. */
(function () {
    'use strict';
    const { $, esc, tglIndo, api, toast, peran, user } = App;
    const URL_API = 'api/surat_keluar.php';
    const LABEL = { menunggu_acc: 'Menunggu ACC', menunggu_nomor: 'Menunggu nomor', terbit: 'Terbit' };
    const KELAS = { menunggu_acc: 'bad', menunggu_nomor: 'abu', terbit: 'ok' };
    const BADGE = { menunggu_acc: 'warn', menunggu_nomor: 'warn', terbit: 'ok' };
    let data = [], ubahId = null, mulaiMemuat = 0;

    const INFO = {
        staf: 'Klik <b>Buat draft</b> untuk mengirim draf ke pimpinan. Draf bisa diubah/dihapus selama <span class="chip bad">menunggu ACC</span>.',
        pimpinan: 'Periksa draf (klik kotaknya untuk membuka file), lalu tekan <b>ACC</b>. Draf yang di-ACC otomatis masuk antrean <b>Penomoran</b>.',
        admin: 'Draf yang sudah di-ACC pimpinan ada di menu <b>Penomoran</b>, tempat Anda memberi nomor dan menerbitkannya. Surat yang <span class="chip ok">terbit</span> tampil di sini.'
    };
    $('alurInfo').innerHTML = INFO[peran] || '';
    if (peran === 'staf') $('btnDraft').style.display = '';

    const status = () => document.querySelector('#segStatus input:checked').value;

    async function muat() {
        const my = ++mulaiMemuat;
        const q = new URLSearchParams({ aksi: 'daftar', status: status(), q: $('q').value.trim(), tahun: $('fTahun').value, bulan: $('fBulan').value });
        try {
            const d = await api(URL_API + '?' + q);
            if (my !== mulaiMemuat) return;
            data = d.data;
            gambar();
            hitung();
        } catch (e) { toast(e.message, true); $('galeri').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>'; }
    }
    async function hitung() {
        try {
            const s = await api('api/statistik.php');
            $('sAcc').textContent = s.keluar.menunggu_acc; $('sNomor').textContent = s.keluar.menunggu_nomor; $('sTerbit').textContent = s.keluar.terbit;
        } catch (e) {}
    }

    function aksi(r) {
        const u = URL_API + '?aksi=file&id=' + r.id;
        let h = r.ada_file ? '<a class="btn sm" href="' + esc(u) + '" target="_blank" rel="noopener">Lihat</a>' : '';
        if (peran === 'pimpinan' && r.status === 'menunggu_acc') h += '<button type="button" class="btn sm primary" data-a="acc" data-id="' + r.id + '">ACC</button>';
        if (peran === 'staf' && r.status === 'menunggu_acc' && r.pembuat_id === user.id)
            h += '<button type="button" class="btn sm" data-a="ubah" data-id="' + r.id + '">Ubah</button><button type="button" class="btn sm danger" data-a="hapus" data-id="' + r.id + '">Hapus</button>';
        if (peran === 'admin' && r.status === 'menunggu_nomor') h += '<a class="btn sm primary" href="penomoran.html">Ke Penomoran</a>';
        return h;
    }

    function gambar() {
        $('galeri').innerHTML = data.length ? data.map((r) => App.kartuHtml({
            kelas: KELAS[r.status],
            judulTeks: r.nomor_surat || '', judul: r.nomor_surat ? esc(r.nomor_surat) : '<span class="muted">Belum bernomor</span>',
            thumb: App.thumbFile(URL_API + '?aksi=file&id=' + r.id, r.ada_file ? 'x.' + r.file_tipe : '', r.ada_file),
            sub: [esc(r.perihal), 'Kepada: ' + esc(r.tujuan), esc(tglIndo(r.tanggal_surat)) + ' · ' + esc(r.pembuat) + (r.acc_oleh ? ' · ACC: ' + esc(r.acc_oleh) : '')],
            status: '<span class="badge ' + BADGE[r.status] + '">' + LABEL[r.status] + '</span>',
            aksi: aksi(r),
        })).join('') : '<p class="galeri-kosong">Belum ada surat keluar pada filter ini.</p>';
        if (window.lucide) lucide.createIcons();
    }

    // ---------- Draf (staf) ----------
    function bukaDraft(r) {
        ubahId = r ? r.id : null;
        $('drJudul').textContent = r ? 'Ubah draft surat' : 'Buat draft surat';
        $('drSimpan').textContent = r ? 'Simpan perubahan' : 'Kirim draft';
        $('d_perihal').value = r ? r.perihal : ''; $('d_tujuan').value = r ? r.tujuan : '';
        $('d_tanggal').value = r ? r.tanggal_surat : App.hariIni(); $('d_file').value = '';
        $('d_req').style.display = r ? 'none' : '';
        $('d_help').textContent = r ? 'Kosongkan bila file draf tidak diganti.' : '';
        $('dlgDraft').showModal();
    }
    $('btnDraft').addEventListener('click', () => bukaDraft(null));
    $('drBatal').addEventListener('click', () => $('dlgDraft').close());
    $('draftForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = $('d_file').files[0], g = App.cekFile(f);
        if (!$('d_perihal').value.trim() || !$('d_tujuan').value.trim()) return toast('Perihal dan tujuan wajib diisi.', true);
        if (g) return toast(g, true);
        if (!f && !ubahId) return toast('Unggah file draf surat.', true);
        const fd = new FormData();
        fd.append('aksi', ubahId ? 'ubah' : 'buat_draft'); if (ubahId) fd.append('id', ubahId);
        fd.append('perihal', $('d_perihal').value); fd.append('tujuan', $('d_tujuan').value); fd.append('tanggal_surat', $('d_tanggal').value);
        if (f) fd.append('file', f);
        $('drSimpan').disabled = true;
        try {
            await api(URL_API, fd);
            $('dlgDraft').close();
            toast(ubahId ? 'Draft diperbarui.' : 'Draft terkirim ke pimpinan untuk di-ACC.');
            muat();
        } catch (e) { toast(e.message, true); }
        $('drSimpan').disabled = false;
    });

    // ---------- ACC / ubah / hapus ----------
    $('galeri').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button[data-a]');
        if (!b) return;
        const r = data.find((x) => x.id === +b.dataset.id);
        if (!r) return;
        try {
            if (b.dataset.a === 'ubah') return bukaDraft(r);
            if (b.dataset.a === 'hapus') {
                if (!confirm('Hapus draft "' + r.perihal + '"?')) return;
                await api(URL_API, { aksi: 'hapus', id: r.id });
                toast('Draft dihapus.');
            } else if (b.dataset.a === 'acc') {
                if (!confirm('ACC draf "' + r.perihal + '"? Surat akan masuk antrean Penomoran.')) return;
                await api(URL_API, { aksi: 'acc', id: r.id });
                toast('Draf di-ACC dan masuk antrean Penomoran.');
            }
            muat();
        } catch (e) { toast(e.message, true); muat(); }
    });

    // ---------- Filter ----------
    const th = new Date().getFullYear();
    for (let y = th; y >= th - 4; y--) $('fTahun').insertAdjacentHTML('beforeend', '<option value="' + y + '">' + y + '</option>');
    $('fBulan').innerHTML = '<option value="">Semua bulan</option>' + App.BULAN.map((n, i) => '<option value="' + (i + 1) + '">' + n + '</option>').join('');
    ['fTahun', 'fBulan'].forEach((id) => $(id).addEventListener('change', muat));
    $('segStatus').addEventListener('change', muat);
    let t; $('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(muat, 250); });

    muat();
})();
