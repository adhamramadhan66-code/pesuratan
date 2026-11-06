(function () {
    'use strict';
    const { $, esc, tglIndo, hariIni, api, toast, BULAN } = App;
    const ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const API = 'api/surat.php';

    const el = {
        tanggal: $('f_tanggal'), jenis: $('f_jenis'), unit: $('f_unit'), perihal: $('f_perihal'),
    };
    const radio = (name) => (document.querySelector('input[name="' + name + '"]:checked') || {}).value || '';
    const setRadio = (name, v) => document.querySelectorAll('input[name="' + name + '"]').forEach((r) => { r.checked = r.value === v; });

    let opsi = { jenis: [], unit: [], tahun: [] };
    let urut = null;            // nomor urut berikutnya pada bulan yang dipilih
    let editId = null, editNomor = '', editAsal = null;
    let baris = [];             // data tabel yang sedang tampil

    const namaDari = (daftar, kode) => (daftar.find((x) => x.kode === kode) || {}).nama || '';

    // ---------- Pratinjau nomor surat ----------
    function pratinjau() {
        const tgl = el.tanggal.value;
        const th = tgl ? +tgl.slice(0, 4) : '', bl = tgl ? +tgl.slice(5, 7) : 0;
        const tujuan = radio('tujuan');
        let nomor;
        nomor = (urut == null ? '...' : String(urut).padStart(3, '0')) + '.' + (tujuan || '?') + '/' + (el.jenis.value || '—') + '/' +
                     (el.unit.value || '—') + '/' + (ROMAWI[bl] || '—') + '/' + (th || '—');
        $('nomorPreview').textContent = nomor;
        $('nomorUrut').textContent = (urut == null ? '...' : '#' + String(urut).padStart(3, '0'));
        $('nomorTujuan').textContent = tujuan === 'A' ? 'A — Internal' : tujuan === 'B' ? 'B — Eksternal' : '-';
        $('nomorJenis').textContent = el.jenis.value ? el.jenis.value + ' — ' + namaDari(opsi.jenis, el.jenis.value) : '-';
        $('nomorUnit').textContent = el.unit.value ? el.unit.value + ' — ' + namaDari(opsi.unit, el.unit.value) : '-';
        $('nomorBulan').textContent = bl ? ROMAWI[bl] + ' — ' + BULAN[bl - 1] : '-';
        $('nomorTahun').textContent = th || '-';
    }

    async function muatUrut() {
        if (!el.tanggal.value) return;
        // Saat mengubah surat: bulan & tahun tidak berubah -> nomor urut lama dipakai.
        if (editAsal && +el.tanggal.value.slice(0, 4) === editAsal.tahun && +el.tanggal.value.slice(5, 7) === editAsal.bulan) {
            urut = editAsal.nomor_urut; pratinjau(); return;
        }
        try {
            const d = await api(API + '?aksi=preview&tanggal=' + encodeURIComponent(el.tanggal.value));
            urut = d.nomor_urut;
        } catch (e) { urut = null; }
        pratinjau();
    }

    // ---------- Formulir ----------
    function isiOpsi(sel, daftar, placeholder, labelFn) {
        sel.innerHTML = '<option value="">' + placeholder + '</option>' +
            daftar.map((x) => '<option value="' + esc(x.kode) + '">' + esc(labelFn(x)) + '</option>').join('');
    }

    function kunci(terkunci) {
        [el.tanggal, el.jenis, el.unit].forEach((e) => { e.disabled = terkunci; });
        document.querySelectorAll('input[name="tujuan"]').forEach((r) => { r.disabled = terkunci; });
    }

    function bersihkanGalat() { document.querySelectorAll('.bad').forEach((e) => e.classList.remove('bad')); }

    function keModeTambah(kosongkanSemua) {
        editId = null; editNomor = ''; editAsal = null;
        $('editBanner').classList.remove('show');
        $('btnBatal').style.display = 'none';
        $('btnSimpanTeks').textContent = 'Simpan & ambil nomor';
        $('formTitle').textContent = 'Data surat baru';
        kunci(false);
        el.perihal.value = '';
        if (kosongkanSemua) {
            el.tanggal.value = hariIni(); el.jenis.value = ''; el.unit.value = '';
            setRadio('tujuan', 'A'); setRadio('jalur', 'disposisi');
        }
        bersihkanGalat();
        muatUrut(); pratinjau();
    }

    function keModeUbah(r) {
        editId = r.id; editNomor = r.nomor_surat;
        editAsal = { tahun: +r.tahun, bulan: +r.bulan, nomor_urut: +r.nomor_urut };
        $('hasilBox').style.display = 'none';
        $('editBanner').classList.add('show');
        $('editBannerNo').textContent = r.nomor_surat;
        $('btnBatal').style.display = '';
        $('btnSimpanTeks').textContent = 'Simpan perubahan';
        $('formTitle').textContent = 'Ubah data surat';
        el.tanggal.value = r.tanggal_surat; setRadio('tujuan', r.kode_tujuan); setRadio('jalur', r.jalur || 'disposisi');
        el.jenis.value = r.jenis_kode; el.unit.value = r.unit_kode;
        el.perihal.value = r.perihal;
        kunci(false); bersihkanGalat(); urut = editAsal.nomor_urut; pratinjau();
        $('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    $('suratForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        bersihkanGalat();
        const wajib = [['tanggal', 'tanggal'], ['jenis', 'jenis surat'], ['unit', 'unit pembuat'], ['perihal', 'perihal']];
        for (const [k, nama] of wajib) {
            if (!el[k].value.trim()) { el[k].classList.add('bad'); el[k].focus(); toast('Isi ' + nama + ' terlebih dahulu.', true); return; }
        }
        const data = {
            aksi: editId ? 'ubah' : 'tambah', id: editId,
            tanggal_surat: el.tanggal.value, kode_tujuan: radio('tujuan'), jalur: radio('jalur'), jenis_kode: el.jenis.value, unit_kode: el.unit.value,
            perihal: el.perihal.value,
        };
        const btn = $('btnSimpan'); btn.disabled = true;
        try {
            const d = await api(API, data);
            if (editId) { toast('Perubahan disimpan: ' + d.nomor_surat); keModeTambah(true); }
            else {
                $('hasilNomor').textContent = d.nomor_surat;
                $('hasilBox').style.display = '';
                toast('Surat tersimpan dengan nomor ' + d.nomor_surat);
                const keKeluar = data.jalur === 'keluar';
                $('btnKeDisposisi').href = keKeluar ? 'surat_keluar.html' : 'disposisi.html?unggah=k:' + d.id;   // langkah berikutnya: unggah file di Surat Keluar / Disposisi
                $('btnKeDisposisi').textContent = keKeluar ? 'Unggah surat di Surat Keluar' : 'Unggah surat di Disposisi';
                keModeTambah(true);
            }
            muatDaftar();
        } catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });
    $('btnBatal').addEventListener('click', () => keModeTambah(true));
    $('btnReset').addEventListener('click', () => keModeTambah(true));
    el.tanggal.addEventListener('change', () => { urut = null; pratinjau(); muatUrut(); });
    [el.jenis, el.unit].forEach((e) => e.addEventListener('change', pratinjau));
    document.querySelectorAll('input[name="tujuan"]').forEach((r) => r.addEventListener('change', pratinjau));
    $('btnSalin').addEventListener('click', async () => {
        const t = $('hasilNomor').textContent;
        try { await navigator.clipboard.writeText(t); toast('Nomor surat disalin'); }
        catch (e) { toast('Tidak bisa menyalin otomatis. Salin manual: ' + t, true); }
    });

    // ---------- Tabel data surat ----------
    async function muatDaftar() {
        const p = new URLSearchParams({ aksi: 'daftar', q: $('q').value.trim(), tahun: $('fTahun').value, bulan: $('fBulan').value, limit: 200 });
        try {
            const d = await api(API + '?' + p);
            baris = d.surat;
            render();
        } catch (e) { $('galeri').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>'; }
    }

    function render() {
        $('jumlah').textContent = baris.length + ' surat';
        if (!baris.length) { $('galeri').innerHTML = '<p class="galeri-kosong">Belum ada data surat.</p>'; return; }
        $('galeri').innerHTML = baris.map((r) => {
            const adaDsp = !!r.no_disposisi, ok = r.status_disposisi === 'disetujui';
            const aksi = [];
            const keluar = r.jalur === 'keluar';
            if (keluar) aksi.push('<a class="btn sm primary" href="surat_keluar.html?q=' + encodeURIComponent(r.nomor_surat) + '">Buka di Surat Keluar</a>');
            else if (!adaDsp || !r.ada_file) aksi.push('<a class="btn sm primary" href="disposisi.html?unggah=k:' + r.id + '">Unggah surat</a>');
            aksi.push('<button class="btn sm" data-ubah="' + r.id + '">Ubah</button>', '<button class="btn sm danger" data-hapus="' + r.id + '">Hapus</button>');
            return App.kartuHtml({
                kelas: ok ? 'ok' : adaDsp ? 'bad' : 'abu', judulTeks: r.nomor_surat, judul: esc(r.nomor_surat),
                thumb: App.thumbFile('api/arsip.php?aksi=file&id=' + r.id, r.file_nama, r.ada_file),
                sub: [esc(r.perihal), esc(tglIndo(r.tanggal_surat)) + ' · ' + (r.kode_tujuan === 'A' ? 'Internal' : 'Eksternal')],
                status: adaDsp
                    ? '<span class="badge ' + (ok ? 'ok' : 'warn') + '">' + (ok ? 'Disetujui' : 'Belum disetujui') + '</span><span>' + esc(r.no_disposisi) + '</span>'
                    : keluar ? '<span class="badge ok">Surat Keluar</span>' : '<span class="badge">Belum diunggah</span>',
                aksi: aksi.join(''),
            });
        }).join('');
    }

    $('galeri').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.ubah) { const r = baris.find((x) => +x.id === +b.dataset.ubah); if (r) keModeUbah(r); }
        if (b.dataset.hapus) {
            const r = baris.find((x) => +x.id === +b.dataset.hapus); if (!r) return;
            const arsip = r.status_arsip === 'diarsipkan' ? '\n\nSurat ini sudah diarsipkan; file scan arsipnya ikut terhapus.' : '';
            if (!confirm('Hapus surat ' + r.nomor_surat + '?' + arsip + '\n\nNomor ini tidak otomatis dipakai ulang kecuali ini surat terakhir pada bulannya.')) return;
            try { await api(API, { aksi: 'hapus', id: r.id }); toast('Surat dihapus'); if (editId === r.id) keModeTambah(true); muatUrut(); muatDaftar(); }
            catch (e) { toast(e.message, true); }
        }
    });

    let tm; $('q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(muatDaftar, 300); });
    $('fTahun').addEventListener('change', muatDaftar);
    $('fBulan').addEventListener('change', muatDaftar);

    // ---------- Mulai ----------
    (async function mulai() {
        el.tanggal.value = hariIni();
        $('fBulan').innerHTML = '<option value="">Semua bulan</option>' + BULAN.map((b, i) => '<option value="' + (i + 1) + '">' + b + '</option>').join('');
        try {
            opsi = await api(API + '?aksi=opsi');
            isiOpsi(el.jenis, opsi.jenis, 'Pilih jenis surat…', (x) => x.nama + ' (' + x.kode + ')');
            isiOpsi(el.unit, opsi.unit, 'Pilih unit pembuat…', (x) => x.nama + ' (' + x.kode + ')');
            $('fTahun').innerHTML = '<option value="">Semua tahun</option>' + opsi.tahun.map((t) => '<option value="' + t + '">' + t + '</option>').join('');
        } catch (e) { toast(e.message, true); }
        pratinjau(); muatUrut(); muatDaftar();
    })();
})();
