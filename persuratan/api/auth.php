<?php
/**
 * API login per peran.
 *   GET  api/auth.php?aksi=saya                 -> pengguna yang sedang login (401 bila belum)
 *   POST api/auth.php {aksi: login, email, kata_sandi} | {aksi: logout}
 */
require __DIR__ . '/umum.php';

jalankan(function () {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (($_GET['aksi'] ?? '') !== 'saya') json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
        $u = pengguna_sekarang();
        if (!$u) json_keluar(['error' => 'Belum login.'], 401);
        json_keluar(['pengguna' => $u]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_keluar(['error' => 'Metode tidak didukung.'], 405);
    $in = masukan();

    switch ($in['aksi'] ?? '') {
        case 'login':
            $email = strtolower(teks($in['email'] ?? '', 120));
            $sandi = (string) ($in['kata_sandi'] ?? '');
            if ($email === '' || $sandi === '') json_keluar(['error' => 'Masukkan email dan kata sandi.'], 422);
            $s = db()->prepare('SELECT id, nama, email, kata_sandi, peran FROM pengguna WHERE email = ?');
            $s->execute([$email]);
            $p = $s->fetch();
            if (!$p || !password_verify($sandi, $p['kata_sandi'])) {
                usleep(400000);                // memperlambat tebak-tebakan kata sandi
                json_keluar(['error' => 'Email atau kata sandi salah.'], 401);
            }
            mulai_sesi();
            session_regenerate_id(true);
            $_SESSION['pengguna'] = ['id' => (int) $p['id'], 'nama' => $p['nama'], 'email' => $p['email'], 'peran' => $p['peran']];
            $u = $_SESSION['pengguna'];
            session_write_close();
            json_keluar(['ok' => true, 'pengguna' => $u]);

        case 'logout':
            mulai_sesi();
            $_SESSION = [];
            if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
            json_keluar(['ok' => true]);

        default:
            json_keluar(['error' => 'Aksi tidak dikenal.'], 400);
    }
});
