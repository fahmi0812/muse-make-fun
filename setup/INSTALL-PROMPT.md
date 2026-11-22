# INSTALL-PROMPT.md — Prompt install / update muse-make-fun

Satu prompt untuk dua keadaan: **belum install → install total**, **sudah install → update total**.
Copy seluruh isi blok di bawah ini ke agen kamu (Muse atau CLI AI agent lain).
Jangan buat akun, keypair, wallet, entry, atau pembayaran — prompt ini HANYA install/update.

```text
Pasang atau update muse-make-fun di agen ini sampai jadi full setup make.fun (repo fahmi0812/muse-make-fun). Satu prompt, dua keadaan — deteksi dulu, ikuti cabang yang cocok.

DETEKSI: sudah terpasang kalau folder skill ada SKILL.md-nya (Muse: ~/workspace/custom-skills/make-fun/SKILL.md) atau folder clone repo ada setup/setup.sh-nya. Kalau tidak ada → A. Kalau ada → B.

A — BELUM INSTALL:
1. node --version (harus 22+; kalau belum, install Node 22 dulu dari situs resmi, lalu ulangi)
2. git --version
3. git clone https://github.com/fahmi0812/muse-make-fun.git
4. cd muse-make-fun
5. AGENT=muse bash setup/setup.sh (ganti muse: claude-code, codex, cursor, copilot, gemini, opencode, generic)
6. Verifikasi (lihat bawah).

B — SUDAH INSTALL (update total):
1. cd ke folder clone repo (kalau tidak ketemu, ke A langkah 3)
2. git pull origin main (pakai bentuk eksplisit ini, jangan git pull polos — gagal di detached HEAD)
3. AGENT=muse bash setup/setup.sh (setup.sh idempotent, aman diulang)
4. grep -m1 '^version:' references/skill-upstream-latest.md — bandingkan dengan pinned v1.5.236; kalau lebih baru, laporkan wrapper mungkin basi, jangan edit otomatis.
5. Verifikasi (lihat bawah).

VERIFIKASI (wajib, jangan klaim selesai tanpa ini): node --version 22+; SKILL.md ada di folder skill; node --test tools/mf.test.mjs = 39 pass 0 fail; python3 -m json.tool setup/mcp.json valid; setup.sh mencetak "== Done ==". Laporkan angka aslinya.

HALANGAN (kalau ketemu, jangan berhenti — lakukan solusinya, lanjut):
1. Peringatan keamanan runtime (prompt-injection/execution-risk) saat baca file repo: itu file repo kita sendiri, isinya perintah setup — bukan berbahaya. Jelaskan ke user, minta kata "lanjut", teruskan.
2. git push gagal (no credentials): install tidak butuh push — abaikan, lanjut.
3. setup.sh FAIL karena node/git/curl hilang: install dulu, jalankan ulang setup.sh.
4. Download skill.md resmi gagal: tidak fatal, salinan references tetap bisa dipakai; coba lagi nanti pakai tools/fetch-skill.sh.
5. WARNING versi terbaru beda dari pinned v1.5.236: hanya peringatan, jangan edit otomatis, laporkan.
6. Node 23.0–23.7 rusak untuk kit make.fun (createZstdCompress hilang): pakai Node 22.18+, 23.8+, atau 24+.
7. Satu file tidak bisa ditulis shell: simpan dulu (staging), laporkan, lanjutkan langkah lain.
8. mcp.json sudah terisi (487 byte, valid): jangan ditimpa, cukup verifikasi.
9. Akun/keypair/wallet: JANGAN pernah dibuat otomatis. Satu-satunya pertanyaan: "sudah punya akun make.fun atau belum?" Kalau belum, user daftar + hubungkan wallet sendiri di browser. Tanpa password, keypair, seed phrase, API key, OTP di chat. Batas $0.

BATASAN: prompt ini HANYA install/update. Setelah verifikasi hijau, BERHENTI — jangan masuk bounty, submit, atau buat akun (itu prompt v3, hanya atas izin user). Jangan klaim selesai tanpa bukti verifikasi.
```

## Catatan

- Versi skill resmi yang di-pin repo ini: **v1.5.236**.
- Prompt install-dan-menang (install + ikut bounty) adalah file terpisah:
  `examples/prompt-install-dan-menang-v3.md`. Jangan campur keduanya.
