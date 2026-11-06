PERSURATAN TSU (Kampusly) - PROTOTIPE
=====================================
Aplikasi pencatatan surat keluar Universitas Tiga Serangkai berdasarkan
"Panduan Persuratan.xlsx". Nomor surat dibuat otomatis dengan format:

    NNN.K/JENIS/UNIT/BULAN/TAHUN        contoh: 001.A/SK/REK/I/2026

- NNN    : nomor urut, mulai 001 di setiap awal bulan (per bulan & tahun)
- K      : A = internal, B = eksternal
- JENIS  : kode jenis surat (SK, ST, SU, ... lihat Panduan)
- UNIT   : kode bidang/unit/lembaga pembuat (REK, SEK, D-SH, ...)
- BULAN  : angka romawi (I - XII), TAHUN : tahun pada tanggal surat

AKUN DEMO (login prototipe)
  Email       : admin@tsu.ac.id
  Kata sandi  : tsu12345

MENU
- Penomoran   : (dulu bernama Tambah Data) form surat keluar baru dengan nomor otomatis, ubah, hapus, dan tabel
                data surat (kolom sama seperti sheet "Contoh" di Excel). Setelah nomor diambil, tombol
                "Lanjut ke Disposisi" menyalurkan surat itu ke tujuannya. Kolom Disposisi pada tabel menampilkan
                status merah (belum disetujui) atau hijau (disetujui).
- Disposisi   : menyalurkan surat ke tujuan yang benar (misalnya Rektor) lalu menunggu persetujuan. Disposisi dibuat
                SETELAH surat dinomori di Penomoran. Isian mengikuti Lembar
                Disposisi TSU: surat yang disalurkan, disalurkan kepada, sifat, hal, 12 butir isi disposisi, dan alur
                disposisi. Status MERAH = belum disetujui, HIJAU = disetujui. Nomor otomatis NNN/DSP/BULAN/TAHUN.
                Lembar bisa dilihat dan dicetak. Disposisi yang sudah disetujui tidak bisa diubah (batalkan persetujuan
                dulu). Satu surat hanya punya satu disposisi.
- Surat Masuk : surat yang diterima TSU dari pihak luar maupun unit internal. Alur: (1) penerimaan & pencatatan,
                (2) disposisi ke pimpinan, (3) tindak lanjut. Nomor agenda otomatis (NNN/AGD/BULAN/TAHUN), file scan
                (PDF/JPG/PNG, maks. 10 MB), dan pengarsipan dengan penanda MERAH = belum diarsipkan, HIJAU = diarsipkan.
                Tombol "Buat disposisi" membuka form Disposisi yang sudah terisi; setelah disposisi dibuat, tahap surat
                otomatis menjadi "Didisposisikan". Surat masuk yang sudah punya disposisi tidak bisa dihapus.
- Surat Keluar: daftar surat keluar beserta tahap prosesnya: Bernomor -> Diperiksa (verifikasi & persetujuan) ->
                Ditandatangani (tanda tangan & cap) -> Terkirim (tanggal dan tujuan pengiriman dicatat). Menampilkan juga
                status disposisi dan status arsip (merah/hijau). Surat baru tetap dibuat di menu Penomoran, dan
                pengarsipan dilakukan di menu Pengarsipan.
- Dashboard   : ringkasan surat (total, internal/eksternal, sudah diarsipkan),
                grafik per bulan, dan surat terbaru. Mengikuti filter Day/Week/Month/Year.
- Pengarsipan : catat lokasi arsip fisik dan/atau unggah file scan (PDF/JPG/PNG, maks. 10 MB),
                lihat/unduh file, ubah, atau batalkan pengarsipan.
Menu "Editor Ruang" sudah dihapus beserta file/API/databasenya.

FOTO PROFIL (klik foto di pojok kanan atas)
- Edit Foto   : geser, perbesar, dan putar foto profil yang sudah ada.
- Tambah Foto : pilih foto dari komputer/ponsel (JPG, PNG, WEBP, maks. 10 MB), lalu atur posisinya.
- Kamera      : ambil foto langsung dengan kamera. Kamera hanya bisa dipakai lewat
                http://localhost atau HTTPS, dan peramban akan meminta izin kamera.
- Hapus Foto  : kembali ke foto bawaan.
Foto disimpan di peramban (localStorage) per akun dan diperkecil menjadi 300x300 piksel,
jadi tidak masuk database dan tidak ikut berpindah ke perangkat/peramban lain.

CARA MENJALANKAN DI LARAGON
1. Ekstrak ZIP, lalu pindahkan folder ke  C:\laragon\www\persuratan
   (sebaiknya ganti nama folder tanpa spasi).
2. Buka Laragon -> klik "Start All" (Apache + MySQL harus hidup).
3. Buka browser:  http://localhost/persuratan/   (atau http://persuratan.test/ bila auto virtual host aktif).
4. Database "persuratan" dan semua tabel dibuat OTOMATIS saat halaman pertama dibuka,
   termasuk daftar jenis surat dan unit dari Panduan.
   (Opsional: database.sql bisa diimpor lewat HeidiSQL/phpMyAdmin dengan hasil yang sama.)

Alternatif tanpa Apache: jalankan jalankan.bat (memakai server PHP bawaan, port 8000).
MySQL tetap harus hidup di Laragon.

PENGATURAN DATABASE
Ubah di api/db.php. Bawaan Laragon: host 127.0.0.1, port 3306, user root, tanpa kata sandi.

STRUKTUR DATABASE
- jenis_surat (kode, nama)         : 28 jenis surat dari Panduan
- unit (kode, nama, urutan)        : 35 bidang/unit/lembaga dari Panduan
- surat                            : satu baris per surat keluar + data pengarsipan
                                     (UNIQUE tahun+bulan+nomor_urut -> nomor tidak mungkin ganda)
File scan arsip disimpan di folder data/arsip/ dengan nama acak dan hanya
bisa dibuka lewat api/arsip.php.

JIKA UNGGAH FILE GAGAL
Naikkan upload_max_filesize dan post_max_size (minimal 10M) di php.ini Laragon
(menu Laragon -> PHP -> php.ini), lalu restart Apache.

CATATAN PENTING
Ini prototipe. Login masih front-end saja (sessionStorage) dan API (api/*.php)
belum memeriksa login, jadi JANGAN dipublikasikan ke internet apa adanya.
Untuk penggunaan nyata tambahkan login server (PHP session + password hash).
Login Google, pendaftaran akun, dan lupa kata sandi belum terhubung.
Tampilan memuat ikon (unpkg) dan font (Google Fonts) dari internet.
