-- Persuratan TSU: skema MySQL untuk alur e-Office.
-- Impor lewat phpMyAdmin / HeidiSQL (opsional): aplikasi juga membuat database & tabel ini otomatis saat pertama dibuka.
--
-- ALUR SURAT MASUK (pakai Disposisi)
--   Admin input surat            -> status 'diterima'
--   Pimpinan buat disposisi staf -> status 'proses_staf'
--   Staf selesaikan tugas        -> status 'selesai'
-- ALUR SURAT KELUAR (ACC + Penomoran, tanpa Disposisi)
--   Staf buat draft              -> status 'menunggu_acc'
--   Pimpinan klik ACC            -> status 'menunggu_nomor' (otomatis masuk antrean Penomoran)
--   Admin Beri Nomor & Terbitkan -> status 'terbit' (nomor mis. 001/TU/XI/2026)

CREATE DATABASE IF NOT EXISTS `persuratan` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `persuratan`;

CREATE TABLE IF NOT EXISTS pengguna (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    nama        VARCHAR(100) NOT NULL,
    email       VARCHAR(120) NOT NULL,
    kata_sandi  VARCHAR(255) NOT NULL,
    peran       ENUM('staf','pimpinan','admin') NOT NULL,
    dibuat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pengguna_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Satu akun dulu: admin (bisa mengakses semua fitur), kata sandi: tsu12345. Hash di bawah dibuat dengan password_hash() PHP; aplikasi juga mengisinya otomatis bila tabel kosong.
-- Jalankan baris berikut dari PHP bila ingin membuat hash sendiri:  php -r "echo password_hash('tsu12345', PASSWORD_DEFAULT);"
INSERT IGNORE INTO pengguna (nama, email, kata_sandi, peran) VALUES
  ('Admin TSU', 'admin@tsu.ac.id', '$2y$10$dbmAT0dXPlouxcvnA9rvD.ZIYzSxOPpU5kFaFCPk7yOoBXV2bvvdG', 'admin');
