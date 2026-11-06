<?php
/**
 * API Pengarsipan: surat keluar yang sudah terbit + surat masuk yang sudah selesai.
 *
 * GET  ?aksi=daftar[&jenis=keluar|masuk&status=belum|diarsipkan&q=&tahun=]   semua peran (staf: hanya surat keluar terbit & surat masuk miliknya)
 *      ?aksi=file&jenis=&id=[&unduh=1]
 * POST aksi=simpan (admin) jenis, id, tanggal_arsip, lokasi_arsip, keterangan_arsip
 *      aksi=batal  (admin) jenis, id
 */
require __DIR__ . '/umum.php';

const SQL_ARSIP = "
    SELECT 'keluar' AS jenis, k.id, k.nomor_surat AS nomor, k.perihal, k.tujuan AS pihak, DATE(k.tanggal_terbit) AS tanggal,
           k.file_surat, k.status_arsip, k.tanggal_arsip, k.lokasi_arsip, k.keterangan_arsip, 0 AS staf_id
    FROM surat_keluar k WHERE k.status = 'terbit'
    UNION ALL
    SELECT 'masuk', m.id, m.nomor_agenda, m.perihal, m.pengirim, m.tanggal_terima,
           m.file_surat, m.status_arsip, m.tanggal_arsip, m.lokasi_arsip, m.keterangan_arsip, COALESCE(d.staf_id, 0)
    FROM surat_masuk m LEFT JOIN disposisi d ON d.surat_masuk_id = m.id WHERE m.status = 'selesai'";

function jenis_tabel(string $j): string
{
    if (!in_array($j, ['keluar', 'masuk'], true)) json_keluar(['error' => 'Jenis surat tidak dikenal.'], 400);
    return $j === 'keluar' ? 'surat_keluar' : 'surat_masuk';
}

function ambil_arsip(string $jenis, int $id): array
{
    $t = jenis_tabel($jenis);
    $kondisi = $jenis === 'keluar' ? "status = 'terbit'" : "status = 'selesai'";
    $s = db()->prepare("SELECT * FROM $t WHERE id = ? AND $kondisi");
    $s->execute([$id]);
    $r = $s->fetch();
    if (!$r) json_keluar(['error' => 'Surat belum masuk tahap pengarsipan (harus terbit / selesai).'], 404);
    return $r;
}

jalankan(function () {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $u = wajib_login();
        $aksi = $_GET['aksi'] ?? 'daftar';

        if ($aksi === 'file') {
            $jenis = $_GET['jenis'] ?? '';
            $r = ambil_arsip($jenis, (int) ($_GET['id'] ?? 0));
            if ($u['peran'] === 'staf' && $jenis === 'masuk') {
                $c = $pdo->prepare('SELECT COUNT(*) FROM disposisi WHERE surat_masuk_id = ? AND staf_id = ?');
                $c->execute([$r['id'], $u['id']]);
                if (!(int) $c->fetchColumn()) json_keluar(['error' => 'Bukan surat Anda.'], 403);
            }
            if ($r['file_surat'] === '') { http_response_code(404); exit('Belum ada file.'); }
            kirim_file($r['file_surat'], $jenis . '-' . $r['id']);
        }

        if ($aksi === 'daftar') {
            $w = []; $p = [];
            if (in_array($_GET['jenis'] ?? '', ['keluar', 'masuk'], true)) { $w[] = 'a.jenis = ?'; $p[] = $_GET['jenis']; }
            if (in_array($_GET['status'] ?? '', ['belum', 'diarsipkan'], true)) { $w[] = 'a.status_arsip = ?'; $p[] = $_GET['status']; }
            if ($u['peran'] === 'staf') { $w[] = "(a.jenis = 'keluar' OR a.staf_id = ?)"; $p[] = $u['id']; }
            if (($tahun = (int) ($_GET['tahun'] ?? 0)) > 0) { $w[] = 'YEAR(a.tanggal) = ?'; $p[] = $tahun; }
            if (($q = teks($_GET['q'] ?? '', 80)) !== '') {
                $w[] = '(a.nomor LIKE ? OR a.perihal LIKE ? OR a.pihak LIKE ? OR a.lokasi_arsip LIKE ?)';
                array_push($p, "%$q%", "%$q%", "%$q%", "%$q%");
            }
            $s = $pdo->prepare('SELECT * FROM (' . SQL_ARSIP . ') a' . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY a.tanggal DESC, a.id DESC LIMIT 500');
            $s->execute($p);
            $data = array_map(fn($r) => [
                'jenis' => $r['jenis'], 'id' => (int) $r['id'], 'nomor' => $r['nomor'], 'perihal' => $r['perihal'], 'pihak' => $r['pihak'],
                'tanggal' => $r['tanggal'], 'status_arsip' => $r['status_arsip'], 'tanggal_arsip' => $r['tanggal_arsip'],
                'lokasi_arsip' => $r['lokasi_arsip'], 'keterangan_arsip' => $r['keterangan_arsip'],
                'ada_file' => $r['file_surat'] !== '' && is_file(FOLDER_ARSIP . '/' . $r['file_surat']),
                'file_tipe' => pathinfo($r['file_surat'], PATHINFO_EXTENSION),
            ], $s->fetchAll());
            json_keluar(['data' => $data]);
        }
        json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_keluar(['error' => 'Metode tidak didukung.'], 405);
    wajib_peran('admin');
    $in = masukan();
    $jenis = $in['jenis'] ?? '';
    $t = jenis_tabel($jenis);
    $r = ambil_arsip($jenis, (int) ($in['id'] ?? 0));

    switch ($in['aksi'] ?? '') {
        case 'simpan': {
            $tgl = tanggal_atau_null($in['tanggal_arsip'] ?? '') ?? date('Y-m-d');
            $lokasi = teks($in['lokasi_arsip'] ?? '', 150);
            $f = simpan_unggahan();                                   // file scan baru (opsional) menggantikan file lama
            $file = $f ? $f[0] : $r['file_surat'];
            $nama = $f ? $f[1] : $r['file_nama'];
            if (!$f && !empty($in['hapus_file'])) { $file = ''; $nama = ''; }
            if ($lokasi === '' && $file === '') { if ($f) hapus_file($f[0]); json_keluar(['error' => 'Isi lokasi arsip fisik atau unggah file scan.'], 422); }
            $pdo->prepare("UPDATE $t SET status_arsip='diarsipkan', tanggal_arsip=?, lokasi_arsip=?, keterangan_arsip=?, file_surat=?, file_nama=? WHERE id=?")
                ->execute([$tgl, $lokasi, teks($in['keterangan_arsip'] ?? ''), $file, $nama, $r['id']]);
            if ($file !== $r['file_surat']) hapus_file($r['file_surat']);
            json_keluar(['ok' => true]);
        }

        case 'batal':
            $pdo->prepare("UPDATE $t SET status_arsip='belum', tanggal_arsip=NULL, lokasi_arsip='', keterangan_arsip='' WHERE id=?")->execute([$r['id']]);
            json_keluar(['ok' => true]);

        default:
            json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }
});
