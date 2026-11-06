/* Penomoran (khusus Admin): antrean surat yang sudah di-ACC pimpinan -> Preview Draft -> Beri Nomor & Terbitkan. */
(function () {
    'use strict';
    const { $, esc, tglIndo, api, toast } = App;
    const URL_API = 'api/surat_keluar.php';
    let antrean = [], aktif = null, tunggu = 0;

    const urlFile = (r) => URL_API + '?aksi=file&id=' + r.id;

    // ---------- Daftar antrean ----------
    async function muat() {
        try {
            const q = encodeURIComponent($('q').value.trim());
            const [a, b, n] = await Promise.all([
                api(URL_API + '?aksi=daftar&status=menunggu_nomor&q=' + q),
                api(URL_API + '?aksi=daftar&status=menunggu_acc'),
                api(URL_API + '?aksi=generate_nomor'),
            ]);
            antrean = a.data;
            $('sAntrean').textContent = antrean.length;
            $('sAcc').textContent = b.data.length;
            $('sNomor').textContent = n.nomor;
            $('jumlah').textContent = antrean.length + ' surat menunggu nomor';
            $('antreanBody').innerHTML = antrean.length ? antrean.map((r) =>
                '<tr><td><b>' + esc(r.perihal) + '</b><span class="sub">' + (r.ada_file ? esc(r.file_nama || 'file draf') : 'Belum ada file') + '</span></td>' +
                '<td>' + esc(r.tujuan) + '</td><td>' + esc(tglIndo(r.tanggal_surat)) + '</td>' +
                '<td>' + esc(r.pembuat) + '</td>' +
                '<td>' + esc(r.acc_oleh || '-') + '<span class="sub">' + esc(tglIndo(r.tanggal_acc)) + '</span></td>' +
                '<td><div class="aksi"><button type="button" class="btn sm" data-a="preview" data-id="' + r.id + '">Preview Draft</button>' +
                '<button type="button" class="btn sm primary" data-a="nomori" data-id="' + r.id + '">Beri Nomor &amp; Terbitkan</button></div></td></tr>'
            ).join('') : '<tr><td colspan="6" class="galeri-kosong">Antrean kosong. Buat draft di <a href="surat_keluar.html">Surat Keluar</a> lalu tekan ACC, maka surat muncul di sini.</td></tr>';
        } catch (e) { toast(e.message, true); $('antreanBody').innerHTML = '<tr><td colspan="6" class="galeri-kosong">' + esc(e.message) + '</td></tr>'; }
    }

    // ---------- Modal Preview Draft ----------
    function preview(r) {
        aktif = r;
        $('pvJudul').textContent = 'Preview draf';
        $('pvInfo').innerHTML = '<b>' + esc(r.perihal) + '</b><br>Kepada: ' + esc(r.tujuan) + ' · Dibuat oleh ' + esc(r.pembuat);
        $('pvIsi').innerHTML = !r.ada_file ? '<p class="galeri-kosong">Draf ini belum punya file.</p>'
            : r.file_tipe === 'pdf' ? '<iframe src="' + esc(urlFile(r)) + '" title="Draf surat"></iframe>'
            : '<img src="' + esc(urlFile(r)) + '" alt="Draf surat">';
        $('pvUnduh').href = urlFile(r);
        $('pvUnduh').style.display = r.ada_file ? '' : 'none';
        $('dlgPreview').showModal();
    }
    function tutupPreview() { $('dlgPreview').close(); $('pvIsi').innerHTML = ''; }

    // ---------- Form Penomoran ----------
    async function muatNomorOtomatis() {
        const my = ++tunggu;
        $('nfNomor').textContent = '...';
        try {
            const d = await api(URL_API + '?aksi=generate_nomor');
            if (my === tunggu) $('nfNomor').textContent = d.nomor;
        } catch (e) { if (my === tunggu) $('nfNomor').textContent = 'Gagal memuat nomor'; }
    }
    const mode = () => document.querySelector('#nfMode input:checked').value;
    function setMode() {
        const man = mode() === 'manual';
        $('nfOto').style.display = man ? 'none' : '';
        $('nfMan').style.display = man ? '' : 'none';
        if (man) $('nfManual').focus(); else muatNomorOtomatis();
    }
    function bukaNomor(r) {
        aktif = r;
        $('nfInfo').innerHTML = '<b>' + esc(r.perihal) + '</b><br>Kepada: ' + esc(r.tujuan);
        document.querySelector('#nfMode input[value=otomatis]').checked = true;
        $('nfManual').value = '';
        setMode();
        if ($('dlgPreview').open) tutupPreview();
        $('dlgNomor').showModal();
    }

    async function simpan(ev) {
        ev.preventDefault();
        if (!aktif) return;
        const man = mode() === 'manual', nomor = $('nfManual').value.trim();
        if (man && !nomor) { toast('Isi nomor manual, atau pilih nomor otomatis.', true); $('nfManual').focus(); return; }
        $('nfSimpan').disabled = true;
        try {
            const d = await api(URL_API, { aksi: 'terbitkan', id: aktif.id, mode: mode(), nomor_manual: nomor });
            $('dlgNomor').close();
            toast('Terbit dengan nomor ' + d.surat.nomor_surat + '. Surat kini ada di menu Surat Keluar.');
            aktif = null;
        } catch (e) { toast(e.message, true); }
        $('nfSimpan').disabled = false;
        muat();
    }

    // ---------- Pasang event ----------
    $('antreanBody').addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-a]');
        if (!b) return;
        const r = antrean.find((x) => x.id === +b.dataset.id);
        if (!r) return;
        if (b.dataset.a === 'preview') preview(r); else bukaNomor(r);
    });
    $('pvTutup').addEventListener('click', tutupPreview);
    $('dlgPreview').addEventListener('close', () => { $('pvIsi').innerHTML = ''; });
    $('pvNomori').addEventListener('click', () => aktif && bukaNomor(aktif));
    $('nfMode').addEventListener('change', setMode);
    $('nfBatal').addEventListener('click', () => $('dlgNomor').close());
    $('nomorForm').addEventListener('submit', simpan);
    let t; $('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(muat, 250); });

    // ---------- Surat baru (langsung terbit) ----------
    const bMode = () => document.querySelector('#bMode input:checked').value;
    async function muatNomorBaru() {
        try { $('bNomor').textContent = (await api(URL_API + '?aksi=generate_nomor')).nomor; } catch (e) { $('bNomor').textContent = '-'; }
    }
    function setModeBaru() {
        const man = bMode() === 'manual';
        $('bOto').style.display = man ? 'none' : ''; $('bManual').style.display = man ? '' : 'none';
        if (man) $('bManual').focus();
    }
    $('bMode').addEventListener('change', setModeBaru);
    $('b_tanggal').value = App.hariIni();
    $('baruForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = $('b_file').files[0], g = App.cekFile(f);
        if (!$('b_tujuan').value.trim() || !$('b_perihal').value.trim()) return toast('Tujuan dan perihal wajib diisi.', true);
        if (bMode() === 'manual' && !$('bManual').value.trim()) return toast('Isi nomor manual, atau pilih nomor otomatis.', true);
        if (g) return toast(g, true);
        const fd = new FormData();
        fd.append('aksi', 'surat_baru'); fd.append('perihal', $('b_perihal').value); fd.append('tujuan', $('b_tujuan').value);
        fd.append('tanggal_surat', $('b_tanggal').value); fd.append('mode', bMode()); fd.append('nomor_manual', $('bManual').value);
        if (f) fd.append('file', f);
        $('bSimpan').disabled = true;
        try {
            const d = await api(URL_API, fd);
            toast('Terbit dengan nomor ' + d.surat.nomor_surat + '. Surat ada di menu Surat Keluar.');
            $('baruForm').reset(); $('b_tanggal').value = App.hariIni(); setModeBaru();
        } catch (e) { toast(e.message, true); }
        $('bSimpan').disabled = false;
        muatNomorBaru(); muat();
    });
    muatNomorBaru();

    muat();
})();
