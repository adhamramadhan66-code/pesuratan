<?php
/** GET api/statistik.php[?tahun=] -> angka ringkas dashboard (semua peran yang login). */
require __DIR__ . '/umum.php';

jalankan(function () {
    $u = wajib_login();
    $pdo = db();
    $tahun = (int) ($_GET['tahun'] ?? date('Y'));

    $hitung = function (string $tabel) use ($pdo): array {
        $o = [];
        foreach ($pdo->query("SELECT status, COUNT(*) n FROM $tabel GROUP BY status")->fetchAll() as $r) $o[$r['status']] = (int) $r['n'];
        return $o;
    };
    $masuk = $hitung('surat_masuk');
    $keluar = $hitung('surat_keluar');

    $bulanan = function (string $sql) use ($pdo, $tahun): array {
        $a = array_fill(1, 12, 0);
        $s = $pdo->prepare($sql);
        $s->execute([$tahun]);
        foreach ($s->fetchAll() as $r) $a[(int) $r['b']] = (int) $r['n'];
        return array_values($a);
    };

    $arsip = $pdo->query("SELECT
        (SELECT COUNT(*) FROM surat_keluar WHERE status='terbit' AND status_arsip='diarsipkan') + (SELECT COUNT(*) FROM surat_masuk WHERE status='selesai' AND status_arsip='diarsipkan') AS sudah,
        (SELECT COUNT(*) FROM surat_keluar WHERE status='terbit' AND status_arsip='belum') + (SELECT COUNT(*) FROM surat_masuk WHERE status='selesai' AND status_arsip='belum') AS belum")->fetch();

    $tugas = 0;
    if ($u['peran'] === 'staf') {
        $s = $pdo->prepare("SELECT COUNT(*) FROM disposisi WHERE staf_id = ? AND status = 'proses_staf'");
        $s->execute([$u['id']]); $tugas = (int) $s->fetchColumn();
    }

    json_keluar([
        'tahun' => $tahun,
        'masuk' => ['diterima' => $masuk['diterima'] ?? 0, 'proses_staf' => $masuk['proses_staf'] ?? 0, 'selesai' => $masuk['selesai'] ?? 0],
        'keluar' => ['menunggu_acc' => $keluar['menunggu_acc'] ?? 0, 'menunggu_nomor' => $keluar['menunggu_nomor'] ?? 0, 'terbit' => $keluar['terbit'] ?? 0],
        'arsip' => ['sudah' => (int) $arsip['sudah'], 'belum' => (int) $arsip['belum']],
        'tugas_saya' => $tugas,
        'bulanan_masuk' => $bulanan('SELECT MONTH(tanggal_terima) b, COUNT(*) n FROM surat_masuk WHERE YEAR(tanggal_terima)=? GROUP BY b'),
        'bulanan_keluar' => $bulanan("SELECT MONTH(tanggal_terbit) b, COUNT(*) n FROM surat_keluar WHERE status='terbit' AND YEAR(tanggal_terbit)=? GROUP BY b"),
    ]);
});
