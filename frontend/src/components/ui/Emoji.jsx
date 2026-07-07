/**
 * Emoji
 * Renders an emoji using the device's native color emoji font.
 * No external CDN — no tracking-prevention issues, works offline.
 *
 * Font priority:
 *   Apple Color Emoji  → Mac / iOS
 *   Segoe UI Emoji     → Windows
 *   Noto Color Emoji   → Android / Linux
 */
export default function Emoji({ emoji, size = 24, className = '' }) {
  return (
    <span
      role="img"
      aria-label={emoji}
      className={`inline-block align-middle leading-none select-none ${className}`}
      style={{
        fontSize: size,
        fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", "EmojiOne Color", sans-serif',
        lineHeight: 1,
        letterSpacing: 0,
      }}
    >
      {emoji}
    </span>
  );
}
