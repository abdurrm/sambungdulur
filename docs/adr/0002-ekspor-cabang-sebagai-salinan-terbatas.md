---
status: accepted
---

# Ekspor cabang menggunakan salinan data yang dibatasi

Pengguna menyetujui ekspor pangkal dan seluruh keturunannya, dengan pasangan opsional, konsisten untuk semua format. Bentuk salinan data terbatas sebelum menjalankan serializer: orang, relasi, media, indeks dan rujukan sumber harus berada dalam cabang terpilih. Memakai filter tampilan saja ditolak karena dapat tetap memasukkan saudara pangkal dan indeks atau record dari seluruh proyek.

Salinan cabang membuang GEDCOM sumber penuh dan membangun record baru agar data dari cabang lain tidak ikut lewat record vendor/sumber. Konsekuensinya, pelestarian byte-per-byte berlaku untuk ekspor proyek penuh yang tidak berubah, bukan salinan cabang. NIK dan KK asli tidak ikut secara bawaan; pilihan eksplisit menyertakan KK utuh dapat membawa informasi orang di luar cabang. Catatan bebas dan foto tidak disunting otomatis.

Ekspor `.sambung` cabang menghasilkan salinan yang dapat dibuka ulang. Simpan proyek tetap menyimpan proyek penuh dan ekspor cabang tidak menandainya sebagai sudah tersimpan. Keputusan disetujui pada putaran kedua wawancara, 26 Oktober 2026.
