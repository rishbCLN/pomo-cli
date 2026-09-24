import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifyCommand, bell, desktopNotify } from '../src/notify.mjs';

test('notifyCommand: per-OS command selection', () => {
  assert.deepEqual(notifyCommand('darwin', 'pomo', 'hi'), {
    cmd: 'osascript',
    args: ['-e', 'display notification "hi" with title "pomo"'],
  });
  assert.deepEqual(notifyCommand('linux', 'pomo', 'hi'), {
    cmd: 'notify-send',
    args: ['pomo', 'hi'],
  });
  assert.deepEqual(notifyCommand('win32', 'pomo', 'hi'), {
    cmd: 'msg',
    args: ['*', 'pomo: hi'],
  });
});

test('notifyCommand: unknown platform -> null (bell only)', () => {
  assert.equal(notifyCommand('sunos', 'pomo', 'hi'), null);
});

test('notifyCommand: quotes are escaped for osascript', () => {
  const { args } = notifyCommand('darwin', 'pomo', 'say "hi"');
  assert.equal(args[1], 'display notification "say \\"hi\\"" with title "pomo"');
});

test('bell: writes the BEL byte only when enabled', () => {
  const seen = [];
  const stream = { write: (s) => seen.push(s) };
  bell(true, stream);
  bell(false, stream);
  assert.deepEqual(seen, ['\x07']);
});

test('desktopNotify: spawns the OS command (injected spawn)', () => {
  const calls = [];
  const spawn = (cmd, args) => {
    calls.push({ cmd, args });
    return { on() {}, unref() {} };
  };
  desktopNotify('pomo', 'done', { platform: 'linux', spawn });
  assert.deepEqual(calls, [{ cmd: 'notify-send', args: ['pomo', 'done'] }]);
});

test('desktopNotify: disabled -> never spawns', () => {
  let called = false;
  const spawn = () => { called = true; return { on() {}, unref() {} }; };
  desktopNotify('pomo', 'done', { platform: 'linux', spawn, enabled: false });
  assert.equal(called, false);
});

test('desktopNotify: unknown platform -> never spawns', () => {
  let called = false;
  const spawn = () => { called = true; return { on() {}, unref() {} }; };
  desktopNotify('pomo', 'done', { platform: 'sunos', spawn });
  assert.equal(called, false);
});

test('desktopNotify: a throwing spawn is swallowed (best-effort)', () => {
  const spawn = () => { throw new Error('ENOENT'); };
  assert.doesNotThrow(() => desktopNotify('pomo', 'done', { platform: 'linux', spawn }));
});
