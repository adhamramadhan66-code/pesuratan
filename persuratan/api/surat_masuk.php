<?php
/**
 * API Surat Masuk (alur dengan Disposisi).
 *
 *   status: diterima (admin input) -> proses_staf (pimpinan membuat disposisi) -> selesai (staf menyelesaikan)
 *
 * GET  ?aksi=daftar[&status=&q=&tahun=&bulan=]   admin & pimpinan: semua; staf: hanya yang didisposisikan kepadanya
 *      ?aksi=file&id=N[&unduh=1]
 * POST aksi=tambah (admin)   nomor_surat_asal, tanggal_surat, tanggal_terima, pengirim, perihal, sifat, [file]
 *      aksi=ubah   (admin)   id + kolom yang sama, hanya selama status 'diterima'
 *      aksi=hapus  (admin)   id, hanya selama status 'diterima'
 */
require __DIR__ . '/surat_masuk_fungsi.php';

jalankan(function () {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $u = wajib_login();
        $aksi = $_GET['aksi'] ?? 'daftar';

        if ($aksi === 'file') {
            $r = ambil_masuk((int) ($_GET['id'] ?? 0));
            if ($u['peran'] === 'staf' && (int) $r['staf_id'] !== $u['id']) json_keluar(['error' => 'Surat ini tidak didisposisikan kepada Anda.'], 403);
            if ($r['file_surat'] === '') { http_response_code(404); exit('Surat ini belum punya file.'); }
            kirim_file($r['file_surat'], 'surat-masuk-' . $r['id']);
        }

        if ($aksi === 'daftar') {
            $w = []; $p = [];
            if (in_array($_GET['status'] ?? '', ['diterima', 'proses_staf', 'selesai'], true)) { $w[] = 'm.status = ?'; $p[] = $_GET['status']; }
            if ($u['peran'] === 'staf') { $w[] = 'd.staf_id = ?'; $p[] = $u['id']; }
            if (($tahun = (int) ($_GET['tahun'] ?? 0)) > 0) { $w[] = 'YEAR(m.tanggal_terima) = ?'; $p[] = $tahun; }
            if (($bulan = (int) ($_GET['bulan'] ?? 0)) > 0) { $w[] = 'MONTH(m.tanggal_terima) = ?'; $p[] = $bulan; }
            if (($q = teks($_GET['q'] ?? '', 80)) !== '') {
                $w[] = '(m.perihal LIKE ? OR m.pengirim LIKE ? OR m.nomor_agenda LIKE ? OR m.nomor_surat_asal LIKE ?)';
                array_push($p, "%$q%", "%$q%", "%$q%", "%$q%");
            }
            $s = $pdo->prepare(SQL_MASUK . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY m.id DESC LIMIT 500');
            $s->execute($p);
            json_keluar(['data' => array_map('baris_masuk', $s->fetchAll())]);
        }
        json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_keluar(['error' => 'Metode tidak didukung.'], 405);
    $in = masukan();

    switch ($in['aksi'] ?? '') {
        case 'tambah': {
            $u = wajib_peran('admin');
            [$asal, $tglSurat, $tglTerima, $pengirim, $perihal, $sifat] = data_masuk($in);
            $f = simpan_unggahan();
            $tahun = (int) substr($tglTerima, 0, 4); $bulan = (int) substr($tglTerima, 5, 2);
            for ($coba = 0; $coba < 5; $coba++) {
                $s = $pdo->prepare('SELECT COALESCE(MAX(urut), 0) + 1 FROM surat_masuk WHERE tahun = ? AND bulan = ?');
                $s->execute([$tahun, $bulan]);
                $urut = (int) $s->fetchColumn();
                $agenda = sprintf('%03d/SM/%s/%d', $urut, bulan_romawi($bulan), $tahun);
                try {
                    $pdo->prepare("INSERT INTO surat_masuk (tahun, bulan, urut, nomor_agenda, nomor_surat_asal, tanggal_surat, tanggal_terima,
                        pengirim, perihal, sifat, status, file_surat, file_nama, dibuat_oleh) VALUES (?,?,?,?,?,?,?,?,?,?, 'diterima', ?, ?, ?)")
                        ->execute([$tahun, $bulan, $urut, $agenda, $asal, $tglSurat, $tglTerima, $pengirim, $perihal, $sifat, $f[0] ?? '', $f[1] ?? '', $u['id']]);
                } catch (PDOException $e) {
                    if ($e->getCode() !== '23000') { if ($f) hapus_file($f[0]); throw $e; }
                    continue;
                }
                json_keluar(['ok' => true, 'surat' => baris_masuk(ambil_masuk((int) $pdo->lastInsertId()))], 201);
            }
            if ($f) hapus_file($f[0]);
            json_keluar(['error' => 'Gagal membuat nomor agenda, coba lagi.'], 409);
        }

        case 'ubah': {
            wajib_peran('admin');
            $r = ambil_masuk((int) ($in['id'] ?? 0));
            if ($r['status'] !== 'diterima') json_keluar(['error' => 'Surat yang sudah didisposisikan tidak bisa diubah.'], 409);
            [$asal, $tglSurat, $tglTerima, $pengirim, $perihal, $sifat] = data_masuk($in);
            $f = simpan_unggahan();
            $pdo->prepare('UPDATE surat_masuk SET nomor_surat_asal=?, tanggal_surat=?, tanggal_terima=?, pengirim=?, perihal=?, sifat=?, file_surat=?, file_nama=? WHERE id=?')
                ->execute([$asal, $tglSurat, $tglTerima, $pengirim, $perihal, $sifat, $f[0] ?? $r['file_surat'], $f[1] ?? $r['file_nama'], $r['id']]);
            if ($f) hapus_file($r['file_surat']);
            json_keluar(['ok' => true, 'surat' => baris_masuk(ambil_masuk((int) $r['id']))]);
        }

        case 'hapus': {
            wajib_peran('admin');
            $r = ambil_masuk((int) ($in['id'] ?? 0));
            if ($r['status'] !== 'diterima') json_keluar(['error' => 'Surat yang sudah didisposisikan tidak bisa dihapus.'], 409);
            $pdo->prepare('DELETE FROM surat_masuk WHERE id = ? AND status = ?')->execute([$r['id'], 'diterima']);
            hapus_file($r['file_surat']);
            json_keluar(['ok' => true]);
        }

        default:
            json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }
});
