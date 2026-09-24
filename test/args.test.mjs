import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, resolveConfig, DEFAULTS } from '../src/args.mjs';

test('defaults: bare invocation starts a session', () => {
  const r = parseArgs([]);
  assert.equal(r.command, 'start');
  assert.equal(r.work, null);
  assert.equal(r.shortBreak, null);
  assert.equal(r.bell, true);
  assert.equal(r.notify, true);
  assert.equal(r.json, false);
  assert.deepEqual(r.errors, []);
});

test('positional durations: pomo 50 10', () => {
  const r = parseArgs(['50', '10']);
  assert.equal(r.work, 50);
  assert.equal(r.shortBreak, 10);
  assert.deepEqual(r.errors, []);
});

test('flags: --work/--break/--long-break/--cycles', () => {
  const r = parseArgs(['--work', '50', '--break', '10', '--long-break', '20', '--cycles', '3']);
  assert.equal(r.work, 50);
  assert.equal(r.shortBreak, 10);
  assert.equal(r.longBreak, 20);
  assert.equal(r.cycles, 3);
  assert.deepEqual(r.errors, []);
});

test('flags: fractional work minutes are allowed (sub-minute runs)', () => {
  const r = parseArgs(['--work', '0.05']);
  assert.equal(r.work, 0.05);
  assert.deepEqual(r.errors, []);
});

test('flags: --rounds is an alias for --cycles', () => {
  assert.equal(parseArgs(['--rounds', '5']).cycles, 5);
});

test('flags: --no-bell and --no-sound both silence the bell', () => {
  assert.equal(parseArgs(['--no-bell']).bell, false);
  assert.equal(parseArgs(['--no-sound']).bell, false);
});

test('flags: --no-notify disables notifications', () => {
  assert.equal(parseArgs(['--no-notify']).notify, false);
});

test('flags: --task and --file capture their values', () => {
  const r = parseArgs(['--task', 'study DBMS', '--file', '/tmp/p.json']);
  assert.equal(r.task, 'study DBMS');
  assert.equal(r.file, '/tmp/p.json');
});

test('stats subcommand (+ --json)', () => {
  assert.equal(parseArgs(['stats']).command, 'stats');
  const r = parseArgs(['stats', '--json']);
  assert.equal(r.command, 'stats');
  assert.equal(r.json, true);
});

test('log subcommand', () => {
  assert.equal(parseArgs(['log']).command, 'log');
});

test('help and version', () => {
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-v']).version, true);
  assert.equal(parseArgs(['--version']).version, true);
});

test('errors: unknown option', () => {
  const r = parseArgs(['--bogus']);
  assert.ok(r.errors.some((e) => /unknown option/.test(e)));
});

test('errors: invalid minute value keeps the field null', () => {
  const r = parseArgs(['--work', 'abc']);
  assert.equal(r.work, null);
  assert.ok(r.errors.some((e) => /invalid value for --work/.test(e)));
});

test('errors: --cycles must be a whole number', () => {
  const r = parseArgs(['--cycles', '2.5']);
  assert.equal(r.cycles, null);
  assert.ok(r.errors.some((e) => /invalid value for --cycles/.test(e)));
});

test('errors: an option that wants a value but gets none', () => {
  const r = parseArgs(['--work']);
  assert.ok(r.errors.some((e) => /requires a value/.test(e)));
});

test('errors: a flag is not swallowed as a value', () => {
  const r = parseArgs(['--task', '--json']);
  assert.equal(r.task, null);
  assert.equal(r.json, true);
  assert.ok(r.errors.some((e) => /requires a value/.test(e)));
});

test('errors: junk positional', () => {
  const r = parseArgs(['abc']);
  assert.ok(r.errors.some((e) => /unexpected argument/.test(e)));
});

test('resolveConfig: fills defaults', () => {
  assert.deepEqual(resolveConfig(parseArgs([])), DEFAULTS);
});

test('resolveConfig: merges parsed values over defaults', () => {
  assert.deepEqual(resolveConfig(parseArgs(['50', '10'])), {
    work: 50,
    shortBreak: 10,
    longBreak: DEFAULTS.longBreak,
    cycles: DEFAULTS.cycles,
  });
});
