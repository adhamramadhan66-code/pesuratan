<?php
/** Fungsi bersama untuk surat masuk (dipakai surat_masuk.php dan disposisi.php). */
require_once __DIR__ . '/umum.php';

const SIFAT_BOLEH = ['biasa', 'penting', 'segera', 'rahasia'];

const SQL_MASUK = "SELECT m.*, d.id AS disposisi_id, d.instruksi, d.batas_waktu, d.tanggal_disposisi, d.catatan_selesai, d.tanggal_selesai,
        d.staf_id, st.nama AS staf_nama, pm.nama AS pimpinan_nama
    FROM surat_masuk m
    LEFT JOIN disposisi d ON d.surat_masuk_id = m.id
    LEFT JOIN pengguna st ON st.id = d.staf_id
    LEFT JOIN pengguna pm ON pm.id = d.pimpinan_id";

function baris_masuk(array $r): array
{
    return [
        'id' => (int) $r['id'], 'nomor_agenda' => $r['nomor_agenda'], 'nomor_surat_asal' => $r['nomor_surat_asal'],
        'tanggal_surat' => $r['tanggal_surat'], 'tanggal_terima' => $r['tanggal_terima'],
        'pengirim' => $r['pengirim'], 'perihal' => $r['perihal'], 'sifat' => $r['sifat'], 'status' => $r['status'],
        'ada_file' => $r['file_surat'] !== '' && is_file(FOLDER_ARSIP . '/' . $r['file_surat']),
        'file_nama' => $r['file_nama'], 'file_tipe' => pathinfo($r['file_surat'], PATHINFO_EXTENSION),
        'disposisi' => $r['disposisi_id'] ? [
            'id' => (int) $r['disposisi_id'], 'instruksi' => $r['instruksi'], 'batas_waktu' => $r['batas_waktu'],
            'tanggal' => $r['tanggal_disposisi'], 'staf_id' => (int) $r['staf_id'], 'staf' => $r['staf_nama'],
            'pimpinan' => $r['pimpinan_nama'], 'catatan_selesai' => $r['catatan_selesai'], 'tanggal_selesai' => $r['tanggal_selesai'],
        ] : null,
        'status_arsip' => $r['status_arsip'],
    ];
}

function ambil_masuk(int $id): array
{
    $s = db()->prepare(SQL_MASUK . ' WHERE m.id = ?');
    $s->execute([$id]);
    $r = $s->fetch();
    if (!$r) json_keluar(['error' => 'Surat masuk tidak ditemukan.'], 404);
    return $r;
}

function data_masuk(array $in): array
{
    $pengirim = teks($in['pengirim'] ?? '', 150);
    $perihal = teks($in['perihal'] ?? '');
    if ($pengirim === '' || $perihal === '') json_keluar(['error' => 'Pengirim dan perihal wajib diisi.'], 422);
    $sifat = in_array($in['sifat'] ?? '', SIFAT_BOLEH, true) ? $in['sifat'] : 'biasa';
    return [
        teks($in['nomor_surat_asal'] ?? '', 100),
        tanggal_atau_null($in['tanggal_surat'] ?? ''),
        tanggal_atau_null($in['tanggal_terima'] ?? '') ?? date('Y-m-d'),
        $pengirim, $perihal, $sifat,
    ];
}
