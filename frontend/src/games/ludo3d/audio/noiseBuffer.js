// Percussive-sound technique new to this codebase (useCallRinger.js only
// demonstrates pure sine-oscillator tones) -- a generated white-noise
// buffer run through a biquad filter gives clicks/thuds/rattles their
// textured, non-tonal character. Same lazy-context + gain-envelope
// discipline as useCallRinger.js otherwise.
export function buildWhiteNoiseBuffer(ctx, duration = 0.1) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * One short filtered-noise "hit" -- the building block for rattles, taps,
 * and thuds. Click-free via a linear attack/decay gain envelope.
 */
export function playFilteredNoiseBurst(ctx, {
  duration = 0.08, filterType = 'bandpass', frequency = 1200, Q = 1,
  gainPeak = 0.3, attack = 0.005,
} = {}) {
  const buffer = buildWhiteNoiseBuffer(ctx, duration);
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = Q;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + attack);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
  source.stop(now + duration);
}
