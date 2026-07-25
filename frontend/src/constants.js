// Shared, cross-page constants — single source of truth so LandingPage.jsx
// and HowToPage.jsx don't drift out of sync with each other.

// Source for the browser extension (load-unpacked today; store listing later).
export const EXTENSION_REPO_URL = 'https://github.com/Kukarki/watchparty/tree/main/extension';

export const HOW_IT_WORKS_STEPS = [
  { n: 1, title: 'Pick a platform', desc: 'Choose Prime Video, Netflix, Disney+, YouTube, Max or Apple TV+ on the home page.' },
  { n: 2, title: 'Install the extension', desc: 'Needed once for DRM platforms (Netflix, Prime, etc.). YouTube works with no extension.' },
  { n: 3, title: 'Create a room & invite', desc: 'Create a room and share the code or invite link with friends.' },
  { n: 4, title: 'Press play — in sync', desc: 'Everyone’s play, pause and seek stay locked together. Chat, react and talk while you watch.' },
];
