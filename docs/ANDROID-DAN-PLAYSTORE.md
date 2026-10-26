# Instalasi Android dan publikasi Google Play

Panduan untuk SambungDulur. Dokumentasi resmi diperiksa pada 26 Oktober 2026; periksa kembali persyaratan Play Console ketika akan mengirim aplikasi.

## Memasang lewat browser Android

1. Buka [SambungDulur](https://abdurrm.github.io/sambungdulur/) langsung di Chrome Android yang mutakhir, menggunakan tab biasa. Jika tautan dibuka di dalam WhatsApp/Instagram, pilih buka di Chrome terlebih dahulu.
2. Tunggu pemuatan awal, lalu gunakan aplikasi sebentar. Promosi instalasi Chrome mempertimbangkan interaksi pengguna dan waktu kunjungan; tombol tidak selalu langsung muncul.
3. Buka menu Chrome **⋮ → Tambahkan ke layar utama → Instal** atau **Instal aplikasi**. Nama menu dapat berbeda menurut versi browser. Jika aplikasi menampilkan opsi **Instal** di menu lainnya, opsi itu juga bisa dipakai.
4. Konfirmasi, lalu buka ikon SambungDulur dari layar utama/daftar aplikasi.
5. Setelah pemuatan pertama selesai, tutup aplikasi, aktifkan mode pesawat, lalu buka kembali dan uji pohon contoh. Untuk uji OCR pertama kali, tunggu seluruh aset selesai dimuat sebelum memutus jaringan.

Instalasi browser tidak memerlukan Play Store atau akun Google. Jika tombol tidak muncul, pastikan tab bukan Samaran, aplikasi belum terpasang, URL memakai HTTPS, dan browser bukan peramban dalam aplikasi lain. Menu instalasi serta tampilnya promosi merupakan keputusan browser.

Data keluarga tetap disimpan lokal. Ekspor cadangan `.sambung` sebelum menghapus data situs/browser atau mengganti domain/perangkat. Pemasangan aplikasi bukan pengganti cadangan.

## Kesiapan situs saat diperiksa

| Komponen | Hasil |
| --- | --- |
| HTTPS | Tersedia pada GitHub Pages |
| Manifest | Terhubung dari HTML, berhasil dibaca tanpa kesalahan |
| Nama, start URL, scope, standalone | Tersedia dan mengarah ke `/sambungdulur/` |
| Ikon PNG | Respons 200, ukuran aktual 192×192 dan 512×512 |
| Ikon maskable | Tersedia, ukuran aktual 512×512 |
| Service worker | Aktif dan mengendalikan halaman pada pemeriksaan profil normal |
| Tombol instalasi | Kode menangani `beforeinstallprompt`; desktop dan menu mobile menampilkannya ketika browser menawarkan instalasi |
| Pemeriksaan browser | `Page.getInstallabilityErrors` di Microsoft Edge/Chromium dengan profil normal: tidak ada kesalahan |

Tidak ditemukan syarat dasar PWA yang hilang. Pemeriksaan ini berjalan pada browser Windows dengan viewport mobile; bukan bukti instalasi WebAPK pada Android fisik. Uji langkah pemasangan di atas tetap diperlukan. Screenshot manifest untuk tampilan dialog instalasi yang lebih kaya dapat ditambahkan kemudian; itu bukan syarat dasar.

Rujukan: [syarat instalasi Chrome](https://web.dev/articles/install-criteria).

## Jalur publikasi yang disarankan

Gunakan **Trusted Web Activity (TWA)** melalui **Bubblewrap**. Ini membuat aplikasi Android yang membuka PWA dengan browser pendukung. Web tetap menjadi sumber aplikasi; pembaruan web mengikuti deployment web. Perubahan paket Android, target SDK, dan penandatanganan tetap memerlukan rilis Android baru.

### 1. Tetapkan alamat web dan identitas aplikasi

- Tentukan URL produksi yang akan dipertahankan dan package ID permanen, misalnya `id.sambungdulur.app` (contoh, belum didaftarkan).
- Sediakan kontrol atas `https://HOST/.well-known/assetlinks.json`.
- Untuk alamat sekarang, lokasinya harus **`https://abdurrm.github.io/.well-known/assetlinks.json`**, bukan `https://abdurrm.github.io/sambungdulur/.well-known/assetlinks.json`. File ini perlu disajikan oleh situs akar akun `abdurrm.github.io`, atau gunakan domain/subdomain sendiri dengan kontrol akar domain.
- Domain sendiri tidak wajib untuk instalasi browser. Untuk TWA, domain sendiri memudahkan pengelolaan verifikasi. Jika berpindah domain, cadangkan dan impor kembali proyek: penyimpanan browser terpisah antar-origin.

Rujukan: [TWA dan Bubblewrap](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start), [lokasi Digital Asset Links](https://developer.android.com/training/app-links/configure-assetlinks).

### 2. Daftar dan verifikasi akun Play Console

Daftar di [Google Play Console](https://play.google.com/console/signup), pilih akun personal/organisasi sesuai keadaan sebenarnya, bayar biaya pendaftaran satu kali **US$25**, lalu selesaikan verifikasi identitas dan perangkat yang diminta. Siapkan email kontak pengembang. Lihat [panduan pendaftaran resmi](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en).

### 3. Siapkan materi dan kebijakan aplikasi

- Nama, deskripsi singkat/lengkap, kategori, email dukungan, ikon toko 512×512, feature graphic 1024×500, serta screenshot ponsel memakai keluarga fiktif.
- Publikasikan halaman kebijakan privasi yang dapat diakses umum dan sesuai perilaku aplikasi: keluarga/KK/OCR diproses lokal; feedback dikirim pengguna lewat GitHub; jelaskan penyimpanan, ekspor, penghapusan, dan kontak pengembang.
- Lengkapi App content: Data safety, rating konten, target audiens, deklarasi iklan, dan akses aplikasi. Aplikasi saat ini tidak membutuhkan login.
- Isi Data safety berdasarkan audit paket final, dependensi, hosting, dan alur feedback. Jangan otomatis menjawab “tidak mengumpulkan data” hanya karena penyimpanan silsilah lokal. Tambahan Google login/Drive pada fase berikutnya harus diikuti pembaruan deklarasi.

Rujukan: [penyiapan aplikasi](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en), [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

### 4. Buat proyek Android terpisah

Perintah berikut adalah petunjuk untuk dijalankan nanti, bukan instalasi yang sudah dilakukan dalam pekerjaan ini. Siapkan Node.js yang didukung, JDK, dan Android SDK mengikuti petunjuk Bubblewrap. Simpan proyek wrapper di direktori tersendiri.

```powershell
npm install -g @bubblewrap/cli
mkdir sambungdulur-android
cd sambungdulur-android
bubblewrap init --manifest=https://abdurrm.github.io/sambungdulur/manifest.webmanifest
bubblewrap build
```

Jika domain produksi berubah pada langkah 1, ganti URL manifest sebelum `init`. Konfirmasikan nama, package ID, ikon, URL, versi, dan signing key pada wizard. Cadangkan keystore dan kredensialnya secara aman; jangan commit ke Git.

Gunakan artefak **Android App Bundle (`.aab`)** untuk pengiriman Play, dan APK untuk pemasangan uji langsung. Ikuti output versi Bubblewrap yang dipakai. Periksa target SDK pada proyek hasil generate: per 26 Oktober 2026, aplikasi ponsel baru/pembaruan harus menargetkan **Android 16 / API 36 atau lebih tinggi**. Jangan menganggap nilai bawaan generator pasti memenuhi aturan terbaru.

Rujukan: [CLI Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md), [persyaratan target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [App Bundle dan versionCode](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en).

### 5. Hubungkan website dengan sertifikat Android

Aktifkan Play App Signing, lalu ambil fingerprint SHA-256 **app signing certificate** dari Play Console. Ini dapat berbeda dari upload key lokal. Publikasikan JSON berikut di akar host yang ditetapkan pada langkah 1, dengan nilai asli:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "id.sambungdulur.app",
      "sha256_cert_fingerprints": ["GANTI_DENGAN_SHA256_APP_SIGNING_CERTIFICATE"]
    }
  }
]
```

Pastikan URL memberikan HTTP 200, `Content-Type: application/json`, dan tanpa redirect. Sertifikat uji lokal dapat ditambahkan jika diperlukan untuk build uji; verifikasi ulang dengan sertifikat aplikasi yang didistribusikan Play. Jika verifikasi gagal, TWA dapat terbuka sebagai Custom Tab dengan bilah browser.

Rujukan: [verifikasi domain dan sertifikat](https://developer.android.com/training/app-links/configure-assetlinks), [signing TWA](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start#signing-keys).

### 6. Jalankan internal testing pada Android fisik

Unggah AAB ke track internal. Instal dari tautan Play agar memakai paket dan sertifikat distribusi sebenarnya. Uji peluncuran, verifikasi TWA tanpa bilah browser, tombol kembali, mode gelap, pemilihan berkas/scan, OCR, impor/ekspor, simpan/buka cadangan, feedback, dan penggunaan luring setelah cache siap. Pastikan pembaruan tidak menghilangkan proyek tersimpan.

### 7. Selesaikan closed testing jika diwajibkan

Untuk akun personal yang dibuat setelah **13 November 2023**, Google mensyaratkan minimal **12 tester** yang tetap opted-in selama **14 hari berturut-turut** sebelum mengajukan akses produksi. Kumpulkan feedback dan perbaiki masalah; terpenuhinya jumlah/hari bukan persetujuan produksi otomatis. Ikuti persyaratan yang tampil pada akun sendiri.

Rujukan: [persyaratan pengujian akun personal](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

### 8. Ajukan produksi dan rawat rilis

Lengkapi listing serta semua deklarasi, pilih negara/distribusi, unggah AAB final, tulis catatan rilis, dan kirim untuk review. Setelah disetujui, pantau feedback dan laporan masalah. Naikkan `versionCode` untuk setiap upload paket berikutnya. Periksa ulang kebijakan, target SDK, dependensi wrapper, sertifikat, dan Digital Asset Links secara berkala.

## Yang masih harus disiapkan sebelum Play Store

- [ ] URL produksi dan kontrol akar host untuk Digital Asset Links.
- [ ] Akun Play Console terverifikasi dan identitas package final.
- [ ] Halaman kebijakan privasi publik serta materi store listing.
- [ ] Proyek TWA, signing key, AAB, dan target API sesuai kebijakan saat pengiriman.
- [ ] `assetlinks.json` berisi fingerprint distribusi Play yang benar.
- [ ] Pengujian Android fisik, Data safety, dan seluruh deklarasi App content.
- [ ] Closed testing/akses produksi sesuai ketentuan akun, lalu review Google.

Belum ada paket Android yang dibuat atau dikirim ke Play Store dalam perbaikan UI ini.
