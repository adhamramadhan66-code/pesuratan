/* Kalender dashboard = pengendali rentang waktu untuk kotak Jenis surat dan grafik.
   Tab Hari | Bulan | Tahun menentukan apa yang dipilih; isi kalender menyesuaikan:
     Hari  -> kalender tanggal      (panah: pindah bulan)
     Bulan -> 12 kotak bulan        (panah: pindah tahun)
     Tahun -> daftar 12 tahun       (panah: pindah 12 tahun)
   Memberi tahu halaman lewat event "rentang" {dari, sampai, mode, label}. */
(function () {
    const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const BLN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const $ = (id) => document.getElementById(id);

    const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let today = dayStart(new Date());
    let anchor = new Date(today);          // tanggal acuan pilihan
    let mode = 'month';                    // day | month | year
    let vy = anchor.getFullYear(), vm = anchor.getMonth();   // tahun/bulan yang sedang ditampilkan
    let blokTahun = 0;                     // awal blok 12 tahun pada mode Tahun

    const same = (a, b) => a.getTime() === b.getTime();
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const awalBlok = (y) => y - ((y - 2000) % 12 + 12) % 12;

    function getRange() {
        const y = anchor.getFullYear(), m = anchor.getMonth();
        if (mode === 'day')  return [new Date(anchor), new Date(anchor)];
        if (mode === 'year') return [new Date(y, 0, 1), new Date(y, 11, 31)];
        return [new Date(y, m, 1), new Date(y, m + 1, 0)];
    }
    function label() {
        const d = anchor.getDate(), m = anchor.getMonth(), y = anchor.getFullYear();
        if (mode === 'day') return d + ' ' + BULAN[m] + ' ' + y;
        if (mode === 'year') return 'Tahun ' + y;
        return BULAN[m] + ' ' + y;
    }

    function kotak(teks, { aktif, ini, klik }) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = teks;
        if (ini) b.classList.add('today');
        if (aktif) { b.classList.add('selected'); b.setAttribute('aria-current', 'true'); }
        b.addEventListener('click', klik);
        return b;
    }

    function gambarKalender() {
        const box = $('miniDates');
        box.textContent = '';
        box.className = 'mini-dates mode-' + mode;
        $('miniDays').style.display = mode === 'day' ? '' : 'none';

        if (mode === 'day') {
            $('calTitle').textContent = BULAN[vm] + ' ' + vy;
            const first = new Date(vy, vm, 1), total = new Date(vy, vm + 1, 0).getDate();
            for (let i = 0; i < first.getDay(); i++) { const e = document.createElement('span'); e.className = 'empty'; box.appendChild(e); }
            for (let n = 1; n <= total; n++) {
                const date = new Date(vy, vm, n);
                box.appendChild(kotak(n, { aktif: same(date, anchor), ini: same(date, today), klik: () => { anchor = date; renderAll(); } }));
            }
        } else if (mode === 'month') {
            $('calTitle').textContent = String(vy);
            BULAN.forEach((nama, i) => box.appendChild(kotak(BLN[i], {
                aktif: anchor.getFullYear() === vy && anchor.getMonth() === i,
                ini: today.getFullYear() === vy && today.getMonth() === i,
                klik: () => { anchor = new Date(vy, i, 1); renderAll(); },
            })));
        } else {
            $('calTitle').textContent = blokTahun + ' – ' + (blokTahun + 11);
            for (let y = blokTahun; y < blokTahun + 12; y++) box.appendChild(kotak(y, {
                aktif: anchor.getFullYear() === y, ini: today.getFullYear() === y,
                klik: () => { anchor = new Date(y, 0, 1); renderAll(); },
            }));
        }
        $('calInfo').innerHTML = 'Menampilkan: <b>' + label() + '</b>';
    }

    function renderAll() {
        gambarKalender();
        const [rs, re] = getRange();
        document.dispatchEvent(new CustomEvent('rentang', { detail: { dari: iso(rs), sampai: iso(re), mode, label: label() } }));
    }

    // tab Hari | Bulan | Tahun
    document.querySelectorAll('#calTab input').forEach((r) => r.addEventListener('change', () => {
        const dulu = mode;
        mode = r.value;
        if (mode === 'day' && dulu !== 'day') {
            // pindah ke Hari: hari ini bila masih dalam bulan/tahun terpilih, kalau tidak tanggal 1
            const sama = today.getFullYear() === anchor.getFullYear() && (dulu === 'year' || today.getMonth() === anchor.getMonth());
            anchor = sama ? new Date(today) : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        } else if (mode === 'month') anchor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        else if (mode === 'year') anchor = new Date(anchor.getFullYear(), 0, 1);
        vy = anchor.getFullYear(); vm = anchor.getMonth(); blokTahun = awalBlok(vy);
        renderAll();
    }));

    function geser(delta) {
        if (mode === 'day') { const d = new Date(vy, vm + delta, 1); vy = d.getFullYear(); vm = d.getMonth(); }
        else if (mode === 'month') vy += delta;
        else blokTahun += delta * 12;
        gambarKalender();
    }
    $('calPrev').addEventListener('click', () => geser(-1));
    $('calNext').addEventListener('click', () => geser(1));

    // ganti hari otomatis saat lewat tengah malam
    setInterval(() => {
        const now = dayStart(new Date());
        if (!same(now, today)) { today = now; gambarKalender(); }
    }, 60000);

    blokTahun = awalBlok(vy);
    renderAll();
})();
