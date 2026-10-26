# Roadmap pengembangan SambungDulur

Tanggal: 26 Oktober 2026. Baseline rilis: v1.0.0, commit e89d2b7d1db691fad878a2a4f136430bcd653642.

Dokumen ini memisahkan permintaan pengguna, usulan desain, dan fitur yang sudah tersedia. Semua kotak kosong berarti pekerjaan belum selesai. Desain fase 1 disetujui melalui tiga putaran grill-with-docs dan disertakan dalam rilis v1.0.1 bersama form feedback. Hasil validasi dan batasnya dicatat di TEST_REPORT.md; publikasi/deployment diverifikasi terpisah dari implementasi.

## Baseline yang sudah tersedia

Aplikasi PWA luring tanpa akun, editor silsilah, impor GEDCOM/ZIP MyHeritage FTB, simpan/buka `.sambung`, ekspor GEDCOM/gambar/teks, foto, pencarian, kontrol generasi, pengaturan tampilan, tata letak manual, dan antarmuka Indonesia/Jawa/Inggris. Lihat README dan FEATURE_MATRIX untuk cakupan dan batasan.

Tambahan lokal setelah baseline: pilih pasangan lama, tautan orang tua melalui draf KK, impor KK berbasis orang acuan, pencocokan yang ditinjau, referensi sumber, dan ekspor cabang. Autentikasi Google, penyimpanan Drive, kolaborasi, serta discovery belum dibangun.

## Keputusan disetujui — putaran 1

Pengguna menjawab "yaa, setuju semua" pada 26 Oktober 2026:

1. Pasangan dapat dipilih dari orang yang sudah ada, termasuk saudara jauh; identitas dan hubungan asalnya dipertahankan.
2. Pembacaan KK menghasilkan draf untuk ditinjau dengan pilihan tautkan orang lama / buat baru / tunda.
3. NIK opsional disimpan privat dalam proyek sebagai bantuan pencocokan; hasil OCR wajib diperiksa.
4. OCR tahap pertama dilakukan lokal di perangkat, tanpa mengirim dokumen ke layanan luar.
5. Dokumen KK asli disimpan bersama proyek, dengan pilihan menyertakannya dalam cadangan `.sambung`.

Persetujuan desain tidak menandai penyelesaian implementasi; seluruh kotak pekerjaan tetap kosong sampai dikerjakan dan diverifikasi.

## Keputusan disetujui — putaran 2

Pengguna menjawab "setuju semua":

1. Ekspor cabang hanya pangkal dan keturunannya secara bawaan, dengan pilihan menyertakan pasangan tanpa menelusuri keluarga asal pasangan.
2. Ekspor mengambil seluruh keturunan tanpa dipengaruhi cabang yang dilipat; cakupan konsisten untuk gambar, teks, GEDCOM, dan salinan cabang `.sambung`. Simpan proyek tetap penuh.
3. Orang tua yang belum ditemukan ditawarkan sebagai draf orang baru; pembuatan memerlukan pilihan pengguna dan dapat ditunda.
4. Konflik diputuskan per atribut/hubungan dengan mempertahankan data lama secara bawaan. Impor ulang tidak menggandakan data yang telah diterapkan.
5. Tolak pasangan diri sendiri dan siklus orang tua-anak; dukung pasangan kerabat jauh dan beberapa hubungan pasangan tanpa menghapus hubungan lama.
6. NIK dan KK asli tidak disertakan secara bawaan pada ekspor cabang; penyertaan memerlukan pilihan eksplisit.

Tambahan permintaan pada jawaban yang sama: tentukan orang acuan saat mengunggah KK untuk mempersempit pencocokan. Informasi dari KK juga digunakan untuk memperbarui saudara, anak, dan orang tua yang identitasnya sudah ditautkan.

## Fase 1A — Menautkan pasangan yang sudah ada (prioritas pertama)

Permintaan: seseorang menikahi saudara jauh yang telah tercatat; jangan membuat orang baru.

- [x] Tambahkan pilihan pasangan baru atau pilih orang yang sudah ada, dengan pencarian dan ringkasan identitas.
- [x] Buat hubungan pasangan menggunakan identitas lama; pertahankan orang tua, pasangan lain, anak, foto, dan data yang sudah ada. Pasangan baru tidak otomatis menjadi orang tua anak yang sudah ada.
- [x] Jangan menggandakan hubungan bila pasangan yang sama sudah ditautkan; tampilkan hubungan yang sudah ada.
- [x] Terapkan aturan disetujui: tolak pasangan diri sendiri dan siklus orang tua-anak; dukung kerabat jauh serta beberapa hubungan pasangan tanpa menghapus hubungan lama.
- [x] Uji perkawinan kerabat dengan leluhur bersama dan pasangan berbeda tingkat generasi menggunakan data fiktif; pastikan navigasi, garis keluarga, dan layout tetap benar.
- [x] Uji simpan/buka `.sambung`, ekspor/impor GEDCOM, dan undo/redo bila tersedia pada alur tersebut.

Keputusan inti disetujui: orang tetap satu, yang ditambah adalah hubungan. Menautkan pasangan berbeda dari menggabungkan dua catatan duplikat.

## Fase 1B — Impor KK dan pencegahan duplikasi

Permintaan: tambahkan beberapa dokumen PDF atau gambar scan sebagai referensi; anggota dan orang tuanya mungkin sudah ada di silsilah.

- [x] Buat alur **Impor KK** tersendiri yang menambah data ke proyek aktif; jangan memakai alur Buka yang mengganti seluruh proyek.
- [x] Tambahkan pemilihan **orang acuan KK** dari orang yang sudah ada sebelum pencocokan, serta tautan KK ke orang acuan tersebut sebagai referensi.
- [x] Hubungkan orang acuan dengan baris anggota atau penyebutan orang tua yang sesuai dalam hasil pembacaan; tampilkan bukti nama/NIK/tanggal lahir dan perbedaan yang perlu ditinjau.
- [x] Gunakan hubungan orang acuan untuk mempersempit kandidat saudara, anak, pasangan, dan orang tua; hubungan dekat membantu pencarian tetapi tidak membuktikan identitas dengan sendirinya.
- [x] Susun draf pembaruan untuk setiap kerabat yang tercantum/dirujuk di KK: informasi tambahan dan hubungan yang didukung sumber dapat diterapkan bersama setelah peninjauan; jangan menyalin atribut satu anggota ke semua kerabat.
- [x] Terima beberapa PDF, JPEG, dan PNG; baca teks PDF bila tersedia dan gunakan OCR untuk scan/gambar. Tangani rotasi, tabel berbeda, dan nomor baris penghubung tabel anggota dengan tabel orang tua.
- [x] Tampilkan draf hasil ekstraksi yang bisa dikoreksi sebelum memengaruhi pohon.
- [x] Implementasikan OCR lokal yang sudah disetujui; tetapkan cara memuat aset OCR agar penggunaan luring tetap jelas.
- [x] Cocokkan anggota dan nama ayah/ibu dengan orang lama; tampilkan alasan kandidat dan perbedaan data.
- [x] Pilihan per calon orang: tautkan orang lama, buat orang baru, atau tunda. Nama sama saja bukan bukti identitas.
- [x] Implementasikan NIK opsional privat sebagai bantuan pencocokan sesuai persetujuan; NIK hasil OCR harus ditinjau dan NIK kosong tidak boleh diperlakukan sebagai cocok.
- [x] Tangani orang yang muncul pada beberapa KK/tahun sebagai kandidat individu yang sama. Tidak tercantum pada KK berikutnya tidak berarti wafat atau hubungan keluarga terputus.
- [x] Tangani nama ayah/ibu yang hanya disebut di kolom orang tua: cari orang lama dahulu; tawarkan draf orang baru setelah pengguna memilihnya dan deduplikasi draf orang tua yang dirujuk beberapa anak.
- [x] Tautkan ayah/ibu satu per satu, termasuk ketika salah satunya sudah ada; konflik orang tua ditinjau, tidak ditimpa diam-diam.
- [x] Pisahkan keanggotaan KK dari hubungan biologis; kepala keluarga tidak otomatis ayah semua anggota, dan status anggota tidak cukup untuk memastikan seluruh hubungan pasangan/orang tua.
- [x] Tinjau konflik atribut dan hubungan; pertahankan data lama serta asal usul informasi sampai pengguna memutuskan.
- [x] Simpan rujukan dokumen/halaman/baris untuk usulan data; simpan dokumen asli bersama proyek dengan opsi menyertakannya dalam cadangan `.sambung`, sesuai persetujuan.
- [x] Deteksi dokumen yang diimpor ulang dan terapkan perubahan sebagai satu transaksi yang bisa dibatalkan tanpa meninggalkan orang/hubungan parsial.
- [ ] Penggabungan duplikat lama: kebutuhan terpisah, belum diimplementasikan. Penautan orang lama dan pencegahan duplikasi impor bukan operasi merge.
- [x] Uji data fiktif: dua orang senama, nama berbeda dengan identitas sama, salah baca NIK, orang tua di KK lain, KK historis, impor ulang, batal, dan simpan/buka ulang beserta sumber.
- [x] Uji impor berbasis orang acuan: beberapa KK dengan acuan berbeda, acuan hanya disebut sebagai orang tua, acuan tidak ditemukan, kandidat keluarga dekat yang salah, dan pembaruan serentak saudara/anak/orang tua tanpa menggandakan orang.

Empat lampiran pengguna telah diperiksa lokal untuk variasi struktur: dua PDF mempunyai lapisan teks; dua gambar memerlukan OCR, salah satunya berorientasi menyamping. Dokumen pribadi, hasil ekstraksi, identitas, dan gambar tidak disertakan dalam repositori atau catatan rilis.

## Fase 1C — Ekspor cabang keturunan (tambahan permintaan)

Permintaan pengguna: misalnya **Bani Irjam**, keluaran hanya **Irjam dan anak keturunannya**. Fitur ini sudah diimplementasikan lokal dan tidak menjadi bagian rilis v1.0.0.

Temuan kode saat perencanaan: cakupan view/all di `src/ui/ExportDialog.tsx` hanya diterapkan pada gambar dan teks. Seleksi gambar di `src/layout/visible.ts` masih dapat memasukkan saudara orang fokus; teks di `src/io/textExport.ts` memakai indeks/hitungan seluruh proyek dan selalu menulis pasangan; GEDCOM/ZIP foto dan Simpan `.sambung` memakai dokumen penuh. Mengatur leluhur ke nol saja belum memenuhi ekspor Bani.

- [x] Tambahkan cakupan ekspor berdasarkan pangkal keturunan yang dipilih dari orang dalam proyek.
- [x] Telusuri hubungan anak secara rekursif; keluarkan leluhur pangkal dan cabang samping yang bukan keturunannya.
- [x] Implementasikan pasangan opsional, tidak ikut secara bawaan, sesuai persetujuan; jangan menelusuri keluarga asal pasangan.
- [x] Ekspor seluruh keturunan tanpa dipengaruhi cabang yang disembunyikan pada layar, sesuai persetujuan.
- [x] Terapkan pembatasan konsisten pada PNG/JPEG/SVG, teks, GEDCOM/ZIP foto, dan salinan cabang `.sambung` yang terpisah dari Simpan proyek penuh, sesuai persetujuan.
- [x] Batasi indeks nama, hitungan, kelompok keluarga, referensi GEDCOM, dan media ke cabang terpilih; jangan bocorkan nama/data cabang lain lewat bagian tambahan.
- [x] Untuk salinan cabang, saring atau bangun ulang sumber GEDCOM; jangan membawa `gedcomSource` penuh ke GEDCOM atau `.sambung` terbatas. Pelestarian lossless ekspor proyek penuh tetap berlaku.
- [x] Tampilkan pratinjau pangkal dan jumlah orang yang akan diekspor; ekspor cabang tidak menandai proyek asli sebagai sudah disimpan.
- [x] Uji pernikahan antar-keturunan: orang yang tercapai melalui beberapa jalur tetap satu identitas dalam hasil.
- [x] Uji keturunan dari beberapa pasangan dan pasangan yang mempunyai anak dari keluarga lain; jangan memasukkan anak pasangan yang bukan keturunan pangkal.
- [x] Keluarkan NIK dan KK asli dari ekspor cabang secara bawaan; sediakan pilihan eksplisit penyertaan sesuai persetujuan. Dokumen utuh dapat memuat orang di luar cabang.
- [x] Pastikan ekspor tidak mengubah proyek asli; uji hasil gambar, teks, dan buka ulang data ekspor menggunakan keluarga fiktif.

## Feedback pengguna — v1.0.1

- [x] Form berbahasa Indonesia/Jawa/Inggris dengan jenis masukan, judul, rincian, langkah reproduksi, dan pratinjau.
- [x] Draf issue GitHub baru dengan judul/isi terisi; teks panjang menggunakan salin/tempel agar tidak terpotong.
- [x] Pilih nomor issue lama untuk komentar melalui salin teks dan pengiriman akhir di GitHub.
- [x] Konfirmasi isi publik, tanpa lampiran data keluarga/KK otomatis, serta informasi browser hanya bila dipilih.
- [x] Akses desktop dan ponsel, salin manual jika clipboard tidak tersedia, serta versi aplikasi untuk membantu developer.

GitHub Discussions belum diaktifkan pada repositori saat pemeriksaan pra-rilis; saluran yang digunakan adalah GitHub Issues dan komentar issue.

## Fase 2 — Google dan penyimpanan pribadi (diminta, belum dibangun)

- [ ] Autentikasi Google sebagai pilihan; pertahankan penggunaan lokal tanpa akun.
- [ ] Opsi menyimpan/membuka proyek di Google Drive pengguna serta membagikan berkas kepada pengguna lain.
- [ ] Pisahkan login, izin akses Drive, dan izin berbagi; tentukan penanganan izin dicabut, logout, token kedaluwarsa, dan kegagalan penyimpanan.
- [ ] Tetapkan format berkas, versi, pemulihan, konflik perubahan lokal/Drive, dan batasan penyimpanan saat luring.
- [ ] Catat keputusan arsitektur dan sesuaikan README/CONTRIBUTING sebelum mengaktifkan koneksi cloud: kebijakan saat ini melarang pengiriman data pengguna. Permintaan fase 2 mengizinkan perencanaan perubahan itu, bukan berarti cloud sudah tersedia.

## Fase 3 — Kolaborasi pada proyek pemilik (diminta, belum dibangun)

- [ ] Pemilik mengundang akun lain; undangan harus diterima dan penerima login sebelum bekerja bersama.
- [ ] Berkas proyek tetap di Drive pemilik; tentukan otorisasi baca/edit dan pencabutan akses.
- [ ] Putuskan kolaborasi waktu nyata atau sinkronisasi bergiliran, resolusi konflik, jejak perubahan, dan pemulihan.
- [ ] Selaraskan izin aplikasi dengan izin Drive; tentukan dampak dokumen dipindah/dihapus atau pemilik keluar.
- [ ] Tentukan apakah akses ke pohon sekaligus memberikan akses ke lampiran KK dan data sensitif.

## Fase 4 — Discovery terbatas dengan persetujuan kedua pihak (diminta, belum dibangun)

- [ ] Discovery hanya aktif bila pemilik mengaktifkannya; tentukan informasi minimum yang boleh digunakan dan dibagikan.
- [ ] Tawarkan kandidat kemiripan, dengan cara menolak atau menarik partisipasi; tidak menggabungkan otomatis.
- [ ] Kedua pihak menyetujui sebelum penggabungan atau pertukaran data yang disepakati.
- [ ] Bedakan menautkan identitas lintas proyek, menyalin cabang, dan menyatukan kepemilikan proyek; makna "menggabungkan" belum diputuskan.
- [ ] Tentukan batas informasi sebelum/sesudah persetujuan, termasuk orang hidup/anak, NIK, alamat, dan dokumen asli.
- [ ] Putuskan tempat pencarian kandidat, dampak pencabutan persetujuan, konflik data, dan pemulihan hasil penggabungan.

## Keputusan disetujui — putaran 3 (wawancara fase 1 selesai)

12. Tiap dokumen mempunyai orang acuan sendiri, termasuk saat mengunggah beberapa KK sekaligus. Orang terpilih menjadi isian awal yang dapat diganti per dokumen.
13. Bila orang acuan belum bisa ditautkan ke baris/penyebutan di KK, penerapan ditahan sampai pengguna mengoreksi hasil baca, mengganti acuan, atau memilih dokumen yang sesuai.
14. Kandidat awal diprioritaskan dari keluarga orang acuan, dengan pilihan eksplisit untuk mencari ke seluruh proyek. Perbedaan NIK atau atribut tetap ditampilkan meski kandidat merupakan kerabat dekat.

Alur hasil kesepakatan sejauh ini: pilih orang acuan → baca KK → konfirmasi penyebutan acuan → tinjau tautan anggota dan orang tua → tinjau pembaruan kerabat → terapkan bersama. Penambahan atribut kosong tetap masuk pratinjau; konflik tidak ditimpa otomatis. Pembatalan membatalkan perubahan orang dan hubungan dari satu penerapan impor.

Pengguna menjawab "ya setuju", mengonfirmasi kesepahaman fase 1 dan mengizinkan implementasi. Rincian fase cloud tetap todo dan tidak menghambat fase 1.

## Batas verifikasi fase 1

Pembacaan empat referensi pribadi hanya dilakukan lokal tanpa menerapkan identitas pribadi ke proyek uji. OCR menghasilkan draf yang bisa keliru; hasil ekstraksi bukan verifikasi identitas atau bukti semua kolom benar. Perangkat ponsel fisik dan semua variasi KK belum diverifikasi. Lihat TEST_REPORT.md untuk pengujian aplikasi; hasil deployment dicatat terpisah setelah pemeriksaan remote.
