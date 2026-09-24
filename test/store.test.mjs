import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  parseRecords,
  loadRecords,
  appendRecord,
  saveRecords,
  backupCorrupt,
} from '../src/store.mjs';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pomo-store-'));
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('parseRecords: valid array', () => {
  assert.deepEqual(parseRecords('[{"minutes":25}]'), { records: [{ minutes: 25 }], corrupt: false });
});

test('parseRecords: empty / whitespace is empty, not corrupt', () => {
  assert.deepEqual(parseRecords(''), { records: [], corrupt: false });
  assert.deepEqual(parseRecords('   \n'), { records: [], corrupt: false });
});

test('parseRecords: broken JSON is corrupt', () => {
  assert.equal(parseRecords('{not json').corrupt, true);
});

test('parseRecords: non-array JSON is corrupt', () => {
  assert.equal(parseRecords('{"minutes":25}').corrupt, true);
  assert.equal(parseRecords('42').corrupt, true);
});

test('loadRecords: missing file -> empty, not corrupt', () => {
  const dir = tmpDir();
  try {
    const res = loadRecords(path.join(dir, 'nope.json'));
    assert.deepEqual(res, { records: [], corrupt: false, raw: null });
  } finally {
    cleanup(dir);
  }
});

test('append + load round-trip, creating the dir as needed', () => {
  const dir = tmpDir();
  try {
    const file = path.join(dir, 'nested', 'history.json'); // dir does not exist yet
    const r1 = appendRecord(file, { ts: '2026-09-24T10:00:00.000Z', minutes: 25 });
    assert.equal(r1.corrupt, false);
    assert.equal(r1.count, 1);
    appendRecord(file, { ts: '2026-09-24T11:00:00.000Z', minutes: 30 });

    const { records, corrupt } = loadRecords(file);
    assert.equal(corrupt, false);
    assert.equal(records.length, 2);
    assert.equal(records[0].minutes, 25);
    assert.equal(records[1].minutes, 30);
  } finally {
    cleanup(dir);
  }
});

test('saveRecords writes atomically (no leftover temp file)', () => {
  const dir = tmpDir();
  try {
    const file = path.join(dir, 'history.json');
    saveRecords(file, [{ minutes: 25 }]);
    assert.ok(fs.existsSync(file));
    assert.ok(!fs.existsSync(`${file}.tmp`));
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), [{ minutes: 25 }]);
  } finally {
    cleanup(dir);
  }
});

test('corrupt history is backed up to .bak and never silently wiped', () => {
  const dir = tmpDir();
  try {
    const file = path.join(dir, 'history.json');
    fs.writeFileSync(file, '{ this is not valid json');
    const res = appendRecord(file, { ts: '2026-09-24T10:00:00.000Z', minutes: 25 });

    assert.equal(res.corrupt, true);
    // old (corrupt) content preserved in .bak
    assert.ok(fs.existsSync(`${file}.bak`));
    assert.equal(fs.readFileSync(`${file}.bak`, 'utf8'), '{ this is not valid json');
    // new file is valid and contains exactly the appended record
    const { records, corrupt } = loadRecords(file);
    assert.equal(corrupt, false);
    assert.deepEqual(records, [{ ts: '2026-09-24T10:00:00.000Z', minutes: 25, }]);
  } finally {
    cleanup(dir);
  }
});

test('backupCorrupt: best-effort, returns boolean', () => {
  const dir = tmpDir();
  try {
    const file = path.join(dir, 'history.json');
    assert.equal(backupCorrupt(file, 'garbage'), true);
    assert.equal(fs.readFileSync(`${file}.bak`, 'utf8'), 'garbage');
  } finally {
    cleanup(dir);
  }
});

test('injected fs is honored (round-trip through node:fs namespace)', () => {
  const dir = tmpDir();
  try {
    const file = path.join(dir, 'history.json');
    appendRecord(file, { ts: '2026-09-24T10:00:00.000Z', minutes: 25 }, { fs });
    const { records } = loadRecords(file, { fs });
    assert.equal(records.length, 1);
  } finally {
    cleanup(dir);
  }
});
