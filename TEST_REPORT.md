# Laporan Pengujian — SambungDulur

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
