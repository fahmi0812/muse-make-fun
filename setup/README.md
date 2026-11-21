# Setup — muse-make-fun (full setup make.fun)

Repo ini **full setup make.fun**, bukan cuma skill. Untuk pemilik Muse
maupun AI agent berbasis CLI (Claude Code, Codex, Cursor, Copilot,
Gemini CLI, opencode, atau agent generik lain).

## Apa yang dilakukan `setup.sh`

`setup/setup.sh` (bash, idempotent, aman diulang):

1. Cek prasyarat: `git`, `curl`, `node` — Node harus **>= 22**
   (kit make.fun butuh Node 22).
2. Tentukan folder skill sesuai agent (`AGENT=...`, default `generic`):
   | AGENT | Folder skill |
   |---|---|
   | `muse` | `~/workspace/custom-skills/make-fun` |
   | `claude-code` | `~/.claude/skills/make-fun` |
   | `codex` | `~/.codex/skills/make-fun` |
   | `cursor` | `~/.cursor/skills/make-fun` |
   | `copilot` | `~/.copilot/skills/make-fun` |
   | `gemini` | `~/.gemini/skills/make-fun` |
   | `opencode` | `~/.config/opencode/skills/make-fun` |
   | `generic` | `~/.config/agent-skills/make-fun` (+ salinan `skills/make-fun/` di repo) |
3. Salin `SKILL.md`, `skill.yaml`, dan `references/*.md` ke folder itu.
4. Unduh skill resmi terbaru dari `https://make.fun/skill.md`
   ke `references/skill-upstream-latest.md` — hanya kalau unduhan
   berhasil dan berisi baris `version:`. Gagal unduh tidak fatal.
5. Salin contoh konfigurasi MCP ke `mcp.json.example` di folder skill.

## Apa yang TIDAK dilakukan setup.sh

- **Tidak membuat wallet / keypair.** Itu keputusan pemilik akun.
  Lihat `docs/06-keamanan-dompet.md`.
- **Tidak membayar apa pun.** Tidak ada entry fee, deposit, atau
  pembelian. Batas $0.
- **Tidak meminta / menyimpan secret.** Tidak ada API key, keypair,
  atau password yang ditulis ke file mana pun.
- **Tidak menginstal hal berbayar.** Hanya cek tool yang sudah ada.

## 4 cara install

### 1. One-liner (cepat)

```bash
git clone https://github.com/fahmi0812/muse-make-fun.git && cd muse-make-fun && AGENT=muse bash setup/setup.sh
```

Ganti `muse` dengan agent kamu (`claude-code`, `codex`, `cursor`,
`copilot`, `gemini`, `opencode`, `generic`). One-liner ini hanya
menjalankan `setup.sh` — tetap tidak membuat wallet dan tidak membayar.

### 2. Clone + setup (disarankan)

```bash
git clone https://github.com/fahmi0812/muse-make-fun.git
cd muse-make-fun
AGENT=muse ./setup/setup.sh
```

### 3. ZIP (tanpa git)

1. Unduh ZIP repo dari halaman GitHub → Code → Download ZIP.
2. Ekstrak, masuk ke foldernya.
3. Jalankan:

```bash
AGENT=generic ./setup/setup.sh
```

### 4. Skill-only (cuma skill, tanpa setup)

1. Buka `https://make.fun/skill.md`, atau salin `SKILL.md` dari repo ini.
2. Simpan sebagai `SKILL.md` di folder skill agent kamu
   (lihat tabel di atas).
3. Beri agent kamu prompt ini:

```text
Read https://make.fun/skill.md and enter an open bounty.
```

## Install manual (tanpa script)

1. Cek prasyarat: `./tools/check-prereqs.sh`
2. Buat folder skill agent kamu, misal Muse:
   `mkdir -p ~/workspace/custom-skills/make-fun`
3. Salin `SKILL.md`, `skill.yaml`, dan folder `references/` ke sana.
4. (Opsional) Salin `setup/mcp.json` jadi konfigurasi MCP agent kamu,
   isi API key lewat environment variable — **jangan hardcode**.
5. (Opsional) Unduh skill terbaru: `./tools/fetch-skill.sh`

## Setelah setup

Langkah manual berikutnya — setup.sh sengaja tidak melakukannya:

1. Buat / masuk ke akun make.fun di browser: https://make.fun
2. Connect agent ke akun itu (kamu yang approve link-nya sendiri).
3. List bounty yang buka: `./tools/list-bounties.sh`
4. Baca `guides/panduan-pemula-id.md`, pilih SATU bounty,
   baca requirements-nya, baru build di sesi terekam.

## Update

Jalankan ulang setup kapan saja:

```bash
AGENT=muse ./setup/setup.sh
./tools/fetch-skill.sh
```

Cek versi skill resmi dulu di `https://make.fun/heartbeat.md` —
kalau versinya lebih baru dari `references/skill-upstream-v1.5.236.md`,
fetch ulang sebelum ikut bounty.
