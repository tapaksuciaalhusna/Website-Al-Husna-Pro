# Website-Al-Husna-Pro

## Pembaruan tampilan (gaya aplikasi digital scoring)
- `index.html`: desain baru (latar hitam gradasi, garis emas, panel hitam, kolom nilai kuning dan biru). Semua `id`, `class`, dan `data-*` yang dipakai `app.js` tetap sama.
- `assets/`: tiga gambar contoh tampilan TV skor (`tv-mode3-*.webp`) untuk bagian "Tampilan TV skor". Folder ini harus ikut diunggah ke GitHub.
- `app.js`: hanya dua baris (`enterPortal` dan `leavePortal`) diubah agar semua seksi publik (kelas `public-section`) disembunyikan saat portal dibuka.
- Dihapus: catatan lama "Data kejuaraan di atas masih contoh" dan footer ganda.

## Penyempurnaan alur pendaftaran kontingen
- Tombol Daftar atlet menyimpan kejuaraan yang dipilih sebelum login/registrasi.
- Pengunjung dapat beralih dari Masuk ke Daftar kontingen melalui dialog autentikasi.
- Setelah login berhasil, aplikasi langsung membuka formulir pendaftaran dengan kejuaraan pilihan terisi otomatis.
- Jika verifikasi email diperlukan, pilihan kejuaraan disimpan sementara di browser sampai pengguna login.

## Pengaturan kejuaraan, flyer, juknis, dan kategori
1. Jalankan file `migration_kejuaraan.sql` satu kali di Supabase Dashboard > SQL Editor.
2. Di portal Super Admin/Admin, buka **Kelola kejuaraan** lalu tambah atau edit kejuaraan.
3. Unggah flyer dan juknis (PDF atau gambar untuk flyer), pilih peraturan IPSI atau Tapak Suci, aktifkan nomor pertandingan, kelompok usia, dan isi batas berat kelas A-J/Bebas sesuai juknis resmi panitia.
4. Kontingen akan melihat tautan flyer/juknis dan hanya dapat memilih kategori/kelompok usia/kelas berat yang diaktifkan untuk kejuaraan tersebut.
5. Untuk nomor beregu/ganda/trio, kontingen memilih anggota tim sekaligus. Tapak Suci beregu tangan kosong/bersenjata divalidasi harus campuran putera-puteri; tanding bebas beregu harus satu regu putera atau satu regu puteri.

Catatan: rentang berat badan kelas tidak diisi otomatis karena harus mengikuti juknis resmi masing-masing kejuaraan. Admin wajib mengisinya sebelum membuka pendaftaran.

## Pendaftaran multi-peserta & flyer publik
1. Jalankan `migration_pendaftaran_multi.sql` satu kali di Supabase SQL Editor (setelah `migration_kejuaraan.sql`).
2. Daftarkan peserta: pilih kejuaraan, isi nomor pertandingan, kelompok usia, kelas tanding, dan data atlet per peserta. Klik **+ Tambah peserta** untuk banyak peserta sekaligus, lalu Simpan sekali.
3. Atlet dengan nama + tanggal lahir yang sama dipakai ulang, tidak digandakan.
4. Flyer yang diunggah admin tampil sebagai gambar di kartu kejuaraan untuk semua pengunjung (klik untuk memperbesar).
