import { getAudioContext, ensureAudioContextRunning } from './audioContext.js';
import { playFilteredNoiseBurst } from './noiseBuffer.js';

// Wind-up shake before a throw -- several quick, high, clicky bursts.
// RATTLE_DURATION_MS is also the minimum time the roll flow waits before
// releasing the throw (see components/scene/Dice.jsx), so the headless
// search has cover to run without ever looking like a stall.
export const RATTLE_DURATION_MS = 650;

export function playDiceRattle() {
  const ctx = ensureAudioContextRunning();
  if (!ctx) return;
  const clickCount = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < clickCount; i++) {
    const delayMs = (i / clickCount) * RATTLE_DURATION_MS + Math.random() * 30;
    setTimeout(() => {
      if (getAudioContext() !== ctx) return; // context was recreated/closed
      playFilteredNoiseBurst(ctx, {
        duration: 0.045, filterType: 'bandpass',
        frequency: 1700 + Math.random() * 900, Q: 2.5, gainPeak: 0.16,
      });
    }, delayMs);
  }
}

/** @param {number} [intensity] 0-1ish, scaled from the die's speed at impact */
export function playDiceLand(intensity = 1) {
  const ctx = ensureAudioContextRunning();
  if (!ctx) return;
  const clamped = Math.max(0.15, Math.min(1, intensity));
  playFilteredNoiseBurst(ctx, {
    duration: 0.08, filterType: 'lowpass', frequency: 700 + clamped * 500,
    Q: 0.7, gainPeak: 0.12 + clamped * 0.25,
  });
}

export function playPawnHop() {
  const ctx = ensureAudioContextRunning();
  if (!ctx) return;
  playFilteredNoiseBurst(ctx, { duration: 0.035, filterType: 'bandpass', frequency: 1500, Q: 3, gainPeak: 0.1 });
}

export function playCapture() {
  const ctx = ensureAudioContextRunning();
  if (!ctx) return;
  playFilteredNoiseBurst(ctx, { duration: 0.16, filterType: 'lowpass', frequency: 450, Q: 0.6, gainPeak: 0.3 });

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 110;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

export function playWinChime() {
  const ctx = ensureAudioContextRunning();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const start = ctx.currentTime + i * 0.12;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
}
