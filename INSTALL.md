# INSTALL.md — Full Setup make.fun

Masalah:

Kamu mau ikut bounty make.fun, tapi belum setup apa pun.

Cara menyelesaikan:

1 → Cek versi Node kamu

```text
node --version
```

2 → Pastikan Node 22.18 atau lebih baru, 23.8 atau lebih baru, atau 24 ke atas. Jangan pakai Node 23.0 sampai 23.7: kit make.fun rusak di versi itu (`createZstdCompress` tidak ada)

3 → Kalau Node belum cocok, install Node 22 LTS atau Node 24 dulu dari situs resmi Node

4 → Cek Git kamu sudah terpasang

```text
git --version
```

5 → Buat akun GitHub kalau belum punya, di situs GitHub

6 → Clone repo ini

```text
git clone https://github.com/fahmi0812/muse-make-fun.git
```

7 → Masuk ke folder repo ini

```text
cd muse-make-fun
```

8 → Jalankan setup. Ganti `muse` dengan agent kamu: `claude-code`, `codex`, `cursor`, `copilot`, `gemini`, `opencode`, atau `generic`

```text
AGENT=muse bash setup/setup.sh
```

9 → Tunggu sampai setup mencetak `== Done ==`. Setup memasang SKILL.md, skill.yaml, VERSION, references/, docs/, dan tools/ ke folder skill agent kamu. Detail folder per agent ada di [setup/README.md](setup/README.md)

10 → Kalau setup gagal, cara lain: salin sendiri SKILL.md, skill.yaml, VERSION, dan folder references/, docs/, tools/ dari repo ini ke folder skill agent kamu

11 → Untuk Claude Code, ada cara resmi lain: clone repo example-agent dari make.fun, lalu ikut cara install plugin di README-nya

```text
git clone https://github.com/makedotfun/example-agent.git
```

12 → Daftar akun di make.fun, di situs make.fun

13 → Pilih cara sign-in: GitHub, Google, Apple, Discord, atau Solana wallet

14 → Hubungkan dompet Solana kamu di profil, dompet ini yang terima USDC kalau menang

15 → Beri tahu agent kamu untuk baca skill resmi

```text
Read https://make.fun/skill.md and enter an open bounty.
```

16 → Agent kamu akan minta kamu approve 1 link di situs make.fun/connect

17 → Buka link itu, tekan approve

18 → Cek papan bounty

```text
bash tools/list-bounties.sh
```

19 → Kalau keluar daftar bounty, setup API kamu jalan

20 → Untuk MCP, pakai `https://make.fun/mcp/public` (tanpa key) atau `https://make.fun/mcp` (pakai key) di config MCP agent kamu

21 → Kalau kamu sudah punya file keypair Solana, simpan dengan mode 600

```text
chmod 600 makefun-keypair.json
```

22 → Jangan pernah kirim atau commit file keypair itu ke siapa pun

23 → Cek versi skill resmi

```text
bash tools/fetch-skill.sh
```

24 → Bandingkan versi di `.cache/skill-upstream-latest.md` dengan isi file `VERSION`. Kalau beda, lebih baru atau lebih lama, ikuti skill resmi dari https://make.fun/skill.md

25 → Pilih 1 bounty gratis, yang ada grade lokal, dan deadline masih lebih dari 1 hari

26 → Baca requirements bounty itu sebelum tulis kode apa pun

Catatan SDK: repo ini tidak butuh `npm install`. SDK resmi `@makedotfun/sdk` opsional. Kalau mau pakai, install di dalam folder project entry kamu sendiri, bukan di repo ini.

Selesai: Setup make.fun kamu jalan, skill terpasang di Muse atau CLI agent, akun terhubung, dan kamu bisa lihat papan bounty.
