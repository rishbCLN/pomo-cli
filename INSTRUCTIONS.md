# pomo — build instructions

> Self-contained build spec. A fresh session should be able to build, test, and ship this tool by following this file top to bottom. Do not add runtime dependencies.

| Field | Value |
| --- | --- |
| Product name | **pomo** |
| Tagline | *A no-nonsense terminal Pomodoro timer with streaks and stats.* |
| Folder id | `star-tool9-pomo` |
| Intended repo / npm name | `pomo` likely taken → prefer `pomo-cli` / `tomato-cli` / `pomodoro-term` (verify) |
| Status | Planned |
| License | MIT |

---

## 1. Problem & audience
Focus timers usually mean a phone app or a browser tab — a context switch away from where the work happens. Terminal-dwellers want a Pomodoro that lives where they already are, looks clean, and quietly tracks their focus history.

**Audience:** developers, students (exam grind!), writers — anyone who works in a terminal and uses time-boxing.

## 2. Why it earns stars
- Broad, non-niche appeal (everyone tries productivity tools).
- A crisp ASCII progress bar / big countdown **screenshots and GIFs beautifully**.
- Streaks + stats add a light gamification hook that people share.

## 3. Scope
**MVP**
- `pomo` starts a 25/5 work/break cycle; `pomo 50 10` custom durations.
- Live countdown UI: big timer, progress bar, current phase (work/break), session count.
- Pause/resume (space), skip (s), quit (q) via keypress.
- On phase end: terminal bell + a desktop notification (best-effort, per-OS) + auto-advance.
- Log completed sessions to `~/.pomo/history.json` (respect `POMO_DIR`).

**Stretch**
- `pomo stats` — today/this week: focused minutes, sessions, current streak, a tiny ASCII heatmap/bar chart.
- Task label: `pomo --task "study DBMS"` recorded in history.
- Config file for defaults (durations, long-break every N).
- `--no-notify`, `--no-sound`, `--json` for stats.
- Long break every 4th pomodoro.

**Non-goals**
- No cloud sync, no accounts, no always-on daemon. One process while the timer runs.

## 4. Tech & constraints
- Node **>= 18**, ESM, **zero runtime deps**.
- Notifications via OS commands (best-effort): `powershell`/`msg` (win), `osascript` (mac), `notify-send` (linux) — all optional, never required.
- Sound = terminal bell `\x07` (plus optional OS sound).
- `node:readline`, `node:process` (raw mode), `node:fs`, `node:os`.
- Entry `bin/pomo.mjs`.

## 5. CLI / UX design
```
Usage: pomo [work] [break] [options]      (durations in minutes)

Commands:
  pomo                 Start default 25/5
  pomo 50 10           Custom work/break
  pomo stats           Show focus stats + streak
  pomo stats --json

Options:
  --task <label>   Label this session
  --rounds <n>     Long break after n rounds (default 4)
  --no-notify      Disable desktop notifications
  --no-sound       Disable the bell
  -h, --help
  -v, --version

Keys: [space] pause/resume  [s] skip  [q] quit
```

Example:
```
  WORK · study DBMS                 round 2/4
  ┌────────────────────────────────────────┐
  │██████████████████░░░░░░░░░░░░░░░░░░░░░░░│
  └────────────────────────────────────────┘
                 18:24 remaining
  [space] pause   [s] skip   [q] quit
```

## 6. Architecture & file layout
```
pomo/
  bin/pomo.mjs
  src/timer.mjs      # phase state machine; tick; pause/skip (pure-ish, injectable clock)
  src/render.mjs     # pure: (state) -> frame string (bar, time, labels)
  src/input.mjs      # raw-mode keypress handling
  src/notify.mjs     # best-effort desktop notification + bell
  src/history.mjs    # append/read sessions; stats aggregation (pure aggregation fn)
  src/args.mjs
  test/render.test.mjs
  test/timer.test.mjs
  test/history.test.mjs
  package.json
  README.md
  LICENSE
  CONTRIBUTING.md
  .github/workflows/ci.yml
  .gitignore
```

## 7. Implementation steps
1. Scaffold package.json/bin/license/gitignore.
2. `timer.mjs`: state machine (WORK→BREAK→WORK…, long break every `--rounds`), with an **injectable clock** so it's testable without real time.
3. `render.mjs`: **pure** frame builder — format mm:ss, build progress bar to terminal width, labels. Tested with fixed states.
4. `input.mjs`: raw-mode keys (space/s/q), restore terminal on exit (handle SIGINT cleanly).
5. `notify.mjs`: bell always available; desktop notify best-effort per OS, silently skipped if unavailable.
6. `history.mjs`: append completed sessions; `stats` aggregation (today/week/streak) as a **pure** function over records.
7. `args.mjs`; wire `bin` render loop (redraw on tick, ~1s, minimal flicker via cursor moves).
8. Tests + CI + README + GIF (the countdown is the money shot).

## 8. Edge cases & safety
- **Always restore the terminal** (show cursor, disable raw mode) on quit, error, or SIGINT — never leave the shell broken.
- Non-TTY (e.g., piped/CI) → run in a simple line-print mode, no raw keys.
- Very small terminals → shrink/omit the bar gracefully.
- Notifications/sound are best-effort; their absence must never crash the timer.
- History writes are append + atomic; corrupt history file → back it up and start fresh with a warning (don't lose the user's shell session over it).
- Only writes within `~/.pomo` (or `POMO_DIR`).

## 9. Testing plan (`node --test`)
- `timer` with a fake clock: transitions at boundaries; pause freezes remaining; skip advances phase; long break after N rounds.
- `render`: mm:ss formatting; bar fill proportion; width clamping; NO_COLOR plain.
- `history`: streak calc across day boundaries; weekly totals; empty history.

## 10. README outline
Badges → "focus without leaving the terminal" → countdown GIF → `pomo stats` screenshot → keys/usage → config → install → contributing → license.

## 11. Distribution
`npm publish` (final name after availability check), bin + shebang, tag, Release with GIF.

## 12. Launch checklist
Countdown + stats GIF → Show HN → r/commandline, r/productivity, r/getdisciplined, r/node → dev.to → add to `awesome-zero-dependency`.

## 13. Definition of Done + star-magnet checklist
- [ ] Work/break cycle with pause/skip/quit; clean terminal restore always.
- [ ] History + `pomo stats` with streak.
- [ ] Notifications/sound degrade gracefully; non-TTY mode works.
- [ ] Zero dependencies.
- [ ] CI green; tests pass; published; listed in awesome list.
