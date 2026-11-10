<?php
/**
 * API Data Surat.
 *   GET  api/surat.php?aksi=opsi                      -> daftar jenis surat, unit, dan tahun
 *   GET  api/surat.php?aksi=preview&tanggal=Y-m-d     -> nomor urut berikutnya pada bulan itu
 *   GET  api/surat.php?aksi=daftar&q=&jenis=&unit=&tujuan=&tahun=&bulan=&urut=&limit=&offset=   (halaman Data Surat)
 *   GET  api/surat.php?aksi=detail&id=                -> satu surat (untuk form ubah)
 *   GET  api/surat.php?aksi=terbaru&dari=&sampai=&...  (kotak "Surat terbaru" di dashboard)
 *   GET  api/surat.php?aksi=statistik&dari=Y-m-d&sampai=Y-m-d
 *   POST api/surat.php {aksi: tambah | ubah | hapus, ...}
 *
 * Surat yang disimpan lewat Upload Surat langsung tercatat di Data Surat.
 */
require __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function keluar($data, int $kode = 200): void
{
    http_response_code($kode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function teks($v, int $maks = 255): string
{
    $v = trim(preg_replace('/\s+/u', ' ', (string) $v));
    return function_exists('mb_substr') ? mb_substr($v, 0, $maks) : substr($v, 0, $maks);
}

function tanggal_valid($v): ?string
{
    $d = DateTime::createFromFormat('Y-m-d', (string) $v);
    return ($d && $d->format('Y-m-d') === $v) ? $v : null;
}

function nomor_berikutnya(PDO $pdo, int $tahun, int $bulan): int
{
    $s = $pdo->prepare('SELECT COALESCE(MAX(nomor_urut), 0) FROM surat WHERE tahun = ? AND bulan = ?');
    $s->execute([$tahun, $bulan]);
    return (int) $s->fetchColumn() + 1;
}

function format_nomor(int $urut, string $tujuan, string $jenis, string $unit, int $bulan, int $tahun): string
{
    return sprintf('%03d.%s/%s/%s/%s/%d', $urut, $tujuan, $jenis, $unit, bulan_romawi($bulan), $tahun);
}

/** Validasi isian form Upload Surat; mengembalikan [data, pesan_error]. */
function baca_form(PDO $pdo, array $in): array
{
    // Form Upload Surat hanya memakai Judul. Kolom perihal (wajib di database) diisi sama dengan judul;
    // pada surat lama yang diubah, perihal yang sudah ada dibiarkan.
    $d = ['judul' => teks($in['judul'] ?? ''), 'perihal' => teks($in['perihal'] ?? '')];
    if ($d['judul'] === '') return [null, 'Judul surat wajib diisi.'];

    // Link Google Drive wajib diisi.
    $link = link_drive_bersih($in['link_drive'] ?? '');
    if ($link === null) return [null, 'Link harus berupa tautan Google Drive (https://drive.google.com/...).'];
    if ($link === '') return [null, 'Link Google Drive wajib diisi.'];
    $d['link_drive'] = $link;

    $d['tanggal_surat'] = tanggal_valid($in['tanggal_surat'] ?? '');
    if (!$d['tanggal_surat']) return [null, 'Tanggal surat tidak valid.'];
    $d['kode_tujuan'] = ($in['kode_tujuan'] ?? '') === 'B' ? 'B' : (($in['kode_tujuan'] ?? '') === 'A' ? 'A' : '');
    if ($d['kode_tujuan'] === '') return [null, 'Pilih tujuan surat (internal / eksternal).'];

    $d['jenis_kode'] = (string) ($in['jenis_kode'] ?? '');
    $d['unit_kode']  = (string) ($in['unit_kode'] ?? '');
    $c = $pdo->prepare('SELECT COUNT(*) FROM jenis_surat WHERE kode = ?');
    $c->execute([$d['jenis_kode']]);
    if (!$c->fetchColumn()) return [null, 'Jenis surat tidak dikenal.'];
    $c = $pdo->prepare('SELECT COUNT(*) FROM unit WHERE kode = ?');
    $c->execute([$d['unit_kode']]);
    if (!$c->fetchColumn()) return [null, 'Unit pembuat surat tidak dikenal.'];
    return [$d, null];
}

const KOLOM_LIST = 'id, nomor_surat, judul, tanggal_surat, perihal, kode_tujuan, jenis_kode, unit_kode, tahun, bulan, nomor_urut, file_nama, link_drive,
                    (file_arsip <> \'\' OR link_drive <> \'\') AS ada_file,
                    (SELECT j.nama FROM jenis_surat j WHERE j.kode = surat.jenis_kode) AS jenis_nama,
                    (SELECT u.nama FROM unit u WHERE u.kode = surat.unit_kode) AS unit_nama';

/** Syarat pencarian bersama (halaman Data Surat dan kotak Surat terbaru): [daftar WHERE, parameter]. */
function syarat_cari(array $g): array
{
    $w = []; $p = [];
    if (($q = teks($g['q'] ?? '', 80)) !== '') {
        $w[] = '(nomor_surat LIKE ? OR judul LIKE ? OR perihal LIKE ?)';
        array_push($p, "%$q%", "%$q%", "%$q%");
    }
    if (($v = (string) ($g['jenis'] ?? '')) !== '') { $w[] = 'jenis_kode = ?'; $p[] = $v; }
    if (($v = (string) ($g['unit'] ?? '')) !== '')  { $w[] = 'unit_kode = ?';  $p[] = $v; }
    if (in_array($g['tujuan'] ?? '', ['A', 'B'], true)) { $w[] = 'kode_tujuan = ?'; $p[] = $g['tujuan']; }
    return [$w, $p];
}

try {
    $pdo = db();
    $metode = $_SERVER['REQUEST_METHOD'];

    if ($metode === 'GET') {
        switch ($_GET['aksi'] ?? 'daftar') {
            case 'opsi':
                $tahun = array_map('intval', $pdo->query('SELECT DISTINCT tahun FROM surat ORDER BY tahun DESC')->fetchAll(PDO::FETCH_COLUMN));
                if (!in_array((int) date('Y'), $tahun, true)) array_unshift($tahun, (int) date('Y'));
                keluar([
                    'jenis' => $pdo->query('SELECT kode, nama FROM jenis_surat ORDER BY nama')->fetchAll(),
                    'unit'  => $pdo->query('SELECT kode, nama FROM unit ORDER BY urutan')->fetchAll(),
                    'tahun' => $tahun,
                ]);

            case 'preview':
                $tgl = tanggal_valid($_GET['tanggal'] ?? '') ?? date('Y-m-d');
                [$th, $bl] = [(int) substr($tgl, 0, 4), (int) substr($tgl, 5, 2)];
                keluar(['nomor_urut' => nomor_berikutnya($pdo, $th, $bl), 'bulan' => $bl, 'tahun' => $th,
                        'romawi' => bulan_romawi($bl)]);

            case 'detail':
                $s = $pdo->prepare('SELECT ' . KOLOM_LIST . ' FROM surat WHERE id = ?');
                $s->execute([(int) ($_GET['id'] ?? 0)]);
                $r = $s->fetch();
                if (!$r) keluar(['error' => 'Surat tidak ditemukan.'], 404);
                keluar(['surat' => $r]);

            case 'daftar':
                [$w, $p] = syarat_cari($_GET);
                if ((int) ($_GET['tahun'] ?? 0) > 0) { $w[] = 'tahun = ?'; $p[] = (int) $_GET['tahun']; }
                if ((int) ($_GET['bulan'] ?? 0) > 0) { $w[] = 'bulan = ?'; $p[] = (int) $_GET['bulan']; }
                $urut = ($_GET['urut'] ?? '') === 'lama' ? 'ASC' : 'DESC';
                $limit = max(1, min(200, (int) ($_GET['limit'] ?? 50)));
                $offset = max(0, (int) ($_GET['offset'] ?? 0));
                $where = $w ? ' WHERE ' . implode(' AND ', $w) : '';
                $s = $pdo->prepare('SELECT ' . KOLOM_LIST . " FROM surat$where ORDER BY tanggal_surat $urut, id $urut LIMIT $limit OFFSET $offset");
                $s->execute($p);
                $c = $pdo->prepare("SELECT COUNT(*) FROM surat$where");
                $c->execute($p);
                $thn = array_map('intval', $pdo->query('SELECT DISTINCT tahun FROM surat ORDER BY tahun DESC')->fetchAll(PDO::FETCH_COLUMN));
                keluar(['surat' => $s->fetchAll(), 'total' => (int) $c->fetchColumn(), 'daftar_tahun' => $thn]);

            case 'terbaru':
                // Surat terbaru pada rentang tanggal, dengan filter (dipakai kotak "Surat terbaru" di dashboard).
                $dari   = tanggal_valid($_GET['dari'] ?? '')   ?? date('Y-m-01');
                $sampai = tanggal_valid($_GET['sampai'] ?? '') ?? date('Y-m-t');
                [$w, $p] = syarat_cari($_GET);
                array_unshift($w, 'tanggal_surat BETWEEN ? AND ?');
                array_unshift($p, $dari, $sampai);
                $urut = ($_GET['urut'] ?? '') === 'lama' ? 'ASC' : 'DESC';
                $batas = max(1, min(50, (int) ($_GET['limit'] ?? 12)));
                $s = $pdo->prepare('SELECT ' . KOLOM_LIST . ' FROM surat WHERE ' . implode(' AND ', $w) . " ORDER BY tanggal_surat $urut, id $urut LIMIT $batas");
                $s->execute($p);
                $c = $pdo->prepare('SELECT COUNT(*) FROM surat WHERE ' . implode(' AND ', $w));
                $c->execute($p);
                keluar(['surat' => $s->fetchAll(), 'total' => (int) $c->fetchColumn()]);

            case 'statistik':
                $dari   = tanggal_valid($_GET['dari'] ?? '')   ?? date('Y-m-01');
                $sampai = tanggal_valid($_GET['sampai'] ?? '') ?? date('Y-m-t');
                $s = $pdo->prepare('SELECT COUNT(*) AS total,
                        COALESCE(SUM(kode_tujuan = \'A\'), 0) AS internal,
                        COALESCE(SUM(kode_tujuan = \'B\'), 0) AS eksternal
                    FROM surat WHERE tanggal_surat BETWEEN ? AND ?');
                $s->execute([$dari, $sampai]);
                $tot = array_map('intval', $s->fetch());

                $tahun = (int) substr($dari, 0, 4);
                // Grafik bisa disaring per jenis surat (parameter jenis = kode jenis).
                $jenisGrafik = (string) ($_GET['jenis'] ?? '');
                $s = $pdo->prepare('SELECT bulan, COUNT(*) AS n FROM surat WHERE tahun = ?' . ($jenisGrafik !== '' ? ' AND jenis_kode = ?' : '') . ' GROUP BY bulan');
                $s->execute($jenisGrafik !== '' ? [$tahun, $jenisGrafik] : [$tahun]);
                $perBulan = array_fill(1, 12, 0);
                foreach ($s->fetchAll() as $r) $perBulan[(int) $r['bulan']] = (int) $r['n'];

                // Jumlah surat per jenis pada rentang tanggal untuk kotak Jenis surat di dashboard; yang terbanyak di depan.
                $q = $pdo->prepare('SELECT j.kode, j.nama, COUNT(s.id) AS n FROM jenis_surat j
                                    LEFT JOIN surat s ON s.jenis_kode = j.kode AND s.tanggal_surat BETWEEN ? AND ?
                                    GROUP BY j.kode, j.nama ORDER BY n DESC, j.nama');
                $q->execute([$dari, $sampai]);
                $perJenis = $q->fetchAll();

                // Per hari pada bulan dari tanggal awal.
                $awalBulan = substr($dari, 0, 7) . '-01';
                $akhirBulan = date('Y-m-t', strtotime($awalBulan));
                $q = $pdo->prepare('SELECT DAY(tanggal_surat) AS h, COUNT(*) AS n FROM surat WHERE tanggal_surat BETWEEN ? AND ?'
                                   . ($jenisGrafik !== '' ? ' AND jenis_kode = ?' : '') . ' GROUP BY h');
                $q->execute($jenisGrafik !== '' ? [$awalBulan, $akhirBulan, $jenisGrafik] : [$awalBulan, $akhirBulan]);
                $perHari = array_fill(1, (int) date('t', strtotime($awalBulan)), 0);
                foreach ($q->fetchAll() as $r) $perHari[(int) $r['h']] = (int) $r['n'];
                foreach ($perJenis as &$pj) $pj['n'] = (int) $pj['n'];
                unset($pj);

                // Per tahun: 5-10 tahun terakhir sampai tahun ini (parameter jumlah_tahun).
                $jml = max(5, min(10, (int) ($_GET['jumlah_tahun'] ?? 10)));
                $thIni = (int) date('Y');
                $q = $pdo->prepare('SELECT tahun, COUNT(*) AS n FROM surat WHERE tahun BETWEEN ? AND ?'
                                   . ($jenisGrafik !== '' ? ' AND jenis_kode = ?' : '') . ' GROUP BY tahun');
                $q->execute($jenisGrafik !== '' ? [$thIni - $jml + 1, $thIni, $jenisGrafik] : [$thIni - $jml + 1, $thIni]);
                $perTahun = [];
                for ($y = $thIni - $jml + 1; $y <= $thIni; $y++) $perTahun[$y] = 0;
                foreach ($q->fetchAll() as $r) $perTahun[(int) $r['tahun']] = (int) $r['n'];
                keluar(['per_hari' => array_values($perHari), 'per_jenis' => $perJenis, 'total' => $tot, 'tahun' => $tahun, 'per_bulan' => array_values($perBulan),
                        'per_tahun' => array_values($perTahun), 'label_tahun' => array_map('strval', array_keys($perTahun))]);

            default:
                keluar(['error' => 'Aksi tidak dikenal.'], 400);
        }
    }

    if ($metode !== 'POST') keluar(['error' => 'Metode tidak didukung.'], 405);
    $in = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($in)) keluar(['error' => 'Data JSON tidak valid.'], 400);

    switch ($in['aksi'] ?? '') {
        case 'tambah':
            [$d, $err] = baca_form($pdo, $in);
            if ($err) keluar(['error' => $err], 422);
            if ($d['perihal'] === '') $d['perihal'] = $d['judul'];
            $tahun = (int) substr($d['tanggal_surat'], 0, 4);
            $bulan = (int) substr($d['tanggal_surat'], 5, 2);

            // Ambil nomor urut berikutnya; bila bentrok (dua orang menyimpan bersamaan) coba lagi.
            for ($coba = 0; $coba < 5; $coba++) {
                $urut = nomor_berikutnya($pdo, $tahun, $bulan);
                $nomor = format_nomor($urut, $d['kode_tujuan'], $d['jenis_kode'], $d['unit_kode'], $bulan, $tahun);
                try {
                    $pdo->prepare('INSERT INTO surat (tahun, bulan, nomor_urut, kode_tujuan, jenis_kode, unit_kode, nomor_surat,
                            judul, tanggal_surat, perihal, link_drive, status_arsip)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'diarsipkan\')')
                        ->execute([$tahun, $bulan, $urut, $d['kode_tujuan'], $d['jenis_kode'], $d['unit_kode'], $nomor,
                            $d['judul'], $d['tanggal_surat'], $d['perihal'], $d['link_drive']]);
                    keluar(['ok' => true, 'id' => (int) $pdo->lastInsertId(), 'nomor_surat' => $nomor], 201);
                } catch (PDOException $e) {
                    if ($e->getCode() !== '23000') throw $e;   // selain duplikat nomor -> lempar
                }
            }
            keluar(['error' => 'Gagal mendapatkan nomor surat, silakan coba lagi.'], 409);

        case 'ubah':
            $id = (int) ($in['id'] ?? 0);
            [$d, $err] = baca_form($pdo, $in);
            if ($err) keluar(['error' => $err], 422);
            $c = $pdo->prepare('SELECT tahun, bulan, nomor_urut, perihal FROM surat WHERE id = ?');
            $c->execute([$id]);
            $lama = $c->fetch();
            if (!$lama) keluar(['error' => 'Surat tidak ditemukan.'], 404);
            if ($d['perihal'] === '') $d['perihal'] = $lama['perihal'] !== '' ? $lama['perihal'] : $d['judul'];
            $tahun = (int) substr($d['tanggal_surat'], 0, 4);
            $bulan = (int) substr($d['tanggal_surat'], 5, 2);
            // Bulan & tahun sama -> nomor urut dipertahankan. Pindah bulan -> ambil nomor urut berikutnya di bulan baru.
            $sama = ((int) $lama['tahun'] === $tahun && (int) $lama['bulan'] === $bulan);

            for ($coba = 0; $coba < 5; $coba++) {
                $urut = $sama ? (int) $lama['nomor_urut'] : nomor_berikutnya($pdo, $tahun, $bulan);
                $nomor = format_nomor($urut, $d['kode_tujuan'], $d['jenis_kode'], $d['unit_kode'], $bulan, $tahun);
                try {
                    $pdo->prepare('UPDATE surat SET tahun = ?, bulan = ?, nomor_urut = ?, kode_tujuan = ?, jenis_kode = ?, unit_kode = ?, nomor_surat = ?,
                            judul = ?, tanggal_surat = ?, perihal = ?, link_drive = ? WHERE id = ?')
                        ->execute([$tahun, $bulan, $urut, $d['kode_tujuan'], $d['jenis_kode'], $d['unit_kode'], $nomor,
                            $d['judul'], $d['tanggal_surat'], $d['perihal'], $d['link_drive'], $id]);
                    keluar(['ok' => true, 'nomor_surat' => $nomor]);
                } catch (PDOException $e) {
                    if ($e->getCode() !== '23000' || $sama) throw $e;
                }
            }
            keluar(['error' => 'Gagal mendapatkan nomor surat, silakan coba lagi.'], 409);

        case 'hapus':
            $id = (int) ($in['id'] ?? 0);
            $c = $pdo->prepare('SELECT file_arsip FROM surat WHERE id = ?');
            $c->execute([$id]);
            $file = $c->fetchColumn();
            if ($file === false) keluar(['error' => 'Surat tidak ditemukan.'], 404);
            $pdo->prepare('DELETE FROM surat WHERE id = ?')->execute([$id]);
            if ($file !== '' && preg_match('/^[a-f0-9]{32}\.(pdf|jpg|png)$/', $file)) @unlink(FOLDER_ARSIP . '/' . $file);
            keluar(['ok' => true]);

        default:
            keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }
} catch (Throwable $e) {
    $pesan = $e instanceof PDOException && in_array($e->getCode(), [2002, 1045])
        ? 'Tidak dapat terhubung ke MySQL. Pastikan MySQL di Laragon sudah Start.'
        : 'Kesalahan server: ' . $e->getMessage();
    keluar(['error' => $pesan], 500);
}
