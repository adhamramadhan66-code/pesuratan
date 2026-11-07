/* Kalender dashboard = pengendali rentang waktu untuk kotak Jenis surat dan grafik.
   - Klik tanggal        -> per hari
   - Klik nama bulan     -> per bulan
   - Klik angka tahun    -> per tahun
   Panah: pindah bulan (mode bulan ikut pindah, mode tahun pindah tahun, mode hari hanya menggeser tampilan).
   Memberi tahu halaman lewat event "rentang" {dari, sampai, mode, label}. */
(function () {
    const MONTHS_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const $ = (id) => document.getElementById(id);

    const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let today = dayStart(new Date());
    let anchor = new Date(today);          // tanggal terpilih
    let period = 'month';                  // day | month | year
    let view = { y: anchor.getFullYear(), m: anchor.getMonth() };   // bulan yang sedang ditampilkan

    const same = (a, b) => a.getTime() === b.getTime();
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    function getRange() {
        const y = anchor.getFullYear(), m = anchor.getMonth();
        if (period === 'day')  return [new Date(anchor), new Date(anchor)];
        if (period === 'year') return [new Date(y, 0, 1), new Date(y, 11, 31)];
        return [new Date(y, m, 1), new Date(y, m + 1, 0)];
    }
    function labelRentang() {
        if (period === 'day') return anchor.getDate() + ' ' + MONTHS[anchor.getMonth()] + ' ' + anchor.getFullYear();
        if (period === 'year') return 'Tahun ' + anchor.getFullYear();
        return MONTHS_FULL[anchor.getMonth()] + ' ' + anchor.getFullYear();
    }

    function renderKalender() {
        const [rs, re] = getRange();
        $('calBulan').textContent = MONTHS_FULL[view.m];
        $('calTahun').textContent = view.y;
        $('calBulan').classList.toggle('aktif', period === 'month' && anchor.getFullYear() === view.y && anchor.getMonth() === view.m);
        $('calTahun').classList.toggle('aktif', period === 'year' && anchor.getFullYear() === view.y);

        const box = $('miniDates');
        box.textContent = '';
        const first = new Date(view.y, view.m, 1);
        const total = new Date(view.y, view.m + 1, 0).getDate();
        for (let i = 0; i < first.getDay(); i++) {
            const e = document.createElement('span'); e.className = 'empty'; box.appendChild(e);
        }
        for (let n = 1; n <= total; n++) {
            const date = new Date(view.y, view.m, n);
            const b = document.createElement('button');
            b.type = 'button'; b.textContent = n;
            if (same(date, today)) b.classList.add('today');
            if (period !== 'day' && date >= rs && date <= re) b.classList.add('in-range');    // bulan/tahun: seluruh tanggal di rentang diwarnai
            if (period === 'day' && same(date, anchor)) { b.classList.add('selected'); b.setAttribute('aria-current', 'date'); }
            b.addEventListener('click', () => { period = 'day'; anchor = date; renderAll(); });
            box.appendChild(b);
        }
    }
    function renderAll() {
        renderKalender();
        const [rs, re] = getRange();
        document.dispatchEvent(new CustomEvent('rentang', { detail: { dari: iso(rs), sampai: iso(re), mode: period, label: labelRentang() } }));
    }

    $('calBulan').addEventListener('click', () => { period = 'month'; anchor = new Date(view.y, view.m, 1); renderAll(); });
    $('calTahun').addEventListener('click', () => { period = 'year'; anchor = new Date(view.y, 0, 1); renderAll(); });

    function geser(delta) {
        if (period === 'year') {
            view = { y: view.y + delta, m: view.m };
            anchor = new Date(view.y, 0, 1);
        } else {
            const d = new Date(view.y, view.m + delta, 1);
            view = { y: d.getFullYear(), m: d.getMonth() };
            if (period === 'month') anchor = new Date(view.y, view.m, 1);
        }
        renderAll();
    }
    $('calPrev').addEventListener('click', () => geser(-1));
    $('calNext').addEventListener('click', () => geser(1));

    // ganti hari otomatis saat lewat tengah malam
    setInterval(() => {
        const now = dayStart(new Date());
        if (!same(now, today)) { today = now; renderKalender(); }
    }, 60000);

    renderAll();
})();
