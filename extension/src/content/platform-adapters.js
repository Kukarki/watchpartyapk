/**
 * Platform Adapters
 * Each adapter knows how to find the video element and extract metadata
 * for a specific streaming platform.
 *
 * All adapters implement the same interface:
 *   - matches()         → boolean: is this the right platform?
 *   - getVideo()        → HTMLVideoElement | null
 *   - getTitle()        → string
 *   - platform          → string identifier
 *   - logoColor         → string hex
 */

export const ADAPTERS = [
  // ── Amazon Prime Video ──────────────────────────────────
  {
    platform: 'primevideo',
    name: 'Prime Video',
    logoColor: '#00A8E1',
    matches: () =>
      location.hostname.includes('primevideo.com') ||
      location.hostname.includes('amazon.com'),
    getVideo: () => {
      // Prime Video renders in a custom player; video tag is nested
      return (
        document.querySelector('video[class*="rendererContainer"]') ||
        document.querySelector('.rendererContainer video') ||
        document.querySelector('video')
      );
    },
    getTitle: () => {
      return (
        document.querySelector('[data-automation-id="title"]')?.textContent ||
        document.querySelector('.atvwebplayersdk-title-text')?.textContent ||
        document.title.split('- Prime Video')[0].trim()
      );
    },
  },

  // ── Netflix ─────────────────────────────────────────────
  {
    platform: 'netflix',
    name: 'Netflix',
    logoColor: '#E50914',
    matches: () => location.hostname.includes('netflix.com'),
    getVideo: () => {
      return (
        document.querySelector('.NFPlayer video') ||
        document.querySelector('video.VideoContainer') ||
        document.querySelector('video')
      );
    },
    getTitle: () => {
      return (
        document.querySelector('.video-title h4')?.textContent ||
        document.querySelector('[data-uia="video-title"]')?.textContent ||
        document.title.split('- Netflix')[0].trim()
      );
    },
  },

  // ── Disney+ ─────────────────────────────────────────────
  {
    platform: 'disneyplus',
    name: 'Disney+',
    logoColor: '#0063E5',
    matches: () => location.hostname.includes('disneyplus.com'),
    getVideo: () => {
      return (
        document.querySelector('.btm-media-client-element video') ||
        document.querySelector('video')
      );
    },
    getTitle: () => {
      return (
        document.querySelector('[class*="title"]')?.textContent ||
        document.title.split('| Disney+')[0].trim()
      );
    },
  },

  // ── Max (HBO Max) ───────────────────────────────────────
  {
    platform: 'max',
    name: 'Max',
    logoColor: '#002BE7',
    matches: () =>
      location.hostname.includes('hbomax.com') ||
      location.hostname.includes('max.com'),
    getVideo: () => document.querySelector('video'),
    getTitle: () => {
      return (
        document.querySelector('[class*="TitleName"]')?.textContent ||
        document.title.split('- Max')[0].trim()
      );
    },
  },

  // ── YouTube ─────────────────────────────────────────────
  {
    platform: 'youtube',
    name: 'YouTube',
    logoColor: '#FF0000',
    matches: () =>
      location.hostname.includes('youtube.com') &&
      location.pathname.startsWith('/watch'),
    getVideo: () => document.querySelector('video.html5-main-video'),
    getTitle: () => {
      return (
        document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() ||
        document.title.split('- YouTube')[0].trim()
      );
    },
  },

  // ── Apple TV+ ───────────────────────────────────────────
  {
    platform: 'appletv',
    name: 'Apple TV+',
    logoColor: '#555555',
    matches: () => location.hostname.includes('tv.apple.com'),
    getVideo: () => document.querySelector('video'),
    getTitle: () => {
      return (
        document.querySelector('[class*="product-title"]')?.textContent ||
        document.title.split('- Apple TV+')[0].trim()
      );
    },
  },

  // ── KissKH ──────────────────────────────────────────────
  {
    platform: 'kisskh',
    name: 'KissKH',
    logoColor: '#e53e3e',
    matches: () =>
      location.hostname.includes('kisskh.co') ||
      location.hostname.includes('kisskh.me'),
    getVideo: () => document.querySelector('video'),
    getTitle: () => {
      return (
        document.querySelector('.film-name')?.textContent?.trim() ||
        document.querySelector('h1')?.textContent?.trim() ||
        document.title.split('|')[0].trim()
      );
    },
    // Toggle subtitles: click kisskh's CC button, or toggle the text track
    toggleSubtitles: () => {
      // Try clicking the CC / subtitle button in their player UI
      const ccBtn =
        document.querySelector('[title*="ubtitle"]') ||
        document.querySelector('[aria-label*="ubtitle"]') ||
        document.querySelector('.vjs-subtitles-button') ||
        document.querySelector('.plyr__control[data-plyr="captions"]');
      if (ccBtn) {
        ccBtn.click();
        return;
      }
      // Fallback: toggle the first text track directly
      const video = document.querySelector('video');
      if (!video) return;
      const tracks = Array.from(video.textTracks || []);
      if (tracks.length === 0) return;
      const track = tracks[0];
      track.mode = track.mode === 'showing' ? 'disabled' : 'showing';
    },
  },
];

export function detectAdapter() {
  return ADAPTERS.find((a) => a.matches()) || null;
}