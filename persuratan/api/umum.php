<?php
/**
 * Fungsi bersama semua API: keluaran JSON, sesi login per peran, dan penanganan file unggahan.
 * Peran: 'staf', 'pimpinan', 'admin'.
 */
require __DIR__ . '/db.php';

const MAKS_UKURAN = 10 * 1024 * 1024;                       // 10 MB
const TIPE_FILE = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'];

function json_keluar($data, int $kode = 200): void
{
    http_response_code($kode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function teks($v, int $maks = 255): string
{
    $v = trim(preg_replace('/\s+/u', ' ', (string) $v));
    return function_exists('mb_substr') ? mb_substr($v, 0, $maks) : substr($v, 0, $maks);
}

/** 'YYYY-MM-DD' yang benar-benar ada di kalender, atau null. */
function tanggal_atau_null($v): ?string
{
    $d = DateTime::createFromFormat('!Y-m-d', (string) $v);
    return ($d && $d->format('Y-m-d') === $v) ? $v : null;
}

/** Isi permintaan POST: multipart (form dengan file) atau JSON. */
function masukan(): array
{
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') === 0) {
        if (!$_POST && !$_FILES && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
            json_keluar(['error' => 'Ukuran file melebihi batas server (post_max_size di php.ini).'], 413);
        }
        return $_POST;
    }
    if ($_POST) return $_POST;                                // form biasa (x-www-form-urlencoded)
    $in = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($in) ? $in : [];
}

// ---------- Sesi login ----------
function mulai_sesi(): void
{
    if (session_status() !== PHP_SESSION_NONE) return;
    session_name('persuratan');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function pengguna_sekarang(): ?array
{
    mulai_sesi();
    $u = $_SESSION['pengguna'] ?? null;
    session_write_close();                     // lepas kunci sesi agar permintaan paralel tidak saling menunggu
    return is_array($u) ? $u : null;
}

function wajib_login(): array
{
    $u = pengguna_sekarang();
    if (!$u) json_keluar(['error' => 'Sesi login berakhir. Silakan login kembali.'], 401);
    return $u;
}

/** Hanya peran yang disebut yang boleh melanjutkan. */
function wajib_peran(string ...$peran): array
{
    $u = wajib_login();
    if (!in_array($u['peran'], $peran, true)) {
        $nama = ['staf' => 'Staf', 'pimpinan' => 'Pimpinan', 'admin' => 'Admin'];
        json_keluar(['error' => 'Aksi ini hanya untuk ' . implode(' / ', array_map(fn($p) => $nama[$p] ?? $p, $peran)) . '.'], 403);
    }
    return $u;
}

// ---------- File ----------
function nama_aman(string $f): bool { return (bool) preg_match('/^[a-f0-9]{32}\.(pdf|jpg|png)$/', $f); }

function hapus_file(string $f): void
{
    if ($f !== '' && nama_aman($f)) @unlink(FOLDER_ARSIP . '/' . $f);
}

/** Simpan file unggahan (PDF/JPG/PNG, maks. 10 MB). Mengembalikan [nama_di_server, nama_asli], atau null bila tidak ada file. */
function simpan_unggahan(string $kolom = 'file'): ?array
{
    $up = $_FILES[$kolom] ?? null;
    if (!$up || $up['error'] === UPLOAD_ERR_NO_FILE) return null;
    if ($up['error'] === UPLOAD_ERR_INI_SIZE || $up['error'] === UPLOAD_ERR_FORM_SIZE) json_keluar(['error' => 'Ukuran file melebihi batas server (upload_max_filesize di php.ini).'], 413);
    if ($up['error'] !== UPLOAD_ERR_OK) json_keluar(['error' => 'Upload file gagal (kode ' . $up['error'] . ').'], 400);
    if ($up['size'] > MAKS_UKURAN) json_keluar(['error' => 'Ukuran file maksimal 10 MB.'], 422);
    $mime = function_exists('finfo_open') ? finfo_file(finfo_open(FILEINFO_MIME_TYPE), $up['tmp_name']) : '';
    if (!isset(TIPE_FILE[$mime])) json_keluar(['error' => 'Format file harus PDF, JPG, atau PNG.'], 422);
    if (!is_dir(FOLDER_ARSIP)) @mkdir(FOLDER_ARSIP, 0775, true);
    $nama = bin2hex(random_bytes(16)) . '.' . TIPE_FILE[$mime];
    if (!move_uploaded_file($up['tmp_name'], FOLDER_ARSIP . '/' . $nama)) json_keluar(['error' => 'Gagal menyimpan file ke folder data/arsip.'], 500);
    return [$nama, teks(basename((string) $up['name']), 200)];
}

/** Kirim file ke peramban (tampil langsung, atau unduh bila ?unduh=1). */
function kirim_file(string $file, string $namaDasar): void
{
    $path = FOLDER_ARSIP . '/' . $file;
    if (!nama_aman($file) || !is_file($path)) { http_response_code(404); exit('File tidak ditemukan.'); }
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    $mime = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'png' => 'image/png'][$ext];
    $unduh = ($_GET['unduh'] ?? '') === '1' ? 'attachment' : 'inline';
    $nama = preg_replace('/[^A-Za-z0-9._-]+/', '_', str_replace('/', '-', $namaDasar)) . '.' . $ext;
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    header('X-Content-Type-Options: nosniff');
    header("Content-Disposition: $unduh; filename=\"$nama\"");
    readfile($path);
    exit;
}

/** Bungkus isi API: kesalahan server dan MySQL mati dijawab sebagai JSON. */
function jalankan(callable $isi): void
{
    try {
        $isi();
    } catch (Throwable $e) {
        $pesan = $e instanceof PDOException && in_array($e->getCode(), [2002, 1045])
            ? 'Tidak dapat terhubung ke MySQL. Pastikan MySQL di Laragon sudah Start.'
            : 'Kesalahan server: ' . $e->getMessage();
        json_keluar(['error' => $pesan], 500);
    }
}
