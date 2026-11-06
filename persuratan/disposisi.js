/* Disposisi (surat masuk): Pimpinan membuat disposisi ke staf -> Staf menyelesaikan tugas. */
(function () {
    'use strict';
    const { $, esc, tglIndo, api, toast, peran } = App;
    const SM = 'api/surat_masuk.php', DS = 'api/disposisi.php';
    let data = [], mode = '', aktif = null, mulaiMemuat = 0;

    // Tab filter per peran. "perlu" = surat masuk yang belum didisposisikan (hanya pimpinan).
    const TAB = App.bisa('pimpinan')
        ? [['perlu', 'Perlu disposisi'], ['proses_staf', 'Proses staf'], ['selesai', 'Selesai'], ['', 'Semua disposisi']]
        : [['', 'Semua'], ['proses_staf', 'Proses staf'], ['selesai', 'Selesai']];
    mode = TAB[0][0];
    $('segStatus').innerHTML = TAB.map((t, i) => '<label><input type="radio" name="st" value="' + t[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + t[1] + '</span></label>').join('');
    if (!App.bisa('pimpinan')) { $('sJudul1').textContent = 'Total disposisi'; }
    $('alurInfo').innerHTML = {
        pimpinan: 'Tab <b>Perlu disposisi</b> berisi surat masuk <span class="chip bad">diterima</span>. Tekan <b>Disposisi</b> untuk meneruskannya ke staf <span class="chip bad">proses staf</span>.',
        staf: 'Disposisi yang ditujukan kepada Anda. Setelah dikerjakan, tekan <b>Selesai</b> <span class="chip ok">selesai</span>.',
        admin: ''
    }[peran] || '';

    async function muat() {
        const my = ++mulaiMemuat, q = encodeURIComponent($('q').value.trim());
        try {
            let rows;
            if (mode === 'perlu') rows = (await api(SM + '?aksi=daftar&status=diterima&q=' + q)).data;
            else rows = (await api(DS + '?aksi=daftar&status=' + mode + '&q=' + q)).data;
            if (my !== mulaiMemuat) return;
            data = rows; gambar();
            const s = await api('api/statistik.php');
            if (App.bisa('pimpinan')) $('sPerlu').textContent = s.masuk.diterima;
            else $('sPerlu').textContent = s.masuk.proses_staf + s.masuk.selesai;
            $('sProses').textContent = s.masuk.proses_staf; $('sSelesai').textContent = s.masuk.selesai;
        } catch (e) { toast(e.message, true); $('galeri').innerHTML = '<p class="galeri-kosong">' + esc(e.message) + '</p>'; }
    }

    function gambar() {
        if (mode === 'perlu') {
            $('galeri').innerHTML = data.length ? data.map((r) => App.kartuHtml({
                kelas: 'bad', judulTeks: r.nomor_agenda, judul: esc(r.nomor_agenda),
                thumb: App.thumbFile(SM + '?aksi=file&id=' + r.id, r.ada_file ? 'x.' + r.file_tipe : '', r.ada_file),
                sub: [esc(r.perihal), 'Dari: ' + esc(r.pengirim), esc(tglIndo(r.tanggal_terima)) + (r.sifat !== 'biasa' ? ' · ' + esc(r.sifat) : '')],
                status: '<span class="badge warn">Belum didisposisikan</span>',
                aksi: '<button type="button" class="btn sm primary" data-a="buat" data-id="' + r.id + '">Disposisi</button>',
            })).join('') : '<p class="galeri-kosong">Tidak ada surat masuk yang menunggu disposisi.</p>';
            return;
        }
        $('galeri').innerHTML = data.length ? data.map((r) => {
            const s = r.surat, selesai = r.status === 'selesai';
            return App.kartuHtml({
                kelas: selesai ? 'ok' : 'bad', judulTeks: s.nomor_agenda, judul: esc(s.nomor_agenda),
                thumb: App.thumbFile(SM + '?aksi=file&id=' + s.id, s.ada_file ? 'x.' + s.file_tipe : '', s.ada_file),
                sub: [esc(s.perihal), 'Untuk: ' + esc(r.staf) + ' · dari ' + esc(r.pimpinan),
                      '“' + esc(r.instruksi) + '”' + (r.batas_waktu ? ' · batas ' + esc(tglIndo(r.batas_waktu)) : '') + (selesai && r.catatan_selesai ? ' · Catatan: ' + esc(r.catatan_selesai) : '')],
                status: '<span class="badge ' + (selesai ? 'ok' : 'warn') + '">' + (selesai ? 'Selesai ' + esc(tglIndo(r.tanggal_selesai)) : 'Proses staf') + '</span>',
                aksi: App.bisa('staf') && !selesai ? '<button type="button" class="btn sm primary" data-a="selesai" data-id="' + r.id + '">Selesai</button>' : '',
            });
        }).join('') : '<p class="galeri-kosong">Belum ada disposisi pada filter ini.</p>';
    }

    // ---------- Buat disposisi (pimpinan) ----------
    async function bukaDisposisi(r) {
        aktif = r;
        try {
            const st = await api(DS + '?aksi=staf');
            $('d_staf').innerHTML = st.data.map((x) => '<option value="' + x.id + '">' + esc(x.nama) + '</option>').join('');
        } catch (e) { return toast(e.message, true); }
        $('dInfo').innerHTML = '<b class="mono">' + esc(r.nomor_agenda) + '</b><br>' + esc(r.perihal);
        $('d_instruksi').value = ''; $('d_batas').value = '';
        $('dlgDisp').showModal();
    }
    $('dBatal').addEventListener('click', () => $('dlgDisp').close());
    $('dispForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!$('d_instruksi').value.trim()) return toast('Isi instruksi disposisi.', true);
        $('dSimpan').disabled = true;
        try {
            await api(DS, { aksi: 'buat', surat_masuk_id: aktif.id, staf_id: +$('d_staf').value, instruksi: $('d_instruksi').value, batas_waktu: $('d_batas').value });
            $('dlgDisp').close(); toast('Disposisi terkirim ke staf.');
        } catch (e) { toast(e.message, true); }
        $('dSimpan').disabled = false;
        muat();
    });

    // ---------- Selesaikan (staf) ----------
    $('sBatal').addEventListener('click', () => $('dlgSelesai').close());
    $('selesaiForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        $('sSimpan').disabled = true;
        try {
            await api(DS, { aksi: 'selesai', id: aktif.id, catatan: $('s_catatan').value });
            $('dlgSelesai').close(); toast('Tugas ditandai selesai.');
        } catch (e) { toast(e.message, true); }
        $('sSimpan').disabled = false;
        muat();
    });

    $('galeri').addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-a]');
        if (!b) return;
        const r = data.find((x) => x.id === +b.dataset.id);
        if (!r) return;
        if (b.dataset.a === 'buat') bukaDisposisi(r);
        else { aktif = r; $('sInfo').innerHTML = '<b class="mono">' + esc(r.surat.nomor_agenda) + '</b><br>' + esc(r.surat.perihal) + '<br>Instruksi: ' + esc(r.instruksi); $('s_catatan').value = ''; $('dlgSelesai').showModal(); }
    });
    $('segStatus').addEventListener('change', () => { mode = document.querySelector('#segStatus input:checked').value; muat(); });
    let t; $('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(muat, 250); });

    // Dari Surat Masuk: ?surat=ID langsung membuka form disposisi.
    (async function awal() {
        await muat();
        const id = +new URLSearchParams(location.search).get('surat');
        if (id && App.bisa('pimpinan')) {
            try {
                const r = (await api(SM + '?aksi=daftar&status=diterima')).data.find((x) => x.id === id);
                if (r) bukaDisposisi(r); else toast('Surat itu sudah didisposisikan.', true);
            } catch (e) { toast(e.message, true); }
        }
    })();
})();
