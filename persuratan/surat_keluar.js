(function () {
    'use strict';
    const { $, esc, tglIndo, hariIni, api, toast, BULAN } = App;
    const API = 'api/surat.php';
    const TAHAP = ['bernomor', 'diperiksa', 'ditandatangani', 'terkirim'];
    const NAMA = { bernomor: 'Bernomor', diperiksa: 'Diperiksa', ditandatangani: 'Ditandatangani', terkirim: 'Terkirim' };
    const KE_DEPAN = { bernomor: 'Tandai diperiksa', diperiksa: 'Tandai ditandatangani', ditandatangani: 'Kirim surat' };

    let baris = [], arsip = '', aktif = null;

    async function muat() {
        const p = new URLSearchParams({ aksi: 'daftar', arsip, q: $('q').value.trim(), tahun: $('fTahun').value, bulan: $('fBulan').value, limit: 500, acc: 1 });
        try {
            const d = await api(API + '?' + p);
            baris = d.surat;
            const r = d.ringkas;
            $('sTotal').textContent = r.total; $('sKirim').textContent = r.acc; $('sBelum').textContent = r.total - r.diarsipkan;
            $('sPersen').textContent = r.total ? Math.round(((r.total - r.diarsipkan) / r.total) * 100) + '% belum diarsipkan' : 'Belum ada surat keluar';
            $('sBar').style.width = (r.total ? (r.diarsipkan / r.total) * 100 : 0) + '%';
            const sel = $('fTahun'), cur = sel.value;
            if (sel.options.length - 1 !== d.daftar_tahun.length) {
                sel.innerHTML = '<option value="">Semua tahun</option>' + d.daftar_tahun.map((t) => '<option value="' + t + '">' + t + '</option>').join('');
                sel.value = cur;
            }
            render();
        } catch (e) { $('galeri').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>'; }
    }

    function render() {
        if (!baris.length) { $('galeri').innerHTML = '<p class="galeri-kosong">Belum ada surat keluar. Surat muncul di sini bila dipilih "Surat Keluar" di Penomoran.</p>'; return; }
        $('galeri').innerHTML = baris.map((r) => {
            const sudah = r.status_arsip === 'diarsipkan';
            const aksi = [];
            // Arsipkan hanya bila file surat sudah diunggah dan sudah di-ACC
            if ((r.ada_file && +r.acc_keluar) || sudah) aksi.push('<a class="btn sm" href="arsip.html?q=' + encodeURIComponent(r.nomor_surat) + '">' + (sudah ? 'Lihat arsip' : 'Arsipkan') + '</a>');
            aksi.unshift(+r.acc_keluar
                ? '<button class="btn sm" data-acc="' + r.id + '" data-nilai="0">Batalkan ACC</button>'
                : '<button class="btn sm primary" data-acc="' + r.id + '" data-nilai="1">ACC</button>');
            aksi.push('<button class="btn sm merah-garis" data-hapus="' + r.id + '">Hapus</button>');
            return App.kartuHtml({
                kelas: sudah ? 'ok' : 'bad', judulTeks: r.nomor_surat, judul: esc(r.nomor_surat),
                thumb: App.thumbSurat({ ada: r.ada_file, link: r.link_drive, url: 'api/arsip.php?aksi=file&id=' + r.id, nama: r.file_nama, ganti: r.ada_file ? r.id : 0, unggah: r.ada_file ? 0 : r.id }),
                sub: [esc(r.perihal), esc(tglIndo(r.tanggal_surat)) + ' · ' + (r.kode_tujuan === 'A' ? 'Internal' : 'Eksternal')],
                status: (+r.acc_keluar ? '<span class="badge ok">Sudah di-ACC</span>' : '<span class="badge warn">Belum di-ACC</span>') +
                    '<span class="badge ' + (sudah ? 'ok' : 'warn') + '">' + (sudah ? 'Diarsipkan' : 'Belum diarsipkan') + '</span>',
                aksi: aksi.join(''),
            });
        }).join('');
    }

    document.querySelectorAll('#segArsip input').forEach((r) => r.addEventListener('change', () => { arsip = r.value; muat(); }));
    let tm; $('q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(muat, 300); });
    ['fTahun', 'fBulan'].forEach((id) => $(id).addEventListener('change', muat));

    const ubahTahap = (id, tahap, tambahan) => api(API, Object.assign({ aksi: 'tahap', id, tahap }, tambahan || {}));

    // Simpan link Google Drive surat
    async function simpanLink(r) {
        const link = await App.mintaLink('Link Google Drive surat ' + r.nomor_surat, r.link_drive || '');
        if (!link) return;
        try { const fd = new FormData(); fd.append('aksi', 'unggah'); fd.append('id', r.id); fd.append('link', link); await api('api/arsip.php', fd); toast('Link surat disimpan'); muat(); }
        catch (e) { toast(e.message, true); }
    }

    $('galeri').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.unggah) { const r = baris.find((x) => +x.id === +b.dataset.unggah); if (r) simpanLink(r); return; }
        if (b.dataset.acc) {
            const r = baris.find((x) => +x.id === +b.dataset.acc); if (!r) return;
            try { await api(API, { aksi: 'acc_keluar', id: r.id, nilai: +b.dataset.nilai }); toast(+b.dataset.nilai ? r.nomor_surat + ' di-ACC' : 'ACC ' + r.nomor_surat + ' dibatalkan'); muat(); }
            catch (e) { toast(e.message, true); }
            return;
        }
        if (b.dataset.pilih) {
            const r = baris.find((x) => +x.id === +b.dataset.pilih); if (!r) return;
            App.pilihBukaGanti(r.link_drive || 'api/arsip.php?aksi=file&id=' + r.id, () => simpanLink(r)); return;
        }
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
