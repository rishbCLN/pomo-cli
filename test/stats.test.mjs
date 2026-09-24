import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, localDayNumber } from '../src/stats.mjs';

// Build timestamps at local noon so day-mapping is stable regardless of the
// machine timezone (computeStats re-derives the LOCAL calendar day).
const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const rec = (date, minutes = 25) => ({ ts: date.toISOString(), minutes });

test('localDayNumber: same day equal, consecutive days differ by 1', () => {
  assert.equal(localDayNumber(day(2026, 9, 24, 1)), localDayNumber(day(2026, 9, 24, 23)));
  assert.equal(localDayNumber(day(2026, 9, 25)) - localDayNumber(day(2026, 9, 24)), 1);
});

test('empty history -> all zeros', () => {
  const s = computeStats([], day(2026, 9, 24));
  assert.deepEqual(s, {
    todayCount: 0,
    todayMinutes: 0,
    weekCount: 0,
    weekMinutes: 0,
    totalCount: 0,
    totalMinutes: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
  });
});

test('streak: consecutive days including today, gap does not extend it', () => {
  const now = day(2026, 9, 24, 10);
  const records = [
    rec(day(2026, 9, 24)),
    rec(day(2026, 9, 23)),
    rec(day(2026, 9, 22)),
    rec(day(2026, 9, 20)), // isolated (21st missing)
  ];
  const s = computeStats(records, now);
  assert.equal(s.currentStreakDays, 3); // 22,23,24
  assert.equal(s.longestStreakDays, 3);
});

test('streak: yesterday keeps the streak alive when nothing logged today', () => {
  const now = day(2026, 9, 24, 10);
  const records = [rec(day(2026, 9, 23)), rec(day(2026, 9, 22)), rec(day(2026, 9, 21))];
  const s = computeStats(records, now);
  assert.equal(s.currentStreakDays, 3); // anchored on yesterday
});

test('streak: a gap at yesterday+today breaks the current streak', () => {
  const now = day(2026, 9, 24, 10);
  const records = [rec(day(2026, 9, 22)), rec(day(2026, 9, 21))];
  const s = computeStats(records, now);
  assert.equal(s.currentStreakDays, 0); // nothing today or yesterday
  assert.equal(s.longestStreakDays, 2); // 21,22
});

test('counts and minutes: today / rolling week / all time', () => {
  const now = day(2026, 9, 24, 10);
  const records = [
    rec(day(2026, 9, 24), 25),
    rec(day(2026, 9, 24), 30),
    rec(day(2026, 9, 23), 25),
    rec(day(2026, 9, 20), 40), // within the last 7 days (>= 18th)
    rec(day(2026, 9, 17), 50), // older than 7 days
  ];
  const s = computeStats(records, now);
  assert.equal(s.todayCount, 2);
  assert.equal(s.todayMinutes, 55);
  assert.equal(s.weekCount, 4);
  assert.equal(s.weekMinutes, 120);
  assert.equal(s.totalCount, 5);
  assert.equal(s.totalMinutes, 170);
  assert.equal(s.currentStreakDays, 2); // 23,24
  assert.equal(s.longestStreakDays, 2);
});

test('malformed records are skipped, not fatal', () => {
  const now = day(2026, 9, 24, 10);
  const records = [
    { ts: 'not-a-date', minutes: 25 },
    { ts: day(2026, 9, 24).toISOString(), minutes: 'oops' }, // bad minutes -> 0
    rec(day(2026, 9, 24), 25),
    null,
  ];
  const s = computeStats(records, now);
  assert.equal(s.todayCount, 2); // the two valid-dated ones
  assert.equal(s.todayMinutes, 25); // 0 + 25
  assert.equal(s.totalCount, 2);
});
