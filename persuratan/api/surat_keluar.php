<?php
/**
 * API Surat Keluar (alur ACC + Penomoran, tanpa disposisi).
 *
 *   status: menunggu_acc -> (pimpinan ACC) -> menunggu_nomor -> (admin Beri Nomor & Terbitkan) -> terbit
 *
 * GET  ?aksi=daftar[&status=&q=&tahun=&bulan=]   semua peran (staf hanya melihat drafnya sendiri yang belum terbit)
 *      ?aksi=file&id=N[&unduh=1]                 pratinjau/unduh file draf
 *      ?aksi=generate_nomor[&mode=otomatis]      admin: nomor urut berikutnya, mis. 001/TU/XI/2026
 * POST aksi=buat_draft   (staf)     perihal, tujuan, tanggal_surat, file
 *      aksi=ubah         (staf)     id, perihal, tujuan, tanggal_surat, [file]   (hanya saat menunggu_acc, milik sendiri)
 *      aksi=hapus        (staf)     id                                           (hanya saat menunggu_acc, milik sendiri)
 *      aksi=acc          (pimpinan) id                                           menunggu_acc -> menunggu_nomor
 *      aksi=surat_baru   (admin)    perihal, tujuan, tanggal_surat, mode, [nomor_manual], [file]  -> langsung terbit
 *      aksi=terbitkan    (admin)    id, mode (otomatis|manual), [nomor_manual]   menunggu_nomor -> terbit
 */
require __DIR__ . '/umum.php';

const KODE_UNIT = 'TU';

/** Kolom yang dikirim ke frontend. */
const SQL_KELUAR = "SELECT k.*, p.nama AS pembuat_nama, a.nama AS acc_nama, t.nama AS terbit_nama
    FROM surat_keluar k
    JOIN pengguna p ON p.id = k.pembuat_id
    LEFT JOIN pengguna a ON a.id = k.acc_oleh
    LEFT JOIN pengguna t ON t.id = k.diterbitkan_oleh";

function baris_keluar(array $r): array
{
    return [
        'id' => (int) $r['id'], 'perihal' => $r['perihal'], 'tujuan' => $r['tujuan'],
        'tanggal_surat' => $r['tanggal_surat'], 'status' => $r['status'],
        'nomor_surat' => $r['nomor_surat'], 'mode_nomor' => $r['mode_nomor'],
        'pembuat_id' => (int) $r['pembuat_id'], 'pembuat' => $r['pembuat_nama'],
        'acc_oleh' => $r['acc_nama'], 'tanggal_acc' => $r['tanggal_acc'],
        'diterbitkan_oleh' => $r['terbit_nama'], 'tanggal_terbit' => $r['tanggal_terbit'],
        'ada_file' => $r['file_surat'] !== '' && is_file(FOLDER_ARSIP . '/' . $r['file_surat']),
        'file_nama' => $r['file_nama'], 'file_tipe' => pathinfo($r['file_surat'], PATHINFO_EXTENSION),
        'status_arsip' => $r['status_arsip'], 'tanggal_arsip' => $r['tanggal_arsip'],
        'lokasi_arsip' => $r['lokasi_arsip'], 'keterangan_arsip' => $r['keterangan_arsip'],
    ];
}

function ambil_keluar(int $id): array
{
    $s = db()->prepare(SQL_KELUAR . ' WHERE k.id = ?');
    $s->execute([$id]);
    $r = $s->fetch();
    if (!$r) json_keluar(['error' => 'Surat tidak ditemukan.'], 404);
    return $r;
}

/** Nomor urut terbesar yang sudah dipakai pada bulan+tahun itu, ditambah 1. */
function nomor_berikut(int $tahun, int $bulan): array
{
    $s = db()->prepare('SELECT COALESCE(MAX(nomor_urut), 0) FROM surat_keluar WHERE tahun = ? AND bulan = ?');
    $s->execute([$tahun, $bulan]);
    $urut = (int) $s->fetchColumn() + 1;
    return [$urut, sprintf('%03d/%s/%s/%d', $urut, KODE_UNIT, bulan_romawi($bulan), $tahun)];
}

function data_draf(array $in): array
{
    $perihal = teks($in['perihal'] ?? '');
    $tujuan = teks($in['tujuan'] ?? '');
    $tgl = tanggal_atau_null($in['tanggal_surat'] ?? '') ?? date('Y-m-d');
    if ($perihal === '') json_keluar(['error' => 'Perihal wajib diisi.'], 422);
    if ($tujuan === '') json_keluar(['error' => 'Tujuan surat wajib diisi.'], 422);
    return [$perihal, $tujuan, $tgl];
}

function baca_mode(array $in): array
{
    $mode = ($in['mode'] ?? 'otomatis') === 'manual' ? 'manual' : 'otomatis';
    $manual = teks($in['nomor_manual'] ?? '', 60);
    if ($mode === 'manual' && $manual === '') json_keluar(['error' => 'Isi nomor manual, atau pilih nomor otomatis.'], 422);
    return [$mode, $manual];
}

/** menunggu_nomor -> terbit. Mengembalikan baris surat; kegagalan dijawab langsung sebagai JSON. */
function terbitkan_surat(int $id, array $u, string $mode, string $manual, bool $wajibFile = true): array
{
    $pdo = db();
    $r = ambil_keluar($id);
    if ($r['status'] !== 'menunggu_nomor') json_keluar(['error' => 'Surat ini tidak berada di antrean penomoran (status: ' . $r['status'] . ').'], 409);
    if ($wajibFile && $r['file_surat'] === '') json_keluar(['error' => 'Surat belum punya file draf.'], 422);

    $tahun = (int) date('Y'); $bulan = (int) date('n');
    // Nomor otomatis diulang bila bentrok (dua admin menerbitkan bersamaan).
    for ($coba = 0; $coba < 5; $coba++) {
        if ($mode === 'otomatis') { [$urut, $nomor] = nomor_berikut($tahun, $bulan); }
        else { $urut = null; $nomor = $manual; }
        try {
            $s = $pdo->prepare("UPDATE surat_keluar SET status='terbit', nomor_surat=?, mode_nomor=?, tahun=?, bulan=?, nomor_urut=?,
                diterbitkan_oleh=?, tanggal_terbit=? WHERE id=? AND status='menunggu_nomor'");
            $s->execute([$nomor, $mode, $tahun, $bulan, $urut, $u['id'], date('Y-m-d H:i:s'), $id]);
        } catch (PDOException $e) {
            if ($e->getCode() !== '23000') throw $e;
            if ($mode === 'manual') json_keluar(['error' => "Nomor \"$manual\" sudah dipakai surat lain."], 409);
            continue;
        }
        if ($s->rowCount() === 0) json_keluar(['error' => 'Surat ini sudah diterbitkan oleh admin lain.'], 409);
        return ambil_keluar($id);
    }
    json_keluar(['error' => 'Gagal mengambil nomor urut, coba lagi.'], 409);
}

jalankan(function () {
    $metode = $_SERVER['REQUEST_METHOD'];

    // ---------- GET ----------
    if ($metode === 'GET') {
        $u = wajib_login();
        $aksi = $_GET['aksi'] ?? 'daftar';

        if ($aksi === 'file') {
            $r = ambil_keluar((int) ($_GET['id'] ?? 0));
            if ($u['peran'] === 'staf' && (int) $r['pembuat_id'] !== $u['id'] && $r['status'] !== 'terbit') {
                json_keluar(['error' => 'Draf ini milik staf lain.'], 403);
            }
            if ($r['file_surat'] === '') { http_response_code(404); exit('Surat ini belum punya file.'); }
            kirim_file($r['file_surat'], $r['nomor_surat'] ?: ('draf-' . $r['id']));
        }

        if ($aksi === 'generate_nomor') {
            wajib_peran('admin');
            $tahun = (int) date('Y'); $bulan = (int) date('n');
            [$urut, $nomor] = nomor_berikut($tahun, $bulan);
            json_keluar(['urut' => $urut, 'nomor' => $nomor, 'tahun' => $tahun, 'bulan' => $bulan]);
        }

        if ($aksi === 'daftar') {
            $w = []; $p = [];
            $status = $_GET['status'] ?? '';
            if (in_array($status, ['menunggu_acc', 'menunggu_nomor', 'terbit'], true)) { $w[] = 'k.status = ?'; $p[] = $status; }
            // Staf melihat drafnya sendiri + semua surat yang sudah terbit.
            if ($u['peran'] === 'staf') { $w[] = "(k.pembuat_id = ? OR k.status = 'terbit')"; $p[] = $u['id']; }
            if (($tahun = (int) ($_GET['tahun'] ?? 0)) > 0) { $w[] = 'YEAR(k.tanggal_surat) = ?'; $p[] = $tahun; }
            if (($bulan = (int) ($_GET['bulan'] ?? 0)) > 0) { $w[] = 'MONTH(k.tanggal_surat) = ?'; $p[] = $bulan; }
            if (($q = teks($_GET['q'] ?? '', 80)) !== '') {
                $w[] = '(k.perihal LIKE ? OR k.tujuan LIKE ? OR k.nomor_surat LIKE ? OR p.nama LIKE ?)';
                array_push($p, "%$q%", "%$q%", "%$q%", "%$q%");
            }
            $sql = SQL_KELUAR . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY k.id DESC LIMIT 500';
            $s = db()->prepare($sql);
            $s->execute($p);
            json_keluar(['data' => array_map('baris_keluar', $s->fetchAll())]);
        }
        json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }

    if ($metode !== 'POST') json_keluar(['error' => 'Metode tidak didukung.'], 405);
    $in = masukan();
    $aksi = $in['aksi'] ?? '';
    $pdo = db();

    switch ($aksi) {
        case 'buat_draft': {
            $u = wajib_peran('staf');
            [$perihal, $tujuan, $tgl] = data_draf($in);
            $f = simpan_unggahan();
            if (!$f) json_keluar(['error' => 'Unggah file draf surat (PDF/JPG/PNG).'], 422);
            $s = $pdo->prepare("INSERT INTO surat_keluar (perihal, tujuan, tanggal_surat, status, file_surat, file_nama, pembuat_id)
                VALUES (?, ?, ?, 'menunggu_acc', ?, ?, ?)");
            $s->execute([$perihal, $tujuan, $tgl, $f[0], $f[1], $u['id']]);
            json_keluar(['ok' => true, 'surat' => baris_keluar(ambil_keluar((int) $pdo->lastInsertId()))], 201);
        }

        case 'ubah': {
            $u = wajib_peran('staf');
            $r = ambil_keluar((int) ($in['id'] ?? 0));
            if ($u['peran'] !== 'admin' && (int) $r['pembuat_id'] !== $u['id']) json_keluar(['error' => 'Hanya pembuat draf yang boleh mengubahnya.'], 403);
            if ($r['status'] !== 'menunggu_acc') json_keluar(['error' => 'Draf yang sudah di-ACC tidak bisa diubah.'], 409);
            [$perihal, $tujuan, $tgl] = data_draf($in);
            $f = simpan_unggahan();
            $file = $f ? $f[0] : $r['file_surat'];
            $nama = $f ? $f[1] : $r['file_nama'];
            $pdo->prepare('UPDATE surat_keluar SET perihal=?, tujuan=?, tanggal_surat=?, file_surat=?, file_nama=? WHERE id=? AND status=?')
                ->execute([$perihal, $tujuan, $tgl, $file, $nama, $r['id'], 'menunggu_acc']);
            if ($f) hapus_file($r['file_surat']);
            json_keluar(['ok' => true, 'surat' => baris_keluar(ambil_keluar((int) $r['id']))]);
        }

        case 'hapus': {
            $u = wajib_peran('staf');
            $r = ambil_keluar((int) ($in['id'] ?? 0));
            if ($u['peran'] !== 'admin' && (int) $r['pembuat_id'] !== $u['id']) json_keluar(['error' => 'Hanya pembuat draf yang boleh menghapusnya.'], 403);
            if ($r['status'] !== 'menunggu_acc') json_keluar(['error' => 'Draf yang sudah di-ACC tidak bisa dihapus.'], 409);
            $pdo->prepare('DELETE FROM surat_keluar WHERE id = ? AND status = ?')->execute([$r['id'], 'menunggu_acc']);
            hapus_file($r['file_surat']);
            json_keluar(['ok' => true]);
        }

        case 'acc': {
            $u = wajib_peran('pimpinan');
            $id = (int) ($in['id'] ?? 0);
            // Pembaruan bersyarat: hanya berhasil bila statusnya masih menunggu_acc (aman dari klik ganda).
            $s = $pdo->prepare("UPDATE surat_keluar SET status='menunggu_nomor', acc_oleh=?, tanggal_acc=? WHERE id=? AND status='menunggu_acc'");
            $s->execute([$u['id'], date('Y-m-d H:i:s'), $id]);
            if ($s->rowCount() === 0) {
                $r = ambil_keluar($id);
                json_keluar(['error' => 'Surat ini sudah di-ACC sebelumnya (status: ' . $r['status'] . ').'], 409);
            }
            json_keluar(['ok' => true, 'surat' => baris_keluar(ambil_keluar($id))]);
        }

        case 'terbitkan': {
            $u = wajib_peran('admin');
            [$mode, $manual] = baca_mode($in);
            json_keluar(['ok' => true, 'surat' => baris_keluar(terbitkan_surat((int) ($in['id'] ?? 0), $u, $mode, $manual))]);
        }

        // Admin membuat surat langsung di Penomoran: simpan, lewati ACC, beri nomor, terbit dalam satu langkah.
        case 'surat_baru': {
            $u = wajib_peran('admin');
            [$perihal, $tujuan, $tgl] = data_draf($in);
            [$mode, $manual] = baca_mode($in);
            $f = simpan_unggahan();
            $pdo->prepare("INSERT INTO surat_keluar (perihal, tujuan, tanggal_surat, status, file_surat, file_nama, pembuat_id, acc_oleh, tanggal_acc)
                VALUES (?, ?, ?, 'menunggu_nomor', ?, ?, ?, ?, ?)")
                ->execute([$perihal, $tujuan, $tgl, $f[0] ?? '', $f[1] ?? '', $u['id'], $u['id'], date('Y-m-d H:i:s')]);
            $id = (int) $pdo->lastInsertId();
            try {
                $r = terbitkan_surat($id, $u, $mode, $manual, false);
            } catch (Throwable $e) {                     // gagal (mis. nomor manual kembar): batalkan surat yang baru dibuat
                $pdo->prepare('DELETE FROM surat_keluar WHERE id = ?')->execute([$id]);
                if ($f) hapus_file($f[0]);
                throw $e;
            }
            json_keluar(['ok' => true, 'surat' => baris_keluar($r)], 201);
        }

        default:
            json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }
});
