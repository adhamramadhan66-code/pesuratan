(function () {
    'use strict';
    const { $, esc, tglIndo, hariIni, api, toast, BULAN } = App;
    const API = 'api/surat.php';
    const TAHAP = ['bernomor', 'diperiksa', 'ditandatangani', 'terkirim'];
    const NAMA = { bernomor: 'Bernomor', diperiksa: 'Diperiksa', ditandatangani: 'Ditandatangani', terkirim: 'Terkirim' };
    const KE_DEPAN = { bernomor: 'Tandai diperiksa', diperiksa: 'Tandai ditandatangani', ditandatangani: 'Kirim surat' };

    let baris = [], arsip = '', aktif = null;

    async function muat() {
        const p = new URLSearchParams({ aksi: 'daftar', arsip, tahap: $('fTahap').value, q: $('q').value.trim(), tahun: $('fTahun').value, bulan: $('fBulan').value, limit: 500, acc: 1 });
        try {
            const d = await api(API + '?' + p);
            baris = d.surat;
            const r = d.ringkas;
            $('sTotal').textContent = r.total; $('sKirim').textContent = r.terkirim; $('sBelum').textContent = r.total - r.diarsipkan;
            $('sPersen').textContent = r.total ? Math.round((r.terkirim / r.total) * 100) + '% sudah terkirim' : 'Belum ada surat keluar';
            $('sBar').style.width = (r.total ? (r.terkirim / r.total) * 100 : 0) + '%';
            const sel = $('fTahun'), cur = sel.value;
            if (sel.options.length - 1 !== d.daftar_tahun.length) {
                sel.innerHTML = '<option value="">Semua tahun</option>' + d.daftar_tahun.map((t) => '<option value="' + t + '">' + t + '</option>').join('');
                sel.value = cur;
            }
            render();
        } catch (e) { $('galeri').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>'; }
    }

    function langkah(t) {
        const i = TAHAP.indexOf(t);
        return '<span class="stp" title="Bernomor → Diperiksa → Ditandatangani → Terkirim">' + TAHAP.map((x, k) => '<i class="' + (k < i ? 'sudah' : k === i ? 'kini' : '') + '"></i>').join('') + '</span>';
    }

    function render() {
        if (!baris.length) { $('galeri').innerHTML = '<p class="galeri-kosong">Belum ada surat keluar. Surat muncul di sini bila dipilih "Surat Keluar" di Penomoran, atau setelah di-ACC di menu Disposisi.</p>'; return; }
        $('galeri').innerHTML = baris.map((r) => {
            const sudah = r.status_arsip === 'diarsipkan';
            const i = TAHAP.indexOf(r.tahap);
            const aksi = [];
            if (KE_DEPAN[r.tahap]) aksi.push('<button class="btn sm primary" data-maju="' + r.id + '">' + KE_DEPAN[r.tahap] + '</button>');
            if (i > 0) aksi.push('<button class="btn sm" data-mundur="' + r.id + '">Mundurkan</button>');
            aksi.push('<button class="btn sm" data-unggah="' + r.id + '">' + (r.ada_file ? 'Ganti file' : '+ Unggah file') + '</button>');
            // Arsipkan hanya bila file surat sudah diunggah
            if (r.ada_file || sudah) aksi.push('<a class="btn sm" href="arsip.html?q=' + encodeURIComponent(r.nomor_surat) + '">' + (sudah ? 'Lihat arsip' : 'Arsipkan') + '</a>');
            aksi.push('<button class="btn sm merah-garis" data-hapus="' + r.id + '">Hapus</button>');
            return App.kartuHtml({
                kelas: sudah ? 'ok' : 'bad', judulTeks: r.nomor_surat, judul: esc(r.nomor_surat),
                thumb: App.thumbFile('api/arsip.php?aksi=file&id=' + r.id, r.file_nama, r.ada_file),
                sub: [esc(r.perihal), esc(tglIndo(r.tanggal_surat)) + ' · ' + (r.kode_tujuan === 'A' ? 'Internal' : 'Eksternal')],
                status: '<span class="badge st-' + esc(r.tahap) + '">' + esc(NAMA[r.tahap] || r.tahap) + '</span>' + langkah(r.tahap) +
                    '<span class="badge ' + (sudah ? 'ok' : 'warn') + '">' + (sudah ? 'Diarsipkan' : 'Belum diarsipkan') + '</span>',
                aksi: aksi.join(''),
            });
        }).join('');
    }

    document.querySelectorAll('#segArsip input').forEach((r) => r.addEventListener('change', () => { arsip = r.value; muat(); }));
    let tm; $('q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(muat, 300); });
    ['fTahap', 'fTahun', 'fBulan'].forEach((id) => $(id).addEventListener('change', muat));

    const ubahTahap = (id, tahap, tambahan) => api(API, Object.assign({ aksi: 'tahap', id, tahap }, tambahan || {}));

    // Unggah file surat langsung dari kartu
    const pilih = document.createElement('input');
    pilih.type = 'file'; pilih.accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'; pilih.hidden = true;
    document.body.appendChild(pilih);
    let idUnggah = 0;
    pilih.addEventListener('change', async () => {
        const f = pilih.files[0]; pilih.value = '';
        if (!f) return;
        const salah = App.cekFile(f); if (salah) { toast(salah, true); return; }
        const fd = new FormData(); fd.append('aksi', 'unggah'); fd.append('id', idUnggah); fd.append('file', f);
        try { await api('api/arsip.php', fd); toast('File surat diunggah'); muat(); }
        catch (e) { toast(e.message, true); }
    });

    $('galeri').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.unggah) { idUnggah = +b.dataset.unggah; pilih.click(); return; }
        if (b.dataset.hapus) {
            const h = baris.find((x) => +x.id === +b.dataset.hapus); if (!h) return;
            if (!confirm('Hapus surat ' + h.nomor_surat + '? Surat dan filenya dihapus, nomornya tidak terpakai.')) return;
            try { await api('api/surat.php', { aksi: 'hapus', id: h.id }); toast('Surat ' + h.nomor_surat + ' dihapus'); muat(); }
            catch (e) { toast(e.message, true); }
            return;
        }
        const id = +(b.dataset.maju || b.dataset.mundur);
        const r = baris.find((x) => +x.id === id); if (!r) return;
        const i = TAHAP.indexOf(r.tahap);
        try {
            if (b.dataset.maju) {
                if (TAHAP[i + 1] === 'terkirim') { aktif = r; $('kNomor').textContent = r.nomor_surat; $('kPerihal').textContent = r.perihal; $('k_tgl').value = hariIni(); $('k_ket').value = ''; $('dlgKirim').showModal(); return; }
                await ubahTahap(id, TAHAP[i + 1]); toast(r.nomor_surat + ': ' + NAMA[TAHAP[i + 1]]); muat();
            } else if (b.dataset.mundur) {
                if (!confirm('Mundurkan tahap surat ' + r.nomor_surat + ' ke "' + NAMA[TAHAP[i - 1]] + '"?')) return;
                await ubahTahap(id, TAHAP[i - 1]); toast(r.nomor_surat + ': ' + NAMA[TAHAP[i - 1]]); muat();
            }
        } catch (e) { toast(e.message, true); }
    });

    $('kBatal').addEventListener('click', () => $('dlgKirim').close());
    $('dlgKirim').addEventListener('click', (e) => { if (e.target === $('dlgKirim')) $('dlgKirim').close(); });
    $('kirimForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const btn = $('kSimpan'); btn.disabled = true;
        try { await ubahTahap(aktif.id, 'terkirim', { tanggal_kirim: $('k_tgl').value, keterangan_kirim: $('k_ket').value }); $('dlgKirim').close(); toast(aktif.nomor_surat + ' ditandai terkirim'); muat(); }
        catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });

    $('fBulan').innerHTML = '<option value="">Semua bulan</option>' + BULAN.map((b, i) => '<option value="' + (i + 1) + '">' + b + '</option>').join('');
    const q0 = new URLSearchParams(location.search).get('q'); if (q0) $('q').value = q0;
    muat();
})();
