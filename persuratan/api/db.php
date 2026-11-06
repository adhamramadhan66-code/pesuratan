<?php
/**
 * Koneksi MySQL (Laragon) + pembuatan database/tabel otomatis.
 *
 * Bawaan Laragon: host 127.0.0.1, port 3306, user root, tanpa kata sandi.
 * Database "persuratan" dan semua tabel dibuat otomatis saat halaman pertama dibuka.
 * Jika Anda mengimpor database.sql lewat phpMyAdmin/HeidiSQL, hasilnya sama saja.
 *
 * Alur e-Office:
 *   Surat masuk : admin input (diterima) -> pimpinan buat disposisi ke staf (proses_staf) -> staf selesaikan (selesai)
 *   Surat keluar: staf buat draft (menunggu_acc) -> pimpinan ACC (menunggu_nomor) -> admin beri nomor & terbitkan (terbit)
 */
const MYSQL_HOST = '127.0.0.1';
const MYSQL_PORT = 3306;
const MYSQL_NAME = 'persuratan';
const MYSQL_USER = 'root';
const MYSQL_PASS = '';

const FOLDER_ARSIP = __DIR__ . '/../data/arsip';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $opts = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $dsn = 'mysql:host=' . MYSQL_HOST . ';port=' . MYSQL_PORT . ';charset=utf8mb4';
    $pdo = new PDO($dsn, MYSQL_USER, MYSQL_PASS, $opts);
    $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . MYSQL_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $pdo->exec('USE `' . MYSQL_NAME . '`');

    buat_tabel($pdo);
    isi_data_awal($pdo);
    if (!is_dir(FOLDER_ARSIP)) mkdir(FOLDER_ARSIP, 0775, true);
    return $pdo;
}

function tabel_ada(PDO $pdo, string $tabel): bool
{
    try { $pdo->query("SELECT 1 FROM `$tabel` LIMIT 0"); return true; } catch (PDOException $e) { return false; }
}

function kolom_ada(PDO $pdo, string $tabel, string $kolom): bool
{
    try { $pdo->query("SELECT `$kolom` FROM `$tabel` LIMIT 0"); return true; } catch (PDOException $e) { return false; }
}

function buat_tabel(PDO $pdo): void
{
    // Skema lama (alur Penomoran -> Disposisi -> ACC) dicadangkan dengan akhiran _lama, datanya tidak dihapus.
    if (tabel_ada($pdo, 'surat_masuk') && !kolom_ada($pdo, 'surat_masuk', 'dibuat_oleh')) {
        foreach (['surat', 'disposisi', 'disposisi_alur', 'surat_masuk'] as $t) {
            if (!tabel_ada($pdo, $t)) continue;
            $baru = $t . '_lama';
            if (tabel_ada($pdo, $baru)) $baru .= '_' . date('YmdHis');
            $pdo->exec("ALTER TABLE `$t` RENAME TO `$baru`");
        }
    }

    // Akun login. Peran: staf (membuat draft, menyelesaikan disposisi), pimpinan (ACC, disposisi), admin (input surat masuk, penomoran, arsip).
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS pengguna (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    nama        VARCHAR(100) NOT NULL,
    email       VARCHAR(120) NOT NULL,
    kata_sandi  VARCHAR(255) NOT NULL,
    peran       ENUM('staf','pimpinan','admin') NOT NULL,
    dibuat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pengguna_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL);

    // Surat masuk. diterima -> proses_staf (saat pimpinan membuat disposisi) -> selesai (saat staf menyelesaikan tugas).
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS surat_masuk (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    tahun            SMALLINT     NOT NULL,
    bulan            TINYINT      NOT NULL,
    urut             INT          NOT NULL,
    nomor_agenda     VARCHAR(40)  NOT NULL,
    nomor_surat_asal VARCHAR(100) NOT NULL DEFAULT '',
    tanggal_surat    DATE NULL,
    tanggal_terima   DATE         NOT NULL,
    pengirim         VARCHAR(150) NOT NULL,
    perihal          VARCHAR(255) NOT NULL,
    sifat            ENUM('biasa','penting','segera','rahasia') NOT NULL DEFAULT 'biasa',
    status           ENUM('diterima','proses_staf','selesai') NOT NULL DEFAULT 'diterima',
    file_surat       VARCHAR(80)  NOT NULL DEFAULT '',
    file_nama        VARCHAR(200) NOT NULL DEFAULT '',
    status_arsip     ENUM('belum','diarsipkan') NOT NULL DEFAULT 'belum',
    tanggal_arsip    DATE NULL,
    lokasi_arsip     VARCHAR(150) NOT NULL DEFAULT '',
    keterangan_arsip VARCHAR(255) NOT NULL DEFAULT '',
    dibuat_oleh      INT          NOT NULL,
    dibuat_pada      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_agenda (tahun, bulan, urut),
    KEY idx_sm_status (status),
    KEY idx_sm_tanggal (tanggal_terima),
    CONSTRAINT fk_sm_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL);

    // Disposisi: pimpinan meneruskan surat masuk ke satu staf. Satu surat masuk = satu disposisi.
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS disposisi (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    surat_masuk_id    INT          NOT NULL,
    pimpinan_id       INT          NOT NULL,
    staf_id           INT          NOT NULL,
    instruksi         VARCHAR(500) NOT NULL,
    batas_waktu       DATE NULL,
    tanggal_disposisi DATE         NOT NULL,
    status            ENUM('proses_staf','selesai') NOT NULL DEFAULT 'proses_staf',
    catatan_selesai   VARCHAR(500) NOT NULL DEFAULT '',
    tanggal_selesai   DATE NULL,
    dibuat_pada       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dsp_surat (surat_masuk_id),
    KEY idx_dsp_staf (staf_id),
    CONSTRAINT fk_dsp_surat   FOREIGN KEY (surat_masuk_id) REFERENCES surat_masuk (id),
    CONSTRAINT fk_dsp_pimpinan FOREIGN KEY (pimpinan_id)   REFERENCES pengguna (id),
    CONSTRAINT fk_dsp_staf    FOREIGN KEY (staf_id)        REFERENCES pengguna (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL);

    // Surat keluar: menunggu_acc -> menunggu_nomor (setelah ACC pimpinan, masuk antrean Penomoran) -> terbit (setelah diberi nomor).
    // nomor_surat baru terisi saat terbit. Nomor otomatis berformat NNN/TU/BULAN_ROMAWI/TAHUN dan urut per bulan.
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS surat_keluar (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    perihal          VARCHAR(255) NOT NULL,
    tujuan           VARCHAR(255) NOT NULL,
    tanggal_surat    DATE         NOT NULL,
    status           ENUM('menunggu_acc','menunggu_nomor','terbit') NOT NULL DEFAULT 'menunggu_acc',
    file_surat       VARCHAR(80)  NOT NULL DEFAULT '',
    file_nama        VARCHAR(200) NOT NULL DEFAULT '',
    pembuat_id       INT          NOT NULL,
    acc_oleh         INT NULL,
    tanggal_acc      DATETIME NULL,
    nomor_surat      VARCHAR(60) NULL,
    mode_nomor       ENUM('otomatis','manual') NULL,
    tahun            SMALLINT NULL,
    bulan            TINYINT NULL,
    nomor_urut       INT NULL,
    diterbitkan_oleh INT NULL,
    tanggal_terbit   DATETIME NULL,
    status_arsip     ENUM('belum','diarsipkan') NOT NULL DEFAULT 'belum',
    tanggal_arsip    DATE NULL,
    lokasi_arsip     VARCHAR(150) NOT NULL DEFAULT '',
    keterangan_arsip VARCHAR(255) NOT NULL DEFAULT '',
    dibuat_pada      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sk_nomor (nomor_surat),
    UNIQUE KEY uq_sk_urut (tahun, bulan, nomor_urut),
    KEY idx_sk_status (status),
    KEY idx_sk_tanggal (tanggal_surat),
    CONSTRAINT fk_sk_pembuat FOREIGN KEY (pembuat_id) REFERENCES pengguna (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL);
}

/**
 * Untuk sementara hanya ada SATU akun: admin (bisa mengakses semua fitur). Kata sandi: tsu12345.
 * Akun pimpinan/staf contoh dari versi sebelumnya dihapus bila belum dipakai di data apa pun.
 */
function isi_data_awal(PDO $pdo): void
{
    $s = $pdo->prepare('SELECT COUNT(*) FROM pengguna WHERE email = ?');
    $s->execute(['admin@tsu.ac.id']);
    if (!(int) $s->fetchColumn()) {
        $pdo->prepare('INSERT INTO pengguna (nama, email, kata_sandi, peran) VALUES (?, ?, ?, ?)')
            ->execute(['Admin TSU', 'admin@tsu.ac.id', password_hash('tsu12345', PASSWORD_DEFAULT), 'admin']);
    }
    $pdo->exec("DELETE FROM pengguna WHERE email IN ('pimpinan@tsu.ac.id', 'staf@tsu.ac.id', 'staf2@tsu.ac.id')
        AND id NOT IN (SELECT pembuat_id FROM surat_keluar) AND id NOT IN (SELECT dibuat_oleh FROM surat_masuk)
        AND id NOT IN (SELECT staf_id FROM disposisi) AND id NOT IN (SELECT pimpinan_id FROM disposisi)");
}

/** Angka bulan -> romawi (1 => I ... 12 => XII). */
function bulan_romawi(int $b): string
{
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][$b] ?? '';
}
