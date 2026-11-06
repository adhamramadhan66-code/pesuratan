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
            await muatSumber();
            $('sTotal').textContent = d.total; $('sSetuju').textContent = d.disetujui; $('sBelum').textContent = d.total - d.disetujui;
            $('sPersen').textContent = d.total ? Math.round((d.disetujui / d.total) * 100) + '% sudah disetujui' : 'Belum ada disposisi';
            $('sBar').style.width = (d.total ? (d.disetujui / d.total) * 100 : 0) + '%';
            const sel = $('fTahun'), cur = sel.value;
            if (sel.options.length - 1 !== d.daftar_tahun.length) {
                sel.innerHTML = '<option value="">Semua tahun</option>' + d.daftar_tahun.map((t) => '<option value="' + t + '">' + t + '</option>').join('');
                sel.value = cur;
            }
            render();
        } catch (e) { $('galeri').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>'; }
    }

    // Kartu surat bernomor yang filenya belum diunggah (menggantikan kartu +): klik untuk mengunggah
    function kartuBelumUnggah(t, s) {
        const kode = t + ':' + s.id;
        const judul = t === 'k' ? s.nomor_surat : 'Surat masuk ' + s.nomor_agenda;
        return App.kartuHtml({
            kelas: 'abu', judulTeks: judul, judul: esc(judul),
            thumb: '<button type="button" class="kartu-thumb" data-unggah-pilih="' + kode + '" title="Unggah file surat">' + App.thumb('', '') + '</button>',
            sub: [esc(s.perihal), (t === 'k' ? 'Surat keluar' : 'Dari ' + esc(s.pengirim))],
            status: '<span class="badge">Belum diunggah</span>',
            aksi: '<button class="btn sm primary" data-unggah-pilih="' + kode + '">Unggah file</button>',
        });
    }

    function kartu(r) {
        const ok = r.status === 'disetujui';
        const url = API + '?aksi=file&id=' + r.id;
        // Pratinjau: klik membuka file. Tanpa file dan belum di-ACC: klik membuka dialog unggah.
        const thumb = (r.file_nama || ok)
            ? App.thumbFile(url, r.file_nama, !!r.file_nama)
            : '<button type="button" class="kartu-thumb" data-unggah-ke="' + r.id + '" title="Unggah file surat">' + App.thumb('', '') + '</button>';
        const aksi = [];
        if (!ok) aksi.push('<button class="btn sm primary" data-setuju="' + r.id + '">ACC</button>', '<button class="btn sm" data-ubah="' + r.id + '">Ubah</button>');
        else aksi.push('<button class="btn sm" data-batal="' + r.id + '">Batalkan ACC</button>');
        aksi.push('<button class="btn sm danger" data-hapus="' + r.id + '">Hapus</button>');
        const sf = csv(r.sifat).map((k) => namaSifat(k)).join(', ');
        return App.kartuHtml({
            kelas: ok ? 'ok' : 'bad', judulTeks: labelSurat(r), judul: esc(labelSurat(r)), thumb,
            sub: [esc(r.hal), (r.tujuan_disposisi ? 'Kepada: ' + esc(r.tujuan_disposisi) : 'Belum ada tujuan') + (sf ? ' · ' + esc(sf) : '')],
            status: '<span class="badge ' + (ok ? 'ok' : 'warn') + '">' + (ok ? 'Disetujui' : 'Belum disetujui') + '</span><span>' + esc(ok ? tglIndo(r.tanggal_setuju) : r.no_disposisi) + '</span>',
            aksi: aksi.join(''),
        });
    }

    function render() {
        // Surat bernomor yang belum diunggah ikut tampil (kecuali saat memfilter "Disetujui" atau mencari kata lain)
        const q = $('q').value.trim().toLowerCase();
        const cocok = (s) => !q || ((s.nomor_surat || s.nomor_agenda || '') + ' ' + s.perihal).toLowerCase().includes(q);
        const pending = status === 'disetujui' ? [] :
            sumber.surat.filter(cocok).map((s) => kartuBelumUnggah('k', s)).concat(sumber.surat_masuk.filter(cocok).map((s) => kartuBelumUnggah('m', s)));
        const semua = pending.concat(baris.map(kartu));
        $('galeri').innerHTML = semua.length ? semua.join('') : '<p class="galeri-kosong">Belum ada surat. Buat nomor surat di menu Penomoran, lalu unggah filenya di sini.</p>';
    }

    document.querySelectorAll('#segStatus input').forEach((r) => r.addEventListener('change', () => { status = r.value; muat(); }));
    let tm; $('q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(muat, 300); });
    $('fTahun').addEventListener('change', muat); $('fBulan').addEventListener('change', muat);

    // ---------- Form disposisi ----------
    const dlg = $('dlgForm');


    // ---------- Unggah file surat (kartu +) ----------
    const dlgU = $('dlgUnggah');
    let tetapSurat = null;      // bila diisi: dialog dipakai menambah/mengganti file pada disposisi yang sudah ada

    // Daftar surat yang belum punya disposisi: surat keluar (Penomoran) dan surat masuk
    async function muatSumber() {
        try { sumber = await api(API + '?aksi=sumber'); } catch (e) { sumber = { surat: [], surat_masuk: [] }; toast(e.message, true); }
        const k = sumber.surat.map((x) => '<option value="k:' + x.id + '">' + esc(x.nomor_surat + ' — ' + x.perihal) + '</option>').join('');
        const m = sumber.surat_masuk.map((x) => '<option value="m:' + x.id + '">' + esc(x.nomor_agenda + ' — ' + x.perihal + ' (' + x.pengirim + ')') + '</option>').join('');
        $('u_sumber').innerHTML = '<option value="">' + (k || m ? 'Pilih surat…' : 'Belum ada surat bernomor yang perlu diunggah') + '</option>' +
            (k ? '<optgroup label="Surat keluar (dari Penomoran)">' + k + '</optgroup>' : '') +
            (m ? '<optgroup label="Surat masuk">' + m + '</optgroup>' : '');
    }
    function infoUnggah() {
        const v = $('u_sumber').value, box = $('u_info');
        if (!v || tetapSurat) { box.style.display = 'none'; return; }
        const [t, id] = v.split(':');
        const s = (t === 'k' ? sumber.surat : sumber.surat_masuk).find((x) => String(x.id) === id);
        if (!s) { box.style.display = 'none'; return; }
        box.innerHTML = t === 'k'
            ? '<b>Surat keluar</b> · <span class="mono">' + esc(s.nomor_surat) + '</span><br>' + esc(s.perihal) + '<br>' +
              esc(s.jenis_kode) + ' · ' + esc(s.unit_kode) + ' · ' + (s.kode_tujuan === 'A' ? 'Internal' : 'Eksternal')
            : '<b>Surat masuk</b> · <span class="mono">' + esc(s.nomor_agenda) + '</span><br>' + esc(s.perihal) + '<br>Dari ' + esc(s.pengirim);
        box.style.display = '';
    }
    $('u_sumber').addEventListener('change', infoUnggah);

    // pilih: 'k:ID' (surat keluar) / 'm:ID' (surat masuk) agar langsung terpilih; ganti: disposisi yang filenya ditambah/diganti
    async function bukaUnggah(pilih, ganti) {
        tetapSurat = null; $('u_file').value = ''; $('u_info').style.display = 'none';
        if (ganti) {
            tetapSurat = ganti.surat_id ? 'k:' + ganti.surat_id : 'm:' + ganti.surat_masuk_id;
            $('u_sumber').innerHTML = '<option value="' + tetapSurat + '">' + esc(labelSurat(ganti) + ' — ' + ganti.hal) + '</option>';
            $('u_sumber').disabled = true;
            $('uJudul').textContent = ganti.file_nama ? 'Ganti file surat' : 'Unggah file surat';
        } else {
            $('u_sumber').disabled = false; $('uJudul').textContent = 'Unggah surat';
            await muatSumber();
            if (pilih) { $('u_sumber').value = pilih; infoUnggah(); }
        }
        dlgU.showModal(); dlgU.scrollTop = 0;
    }
    $('uBatal').addEventListener('click', () => dlgU.close());
    dlgU.addEventListener('click', (e) => { if (e.target === dlgU) dlgU.close(); });

    $('unggahForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = $('u_sumber').value, file = $('u_file').files[0];
        const salah = !v ? 'Pilih surat yang akan diunggah.' : !file ? 'Pilih file surat (PDF, JPG, atau PNG).' : App.cekFile(file);
        if (salah) { toast(salah, true); return; }
        const [t, id] = v.split(':');
        const fd = new FormData();
        fd.append('aksi', 'unggah'); fd.append(t === 'k' ? 'surat_id' : 'surat_masuk_id', id); fd.append('file', file);
        const btn = $('uSimpan'); btn.disabled = true;
        try {
            const d = await api(API, fd);
            dlgU.close();
            toast(d.baru ? 'Surat diunggah. Disposisi ' + d.no_disposisi + ' menunggu ACC.' : 'File surat disimpan.');
            muat();
        } catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });

    function isiForm(r) {
        r = r || {};
        const sf = csv(r.sifat), isi = csv(r.isi);
        document.querySelectorAll('#fSifat input').forEach((c) => { c.checked = sf.includes(c.value); });
        $('d_tanggal').value = r.tanggal_terima || hariIni();
        $('d_hal').value = r.hal || ''; $('d_pemohon').value = r.pemohon || ''; $('d_tujuan').value = r.tujuan_disposisi || '';
    }

    // Lembar disposisi hanya diubah (dibuat otomatis saat file surat diunggah)
    async function bukaUbah(id) {
        const d = (await api(API + '?aksi=detail&id=' + id)).disposisi;
        editId = id; $('dlgJudul').textContent = 'Ubah disposisi ' + d.no_disposisi;
        $('d_sumber').innerHTML = '<option value="x">' + esc(labelSurat(d) + ' — ' + d.hal) + '</option>'; $('d_sumber').value = 'x';
        isiForm(d); dlg.showModal(); dlg.scrollTop = 0;
    }
    $('dlgBatal').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

    $('dspForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const sifat = [...document.querySelectorAll('#fSifat input:checked')].map((c) => c.value);
        const salah = !$('d_tujuan').value.trim() ? 'Isi tujuan penyaluran (misalnya Rektor).'
            : !$('d_tanggal').value ? 'Isi tanggal disposisi.' : !$('d_pemohon').value.trim() ? 'Isi nama pemohon.' : !sifat.length ? 'Pilih sifat disposisi.'
            : !$('d_hal').value.trim() ? 'Isi hal (perihal).' : '';
        if (salah) { toast(salah, true); return; }
        const data = { aksi: 'ubah', id: editId, tanggal_terima: $('d_tanggal').value, sifat, hal: $('d_hal').value,
            pemohon: $('d_pemohon').value, tujuan_disposisi: $('d_tujuan').value };
        const btn = $('dlgSimpan'); btn.disabled = true;
        try {
            const d = await api(API, data);
            dlg.close();
            toast('Disposisi ' + d.no_disposisi + ' diperbarui');
            muat();
        } catch (e) { toast(e.message, true); }
        finally { btn.disabled = false; }
    });

    // ---------- Aksi pada tabel ----------
    $('galeri').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.unggahPilih) { bukaUnggah(b.dataset.unggahPilih); return; }
        const id = +(b.dataset.unggahKe || b.dataset.ubah || b.dataset.setuju || b.dataset.batal || b.dataset.hapus);
        const r = baris.find((x) => +x.id === id); if (!r) return;
        try {
            if (b.dataset.unggahKe) bukaUnggah(null, r);
            else if (b.dataset.ubah) await bukaUbah(id);
            else if (b.dataset.setuju) {
                if (!r.tujuan_disposisi) { toast('Isi dulu "Disalurkan kepada" sebelum meng-ACC.', true); await bukaUbah(id); return; }
                if (!confirm('ACC disposisi ' + r.no_disposisi + ' (disalurkan kepada ' + r.tujuan_disposisi + ')?\n\n' +
                    'Surat akan tercatat di Surat Keluar' + (r.surat_id && r.kode_tujuan === 'A' ? ' dan, karena internal, otomatis di Surat Masuk penerimanya' : '') +
                    '. Disposisi tidak bisa diubah lagi sampai ACC dibatalkan.')) return;
                const d = await api(API, { aksi: 'setujui', id, oleh: namaUser() });
                toast('Disposisi ' + r.no_disposisi + ' di-ACC' + (r.surat_id ? '. Tercatat di Surat Keluar' + (d.surat_masuk ? ' dan Surat Masuk (agenda ' + d.surat_masuk + ')' : '') : '') + '.');
                muat();
            } else if (b.dataset.batal) {
                if (!confirm('Batalkan ACC disposisi ' + r.no_disposisi + '? Statusnya kembali merah' + (r.surat_id ? ' dan surat keluar dari daftar Surat Keluar' : '') + '.')) return;
                const d = await api(API, { aksi: 'batal_setuju', id });
                toast('ACC dibatalkan' + (d.surat_masuk_dihapus === true ? '; Surat Masuk otomatisnya ikut dihapus' :
                    d.surat_masuk_dihapus === false ? '; Surat Masuk otomatisnya dipertahankan karena sudah diproses/diarsipkan' : '') + '.');
                muat();
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
        // Dibuka dari Penomoran ("Unggah surat"): dialog unggah langsung terbuka dengan surat terpilih.
        const p = new URLSearchParams(location.search);
        const pilih = p.get('unggah') || (p.get('surat') ? 'k:' + +p.get('surat') : p.get('surat_masuk') ? 'm:' + +p.get('surat_masuk') : '');
        if (/^[km]:\d+$/.test(pilih)) bukaUnggah(pilih);
    })();
})();
