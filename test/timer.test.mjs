import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeState, buildTimeline, totalSeconds, toSeconds } from '../src/timer.mjs';

const CFG = { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 };
// timeline seconds: work 1500, short 300, long 900
// segment ends: 1500, 1800, 3300, 3600, 5100, 5400, 6900, 7800 (total 7800)

test('toSeconds: minutes -> whole seconds, fractional ok', () => {
  assert.equal(toSeconds(25), 1500);
  assert.equal(toSeconds(5), 300);
  assert.equal(toSeconds(0.05), 3); // used by the bounded smoke run
  assert.equal(toSeconds(0), 0);
  assert.equal(toSeconds(-9), 0);
});

test('buildTimeline: N work phases with a single long break at the end', () => {
  const t = buildTimeline(CFG);
  assert.equal(t.length, 8); // 4 work + 3 short + 1 long
  assert.equal(t.filter((s) => s.phase === 'work').length, 4);
  assert.equal(t.filter((s) => s.phase === 'short-break').length, 3);
  assert.equal(t.filter((s) => s.phase === 'long-break').length, 1);
  assert.equal(t[t.length - 1].phase, 'long-break');
});

test('totalSeconds: sums the whole run', () => {
  assert.equal(totalSeconds(CFG), 4 * 1500 + 3 * 300 + 900);
  assert.equal(totalSeconds(CFG), 7800);
});

test('computeState: start of the first work phase', () => {
  const s = computeState(CFG, 0);
  assert.equal(s.phase, 'work');
  assert.equal(s.remainingSeconds, 1500);
  assert.equal(s.cycleIndex, 1);
  assert.equal(s.phaseDuration, 1500);
  assert.equal(s.elapsedInPhase, 0);
  assert.equal(s.done, false);
});

test('computeState: mid first work phase counts down', () => {
  const s = computeState(CFG, 100);
  assert.equal(s.phase, 'work');
  assert.equal(s.remainingSeconds, 1400);
  assert.equal(s.elapsedInPhase, 100);
});

test('computeState: one second before the work boundary', () => {
  const s = computeState(CFG, 1499);
  assert.equal(s.phase, 'work');
  assert.equal(s.remainingSeconds, 1);
});

test('computeState: work -> short-break at the boundary', () => {
  const s = computeState(CFG, 1500);
  assert.equal(s.phase, 'short-break');
  assert.equal(s.remainingSeconds, 300);
  assert.equal(s.cycleIndex, 1);
  assert.equal(s.elapsedInPhase, 0);
});

test('computeState: short-break -> next work advances the cycle', () => {
  const s = computeState(CFG, 1800);
  assert.equal(s.phase, 'work');
  assert.equal(s.cycleIndex, 2);
  assert.equal(s.remainingSeconds, 1500);
});

test('computeState: long break arrives only after the Nth work session', () => {
  const s = computeState(CFG, 6900);
  assert.equal(s.phase, 'long-break');
  assert.equal(s.cycleIndex, 4);
  assert.equal(s.remainingSeconds, 900);
});

test('computeState: last second of the long break', () => {
  const s = computeState(CFG, 7799);
  assert.equal(s.phase, 'long-break');
  assert.equal(s.remainingSeconds, 1);
});

test('computeState: done at and beyond the total', () => {
  const atEnd = computeState(CFG, 7800);
  assert.equal(atEnd.phase, 'done');
  assert.equal(atEnd.done, true);
  assert.equal(atEnd.remainingSeconds, 0);

  const past = computeState(CFG, 999999);
  assert.equal(past.done, true);
});

test('computeState: cycles=1 goes work -> long-break -> done', () => {
  const cfg = { work: 1, shortBreak: 5, longBreak: 1, cycles: 1 };
  assert.equal(buildTimeline(cfg).length, 2);
  assert.equal(computeState(cfg, 0).phase, 'work');
  assert.equal(computeState(cfg, 60).phase, 'long-break');
  assert.equal(computeState(cfg, 120).done, true);
});

test('computeState: negative/garbage elapsed clamps to start', () => {
  const s = computeState(CFG, -50);
  assert.equal(s.phase, 'work');
  assert.equal(s.remainingSeconds, 1500);
});
