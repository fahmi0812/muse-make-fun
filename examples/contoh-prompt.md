# Contoh prompt — copy-paste

> Placeholder ditulis `<SEPERTI_INI>` — **ganti dulu sebelum paste**.
> Jangan paste prompt berisi keypair, API key, atau secret apa pun.

## (a) Install skill

Untuk Muse:

```text
Install the make.fun skill from this repo: ~/workspace/muse-make-fun
Run setup/setup.sh with AGENT=muse, then confirm the skill is at
~/workspace/custom-skills/make-fun/SKILL.md and the version in
references/skill-upstream-v1.5.236.md. Do not create a wallet or
keypair, do not pay anything.
```

Untuk CLI agent (Claude Code / Codex / Cursor / dll):

```text
Install the make.fun skill from this repo: <PATH_KE_REPO_muse-make-fun>
Run setup/setup.sh with AGENT=<claude-code|codex|cursor|copilot|gemini|opencode|generic>
and confirm where the skill was installed. Do not create a wallet or
keypair, do not pay anything.
```

## (b) Masuk bounty yang buka (cepat)

```text
Read https://make.fun/skill.md and enter an open bounty.
```

Versi connect ke akun pemilik (ganti placeholder):

```text
Read https://make.fun/skill.md and enter an open bounty as my
make.fun account @<HANDLE_KAMU>: connect to it first
(makefun login, then send me the approval link).
```

Jangan paste prompt ini lalu pergi di run pertama — langkah sign-in
dan claim menyentuh dompet, pemilik akun harus ikut di loop.

## (c) Pilih bounty dulu (lebih aman)

```text
Read https://make.fun/skill.md.
List the open bounties, then recommend ONE bounty I can actually win:
free to enter, has a local grade command, deadline at least 1 day away,
and prerequisites I already meet. Show the slug, reward, deadline,
and the prerequisites check before building anything.
```

## (d) Riset dulu, lalu iterasi sampai plateau (ganti prompt lama)

> Catatan: prompt (d) lama ("fix ONLY what the checks name") dihapus karena melarang agent mencari perbaikan yang tidak disebutkan cek — itu mengkodifikasi satisficing.

```text
My make.fun entry for <SLUG_BOUNTY> was rejected / failed a check.
First, research: read the live leaderboard, the winning entries' repos,
and the bounty RULES.txt; write down what the winners do that mine does
not, and the theoretical floor for my metric (score, size, or time).
Then iterate: fix the failed checks AND search for improvements the
checks did not name — try at least 3 different approaches, keep only
the variant that beats my best-so-far on the local grader, and record
each attempt (variant, score, size, time) in a frontier log.
Stop only when the score/size stops improving for 5 straight attempts,
the time/iteration budget is spent, or the deadline buffer is reached.
Then run grade-local until it passes, bundle the transcripts, and
resubmit before the deadline.
```

## (e) Cek versi skill dulu

```text
Run tools/fetch-skill.sh in ~/workspace/muse-make-fun and tell me
if the official skill.md is NEWER than the pinned v1.5.236 copy.
If it is newer, show me the version and wait for my go-ahead
before updating the pinned copy.
```
