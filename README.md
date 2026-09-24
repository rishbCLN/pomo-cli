# pomo

[![CI](https://github.com/rishbCLN/pomo-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/rishbCLN/pomo-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pomo-cli.svg)](https://www.npmjs.com/package/pomo-cli)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A no-nonsense terminal Pomodoro timer with streaks and stats.**

Focus timers usually mean a phone app or a browser tab — a context switch away
from where the work actually happens. `pomo` lives in your terminal, looks clean,
and quietly tracks your focus history so you can keep a streak going.

```
  WORK · study DBMS   round 2/4
  ┌────────────────────────────────────────┐
  │██████████████████░░░░░░░░░░░░░░░░░░░░░░░│
  └────────────────────────────────────────┘
  18:24 remaining
  [space] pause   [s] skip   [q] quit
```

When the phase ends you get a terminal bell (and a best-effort desktop
notification), the next phase starts automatically, and every completed work
session is logged. Check in any time:

```
$ pomo stats
Focus stats
  Today      3 sessions · 75 min
  This week  12 sessions · 300 min
  All time   40 sessions · 1000 min
  Streak     5 days current · 8 days longest
```

No dependencies. No config. No account. Just Node 18+.

<!-- Add a short demo GIF here once recorded: ![demo](docs/demo.gif) -->

## Quick start

```bash
# one-off, no install
npx pomo-cli

# or install globally (exposes both `pomo` and `pomo-cli`)
npm install -g pomo-cli
pomo
```

> The npm package is published as **`pomo-cli`** (the bare `pomo` name is taken),
> but it installs a `pomo` command so you can just type `pomo`.

```bash
pomo                      # 25/5, long break every 4 rounds
pomo 50 10                # custom: 50-min work, 10-min break
pomo --task "study DBMS"  # label the session in your history
pomo stats                # today / this week / all time + streak
pomo log                  # list recent completed sessions
```

## Usage

```
pomo [work] [break] [options]     durations in minutes (default 25 5)
pomo stats [--json]               show focus stats + streak
pomo log [--json]                 list recent completed sessions
```

| Option | Description |
| --- | --- |
| `--work <min>` | Work length (default 25) |
| `--break <min>` | Short break length (default 5) |
| `--long-break <min>` | Long break length (default 15) |
| `--cycles <n>` | Work sessions before a long break (default 4, alias `--rounds`) |
| `--task <label>` | Label this session in the history |
| `--file <path>` | Use a specific history file |
| `--no-bell` | Don't ring the terminal bell (alias `--no-sound`) |
| `--no-notify` | Don't send desktop notifications |
| `--json` | Machine-readable output (for `stats` / `log`) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

While a timer is running in a real terminal:

| Key | Action |
| --- | --- |
| `space` | Pause / resume |
| `s` | Skip the current phase |
| `q` | Quit (completed sessions are kept) |

Exit codes: `0` clean finish or quit, `1` runtime failure, `2` bad usage.

## Where your data lives

Completed work sessions are appended to a small JSON file:

| Platform | Location |
| --- | --- |
| all | `~/.pomo/history.json` |

Overrides, in order of priority: `--file <path>` → `POMO_FILE` → `POMO_DIR`
(a directory that gets a `history.json`). Writes are atomic (temp file + rename),
and if the history file is ever unreadable it's backed up to `history.json.bak`
rather than being silently overwritten.

## How it works

The interesting logic is deliberately **pure** and injectable, so the whole thing
is testable without ever waiting on a real clock:

- `src/timer.mjs` — the phase state machine: given a config and an elapsed time,
  it returns the current phase, remaining seconds, round, and whether you're done.
- `src/stats.mjs` — `computeStats(records, now)`: today/week/total counts and
  minutes plus current/longest streaks. `now` is injected — no hidden clock.
- `src/format.mjs` — `mm:ss`, the progress bar, the live frame, the stats table.
- `src/store.mjs` / `src/paths.mjs` — atomic history I/O and cross-platform paths.
- `src/runner.mjs` — the *only* side-effecty piece: a thin `setInterval` loop that
  redraws the countdown, rings the bell, and records completed sessions.

## Development

```bash
node --test                 # run the suite (Node built-in, zero deps)
node bin/pomo.mjs --help
node bin/pomo.mjs --work 0.05 --cycles 1 --no-bell --file ./tmp.json
```

There's nothing to install — no `npm install` step.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues:
a `--json` shape for `log`, an ASCII heatmap for `stats`, and a demo GIF.

## License

MIT. See [LICENSE](LICENSE).
