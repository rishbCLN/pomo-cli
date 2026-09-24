// The ONE side-effecty module: a thin live loop around setInterval that drives
// the PURE timer/format functions, redraws the countdown, rings the bell, fires
// best-effort notifications, records completed WORK sessions, and restores the
// terminal on quit / Ctrl-C. Tests never start this loop.
//
// Everything impure (clock, timers, streams, fs, spawn) is injectable so the
// wiring is at least *possible* to exercise, but the real value being tested
// lives in the pure modules this file merely orchestrates.
import * as realFs from 'node:fs';
import { computeState, totalSeconds, toSeconds } from './timer.mjs';
import { renderFrame, renderLine, phaseLabel } from './format.mjs';
import { appendRecord } from './store.mjs';
import { bell, desktopNotify } from './notify.mjs';

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

/**
 * Run one Pomodoro set to completion (or until the user quits).
 * Resolves with an exit code (0 = clean finish or quit).
 * @param {object} options
 * @returns {Promise<number>}
 */
export function runSession(options = {}) {
  const config = options.config;
  const file = options.file;
  const stdout = options.stdout || process.stdout;
  const stdin = options.stdin || process.stdin;
  const fs = options.fs || realFs;
  const now = options.now || (() => Date.now());
  const setIntervalFn = options.setInterval || setInterval;
  const clearIntervalFn = options.clearInterval || clearInterval;
  const platform = options.platform || process.platform;
  const styler = options.styler;
  const proc = options.process || process;
  const isTTY = options.isTTY ?? Boolean(stdout.isTTY);
  const bellOn = options.bell !== false;
  const notifyOn = options.notify !== false;
  const workMinutes = config.work;

  return new Promise((resolve) => {
    let startMs = now();
    let pausedAccumMs = 0;
    let pauseStartMs = null;
    let skipMs = 0;
    let paused = false;

    let lastPhase = null;
    let lastCycle = null;
    let skippedCurrentWork = false;
    let completedWork = 0;
    let renderedLines = 0;
    let lastLineKey = null;
    let finished = false;
    let interval = null;

    const elapsedSeconds = () => {
      const ref = paused ? pauseStartMs : now();
      return Math.max(0, (ref - startMs - pausedAccumMs + skipMs) / 1000);
    };

    const logWorkCompleted = (cycleIndex) => {
      completedWork += 1;
      const record = {
        ts: new Date(now()).toISOString(),
        minutes: Math.round(toSeconds(workMinutes) / 60 * 100) / 100,
        phase: 'work',
        cycleIndex,
      };
      if (options.task) record.task = options.task;
      try {
        appendRecord(file, record, { fs });
      } catch (err) {
        stdout.write(`\n(could not save session: ${err && err.message ? err.message : err})\n`);
      }
    };

    const signalPhaseEnd = (endedPhase) => {
      bell(bellOn, stdout);
      if (notifyOn) {
        const msg = endedPhase === 'work' ? 'Work done \u2014 take a break' : 'Break over \u2014 back to it';
        desktopNotify('pomo', `${phaseLabel(endedPhase)} finished: ${msg}`, { platform, enabled: true });
      }
    };

    const render = (state) => {
      if (!isTTY) {
        const key = state.done ? 'done' : `${state.phase}:${state.cycleIndex}`;
        if (key !== lastLineKey) {
          lastLineKey = key;
          stdout.write(`${renderLine(state)}\n`);
        }
        return;
      }
      const frame = renderFrame(state, {
        styler,
        width: Math.max(10, Math.min((stdout.columns || 44) - 4, 50)),
        task: options.task,
        cycles: config.cycles,
        paused,
      });
      const lines = frame.split('\n');
      if (renderedLines > 0) stdout.write(`\x1b[${renderedLines}A`);
      for (const ln of lines) stdout.write(`\x1b[2K${ln}\n`);
      renderedLines = lines.length;
    };

    const cleanup = () => {
      if (interval) {
        clearIntervalFn(interval);
        interval = null;
      }
      try {
        proc.removeListener('SIGINT', onSigint);
      } catch { /* ignore */ }
      if (isTTY && stdin && stdin.isTTY && typeof stdin.setRawMode === 'function') {
        try { stdin.setRawMode(false); } catch { /* ignore */ }
        try { stdin.removeListener('data', onKey); } catch { /* ignore */ }
        try { stdin.pause(); } catch { /* ignore */ }
      }
      if (isTTY) {
        try { stdout.write(SHOW_CURSOR); } catch { /* ignore */ }
      }
    };

    const finish = (code) => {
      if (finished) return;
      finished = true;
      cleanup();
      stdout.write('\n');
      if (completedWork > 0) {
        const mark = styler ? styler.green('\u2713') : '\u2713';
        stdout.write(`${mark} ${completedWork} focus session${completedWork === 1 ? '' : 's'} logged.\n`);
      } else {
        stdout.write('No focus sessions completed.\n');
      }
      resolve(code);
    };

    const tick = () => {
      if (finished) return;
      const state = computeState(config, elapsedSeconds());
      const prev = lastPhase;

      if (prev === null) {
        lastPhase = state.phase;
        lastCycle = state.cycleIndex;
        render(state);
        if (state.done) finish(0);
        return;
      }

      if (state.done) {
        if (prev === 'work' && !skippedCurrentWork) logWorkCompleted(lastCycle);
        signalPhaseEnd(prev);
        render(state);
        finish(0);
        return;
      }

      if (state.phase !== prev) {
        if (prev === 'work' && !skippedCurrentWork) logWorkCompleted(lastCycle);
        signalPhaseEnd(prev);
        skippedCurrentWork = false;
        lastPhase = state.phase;
        lastCycle = state.cycleIndex;
      }
      render(state);
    };

    const togglePause = () => {
      if (paused) {
        pausedAccumMs += now() - pauseStartMs;
        paused = false;
        pauseStartMs = null;
      } else {
        paused = true;
        pauseStartMs = now();
      }
      tick();
    };

    const skip = () => {
      const state = computeState(config, elapsedSeconds());
      if (state.done) return;
      if (state.phase === 'work') skippedCurrentWork = true;
      skipMs += Math.max(0, state.remainingSeconds) * 1000 + 50;
      tick();
    };

    function onKey(buf) {
      const k = buf.toString();
      if (k === '\u0003' || k.toLowerCase() === 'q') { finish(0); return; } // Ctrl-C / q
      if (k === ' ') { togglePause(); return; }
      if (k.toLowerCase() === 's') { skip(); }
    }

    function onSigint() {
      finish(0);
    }

    // --- wire up ---
    if (totalSeconds(config) <= 0) {
      // Nothing to run (all-zero durations); finish cleanly.
      stdout.write('Nothing to run (zero-length session).\n');
      resolve(0);
      return;
    }

    try { proc.on('SIGINT', onSigint); } catch { /* ignore */ }

    if (isTTY) {
      stdout.write(HIDE_CURSOR);
      if (stdin && stdin.isTTY && typeof stdin.setRawMode === 'function') {
        try {
          stdin.setRawMode(true);
          stdin.resume();
          stdin.on('data', onKey);
        } catch { /* keys unavailable; timer still runs */ }
      }
    }

    tick(); // paint immediately
    if (!finished) interval = setIntervalFn(tick, 250);
  });
}
