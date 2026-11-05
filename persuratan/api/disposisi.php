<?php
/**
 * API Disposisi: menyalurkan surat ke tujuan yang benar (misalnya Rektor) dan menunggu persetujuan.
 * Alur: surat dinomori di Penomoran (atau dicatat di Surat Masuk) -> dibuatkan disposisi (disalurkan ke tujuan) -> disetujui.
 *   GET  api/disposisi.php?aksi=daftar&status=&q=&tahun=&bulan=
 *   GET  api/disposisi.php?aksi=detail&id=
 *   GET  api/disposisi.php?aksi=sumber        -> surat (dari Penomoran dan Surat Masuk) yang belum punya disposisi
 *   POST api/disposisi.php {aksi: tambah | ubah | hapus | setujui | batal_setuju, ...}
 * Status: belum (merah) -> disetujui (hijau).
 */
require __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const SIFAT_BOLEH = ['penting', 'segera', 'rahasia', 'biasa'];
const JUMLAH_ISI = 12;       // 12 butir "Isi disposisi" pada lembar
const MAKS_ALUR = 20;        // baris alur disposisi

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

/** "1, 3 ,x,3,15" -> "1,3" (hanya angka 1..12, tanpa duplikat, urut). */
function nomor_isi($v): string
{
    $arr = is_array($v) ? $v : preg_split('/[^0-9]+/', (string) $v);
    $ok = [];
    foreach ($arr as $x) {
        $n = (int) $x;
        if ($n >= 1 && $n <= JUMLAH_ISI) $ok[$n] = $n;
    }
    ksort($ok);
    return implode(',', $ok);
}

function format_no(int $urut, int $bulan, int $tahun): string
{
    return sprintf('%03d/DSP/%s/%d', $urut, bulan_romawi($bulan), $tahun);
}

function urut_berikutnya(PDO $pdo, int $tahun, int $bulan): int
{
    $s = $pdo->prepare('SELECT COALESCE(MAX(urut), 0) FROM disposisi WHERE tahun = ? AND bulan = ?');
    $s->execute([$tahun, $bulan]);
    return (int) $s->fetchColumn() + 1;
}

function satu_baris(PDO $pdo, string $sql, array $par): ?array
{
    $s = $pdo->prepare($sql);
    $s->execute($par);
    return $s->fetch() ?: null;
}

/**
 * Validasi isian form; mengembalikan [data, alur, pesan_error].
 * Saat membuat disposisi baru ($baru = true), surat yang disalurkan wajib dipilih (surat dari Penomoran atau Surat Masuk);
 * jenis/unit/tujuan diambil dari surat tersebut.
 */
function baca_form(PDO $pdo, array $in, bool $baru): array
{
    $d = [
        'tanggal_terima'   => tanggal_valid($in['tanggal_terima'] ?? ''),
        'hal'              => teks($in['hal'] ?? ''),
        'pemohon'          => teks($in['pemohon'] ?? '', 100),
        'tujuan_disposisi' => teks($in['tujuan_disposisi'] ?? '', 100),
        'isi'              => nomor_isi($in['isi'] ?? []),
    ];
    $sifat = array_values(array_intersect(SIFAT_BOLEH, array_map('strval', (array) ($in['sifat'] ?? []))));
    $d['sifat'] = implode(',', $sifat);

    if (!$d['tanggal_terima'])         return [null, null, 'Tanggal disposisi tidak valid.'];
    if ($d['tujuan_disposisi'] === '') return [null, null, 'Isi tujuan penyaluran disposisi (misalnya Rektor).'];
    if ($d['sifat'] === '')            return [null, null, 'Pilih sifat disposisi (Penting, Segera, Rahasia, atau Biasa).'];
    if ($d['hal'] === '')              return [null, null, 'Hal (perihal) wajib diisi.'];
    if ($d['pemohon'] === '')          return [null, null, 'Nama pemohon wajib diisi.'];
    if ($d['isi'] === '')              return [null, null, 'Pilih minimal satu butir Isi disposisi.'];

    if ($baru) {
        $sid = (int) ($in['surat_id'] ?? 0);
        $mid = (int) ($in['surat_masuk_id'] ?? 0);
        if ($sid) {
            $s = satu_baris($pdo, 'SELECT jenis_kode, unit_kode, kode_tujuan, untuk FROM surat WHERE id = ?', [$sid]);
            if (!$s) return [null, null, 'Surat yang dipilih tidak ditemukan.'];
            if (satu_baris($pdo, 'SELECT id FROM disposisi WHERE surat_id = ?', [$sid])) return [null, null, 'Surat ini sudah punya disposisi.'];
            $d += ['surat_id' => $sid, 'surat_masuk_id' => null, 'kode_jenis' => $s['jenis_kode'], 'unit_kode' => $s['unit_kode'],
                   'kode_tujuan' => $s['kode_tujuan'], 'untuk' => $s['untuk']];
        } elseif ($mid) {
            $m = satu_baris($pdo, 'SELECT tujuan, jenis_pengirim FROM surat_masuk WHERE id = ?', [$mid]);
            if (!$m) return [null, null, 'Surat masuk yang dipilih tidak ditemukan.'];
            if (satu_baris($pdo, 'SELECT id FROM disposisi WHERE surat_masuk_id = ?', [$mid])) return [null, null, 'Surat masuk ini sudah punya disposisi.'];
            $d += ['surat_id' => null, 'surat_masuk_id' => $mid, 'kode_jenis' => '', 'unit_kode' => '',
                   'kode_tujuan' => $m['jenis_pengirim'] === 'internal' ? 'A' : 'B', 'untuk' => teks($m['tujuan'])];
        } else {
            return [null, null, 'Pilih surat yang akan disalurkan (surat dari Penomoran atau Surat Masuk).'];
        }
    }

    $alur = [];
    foreach (array_slice((array) ($in['alur'] ?? []), 0, MAKS_ALUR) as $r) {
        if (!is_array($r)) continue;
        $b = [
            'tanggal'   => tanggal_valid($r['tanggal'] ?? ''),
            'kepada'    => teks($r['kepada'] ?? '', 100),
            'isi_nomor' => nomor_isi($r['isi_nomor'] ?? ''),
            'dari'      => teks($r['dari'] ?? '', 100),
            'paraf'     => teks($r['paraf'] ?? '', 40),
        ];
        if (!$b['tanggal'] && $b['kepada'] === '' && $b['isi_nomor'] === '' && $b['dari'] === '' && $b['paraf'] === '') continue;
        $alur[] = $b;
    }
    return [$d, $alur, null];
}

function simpan_alur(PDO $pdo, int $id, array $alur): void
{
    $pdo->prepare('DELETE FROM disposisi_alur WHERE disposisi_id = ?')->execute([$id]);
    $s = $pdo->prepare('INSERT INTO disposisi_alur (disposisi_id, urutan, tanggal, kepada, isi_nomor, dari, paraf) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($alur as $i => $b) $s->execute([$id, $i + 1, $b['tanggal'], $b['kepada'], $b['isi_nomor'], $b['dari'], $b['paraf']]);
}

/** Kolom daftar + nomor surat yang disalurkan. */
const KOLOM = 'd.id, d.surat_id, d.surat_masuk_id,
               (SELECT s.nomor_surat FROM surat s WHERE s.id = d.surat_id) AS nomor_surat,
               (SELECT m.nomor_agenda FROM surat_masuk m WHERE m.id = d.surat_masuk_id) AS nomor_agenda,
               d.no_disposisi, d.tanggal_terima, d.sifat, d.hal, d.kode_jenis, d.unit_kode, d.kode_tujuan, d.untuk, d.pemohon,
               d.tujuan_disposisi, d.isi, d.status, d.tanggal_setuju, d.disetujui_oleh';

function ambil(PDO $pdo, int $id): ?array
{
    return satu_baris($pdo, 'SELECT ' . KOLOM . ' FROM disposisi d WHERE d.id = ?', [$id]);
}

try {
    $pdo = db();
    $metode = $_SERVER['REQUEST_METHOD'];

    if ($metode === 'GET') {
        switch ($_GET['aksi'] ?? 'daftar') {
            case 'daftar':
                $where = []; $par = [];
                $st = $_GET['status'] ?? '';
                if (in_array($st, ['belum', 'disetujui'], true)) { $where[] = 'd.status = ?'; $par[] = $st; }
                if (($q = teks($_GET['q'] ?? '', 80)) !== '') {
                    $where[] = '(d.no_disposisi LIKE ? OR d.hal LIKE ? OR d.pemohon LIKE ? OR d.tujuan_disposisi LIKE ? OR d.untuk LIKE ?
                                 OR d.surat_id IN (SELECT id FROM surat WHERE nomor_surat LIKE ?))';
                    array_push($par, ...array_fill(0, 6, "%$q%"));
                }
                if ((int) ($_GET['tahun'] ?? 0) > 0) { $where[] = 'd.tahun = ?'; $par[] = (int) $_GET['tahun']; }
                if ((int) ($_GET['bulan'] ?? 0) > 0) { $where[] = 'd.bulan = ?'; $par[] = (int) $_GET['bulan']; }
                $sql = 'SELECT ' . KOLOM . ' FROM disposisi d' . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
                     . ' ORDER BY d.tanggal_terima DESC, d.id DESC LIMIT 500';
                $s = $pdo->prepare($sql);
                $s->execute($par);
                $baris = $s->fetchAll();
                $r = $pdo->query('SELECT COUNT(*) AS total, COALESCE(SUM(status = \'disetujui\'), 0) AS disetujui FROM disposisi')->fetch();
                $tahun = array_map('intval', $pdo->query('SELECT DISTINCT tahun FROM disposisi ORDER BY tahun DESC')->fetchAll(PDO::FETCH_COLUMN));
                keluar(['disposisi' => $baris, 'total' => (int) $r['total'], 'disetujui' => (int) $r['disetujui'], 'daftar_tahun' => $tahun]);

            case 'detail':
                $d = ambil($pdo, (int) ($_GET['id'] ?? 0));
                if (!$d) keluar(['error' => 'Disposisi tidak ditemukan.'], 404);
                $s = $pdo->prepare('SELECT tanggal, kepada, isi_nomor, dari, paraf FROM disposisi_alur WHERE disposisi_id = ? ORDER BY urutan');
                $s->execute([$d['id']]);
                $d['alur'] = $s->fetchAll();
                $d['jenis_nama'] = (string) (satu_baris($pdo, 'SELECT nama FROM jenis_surat WHERE kode = ?', [$d['kode_jenis']])['nama'] ?? '');
                $d['unit_nama'] = (string) (satu_baris($pdo, 'SELECT nama FROM unit WHERE kode = ?', [$d['unit_kode']])['nama'] ?? '');
                keluar(['disposisi' => $d]);

            case 'sumber':
                $surat = $pdo->query('SELECT s.id, s.nomor_surat, s.tanggal_surat, s.perihal, s.untuk, s.jenis_kode, s.unit_kode, s.kode_tujuan, s.pembuat_surat
                                      FROM surat s WHERE NOT EXISTS (SELECT 1 FROM disposisi d WHERE d.surat_id = s.id)
                                      ORDER BY s.tanggal_surat DESC, s.id DESC LIMIT 300')->fetchAll();
                $masuk = $pdo->query('SELECT m.id, m.nomor_agenda, m.tanggal_terima, m.perihal, m.pengirim, m.tujuan, m.sifat
                                      FROM surat_masuk m WHERE NOT EXISTS (SELECT 1 FROM disposisi d WHERE d.surat_masuk_id = m.id)
                                      ORDER BY m.tanggal_terima DESC, m.id DESC LIMIT 300')->fetchAll();
                keluar(['surat' => $surat, 'surat_masuk' => $masuk]);

            default:
                keluar(['error' => 'Aksi tidak dikenal.'], 400);
        }
    }

    if ($metode !== 'POST') keluar(['error' => 'Metode tidak didukung.'], 405);
    $in = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($in)) keluar(['error' => 'Data JSON tidak valid.'], 400);

    switch ($in['aksi'] ?? '') {
        case 'tambah':
            [$d, $alur, $err] = baca_form($pdo, $in, true);
            if ($err) keluar(['error' => $err], 422);
            $tahun = (int) substr($d['tanggal_terima'], 0, 4);
            $bulan = (int) substr($d['tanggal_terima'], 5, 2);
            for ($coba = 0; $coba < 5; $coba++) {
                $urut = urut_berikutnya($pdo, $tahun, $bulan);
                $no = format_no($urut, $bulan, $tahun);
                $pdo->beginTransaction();
                try {
                    $pdo->prepare('INSERT INTO disposisi (tahun, bulan, urut, no_disposisi, tanggal_terima, sifat, hal, kode_jenis, unit_kode,
                            kode_tujuan, untuk, pemohon, tujuan_disposisi, isi, surat_id, surat_masuk_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                        ->execute([$tahun, $bulan, $urut, $no, $d['tanggal_terima'], $d['sifat'], $d['hal'], $d['kode_jenis'], $d['unit_kode'],
                            $d['kode_tujuan'], $d['untuk'], $d['pemohon'], $d['tujuan_disposisi'], $d['isi'], $d['surat_id'], $d['surat_masuk_id']]);
                    $id = (int) $pdo->lastInsertId();
                    simpan_alur($pdo, $id, $alur);
                    // Surat masuk yang didisposisikan otomatis naik ke tahap "didisposisikan".
                    if ($d['surat_masuk_id']) {
                        $pdo->prepare('UPDATE surat_masuk SET status = \'didisposisikan\' WHERE id = ? AND status = \'diterima\'')->execute([$d['surat_masuk_id']]);
                    }
                    $pdo->commit();
                    keluar(['ok' => true, 'id' => $id, 'no_disposisi' => $no], 201);
                } catch (PDOException $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    if ($e->getCode() !== '23000') throw $e;
                    if (strpos($e->getMessage(), 'uq_dsp_surat') !== false) keluar(['error' => 'Surat ini sudah punya disposisi.'], 409);
                    // selain itu: nomor disposisi bentrok -> coba lagi dengan nomor berikutnya
                }
            }
            keluar(['error' => 'Gagal mendapatkan nomor disposisi, silakan coba lagi.'], 409);

        case 'ubah':
            $id = (int) ($in['id'] ?? 0);
            $lama = ambil($pdo, $id);
            if (!$lama) keluar(['error' => 'Disposisi tidak ditemukan.'], 404);
            if ($lama['status'] === 'disetujui') keluar(['error' => 'Disposisi yang sudah disetujui tidak bisa diubah. Batalkan persetujuan terlebih dahulu.'], 409);
            [$d, $alur, $err] = baca_form($pdo, $in, false);
            if ($err) keluar(['error' => $err], 422);
            $pdo->beginTransaction();
            try {
                $pdo->prepare('UPDATE disposisi SET tanggal_terima = ?, sifat = ?, hal = ?, pemohon = ?, tujuan_disposisi = ?, isi = ? WHERE id = ?')
                    ->execute([$d['tanggal_terima'], $d['sifat'], $d['hal'], $d['pemohon'], $d['tujuan_disposisi'], $d['isi'], $id]);
                simpan_alur($pdo, $id, $alur);
                $pdo->commit();
            } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
            keluar(['ok' => true, 'no_disposisi' => $lama['no_disposisi']]);

        case 'hapus':
            $id = (int) ($in['id'] ?? 0);
            if (!ambil($pdo, $id)) keluar(['error' => 'Disposisi tidak ditemukan.'], 404);
            $pdo->prepare('DELETE FROM disposisi_alur WHERE disposisi_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM disposisi WHERE id = ?')->execute([$id]);
            keluar(['ok' => true]);

        case 'setujui':
            $id = (int) ($in['id'] ?? 0);
            if (!ambil($pdo, $id)) keluar(['error' => 'Disposisi tidak ditemukan.'], 404);
            $oleh = teks($in['oleh'] ?? '', 100) ?: 'Admin';
            $pdo->prepare('UPDATE disposisi SET status = \'disetujui\', tanggal_setuju = ?, disetujui_oleh = ? WHERE id = ? AND status = \'belum\'')
                ->execute([date('Y-m-d'), $oleh, $id]);
            keluar(['ok' => true]);

        case 'batal_setuju':
            $id = (int) ($in['id'] ?? 0);
            if (!ambil($pdo, $id)) keluar(['error' => 'Disposisi tidak ditemukan.'], 404);
            $pdo->prepare('UPDATE disposisi SET status = \'belum\', tanggal_setuju = NULL, disetujui_oleh = \'\' WHERE id = ?')->execute([$id]);
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
