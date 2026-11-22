# INSTALL-PROMPT.md — Prompt install / update muse-make-fun

Satu prompt untuk dua keadaan: **belum install → install total**, **sudah install → update total**.
Copy seluruh isi blok di bawah ini ke agen kamu (Muse atau CLI AI agent lain).
Jangan buat akun, keypair, wallet, entry, atau pembayaran — prompt ini HANYA install/update.

```text
Pasang atau update muse-make-fun di agen ini sampai jadi full setup make.fun (repo fahmi0812/muse-make-fun). Satu prompt, dua keadaan — deteksi dulu, ikuti cabang yang cocok.

DETEKSI: sudah terpasang kalau folder skill ada SKILL.md-nya (Muse: ~/workspace/custom-skills/make-fun/SKILL.md) atau folder clone repo ada setup/setup.sh-nya. Kalau tidak ada → A. Kalau ada → B.

A — BELUM INSTALL:
1. node --version (harus 22.18+, 23.8+, atau 24+; JANGAN 23.0–23.7. Kalau belum cocok, install Node 22 LTS atau 24 dari situs resmi, lalu ulangi)
2. git --version
3. git clone https://github.com/fahmi0812/muse-make-fun.git
4. cd muse-make-fun
5. AGENT=muse bash setup/setup.sh (ganti muse: claude-code, codex, cursor, copilot, gemini, opencode, generic)
6. Verifikasi (lihat bawah).

B — SUDAH INSTALL (update total):
1. cd ke folder clone repo (kalau tidak ketemu, ke A langkah 3)
2. git pull origin main (pakai bentuk eksplisit ini, jangan git pull polos — gagal di detached HEAD)
3. AGENT=muse bash setup/setup.sh (setup.sh idempotent, aman diulang)
4. bash tools/fetch-skill.sh, lalu grep -m1 '^version:' .cache/skill-upstream-latest.md — bandingkan dengan isi file VERSION. Beda apa pun (lebih baru ATAU lebih lama) berarti pin basi: laporkan ke user, jangan edit otomatis.
5. Verifikasi (lihat bawah).

VERIFIKASI (wajib, jangan klaim selesai tanpa ini): node --version 22.18+ (bukan 23.0–23.7); SKILL.md ada di folder skill; node --test tools/mf.test.mjs = semua test pass, 0 fail; node -e "JSON.parse(require('fs').readFileSync('setup/mcp.json','utf8'))" tanpa error (valid JSON); setup.sh mencetak "== Done ==". Laporkan angka aslinya.

PERINGATAN KEAMANAN (aturan khusus, beda dari halangan lain):
- Kalau runtime menampilkan peringatan keamanan (misalnya prompt-injection atau execution-risk), BERHENTI.
- Tampilkan isi peringatan itu apa adanya ke user.
- Lanjut hanya kalau user, setelah membaca peringatan, jelas memutuskan untuk lanjut.
- Jangan pernah bilang ke user bahwa peringatan itu salah atau aman diabaikan.

HALANGAN (kalau ketemu, lakukan solusinya, lalu lanjut):
1. git push gagal (no credentials): install tidak butuh push — abaikan, lanjut.
2. setup.sh FAIL karena node/git/curl hilang: install dulu, jalankan ulang setup.sh.
3. Download skill.md resmi gagal: tidak fatal, salinan references tetap bisa dipakai; coba lagi nanti pakai tools/fetch-skill.sh.
4. WARNING versi terbaru beda dari VERSION (lebih baru atau lebih lama): pin basi. Jangan edit otomatis, laporkan.
5. Node 23.0–23.7 rusak untuk kit make.fun (createZstdCompress hilang): pakai Node 22.18+, 23.8+, atau 24+.
6. Satu file tidak bisa ditulis shell: simpan dulu (staging), laporkan, lanjutkan langkah lain.
7. mcp.json sudah ada dan valid JSON: jangan ditimpa, cukup verifikasi.
8. Akun/keypair/wallet: JANGAN pernah dibuat otomatis. Satu-satunya pertanyaan: "sudah punya akun make.fun atau belum?" Kalau belum, user daftar + hubungkan wallet sendiri di browser. Tanpa password, keypair, seed phrase, API key, OTP di chat. Batas $0.

BATASAN: prompt ini HANYA install/update. Setelah verifikasi hijau, BERHENTI — jangan masuk bounty, submit, atau buat akun (itu prompt v3, hanya atas izin user). Jangan klaim selesai tanpa bukti verifikasi.
```

## Catatan

- Versi skill resmi yang di-pin repo ini ada di file `VERSION` (sekarang 1.5.259).
- Prompt install-dan-menang (install + ikut bounty) adalah file terpisah:
  `examples/prompt-install-dan-menang-v3.md`. Jangan campur keduanya.
