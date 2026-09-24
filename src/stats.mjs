// PURE focus-stats aggregation over completed-session records.
//
// `now` (today) is always injected — this module NEVER calls Date.now() itself,
// so streak/day-boundary logic is fully deterministic under test.
//
// A record looks like: { ts: <ISO string | ms | Date>, minutes: <number>, ... }
// Only completed WORK sessions are ever written, so every record counts.

/**
 * Map a timestamp to an integer "local calendar day" number (days since epoch).
 * Two instants on the same local calendar date share a number; consecutive
 * calendar days differ by exactly 1. Time-of-day and timezone are ignored.
 */
export function localDayNumber(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NaN;
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/**
 * Aggregate records into headline focus stats.
 * @param {Array<{ ts:any, minutes:number }>} records
 * @param {Date|number|string} now  the reference "today"
 * @returns {{
 *   todayCount:number, todayMinutes:number,
 *   weekCount:number, weekMinutes:number,
 *   totalCount:number, totalMinutes:number,
 *   currentStreakDays:number, longestStreakDays:number,
 * }}
 */
export function computeStats(records, now = new Date()) {
  const todayNum = localDayNumber(now);
  // "This week" == a rolling 7-day window ending today (today + previous 6 days).
  const weekStartNum = todayNum - 6;

  let todayCount = 0;
  let todayMinutes = 0;
  let weekCount = 0;
  let weekMinutes = 0;
  let totalCount = 0;
  let totalMinutes = 0;
  const activeDays = new Set();

  for (const rec of Array.isArray(records) ? records : []) {
    if (!rec) continue;
    const dayNum = localDayNumber(rec.ts);
    if (Number.isNaN(dayNum)) continue; // skip malformed timestamps
    const minutes = Number(rec.minutes);
    const mins = Number.isFinite(minutes) ? minutes : 0;

    totalCount += 1;
    totalMinutes += mins;

    if (dayNum === todayNum) {
      todayCount += 1;
      todayMinutes += mins;
    }
    if (dayNum >= weekStartNum && dayNum <= todayNum) {
      weekCount += 1;
      weekMinutes += mins;
    }
    activeDays.add(dayNum);
  }

  return {
    todayCount,
    todayMinutes,
    weekCount,
    weekMinutes,
    totalCount,
    totalMinutes,
    currentStreakDays: currentStreak(activeDays, todayNum),
    longestStreakDays: longestStreak(activeDays),
  };
}

/**
 * Current streak: consecutive calendar days with >=1 session, counting back
 * from today. Today keeps it alive; if nothing today, yesterday still counts
 * (the day isn't over). Any earlier gap ends the streak.
 */
export function currentStreak(activeDays, todayNum) {
  let anchor = null;
  if (activeDays.has(todayNum)) anchor = todayNum;
  else if (activeDays.has(todayNum - 1)) anchor = todayNum - 1;
  if (anchor === null) return 0;

  let streak = 0;
  let day = anchor;
  while (activeDays.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

/** Longest run of consecutive active calendar days, ever. */
export function longestStreak(activeDays) {
  const days = [...activeDays].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    if (prev !== null && day === prev + 1) run += 1;
    else run = 1;
    if (run > longest) longest = run;
    prev = day;
  }
  return longest;
}
