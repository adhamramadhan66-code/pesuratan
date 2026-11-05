(function () {
    'use strict';
    const { $, esc, tglIndo, hariIni, api, toast, BULAN } = App;
    const API = 'api/surat.php';
    const TAHAP = ['bernomor', 'diperiksa', 'ditandatangani', 'terkirim'];
    const NAMA = { bernomor: 'Bernomor', diperiksa: 'Diperiksa', ditandatangani: 'Ditandatangani', terkirim: 'Terkirim' };
    const KE_DEPAN = { bernomor: 'Tandai diperiksa', diperiksa: 'Tandai ditandatangani', ditandatangani: 'Kirim surat' };

    let baris = [], arsip = '', aktif = null;

    async function muat() {
        const p = new URLSearchParams({ aksi: 'daftar', arsip, tahap: $('fTahap').value, q: $('q').value.trim(), tahun: $('fTahun').value, bulan: $('fBulan').value, limit: 500 });
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
        } catch (e) { $('tbody').innerHTML = '<tr class="empty-row"><td colspan="7">' + esc(e.message) + '</td></tr>'; }
    }

    function langkah(t) {
        const i = TAHAP.indexOf(t);
        return '<span class="stp" title="Bernomor → Diperiksa → Ditandatangani → Terkirim">' + TAHAP.map((x, k) => '<i class="' + (k < i ? 'sudah' : k === i ? 'kini' : '') + '"></i>').join('') + '</span>';
    }

    function render() {
        if (!baris.length) { $('tbody').innerHTML = '<tr class="empty-row"><td colspan="7">Belum ada surat keluar. Surat baru dibuat lewat menu Penomoran.</td></tr>'; return; }
        $('tbody').innerHTML = baris.map((r) => {
            const sudah = r.status_arsip === 'diarsipkan';
            const i = TAHAP.indexOf(r.tahap);
            const dsp = r.disposisi_id
                ? '<span class="badge ' + (r.status_disposisi === 'disetujui' ? 'ok' : 'warn') + '">' + (r.status_disposisi === 'disetujui' ? 'Disetujui' : 'Belum disetujui') + '</span>' +
                  '<span class="sub">' + esc(r.no_disposisi) + (r.tujuan_disposisi ? ' · ke ' + esc(r.tujuan_disposisi) : '') + '</span>'
                : '<a class="btn sm primary" href="disposisi.html?surat=' + r.id + '">Buat disposisi</a>';
            const aksi = [];
            if (KE_DEPAN[r.tahap]) aksi.push('<button class="btn sm primary" data-maju="' + r.id + '">' + KE_DEPAN[r.tahap] + '</button>');
            if (i > 0) aksi.push('<button class="btn sm" data-mundur="' + r.id + '">Mundurkan</button>');
            return '<tr class="' + (sudah ? 'row-ok' : 'row-bad') + '">' +
                '<td class="no-surat">' + esc(r.nomor_surat) + '<span class="sub">' + esc(tglIndo(r.tanggal_surat)) + '</span></td>' +
                '<td>' + esc(r.perihal) + '<span class="sub">Untuk: ' + esc(r.untuk) + ' · ' + (r.kode_tujuan === 'A' ? 'Internal' : 'Eksternal') + '</span></td>' +
                '<td>' + esc(r.pejabat_ttd) + '<span class="sub">TTD ' + (r.jenis_ttd === 'scan' ? 'scan' : 'basah') + ' · pembuat: ' + esc(r.pembuat_surat) + '</span></td>' +
                '<td><span class="badge st-' + esc(r.tahap) + '">' + esc(NAMA[r.tahap] || r.tahap) + '</span>' + langkah(r.tahap) +
                    (r.tahap === 'terkirim' ? '<span class="sub">' + esc(tglIndo(r.tanggal_kirim)) + (r.keterangan_kirim ? ' · ' + esc(r.keterangan_kirim) : '') + '</span>' : '') + '</td>' +
                '<td>' + dsp + '</td>' +
                '<td><span class="badge ' + (sudah ? 'ok' : 'warn') + '">' + (sudah ? 'Diarsipkan' : 'Belum diarsipkan') + '</span>' +
                    '<span class="sub"><a href="arsip.html?q=' + encodeURIComponent(r.nomor_surat) + '">' + (sudah ? 'Lihat di Pengarsipan' : 'Arsipkan di Pengarsipan →') + '</a></span></td>' +
                '<td><div class="aksi" style="flex-wrap:wrap">' + aksi.join('') + '</div></td></tr>';
        }).join('');
    }

    document.querySelectorAll('#segArsip input').forEach((r) => r.addEventListener('change', () => { arsip = r.value; muat(); }));
    let tm; $('q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(muat, 300); });
    ['fTahap', 'fTahun', 'fBulan'].forEach((id) => $(id).addEventListener('change', muat));

    const ubahTahap = (id, tahap, tambahan) => api(API, Object.assign({ aksi: 'tahap', id, tahap }, tambahan || {}));

    $('tbody').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
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
