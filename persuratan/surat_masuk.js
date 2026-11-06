(function () {
    'use strict';
    const { $, esc, tglIndo, hariIni, api, toast, BULAN } = App;
    const API = 'api/surat_masuk.php';
    const MAKS = 10 * 1024 * 1024;
    const NAMA_STATUS = { diterima: 'Diterima', didisposisikan: 'Didisposisikan', ditindaklanjuti: 'Ditindaklanjuti' };
    const NAMA_SIFAT = { biasa: 'Biasa', penting: 'Penting', segera: 'Segera', rahasia: 'Rahasia' };

    let baris = [], arsip = '', editId = null, aktif = null;

    // ---------- Daftar ----------
    async function muat() {
        const p = new URLSearchParams({ aksi: 'daftar', arsip, status: $('fStatus').value, jenis: $('fJenis').value, q: $('q').value.trim(), tahun: $('fTahun').value, bulan: $('fBulan').value });
        try {
            const d = await api(API + '?' + p);
            baris = d.surat_masuk;
            $('sTotal').textContent = d.total; $('sTindak').textContent = d.ditindaklanjuti; $('sBelum').textContent = d.total - d.diarsipkan;
            $('sPersen').textContent = d.total ? Math.round((d.diarsipkan / d.total) * 100) + '% sudah diarsipkan' : 'Belum ada surat masuk';
            $('sBar').style.width = (d.total ? (d.diarsipkan / d.total) * 100 : 0) + '%';
            const sel = $('fTahun'), cur = sel.value;
            if (sel.options.length - 1 !== d.daftar_tahun.length) {
                sel.innerHTML = '<option value="">Semua tahun</option>' + d.daftar_tahun.map((t) => '<option value="' + t + '">' + t + '</option>').join('');
                sel.value = cur;
            }
            render();
        } catch (e) { $('galeri').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>'; }
    }

    function render() {
        if (!baris.length) { $('galeri').innerHTML = '<p class="galeri-kosong">Belum ada surat masuk. Surat internal muncul di sini otomatis setelah di-ACC di menu Disposisi.</p>'; return; }
        $('galeri').innerHTML = baris.map((r) => {
            const sudah = r.status_arsip === 'diarsipkan';
            const dsp = r.disposisi_id
                ? '<span class="badge ' + (r.status_disposisi === 'disetujui' ? 'ok' : 'warn') + '">Disposisi ' + (r.status_disposisi === 'disetujui' ? 'disetujui' : 'belum disetujui') + '</span>'
                : '';
            const aksi = ['<button class="btn sm" data-ubah="' + r.id + '">Ubah</button>'];
            if (r.status !== 'ditindaklanjuti') aksi.push('<button class="btn sm" data-tindak="' + r.id + '">Tandai ditindaklanjuti</button>');
            aksi.push(sudah ? '<button class="btn sm" data-arsip="' + r.id + '">Ubah arsip</button><button class="btn sm danger" data-batal="' + r.id + '">Batalkan arsip</button>'
                            : '<button class="btn sm primary" data-arsip="' + r.id + '">Arsipkan</button>');
            if (!r.disposisi_id) aksi.push('<a class="btn sm" href="disposisi.html?unggah=m:' + r.id + '">Unggah di Disposisi</a>', '<button class="btn sm danger" data-hapus="' + r.id + '">Hapus</button>');
            return App.kartuHtml({
                kelas: sudah ? 'ok' : 'bad', judulTeks: r.nomor_agenda, judul: esc(r.nomor_agenda),
                thumb: App.thumbFile(API + '?aksi=file&id=' + r.id, r.file_nama, r.ada_file),
                sub: [esc(r.perihal), esc(r.pengirim) + ' · ' + (r.jenis_pengirim === 'internal' ? 'Internal' : 'Eksternal') + ' · ' + esc(NAMA_SIFAT[r.sifat] || r.sifat)],
                status: '<span class="badge st-' + esc(r.status) + '">' + esc(NAMA_STATUS[r.status] || r.status) + '</span>' + dsp +
                    '<span class="badge ' + (sudah ? 'ok' : 'warn') + '">' + (sudah ? 'Diarsipkan' : 'Belum diarsipkan') + '</span>',
                aksi: aksi.join(''),
            });
        }).join('');
    }

    document.querySelectorAll('#segArsip input').forEach((r) => r.addEventListener('change', () => { arsip = r.value; muat(); }));
    let tm; $('q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(muat, 300); });
    ['fStatus', 'fJenis', 'fTahun', 'fBulan'].forEach((id) => $(id).addEventListener('change', muat));

    // ---------- Form catat / ubah ----------
    const dlg = $('dlgForm');
    const jenisDipilih = () => (document.querySelector('input[name="m_jenis"]:checked') || {}).value || 'eksternal';
    function isiForm(r) {
        r = r || {};
        $('m_terima').value = r.tanggal_terima || hariIni(); $('m_tgl').value = r.tanggal_surat || ''; $('m_asal').value = r.nomor_surat_asal || '';
        document.querySelectorAll('input[name="m_jenis"]').forEach((c) => { c.checked = c.value === (r.jenis_pengirim || 'eksternal'); });
        $('m_pengirim').value = r.pengirim || ''; $('m_perihal').value = r.perihal || ''; $('m_tujuan').value = r.tujuan || '';
        $('m_sifat').value = r.sifat || 'biasa'; $('m_status').value = r.status || 'diterima'; $('m_file').value = ''; $('m_hapusFile').checked = false;
        $('boxStatus').style.display = r.id ? '' : 'none';
        $('fileNowM').style.display = r.ada_file ? '' : 'none';
        if (r.ada_file) { $('fileNowNamaM').textContent = r.file_nama; $('fileNowLihatM').href = API + '?aksi=file&id=' + r.id; }
    }
    $('dlgBatal').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

    function cekFile(f) {
        if (!f) return true;
        if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) { toast('Format file harus PDF, JPG, atau PNG.', true); return false; }
        if (f.size > MAKS) { toast('Ukuran file maksimal 10 MB.', true); return false; }
        return true;
    }

    $('smForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const salah = !$('m_terima').value ? 'Isi tanggal terima.' : !$('m_pengirim').value.trim() ? 'Isi pengirim.' : !$('m_perihal').value.trim() ? 'Isi perihal.' : '';
        if (salah) { toast(salah, true); return; }
        const file = $('m_file').files[0]; if (!cekFile(file)) return;
        const fd = new FormData();
        fd.append('aksi', editId ? 'ubah' : 'tambah'); if (editId) fd.append('id', editId);
        [['tanggal_terima', 'm_terima'], ['tanggal_surat', 'm_tgl'], ['nomor_surat_asal', 'm_asal'], ['pengirim', 'm_pengirim'], ['perihal', 'm_perihal'],
         ['tujuan', 'm_tujuan'], ['sifat', 'm_sifat'], ['status', 'm_status']].forEach(([k, id]) => fd.append(k, $(id).value));
        fd.append('jenis_pengirim', jenisDipilih());
        if ($('m_hapusFile').checked) fd.append('hapus_file', '1');
        if (file) fd.append('file', file);
        const btn = $('dlgSimpan'); btn.disabled = true;
        try {
            const d = await api(API, fd); dlg.close();
            toast(editId ? 'Surat masuk ' + d.nomor_agenda + ' diperbarui' : 'Surat masuk dicatat dengan nomor agenda ' + d.nomor_agenda);
            muat();
        } catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });

    // ---------- Dialog arsip ----------
    const dlgA = $('dlgArsip');
    function bukaArsip(r) {
        aktif = r; $('arNomor').textContent = r.nomor_agenda; $('arPerihal').textContent = r.perihal;
        $('arJudul').textContent = r.status_arsip === 'diarsipkan' ? 'Ubah data arsip' : 'Arsipkan surat masuk';
        $('a_tgl').value = r.tanggal_arsip || hariIni(); $('a_lokasi').value = r.lokasi_arsip || ''; $('a_ket').value = r.keterangan_arsip || '';
        $('a_file').value = ''; $('a_hapusFile').checked = false;
        $('fileNowA').style.display = r.ada_file ? '' : 'none';
        if (r.ada_file) { $('fileNowNamaA').textContent = r.file_nama; $('fileNowLihatA').href = API + '?aksi=file&id=' + r.id; }
        dlgA.showModal(); dlgA.scrollTop = 0;
    }
    $('arBatal').addEventListener('click', () => dlgA.close());
    dlgA.addEventListener('click', (e) => { if (e.target === dlgA) dlgA.close(); });
    $('arsipForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const file = $('a_file').files[0]; if (!cekFile(file)) return;
        const adaFile = aktif.ada_file && !$('a_hapusFile').checked;
        if (!$('a_lokasi').value.trim() && !file && !adaFile) { toast('Isi lokasi arsip fisik atau unggah file scan (minimal salah satu).', true); $('a_lokasi').focus(); return; }
        const fd = new FormData();
        fd.append('aksi', 'arsip_simpan'); fd.append('id', aktif.id); fd.append('tanggal_arsip', $('a_tgl').value);
        fd.append('lokasi_arsip', $('a_lokasi').value); fd.append('keterangan_arsip', $('a_ket').value);
        if ($('a_hapusFile').checked) fd.append('hapus_file', '1'); if (file) fd.append('file', file);
        const btn = $('arSimpan'); btn.disabled = true;
        try { await api(API, fd); dlgA.close(); toast('Surat masuk ' + aktif.nomor_agenda + ' diarsipkan'); muat(); }
        catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });

    // ---------- Aksi pada tabel ----------
    const kirim = (o) => { const fd = new FormData(); Object.keys(o).forEach((k) => fd.append(k, o[k])); return api(API, fd); };
    $('galeri').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        const id = +(b.dataset.ubah || b.dataset.tindak || b.dataset.arsip || b.dataset.batal || b.dataset.hapus);
        const r = baris.find((x) => +x.id === id); if (!r) return;
        try {
            if (b.dataset.ubah) { editId = id; $('dlgJudul').textContent = 'Ubah surat masuk ' + r.nomor_agenda; isiForm(r); dlg.showModal(); dlg.scrollTop = 0; }
            else if (b.dataset.tindak) { await kirim({ aksi: 'status', id, status: 'ditindaklanjuti' }); toast(r.nomor_agenda + ' ditandai ditindaklanjuti'); muat(); }
            else if (b.dataset.arsip) bukaArsip(r);
            else if (b.dataset.batal) {
                if (!confirm('Batalkan pengarsipan surat masuk ' + r.nomor_agenda + '? Lokasi dan tanggal arsip dihapus; file scan tetap disimpan.')) return;
                await kirim({ aksi: 'arsip_batal', id }); toast('Pengarsipan dibatalkan'); muat();
            } else if (b.dataset.hapus) {
                if (!confirm('Hapus surat masuk ' + r.nomor_agenda + '? File scan-nya ikut terhapus.')) return;
                await kirim({ aksi: 'hapus', id }); toast('Surat masuk dihapus'); muat();
            }
        } catch (e) { toast(e.message, true); }
    });

    // ---------- Mulai ----------
    $('fBulan').innerHTML = '<option value="">Semua bulan</option>' + BULAN.map((b, i) => '<option value="' + (i + 1) + '">' + b + '</option>').join('');
    const q0 = new URLSearchParams(location.search).get('q'); if (q0) $('q').value = q0;
    muat();
})();
