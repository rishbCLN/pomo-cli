// Reading / appending / saving the history file. All filesystem access goes
// through an INJECTED `fs` (defaulting to node:fs) so tests can use a temp dir
// or a fake. Writes are ATOMIC (temp file + rename) and a corrupt history file
// is backed up rather than silently wiped.
import * as realFs from 'node:fs';
import path from 'node:path';

/**
 * PURE: parse raw file text into records.
 * @returns {{ records: Array, corrupt: boolean }}
 */
export function parseRecords(text) {
  const trimmed = String(text == null ? '' : text).trim();
  if (trimmed === '') return { records: [], corrupt: false };
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { records: [], corrupt: true };
  }
  if (!Array.isArray(data)) return { records: [], corrupt: true };
  return { records: data, corrupt: false };
}

/**
 * Load records from disk. Missing file -> empty (not corrupt). Never throws for
 * a corrupt file; it flags `corrupt` and returns the raw text so the caller can
 * decide whether to back it up.
 * @param {string} file
 * @param {{ fs?:object }} [opts]
 * @returns {{ records: Array, corrupt: boolean, raw: string|null }}
 */
export function loadRecords(file, { fs = realFs } = {}) {
  if (!fs.existsSync(file)) return { records: [], corrupt: false, raw: null };
  const raw = fs.readFileSync(file, 'utf8');
  const { records, corrupt } = parseRecords(raw);
  return { records, corrupt, raw };
}

/** Copy a corrupt file aside to `<file>.bak` so no data is lost. Best-effort. */
export function backupCorrupt(file, raw, { fs = realFs } = {}) {
  try {
    fs.writeFileSync(`${file}.bak`, raw == null ? '' : raw);
    return true;
  } catch {
    return false;
  }
}

/** Atomically write the full records array (temp file + rename). */
export function saveRecords(file, records, { fs = realFs } = {}) {
  const dir = path.dirname(file);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(records, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

/**
 * Append one record, preserving existing history. A corrupt existing file is
 * backed up to `<file>.bak` and a fresh history is started (never a silent
 * wipe). Returns whether corruption was encountered and the new total.
 * @param {string} file
 * @param {object} record
 * @param {{ fs?:object }} [opts]
 * @returns {{ corrupt: boolean, count: number }}
 */
export function appendRecord(file, record, { fs = realFs } = {}) {
  const { records, corrupt, raw } = loadRecords(file, { fs });
  let list = records;
  if (corrupt) {
    backupCorrupt(file, raw, { fs });
    list = [];
  }
  list.push(record);
  saveRecords(file, list, { fs });
  return { corrupt, count: list.length };
}
