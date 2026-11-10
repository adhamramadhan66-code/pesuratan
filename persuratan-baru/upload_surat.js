(function () {
    'use strict';
    const { $, esc, tglIndo, hariIni, api, toast, BULAN } = App;
    const ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const API = 'api/surat.php';

    const el = {
        judul: $('f_judul'), tanggal: $('f_tanggal'), jenis: $('f_jenis'), unit: $('f_unit'), perihal: $('f_perihal'), link: $('f_link'),
    };
    const radio = (name) => (document.querySelector('input[name="' + name + '"]:checked') || {}).value || '';
    const setRadio = (name, v) => document.querySelectorAll('input[name="' + name + '"]').forEach((r) => { r.checked = r.value === v; });

    let opsi = { jenis: [], unit: [], tahun: [] };
    let urut = null;            // nomor urut berikutnya pada bulan yang dipilih
    let editId = null, editNomor = '', editAsal = null;

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
        el.judul.value = ''; el.perihal.value = ''; el.link.value = '';
        if (kosongkanSemua) {
            el.tanggal.value = hariIni(); el.jenis.value = ''; el.unit.value = '';
            setRadio('tujuan', 'A');
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
        el.tanggal.value = r.tanggal_surat; setRadio('tujuan', r.kode_tujuan);
        el.jenis.value = r.jenis_kode; el.unit.value = r.unit_kode;
        el.judul.value = r.judul || ''; el.perihal.value = r.perihal; el.link.value = r.link_drive || '';
        kunci(false); bersihkanGalat(); urut = editAsal.nomor_urut; pratinjau();
        $('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    $('suratForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        bersihkanGalat();
        const wajib = [['judul', 'judul surat'], ['tanggal', 'tanggal'], ['jenis', 'jenis surat'], ['unit', 'unit pembuat'], ['perihal', 'perihal']];
        for (const [k, nama] of wajib) {
            if (!el[k].value.trim()) { el[k].classList.add('bad'); el[k].focus(); toast('Isi ' + nama + ' terlebih dahulu.', true); return; }
        }
        const link = el.link.value.trim();
        if (link && !/^https:\/\/(drive|docs)\.google\.com\//i.test(link)) {
            el.link.classList.add('bad'); el.link.focus();
            toast('Link harus berupa tautan Google Drive (https://drive.google.com/...).', true); return;
        }
        const data = {
            aksi: editId ? 'ubah' : 'tambah', id: editId,
            judul: el.judul.value, tanggal_surat: el.tanggal.value, kode_tujuan: radio('tujuan'), jenis_kode: el.jenis.value, unit_kode: el.unit.value,
            perihal: el.perihal.value, link_drive: link,
        };
        const btn = $('btnSimpan'); btn.disabled = true;
        try {
            const d = await api(API, data);
            if (editId) { toast('Perubahan disimpan: ' + d.nomor_surat); setTimeout(() => { window.location.href = 'data_surat.html'; }, 700); return; }
            else {
                $('hasilNomor').textContent = d.nomor_surat;
                idBaru = d.id;
                $('hasilBox').style.display = '';
                toast('Surat tersimpan dengan nomor ' + d.nomor_surat);
                keModeTambah(true);
            }
            muatUrut();
        } catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });
    $('btnBatal').addEventListener('click', () => { if (editId) window.location.href = 'data_surat.html'; else keModeTambah(true); });
    $('btnReset').addEventListener('click', () => keModeTambah(true));
    el.tanggal.addEventListener('change', () => { urut = null; pratinjau(); muatUrut(); });
    [el.jenis, el.unit].forEach((e) => e.addEventListener('change', pratinjau));
    document.querySelectorAll('input[name="tujuan"]').forEach((r) => r.addEventListener('change', pratinjau));
    let idBaru = 0;     // surat yang baru saja diberi nomor (untuk tombol Batal)
    $('btnBatalNomor').addEventListener('click', async () => {
        if (!idBaru || !confirm('Batalkan nomor ' + $('hasilNomor').textContent + '? Surat ini dihapus dan nomornya tidak terpakai.')) return;
        const btn = $('btnBatalNomor'); btn.disabled = true;
        try {
            await api(API, { aksi: 'hapus', id: idBaru });
            toast('Nomor ' + $('hasilNomor').textContent + ' dibatalkan');
            idBaru = 0; $('hasilBox').style.display = 'none'; urut = null; muatUrut();
        } catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });
    $('btnSalin').addEventListener('click', async () => {
        const t = $('hasilNomor').textContent;
        try { await navigator.clipboard.writeText(t); toast('Nomor surat disalin'); }
        catch (e) { toast('Tidak bisa menyalin otomatis. Salin manual: ' + t, true); }
    });

    // ---------- Mulai ----------
    (async function mulai() {
        el.tanggal.value = hariIni();
        try {
            opsi = await api(API + '?aksi=opsi');
            isiOpsi(el.jenis, opsi.jenis, 'Pilih jenis surat…', (x) => x.nama + ' (' + x.kode + ')');
            isiOpsi(el.unit, opsi.unit, 'Pilih unit pembuat…', (x) => x.nama + ' (' + x.kode + ')');
        } catch (e) { toast(e.message, true); }
        pratinjau(); muatUrut();
        const idUbah = +new URLSearchParams(location.search).get('ubah');
        if (idUbah) {
            try { keModeUbah((await api(API + '?aksi=detail&id=' + idUbah)).surat); }
            catch (e) { toast(e.message, true); }
        }
    })();
})();
