import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDataFile, resolveDataDir } from '../src/paths.mjs';

test('default dir is ~/.pomo per platform', () => {
  assert.equal(resolveDataDir({ platform: 'linux', homedir: '/home/me', env: {} }), '/home/me/.pomo');
  assert.equal(resolveDataDir({ platform: 'win32', homedir: 'C:\\Users\\Me', env: {} }), 'C:\\Users\\Me\\.pomo');
});

test('default file is ~/.pomo/history.json (posix)', () => {
  assert.equal(
    resolveDataFile({ platform: 'linux', homedir: '/home/me', env: {} }),
    '/home/me/.pomo/history.json',
  );
});

test('default file is ~\\.pomo\\history.json (windows separators)', () => {
  assert.equal(
    resolveDataFile({ platform: 'win32', homedir: 'C:\\Users\\Me', env: {} }),
    'C:\\Users\\Me\\.pomo\\history.json',
  );
});

test('POMO_DIR overrides the directory', () => {
  assert.equal(
    resolveDataFile({ platform: 'linux', homedir: '/home/me', env: { POMO_DIR: '/tmp/px' } }),
    '/tmp/px/history.json',
  );
});

test('POMO_FILE overrides the whole path', () => {
  assert.equal(
    resolveDataFile({ platform: 'linux', homedir: '/home/me', env: { POMO_FILE: '/data/p.json' } }),
    '/data/p.json',
  );
});

test('--file (fileArg) wins over env overrides', () => {
  assert.equal(
    resolveDataFile({
      platform: 'linux',
      homedir: '/home/me',
      env: { POMO_FILE: '/data/p.json', POMO_DIR: '/tmp/px' },
      fileArg: '/explicit/here.json',
    }),
    '/explicit/here.json',
  );
});
