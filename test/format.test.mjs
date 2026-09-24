import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  progressBar,
  formatStatsTable,
  renderFrame,
  renderLine,
  phaseLabel,
} from '../src/format.mjs';

const FULL = '\u2588';
const EMPTY = '\u2591';

test('formatDuration: mm:ss', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(5), '00:05');
  assert.equal(formatDuration(59), '00:59');
  assert.equal(formatDuration(60), '01:00');
  assert.equal(formatDuration(90), '01:30');
  assert.equal(formatDuration(599), '09:59');
  assert.equal(formatDuration(1500), '25:00');
});

test('formatDuration: h:mm:ss past an hour', () => {
  assert.equal(formatDuration(3600), '1:00:00');
  assert.equal(formatDuration(3661), '1:01:01');
  assert.equal(formatDuration(7800), '2:10:00');
});

test('formatDuration: clamps negatives to zero', () => {
  assert.equal(formatDuration(-42), '00:00');
});

test('progressBar: fill proportion', () => {
  assert.equal(progressBar(0, 10), EMPTY.repeat(10));
  assert.equal(progressBar(1, 10), FULL.repeat(10));
  assert.equal(progressBar(0.5, 10), FULL.repeat(5) + EMPTY.repeat(5));
  assert.equal(progressBar(0.25, 8), FULL.repeat(2) + EMPTY.repeat(6));
});

test('progressBar: clamps ratio out of [0,1]', () => {
  assert.equal(progressBar(-1, 4), EMPTY.repeat(4));
  assert.equal(progressBar(5, 4), FULL.repeat(4));
});

test('progressBar: clamps width to at least 1', () => {
  assert.equal(progressBar(1, 0), FULL);
  assert.equal(progressBar(0.5, -3), FULL);
});

test('phaseLabel: human labels', () => {
  assert.equal(phaseLabel('work'), 'WORK');
  assert.equal(phaseLabel('short-break'), 'BREAK');
  assert.equal(phaseLabel('long-break'), 'LONG BREAK');
  assert.equal(phaseLabel('done'), 'DONE');
});

test('formatStatsTable: exact layout with color off', () => {
  const stats = {
    todayCount: 3,
    todayMinutes: 75,
    weekCount: 12,
    weekMinutes: 300,
    totalCount: 40,
    totalMinutes: 1000,
    currentStreakDays: 5,
    longestStreakDays: 8,
  };
  const expected = [
    'Focus stats',
    '  Today      3 sessions \u00b7 75 min',
    '  This week  12 sessions \u00b7 300 min',
    '  All time   40 sessions \u00b7 1000 min',
    '  Streak     5 days current \u00b7 8 days longest',
  ].join('\n');
  assert.equal(formatStatsTable(stats), expected);
});

test('formatStatsTable: singular session/day', () => {
  const stats = {
    todayCount: 1,
    todayMinutes: 25,
    weekCount: 1,
    weekMinutes: 25,
    totalCount: 1,
    totalMinutes: 25,
    currentStreakDays: 1,
    longestStreakDays: 1,
  };
  const expected = [
    'Focus stats',
    '  Today      1 session \u00b7 25 min',
    '  This week  1 session \u00b7 25 min',
    '  All time   1 session \u00b7 25 min',
    '  Streak     1 day current \u00b7 1 day longest',
  ].join('\n');
  assert.equal(formatStatsTable(stats), expected);
});

test('renderFrame: contains label, round, time, and a box (color off)', () => {
  const state = {
    phase: 'work',
    remainingSeconds: 1500,
    cycleIndex: 2,
    cycles: 4,
    phaseDuration: 1500,
    elapsedInPhase: 0,
    done: false,
  };
  const frame = renderFrame(state, { width: 20, cycles: 4 });
  assert.match(frame, /WORK/);
  assert.match(frame, /round 2\/4/);
  assert.match(frame, /25:00/);
  assert.ok(frame.includes('\u250c')); // top-left box corner
  assert.ok(frame.includes(EMPTY)); // an empty bar at the start of the phase
});

test('renderLine: plain one-liner for non-TTY', () => {
  const state = {
    phase: 'work',
    remainingSeconds: 1500,
    cycleIndex: 2,
    cycles: 4,
    phaseDuration: 1500,
    elapsedInPhase: 0,
    done: false,
  };
  assert.equal(renderLine(state), 'WORK (round 2) \u2014 25:00 remaining');
  assert.equal(renderLine({ done: true, phase: 'done' }), 'Session complete.');
});
