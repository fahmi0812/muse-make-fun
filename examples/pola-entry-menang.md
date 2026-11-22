# Pola entry menang — yang dipelajari, bukan yang dicopy

> Aturan: pelajari polanya, jangan copy kodenya. Copy file-for-file
> entry akun lain ditolak make.fun. Semua entry di bawah ini repo
> publik yang terverifikasi 21 Nov 2026. Link saja, tidak ada kode
> mereka di sini.

## 1. Emberfall — game arena-survival ($1.000)

- Repo: https://github.com/Alanzcrew/emberfall
- Bounty: "Make the best game", $1.000 USDC.
- Yang bikin kuat:
  - **Headless autopilot + simulasi.** Ada `simulate.mjs` (cek headless)
    dan `race.mjs` (adu v2 vs v3). Hasilnya terukur: v3 menang 6/6 seed
    dengan driver klasik dan 6/6 dengan smart picker.
  - **Scope kecil tapi dalam.** 2D canvas murni, tanpa library,
    tanpa network. 10 musuh, bukan 100 fitur setengah jadi.
  - **Iterasi berbasis data.** v2 → v3 bukan tebak-tebakan, tapi hasil
    race yang sama, seed yang sama.
- Pola yang dicopy:
  - Buat harness tes yang bisa jalan tanpa browser/GUI.
  - Ukur sebelum dan sesudah perubahan, seed tetap.
  - Kecilkan scope sampai selesai, lalu poles.

## 2. Free model aggregator — server API ($500)

- Repo: https://github.com/masboyganteng/makefun-free-model-aggregator
- Bounty: "The best free AI model aggregator", $500 USDC.
- Yang bikin kuat:
  - **Satu server, dua API.** Melayani OpenAI Chat Completions dan
    Anthropic Messages API di atas 10 provider — satu entrypoint jelas.
  - **Bisa dicoba cepat.** `node main.ts --list` cetak katalog dan
    keluar 0; `node main.ts` jalankan server.
  - **Baca brief dengan teliti.** Server baca file brief
    (`MAKEFUN_PROMPT_FILE`): 10 provider, tabel kualitas, manifest
    workload 20 request.
- Pola yang dicopy:
  - Ikuti format input/output di brief persis, jangan tambah format sendiri.
  - Sediakan perintah `--list` / `--help` yang langsung membuktikan
    program jalan.
  - Struktur file jelas: `main.ts` + `lib/providers.ts`.

## 3. Polymarket NVIDIA CEO forecast — forecasting ($250)

- Repo: https://github.com/lacerta15/makefun-polymarket-nvidia-ceo-forecast-01
- Bounty: forecast Polymarket "Next CEO of NVIDIA", $250 USDC.
- Yang bikin kuat:
  - **Output persis seperti diminta.** `main.py` baca tiap file `*.in`
    di `$MAKEFUN_INPUT_DIR`, tulis `<case>.out` di
    `$MAKEFUN_OUTPUT_DIR`, tiap file berisi 5 kuantil
    (0.05 / 0.25 / 0.5 / 0.75 / 0.95) untuk tiap market, tiap menit,
    240 menit ke depan.
  - **Ada fixture.** Folder `fixtures/input` supaya orang lain bisa
    coba tanpa data rahasia.
  - **Model sederhana tapi beralasan.** Logit-space, volatilitas
    sub-diffusive — ditulis di README, bukan black box.
- Pola yang dicopy:
  - Patuhi nama env var, folder input/output, dan format file persis.
  - Sediakan fixture + contoh perintah jalan.
  - Jelaskan model di README dalam 1 paragraf.

## 4. Jailbreak-the-vault — scripted agent, tanpa model call

- Repo: https://github.com/WhoIsTyfur/makefun-jailbreak-vault
- Bounty: `jailbreak-the-vault-01`.
- Yang bikin kuat:
  - **Tanpa model call.** Agen scripted, 3 level ladder runner.
    Tidak bergantung pada model mahal / tidak stabil.
  - **Deterministik.** Hasilnya bisa diulang, mudah di-grade.
- Pola yang dicopy:
  - Kalau tugasnya bisa diselesaikan dengan aturan jelas, jangan
    pakai model. Script deterministik lebih murah dan lebih stabil.
  - Pecah jadi level / tahap yang masing-masing bisa dites sendiri.

## 5. Tiny chess bot — engine catur 4 KB Python

- Repo: https://github.com/ZhenyuYangK/tiny-chess-bot
- Bounty: "Build the strongest chess engine in 4 KB of Python".
- Yang bikin kuat:
  - **Batas ukuran dipatuhi.** 4 KB — bukan "sekitar 4 KB".
  - **Teknik klasik yang terbukti.** Bitboard move generation,
    alpha-beta search (lihat juga entry sejenis
    `starbumb/tiny-chess`).
- Pola yang dicopy:
  - Baca batas (ukuran, waktu, memori) sebagai spesifikasi keras.
  - Pakai algoritma klasik yang sudah terbukti, jangan wynn baru
    di tengah bounty.

## Pola umum dari semua pemenang

1. **Baca requirements seperti kontrak.** Prerequisites, deliverables,
   format file, env var, deadline — semua dicek dulu.
2. **`grade-local` terus.** Jangan submit buta. Grader lokal adalah
   preview gratis ranking kamu.
3. **Scope kecil, selesai, terukur.** Satu hal yang jalan penuh
   mengalahkan 10 fitur setengah jadi.
4. **Tes yang bisa diulang.** Headless / fixture / seed tetap.
5. **README yang jujur.** Apa yang dibuat, cara jalanin, cara tes.
6. **Submit awal, perbaiki, submit lagi.** Seri dimenangkan entry
   yang lebih dulu. Maks 40 entry per bounty.
