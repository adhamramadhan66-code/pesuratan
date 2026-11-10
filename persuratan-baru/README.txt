PERSURATAN TSU - VERSI BARU
===========================
Menu di sidebar:

- Dashboard    : kotak Jenis surat, tabel Surat terbaru, lalu grafik surat per bulan
                 (grafik ada di bawah Surat terbaru). Data yang tampil adalah tahun berjalan.
                 Klik kotak Jenis surat untuk menyaring Surat terbaru.
- Upload Surat : form surat baru dengan nomor otomatis (format NNN.K/JENIS/UNIT/BULAN/TAHUN).
                 Isian: Judul surat, Tanggal surat, Tujuan, Jenis, Unit, Perihal, dan
                 Link Google Drive (opsional, di bagian bawah form).
- Data Surat   : semua surat yang sudah diupload. Bisa dicari/disaring (judul, nomor, perihal,
                 jenis, unit, tujuan, tahun), dibuka link Drive-nya, diubah, atau dihapus.

Surat Masuk dan Surat Keluar sudah tidak ada. Alurnya sekarang: Upload Surat -> otomatis
masuk ke Data Surat -> tampil di Dashboard.

Login        : tidak ada halaman login di awal. Dashboard langsung terbuka. Begitu pengunjung
               menekan tombol, tautan, atau isian apa pun (kecuali tombol tema dan buka/tutup
               sidebar), muncul popup login berlatar putih. Setelah login, halaman dimuat ulang
               atau langsung membuka tautan yang tadi ditekan. Pengaturan dan Keluar ada di
               popup foto profil (pojok kanan atas).
Akun demo    : admin@tsu.ac.id / tsu12345
Menjalankan  : Laragon (Start All), lalu buka http://localhost/<folder repo>/persuratan-baru/
               atau jalankan jalankan.bat. Database "persuratan" dibuat otomatis. Database
               lama dari versi sebelumnya otomatis ditambah kolom "judul" (data tidak hilang).
