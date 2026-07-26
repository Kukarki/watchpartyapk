// Lazy shared AudioContext singleton -- unlike useCallRinger.js (which opens
// and closes a fresh context per ring session), this one stays open for the
// whole game session since sound effects fire continuously throughout play.
let ctx = null;

export function getAudioContext() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    ctx = null; // blocked (no user gesture yet, or unsupported) -- callers no-op
  }
  return ctx;
}

export function ensureAudioContextRunning() {
  const c = getAudioContext();
  if (c?.state === 'suspended') c.resume().catch(() => {});
  return c;
}
