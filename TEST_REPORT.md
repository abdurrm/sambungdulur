# Laporan Pengujian — SambungDulur

## 26 Oktober 2026 — hotfix kartu KK mobile dan audit Android

- Reproduksi sebelum perbaikan: `npx playwright test tests/e2e/open_mobile.spec.ts --project mobile` gagal karena lebar ikon hanya **5,375 px** pada viewport 320 px.
- Setelah kartu memakai badge tetap seperti pilihan impor lain dan judul/deskripsi terpisah, tes yang sama lulus pada lebar **320, 390, dan 435 px**. Ikon minimal 20 px, badge 46×46 px, tidak ada overflow horizontal, dan kartu tetap membuka dialog KK.
- Pemeriksaan visual lokal pada 390×844 px dalam tema terang dan gelap: ikon dan teks tersusun konsisten dengan kartu lain.
- `npm test`: **103/103 lulus**; `npm run build`: **lulus**.
- `npx playwright test`: **70/70 lulus dalam satu run penuh**, mencakup desktop dan emulasi ponsel, termasuk tes regresi kartu KK baru.
- Audit situs publik pada profil browser normal Microsoft Edge/Chromium: manifest tanpa kesalahan, ikon PNG aktual 192/512 px merespons 200, service worker aktif dan mengendalikan halaman, `Page.getInstallabilityErrors` kosong. Profil Playwright sementara/incognito sebelumnya hanya melaporkan `in-incognito`; pemeriksaan diulang menggunakan profil normal terpisah.
- Hasil audit browser Windows dengan viewport mobile bukan bukti pemasangan pada perangkat Android fisik atau kesiapan paket Play Store. Petunjuk dan kebutuhan yang tersisa ada di [panduan Android](docs/ANDROID-DAN-PLAYSTORE.md).

## v1.0.1 — pemeriksaan pra-rilis 26 Oktober 2026

- `npm test`: **103/103 lulus**, 14 berkas.
- `npm run build`: **lulus**, termasuk TypeScript dan aset OCR lokal.
- `npx playwright test`: **69/69 lulus dalam satu run penuh** (2,5 menit), Microsoft Edge desktop dan emulasi ponsel. Ini merupakan hasil terbaru yang mencakup fase 1 serta form feedback.
- Feedback: validasi tujuan issue, encoding judul/isi, teks panjang, pratinjau tanpa data keluarga otomatis, clipboard dan fallback manual, nomor issue lama, pilihan informasi browser, konfirmasi publik, aksesibilitas, dan tampilan ponsel.
- Isi clipboard diuji dengan normalisasi LF/CRLF sesuai platform; perbedaan akhir baris Windows tidak diperlakukan sebagai hilangnya teks.
- Tidak ada issue/komentar uji yang dipublikasikan. Pengujian memverifikasi draf URL dan teks; pengiriman akhir dilakukan pengguna di GitHub.

Versi dapat dibaca pada form feedback, atribut `data-app-version`, metadata HTML, dan `version.json`. Build GitHub Actions menambahkan SHA commit pada `version.json` untuk verifikasi deployment. Status publikasi/deployment diperiksa melalui workflow dan readback situs setelah commit dipush; keberhasilan build lokal sendiri bukan bukti deployment.

Pembuatan URL draf mengikuti [dokumentasi resmi GitHub untuk parameter issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue). Komentar issue lama memakai salin/tempel; aplikasi tidak menyimpan token GitHub atau melakukan POST feedback.

## 26 Oktober 2026 — fase 1, implementasi lokal

Rekam pemeriksaan awal sebelum penambahan feedback; hasil pra-rilis terbaru ada di atas.

Cabang `feat/kk-dan-cabang-keturunan`, setelah baseline remote v1.0.0 (`e89d2b7`). Hasil ini tidak menyatakan fitur baru sudah dipush atau dideploy.

- `npm test`: **97 lulus**, 13 berkas. Tambahan mencakup tautan kerabat tanpa duplikasi, perbedaan tingkat generasi, pencegahan siklus, orang tua parsial, pasangan tanpa mewarisi anak, pemisahan cabang, sumber/media privat, OCR tabel, identitas senama, NIK, impor ulang, dan penerapan atomik pada model.
- `npm run build`: **lulus**, termasuk pemeriksaan TypeScript. PDF.js, worker OCR, model bahasa Indonesia, dan lisensinya dibundel dari aplikasi sendiri.
- Run penuh `npx playwright test`: **65 lulus / 1 gagal** pada langkah tes tambahan editor. Seluruh 61 tes regresi lama lulus; tes tambahan tersebut mencoba mengklik kartu yang tertutup pop-up. Setelah memperbaiki langkah navigasi tes, diperlukan juga pemilihan ulang tab Biografi ketika editor orang lain dibuka. Pengujian ulang editor tersebut sudah lulus. Hasil run ini tidak dinyatakan sebagai satu run penuh 66/66.
- Pengujian akhir `npx playwright test tests/e2e/kk_branch.spec.ts`: **5/5 lulus** (22,8 detik), mencakup seluruh tes baru desktop dan ponsel pada revisi akhir. Ini merupakan uji ulang terarah setelah perbaikan langkah tes dan penyelesaian kode.

Pemeriksaan browser mencakup: pasangan dari orang lama, keluaran cabang TXT/GEDCOM/SVG/PNG/JPEG/`.sambung`, batch KK dengan orang acuan per dokumen, pembaruan saudara tanpa orang baru, penyimpanan dokumen sumber secara opsional, impor ulang dan undo, NIK yang bisa disunting dengan validasi duplikat, serta modal ponsel 390 px dan pemeriksaan aksesibilitas. Uji OCR memakai scan fiktif yang diputar, service worker aktif, lalu jaringan dimatikan sebelum pembacaan. Masalah cache modul akibat `Vary: Origin` ditemukan melalui uji luring dan diperbaiki untuk aset statis dari origin aplikasi.

Empat lampiran pribadi diperiksa lokal sebagai uji baca, tanpa menerapkan orang nyata ke proyek uji: dua PDF berteks dan dua scan menghasilkan total 16 baris anggota setelah praproses. Ini membuktikan deteksi baris pada contoh tersebut, bukan ketepatan setiap nama/NIK/atribut atau semua variasi KK. Nama orang tua pada scan masih dapat memerlukan koreksi. Tidak ada dokumen asli, teks hasil baca, atau screenshot data pribadi dalam berkas perubahan publik.

Screenshot QA lokal yang diperiksa memakai data fiktif: `temp/kk-desktop.png` dan `temp/kk-mobile.png` (diabaikan git). Keduanya tidak menunjukkan luapan horizontal dan tombol tindakan modal tetap terlihat.

Lingkungan sesi ini: Windows, Node 22.23.0, npm 11.18.0, Microsoft Edge headless; ponsel menggunakan emulasi viewport/sentuh. Ponsel fisik, seluruh format scan, Google Drive, kolaborasi, discovery, dan deployment baru belum diuji.

Rujukan implementasi: [contoh resmi PDF.js](https://mozilla.github.io/pdf.js/examples/) dan [konfigurasi aset lokal Tesseract.js](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).

## Laporan historis sebelum fase 1

Bagian berikut dipertahankan sebagai rekam pengujian sebelumnya; angka serta lingkupnya bukan hasil ulang pada sesi ini.

Lingkungan: Windows 11, Node 22.23.0, npm 11.18.0, Vite 8.3.5, Vitest 5.0.5, Playwright (channel `msedge`, Edge terpasang).
Laporan ini menggantikan laporan sesi sebelumnya, yang memuat klaim tidak akurat (ukuran `.ftb` 9,5 MB — sebenarnya 2,1 MB; screenshot yang dirujuk tidak ada; parser lama tidak menulis perubahan relasi ke record FAM).

## 1. Unit test (Vitest) — `npm test`

```
Test Files  3 passed (3)
     Tests  33 passed (33)
```

| Berkas | Isi |
|---|---|
| `tests/unit/gedcom.test.ts` | Round-trip byte-identik (LF, BOM+CRLF, spasi ganda); ekstraksi kolom; edit hanya mengubah baris terkait; NOTE multi-baris + Unicode; relasi baru → INDI/FAM/FAMC/FAMS; hapus orang; GEDCOM baru dari nol. **Data nyata (salinan lokal)**: 2.336 individu, 658 keluarga, 133 file media; ekspor tanpa edit identik byte-per-byte; edit satu orang → tepat 1 baris berubah; jumlah CHIL = FAMC. |
| `tests/unit/ftb.test.ts` | Decoder teks protobuf FTB; tolak ZIP tanpa `.ftb`; DB FTB sintetis lengkap. **Data nyata**: 39 tabel, 2.336/658; 7 kolom cocok dengan GEDCOM untuk semua orang kecuali 3 nama yang berisi `/` (ambiguitas sumber, dibatasi tepat 3); struktur keluarga identik. |
| `tests/unit/relations_layout.test.ts` | 5 format tanggal & tanggal parsial; aturan add parents/sibling/partner/child; aturan hapus (split, orang terakhir); seleksi generasi & collapse; layout tanpa kartu bertumpuk dan anak selalu di bawah orang tua — termasuk data nyata 2.336 orang pada 3/3, 5/5, dan Semua. |

Tes data nyata dilewati otomatis bila `local-test-data/` tidak ada (misalnya di CI) — data keluarga tidak pernah di-commit.

## 2. E2E (Playwright, build produksi via `vite preview`) — `npx playwright test`

```
14 passed (~33s)
```

| Tes | Membuktikan |
|---|---|
| starts with the three-person tree… | 3 kartu, orang pertama terpilih, cincin laki-laki & perempuan berwarna berbeda, Add parents nonaktif |
| adds relatives, edits… delete rules | sibling, partner, anak via dialog, edit lintas tab, tanggal parsial, tolak hapus yang memecah pohon, hapus daun, persistensi setelah reload |
| tree settings change the cards | format tanggal, font Large menonaktifkan facts, DOB↔DOD, tema gelap |
| imports GEDCOM, searches, limits generations… | impor fixture, pencarian, kontrol generasi (4→2→4 tampil), ekspor GEDCOM: **hanya 1 baris berbeda** dari sumber |
| saves a .sambung file and reopens it after reset | simpan, reset, buka ulang: orang & judul kembali |
| exports PNG compact/normal/detailed, text, SVG | 3 PNG valid dengan lebar compact < normal < detailed; dokumen teks berisi Ahnentafel; SVG |
| manual layout moves a person and survives reload | dialog hitung mundur, Save nonaktif sebelum perubahan, drag ↔, posisi bertahan setelah reload |
| zoom buttons respect limits and centre works | zoom in/out hingga batas, center |
| works offline as an installable PWA | manifest standalone + ikon 512, service worker mengontrol halaman, reload saat offline tetap memuat pohon |
| mobile layout… @mobile | 390×844: tanpa overflow horizontal, tap memilih orang, bottom sheet & menu "lainnya" |
| header toolbar never overflows… | toolbar tidak meluap pada 9 lebar layar (1100–2560 px) × 3 bahasa |
| help and source links point to the public repository | tombol Panduan dan tautan sumber menunjuk ke repositori GitHub, tetap terlihat |
| a freshly imported tree is fitted into view | impor 14 orang: semua kartu berada di dalam kanvas (regresi bug impor tanpa pemusatan) |
| defaults to Indonesian and switches… | default `lang=id` (Buka, "Saya", "Saudara dari Saya"), Jawa ("Bukak", "Bojoné …"), Inggris bertahan setelah reload, dokumen teks dalam bahasa Indonesia |

Bug nyata yang ditemukan saat uji/pembuatan dokumentasi dan diperbaiki: (a) setelah impor, tampilan tidak dipusatkan (urutan `pendingCenter` salah); (b) di layar 390 px tombol ⋯ terdorong keluar layar karena kolom judul terlalu lebar (asersi posisi tombol kini ada di tes mobile); (c) toolbar meluap pada layar 1100–1920 px dengan label berbahasa Indonesia/Jawa (tombol sekunder kini ikon saja dengan tooltip, pemilih bahasa di header hanya ≥1700 px, penanda status menyusut dengan elipsis; dijaga tes luapan 9 lebar × 3 bahasa). Tes "manual layout" yang ikut goyah karena animasi panel 0,2 detik kini menunggu animasi selesai. Ditemukan E2E sebelumnya: (1) memilih Hari/Bulan sebelum Tahun menghapus pilihan; (2) zoom berulang dihitung dari skala yang sedang dianimasikan; (3) `useState` dipanggil setelah `return` bersyarat pada input tanggal.

## 3. Bukti manual — dua tab browser Orca

- Tab A (situs asli) `e1fd0800-c820-4405-a342-73a6866b5aec`, tab B (lokal) `93c0b2f1-0185-4413-a79c-de90c5f5c9eb`; setiap perintah memakai `--page` eksplisit.
- Tab A ternyata **masuk ke akun pengguna**; karena itu hanya operasi tanpa perubahan data yang dilakukan (membuka & membatalkan Tree Settings, Export, Edit person, Add child, Manual Layout). Tidak ada data keluarga yang dimasukkan ke situs asli.
- Screenshot: `evidence/a-01…a-08` (tab A) dan `evidence/b-01…b-04` (tab B). Screenshot tab A **tidak di-commit** karena memuat alamat email akun.
- Perbandingan visual: struktur sama (panel kiri 3 tab, toolbar, kanvas berpusat, ayah-ibu di atas anak); gaya sengaja berbeda (archify, cincin gender, kartu berisi data sesuai pengaturan). Ketidaksesuaian yang ditemukan dari perbandingan lalu diperbaiki: label "Person's Name", tanggal kosong "Unknown", form edit per tab, posisi handle ↔ di atas kartu, Save nonaktif, sidebar disembunyikan di manual mode, overflow toolbar.

## 4. Dokumentasi bergambar

`npm run docs` (`scripts/make-docs.mjs`) menjalankan build produksi dengan Edge dan data fiktif `docs/demo/keluarga-contoh.ged`, menggambar penanda bernomor, dan menghasilkan 26 screenshot beranotasi serta 3 contoh ekspor PNG di `docs/img/`. Setiap screenshot diperiksa secara visual terhadap teks di `docs/PANDUAN.md`.

## 5. Yang tidak/ belum terverifikasi

- Mutasi pada situs asli (add/delete/upload) tidak dijalankan karena tab A login ke akun nyata; perilakunya diturunkan dari kode bundle (lihat FEATURE_MATRIX).
- Fitur khusus akun (upload gambar, simpan cloud, paket) tidak diamati — sesuai larangan melewati kontrol akses.
- iOS Safari dan Firefox tidak diuji (E2E memakai Edge/Chromium).
- Import FTB hanya diuji pada satu cadangan (FTB 8.0); versi skema lain bisa berbeda.
