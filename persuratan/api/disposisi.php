<?php
/**
 * API Disposisi (khusus surat masuk).
 *
 * GET  ?aksi=daftar[&status=proses_staf|selesai]   pimpinan & admin: semua; staf: yang ditujukan kepadanya
 *      ?aksi=staf                                  pimpinan: daftar staf tujuan disposisi
 * POST aksi=buat    (pimpinan) surat_masuk_id, staf_id, instruksi, [batas_waktu]   diterima -> proses_staf
 *      aksi=selesai (staf)     id (disposisi), [catatan]                           proses_staf -> selesai
 */
require __DIR__ . '/umum.php';
require_once __DIR__ . '/surat_masuk_fungsi.php';

jalankan(function () {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $u = wajib_login();
        $aksi = $_GET['aksi'] ?? 'daftar';

        if ($aksi === 'staf') {
            wajib_peran('pimpinan');
            $d = $pdo->query("SELECT id, nama, email FROM pengguna WHERE peran = 'staf' ORDER BY nama")->fetchAll();
            json_keluar(['data' => $d]);
        }

        if ($aksi === 'daftar') {
            $w = []; $p = [];
            if (in_array($_GET['status'] ?? '', ['proses_staf', 'selesai'], true)) { $w[] = 'd.status = ?'; $p[] = $_GET['status']; }
            if ($u['peran'] === 'staf') { $w[] = 'd.staf_id = ?'; $p[] = $u['id']; }
            if (($q = teks($_GET['q'] ?? '', 80)) !== '') {
                $w[] = '(m.perihal LIKE ? OR m.pengirim LIKE ? OR m.nomor_agenda LIKE ? OR st.nama LIKE ? OR d.instruksi LIKE ?)';
                array_push($p, "%$q%", "%$q%", "%$q%", "%$q%", "%$q%");
            }
            $s = $pdo->prepare("SELECT d.id, d.status, d.instruksi, d.batas_waktu, d.tanggal_disposisi, d.catatan_selesai, d.tanggal_selesai,
                    d.staf_id, st.nama AS staf_nama, pm.nama AS pimpinan_nama,
                    m.id AS surat_id, m.nomor_agenda, m.pengirim, m.perihal, m.sifat, m.file_surat, m.file_nama
                FROM disposisi d
                JOIN surat_masuk m ON m.id = d.surat_masuk_id
                JOIN pengguna st ON st.id = d.staf_id
                JOIN pengguna pm ON pm.id = d.pimpinan_id"
                . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY d.id DESC LIMIT 500');
            $s->execute($p);
            $data = array_map(fn($r) => [
                'id' => (int) $r['id'], 'status' => $r['status'], 'instruksi' => $r['instruksi'], 'batas_waktu' => $r['batas_waktu'],
                'tanggal' => $r['tanggal_disposisi'], 'catatan_selesai' => $r['catatan_selesai'], 'tanggal_selesai' => $r['tanggal_selesai'],
                'staf_id' => (int) $r['staf_id'], 'staf' => $r['staf_nama'], 'pimpinan' => $r['pimpinan_nama'],
                'surat' => [
                    'id' => (int) $r['surat_id'], 'nomor_agenda' => $r['nomor_agenda'], 'pengirim' => $r['pengirim'],
                    'perihal' => $r['perihal'], 'sifat' => $r['sifat'],
                    'ada_file' => $r['file_surat'] !== '' && is_file(FOLDER_ARSIP . '/' . $r['file_surat']),
                    'file_tipe' => pathinfo($r['file_surat'], PATHINFO_EXTENSION),
                ],
            ], $s->fetchAll());
            json_keluar(['data' => $data]);
        }
        json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_keluar(['error' => 'Metode tidak didukung.'], 405);
    $in = masukan();

    switch ($in['aksi'] ?? '') {
        case 'buat': {
            $u = wajib_peran('pimpinan');
            $suratId = (int) ($in['surat_masuk_id'] ?? 0);
            $stafId = (int) ($in['staf_id'] ?? 0);
            $instruksi = teks($in['instruksi'] ?? '', 500);
            if ($instruksi === '') json_keluar(['error' => 'Isi instruksi disposisi.'], 422);
            $batas = ($in['batas_waktu'] ?? '') === '' ? null : tanggal_atau_null($in['batas_waktu']);
            if (($in['batas_waktu'] ?? '') !== '' && !$batas) json_keluar(['error' => 'Batas waktu tidak valid.'], 422);
            $c = $pdo->prepare("SELECT COUNT(*) FROM pengguna WHERE id = ? AND peran = 'staf'");
            $c->execute([$stafId]);
            if (!(int) $c->fetchColumn()) json_keluar(['error' => 'Pilih staf tujuan disposisi.'], 422);

            $pdo->beginTransaction();
            try {
                // Pembaruan bersyarat: hanya satu disposisi per surat, hanya dari status 'diterima'.
                $s = $pdo->prepare("UPDATE surat_masuk SET status='proses_staf' WHERE id=? AND status='diterima'");
                $s->execute([$suratId]);
                if ($s->rowCount() === 0) {
                    $pdo->rollBack();
                    json_keluar(['error' => 'Surat ini tidak ditemukan atau sudah didisposisikan.'], 409);
                }
                $pdo->prepare("INSERT INTO disposisi (surat_masuk_id, pimpinan_id, staf_id, instruksi, batas_waktu, tanggal_disposisi, status)
                    VALUES (?,?,?,?,?,?, 'proses_staf')")->execute([$suratId, $u['id'], $stafId, $instruksi, $batas, date('Y-m-d')]);
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $e;
            }
            json_keluar(['ok' => true, 'surat' => baris_masuk(ambil_masuk($suratId))], 201);
        }

        case 'selesai': {
            $u = wajib_peran('staf');
            $id = (int) ($in['id'] ?? 0);
            $s = $pdo->prepare('SELECT * FROM disposisi WHERE id = ?');
            $s->execute([$id]);
            $d = $s->fetch();
            if (!$d) json_keluar(['error' => 'Disposisi tidak ditemukan.'], 404);
            if ((int) $d['staf_id'] !== $u['id']) json_keluar(['error' => 'Disposisi ini ditujukan kepada staf lain.'], 403);
            if ($d['status'] !== 'proses_staf') json_keluar(['error' => 'Disposisi ini sudah selesai.'], 409);

            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE disposisi SET status='selesai', catatan_selesai=?, tanggal_selesai=? WHERE id=? AND status='proses_staf'")
                    ->execute([teks($in['catatan'] ?? '', 500), date('Y-m-d'), $id]);
                $pdo->prepare("UPDATE surat_masuk SET status='selesai' WHERE id=?")->execute([$d['surat_masuk_id']]);
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $e;
            }
            json_keluar(['ok' => true, 'surat' => baris_masuk(ambil_masuk((int) $d['surat_masuk_id']))]);
        }

        default:
            json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }
});
