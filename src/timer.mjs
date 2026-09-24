// PURE Pomodoro session/cycle state machine.
//
// There are NO real timers in here. Given a static config and an elapsed time
// (in seconds), it computes exactly which phase you are in, how much time is
// left, and whether the whole run is finished. The impure `runner.mjs` feeds it
// wall-clock elapsed values; the tests feed it fixed numbers. Same code path.
//
// A "run" is one full set: `cycles` WORK phases, separated by short breaks, with
// a single long break replacing the final short break:
//
//   work -> short-break -> work -> short-break -> ... -> work -> long-break -> done
//
// (with cycles = 1 the single work phase is followed straight by the long break)

/** Minutes (possibly fractional) -> whole seconds, never negative. */
export function toSeconds(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.round(n * 60));
}

/**
 * Expand a config into an ordered list of phase segments.
 * @param {{ work:number, shortBreak:number, longBreak:number, cycles:number }} config
 * @returns {Array<{ phase:'work'|'short-break'|'long-break', cycleIndex:number, duration:number }>}
 */
export function buildTimeline(config) {
  const workSec = toSeconds(config.work);
  const shortSec = toSeconds(config.shortBreak);
  const longSec = toSeconds(config.longBreak);
  const cycles = Math.max(1, Math.floor(Number(config.cycles) || 1));

  const segments = [];
  for (let round = 1; round <= cycles; round++) {
    segments.push({ phase: 'work', cycleIndex: round, duration: workSec });
    if (round < cycles) {
      segments.push({ phase: 'short-break', cycleIndex: round, duration: shortSec });
    } else {
      segments.push({ phase: 'long-break', cycleIndex: round, duration: longSec });
    }
  }
  return segments;
}

/** Total length of a full run, in seconds. */
export function totalSeconds(config) {
  return buildTimeline(config).reduce((sum, seg) => sum + seg.duration, 0);
}

/**
 * Compute the timer state at a given elapsed time.
 * @param {{ work:number, shortBreak:number, longBreak:number, cycles:number }} config
 * @param {number} elapsedSeconds
 * @returns {{
 *   phase:'work'|'short-break'|'long-break'|'done',
 *   remainingSeconds:number,
 *   cycleIndex:number,
 *   cycles:number,
 *   phaseDuration:number,
 *   elapsedInPhase:number,
 *   done:boolean,
 * }}
 */
export function computeState(config, elapsedSeconds) {
  const cycles = Math.max(1, Math.floor(Number(config.cycles) || 1));
  const segments = buildTimeline(config);
  const total = segments.reduce((sum, seg) => sum + seg.duration, 0);
  const elapsed = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));

  if (elapsed >= total) {
    return {
      phase: 'done',
      remainingSeconds: 0,
      cycleIndex: cycles,
      cycles,
      phaseDuration: 0,
      elapsedInPhase: 0,
      done: true,
    };
  }

  let acc = 0;
  for (const seg of segments) {
    if (elapsed < acc + seg.duration) {
      const elapsedInPhase = elapsed - acc;
      return {
        phase: seg.phase,
        remainingSeconds: seg.duration - elapsedInPhase,
        cycleIndex: seg.cycleIndex,
        cycles,
        phaseDuration: seg.duration,
        elapsedInPhase,
        done: false,
      };
    }
    acc += seg.duration;
  }

  // Unreachable unless every segment has zero duration; treat as done.
  return {
    phase: 'done',
    remainingSeconds: 0,
    cycleIndex: cycles,
    cycles,
    phaseDuration: 0,
    elapsedInPhase: 0,
    done: true,
  };
}
