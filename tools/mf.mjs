#!/usr/bin/env node
/**
 * tools/mf.mjs — muse-make-fun unified CLI (Exhaustion Loop v2)
 *
 * ONE Node 22 ESM stdlib-only CLI. No npm install, no Python.
 * Subcommands: research | poll | track | gate | loop
 *
 * Design rules (from solusi-final-terverifikasi, 22 Nov 2026):
 * - size_bytes is NEVER hand-computed: sizeBytes(mainBytes, ownerJson)
 *   = (mainBytes + 7) + (ownerJson ? 76 : 0).
 *   Corrected numbers: 491 B main.ts -> 498 (no owner.json) / 574 (with);
 *   540 B -> 547 / 623. The old "422 B" claim was a double-subtraction bug.
 * - Terminal condition (corrected, non-strict because an exact tie loses
 *   to the earlier receipt):
 *   minimisation: unreachable when best - maxRemainingGain >= cutoff - margin
 *   maximisation: unreachable when best + maxRemainingGain <= cutoff + margin
 * - Plateau is only valid when >= 2 strategy classes both failed to improve.
 * - Token ROI cap: max_token_cost_usd <= 0.15 * prize_target_usd,
 *   except in explicit mode "rd" (research / dogfood).
 * - Gate: strictly-better than best-so-far (a tie is NOT better),
 *   worst-case wall <= 20 s, RSS <= 350 MB, LICENSE byte-identical to
 *   starter (hash compare), secret scan, quota check.
 * - loop only orchestrates state; it NEVER runs LLM calls.
 *
 * Security invariants (never weaken): $0 platform cap, secret fail-closed,
 * data != command, determinism (2x byte-identical), transcript hygiene.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const VERSION = '1.0.0';
export const WALL_MAX_S = 20;
export const RSS_MAX_MB = 350;
export const ROI_CAP_FRACTION = 0.15;
export const LICENSE_PATH_BYTES = 7; // "main.ts" path bytes in size_bytes
export const OWNER_JSON_BYTES = 76; // 57 B file + 19 B path

// ---------------------------------------------------------------------------
// Pure functions (exported for unit tests)
// ---------------------------------------------------------------------------

/** size_bytes = (mainBytes + 7) + (ownerJson ? 76 : 0). Never hand-compute. */
export function sizeBytes(mainBytes, ownerJson) {
  if (!Number.isFinite(mainBytes) || mainBytes < 0) {
    throw new Error('sizeBytes: mainBytes must be a non-negative finite number');
  }
  return (mainBytes + LICENSE_PATH_BYTES) + (ownerJson ? OWNER_JSON_BYTES : 0);
}

/**
 * Strictly-better comparison. Score first (higher is better), then the
 * size tie-break (smaller size_bytes wins, per make.fun rules).
 * An exact tie is NOT better.
 */
export function isBetter(a, b) {
  if (!b) return true;
  if (a.score !== b.score) return a.score > b.score;
  return a.sizeBytes < b.sizeBytes;
}

/**
 * Terminal condition. Returns { status, reason } where status is one of
 * 'target' | 'unreachable' | 'continue'.
 * direction 'min': best is a size (lower is better), cutoff is the size
 *   ceiling to beat. Unreachable when best - maxRemainingGain >= cutoff - margin.
 * direction 'max': best is a score (higher is better), cutoff is the score
 *   floor to beat. Unreachable when best + maxRemainingGain <= cutoff + margin.
 * target: 'min' -> best <= target; 'max' -> best >= target.
 */
export function terminalCondition({ direction = 'min', best, cutoff, margin = 0, maxRemainingGain = 0, target } = {}) {
  if (Number.isFinite(target) && Number.isFinite(best)) {
    if (direction === 'min' && best <= target) {
      return { status: 'target', reason: `target reached: best ${best} <= target ${target}` };
    }
    if (direction === 'max' && best >= target) {
      return { status: 'target', reason: `target reached: best ${best} >= target ${target}` };
    }
  }
  if (Number.isFinite(best) && Number.isFinite(cutoff) && Number.isFinite(maxRemainingGain)) {
    if (direction === 'min' && best - maxRemainingGain >= cutoff - margin) {
      return { status: 'unreachable', reason: `cutoff unreachable (min): best ${best} - maxGain ${maxRemainingGain} = ${best - maxRemainingGain} >= cutoff ${cutoff} - margin ${margin}` };
    }
    if (direction === 'max' && best + maxRemainingGain <= cutoff + margin) {
      return { status: 'unreachable', reason: `cutoff unreachable (max): best ${best} + maxGain ${maxRemainingGain} = ${best + maxRemainingGain} <= cutoff ${cutoff} + margin ${margin}` };
    }
  }
  return { status: 'continue', reason: 'no terminal condition met' };
}

/**
 * Plateau is only valid when the stale counter reached plateauN AND at
 * least 2 distinct strategy classes both failed to improve. This blocks
 * "gaming the plateau" with micro-tweaks inside one class.
 */
export function plateauReached({ stale = 0, plateauN = 5, failedClasses = [] } = {}) {
  const distinct = new Set(failedClasses.filter(Boolean)).size;
  return stale >= plateauN && distinct >= 2;
}

/**
 * Token ROI cap: cost must stay <= 15% of the prize target, except in
 * explicit mode "rd" (research / dogfood), where the cap is exempt.
 * At exactly the cap the run is NOT exceeded (cap is inclusive).
 */
export function roiExceeded({ tokenCostUsd = 0, prizeTargetUsd, mode = 'live' } = {}) {
  if (mode === 'rd') return false;
  if (!Number.isFinite(prizeTargetUsd) || prizeTargetUsd <= 0) return false;
  return tokenCostUsd > ROI_CAP_FRACTION * prizeTargetUsd;
}

/** Cutoff velocity in bytes/hour between two cutoff polls (positive = cutoff falling). */
export function cutoffVelocity(prev, curr) {
  if (!prev || !curr) return null;
  const dtMs = curr.ts - prev.ts;
  if (!Number.isFinite(dtMs) || dtMs <= 0) return null;
  if (!Number.isFinite(prev.cutoff) || !Number.isFinite(curr.cutoff)) return null;
  return (prev.cutoff - curr.cutoff) / (dtMs / 3_600_000);
}

/**
 * Validate a variant metric line against best-so-far.
 * Rejects: missing/non-numeric numbers, identical/cosmetic diffs
 * (same mainBytes + same score as best-so-far, or same codeHash).
 * Returns { ok, reasons[], sizeBytes, variant } — variant is normalised.
 */
export function validateVariant(variant, best) {
  const reasons = [];
  if (!variant || typeof variant !== 'object') return { ok: false, reasons: ['variant must be a JSON object'], sizeBytes: null, variant: null };
  const v = { ...variant };
  if (!Number.isFinite(v.mainBytes) || v.mainBytes < 0) reasons.push('missing or invalid number: mainBytes');
  if (!Number.isFinite(v.score)) reasons.push('missing or invalid number: score');
  if (v.wallS !== undefined && !Number.isFinite(v.wallS)) reasons.push('invalid number: wallS');
  if (v.rssMb !== undefined && !Number.isFinite(v.rssMb)) reasons.push('invalid number: rssMb');
  const ownerJson = v.ownerJson === true;
  let size = null;
  if (reasons.length === 0) {
    size = sizeBytes(v.mainBytes, ownerJson);
    v.ownerJson = ownerJson;
    v.sizeBytes = size;
    if (best) {
      const sameBytesScore = v.mainBytes === best.mainBytes && v.score === best.score;
      const sameHash = typeof v.codeHash === 'string' && v.codeHash && v.codeHash === best.codeHash;
      if (sameBytesScore || sameHash) {
        reasons.push('identical/cosmetic diff rejected: same bytes+score (or same codeHash) as best-so-far, no change');
      }
    }
  }
  return { ok: reasons.length === 0, reasons, sizeBytes: size, variant: reasons.length === 0 ? v : null };
}

// ---------------------------------------------------------------------------
// Paths / frontier store
// ---------------------------------------------------------------------------

export function repoRoot() {
  if (process.env.MF_ROOT) return resolve(process.env.MF_ROOT);
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function frontierPath(root, slug) {
  return join(root, 'frontier', `${slug}.jsonl`);
}

export function researchPath(root, slug) {
  return join(root, 'research', `${slug}.json`);
}

export function readFrontier(root, slug) {
  const p = frontierPath(root, slug);
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '');
  const out = [];
  for (const line of lines) {
    try { out.push(JSON.parse(line)); } catch { /* skip corrupt line */ }
  }
  return out;
}

export function appendFrontier(root, slug, obj) {
  const dir = join(root, 'frontier');
  mkdirSync(dir, { recursive: true });
  appendFileSync(frontierPath(root, slug), JSON.stringify(obj) + '\n', 'utf8');
  return obj;
}

/** Best variant line so far (score first, then smaller sizeBytes). */
export function bestSoFar(lines) {
  let best = null;
  for (const l of lines) {
    if (l.type !== 'variant' || !Number.isFinite(l.score) || !Number.isFinite(l.sizeBytes)) continue;
    if (!best || isBetter(l, best)) best = l;
  }
  return best;
}

export function lastCutoff(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].type === 'cutoff') return lines[i];
  }
  return null;
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// ---------------------------------------------------------------------------
// Secret scan (names only in output — never print a secret itself)
// ---------------------------------------------------------------------------

export const SECRET_PATTERNS = [
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'api-key-assignment', re: /\b(?:x-api-key|api[_-]?key|api[_-]?token)\b\s*[:=]\s*['"][^'"]{8,}['"]/i },
  { name: 'sk-token', re: /\bsk-[A-Za-z0-9]{16,}\b/ },
  { name: 'secret-key-array', re: /\[\s*(?:\d{1,3}\s*,\s*){31}\d{1,3}\s*\]/ },
  { name: 'bearer-token', re: /Bearer\s+[A-Za-z0-9._\-]{20,}/ },
];

const SKIP_DIRS = new Set(['.git', 'node_modules', '.makefun']);
const SKIP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip', '.tar', '.gz', '.wasm', '.pdf']);

function walkFiles(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, out);
    else if (e.isFile() && !SKIP_EXTS.has(extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

/** Scan files for secret-looking patterns. Returns [{file, pattern}] (pattern name only). */
export function scanSecrets(paths) {
  const hits = [];
  const files = [];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, files);
    else if (st.isFile()) files.push(p);
  }
  for (const f of files) {
    let text;
    try {
      const buf = readFileSync(f);
      if (buf.includes(0)) continue; // binary, skip
      text = buf.toString('utf8');
    } catch { continue; }
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(text)) hits.push({ file: f, pattern: name });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// JSON input helper (inline JSON string or @file)
// ---------------------------------------------------------------------------

export function parseJsonArg(arg, label) {
  if (typeof arg !== 'string' || arg.trim() === '') throw new Error(`${label}: empty JSON argument`);
  if (arg.startsWith('@')) {
    const p = resolve(arg.slice(1));
    return JSON.parse(readFileSync(p, 'utf8'));
  }
  return JSON.parse(arg);
}

// ---------------------------------------------------------------------------
// research — Phase-0 research log (time-boxed, best-effort, never stalls)
// ---------------------------------------------------------------------------

const RESEARCH_TEMPLATE = (slug, timeboxMinutes) => ({
  slug,
  createdAt: new Date().toISOString(),
  timeboxMinutes,
  leaderboard: null, // { cutoff, top10: [...], entries, checkedAt } — live numbers only
  winners: [], // up to 3: [{ repo, why, verified: true }]
  theoreticalFloor: null, // string or number: smallest/fastest theoretically possible
  failureModes: [], // per-type failure modes to check in the council phase
  nonCodeTasks: [], // [{ task, owner: "agent"|"user", verify }]
  searchEvidence: [], // [{ query, results }] — 0 results is valid evidence
});

export function validateResearch(log) {
  const missing = [];
  if (!log || typeof log !== 'object') return { ok: false, missing: ['research log must be a JSON object'] };
  if (!log.leaderboard || typeof log.leaderboard !== 'object' || !Number.isFinite(log.leaderboard.cutoff)) {
    missing.push('leaderboard: live cutoff number + checkedAt required (never invent numbers)');
  }
  if (!Array.isArray(log.winners)) missing.push('winners: must be an array (0-3 items)');
  else if (log.winners.length > 3) missing.push('winners: at most 3 verified winner repos / prior art');
  else if (log.winners.length > 0 && log.winners.some((w) => !w || !w.repo || w.verified !== true)) {
    missing.push('winners: each entry needs { repo, why, verified: true }');
  }
  if (log.winners.length === 0 && (!Array.isArray(log.searchEvidence) || log.searchEvidence.length === 0)) {
    missing.push('winners: 0 found is allowed ONLY with searchEvidence recording the queries tried (0-result evidence accepted)');
  }
  if (log.theoreticalFloor === null || log.theoreticalFloor === undefined || log.theoreticalFloor === '') {
    missing.push('theoreticalFloor: smallest/fastest theoretically possible (number or short string)');
  }
  if (!Array.isArray(log.failureModes) || log.failureModes.length === 0) missing.push('failureModes: at least 1 per-type failure mode');
  if (!Array.isArray(log.nonCodeTasks) || log.nonCodeTasks.length === 0) missing.push('nonCodeTasks: at least 1 task with { task, owner, verify }');
  else if (log.nonCodeTasks.some((t) => !t || !t.task || !t.owner || !t.verify)) {
    missing.push('nonCodeTasks: each entry needs { task, owner, verify }');
  }
  if (!Array.isArray(log.searchEvidence)) missing.push('searchEvidence: must be an array (entries may record 0 results)');
  return { ok: missing.length === 0, missing };
}

function cmdResearch(root, argv) {
  const slug = argv[0];
  if (!slug) return fail('usage: mf.mjs research <slug> [--fill <json|@file>] [--evidence <json|@file>] [--timebox <minutes>]');
  let fill = null;
  let evidence = null;
  let timebox = 60;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--fill') fill = parseJsonArg(argv[++i], '--fill');
    else if (argv[i] === '--evidence') evidence = parseJsonArg(argv[++i], '--evidence');
    else if (argv[i] === '--timebox') timebox = Number(argv[++i]);
  }
  const p = researchPath(root, slug);
  let log;
  if (existsSync(p)) {
    log = JSON.parse(readFileSync(p, 'utf8'));
  } else {
    log = RESEARCH_TEMPLATE(slug, Number.isFinite(timebox) ? timebox : 60);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(log, null, 2) + '\n', 'utf8');
    console.log(`created research template: ${p}`);
  }
  if (fill && typeof fill === 'object') {
    for (const [k, v] of Object.entries(fill)) {
      if (k === 'winners' && Array.isArray(v)) log.winners = v.slice(0, 3);
      else if (k === 'searchEvidence' && Array.isArray(v)) log.searchEvidence = [...(log.searchEvidence || []), ...v];
      else log[k] = v;
    }
  }
  if (evidence) {
    const arr = Array.isArray(evidence) ? evidence : [evidence];
    log.searchEvidence = [...(log.searchEvidence || []), ...arr];
  }
  writeFileSync(p, JSON.stringify(log, null, 2) + '\n', 'utf8');
  const v = validateResearch(log);
  if (v.ok) {
    console.log(`research VALID: ${p}`);
    console.log(JSON.stringify({ slug, cutoff: log.leaderboard.cutoff, winners: log.winners.length, failureModes: log.failureModes.length, nonCodeTasks: log.nonCodeTasks.length }, null, 2));
    return 0;
  }
  console.log(`research INVALID: ${p}`);
  for (const m of v.missing) console.log(`  missing: ${m}`);
  console.log('Fill the missing fields (or record 0-result searchEvidence) and re-run. The log never blocks on a search that returns nothing.');
  return 1;
}

// ---------------------------------------------------------------------------
// poll — live leaderboard + cutoff velocity
// ---------------------------------------------------------------------------

function extractLeaderboard(data) {
  if (!data || typeof data !== 'object') return null;
  const candidates = [data.leaderboard, data.entries, data.leaderboardEntries, data.top, data.items];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0 && typeof c[0] === 'object') return c;
  }
  return null;
}

function cutoffFromEntries(entries) {
  // Prefer the 10th place (paid-places boundary is usually 10); fall back to last.
  const idx = Math.min(9, entries.length - 1);
  const e = entries[idx];
  const size = e.sizeBytes ?? e.size_bytes ?? e.size;
  const score = e.score ?? e.points;
  const handle = e.handle ?? e.owner ?? e.agent ?? null;
  const top1 = entries[0];
  return {
    cutoff: Number.isFinite(size) ? size : (Number.isFinite(score) ? score : null),
    cutoffMetric: Number.isFinite(size) ? 'sizeBytes' : 'score',
    entries: entries.length,
    rank10Handle: handle,
    top1Handle: top1 ? (top1.handle ?? top1.owner ?? top1.agent ?? null) : null,
    top1Value: top1 ? (top1.sizeBytes ?? top1.size_bytes ?? top1.size ?? top1.score ?? top1.points ?? null) : null,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

async function cmdPoll(root, argv) {
  const slug = argv[0];
  if (!slug) return fail('usage: mf.mjs poll <slug>');
  const base = `https://make.fun/api/competitions/${encodeURIComponent(slug)}`;
  let entries = null;
  let source = null;
  let lastErr = null;
  for (const url of [base, `${base}/leaderboard`]) {
    try {
      const data = await fetchJson(url);
      entries = extractLeaderboard(data);
      if (entries) { source = url; break; }
      lastErr = new Error(`no leaderboard array exposed at ${url}`);
    } catch (e) { lastErr = e; }
  }
  if (!entries) {
    console.error(`poll FAILED for ${slug}: ${lastErr ? lastErr.message : 'leaderboard not exposed by the API'}`);
    console.error('No numbers were recorded. Do not invent leaderboard figures — re-run poll when the API is reachable.');
    return 1;
  }
  const cut = cutoffFromEntries(entries);
  if (cut.cutoff === null) {
    console.error(`poll FAILED for ${slug}: leaderboard entries expose neither size nor score at ${source}`);
    return 1;
  }
  const lines = readFrontier(root, slug);
  const prev = lastCutoff(lines);
  const now = Date.now();
  const velocity = cutoffVelocity(prev ? { cutoff: prev.cutoff, ts: prev.ts } : null, { cutoff: cut.cutoff, ts: now });
  const line = {
    type: 'cutoff',
    ts: now,
    iso: new Date(now).toISOString(),
    slug,
    source,
    cutoff: cut.cutoff,
    cutoffMetric: cut.cutoffMetric,
    entries: cut.entries,
    rank10Handle: cut.rank10Handle,
    top1Handle: cut.top1Handle,
    top1Value: cut.top1Value,
    velocity_b_per_hour: velocity,
  };
  appendFrontier(root, slug, line);
  console.log(JSON.stringify(line, null, 2));
  return 0;
}

// ---------------------------------------------------------------------------
// track — record a variant metric line (size_bytes computed, never trusted)
// ---------------------------------------------------------------------------

function cmdTrack(root, argv) {
  const slug = argv[0];
  const raw = argv[1];
  if (!slug || !raw) return fail('usage: mf.mjs track <slug> <variant-json|@file>');
  let variant;
  try { variant = parseJsonArg(raw, 'variant'); } catch (e) { return fail(`track: invalid variant JSON: ${e.message}`); }
  const lines = readFrontier(root, slug);
  const best = bestSoFar(lines);
  const v = validateVariant(variant, best);
  if (!v.ok) {
    console.error('track REJECTED:');
    for (const r of v.reasons) console.error(`  - ${r}`);
    return 1;
  }
  const iter = lines.filter((l) => l.type === 'variant').length + 1;
  const line = {
    type: 'variant',
    ts: Date.now(),
    iso: new Date().toISOString(),
    slug,
    iter,
    variant: v.variant.variant ?? v.variant.name ?? `iter-${iter}`,
    strategyClass: v.variant.strategyClass ?? null,
    score: v.variant.score,
    mainBytes: v.variant.mainBytes,
    ownerJson: v.variant.ownerJson,
    sizeBytes: v.sizeBytes,
    wallS: v.variant.wallS ?? null,
    rssMb: v.variant.rssMb ?? null,
    codeHash: v.variant.codeHash ?? null,
    note: v.variant.note ?? null,
  };
  appendFrontier(root, slug, line);
  const isNewBest = isBetter(line, best);
  console.log(JSON.stringify({ ...line, newBest: isNewBest }, null, 2));
  return 0;
}

// ---------------------------------------------------------------------------
// gate — deterministic pre-submit gate
// ---------------------------------------------------------------------------

function cmdGate(root, argv) {
  const slug = argv[0];
  const raw = argv[1];
  if (!slug || !raw) return fail('usage: mf.mjs gate <slug> <variant-json|@file> [--starter <path>] [--quota <path>]');
  let starter = null;
  let quotaPath = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--starter') starter = argv[++i];
    else if (argv[i] === '--quota') quotaPath = argv[++i];
  }
  let variant;
  try { variant = parseJsonArg(raw, 'variant'); } catch (e) { return fail(`gate: invalid variant JSON: ${e.message}`); }
  const reasons = [];
  const warnings = [];
  const lines = readFrontier(root, slug);
  const best = bestSoFar(lines);

  // 1. strictly better than best-so-far (score first, then size tie-break; tie is NOT better)
  if (best) {
    const size = Number.isFinite(variant.mainBytes) ? sizeBytes(variant.mainBytes, variant.ownerJson === true) : null;
    const cand = { score: variant.score, sizeBytes: size };
    if (!isBetter(cand, best)) {
      reasons.push(`not strictly better than best-so-far (best: score ${best.score}, sizeBytes ${best.sizeBytes}; candidate: score ${cand.score}, sizeBytes ${cand.sizeBytes}) — a tie is NOT better`);
    }
  } else {
    warnings.push('no best-so-far recorded yet; strictly-better check skipped (first variant)');
  }

  // 2. worst-case wall <= 20 s
  if (!Number.isFinite(variant.wallS)) reasons.push('missing number: wallS (worst-case wall time required)');
  else if (variant.wallS > WALL_MAX_S) reasons.push(`wall ${variant.wallS}s exceeds max ${WALL_MAX_S}s (3x headroom vs the 60s server budget)`);
  // 3. RSS <= 350 MB
  if (!Number.isFinite(variant.rssMb)) reasons.push('missing number: rssMb (worst-case RSS required)');
  else if (variant.rssMb > RSS_MAX_MB) reasons.push(`RSS ${variant.rssMb}MB exceeds max ${RSS_MAX_MB}MB`);

  // 4. LICENSE byte-identical to starter (hash compare when a starter path is given)
  const licensePath = variant.licensePath || (variant.entryDir ? join(variant.entryDir, 'LICENSE') : null);
  const starterPath = variant.starterLicensePath || starter;
  if (licensePath && starterPath) {
    if (!existsSync(licensePath)) reasons.push(`LICENSE not found at ${licensePath}`);
    else if (!existsSync(starterPath)) reasons.push(`starter LICENSE not found at ${starterPath}`);
    else if (sha256File(licensePath) !== sha256File(starterPath)) reasons.push('LICENSE is not byte-identical to the starter LICENSE (hash mismatch)');
  } else {
    warnings.push('LICENSE check skipped: no starter path given (pass --starter <path> to enable hash compare)');
  }

  // 5. secret scan over the entry files
  const scanTargets = [];
  if (variant.entryDir) scanTargets.push(variant.entryDir);
  if (Array.isArray(variant.files)) scanTargets.push(...variant.files);
  if (scanTargets.length > 0) {
    const hits = scanSecrets(scanTargets);
    for (const h of hits) reasons.push(`secret scan hit: pattern "${h.pattern}" in ${h.file} (secret value never printed)`);
  } else {
    warnings.push('secret scan skipped: no entryDir/files given in the variant');
  }

  // 6. quota check (read quota JSON if present, else warn)
  const qPath = variant.quotaPath || quotaPath || join(root, 'frontier', `${slug}-quota.json`);
  if (existsSync(qPath)) {
    try {
      const q = JSON.parse(readFileSync(qPath, 'utf8'));
      const remaining = q.remaining ?? q.quota?.remaining ?? q.entriesRemaining;
      if (!Number.isFinite(remaining)) warnings.push(`quota file ${qPath} has no numeric "remaining" field`);
      else if (remaining < 1) reasons.push(`quota exhausted: remaining ${remaining} (see ${qPath})`);
      else if (remaining < 2) warnings.push(`quota reserve low: remaining ${remaining} — keep >= 2 in reserve for a rollback (Two-Stage Submit)`);
    } catch (e) { warnings.push(`quota file ${qPath} unreadable: ${e.message}`); }
  } else {
    warnings.push(`quota file not found (${qPath}); check /quota manually before submitting`);
  }

  const pass = reasons.length === 0;
  console.log(pass ? 'GATE PASS' : 'GATE FAIL');
  for (const w of warnings) console.log(`  warn: ${w}`);
  for (const r of reasons) console.log(`  fail: ${r}`);
  console.log(JSON.stringify({ slug, pass, reasons, warnings }, null, 2));
  return pass ? 0 : 1;
}

// ---------------------------------------------------------------------------
// loop — outer controller (state only; NEVER runs LLM calls)
// ---------------------------------------------------------------------------

function cmdLoop(root, argv) {
  const slug = argv[0];
  const cfgPath = argv[1];
  if (!slug || !cfgPath) return fail('usage: mf.mjs loop <slug> <config.json>');
  let cfg;
  try { cfg = JSON.parse(readFileSync(resolve(cfgPath), 'utf8')); } catch (e) { return fail(`loop: cannot read config ${cfgPath}: ${e.message}`); }
  const now = Date.now();
  const out = { slug, status: 'continue', now: new Date(now).toISOString() };

  // ROI cap (15% of prize target, except rd mode)
  const tokenCostUsd = Number(cfg.tokenCostUsd ?? 0);
  const prizeTargetUsd = Number(cfg.prizeTargetUsd);
  if (roiExceeded({ tokenCostUsd, prizeTargetUsd, mode: cfg.mode ?? 'live' })) {
    out.status = 'budget-roi-exhausted';
    out.reason = `token cost $${tokenCostUsd} exceeds ROI cap ${ROI_CAP_FRACTION * 100}% of prize target $${prizeTargetUsd} (cap $${(ROI_CAP_FRACTION * prizeTargetUsd).toFixed(2)})`;
    out.exit = 2;
    console.log(JSON.stringify(out, null, 2));
    return 2;
  }
  // Iteration budget
  const maxIterations = Number(cfg.budget?.maxIterations);
  const iterationsDone = Number(cfg.iterationsDone ?? 0);
  if (Number.isFinite(maxIterations) && iterationsDone >= maxIterations) {
    out.status = 'budget-iterations-exhausted';
    out.reason = `iterations ${iterationsDone} >= max ${maxIterations}`;
    out.exit = 2;
    console.log(JSON.stringify(out, null, 2));
    return 2;
  }
  // Time budget
  const timeMinutes = Number(cfg.budget?.timeMinutes);
  const startedAt = cfg.budget?.startedAt ? Date.parse(cfg.budget.startedAt) : NaN;
  if (Number.isFinite(timeMinutes) && Number.isFinite(startedAt)) {
    const elapsedMin = (now - startedAt) / 60000;
    if (elapsedMin >= timeMinutes) {
      out.status = 'budget-time-exhausted';
      out.reason = `elapsed ${elapsedMin.toFixed(1)} min >= budget ${timeMinutes} min`;
      out.exit = 2;
      console.log(JSON.stringify(out, null, 2));
      return 2;
    }
    out.budgetMinutesRemaining = Math.max(0, timeMinutes - elapsedMin);
  }
  // Terminal condition (target / cutoff unreachable)
  const term = terminalCondition({
    direction: cfg.direction ?? 'min',
    best: cfg.best,
    cutoff: cfg.cutoff,
    margin: cfg.margin ?? 0,
    maxRemainingGain: cfg.maxRemainingGain ?? 0,
    target: cfg.target,
  });
  out.terminal = term;
  if (term.status === 'target') {
    out.status = 'target-reached';
    out.reason = term.reason;
    out.exit = 0;
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }
  if (term.status === 'unreachable') {
    out.status = 'cutoff-unreachable';
    out.reason = term.reason;
    out.exit = 4;
    console.log(JSON.stringify(out, null, 2));
    return 4;
  }
  // Plateau — only valid if >= 2 strategy classes both failed to improve
  const plateau = plateauReached({ stale: Number(cfg.stale ?? 0), plateauN: Number(cfg.plateauN ?? 5), failedClasses: cfg.failedClasses ?? [] });
  if (plateau) {
    out.status = 'plateau';
    out.reason = `stale ${cfg.stale} >= plateauN ${cfg.plateauN} with >= 2 failed strategy classes: ${(cfg.failedClasses ?? []).join(', ')}`;
    out.exit = 3;
    console.log(JSON.stringify(out, null, 2));
    return 3;
  }
  // Continue: pick the next branch (Forced Paradigm Shift after 3 stale in one class)
  const classes = Array.isArray(cfg.strategyClasses) && cfg.strategyClasses.length > 0
    ? cfg.strategyClasses
    : ['syntax-golf', 'algorithmic-rewrite', 'data-structure', 'compression'];
  const failed = new Set(cfg.failedClasses ?? []);
  const stale = Number(cfg.stale ?? 0);
  const lastClass = cfg.lastStrategyClass ?? null;
  let nextClass = classes.find((c) => !failed.has(c)) ?? classes[0];
  let shiftReason = 'first untried strategy class';
  if (stale >= 3 && lastClass && classes.length > 1) {
    const other = classes.find((c) => c !== lastClass && !failed.has(c)) ?? classes.find((c) => c !== lastClass);
    if (other) { nextClass = other; shiftReason = `Forced Paradigm Shift: ${stale} stale iterations in class "${lastClass}"`; }
  }
  out.status = 'continue';
  out.nextAction = {
    strategyClass: nextClass,
    branch: `try next variant in class "${nextClass}" (see frontier table for untested ideas)`,
    reason: shiftReason,
  };
  out.state = { iterationsDone, stale, failedClasses: [...failed], tokenCostUsd, prizeTargetUsd };
  out.exit = 0;
  console.log(JSON.stringify(out, null, 2));
  return 0;
}

// ---------------------------------------------------------------------------
// CLI plumbing
// ---------------------------------------------------------------------------

function fail(msg) {
  console.error(msg);
  return 1;
}

function printHelp() {
  console.log(`mf.mjs v${VERSION} — muse-make-fun unified CLI (Exhaustion Loop v2)
Node 22 ESM, stdlib only. No npm install, no Python.

Usage:
  node tools/mf.mjs research <slug> [--fill <json|@file>] [--evidence <json|@file>] [--timebox <min>]
      Create/validate the Phase-0 research log (research/<slug>.json).
      Time-boxed best-effort: 0-result search evidence is accepted, so it never stalls.
  node tools/mf.mjs poll <slug>
      Fetch the live leaderboard and append a cutoff line (with B/hour velocity)
      to frontier/<slug>.jsonl. Fails loudly if the API is unreachable — never invents numbers.
  node tools/mf.mjs track <slug> <variant-json|@file>
      Record a variant metric line. size_bytes is computed automatically
      (mainBytes + 7) + (ownerJson ? 76 : 0). Rejects identical/cosmetic diffs
      and entries missing numbers.
  node tools/mf.mjs gate <slug> <variant-json|@file> [--starter <path>] [--quota <path>]
      Deterministic pre-submit gate. Exit 0 pass / 1 fail with reasons.
      Checks: strictly-better than best-so-far (a tie is NOT better),
      wall <= ${WALL_MAX_S}s, RSS <= ${RSS_MAX_MB}MB, LICENSE hash vs starter,
      secret scan, quota.
  node tools/mf.mjs loop <slug> <config.json>
      Outer controller (state only, no LLM calls). Exit codes:
        0 = target reached (or continue with a next action printed as JSON)
        2 = budget / ROI exhausted (token cost > 15% of prize target, unless mode "rd")
        3 = plateau (only valid if >= 2 strategy classes failed to improve)
        4 = cutoff unreachable (min: best - maxGain >= cutoff - margin;
            max: best + maxGain <= cutoff + margin)

Environment: MF_ROOT overrides the repo root (default: parent of tools/).
Docs: docs/07-exhaustion-loop.md`);
}

export async function main(argv) {
  const [cmd, ...rest] = argv;
  const root = repoRoot();
  if (!cmd || cmd === '--help' || cmd === 'help') { printHelp(); return 0; }
  if (cmd === '--version') { console.log(`mf.mjs v${VERSION}`); return 0; }
  try {
    switch (cmd) {
      case 'research': return cmdResearch(root, rest);
      case 'poll': return await cmdPoll(root, rest);
      case 'track': return cmdTrack(root, rest);
      case 'gate': return cmdGate(root, rest);
      case 'loop': return cmdLoop(root, rest);
      default: return fail(`unknown command: ${cmd}\nRun: node tools/mf.mjs --help`);
    }
  } catch (e) {
    console.error(`mf.mjs ${cmd} FAILED: ${e.message}`);
    return 1;
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
