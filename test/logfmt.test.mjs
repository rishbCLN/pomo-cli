// Regression tests for `pomo log` timestamp rendering.
//
// The timezone is pinned to a non-UTC zone (before any Date use) so these tests
// have teeth on UTC CI machines: the previous formatter rendered UTC via
// toISOString(), which disagreed with the LOCAL calendar day that `stats` uses.
process.env.TZ = 'Asia/Tokyo'; // UTC+9, no DST — stable and never UTC
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTimestamp } from '../src/format.mjs';
import { localDayNumber } from '../src/stats.mjs';

const pad2 = (n) => String(n).padStart(2, '0');
const localStamp = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

test('formatTimestamp: renders LOCAL wall-clock time, not UTC (regression)', () => {
  const ts = '2026-07-01T23:30:00.000Z'; // 08:30 next day in Asia/Tokyo
  assert.equal(formatTimestamp(ts), localStamp(ts));
  // Guard: the harness TZ must be non-UTC, otherwise the check is toothless.
  if (new Date(ts).getTimezoneOffset() !== 0) {
    // Old behaviour was toISOString().replace('T',' ').slice(0,16) === UTC.
    assert.notEqual(formatTimestamp(ts), '2026-07-01 23:30');
  }
});

test('formatTimestamp: agrees with the local calendar day used by stats', () => {
  // A late-evening-UTC session that rolls into the next LOCAL day must show that
  // next local day — the same day stats buckets it under.
  const ts = '2026-07-01T23:30:00.000Z';
  const shownDay = formatTimestamp(ts).slice(0, 10); // YYYY-MM-DD
  const d = new Date(ts);
  const localDay = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  assert.equal(shownDay, localDay);
  // and it maps to the same local day-number stats counts by
  assert.equal(localDayNumber(ts), localDayNumber(`${localDay}T00:00:00`));
});

test('formatTimestamp: invalid timestamp falls back to the raw value', () => {
  assert.equal(formatTimestamp('not-a-date'), 'not-a-date');
  assert.equal(formatTimestamp(undefined), 'undefined');
});
