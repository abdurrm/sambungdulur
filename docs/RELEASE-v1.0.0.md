# SambungDulur v1.0.0 — Editor silsilah luring

Rilis baseline sebelum pengembangan penautan pasangan lama dan impor Kartu Keluarga.

Commit: `e89d2b7d1db691fad878a2a4f136430bcd653642` (remote `main`).

## Fitur yang tersedia

- Editor orang, pasangan, anak, saudara, dan orang tua; biografi, tanggal sebagian, serta foto dengan pemotongan.
- Simpan otomatis lokal di IndexedDB; simpan/buka proyek `.sambung`.
- Impor GEDCOM dan cadangan ZIP MyHeritage Family Tree Builder; ekspor GEDCOM dengan pelestarian record sumber yang tidak berubah.
- Ekspor PNG, JPEG, SVG, GEDCOM/ZIP foto, dan dokumen silsilah teks.
- Pencarian, kontrol generasi, fokus pohon, navigasi keyboard, undo/redo, dan tata letak manual.
- Kartu dan garis keluarga yang diperbarui, sorotan keturunan, animasi, tema terang/gelap, latar warna/motif/gambar.
- Editor desktop berupa pop-up atau panel tersemat; editor sentuh berbentuk bottom sheet; kamera pada perangkat sentuh yang mendukungnya.
- PWA yang dapat dipasang dan digunakan luring; antarmuka Indonesia, Jawa, dan Inggris.
- Panduan bergambar, data demo fiktif, dan [video YouTube](https://youtu.be/iQQemqZ_DVY).

## Batasan rilis

- Tombol tambah pasangan/orang tua membuat orang baru; belum dapat memilih orang lama untuk kedua operasi tersebut.
- Belum ada impor PDF/gambar KK, OCR, pencocokan identitas, atau penggabungan duplikat.
- Belum ada login Google, penyimpanan Drive, berbagi proyek, kolaborasi akun, atau discovery.
- Membuka berkas menggantikan proyek aktif. Aplikasi saat ini bekerja lokal tanpa akun dan tidak mengirim data keluarga ke server.
- Perubahan video lokal yang belum di-commit bukan bagian rilis ini. Lampiran KK pribadi tidak disertakan.

## Todo pengembangan

Semua butir berikut adalah rencana, bukan fitur rilis ini; detail desain masih diwawancarai.

- [ ] **Fase 1A:** pilih pasangan yang sudah ada, termasuk kerabat jauh, tanpa menggandakan orang; uji garis keturunan bersama, pasangan berbeda generasi, simpan/buka, dan GEDCOM.
- [ ] **Fase 1B:** impor beberapa KK PDF/scan/gambar ke proyek aktif melalui draf peninjauan; cocokkan anggota dan nama orang tua dengan orang lama; tangani konflik, pengulangan impor, serta rujukan sumber.
- [ ] Tetapkan kebijakan NIK, OCR lokal, dokumen asli, dan pembatalan hasil impor; gunakan data fiktif untuk pengujian publik.
- [ ] **Fase 2:** login Google opsional, simpan/buka di Drive pengguna, dan berbagi berkas; pertahankan penggunaan lokal tanpa akun dan tangani konflik versi.
- [ ] **Fase 3:** undangan kolaborasi yang diterima akun lain setelah login; berkas tetap di Drive pemilik; tetapkan izin dan pengelolaan perubahan bersamaan.
- [ ] **Fase 4:** discovery atas pilihan pemilik, usulan kemiripan, informasi terbatas, dan penggabungan hanya setelah persetujuan kedua pihak.

## Verifikasi baseline

- `npm test`: 81 tes lulus (12 berkas).
- `npm run build`: typecheck dan build produksi lulus.
- `npx playwright test`: 61 tes desktop/mobile lulus (Microsoft Edge).

Pengujian di atas untuk fitur baseline; bukan bukti fitur KK/cloud/kolaborasi sudah tersedia.
