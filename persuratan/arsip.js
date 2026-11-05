(function () {
    'use strict';
    const { $, esc, tglIndo, hariIni, api, toast, BULAN } = App;
    const API = 'api/arsip.php';
    const MAKS = 10 * 1024 * 1024;

    let baris = [];
    let status = '';            // '' | belum | diarsipkan
    let aktif = null;           // surat yang sedang di dialog

    // ---------- Muat & tampilkan ----------
    async function muat() {
        const p = new URLSearchParams({ aksi: 'daftar', status, q: $('q').value.trim(), tahun: $('fTahun').value, bulan: $('fBulan').value, jenis: $('fJenis').value, pembuat: $('fPembuat').value });
        try {
            const d = await api(API + '?' + p);
            baris = d.surat;
            const belum = d.total - d.diarsipkan;
            $('sTotal').textContent = d.total;
            $('sSudah').textContent = d.diarsipkan;
            $('sBelum').textContent = belum;
            $('sPersen').textContent = d.total ? Math.round((d.diarsipkan / d.total) * 100) + '% sudah diarsipkan' : 'Belum ada surat';
            $('sBar').style.width = (d.total ? (d.diarsipkan / d.total) * 100 : 0) + '%';
            isiTahun(d.daftar_tahun);
            isiPilihan($('fJenis'), 'Semua kategori', d.daftar_jenis.map((x) => [x.kode, x.nama]));
            isiPilihan($('fPembuat'), 'Semua pembuat', d.daftar_pembuat.map((x) => [x, x]));
            render();
        } catch (e) { $('tbody').innerHTML = '<tr class="empty-row"><td colspan="8">' + esc(e.message) + '</td></tr>'; }
    }

    function isiPilihan(sel, semua, daftar) {
        const cur = sel.value;
        sel.innerHTML = '<option value="">' + semua + '</option>' + daftar.map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + '</option>').join('');
        sel.value = cur;
    }

    function isiTahun(daftar) {
        const sel = $('fTahun'), cur = sel.value;
        if (sel.options.length - 1 === daftar.length) return;
        sel.innerHTML = '<option value="">Semua tahun</option>' + daftar.map((t) => '<option value="' + t + '">' + t + '</option>').join('');
        sel.value = cur;
    }

    function render() {
        if (!baris.length) { $('tbody').innerHTML = '<tr class="empty-row"><td colspan="8">Tidak ada surat yang cocok. Tambahkan surat lewat menu "Penomoran".</td></tr>'; return; }
        $('tbody').innerHTML = baris.map((r) => {
            const sudah = r.status_arsip === 'diarsipkan';
            const lokasi = sudah
                ? (r.lokasi_arsip ? esc(r.lokasi_arsip) : '<span class="muted">Hanya file digital</span>') +
                  '<span class="sub">Diarsipkan ' + esc(tglIndo(r.tanggal_arsip)) + (r.keterangan_arsip ? ' · ' + esc(r.keterangan_arsip) : '') + '</span>'
                : '<span class="muted">-</span>';
            const file = r.ada_file
                ? '<a class="btn sm" target="_blank" rel="noopener" href="' + API + '?aksi=file&id=' + r.id + '">Lihat</a> ' +
                  '<a class="btn sm" href="' + API + '?aksi=file&unduh=1&id=' + r.id + '">Unduh</a>' +
                  '<span class="sub">' + esc(r.file_nama) + '</span>'
                : '<span class="muted">-</span>';
            const aksi = sudah
                ? '<button class="btn sm" data-arsip="' + r.id + '">Ubah</button><button class="btn sm danger" data-batal="' + r.id + '">Batalkan</button>'
                : '<button class="btn sm primary" data-arsip="' + r.id + '">Arsipkan</button>';
            return '<tr class="' + (sudah ? 'row-ok' : 'row-bad') + '"><td class="no-surat">' + esc(r.nomor_surat) + '<span class="sub">' + esc(tglIndo(r.tanggal_surat)) + '</span></td>' +
                '<td><span class="kat">' + esc(r.jenis_nama) + '</span><span class="sub mono">' + esc(r.jenis_kode) + '</span></td>' +
                '<td>' + esc(r.perihal) + '<span class="sub">Untuk: ' + esc(r.untuk) + ' · TTD ' + (r.jenis_ttd === 'scan' ? 'scan' : 'basah') + '</span></td>' +
                '<td>' + esc(r.pembuat_surat || '-') + '</td>' +
                '<td><span class="badge ' + (sudah ? 'ok' : 'warn') + '">' + (sudah ? 'Diarsipkan' : 'Belum diarsipkan') + '</span></td>' +
                '<td>' + lokasi + '</td><td>' + file + '</td><td><div class="aksi">' + aksi + '</div></td></tr>';
        }).join('');
    }

    // ---------- Filter ----------
    document.querySelectorAll('#segStatus input').forEach((r) => r.addEventListener('change', () => { status = r.value; muat(); }));
    let tm; $('q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(muat, 300); });
    $('fTahun').addEventListener('change', muat);
    $('fBulan').addEventListener('change', muat);
    $('fJenis').addEventListener('change', muat);
    $('fPembuat').addEventListener('change', muat);

    // ---------- Dialog arsipkan / ubah ----------
    const dlg = $('dlgArsip');
    function buka(r) {
        aktif = r;
        $('dlgNomor').textContent = r.nomor_surat;
        $('dlgPerihal').textContent = r.perihal + ' — pembuat: ' + (r.pembuat_surat || '-');
        $('dlgTanggal').value = r.tanggal_arsip || hariIni();
        $('dlgLokasi').value = r.lokasi_arsip || '';
        $('dlgKet').value = r.keterangan_arsip || '';
        $('dlgFile').value = '';
        $('dlgHapusFile').checked = false;
        $('fileNow').style.display = r.ada_file ? '' : 'none';
        if (r.ada_file) {
            $('fileNowNama').textContent = r.file_nama;
            $('fileNowLihat').href = API + '?aksi=file&id=' + r.id;
        }
        $('dlgJudul').textContent = r.status_arsip === 'diarsipkan' ? 'Ubah data arsip' : 'Arsipkan surat';
        dlg.showModal();
    }

    $('tbody').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.arsip) { const r = baris.find((x) => +x.id === +b.dataset.arsip); if (r) buka(r); }
        if (b.dataset.batal) {
            const r = baris.find((x) => +x.id === +b.dataset.batal); if (!r) return;
            if (!confirm('Batalkan pengarsipan surat ' + r.nomor_surat + '?' + (r.ada_file ? '\n\nFile scan yang sudah diunggah akan dihapus.' : ''))) return;
            const fd = new FormData(); fd.append('aksi', 'batal'); fd.append('id', r.id);
            try { await api(API, fd); toast('Pengarsipan dibatalkan'); muat(); } catch (e) { toast(e.message, true); }
        }
    });

    $('dlgBatal').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });   // klik area gelap = tutup

    $('dlgForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const file = $('dlgFile').files[0];
        if (file) {
            if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) { toast('Format file harus PDF, JPG, atau PNG.', true); return; }
            if (file.size > MAKS) { toast('Ukuran file maksimal 10 MB.', true); return; }
        }
        const adaFileLama = aktif.ada_file && !$('dlgHapusFile').checked;
        if (!$('dlgLokasi').value.trim() && !file && !adaFileLama) {
            toast('Isi lokasi arsip fisik atau unggah file scan (minimal salah satu).', true); $('dlgLokasi').focus(); return;
        }
        const fd = new FormData();
        fd.append('aksi', 'simpan'); fd.append('id', aktif.id);
        fd.append('tanggal_arsip', $('dlgTanggal').value);
        fd.append('lokasi_arsip', $('dlgLokasi').value);
        fd.append('keterangan_arsip', $('dlgKet').value);
        if ($('dlgHapusFile').checked) fd.append('hapus_file', '1');
        if (file) fd.append('file', file);
        const btn = $('dlgSimpan'); btn.disabled = true;
        try { await api(API, fd); dlg.close(); toast('Surat ' + aktif.nomor_surat + ' diarsipkan'); muat(); }
        catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });

    // ---------- Mulai ----------
    $('fBulan').innerHTML = '<option value="">Semua bulan</option>' + BULAN.map((b, i) => '<option value="' + (i + 1) + '">' + b + '</option>').join('');
    const q0 = new URLSearchParams(location.search).get('q');
    if (q0) $('q').value = q0;
    muat();
})();
