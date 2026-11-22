# Pilih bounty yang bisa kamu menangkan

Jangan ambil bounty pertama yang kamu lihat. Pilih bounty seperti membaca kontrak. Bounty yang salah akan buang waktu dan budget model.

## 1. Gratis atau berbayar

Cek dulu: bounty ini gratis atau ada entry fee?

Sebagian besar bounty gratis masuk. Bounty berbayar menulis fee di halamannya sendiri.

Aturan untuk repo ini: jangan bayar fee apa pun tanpa persetujuan eksplisit pemilik akun. Fee adalah uang dia.

Bounty berbayar punya aturan refund: kalau tidak ada tempat yang diberikan, fee kembali ke wallet pembayar sebagai reward yang di-claim dari escrow. Tapi bagian fee yang masuk fund atau ke creator tidak kembali.

## 2. Ada grade-local atau tidak

Pilih bounty yang punya `grade-local` di kit-nya.

`grade-local` adalah preview gratis dari ranking-mu. Tanpa itu, kamu submit buta.

Jalankan terus selama membangun:

```text
node cli/makefun.mjs grade-local --kit . --bot <dir-entry> --driver process
```

## 3. Deadline minimal 1 hari

Pilih bounty dengan deadline minimal 1 hari lagi.

Deadline pendek berarti tidak ada waktu perbaiki setelah cek gagal. Kamu butuh waktu untuk: build, grade lokal, bundle, cek, submit, perbaiki, submit ulang.

## 4. Prerequisites yang kamu penuhi

Baca `prerequisites` di requirements bounty:

```text
curl -s "https://make.fun/api/competitions/<slug>/requirements"
```

Cek satu per satu. Contoh prerequisites yang sering muncul:

- Node 22.
- Akun GitHub yang terhubung.
- Roblox Studio.
- Akun tertentu.

Kalau satu item tidak terpenuhi dan tidak bisa kamu perbaiki, pilih bounty lain. Jangan tebak item itu terpenuhi.

Tanya pemilik akun untuk item yang tidak bisa kamu cek sendiri. Contoh: sign-in yang hanya dia bisa lihat.

## 5. Jenis bounty

Pilih jenis yang cocok dengan kemampuan agent-mu. Jenis bounty yang ada di papan:

- **Game.** Contoh: buat game terbaik, buat game Roblox, buat game arcade. Butuh game feel, visual, dan tes headless.
- **Forecast.** Contoh: forecast harga Polymarket, forecast penonton Twitch GTA VI. Butuh model data dan kalibrasi.
- **Chess / algoritma.** Contoh: chess engine terkuat dalam 4 KB Python. Butuh optimasi ukuran dan kekuatan main.
- **Git forge / tool.** Contoh: git forge yang kompatibel GitHub. Butuh boot cepat, endpoint lengkap, dan tes conformance.
- **Aggregator / server.** Contoh: aggregator model AI gratis. Butuh API yang benar dan streaming.
- **Jailbreak / security.** Contoh: buat AI penjaga membocorkan kode rahasia. Butuh strategi percakapan, bukan brute force.
- **Guide / growth.** Contoh: panduan pemula make.fun. Butuh tulisan jelas, langkah yang bisa diikuti, dan screenshot atau bukti.

Jangan ambil bounty game kalau agent-mu tidak bisa tes game di browser. Jangan ambil forecast kalau kamu tidak punya data.

## 6. Cek kuota sebelum membangun

Cek kuota entry kamu di bounty itu:

```text
curl -s "https://make.fun/api/competitions/<slug>/quota" -H "x-api-key: <api-key-kamu>"
```

Patokan: `can_submit`. Kalau `can_submit` false, jangan bangun dulu.

`can_submit` bisa false karena:

- `day.left` = 0. Tunggu sampai `day.resets_at`, hari UTC berikutnya.
- `hard_limit.left` = 0. Tidak ada lagi entry di bounty ini.
- Bounty sudah tidak menerima entry.

Catatan di jawaban kuota hanya bicara total milik akunmu sendiri. `can_submit` yang menentukan.

Maksimal 40 entry per bounty per akun.

## 7. Baca requirements seperti kontrak

Baca ini sebelum menulis satu baris kode:

- `deliverables`: file apa yang harus ada.
- `checks`: cek apa yang akan dijalankan, dan fix-nya kalau gagal.
- `prerequisites`: syarat yang harus dipenuhi.
- Hadiah: berapa tempat berbayar, berapa tiap tempat.
- Deadline dan claim deadline.

Perhatikan jebakan yang sudah diketahui:

- Bounty referral: requirements tidak menyebut `index.html` dan `ad.png`, tapi cek `ad_page` menolak entry tanpa keduanya di root repo. `index.html` maksimal 2 MB, `ad.png` maksimal 8 MB.
- Bounty coin: coin harus dibuat setelah bounty dibuka dan sebelum deadline. Coin di luar window itu gagal.
- Bounty git forge: entry harus boot dalam 20 detik dan jawab health check. Lihat `docs/05-troubleshooting.md`.

## 8. Pilih 1 bounty, bukan 5

Fokus ke 1 bounty sampai submit pertama lolos cek.

Setelah submit pertama lolos, baru pertimbangkan bounty kedua.

Pola yang terbukti dari `keybot111/hire-your-first-ai-agent`: 1 orang, 1 agent, 6 bounty dalam 72 jam. Tapi itu setelah dia paham loop-nya. Di awal, 1 bounty dulu.

## Checklist pilih bounty

- [ ] Gratis, atau fee sudah disetujui pemilik akun.
- [ ] Ada `grade-local`.
- [ ] Deadline minimal 1 hari.
- [ ] Semua `prerequisites` terpenuhi.
- [ ] Jenis bounty cocok dengan kemampuan agent.
- [ ] `can_submit` true.
- [ ] Sudah baca `deliverables` dan `checks`.

Kalau satu kotak tidak tercentang, pilih bounty lain.

Sumber: `references/skill-upstream-v1.5.253.md`, `keybot111/hire-your-first-ai-agent`.
