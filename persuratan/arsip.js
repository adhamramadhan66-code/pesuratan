(function () {
    'use strict';
    const { $, esc, tglIndo, hariIni, api, toast, BULAN } = App;
    const API = 'api/arsip.php';

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
        } catch (e) { $('galeri').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>'; }
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

    function kartu(r) {
        const sudah = r.status_arsip === 'diarsipkan';
        const url = API + '?aksi=file&id=' + r.id;
        // Pratinjau file: klik membuka file. Tanpa file: klik membuka dialog untuk mengunggah dan mengarsipkan.
        const thumb = r.ada_file
            ? '<a class="kartu-thumb" href="' + url + '" target="_blank" rel="noopener" title="Buka file surat">' + App.thumb(url, r.file_nama) + '</a>'
            : '<button type="button" class="kartu-thumb" data-arsip="' + r.id + '" title="Unggah file dan arsipkan">' + App.thumb('', '') + '</button>';
        const aksi = sudah
            ? ['<button class="btn sm" data-arsip="' + r.id + '">Ubah</button>', '<button class="btn sm danger" data-batal="' + r.id + '">Batalkan</button>']
            : ['<button class="btn sm primary" data-arsip="' + r.id + '">Arsipkan</button>'];
        if (r.ada_file) aksi.push('<a class="btn sm" href="' + url + '&unduh=1">Unduh</a>');
        const lokasi = sudah ? (r.lokasi_arsip ? esc(r.lokasi_arsip) : 'Hanya file digital') + ' · ' + esc(tglIndo(r.tanggal_arsip)) : esc(tglIndo(r.tanggal_surat));
        return '<div class="kartu ' + (sudah ? 'ok' : 'bad') + '">' + thumb +
            '<div class="kartu-judul mono" title="' + esc(r.nomor_surat) + '">' + esc(r.nomor_surat) + '</div>' +
            '<div class="kartu-sub" title="' + esc(r.perihal) + '">' + esc(r.perihal) + '</div>' +
            '<div class="kartu-sub satu">' + esc(r.jenis_nama) + (r.pembuat_surat ? ' · ' + esc(r.pembuat_surat) : '') + '</div>' +
            '<div class="kartu-status"><span class="badge ' + (sudah ? 'ok' : 'warn') + '">' + (sudah ? 'Diarsipkan' : 'Belum diarsipkan') + '</span><span>' + lokasi + '</span></div>' +
            '<div class="aksi">' + aksi.join('') + '</div></div>';
    }

    function render() {
        $('galeri').innerHTML = baris.length ? baris.map(kartu).join('') : '<p class="galeri-kosong">Tidak ada surat yang cocok. Surat dibuat lewat menu "Penomoran".</p>';
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

    // Isi ulang bagian dialog yang bergantung pada surat terpilih (r) — dipakai oleh Arsipkan/Ubah dan kartu +
    function isiDialog(r) {
        aktif = r;
        $('dlgInfo').style.display = r ? '' : 'none';
        if (r) {
            $('dlgNomor').textContent = r.nomor_surat;
            $('dlgPerihal').textContent = r.perihal + ' — pembuat: ' + (r.pembuat_surat || '-');
        }
        $('dlgTanggal').value = (r && r.tanggal_arsip) || hariIni();
        $('dlgLokasi').value = (r && r.lokasi_arsip) || '';
        $('dlgKet').value = (r && r.keterangan_arsip) || '';
        $('dlgFile').value = '';
        $('dlgHapusFile').checked = false;
        $('fileNow').style.display = r && r.ada_file ? '' : 'none';
        if (r && r.ada_file) {
            $('fileNowNama').textContent = r.file_nama;
            $('fileNowLihat').href = API + '?aksi=file&id=' + r.id;
        }
    }

    function buka(r) {
        isiDialog(r);
        $('dlgJudul').textContent = r.status_arsip === 'diarsipkan' ? 'Ubah data arsip' : 'Arsipkan surat';
        dlg.showModal();
    }

    $('galeri').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.arsip) { const r = baris.find((x) => +x.id === +b.dataset.arsip); if (r) buka(r); }
        if (b.dataset.batal) {
            const r = baris.find((x) => +x.id === +b.dataset.batal); if (!r) return;
            if (!confirm('Batalkan pengarsipan surat ' + r.nomor_surat + '? Lokasi dan tanggal arsip dihapus; file surat tetap disimpan.')) return;
            const fd = new FormData(); fd.append('aksi', 'batal'); fd.append('id', r.id);
            try { await api(API, fd); toast('Pengarsipan dibatalkan'); muat(); } catch (e) { toast(e.message, true); }
        }
    });

    $('dlgBatal').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });   // klik area gelap = tutup

    $('dlgForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!aktif) return;
        const file = $('dlgFile').files[0];
        const galatFile = App.cekFile(file);
        if (galatFile) { toast(galatFile, true); return; }
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
