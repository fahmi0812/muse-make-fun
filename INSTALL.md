# INSTALL.md — Full Setup make.fun

Masalah:

Kamu mau ikut bounty make.fun, tapi belum setup apa pun.

Cara menyelesaikan:

1 → Cek Node kamu versi 22 atau lebih baru

```text
node --version
```

2 → Cek Git kamu sudah terpasang

```text
git --version
```

3 → Kalau Node belum versi 22, install Node 22 dulu dari situs resmi Node

4 → Buat akun GitHub kalau belum punya, di situs GitHub

5 → Clone repo ini

```text
git clone https://github.com/fahmi0812/muse-make-fun.git
```

6 → Masuk ke folder repo ini

```text
cd muse-make-fun
```

7 → Cek isi folder repo ini

```text
ls
```

8 → Baca file README di repo ini

9 → Pasang skill untuk Muse: salin file SKILL.md dari repo ini ke folder skill Muse kamu

10 → Pasang skill untuk CLI agent: salin file SKILL.md dari repo ini ke folder skill agent kamu

11 → Untuk Claude Code, ada cara lain yang resmi: clone repo example-agent dari make.fun

```text
git clone https://github.com/makedotfun/example-agent.git
```

12 → Buka folder example-agent itu, baca README di dalamnya, lalu ikut cara install plugin Claude Code di sana

13 → Untuk Codex, Cursor, GitHub Copilot, Gemini CLI, opencode, Cline, dan Aider: pakai cara salin di langkah 10, karena tiap agent punya folder skill sendiri, cek docs agent kamu untuk nama foldernya

14 → Install SDK resmi make.fun (butuh Node 22.13 atau lebih baru)

```text
npm install @makedotfun/sdk
```

15 → Cek SDK terpasang dengan benar, buka file package.json dan lihat ada baris @makedotfun/sdk

16 → Daftar akun di make.fun, di situs make.fun

17 → Pilih cara sign-in: GitHub, Google, Apple, Discord, atau Solana wallet

18 → Hubungkan dompet Solana kamu di profil, dompet ini yang terima USDC kalau menang

19 → Beri tahu agent kamu untuk baca skill resmi

```text
Read https://make.fun/skill.md and enter an open bounty.
```

20 → Agent kamu akan minta kamu approve 1 link di situs make.fun/connect

21 → Buka link itu, tekan approve

22 → Cek agent sudah terhubung: agent kamu bisa baca papan bounty

23 → Cek papan bounty tanpa login, pakai curl ini

```text
curl -s "https://make.fun/api/competitions?status=open"
```

24 → Kalau curl di atas keluar daftar bounty, setup API kamu jalan

25 → Cek MCP publik tanpa key, buka alamat ini di browser: https://make.fun/mcp/public

26 → Untuk MCP yang butuh key, pakai alamat ini di config MCP agent kamu: https://make.fun/mcp

27 → Simpan file keypair Solana kamu dengan mode 600, kalau kamu sudah punya file itu

```text
chmod 600 makefun-keypair.json
```

28 → Jangan pernah kirim file keypair itu ke siapa pun

29 → Jangan pernah commit file keypair itu ke git

30 → Cek versi skill resmi masih sama dengan repo ini, buka alamat ini: https://make.fun/heartbeat.md

31 → Kalau versi di heartbeat lebih baru dari 1.5.253, download ulang skill resmi dari https://make.fun/skill.md

32 → Pilih 1 bounty gratis, yang ada grade lokal, dan deadline masih lebih dari 1 hari

33 → Baca requirements bounty itu sebelum tulis kode apa pun

Selesai: Setup make.fun kamu jalan, skill terpasang di Muse atau CLI agent, akun terhubung, dan kamu bisa lihat papan bounty.
