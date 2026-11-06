PERSURATAN TSU (Kampusly) - e-Office
====================================
Aplikasi persuratan Universitas Tiga Serangkai dengan login per peran (Staf / Pimpinan / Admin).
Backend PHP native (PDO + MySQL), frontend JavaScript (fetch). Skema database: database.sql.

AKUN (sementara hanya satu)
  admin@tsu.ac.id  /  tsu12345   -> Admin, bisa mengakses SEMUA fitur: membuat draft, ACC, penomoran & terbit,
                                    input surat masuk, disposisi, menyelesaikan disposisi, pengarsipan.
  Akun pimpinan dan staf akan ditambahkan nanti setelah alur sudah pas. Pembagian peran sudah ada di server
  (kolom peran di tabel pengguna), jadi tinggal menambah akun.

ALUR SURAT MASUK (pakai Disposisi)
  Admin input surat            -> status "diterima"
  Pimpinan buat disposisi staf -> status "proses_staf"
  Staf selesaikan tugas        -> status "selesai"        (lalu bisa diarsipkan oleh admin)

ALUR SURAT KELUAR (ACC + Penomoran, tanpa Disposisi)
  Staf buat draf (file PDF/JPG/PNG) -> status "menunggu_acc"
  Pimpinan klik ACC                 -> status "menunggu_nomor"  (otomatis masuk antrean menu Penomoran)
  Admin "Beri Nomor & Terbitkan"    -> status "terbit"          (tampil di Surat Keluar, siap diarsipkan)

NOMOR SURAT KELUAR: [No]/TU/[Bulan Romawi]/[Tahun], contoh 001/TU/XI/2026. Nomor urut mulai 001 tiap awal bulan
(otomatis, diambil dari nomor terakhir di bulan itu). Admin juga bisa memakai nomor manual (tidak boleh kembar).
Nomor surat masuk (nomor agenda): [No]/SM/[Bulan Romawi]/[Tahun].

MENU
- Dashboard   : ringkasan surat masuk, surat keluar, tugas yang menunggu Anda, grafik per bulan, surat terbaru.
- Penomoran   : (khusus Admin) antrean draf yang sudah di-ACC. Tombol "Preview Draft" membuka file draf,
                lalu "Beri Nomor & Terbitkan" membuka form nomor otomatis/manual -> "Simpan & Terbitkan".
- Surat Keluar: Staf membuat/ubah/hapus draf (selama menunggu ACC); Pimpinan menekan ACC; semua peran melihat statusnya.
- Surat Masuk : Admin input/ubah/hapus (selama belum didisposisikan); Pimpinan menekan "Disposisi".
- Disposisi   : Pimpinan memilih staf tujuan + instruksi + batas waktu; Staf menandai "Selesai" dengan catatan.
- Pengarsipan : Admin mengisi lokasi arsip fisik dan/atau file scan untuk surat keluar terbit & surat masuk selesai.

DATA LAMA: bila database sebelumnya berisi alur lama (Penomoran -> Disposisi -> ACC), tabelnya tidak dihapus,
hanya diganti namanya dengan akhiran _lama (surat_lama, disposisi_lama, disposisi_alur_lama, surat_masuk_lama).

HAK AKSES DITEGAKKAN DI SERVER: tombol yang tidak sesuai peran disembunyikan, dan API menolak (403) bila
peran yang salah memanggilnya.

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
   termasuk 4 akun demo.
   (Opsional: database.sql bisa diimpor lewat HeidiSQL/phpMyAdmin dengan hasil yang sama.)

Alternatif tanpa Apache: jalankan jalankan.bat (memakai server PHP bawaan, port 8000).
MySQL tetap harus hidup di Laragon.

PENGATURAN DATABASE
Ubah di api/db.php. Bawaan Laragon: host 127.0.0.1, port 3306, user root, tanpa kata sandi.

STRUKTUR DATABASE (lihat database.sql)
- pengguna      : akun login (peran staf / pimpinan / admin, kata sandi di-hash dengan password_hash)
- surat_masuk   : status ENUM diterima / proses_staf / selesai + data pengarsipan
- disposisi     : satu disposisi per surat masuk (pimpinan -> staf), status proses_staf / selesai
- surat_keluar  : status ENUM menunggu_acc / menunggu_nomor / terbit, nomor_surat (UNIQUE) +
                  UNIQUE tahun+bulan+nomor_urut -> nomor tidak mungkin ganda, data pengarsipan
File scan arsip disimpan di folder data/arsip/ dengan nama acak dan hanya
bisa dibuka lewat api/arsip.php.

JIKA UNGGAH FILE GAGAL
Naikkan upload_max_filesize dan post_max_size (minimal 10M) di php.ini Laragon
(menu Laragon -> PHP -> php.ini), lalu restart Apache.

CATATAN KEAMANAN
Login memakai sesi PHP di server dan semua API memeriksa peran. Ganti kata sandi akun demo (kolom kata_sandi di
tabel pengguna, isi dengan hasil password_hash) sebelum dipakai nyata, dan gunakan HTTPS bila dipublikasikan.
Login Google, pendaftaran akun, dan lupa kata sandi belum terhubung.
Tampilan memuat ikon (unpkg) dan font (Google Fonts) dari internet.
