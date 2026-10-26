# SambungDulur v1.0.1 — Pasangan lama, impor KK, ekspor Bani, dan feedback

## Penambahan fitur

- **Pilih pasangan yang sudah ada**: tautkan dua identitas dalam silsilah, termasuk kerabat jauh, tanpa membuat orang duplikat. Orang tua, pasangan lain, serta anak yang sudah ada tetap dipertahankan. Pasangan baru tidak otomatis menjadi orang tua anak yang sudah ada.
- **Impor Kartu Keluarga** dari beberapa PDF, JPEG, atau PNG ke proyek aktif. Pilih orang acuan per dokumen, baca teks PDF/OCR secara lokal, konfirmasi orang acuan, lalu tinjau kecocokan anggota dan nama orang tua.
- **Pembaruan keluarga dengan peninjauan**: pilih orang lama, buat orang baru, atau tunda; pilih kolom dan hubungan yang akan diterapkan. Perbedaan data mempertahankan nilai lama secara bawaan. Impor ulang mempertahankan identitas baris lama; hasil impor dapat diurungkan.
- **Referensi KK privat**: rujukan halaman/baris, NIK opsional, informasi tambahan, dan dokumen asli tersimpan lokal. Cadangan menyediakan pilihan menyertakan KK asli; kolom tambahan dapat disunting di tab Biografi.
- **Ekspor cabang keturunan/Bani**: pilih pangkal, misalnya Irjam, untuk mengekspor pangkal dan seluruh keturunannya ke PNG/JPEG/SVG, teks, GEDCOM/ZIP foto, atau salinan `.sambung`. Pasangan opsional; cabang keluarga lain tidak ikut. NIK dan KK asli dikecualikan secara bawaan.
- **Form feedback pengguna** pada toolbar desktop dan menu ponsel: jenis masukan, judul, rincian, langkah reproduksi, pratinjau, dan salin teks. Draf issue baru dapat dibuka dengan teks terisi di GitHub. Untuk komentar pada issue lama, pilih nomor issue, salin teks, lalu tempel dan kirim di GitHub.
- **Versi aplikasi dapat diperiksa** melalui form feedback, metadata halaman, dan `version.json`.

## Perbaikan dan kompatibilitas

- Praproses scan memakai koreksi kemiringan, ambang lokal, pengurangan garis tabel, serta penanganan NIK yang terpisah menjadi beberapa potongan OCR.
- Cache aset statis mendukung modul OCR yang baru dibuka saat luring. Worker, model OCR, serta lisensi disertakan dalam build aplikasi sendiri.
- Format native `.sambung` kini **versi 3**. Aplikasi ini tetap membuka versi 1/2; aplikasi lama perlu diperbarui untuk membuka file versi 3.
- Ekspor cabang membatasi identitas, relasi, indeks, media, dan sumber yang disertakan. Ekspor proyek penuh tetap mempertahankan GEDCOM sumber yang tidak diubah.

## Batasan

- OCR dapat keliru atau melewatkan informasi; hasil baca wajib ditinjau. Batas per dokumen: 30 MB, maksimal 20 halaman PDF.
- Feedback tidak dikirim otomatis. Pengguna meninjau dan mengirimnya melalui akun GitHub; komentar issue lama menggunakan salin/tempel. Jangan menyertakan NIK, KK, atau data keluarga pribadi dalam feedback publik. Aplikasi tidak melampirkannya otomatis.
- Catatan bebas/foto perlu diperiksa sebelum berbagi. Menyertakan KK asli secara eksplisit dapat membawa informasi orang di luar cabang.
- Perubahan video lokal yang belum di-commit dan dokumen KK pribadi tidak menjadi bagian rilis ini.

## Validasi

- 103 tes unit lulus dan build produksi/typecheck lulus.
- 69 tes browser desktop/ponsel lulus dalam satu run penuh, termasuk feedback, clipboard, aksesibilitas, pasangan lama, impor KK, ekspor semua format, dan OCR saat luring.

## Todo pengembangan berikutnya

- [ ] Fase 2: login Google opsional, simpan/buka di Drive pengguna, dan berbagi file.
- [ ] Fase 3: undangan kolaborasi yang diterima akun lain, izin kerja bersama, serta penanganan konflik; file tetap di Drive pemilik.
- [ ] Fase 4: discovery atas pilihan pemilik dengan informasi terbatas dan persetujuan kedua pihak sebelum penggabungan.
- [ ] Penggabungan catatan duplikat lama dan perluasan pengujian variasi scan/perangkat fisik.

Rincian: [roadmap pengembangan](https://github.com/abdurrm/sambungdulur/blob/v1.0.1/docs/ROADMAP.md).
