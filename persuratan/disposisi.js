(function () {
    'use strict';
    const { $, esc, tglIndo, hariIni, api, toast, BULAN } = App;
    const API = 'api/disposisi.php';
    const ISI = ['Diajukan', 'Mohon pendapat/saran', 'Mohon keputusan', 'Mohon persetujuan', 'Mohon paraf', 'Mohon tanda tangan',
                 'Mohon periksa catatan', 'Mohon SPPD', 'Siapkan persyaratannya', 'Sudah ditandatangani', 'Sudah diselesaikan/dilaksanakan', 'Simpan/arsip'];
    const SIFAT = [['penting', 'Penting'], ['segera', 'Segera'], ['rahasia', 'Rahasia'], ['biasa', 'Biasa']];
    const KOLOM_ALUR = 3;       // baris alur awal pada form baru
    const BARIS_CETAK = 16;     // baris alur pada lembar cetak (sama seperti lembar kertas)

    let baris = [], status = '', editId = null;
    let sumber = { surat: [], surat_masuk: [] };
    const csv = (s) => (s ? String(s).split(',').filter(Boolean) : []);
    const namaSifat = (k) => (SIFAT.find((x) => x[0] === k) || [0, k])[1];
    const namaUser = () => { try { const u = JSON.parse(sessionStorage.getItem('kampuslyCurrentUser') || 'null'); return (u && (u.name || u.email)) || 'Admin'; } catch (e) { return 'Admin'; } };
    const labelSurat = (r) => r.nomor_surat ? r.nomor_surat : r.nomor_agenda ? 'Surat masuk ' + r.nomor_agenda : '(tanpa surat)';

    // ---------- Daftar ----------
    async function muat() {
        const p = new URLSearchParams({ aksi: 'daftar', status, q: $('q').value.trim(), tahun: $('fTahun').value, bulan: $('fBulan').value });
        try {
            const d = await api(API + '?' + p);
            baris = d.disposisi;
            $('sTotal').textContent = d.total; $('sSetuju').textContent = d.disetujui; $('sBelum').textContent = d.total - d.disetujui;
            $('sPersen').textContent = d.total ? Math.round((d.disetujui / d.total) * 100) + '% sudah disetujui' : 'Belum ada disposisi';
            $('sBar').style.width = (d.total ? (d.disetujui / d.total) * 100 : 0) + '%';
            const sel = $('fTahun'), cur = sel.value;
            if (sel.options.length - 1 !== d.daftar_tahun.length) {
                sel.innerHTML = '<option value="">Semua tahun</option>' + d.daftar_tahun.map((t) => '<option value="' + t + '">' + t + '</option>').join('');
                sel.value = cur;
            }
            render();
        } catch (e) { $('tbody').innerHTML = '<tr class="empty-row"><td colspan="6">' + esc(e.message) + '</td></tr>'; }
    }

    function render() {
        if (!baris.length) { $('tbody').innerHTML = '<tr class="empty-row"><td colspan="6">Belum ada disposisi. Klik "Buat disposisi" untuk menyalurkan surat ke tujuannya.</td></tr>'; return; }
        $('tbody').innerHTML = baris.map((r) => {
            const ok = r.status === 'disetujui';
            const aksi = ['<button class="btn sm" data-lihat="' + r.id + '">Lihat</button>'];
            if (!ok) aksi.push('<button class="btn sm primary" data-setuju="' + r.id + '">Setujui</button>', '<button class="btn sm" data-ubah="' + r.id + '">Ubah</button>');
            else aksi.push('<button class="btn sm" data-batal="' + r.id + '">Batalkan persetujuan</button>');
            aksi.push('<button class="btn sm danger" data-hapus="' + r.id + '">Hapus</button>');
            const info = r.nomor_surat ? esc(r.kode_jenis) + ' · ' + esc(r.unit_kode) + ' · ' + (r.kode_tujuan === 'A' ? 'Internal' : 'Eksternal') : r.nomor_agenda ? 'Surat masuk' : '';
            return '<tr class="' + (ok ? 'row-ok' : 'row-bad') + '">' +
                '<td class="no-surat">' + esc(r.no_disposisi) + '<span class="sub">Tanggal ' + esc(tglIndo(r.tanggal_terima)) + '</span></td>' +
                '<td><span class="no-surat">' + esc(labelSurat(r)) + '</span><span class="sub" style="color:var(--text-main)">' + esc(r.hal) + '</span>' + (info ? '<span class="sub">' + info + '</span>' : '') + '</td>' +
                '<td><b>' + esc(r.tujuan_disposisi || '-') + '</b><span class="sub">Pemohon: ' + esc(r.pemohon) + '</span></td>' +
                '<td>' + csv(r.sifat).map((k) => '<span class="tag">' + esc(namaSifat(k)) + '</span>').join('') + '</td>' +
                '<td><span class="badge ' + (ok ? 'ok' : 'warn') + '">' + (ok ? 'Disetujui' : 'Belum disetujui') + '</span>' +
                    (ok ? '<span class="sub">' + esc(tglIndo(r.tanggal_setuju)) + ' · ' + esc(r.disetujui_oleh) + '</span>' : '') + '</td>' +
                '<td><div class="aksi" style="flex-wrap:wrap">' + aksi.join('') + '</div></td></tr>';
        }).join('');
    }

    document.querySelectorAll('#segStatus input').forEach((r) => r.addEventListener('change', () => { status = r.value; muat(); }));
    let tm; $('q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(muat, 300); });
    $('fTahun').addEventListener('change', muat); $('fBulan').addEventListener('change', muat);

    // ---------- Form disposisi ----------
    const dlg = $('dlgForm');
    $('fIsi').innerHTML = ISI.map((t, i) => '<label><input type="checkbox" value="' + (i + 1) + '"><span>' + (i + 1) + '. ' + esc(t) + '</span></label>').join('');

    function tambahBaris(r) {
        r = r || {};
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><input type="date" data-k="tanggal" value="' + esc(r.tanggal || '') + '"></td>' +
            '<td><input type="text" data-k="kepada" maxlength="100" value="' + esc(r.kepada || '') + '"></td>' +
            '<td><input type="text" data-k="isi_nomor" maxlength="40" placeholder="1,3" value="' + esc(r.isi_nomor || '') + '"></td>' +
            '<td><input type="text" data-k="dari" maxlength="100" value="' + esc(r.dari || '') + '"></td>' +
            '<td><input type="text" data-k="paraf" maxlength="40" value="' + esc(r.paraf || '') + '"></td>';
        $('alurBody').appendChild(tr);
    }
    $('btnBaris').addEventListener('click', () => tambahBaris());

    // Daftar surat yang belum punya disposisi: surat keluar (Penomoran) dan surat masuk
    async function muatSumber() {
        try { sumber = await api(API + '?aksi=sumber'); } catch (e) { sumber = { surat: [], surat_masuk: [] }; toast(e.message, true); }
        const k = sumber.surat.map((x) => '<option value="k:' + x.id + '">' + esc(x.nomor_surat + ' — ' + x.perihal) + '</option>').join('');
        const m = sumber.surat_masuk.map((x) => '<option value="m:' + x.id + '">' + esc(x.nomor_agenda + ' — ' + x.perihal + ' (' + x.pengirim + ')') + '</option>').join('');
        $('d_sumber').innerHTML = '<option value="">' + (k || m ? 'Pilih surat…' : 'Belum ada surat yang perlu disposisi') + '</option>' +
            (k ? '<optgroup label="Surat keluar (dari Penomoran)">' + k + '</optgroup>' : '') +
            (m ? '<optgroup label="Surat masuk">' + m + '</optgroup>' : '');
    }
    function infoSumber() {
        const v = $('d_sumber').value, box = $('sumberInfo');
        if (!v) { box.style.display = 'none'; return; }
        const [t, id] = v.split(':');
        if (t === 'k') {
            const s = sumber.surat.find((x) => String(x.id) === id); if (!s) { box.style.display = 'none'; return; }
            box.innerHTML = '<b>Surat keluar</b> · <span class="mono">' + esc(s.nomor_surat) + '</span><br>' + esc(s.perihal) + '<br>' +
                esc(s.jenis_kode) + ' · ' + esc(s.unit_kode) + ' · ' + (s.kode_tujuan === 'A' ? 'Internal' : 'Eksternal') + ' · untuk ' + esc(s.untuk);
            $('d_hal').value = s.perihal; $('d_pemohon').value = s.pembuat_surat || '';
        } else {
            const s = sumber.surat_masuk.find((x) => String(x.id) === id); if (!s) { box.style.display = 'none'; return; }
            box.innerHTML = '<b>Surat masuk</b> · <span class="mono">' + esc(s.nomor_agenda) + '</span><br>' + esc(s.perihal) + '<br>Dari ' + esc(s.pengirim) +
                (s.tujuan ? ' · ditujukan kepada ' + esc(s.tujuan) : '');
            $('d_hal').value = s.perihal; $('d_pemohon').value = s.pengirim || '';
            const sf = csv(s.sifat); if (sf.length) document.querySelectorAll('#fSifat input').forEach((c) => { c.checked = sf.includes(c.value); });
        }
        box.style.display = '';
    }
    $('d_sumber').addEventListener('change', infoSumber);

    function isiForm(r) {
        r = r || {};
        const sf = csv(r.sifat), isi = csv(r.isi);
        document.querySelectorAll('#fSifat input').forEach((c) => { c.checked = sf.includes(c.value); });
        document.querySelectorAll('#fIsi input').forEach((c) => { c.checked = isi.includes(c.value); });
        $('d_tanggal').value = r.tanggal_terima || hariIni();
        $('d_hal').value = r.hal || ''; $('d_pemohon').value = r.pemohon || ''; $('d_tujuan').value = r.tujuan_disposisi || '';
        $('alurBody').innerHTML = '';
        const alur = r.alur && r.alur.length ? r.alur : [];
        alur.forEach(tambahBaris);
        for (let i = alur.length; i < KOLOM_ALUR; i++) tambahBaris();
    }

    async function bukaBaru(pilih) {
        editId = null; $('dlgJudul').textContent = 'Buat disposisi';
        await muatSumber();
        isiForm(); $('d_sumber').disabled = false; $('sumberInfo').style.display = 'none';
        if (pilih) { $('d_sumber').value = pilih; infoSumber(); }
        dlg.showModal(); dlg.scrollTop = 0;
    }
    $('btnBaru').addEventListener('click', () => bukaBaru());
    $('dlgBatal').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

    $('dspForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const sifat = [...document.querySelectorAll('#fSifat input:checked')].map((c) => c.value);
        const isi = [...document.querySelectorAll('#fIsi input:checked')].map((c) => +c.value);
        const src = $('d_sumber').value;
        const salah = (!editId && !src) ? 'Pilih surat yang akan disalurkan.' : !$('d_tujuan').value.trim() ? 'Isi tujuan penyaluran (misalnya Rektor).'
            : !$('d_tanggal').value ? 'Isi tanggal disposisi.' : !$('d_pemohon').value.trim() ? 'Isi nama pemohon.' : !sifat.length ? 'Pilih sifat disposisi.'
            : !$('d_hal').value.trim() ? 'Isi hal (perihal).' : !isi.length ? 'Pilih minimal satu butir isi disposisi.' : '';
        if (salah) { toast(salah, true); return; }
        const alur = [...$('alurBody').querySelectorAll('tr')].map((tr) => {
            const o = {}; tr.querySelectorAll('input').forEach((i) => { o[i.dataset.k] = i.value; }); return o;
        });
        const data = { aksi: editId ? 'ubah' : 'tambah', id: editId, tanggal_terima: $('d_tanggal').value, sifat, hal: $('d_hal').value,
            pemohon: $('d_pemohon').value, tujuan_disposisi: $('d_tujuan').value, isi, alur };
        if (!editId) { const [t, id] = src.split(':'); if (t === 'k') data.surat_id = +id; else data.surat_masuk_id = +id; }
        const btn = $('dlgSimpan'); btn.disabled = true;
        try {
            const d = await api(API, data);
            dlg.close();
            toast(editId ? 'Disposisi ' + d.no_disposisi + ' diperbarui' : 'Disposisi ' + d.no_disposisi + ' tersimpan (belum disetujui)');
            muat();
        } catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });

    // ---------- Aksi pada tabel ----------
    $('tbody').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        const id = +(b.dataset.lihat || b.dataset.ubah || b.dataset.setuju || b.dataset.batal || b.dataset.hapus);
        const r = baris.find((x) => +x.id === id); if (!r) return;
        try {
            if (b.dataset.lihat) { lihat((await api(API + '?aksi=detail&id=' + id)).disposisi); }
            else if (b.dataset.ubah) {
                const d = (await api(API + '?aksi=detail&id=' + id)).disposisi;
                editId = id; $('dlgJudul').textContent = 'Ubah disposisi ' + d.no_disposisi;
                $('d_sumber').innerHTML = '<option value="x">' + esc(labelSurat(d) + ' — ' + d.hal) + '</option>'; $('d_sumber').value = 'x'; $('d_sumber').disabled = true;
                $('sumberInfo').style.display = 'none';
                isiForm(d); dlg.showModal(); dlg.scrollTop = 0;
            } else if (b.dataset.setuju) {
                if (!confirm('Setujui disposisi ' + r.no_disposisi + ' (disalurkan kepada ' + (r.tujuan_disposisi || '-') + ')?\n\nSetelah disetujui, statusnya hijau dan disposisi tidak bisa diubah lagi.')) return;
                await api(API, { aksi: 'setujui', id, oleh: namaUser() }); toast('Disposisi ' + r.no_disposisi + ' disetujui'); muat();
            } else if (b.dataset.batal) {
                if (!confirm('Batalkan persetujuan disposisi ' + r.no_disposisi + '? Statusnya kembali merah.')) return;
                await api(API, { aksi: 'batal_setuju', id }); toast('Persetujuan dibatalkan'); muat();
            } else if (b.dataset.hapus) {
                if (!confirm('Hapus disposisi ' + r.no_disposisi + '? Suratnya tidak ikut terhapus.')) return;
                await api(API, { aksi: 'hapus', id }); toast('Disposisi dihapus'); muat();
            }
        } catch (e) { toast(e.message, true); }
    });

    // ---------- Lembar disposisi (pratinjau & cetak) ----------
    function lembarHTML(d) {
        const sf = csv(d.sifat), isi = csv(d.isi);
        const cb = (on) => '<span class="cb">' + (on ? '✓' : '') + '</span>';
        const kolom = [0, 1, 2].map((c) => '<td>' + [0, 1, 2, 3].map((r) => { const n = c * 4 + r + 1; return '<div>' + cb(isi.includes(String(n))) + n + '. ' + esc(ISI[n - 1]) + '</div>'; }).join('') + '</td>').join('');
        const alur = (d.alur || []).slice(0, BARIS_CETAK);
        let baris = alur.map((r) => '<tr><td>' + (r.tanggal ? esc(tglIndo(r.tanggal)) : '') + '</td><td>' + esc(r.kepada) + '</td><td>' + esc(r.isi_nomor) + '</td><td>' + esc(r.dari) + '</td><td>' + esc(r.paraf) + '</td></tr>').join('');
        for (let i = alur.length; i < BARIS_CETAK; i++) baris += '<tr class="kosong"><td></td><td></td><td></td><td></td><td></td></tr>';
        const logo = new URL('logo-tsu.png', location.href).href;
        const ok = d.status === 'disetujui';
        const kode = d.kode_jenis ? ' &nbsp;(' + esc(d.kode_jenis) + ')' : '';
        return '<style>.lembar{background:#fff;color:#111;font:13px/1.35 Arial,Helvetica,sans-serif;padding:22px 26px;max-width:800px;margin:0 auto;border:1px solid #ccc;box-sizing:border-box}' +
            '.lembar *{box-sizing:border-box}.lembar .top{display:flex;align-items:center;gap:14px;margin-bottom:8px}.lembar .top img{height:38px;background:#0b0b0c;border-radius:4px;padding:3px}' +
            '.lembar h1{flex:1;text-align:center;font-size:20px;margin:0 52px 0 0}.lembar .sifat{display:flex;justify-content:center;gap:34px;padding:10px 0;border-bottom:2px solid #111;margin-bottom:12px}' +
            '.lembar .cb{display:inline-block;width:20px;height:14px;border:1.5px solid #111;border-radius:4px;vertical-align:middle;margin-right:7px;text-align:center;font-size:12px;line-height:12px;font-weight:700}' +
            '.lembar .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:12px}.lembar .meta b{display:inline-block;min-width:112px;font-weight:600}' +
            '.lembar h2{font-size:12px;text-align:right;margin:10px 0 3px;letter-spacing:.02em}.lembar table{width:100%;border-collapse:collapse}' +
            '.lembar td,.lembar th{border:1px solid #111;padding:4px 7px;font-size:12px;vertical-align:top;color:#111;background:#fff}.lembar th{text-align:center}' +
            '.lembar .isi td div{padding:2px 0}.lembar .kosong td{height:25px}.lembar .cap{margin-top:12px;font-weight:700;font-size:13px;color:' + (ok ? '#047857' : '#b91c1c') + '}' +
            '@page{size:A4;margin:12mm}</style>' +
            '<div class="lembar"><div class="top"><img src="' + esc(logo) + '" alt="TSU"><h1>LEMBAR DISPOSISI</h1></div>' +
            '<div class="sifat">' + SIFAT.map(([k, t]) => '<span>' + cb(sf.includes(k)) + t + '</span>').join('') + '</div>' +
            '<div class="meta"><div><b>Tanggal</b>: ' + esc(tglIndo(d.tanggal_terima)) + '</div><div><b>No. Disposisi</b>: ' + esc(d.no_disposisi) + '</div>' +
            '<div><b>Surat</b>: ' + esc(labelSurat(d)) + '</div><div><b>Disalurkan kepada</b>: ' + esc(d.tujuan_disposisi || '-') + '</div>' +
            '<div style="grid-column:1/-1"><b>Hal (code)</b>: ' + esc(d.hal) + kode + '</div>' +
            '<div><b>Pemohon</b>: ' + esc(d.pemohon) + '</div>' + (d.unit_nama ? '<div><b>Unit</b>: ' + esc(d.unit_nama) + '</div>' : '') + '</div>' +
            '<h2>ISI DISPOSISI</h2><table class="isi"><tr>' + kolom + '</tr></table>' +
            '<h2>ALUR DISPOSISI</h2><table><thead><tr><th>TANGGAL</th><th>KEPADA</th><th>NOMOR ISI DISPOSISI</th><th>DARI</th><th>PARAF</th></tr></thead><tbody>' + baris + '</tbody></table>' +
            '<div class="cap">' + (ok ? 'DISETUJUI oleh ' + esc(d.disetujui_oleh) + ' pada ' + esc(tglIndo(d.tanggal_setuju)) : 'BELUM DISETUJUI') + '</div></div>';
    }
    let sedangDilihat = null;
    function lihat(d) { sedangDilihat = d; $('lembarBox').innerHTML = '<div style="overflow-x:auto">' + lembarHTML(d) + '</div>'; $('dlgLihat').showModal(); $('dlgLihat').scrollTop = 0; }
    $('lihatTutup').addEventListener('click', () => $('dlgLihat').close());
    $('dlgLihat').addEventListener('click', (e) => { if (e.target === $('dlgLihat')) $('dlgLihat').close(); });
    $('lihatCetak').addEventListener('click', () => {
        const w = window.open('', '_blank');
        if (!w) { toast('Pop-up diblokir. Izinkan pop-up untuk mencetak.', true); return; }
        w.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Lembar Disposisi ' + esc(sedangDilihat.no_disposisi) +
            '</title></head><body style="margin:0;background:#fff">' + lembarHTML(sedangDilihat) +
            '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
        w.document.close();
    });

    // ---------- Mulai ----------
    (function mulai() {
        $('fBulan').innerHTML = '<option value="">Semua bulan</option>' + BULAN.map((b, i) => '<option value="' + (i + 1) + '">' + b + '</option>').join('');
        muat();
        // Dibuka dari Penomoran, Surat Keluar, atau Surat Masuk ("Buat disposisi"): surat langsung terpilih
        const p = new URLSearchParams(location.search);
        if (p.get('surat')) bukaBaru('k:' + +p.get('surat'));
        else if (p.get('surat_masuk')) bukaBaru('m:' + +p.get('surat_masuk'));
    })();
})();
