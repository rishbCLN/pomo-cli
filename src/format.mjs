// PURE presentation helpers: time formatting, a text progress bar, the live
// countdown frame, and the stats table. Colors come from an INJECTED styler so
// every string is testable with color turned off. No I/O, no timers.

/** A styler whose methods are all identity — the "color off" default. */
export function plainStyler() {
  const id = (s) => String(s);
  return { red: id, green: id, yellow: id, blue: id, magenta: id, cyan: id, dim: id, bold: id };
}

/** Seconds -> "mm:ss", or "h:mm:ss" once we cross an hour. */
export function formatDuration(totalSeconds) {
  let s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const pad2 = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`;
}

/**
 * A fixed-width progress bar from a 0..1 ratio.
 * @param {number} ratio  clamped to [0,1]
 * @param {number} width  clamped to >= 1
 */
export function progressBar(ratio, width, opts = {}) {
  const filledChar = opts.filled || '\u2588'; // full block
  const emptyChar = opts.empty || '\u2591';   // light shade
  const w = Math.max(1, Math.floor(Number(width)) || 1);
  let r = Number(ratio);
  if (!Number.isFinite(r)) r = 0;
  r = Math.min(1, Math.max(0, r));
  const filled = Math.round(r * w);
  return filledChar.repeat(filled) + emptyChar.repeat(w - filled);
}

/** Human phase label. */
export function phaseLabel(phase) {
  switch (phase) {
    case 'work': return 'WORK';
    case 'short-break': return 'BREAK';
    case 'long-break': return 'LONG BREAK';
    case 'done': return 'DONE';
    default: return String(phase || '').toUpperCase();
  }
}

function pluralize(n, word) {
  return `${n} ${word}${Number(n) === 1 ? '' : 's'}`;
}

function padEndTo(s, n) {
  const str = String(s);
  return str.length >= n ? str : str + ' '.repeat(n - str.length);
}

/**
 * The multi-line live countdown frame (TTY mode).
 * @param {object} state  a timer.computeState() result
 * @param {{ styler?:object, width?:number, task?:string, cycles?:number, paused?:boolean }} opts
 */
export function renderFrame(state, opts = {}) {
  const c = opts.styler || plainStyler();
  const width = Math.max(10, Math.min(Math.floor(opts.width || 40), 60));
  const task = opts.task ? ` \u00b7 ${opts.task}` : '';
  const paused = opts.paused ? '  [PAUSED]' : '';
  const label = phaseLabel(state.phase);
  const cycles = opts.cycles ?? state.cycles ?? '?';
  const round = state.phase === 'work' ? `round ${state.cycleIndex}/${cycles}` : '';
  const ratio = state.phaseDuration ? state.elapsedInPhase / state.phaseDuration : (state.done ? 1 : 0);
  const bar = progressBar(ratio, width);
  const time = formatDuration(state.remainingSeconds);
  const paint = state.phase === 'work' ? c.green : c.cyan;

  const lines = [];
  lines.push(`  ${paint(label)}${task}${paused}${round ? '   ' + c.dim(round) : ''}`);
  lines.push(`  ${c.dim('\u250c' + '\u2500'.repeat(width) + '\u2510')}`);
  lines.push(`  ${c.dim('\u2502')}${paint(bar)}${c.dim('\u2502')}`);
  lines.push(`  ${c.dim('\u2514' + '\u2500'.repeat(width) + '\u2518')}`);
  lines.push(`  ${c.bold(time)} remaining`);
  lines.push(`  ${c.dim('[space] pause   [s] skip   [q] quit')}`);
  return lines.join('\n');
}

/** A single plain line for non-TTY / piped output (no cursor tricks). */
export function renderLine(state) {
  if (state.done) return 'Session complete.';
  const round = state.phase === 'work' ? ` (round ${state.cycleIndex})` : '';
  return `${phaseLabel(state.phase)}${round} \u2014 ${formatDuration(state.remainingSeconds)} remaining`;
}

/**
 * Render the stats table.
 * @param {object} stats  a stats.computeStats() result
 * @param {{ styler?:object }} opts
 */
export function formatStatsTable(stats, opts = {}) {
  const c = opts.styler || plainStyler();
  const L = 11;
  const row = (label, content) => `  ${padEndTo(label, L)}${content}`;
  const dot = ' \u00b7 ';

  const lines = [];
  lines.push(c.bold('Focus stats'));
  lines.push(row('Today', `${pluralize(stats.todayCount, 'session')}${dot}${stats.todayMinutes} min`));
  lines.push(row('This week', `${pluralize(stats.weekCount, 'session')}${dot}${stats.weekMinutes} min`));
  lines.push(row('All time', `${pluralize(stats.totalCount, 'session')}${dot}${stats.totalMinutes} min`));
  lines.push(row('Streak', `${pluralize(stats.currentStreakDays, 'day')} current${dot}${pluralize(stats.longestStreakDays, 'day')} longest`));
  return lines.join('\n');
}
