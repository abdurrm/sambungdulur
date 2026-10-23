# SambungDulur

**SambungDulur** adalah aplikasi pohon keluarga (silsilah) yang berjalan **sepenuhnya di perangkat Anda**: tanpa login, tanpa server, tanpa unggah data. Aplikasi ini mereplikasi perilaku editor di [family-tree-builder.com](https://family-tree-builder.com/) lalu memperluasnya untuk berkas silsilah nyata — GEDCOM dan cadangan MyHeritage Family Tree Builder — dengan tampilan diagram bergaya *archify*, kontrol jumlah generasi, pencarian, ekspor ke beberapa format, dan dukungan PWA (bisa dipasang dan dipakai offline).

> "Sambung dulur" (Jawa): menyambung tali persaudaraan.

**Coba langsung:** https://abdurrm.github.io/sambungdulur/ (tanpa pemasangan; bisa dipasang sebagai aplikasi dan dipakai luring).

## Video dan panduan

[![Tonton video demo SambungDulur](docs/video/poster.jpg)](docs/video/sambungdulur-demo.mp4)

**[▶ Tonton di YouTube](https://youtu.be/iQQemqZ_DVY)** · [Video lokal (MP4)](docs/video/sambungdulur-demo.mp4) ([subtitle](docs/video/sambungdulur-demo.id.srt)) · **[Panduan bergambar](docs/PANDUAN.md)** (langkah demi langkah dengan screenshot beranotasi) · [Naskah video](docs/VIDEO_NARASI.md) · [Data contoh fiktif](docs/demo/)


## Gambaran umum

| | |
|---|---|
| Jenis | Aplikasi web statis (React + TypeScript + Vite), Progressive Web App |
| Data | Disimpan di browser (IndexedDB); file dibaca/ditulis lewat pemilih file |
| Jaringan | Tidak diperlukan setelah halaman pertama kali dimuat (service worker) |
| Bahasa UI | Indonesia (default), Jawa, Inggris |
| Format masuk | `.sambung`, `.ged` (GEDCOM 5.5/5.5.1 UTF-8), `.zip` cadangan MyHeritage FTB (hanya-baca), `.zip` berisi GEDCOM + foto |
| Format keluar | `.sambung`, GEDCOM `.ged` / ZIP + foto, PNG (Ringkas/Normal/Rinci), JPEG, SVG, dokumen silsilah `.txt` |

Tidak ada data keluarga yang dikirim ke luar mesin. Satu-satunya jaringan yang dipakai adalah memuat aplikasi itu sendiri.

## Fitur

### Editor pohon (setara situs asli)
- Pohon awal tiga orang (saya, ayah, ibu); orang pertama langsung terpilih.
- Panel kiri dengan tab **Pribadi / Biografi / Gambar**, mode **Ubah data** per tab: nama depan, nama keluarga kini & lahir, jenis kelamin (Perempuan/Laki-laki/Lainnya), tanggal lahir/wafat (Hari/Bulan/Tahun, boleh sebagian), status wafat, negara/tempat lahir (dengan saran negara), pekerjaan, fakta menarik/biografi.
- **Tambah orang tua** (nonaktif bila sudah ada), **saudara** (otomatis membuat orang tua bila belum ada), **pasangan** (lawan jenis), **anak** dengan tiga pilihan: bersama pasangan yang ada, dengan pasangan baru, atau orang tua tunggal.
- **Hapus orang** dengan aturan yang sama dengan situs asli: orang terakhir tidak bisa dihapus dan penghapusan yang **memecah pohon** ditolak.
- **Unggah foto** dengan potong (geser + zoom) menjadi 512×512, **hapus foto**.
- **Pengaturan pohon**: 5 format tanggal (MM/DD/YYYY, MM.DD.YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY), ukuran huruf Kecil/Normal/Besar, nama keluarga kini/lahir, gaya Polos/Berbingkai, tampil/sembunyi tanggal lahir/wafat (saling terkait), negara, pekerjaan & fakta (nonaktif pada huruf Besar), gambar.
- **Tata letak manual**: geser orang ke kiri/kanan lewat pegangan `↔`, geser garis keluarga naik/turun lewat titik kontrol, Simpan/Batal, atur ulang. Penyesuaian disimpan sebagai selisih, jadi tidak hilang saat pohon berubah.
- **Pusatkan**, **perbesar ×1,15 / perkecil ×0,85** (batas 5 %–200 %), geser & cubit (pinch) di layar sentuh.
- **Atur ulang pohon** dengan konfirmasi.

### Peningkatan
- **Diagram bergaya archify**: kanvas slate dengan kisi, kartu bersih dengan aksen, metadata monospace, garis siku membulat, sorotan garis keturunan (leluhur + keturunan) orang terpilih, animasi *trace* opsional, tema terang/gelap.
- **Bingkai foto berbeda per jenis kelamin**: cincin biru = laki-laki, magenta = perempuan, ungu putus-putus = lainnya/tidak diketahui (dengan legenda).
- **Kontrol generasi**: pilih 0–10 atau Semua generasi leluhur (▲) dan keturunan (▼) di sekitar orang fokus; tombol `+`/`−` pada kartu untuk membuka/menutup cabang; ringkas/perluas rincian per kartu.
- **Pencarian** (Ctrl+F): nama (tanpa peduli aksen), tahun, tempat, pekerjaan, atau ID; navigasi keyboard; hasil disorot di kanvas; memilih hasil memusatkan atau memindahkan fokus pohon.
- **Simpan** ke format `.sambung` (ZIP berisi `tree.json`, foto, dan GEDCOM sumber) yang bisa dibuka ulang tanpa kehilangan apa pun.
- **Ekspor GEDCOM 5.5.1** *lossless*: record yang tidak diubah ditulis ulang **identik byte-per-byte** (BOM, CRLF, tag vendor, baris tak standar); hanya orang/keluarga yang berubah yang ditulis ulang. Opsi ZIP dengan folder `media/`.
- **Ekspor PNG** dengan preset **Ringkas** (nama, tanggal, foto kecil), **Normal** (mengikuti pengaturan), **Rinci** (semua kolom); latar kisi/putih/transparan; resolusi 1×–3×; skala otomatis diturunkan bila melebihi batas canvas. Juga **JPEG** dan **SVG**.
- **Dokumen silsilah teks**: leluhur bernomor Ahnentafel, keturunan bernomor bertingkat (1, 1.1, 1.1.2) lengkap dengan pasangan, catatan opsional, indeks nama, dan seluruh kelompok keluarga.
- **Import MyHeritage**: GEDCOM ekspor MyHeritage (diuji 2.336 orang / 658 keluarga) dan cadangan proyek Family Tree Builder `.zip` (`Database/*.ftb` = SQLite) — dikonversi **hanya-baca** termasuk foto profil.
- **Tautkan folder foto**: foto yang dirujuk GEDCOM (path absolut Windows) dicocokkan berdasarkan nama file.
- **Data besar**: tata letak berlapis dengan penempatan isotonik (PAVA) — tanpa kartu bertumpuk pada 2.336 orang, mode "Semua" sekalipun.
- **PWA & mobile**: dapat dipasang, bekerja offline, panel editor menjadi *bottom sheet* di layar ≤760 px, menu "lainnya" untuk alat sekunder, tanpa *overflow* horizontal.
- **Bahasa**: Indonesia (default), Jawa, Inggris — mencakup UI, nama otomatis ("Ayah dari …"), pesan, label kartu & legenda ekspor, dan dokumen teks.
- **Penyimpanan otomatis** di IndexedDB (bertahan setelah reload/tutup browser) + peringatan bila ada perubahan yang belum disimpan ke file.

## Cara menjalankan

Prasyarat: Node.js 22+ dan npm.

```bash
npm install
npm run dev        # http://127.0.0.1:5173 (pengembangan)
npm run build      # hasil statis di dist/
npm run preview    # http://127.0.0.1:4173 (uji build produksi + service worker)
```

Folder `dist/` bisa disajikan dari server statis mana pun (GitHub Pages, Netlify, `npx serve dist`, dsb.). Setelah dibuka sekali, aplikasi tetap berfungsi tanpa internet.

### Memasang sebagai aplikasi
Buka aplikasi di Chrome/Edge (desktop atau Android) → tombol **Pasang** di toolbar (atau menu browser "Install app"). Di iOS Safari: Bagikan → *Add to Home Screen*.

## Cara penggunaan

1. **Mulai** – pohon awal tampil dengan "Saya" terpilih. Klik/ketuk kartu untuk memilih orang; panel kiri (atau bawah di ponsel) menampilkan datanya.
2. **Ubah data** – tekan *Ubah data*, isi tab Pribadi dan Biografi, lalu *Simpan*. Tanggal yang tidak lengkap (mis. hanya tahun) diperbolehkan; untuk tanggal perkiraan pilih *Tanggal perkiraan atau rentang…* dan tulis mis. `ABT 1950`.
3. **Tambah kerabat** – *Tambah orang tua / saudara / pasangan / anak*. Untuk anak, pilih pasangan yang menjadi orang tua lainnya.
4. **Foto** – tab *Gambar* → *Unggah gambar* → geser/zoom → *Pakai foto*.
5. **Atur tampilan** – *Pengaturan pohon* (ikon geser) untuk format tanggal, ukuran huruf, kolom yang tampil, tema, dan bahasa. Kontrol **▲/▼ Generasi** di toolbar menentukan berapa generasi leluhur dan keturunan yang ditampilkan.
6. **Cari** – ikon kaca pembesar atau Ctrl+F, ketik nama/tahun/tempat, Enter untuk lompat. *Tampilkan pohon dari orang ini* menjadikan orang terpilih sebagai pusat pohon.
7. **Tata letak manual** – tombol tata letak → baca penjelasan → seret `↔` atau titik kontrol garis → *Simpan*.
8. **Buka berkas** – *Buka* → *Buka file…* untuk `.sambung`, `.ged`, atau `.zip`. Untuk GEDCOM dengan foto terpisah, lanjutkan dengan *Tautkan folder foto…* dan pilih folder fotonya (mis. `*_Photos`).
9. **Simpan** – *Simpan* (Ctrl+S) mengunduh `<judul>.sambung`; buka lagi kapan saja lewat *Buka*.
10. **Ekspor** – *Ekspor* → pilih PNG (Ringkas/Normal/Rinci), JPEG, SVG, GEDCOM, atau Dokumen silsilah; pilih *Tampilan saat ini* atau *Seluruh keluarga yang terhubung*.

## Batasan format (jujur)

- **GEDCOM**: UTF-8 (dengan/tanpa BOM); file non-UTF-8 dibaca sebagai Windows-1252 dengan peringatan; **ANSEL tidak didukung**. Kolom yang bisa diedit: nama (GIVN/SURN/`_MARNM`), jenis kelamin, BIRT DATE/PLAC, DEAT/DATE, OCCU, NOTE pertama, foto utama (OBJE `_PRIM`), relasi keluarga. Tag lain (RESI, MARR, DIV, EMAIL, `_UID`, `_UPD`, sumber, dll.) **dipertahankan apa adanya** tetapi tidak bisa diedit di aplikasi. Catatan HTML MyHeritage ditampilkan sebagai teks; bila diedit, ditulis kembali sebagai teks biasa.
- **Satu foto utama per orang** dapat diedit; foto lain dari sumber ditampilkan hanya-baca dan tetap ada di ekspor GEDCOM.
- **MyHeritage FTB (`.zip` berisi `.ftb`)**: diimpor **hanya-baca** (nama, jenis kelamin, lahir/wafat, pekerjaan, catatan, keluarga, foto profil & galeri). Fakta lain (RESI, BURI, EDUC, MARR, DIV, …), *face tagging*, sumber, dan konfigurasi proyek **tidak** diimpor (dilaporkan saat impor). File `.ftb` tidak pernah ditulis; simpan hasil edit sebagai `.sambung` atau GEDCOM.
- **Nama dengan karakter `/`** di FTB bertabrakan dengan pembatas nama keluarga GEDCOM; ini sudah ambigu sejak ekspor MyHeritage sendiri.
- **Batas canvas browser**: PNG/JPEG yang sangat besar otomatis diperkecil; untuk pohon raksasa gunakan SVG atau kurangi generasi.
- Fitur situs asli yang terkait akun (login, simpan ke cloud, paket berbayar, batas 40/70 anggota, batas 5 gambar/3 MB) **sengaja tidak** direplikasi.

## Pengujian

```bash
npm test                 # unit (Vitest): GEDCOM, FTB, relasi, layout, tanggal
npx playwright test      # E2E pada build produksi memakai Microsoft Edge terpasang
```

Tes yang memakai data keluarga nyata membaca salinan di `local-test-data/` (diabaikan git) dan otomatis dilewati bila file tidak ada. Lihat [TEST_REPORT.md](TEST_REPORT.md) dan [FEATURE_MATRIX.md](FEATURE_MATRIX.md).

## Struktur proyek

```
src/
  model/      tipe data, relasi (tambah/hapus), tanggal, pohon awal
  gedcom/     parser/serializer GEDCOM lossless + pemetaan model
  ftb/        importer cadangan MyHeritage Family Tree Builder (SQLite via sql.js)
  layout/     pemilihan generasi, metrik kartu, tata letak berlapis
  render/     SVG pohon (dipakai kanvas & ekspor), palet archify
  io/         format .sambung, ekspor gambar & teks
  storage/    IndexedDB
  ui/         komponen React
  i18n.ts     kamus Indonesia / Jawa / Inggris
tests/unit    Vitest      tests/e2e   Playwright      tests/fixtures  GEDCOM sintetis
```

## Berkontribusi

Laporan bug, perbaikan, terjemahan, dan dokumentasi sangat diterima. Baca [CONTRIBUTING.md](CONTRIBUTING.md) terlebih dahulu. Aturan terpenting: **jangan pernah mengunggah data keluarga nyata** ke commit, issue, atau screenshot; pakai data fiktif di `docs/demo`.

## Lisensi & atribusi

Proyek ini dirilis di bawah **[lisensi MIT](LICENSE)** © 2026 Abdur Rohman Muhammad.

Kode ditulis untuk proyek ini; tidak ada kode, teks, atau gambar dari family-tree-builder.com yang disalin. Gaya visual terinspirasi dari skill *archify* (MIT). Ikon dari [Lucide](https://lucide.dev) (ISC).
