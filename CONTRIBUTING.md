# Contributing to pomo

Thanks for helping! `pomo` is a small, **zero-dependency** Node CLI, and the goal
is to keep it that way: fast, obvious, and cross-platform.

## Principles

- **No runtime dependencies.** Everything uses Node built-ins (`node:fs`,
  `node:path`, `node:os`, `node:readline`, `node:timers`, …). PRs that add a
  runtime dependency will be asked to remove it. In particular the countdown UI,
  progress bar, and notifications are all hand-rolled — no `chalk`, `blessed`,
  `cli-progress`, or `node-notifier`.
- **The core is pure and tested.** `timer.mjs`, `stats.mjs`, and `format.mjs` are
  pure functions with no clock, no timers, and no I/O. `store.mjs` takes an
  injected `fs`; `paths.mjs` takes injected `env`/`platform`/`homedir`;
  `runner.mjs` takes an injected clock and interval. That's what keeps the tests
  instant and deterministic.
- **Timers and rendering stay thin.** All the wall-clock/`setInterval` work lives
  in `runner.mjs`, which just orchestrates the pure functions. Tests never start
  that loop.
- **Safe with your data.** Writes are atomic (temp file + rename), only ever touch
  the resolved data file (or `--file`), and a corrupt history is backed up, never
  silently wiped. Ctrl-C restores the terminal cleanly.

## Getting started

```bash
git clone https://github.com/rishbCLN/pomo-cli.git
cd pomo-cli
node --test                 # run the suite
node bin/pomo.mjs --help    # try it
```

There's nothing to install — no `npm install` step.

## Adding a feature or fixing a bug

1. Put the logic in a pure function where you can (in `timer`, `stats`, or
   `format`) and add a `node --test` case with fixed inputs — including an
   injected `now`/elapsed value where time is involved.
2. Keep `runner.mjs` thin; it should only wire pure functions to real timers,
   streams, and the store.
3. If you touch the CLI surface, update the README options/subcommands table.

## Before you open a PR

- Run `node --test` — CI runs the same on Windows, macOS, and Linux across
  Node 18/20/22.
- Keep the change focused, and never introduce a real timer or a hang into the
  test suite.

## Ideas / good first issues

- A `--json` shape for `pomo log`.
- An ASCII heatmap / bar chart for `pomo stats`.
- A config file for default durations.
- A short demo GIF of the countdown for the README.
