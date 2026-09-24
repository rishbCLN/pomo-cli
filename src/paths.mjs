// PURE cross-platform data-file resolver. Everything (env, platform, homedir) is
// injected so it can be unit-tested for any OS from a single machine.
//
// Per the spec, pomo keeps its history under `~/.pomo` on every platform (so it
// "only writes within ~/.pomo"), with escalating overrides:
//
//   --file <path>   (fileArg)         highest priority, an exact file
//   POMO_FILE                          an exact file
//   POMO_DIR                           a directory (history.json inside it)
//   <homedir>/.pomo/history.json       default
import path from 'node:path';

const HISTORY_FILE = 'history.json';

/** Pick the right path flavour for the target platform, not the host. */
function joinFor(platform, ...parts) {
  const p = platform === 'win32' ? path.win32 : path.posix;
  return p.join(...parts);
}

/**
 * Resolve the data DIRECTORY (no filename).
 * @param {{ env?:object, platform?:NodeJS.Platform, homedir?:string }} [opts]
 */
export function resolveDataDir({ env = {}, platform = process.platform, homedir = '' } = {}) {
  if (env.POMO_DIR) return env.POMO_DIR;
  return joinFor(platform, homedir || '', '.pomo');
}

/**
 * Resolve the history FILE path.
 * @param {{ env?:object, platform?:NodeJS.Platform, homedir?:string, fileArg?:string|null }} [opts]
 */
export function resolveDataFile({ env = {}, platform = process.platform, homedir = '', fileArg = null } = {}) {
  if (fileArg) return fileArg;
  if (env.POMO_FILE) return env.POMO_FILE;
  return joinFor(platform, resolveDataDir({ env, platform, homedir }), HISTORY_FILE);
}
