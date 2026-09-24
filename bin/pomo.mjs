#!/usr/bin/env node
// pomo — a no-nonsense terminal Pomodoro timer with streaks & stats.
// Zero runtime dependencies; Node >= 18. This entry point is thin: it parses
// args, resolves the data file, and dispatches to pure helpers or the runner.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

import { parseArgs, resolveConfig, HELP } from '../src/args.mjs';
import { resolveDataFile } from '../src/paths.mjs';
import { loadRecords, backupCorrupt } from '../src/store.mjs';
import { computeStats } from '../src/stats.mjs';
import { formatStatsTable, formatDuration, formatTimestamp } from '../src/format.mjs';
import { makeStyler, colorEnabled } from '../src/ui.mjs';
import { runSession } from '../src/runner.mjs';

function getVersion() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function readHistory(file, c) {
  const { records, corrupt, raw } = loadRecords(file);
  if (corrupt) {
    backupCorrupt(file, raw);
    process.stderr.write(
      `${c.yellow('warning:')} history file was unreadable; backed it up to ${file}.bak and started fresh.\n`,
    );
    return [];
  }
  return records;
}

function formatLogLine(rec) {
  const stamp = formatTimestamp(rec.ts);
  const mins = `${rec.minutes} min`.padStart(7);
  const task = rec.task ? `  ${rec.task}` : '';
  return `  ${stamp}  ${mins}${task}`;
}

async function main(argv) {
  const opts = parseArgs(argv);
  const c = makeStyler(colorEnabled());

  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    process.stdout.write(`pomo ${getVersion()}\n`);
    return 0;
  }
  if (opts.errors.length) {
    for (const e of opts.errors) process.stderr.write(`${c.red('error:')} ${e}\n`);
    process.stderr.write(`\nRun ${c.cyan('pomo --help')} for usage.\n`);
    return 2;
  }

  const file = resolveDataFile({
    env: process.env,
    platform: process.platform,
    homedir: homedir(),
    fileArg: opts.file,
  });

  if (opts.command === 'stats') {
    const records = readHistory(file, c);
    const stats = computeStats(records, new Date());
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
    } else {
      process.stdout.write(`${formatStatsTable(stats, { styler: c })}\n`);
    }
    return 0;
  }

  if (opts.command === 'log') {
    const records = readHistory(file, c);
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
      return 0;
    }
    if (records.length === 0) {
      process.stdout.write('No sessions recorded yet.\n');
      return 0;
    }
    const recent = records.slice(-20);
    process.stdout.write(`${c.bold('Recent focus sessions')}\n`);
    for (const rec of recent) process.stdout.write(`${formatLogLine(rec)}\n`);
    const totalMin = records.reduce((sum, r) => sum + (Number(r.minutes) || 0), 0);
    const noun = records.length === 1 ? 'session' : 'sessions';
    process.stdout.write(`  ${c.dim(`${records.length} ${noun}, ${formatDuration(totalMin * 60)} total`)}\n`);
    return 0;
  }

  // Default action: start a timed session.
  const config = resolveConfig(opts);
  const code = await runSession({
    config,
    file,
    task: opts.task,
    bell: opts.bell,
    notify: opts.notify,
    styler: c,
  });
  return code;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`unexpected error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
