#!/usr/bin/env node
/**
 * tools/mf.test.mjs — unit tests for tools/mf.mjs (Exhaustion Loop v2).
 * Run: node --test tools/mf.test.mjs
 * Covers the pure functions plus a small CLI smoke test. No network, no
 * accounts, no submit, no payments.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sizeBytes,
  terminalCondition,
  plateauReached,
  roiExceeded,
  validateVariant,
  isBetter,
  cutoffVelocity,
  cutoffIndex,
  extractCompetitionPage,
  filterOpenByDeadline,
  formatBountyLine,
  fetchOpenCompetitions,
  sizeOptsFromVariant,
  DEFAULT_ENTRY_PATH_BYTES,
  DEFAULT_OWNER_JSON_BYTES,
} from './mf.mjs';

const MF = fileURLToPath(new URL('./mf.mjs', import.meta.url));

describe('sizeBytes — automatic, never hand-computed', () => {
  it('491 B main.ts without owner.json is 498 (NOT 422 — the old double-subtraction bug)', () => {
    assert.equal(sizeBytes(491, false), 498);
  });
  it('491 B main.ts with owner.json is 574', () => {
    assert.equal(sizeBytes(491, true), 574);
  });
  it('540 B main.ts without owner.json is 547', () => {
    assert.equal(sizeBytes(540, false), 547);
  });
  it('540 B main.ts with owner.json is 623 (NOT 617)', () => {
    assert.equal(sizeBytes(540, true), 623);
  });
  it('0 B main.ts is just the 7 path bytes', () => {
    assert.equal(sizeBytes(0, false), 7);
  });
  it('rejects invalid mainBytes', () => {
    assert.throws(() => sizeBytes(-1, false), /mainBytes/);
    assert.throws(() => sizeBytes(Number.NaN, false), /mainBytes/);
  });
});

describe('sizeBytes — per-bounty overrides', () => {
  it('defaults are the main.ts bounty numbers (7 / 76)', () => {
    assert.equal(DEFAULT_ENTRY_PATH_BYTES, 7);
    assert.equal(DEFAULT_OWNER_JSON_BYTES, 76);
    assert.equal(sizeBytes(491, true, {}), sizeBytes(491, true));
  });
  it('entryPathBytes override replaces the 7 path bytes', () => {
    // e.g. entrypoint "engine.py" = 9 bytes
    assert.equal(sizeBytes(100, false, { entryPathBytes: 9 }), 109);
    assert.equal(sizeBytes(100, true, { entryPathBytes: 9 }), 185);
  });
  it('ownerJsonBytes override replaces the 76 owner.json bytes', () => {
    assert.equal(sizeBytes(100, true, { ownerJsonBytes: 50 }), 157);
    assert.equal(sizeBytes(100, false, { ownerJsonBytes: 50 }), 107);
  });
  it('both overrides together, including 0', () => {
    assert.equal(sizeBytes(100, true, { entryPathBytes: 0, ownerJsonBytes: 0 }), 100);
  });
  it('rejects invalid overrides', () => {
    assert.throws(() => sizeBytes(1, false, { entryPathBytes: -1 }), /entryPathBytes/);
    assert.throws(() => sizeBytes(1, true, { ownerJsonBytes: Number.NaN }), /ownerJsonBytes/);
  });
  it('sizeOptsFromVariant picks only the override fields present', () => {
    assert.deepEqual(sizeOptsFromVariant({ mainBytes: 1 }), {});
    assert.deepEqual(sizeOptsFromVariant({ entryPathBytes: 9, ownerJsonBytes: 3, x: 1 }), { entryPathBytes: 9, ownerJsonBytes: 3 });
  });
  it('validateVariant honors variant overrides', () => {
    const r = validateVariant({ score: 1, mainBytes: 100, ownerJson: true, entryPathBytes: 9, ownerJsonBytes: 50 }, null);
    assert.equal(r.ok, true);
    assert.equal(r.sizeBytes, 159);
    assert.equal(validateVariant({ score: 1, mainBytes: 100, entryPathBytes: 'x' }, null).ok, false);
  });
});

describe('cutoffIndex — paid places, clamped', () => {
  it('default 10 places -> index 9', () => {
    assert.equal(cutoffIndex(50), 9);
  });
  it('custom places -> index places-1', () => {
    assert.equal(cutoffIndex(50, 3), 2);
    assert.equal(cutoffIndex(50, 1), 0);
  });
  it('clamps to the list length', () => {
    assert.equal(cutoffIndex(4, 10), 3);
    assert.equal(cutoffIndex(1, 25), 0);
  });
  it('empty list -> -1; invalid places falls back to 10', () => {
    assert.equal(cutoffIndex(0, 10), -1);
    assert.equal(cutoffIndex(50, 0), 9);
    assert.equal(cutoffIndex(50, Number.NaN), 9);
  });
});

describe('list — pure helpers', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  it('extractCompetitionPage reads { items, next_cursor }', () => {
    const r = extractCompetitionPage({ items: [{ slug: 'a' }, { slug: 'b' }], next_cursor: 'abc' });
    assert.deepEqual(r.items.map((c) => c.slug), ['a', 'b']);
    assert.equal(r.nextCursor, 'abc');
  });
  it('extractCompetitionPage: null/absent next_cursor ends pagination', () => {
    assert.equal(extractCompetitionPage({ items: [], next_cursor: null }).nextCursor, null);
    assert.equal(extractCompetitionPage({ items: [] }).nextCursor, null);
  });
  it('extractCompetitionPage tolerates bare arrays and junk', () => {
    assert.equal(extractCompetitionPage([{ slug: 'x' }]).items.length, 1);
    assert.deepEqual(extractCompetitionPage(null), { items: [], nextCursor: null });
    assert.deepEqual(extractCompetitionPage({ foo: 1 }), { items: [], nextCursor: null });
  });
  it('filterOpenByDeadline drops past deadlines and keeps future / missing ones', () => {
    const items = [
      { slug: 'past', deadline: '2026-11-21T00:00:00Z' },
      { slug: 'future', deadline: '2026-11-24T17:00:00.000Z' },
      { slug: 'none' },
      { slug: 'nulled', deadline: null },
      { slug: 'garbage', deadline: 'soon' },
      { slug: 'exactly-now', deadline: '2026-11-22T12:00:00Z' },
    ];
    assert.deepEqual(filterOpenByDeadline(items, now).map((c) => c.slug), ['future', 'none', 'nulled', 'garbage', 'exactly-now']);
  });
  it('formatBountyLine prints slug | title | reward | closes', () => {
    assert.equal(
      formatBountyLine({ slug: 'tiny-chess-01', title: 'Chess in 4 KB', rewardAmount: 500, deadline: '2026-11-24T17:00:00.000Z' }),
      '- tiny-chess-01 | Chess in 4 KB | reward: 500 | closes: 2026-11-24T17:00:00.000Z',
    );
    assert.equal(formatBountyLine({ slug: 's' }), '- s | ? | reward: ? | closes: ?');
    assert.equal(formatBountyLine({ slug: 's', title: 't', rewardAmount: 0, deadline: 'd' }), '- s | t | reward: 0 | closes: d');
  });
  it('fetchOpenCompetitions follows next_cursor and stops on null (stub fetch, no network)', async () => {
    const pages = {
      '': { items: [{ slug: 'a' }], next_cursor: 'c1' },
      c1: { items: [{ slug: 'b' }], next_cursor: 'c2' },
      c2: { items: [{ slug: 'c' }], next_cursor: null },
    };
    const urls = [];
    const items = await fetchOpenCompetitions(async (url) => {
      urls.push(url);
      return pages[new URL(url).searchParams.get('cursor') ?? ''];
    });
    assert.deepEqual(items.map((c) => c.slug), ['a', 'b', 'c']);
    assert.equal(urls.length, 3);
    assert.ok(urls[0].includes('status=open') && !urls[0].includes('cursor='));
    assert.ok(urls[1].includes('cursor=c1'));
  });
  it('fetchOpenCompetitions stops on a repeated cursor and caps at 20 pages', async () => {
    let calls = 0;
    await fetchOpenCompetitions(async () => { calls++; return { items: [], next_cursor: 'same' }; });
    assert.equal(calls, 2);
    calls = 0;
    await fetchOpenCompetitions(async () => { calls++; return { items: [], next_cursor: `c${calls}` }; });
    assert.equal(calls, 20);
  });
});

describe('terminalCondition — corrected formulas, both directions', () => {
  it('minimisation: unreachable when best - maxGain >= cutoff - margin', () => {
    // Sokoban-style: best 560, cutoff 536, margin 10, maxGain 20 -> 540 >= 526
    const r = terminalCondition({ direction: 'min', best: 560, cutoff: 536, margin: 10, maxRemainingGain: 20 });
    assert.equal(r.status, 'unreachable');
  });
  it('minimisation: exact boundary counts as unreachable (a tie loses to the earlier receipt)', () => {
    // best - maxGain == cutoff - margin -> unreachable
    const r = terminalCondition({ direction: 'min', best: 546, cutoff: 536, margin: 10, maxRemainingGain: 20 });
    assert.equal(r.status, 'unreachable');
  });
  it('minimisation: still reachable when best - maxGain < cutoff - margin', () => {
    const r = terminalCondition({ direction: 'min', best: 500, cutoff: 536, margin: 10, maxRemainingGain: 20 });
    assert.equal(r.status, 'continue');
  });
  it('minimisation: target reached when best <= target', () => {
    const r = terminalCondition({ direction: 'min', best: 520, cutoff: 536, margin: 10, maxRemainingGain: 20, target: 526 });
    assert.equal(r.status, 'target');
  });
  it('maximisation: unreachable when best + maxGain <= cutoff + margin', () => {
    const r = terminalCondition({ direction: 'max', best: 100, cutoff: 200, margin: 10, maxRemainingGain: 50 });
    assert.equal(r.status, 'unreachable');
  });
  it('maximisation: exact boundary counts as unreachable', () => {
    const r = terminalCondition({ direction: 'max', best: 160, cutoff: 200, margin: 10, maxRemainingGain: 50 });
    assert.equal(r.status, 'unreachable');
  });
  it('maximisation: still reachable when best + maxGain > cutoff + margin', () => {
    const r = terminalCondition({ direction: 'max', best: 180, cutoff: 200, margin: 10, maxRemainingGain: 50 });
    assert.equal(r.status, 'continue');
  });
  it('maximisation: target reached when best >= target', () => {
    const r = terminalCondition({ direction: 'max', best: 210, cutoff: 200, margin: 10, maxRemainingGain: 50, target: 200 });
    assert.equal(r.status, 'target');
  });
  it('missing best/cutoff never claims a terminal state', () => {
    assert.equal(terminalCondition({ direction: 'min' }).status, 'continue');
  });
});

describe('plateauReached — requires 2 strategy classes', () => {
  it('stale >= N with only 1 failed class is NOT a plateau (blocks gaming)', () => {
    assert.equal(plateauReached({ stale: 5, plateauN: 5, failedClasses: ['syntax-golf'] }), false);
  });
  it('stale >= N with 2 distinct failed classes IS a plateau', () => {
    assert.equal(plateauReached({ stale: 5, plateauN: 5, failedClasses: ['syntax-golf', 'algorithmic-rewrite'] }), true);
  });
  it('duplicate class names do not count as 2 classes', () => {
    assert.equal(plateauReached({ stale: 9, plateauN: 5, failedClasses: ['syntax-golf', 'syntax-golf'] }), false);
  });
  it('stale below N is not a plateau even with 2 failed classes', () => {
    assert.equal(plateauReached({ stale: 4, plateauN: 5, failedClasses: ['syntax-golf', 'algorithmic-rewrite'] }), false);
  });
});

describe('roiExceeded — 15% token ROI cap with rd-mode exemption', () => {
  it('cost exactly at the cap is NOT exceeded (cap is inclusive)', () => {
    assert.equal(roiExceeded({ tokenCostUsd: 15, prizeTargetUsd: 100, mode: 'live' }), false);
  });
  it('cost above the cap IS exceeded', () => {
    assert.equal(roiExceeded({ tokenCostUsd: 15.01, prizeTargetUsd: 100, mode: 'live' }), true);
  });
  it('a $10 daily bounty caps token spend at $1.50', () => {
    assert.equal(roiExceeded({ tokenCostUsd: 1.5, prizeTargetUsd: 10, mode: 'live' }), false);
    assert.equal(roiExceeded({ tokenCostUsd: 1.51, prizeTargetUsd: 10, mode: 'live' }), true);
  });
  it('mode "rd" is exempt from the ROI cap', () => {
    assert.equal(roiExceeded({ tokenCostUsd: 999, prizeTargetUsd: 10, mode: 'rd' }), false);
  });
  it('missing prize target never triggers the cap', () => {
    assert.equal(roiExceeded({ tokenCostUsd: 999, prizeTargetUsd: undefined, mode: 'live' }), false);
  });
});

describe('validateVariant — identical-diff rejection', () => {
  const best = { score: 1_000_000, mainBytes: 557, sizeBytes: 564 };
  it('same bytes + same score as best-so-far is rejected', () => {
    const r = validateVariant({ score: 1_000_000, mainBytes: 557, ownerJson: false }, best);
    assert.equal(r.ok, false);
    assert.match(r.reasons.join(' '), /identical\/cosmetic diff/);
  });
  it('same codeHash as best-so-far is rejected even with different numbers', () => {
    const r = validateVariant({ score: 1_000_000, mainBytes: 540, ownerJson: false, codeHash: 'abc' }, { ...best, codeHash: 'abc' });
    assert.equal(r.ok, false);
  });
  it('a genuinely smaller variant is accepted and sizeBytes is computed', () => {
    const r = validateVariant({ score: 1_000_000, mainBytes: 540, ownerJson: false }, best);
    assert.equal(r.ok, true);
    assert.equal(r.sizeBytes, 547);
  });
  it('entries missing numbers are rejected', () => {
    assert.equal(validateVariant({ mainBytes: 540 }, best).ok, false);
    assert.equal(validateVariant({ score: 100 }, best).ok, false);
    assert.equal(validateVariant({ score: 'high', mainBytes: 540 }, best).ok, false);
  });
});

describe('isBetter — score first, then size tie-break', () => {
  it('higher score wins regardless of size', () => {
    assert.equal(isBetter({ score: 900, sizeBytes: 9999 }, { score: 800, sizeBytes: 100 }), true);
  });
  it('equal score, smaller size wins', () => {
    assert.equal(isBetter({ score: 1000, sizeBytes: 500 }, { score: 1000, sizeBytes: 600 }), true);
  });
  it('an exact tie is NOT better', () => {
    assert.equal(isBetter({ score: 1000, sizeBytes: 500 }, { score: 1000, sizeBytes: 500 }), false);
  });
  it('no best-so-far yet: any variant is better', () => {
    assert.equal(isBetter({ score: 1, sizeBytes: 1 }, null), true);
  });
});

describe('cutoffVelocity — B/hour from two polls', () => {
  it('Sokoban cutoff fell 573 -> 536 B in 55 minutes (~40.4 B/hour)', () => {
    const t0 = Date.parse('2026-11-21T14:00:00Z');
    const v = cutoffVelocity({ cutoff: 573, ts: t0 }, { cutoff: 536, ts: t0 + 55 * 60_000 });
    assert.ok(Math.abs(v - 40.3636) < 0.01, `got ${v}`);
  });
  it('returns null without two valid polls', () => {
    assert.equal(cutoffVelocity(null, { cutoff: 536, ts: 1 }), null);
    assert.equal(cutoffVelocity({ cutoff: 536, ts: 5 }, { cutoff: 536, ts: 5 }), null);
  });
});

// ---------------------------------------------------------------------------
// CLI smoke tests (temp MF_ROOT, no network)
// ---------------------------------------------------------------------------

function runCli(args, env = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(process.execPath, [MF, ...args], { env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      resolvePromise({ code: err ? err.code : 0, stdout, stderr });
    });
  });
}

describe('CLI smoke', () => {
  it('--help works and lists all subcommands', async () => {
    const r = await runCli(['--help']);
    assert.equal(r.code, 0);
    for (const cmd of ['list', 'research', 'poll', 'track', 'gate', 'loop']) {
      assert.ok(r.stdout.includes(cmd), `--help should list ${cmd}`);
    }
  });
  it('unknown command exits 1 and names the list command', async () => {
    const r = await runCli(['nope']);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /list \| research/);
  });
  it('gate honors variant wallMaxS / rssMaxMb overrides', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mf-test-'));
    try {
      const over = await runCli(['gate', 'g', JSON.stringify({ score: 1, mainBytes: 10, wallS: 30, rssMb: 400 })], { MF_ROOT: root });
      assert.equal(over.code, 1);
      assert.match(over.stdout, /exceeds max 20s/);
      assert.match(over.stdout, /exceeds max 350MB/);
      const ok = await runCli(['gate', 'g', JSON.stringify({ score: 1, mainBytes: 10, wallS: 30, rssMb: 400, wallMaxS: 40, rssMaxMb: 512 })], { MF_ROOT: root });
      assert.equal(ok.code, 0, ok.stdout + ok.stderr);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('track stores sizeBytes using variant entryPathBytes / ownerJsonBytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mf-test-'));
    try {
      const r = await runCli(['track', 'ov', JSON.stringify({ score: 1, mainBytes: 100, ownerJson: true, entryPathBytes: 9, ownerJsonBytes: 50 })], { MF_ROOT: root });
      assert.equal(r.code, 0, r.stderr);
      const line = JSON.parse((await readFile(join(root, 'frontier', 'ov.jsonl'), 'utf8')).trim());
      assert.equal(line.sizeBytes, 159);
      assert.equal(line.entryPathBytes, 9);
      assert.equal(line.ownerJsonBytes, 50);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('track computes sizeBytes automatically and appends to frontier/<slug>.jsonl', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mf-test-'));
    try {
      const r = await runCli(['track', 'sokoban-test', JSON.stringify({ score: 1_000_000, mainBytes: 491, ownerJson: false, variant: 'brotli-v1', strategyClass: 'compression' })], { MF_ROOT: root });
      assert.equal(r.code, 0, r.stderr);
      const lines = (await readFile(join(root, 'frontier', 'sokoban-test.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
      assert.equal(lines.length, 1);
      assert.equal(lines[0].sizeBytes, 498);
      assert.equal(lines[0].newBest, undefined); // file stores the metric line, not the flag
      // Second, identical variant must be rejected
      const r2 = await runCli(['track', 'sokoban-test', JSON.stringify({ score: 1_000_000, mainBytes: 491, ownerJson: false, variant: 'brotli-v1-copy', strategyClass: 'compression' })], { MF_ROOT: root });
      assert.equal(r2.code, 1);
      assert.match(r2.stderr, /identical\/cosmetic diff/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('research creates a template and validates a filled log (0-result evidence accepted)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mf-test-'));
    try {
      const r1 = await runCli(['research', 'tiny-test'], { MF_ROOT: root });
      assert.equal(r1.code, 1); // template created, fields missing
      assert.ok(r1.stdout.includes('research INVALID'));
      const fill = {
        leaderboard: { cutoff: 536, checkedAt: '2026-11-22T00:00:00Z', entries: 4590 },
        winners: [],
        theoreticalFloor: 'payload brotli 388 B + header',
        failureModes: ['timeout on sealed drand set'],
        nonCodeTasks: [{ task: 'link GitHub login', owner: 'user', verify: 'profile shows linked login' }],
        searchEvidence: [{ query: 'site:github.com sokoban solver makefun', results: 0 }],
      };
      const r2 = await runCli(['research', 'tiny-test', '--fill', JSON.stringify(fill)], { MF_ROOT: root });
      assert.equal(r2.code, 0, r2.stdout + r2.stderr);
      assert.ok(r2.stdout.includes('research VALID'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('loop returns exit 2 on ROI exhaustion and exit 4 on unreachable cutoff', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mf-test-'));
    try {
      const roiCfg = join(root, 'roi.json');
      await writeFile(roiCfg, JSON.stringify({ mode: 'live', prizeTargetUsd: 10, tokenCostUsd: 2, direction: 'min', best: 640, cutoff: 536, margin: 10, maxRemainingGain: 100 }));
      const r1 = await runCli(['loop', 'sokoban-test', roiCfg], { MF_ROOT: root });
      assert.equal(r1.code, 2);
      assert.match(r1.stdout, /budget-roi-exhausted/);
      const unreachCfg = join(root, 'unreach.json');
      await writeFile(unreachCfg, JSON.stringify({ mode: 'live', prizeTargetUsd: 100, tokenCostUsd: 1, direction: 'min', best: 640, cutoff: 536, margin: 10, maxRemainingGain: 50 }));
      const r2 = await runCli(['loop', 'sokoban-test', unreachCfg], { MF_ROOT: root });
      assert.equal(r2.code, 4);
      assert.match(r2.stdout, /cutoff-unreachable/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('gate fails a tie and passes a strictly better variant', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mf-test-'));
    try {
      await mkdir(join(root, 'frontier'), { recursive: true });
      await writeFile(join(root, 'frontier', 'gate-test.jsonl'),
        JSON.stringify({ type: 'variant', ts: 1, score: 1_000_000, mainBytes: 557, ownerJson: false, sizeBytes: 564 }) + '\n');
      const tie = await runCli(['gate', 'gate-test', JSON.stringify({ score: 1_000_000, mainBytes: 557, ownerJson: false, wallS: 10, rssMb: 200 })], { MF_ROOT: root });
      assert.equal(tie.code, 1);
      assert.match(tie.stdout, /GATE FAIL/);
      const better = await runCli(['gate', 'gate-test', JSON.stringify({ score: 1_000_000, mainBytes: 540, ownerJson: false, wallS: 10, rssMb: 200 })], { MF_ROOT: root });
      assert.equal(better.code, 0, better.stdout + better.stderr);
      assert.match(better.stdout, /GATE PASS/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
