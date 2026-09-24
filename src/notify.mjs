// Notifications, zero-dependency edition.
//
//  * The terminal bell (\x07) is the primary, always-available signal.
//  * Desktop notifications are BEST-EFFORT via the OS's own command (no npm
//    notifier package): `osascript` on macOS, `notify-send` on Linux, `msg` on
//    Windows. If the command is missing or fails, we silently ignore it — a
//    notification must never crash or block the timer.
import { spawn as realSpawn } from 'node:child_process';

/** Ring the terminal bell if enabled and the stream can take it. */
export function bell(enabled, stream) {
  if (!enabled || !stream || typeof stream.write !== 'function') return;
  try {
    stream.write('\x07');
  } catch {
    /* ignore */
  }
}

/**
 * PURE: choose the OS notification command for a platform.
 * @returns {{ cmd: string, args: string[] } | null}  null = no notifier for this OS
 */
export function notifyCommand(platform, title, message) {
  const t = String(title || 'pomo');
  const m = String(message || '');
  if (platform === 'darwin') {
    const q = (s) => `"${s.replace(/"/g, '\\"')}"`;
    return { cmd: 'osascript', args: ['-e', `display notification ${q(m)} with title ${q(t)}`] };
  }
  if (platform === 'linux') {
    return { cmd: 'notify-send', args: [t, m] };
  }
  if (platform === 'win32') {
    // msg.exe isn't on every SKU; that's fine — the spawn just fails and we move on.
    return { cmd: 'msg', args: ['*', `${t}: ${m}`] };
  }
  return null;
}

/**
 * Fire a best-effort desktop notification. Never throws, never blocks.
 * @param {string} title
 * @param {string} message
 * @param {{ platform?:NodeJS.Platform, spawn?:Function, enabled?:boolean }} [opts]
 */
export function desktopNotify(title, message, opts = {}) {
  if (opts.enabled === false) return;
  const platform = opts.platform || process.platform;
  const spawn = opts.spawn || realSpawn;
  const command = notifyCommand(platform, title, message);
  if (!command) return;
  try {
    const child = spawn(command.cmd, command.args, { stdio: 'ignore', windowsHide: true });
    if (child && typeof child.on === 'function') child.on('error', () => {});
    if (child && typeof child.unref === 'function') child.unref();
  } catch {
    /* best-effort: ignore */
  }
}
