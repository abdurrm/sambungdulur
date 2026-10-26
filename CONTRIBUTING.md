# Berkontribusi ke SambungDulur

Terima kasih sudah tertarik membantu. SambungDulur adalah pembuat pohon keluarga **luring** (tanpa akun, tanpa server). Kontribusi berupa laporan bug, perbaikan, terjemahan, dokumentasi, dan fitur baru semuanya diterima.

*English summary: bug reports, fixes, translations, docs and features are welcome. Run `npm test` and `npx playwright test` before opening a pull request, keep all UI text in `src/i18n.ts`, and never commit real family data. By contributing you agree your work is released under the MIT license.*

## Aturan utama (baca ini dulu)

1. **Jangan pernah menyertakan data keluarga nyata** di commit, issue, screenshot, atau fixture. Pakai data fiktif seperti `docs/demo/keluarga-contoh.ged` atau `tests/fixtures/synthetic.ged`. Berkas `*.ged`, `*.zip`, `*.ftb`, dan `*.sambung` diabaikan git secara bawaan; jangan mengubahnya kecuali untuk fixture fiktif.
2. **Privasi adalah fitur.** Aplikasi tidak boleh mengirim data pengguna ke jaringan, memakai analitik, atau memerlukan akun. Kode baru yang melakukan permintaan jaringan akan ditolak kecuali untuk memuat aplikasi itu sendiri.
   Pengecualian yang dipilih pengguna: form Feedback menyiapkan teks yang ditulis pengguna dan membuka halaman GitHub setelah konfirmasi bahwa isinya boleh dipublikasikan. Tidak ada pengiriman otomatis, token GitHub di aplikasi, atau lampiran data silsilah/KK. Informasi browser hanya dimasukkan jika pengguna memilihnya; pengiriman akhir dilakukan pengguna di GitHub.
3. **Jangan menyalin kode, teks, atau gambar dari situs lain** (termasuk family-tree-builder.com). Perilaku boleh dipelajari; implementasi harus karya sendiri.
4. **GEDCOM harus tetap lossless.** Berkas yang dibuka lalu diekspor tanpa perubahan harus identik byte-per-byte, dan edit hanya boleh menulis ulang baris yang berubah.

## Menyiapkan lingkungan

Prasyarat: Node.js 22+, npm, dan Microsoft Edge atau Chrome (untuk tes E2E).

```bash
git clone https://github.com/abdurrm/sambungdulur.git
cd sambungdulur
npm install
npm run dev        # http://127.0.0.1:5173
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Typecheck + build produksi ke `dist/` |
| `npm run preview` | Menyajikan build (port 4173), termasuk service worker |
| `npm test` | Tes unit (Vitest) |
| `npx playwright test` | Tes E2E pada build produksi (membangun dan menjalankan preview sendiri; pastikan port 4173 kosong) |
| `npm run docs` | Membuat ulang screenshot panduan (butuh preview aktif di port 4173) |

## Struktur kode

```
src/model/    tipe, relasi (tambah/hapus orang), tanggal, pohon awal
src/gedcom/   parser/serializer GEDCOM lossless + pemetaan ke model
src/ftb/      importer cadangan MyHeritage Family Tree Builder (SQLite, hanya-baca)
src/layout/   pemilihan generasi, metrik kartu, tata letak berlapis
src/render/   SVG pohon (dipakai kanvas dan ekspor), palet warna
src/io/       format .sambung, ekspor gambar dan teks
src/storage/  IndexedDB
src/ui/       komponen React
src/i18n.ts   kamus Indonesia / Jawa / Inggris
tests/unit    Vitest        tests/e2e    Playwright        tests/fixtures  data fiktif
```

## Alur kerja

1. Buka *issue* untuk perubahan besar agar arahnya disepakati dulu. Perbaikan kecil boleh langsung berupa *pull request*.
2. Buat cabang dari `main` (`fix/…`, `feat/…`, `docs/…`).
3. Tulis tes bersama perubahan:
   - logika data (GEDCOM, relasi, tanggal, layout) → tes unit di `tests/unit`;
   - perilaku antarmuka → tes E2E di `tests/e2e/app.spec.ts`.
   Untuk bug, tambahkan tes yang gagal tanpa perbaikan Anda.
4. Jalankan sebelum mengirim:
   ```bash
   npx tsc --noEmit -p .
   npm test
   npx playwright test
   ```
5. Kirim *pull request* dengan deskripsi apa yang berubah dan mengapa. Sertakan screenshot untuk perubahan tampilan.

## Panduan kode

- **TypeScript strict.** Hindari `any`; gunakan tipe di `src/model/types.ts`.
- **Semua teks tampilan lewat `t('kunci')`** di `src/i18n.ts`, dan wajib ada di ketiga bahasa. Tipe `Key` membuat kunci yang kurang gagal saat typecheck. Nama otomatis ("Ayah dari …") dan pesan error juga memakai `t()`.
- **Model tidak dimutasi.** Fungsi di `src/model/relations.ts` mengembalikan `TreeDoc` baru.
- **Tata letak responsif:** periksa lebar 390 px dan 1100–2560 px. Tes "header toolbar never overflows" memeriksa luapan toolbar pada sembilan lebar dan tiga bahasa.
- **Aksesibilitas:** tombol ikon wajib punya `title`/`aria-label`; target sentuh minimal ±40 px.
- Ikuti gaya kode di sekitarnya (komentar seperlunya, penamaan yang konsisten).

## Menambah bahasa

1. Di `src/i18n.ts`, tambahkan kode ke tipe `Lang` dan `LANGS`, nama bulan di `MONTHS_BY_LANG`, kata kualifikasi tanggal di `QUALIFIERS` (`src/model/dates.ts`), dan satu kamus lengkap bertipe `Record<Key, string>`.
2. Tambahkan bahasa ke tes "defaults to Indonesian and switches…" dan "header toolbar never overflows…".
3. Penutur asli sangat dihargai untuk meninjau terjemahan.

## Dokumentasi dan video

- Panduan ada di `docs/PANDUAN.md`. Screenshot dibuat otomatis oleh `npm run docs`, jadi ubah skripnya (`scripts/make-docs.mjs`) alih-alih menyunting gambar.
- Video demo dibuat oleh `scripts/video/` (naskah di `scenes.json`, suara lewat `tts.ps1`, perekaman di `record.mjs`). Lihat `docs/video/README.md`.

## Melaporkan bug

Sertakan: langkah untuk mengulang, hasil yang diharapkan dan yang terjadi, browser dan sistem operasi, serta bahasa yang dipakai. Bila masalahnya terkait berkas, **buat contoh fiktif yang memicu masalah yang sama**; jangan melampirkan berkas keluarga nyata.

## Keamanan

Jangan melaporkan celah keamanan lewat *issue* publik. Gunakan fitur **Report a vulnerability** pada tab *Security* repositori, atau hubungi pemilik repositori secara langsung.

## Lisensi

Dengan mengirim kontribusi, Anda setuju karya Anda dirilis di bawah [lisensi MIT](LICENSE) proyek ini.
