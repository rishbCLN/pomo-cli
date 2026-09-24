// Zero-dependency argument parsing. Kept PURE so it is fully unit-testable:
// parseArgs never touches the filesystem, the clock, or process state.

export const DEFAULTS = { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 };

export const HELP = `pomo \u2014 a no-nonsense terminal Pomodoro timer with streaks & stats

Usage:
  pomo [work] [break] [options]     durations in minutes (default 25 5)
  pomo stats [--json]               show focus stats + streak
  pomo log [--json]                 list recent completed sessions

Options:
      --work <min>        work length (default ${DEFAULTS.work})
      --break <min>       short break length (default ${DEFAULTS.shortBreak})
      --long-break <min>  long break length (default ${DEFAULTS.longBreak})
      --cycles <n>        work sessions before a long break (default ${DEFAULTS.cycles})
                          (alias: --rounds)
      --task <label>      label this session in the history
      --file <path>       use a specific history file (overrides POMO_FILE/POMO_DIR)
      --no-bell           don't ring the terminal bell (alias: --no-sound)
      --no-notify         don't send desktop notifications
      --json              machine-readable output (stats/log)
  -h, --help              show this help
  -v, --version           show the version

Keys (while a timer runs in a real terminal):
  [space] pause/resume    [s] skip phase    [q] quit

Examples:
  pomo                    # 25/5 with a long break every 4 rounds
  pomo 50 10              # custom 50-min work, 10-min break
  pomo --task "study DBMS"
  pomo stats              # today / this week / all time + streak

History is stored in ~/.pomo/history.json (override with POMO_DIR, POMO_FILE, or --file).
`;

function isNumericToken(token) {
  return /^\d+(\.\d+)?$/.test(token);
}

function looksLikeFlag(token) {
  return typeof token === 'string' && token.length > 1 && token.startsWith('-') && !/^-?\d/.test(token);
}

/**
 * Parse argv (already sliced past node + script).
 * @returns {{
 *   command:'start'|'stats'|'log',
 *   work:number|null, shortBreak:number|null, longBreak:number|null, cycles:number|null,
 *   task:string|null, file:string|null,
 *   bell:boolean, notify:boolean, json:boolean,
 *   help:boolean, version:boolean, errors:string[],
 * }}
 */
export function parseArgs(argv) {
  const r = {
    command: 'start',
    work: null,
    shortBreak: null,
    longBreak: null,
    cycles: null,
    task: null,
    file: null,
    bell: true,
    notify: true,
    json: false,
    help: false,
    version: false,
    errors: [],
  };
  const positional = [];

  const setMinutes = (key, value, name) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      r.errors.push(`invalid value for ${name}: "${value}" (expected minutes > 0)`);
      return;
    }
    r[key] = n;
  };
  const setInteger = (key, value, name) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      r.errors.push(`invalid value for ${name}: "${value}" (expected a whole number >= 1)`);
      return;
    }
    r[key] = n;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const takeValue = () => {
      const next = argv[i + 1];
      if (next === undefined || looksLikeFlag(next)) {
        r.errors.push(`option ${arg} requires a value`);
        return null;
      }
      i += 1;
      return next;
    };

    switch (arg) {
      case '-h':
      case '--help':
        r.help = true;
        break;
      case '-v':
      case '--version':
        r.version = true;
        break;
      case '--json':
        r.json = true;
        break;
      case '--no-bell':
      case '--no-sound':
        r.bell = false;
        break;
      case '--no-notify':
        r.notify = false;
        break;
      case '--work': {
        const v = takeValue();
        if (v !== null) setMinutes('work', v, '--work');
        break;
      }
      case '--break':
      case '--short-break': {
        const v = takeValue();
        if (v !== null) setMinutes('shortBreak', v, '--break');
        break;
      }
      case '--long-break': {
        const v = takeValue();
        if (v !== null) setMinutes('longBreak', v, '--long-break');
        break;
      }
      case '--cycles':
      case '--rounds': {
        const v = takeValue();
        if (v !== null) setInteger('cycles', v, '--cycles');
        break;
      }
      case '--task': {
        const v = takeValue();
        if (v !== null) r.task = v;
        break;
      }
      case '--file': {
        const v = takeValue();
        if (v !== null) r.file = v;
        break;
      }
      default:
        if (looksLikeFlag(arg)) {
          r.errors.push(`unknown option: ${arg}`);
        } else {
          positional.push(arg);
        }
    }
  }

  interpretPositional(positional, r, setMinutes);
  return r;
}

function interpretPositional(positional, r, setMinutes) {
  if (positional.length === 0) return;
  const first = positional[0].toLowerCase();

  if (first === 'stats' || first === 'log') {
    r.command = first;
    for (const extra of positional.slice(1)) {
      r.errors.push(`unexpected argument: ${extra}`);
    }
    return;
  }

  // Bare durations: [work] [break]
  if (isNumericToken(positional[0])) setMinutes('work', positional[0], 'work');
  else r.errors.push(`unexpected argument: ${positional[0]}`);

  if (positional[1] !== undefined) {
    if (isNumericToken(positional[1])) setMinutes('shortBreak', positional[1], 'break');
    else r.errors.push(`unexpected argument: ${positional[1]}`);
  }
  for (const extra of positional.slice(2)) {
    r.errors.push(`unexpected argument: ${extra}`);
  }
}

/** Fill config defaults from a parsed-args result. PURE. */
export function resolveConfig(parsed) {
  return {
    work: parsed.work ?? DEFAULTS.work,
    shortBreak: parsed.shortBreak ?? DEFAULTS.shortBreak,
    longBreak: parsed.longBreak ?? DEFAULTS.longBreak,
    cycles: parsed.cycles ?? DEFAULTS.cycles,
  };
}
