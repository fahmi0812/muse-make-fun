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
    for (const cmd of ['research', 'poll', 'track', 'gate', 'loop']) {
      assert.ok(r.stdout.includes(cmd), `--help should list ${cmd}`);
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
