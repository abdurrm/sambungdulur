# Matriks Fitur — SambungDulur vs family-tree-builder.com

Status:
- **Observed** — teramati di situs asli. Sumber: `B` = analisis statis bundle publik `static/js/main.16614d66.js` (offset byte dicantumkan), `T-A` = interaksi browser Orca tab A (situs asli).
- **Implemented** — dibuat di aplikasi lokal.
- **Tested** — `U` = unit (Vitest, `tests/unit`), `E` = E2E (Playwright, `tests/e2e/app.spec.ts`), `M` = manual di browser Orca tab B.
- **Blocked / not replicated** — tidak dibuat, dengan alasan.

Catatan metode: alat REA `analyze_javascript_application` gagal mem-parse bundle (worker kehabisan heap bahkan pada 6 GB, `parsed_javascript_files: 0`) dan `inspect_sqlite_database` membutuhkan Node ≥ 24.15 (lingkungan: 22.23). Analisis bundle dilakukan dengan pemindai literal string linear + pembacaan potongan kode di offset yang relevan; SQLite FTB dibaca dengan `node:sqlite` read-only atas salinan.

## Editor & relasi

| ID | Fitur | Observed | Implemented | Tested | Bukti / catatan |
|---|---|---|---|---|---|
| F01 | Pohon awal 3 orang, orang pertama terpilih | B @565571 (`gA`), T-A | ✅ teks & avatar milik sendiri | E, M | Situs memakai foto siluet bawaan; lokal memakai inisial berwarna gender |
| F02 | Tab Personal / Biography / Image | T-A | ✅ | E, M | |
| F03 | Edit person per tab (nama, surname now/birth, gender F/M/Other, DOB Day/Month/Year, Deceased + DOD, country, profession, facts) | B @839400, T-A (`a-04`, `a-05`) | ✅ (+ tanggal ber-qualifier GEDCOM) | E | Bug tanggal parsial ditemukan E2E & diperbaiki |
| F04 | Add parents (nonaktif bila sudah punya) | B @634471 | ✅ | U, E | |
| F05 | Add sibling (membuat orang tua bila belum ada) | B @635655 | ✅ | U, E | |
| F06 | Add partner (lawan jenis, batas 20) | B @636400 | ✅ | U, E | Situs juga membuat anak placeholder `isAFakeChild` untuk layout; lokal tidak memerlukannya (pilihan implementasi) |
| F07 | Add child: dengan pasangan yang ada / pasangan baru / orang tua tunggal | B @839400–843460, T-A (`a-06`) | ✅ | U, E | |
| F08 | Delete: tolak orang terakhir & penghapusan yang memecah pohon | B @625424, @626135, @630500 | ✅ (cek komponen graf umum) | U, E | Situs memakai heuristik kasus; lokal menghitung komponen terhubung sebelum/sesudah |
| F09 | Upload / delete image + crop | B @838472, @935938 (Cropper) | ✅ crop geser+zoom 512 px | M | Upload di situs hanya untuk akun login (tidak teramati langsung) |
| F10 | Collapse/expand panel editor | T-A | ✅ (bottom sheet di mobile) | E | |
| F11 | Collapse/expand rincian kartu | B @844463 | ✅ | M | |
| F12 | Collapse/expand cabang (leluhur/keturunan) | — | ✅ ekstensi | U | |

## Pengaturan, kanvas, ekspor

| ID | Fitur | Observed | Implemented | Tested | Bukti / catatan |
|---|---|---|---|---|---|
| F20 | 5 format tanggal | B @565101 | ✅ | U, E | |
| F21 | Font size Small/Normal/Large; Profession & Facts nonaktif di Large | B @851900–856900 | ✅ | E | |
| F22 | Surname Now/At Birth, Tree style Plain/Framed | B, T-A (`a-02`) | ✅ | E, M | |
| F23 | Toggle DOB/DOD saling terkait, country, image | B @851900 | ✅ | E | |
| F24 | Center, zoom ×1,15 / ×0,85, batas 0,05–2 | B @914903–915169 | ✅ + pinch/wheel | E | Bug langkah zoom ditemukan E2E & diperbaiki |
| F25 | Manual layout: info dialog berhitung mundur, ↔ di atas kartu, titik kontrol garis, Save nonaktif sampai ada perubahan, sidebar disembunyikan | B @628070, @982221, T-A (`a-07`, `a-08`) | ✅ (teks dialog sendiri) | E, M | Situs menimpa penyesuaian saat re-layout; lokal menyimpannya sebagai selisih |
| F26 | Reset tree dengan konfirmasi | B @627960 | ✅ | E | |
| F27 | Export JPEG (latar putih), PNG (transparan), SVG | B @899500–905060, T-A (`a-03`) | ✅ | E | |
| F28 | PNG Ringkas / Normal / Rinci | — | ✅ permintaan pengguna | E (lebar compact < normal < detailed) | |
| F29 | Ekspor GEDCOM (`.ged`, ZIP + media) | — (situs tak punya GEDCOM: 0 kemunculan di bundle) | ✅ | U, E | |
| F30 | Dokumen silsilah teks | — | ✅ | E | Ahnentafel + penomoran bertingkat + indeks |
| F31 | Simpan/buka `.sambung` | — | ✅ | E | |
| F32 | Persistensi lokal & reload | B @922410, @990025 (sessionStorage `tree`, `editedPaths`, `treeSettings`) | ✅ IndexedDB (bertahan antar sesi) | E | |
| F33 | Peringatan sebelum meninggalkan halaman | B @993331 | ✅ (hanya bila ada perubahan belum disimpan ke file) | M | |
| F34 | Pencarian | — | ✅ | E | |
| F35 | Kontrol jumlah generasi | — | ✅ | U, E | |
| F36 | Diagram gaya archify + cincin foto per gender | — | ✅ | E (warna cincin), M | |
| F37 | PWA (manifest, ikon, service worker, offline) | — | ✅ | E (offline reload) | |
| F38 | Mobile friendly | — | ✅ | E (390×844, tanpa overflow) | |
| F39 | Bahasa Indonesia (default) / Jawa / Inggris | — | ✅ | E | |

## Berkas MyHeritage

| ID | Fitur | Status | Tested | Catatan |
|---|---|---|---|---|
| F50 | Import `abdurrm2023.ged` (UTF-8 BOM, CRLF, 4 bare-LF di dalam nilai NAME, baris `0  _PUBLISH`) | ✅ | U: 2.336 individu, 658 keluarga, 133 file media unik | |
| F51 | Round-trip tanpa edit identik byte-per-byte | ✅ | U | |
| F52 | Edit satu orang → hanya baris itu berubah | ✅ | U, E (fixture sintetis) | |
| F53 | Relasi baru ditulis sebagai INDI/FAM + FAMC/FAMS | ✅ | U | |
| F54 | Identifikasi `abdurrm2022.zip` | ✅ | U | ZIP: `Database/abdurrm2022.ftb` (2,1 MB, SQLite 3, 39 tabel), `Photos/` (209 file), `Cfg/` (2 file) |
| F55 | Import FTB hanya-baca | ✅ | U: cocok dengan GEDCOM untuk 2.336 orang di 7 kolom (3 nama dengan `/` terdokumentasi), struktur keluarga identik, 104 foto profil | |
| F56 | Menulis balik ke `.ftb` | ⛔ tidak dibuat | — | Format proprietary; risiko merusak data. Edit disimpan ke `.sambung`/GEDCOM |
| F57 | Tautkan folder foto | ✅ | M | 133/133 referensi FILE ada di disk sumber |

## Tidak direplikasi / tidak terverifikasi

| ID | Fitur situs | Alasan |
|---|---|---|
| X1 | Login, Google auth, sign-up, account settings, hapus akun | Di luar cakupan (tanpa autentikasi) |
| X2 | Simpan ke cloud (`POST /tree`, `PUT /user-preferences`, `/edited-paths`) | Teramati di B; diganti penyimpanan lokal |
| X3 | Paket berbayar, Stripe, batas 40 (tamu) / 70 (akun) anggota, 5 gambar, 3 MB | Teramati di B @634882, @565571; sengaja tidak dibatasi |
| X4 | Upload gambar ke server & pengambilan gambar ber-token | Hanya untuk akun; tidak diamati langsung (tidak melewati kontrol akses) |
| X5 | Watermark "family-tree-builder.com" pada ekspor | Teramati di B; tidak ditambahkan |
| X6 | Halaman pemasaran, FAQ, DNA, footer, banner cookie, analytics | Bukan fitur editor |
| X7 | Bentuk garis bezier yang dapat diedit bebas di manual layout | Lokal hanya menggeser garis keluarga naik/turun (sebagian setara) |
