import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PLATFORMS } from './HomePage.jsx';
import { EXTENSION_REPO_URL, HOW_IT_WORKS_STEPS as QUICK_STEPS } from '@/constants.js';

const INSTALL_STEPS = [
  'Download the extension folder (link above) or clone the repo.',
  'Open your browser and go to chrome://extensions (or edge://extensions).',
  'Turn on “Developer mode” (top-right toggle).',
  'Click “Load unpacked” and select the extension/ folder.',
  'Pin the WatchParty icon — you’re ready to sync.',
];

const FAQ_ITEMS = [
  {
    q: 'Which browsers are supported?',
    a: 'Chrome, Edge and Brave (any Chromium-based browser) support the full extension experience. Safari and mobile browsers can’t run extensions, but YouTube rooms work everywhere with no extension needed, and you can always join a room to chat and talk while someone else drives playback.',
  },
  {
    q: 'Do all participants need their own subscription?',
    a: 'Yes — WatchParty only keeps everyone’s playback in sync, it doesn’t stream video for you. Everyone in the room needs their own account on whichever platform you’re watching (Netflix, Prime Video, etc.), except YouTube which just needs a URL.',
  },
  {
    q: 'How many people can join a room?',
    a: 'Watch parties don’t have a hard participant limit — invite as many friends as you like. (Games like Ludo are capped at 2–4 players, since that’s a rule of the game itself, not a WatchParty limit.)',
  },
  {
    q: 'Is my chat and call data private?',
    a: 'Voice and video calls connect directly between participants’ browsers — our server never sees or stores that content. Chat messages are stored so people who join later can see room history. See our full Privacy Policy for details.',
  },
  {
    q: 'The extension says "not detected" — what do I do?',
    a: 'Make sure it’s loaded and enabled in chrome://extensions, then refresh the WatchParty tab (extensions only activate on a fresh page load). See the install steps above for the full walkthrough.',
  },
  {
    q: 'How do I create a room?',
    a: 'From your dashboard, click "Create Room", give it a name, and share the room code or invite link with friends. You can also pick a platform first (Netflix, Prime Video, etc.) and WatchParty will create the room for you.',
  },
  {
    q: 'What happens if someone doesn’t have the extension installed?',
    a: 'They can still join the room to chat, react and talk over voice — they just won’t have their playback auto-synced on DRM platforms like Netflix or Prime Video until they install the extension. YouTube always works without it.',
  },
  {
    q: 'Can I use WatchParty on my phone?',
    a: 'Yes for YouTube and for joining a room to chat/talk — no extension needed. Full sync on Netflix/Prime from a phone currently requires a Chromium browser that supports extensions (like Kiwi on Android); see the mobile section above for details.',
  },
  {
    q: 'How do I delete my account?',
    a: 'WatchParty doesn’t have a self-service delete button yet — email us from the address on your account and we’ll remove it. See the Privacy Policy for the contact address.',
  },
];

function FAQAccordion() {
  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState(null);

  const q = query.trim().toLowerCase();
  const results = q
    ? FAQ_ITEMS.filter((item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
    : FAQ_ITEMS;

  return (
    <div>
      <div className="relative mb-4">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dim text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpenIndex(null); }}
          placeholder="Search for a question — e.g. “how many people”, “browsers”, “private”…"
          className="input-base pl-10"
        />
      </div>

      {results.length === 0 ? (
        <p className="text-dim text-sm px-1">
          No matches for “{query}” — try a different word, or{' '}
          <a href="mailto:kushalkarki1415@gmail.com" className="text-amber hover:underline underline-offset-2">
            email us
          </a>.
        </p>
      ) : (
        <div className="space-y-2">
          {results.map(({ q: question, a }, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={question} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="font-display font-semibold text-bright text-sm">{question}</span>
                  <span className={`shrink-0 text-dim transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {isOpen && (
                  <p className="px-5 pb-4 text-sub text-sm leading-relaxed animate-fade-in">{a}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlatformGuide({ platformId, steps }) {
  const p = PLATFORMS.find((x) => x.id === platformId);
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-7 flex items-center">
          {p?.logo ? (
            <img
              src={p.logo}
              alt={p.name}
              className="h-6 w-auto object-contain max-w-[110px]"
              style={{ filter: p.invertLogo ? 'invert(1) brightness(0.95)' : 'brightness(0.95)' }}
              onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { className: 'font-display font-bold text-bright', textContent: p.name })); }}
            />
          ) : (
            <span className="font-display font-bold text-bright">{p?.name}</span>
          )}
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber
                         bg-amber/10 border border-amber/20 rounded-full px-2 py-0.5">
          Extension required
        </span>
      </div>
      <ol className="space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm text-sub leading-relaxed">
            <span className="shrink-0 w-5 h-5 rounded-full bg-raised border border-border
                             flex items-center justify-center text-xs font-mono text-amber">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function HowToPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-void">
      {/* Nav */}
      <nav className="border-b border-border bg-surface/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <span className="font-display font-bold text-lg text-bright">
              Watch<span className="text-gradient">Party</span>
            </span>
          </Link>
          <Link to="/" className="btn-ghost text-xs px-3 py-1.5 border border-border">
            ← Home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-12">

        {/* Header */}
        <header>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-bright mb-3">
            How to use <span className="text-gradient">WatchParty</span>
          </h1>
          <p className="text-sub text-base leading-relaxed">
            Watch movies and shows together, perfectly in sync, with live chat, reactions
            and voice. Here’s everything you need to get started.
          </p>
        </header>

        {/* Quick start */}
        <section>
          <h2 className="font-display font-bold text-xl text-bright mb-4">Quick start</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {QUICK_STEPS.map(({ n, title, desc }) => (
              <div key={n} className="card p-5 flex gap-3">
                <span className="shrink-0 w-8 h-8 rounded-lg bg-amber/10 border border-amber/20
                                 flex items-center justify-center font-display font-bold text-amber">
                  {n}
                </span>
                <div>
                  <h3 className="font-display font-semibold text-bright text-sm mb-0.5">{title}</h3>
                  <p className="text-dim text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Extension */}
        <section>
          <h2 className="font-display font-bold text-xl text-bright mb-2">Install the extension</h2>
          <p className="text-sub text-sm leading-relaxed mb-4">
            Streaming services like Netflix and Prime Video are DRM-protected, so WatchParty
            uses a lightweight browser extension to keep playback in sync. You only install it
            once. <span className="text-bright">YouTube needs no extension</span> — it plays
            directly in the room.
          </p>

          <div className="flex flex-wrap gap-3 mb-5">
            <a
              href={EXTENSION_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm"
            >
              Get the extension →
            </a>
            <a
              href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm border border-border"
            >
              Load-unpacked help
            </a>
          </div>

          <div className="card p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-dim mb-3">
              Install steps (Chrome / Edge / Brave)
            </p>
            <ol className="space-y-2.5">
              {INSTALL_STEPS.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-sub leading-relaxed">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-raised border border-border
                                   flex items-center justify-center text-xs font-mono text-amber">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Platform guides */}
        <section>
          <h2 className="font-display font-bold text-xl text-bright mb-2">Platform guides</h2>
          <p className="text-sub text-sm leading-relaxed mb-4">
            With the extension installed, open the streaming site and the WatchParty sidebar
            appears automatically. Everyone in the room needs their own subscription to the
            service — WatchParty only syncs playback, it doesn’t stream the video for you.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <PlatformGuide
              platformId="primevideo"
              steps={[
                'Open primevideo.com and sign in to your Amazon account.',
                'On the home page, pick Prime Video and create a room.',
                'The WatchParty sidebar loads on the Prime Video tab.',
                'Open any title and press play — the room syncs instantly.',
              ]}
            />
            <PlatformGuide
              platformId="netflix"
              steps={[
                'Open netflix.com and sign in to your Netflix account.',
                'On the home page, pick Netflix and create a room.',
                'The WatchParty sidebar loads on the Netflix tab.',
                'Start any show or movie — play, pause and seek stay synced.',
              ]}
            />
          </div>

          {/* YouTube note */}
          <div className="mt-3 card p-5 border-online/20">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-online">✓</span>
              <h3 className="font-display font-semibold text-bright text-sm">
                YouTube — no extension needed
              </h3>
            </div>
            <p className="text-dim text-xs leading-relaxed">
              Pick YouTube on the home page, create a room, and paste any YouTube URL. It plays
              embedded inside the room and works in any browser, including mobile.
            </p>
          </div>
        </section>

        {/* Mobile */}
        <section>
          <h2 className="font-display font-bold text-xl text-bright mb-2">Using WatchParty on mobile</h2>
          <div className="card p-5 space-y-3">
            <p className="text-sub text-sm leading-relaxed">
              Most mobile browsers (including Safari on iPhone) don’t support browser extensions,
              so extension-based sync for Netflix and Prime Video isn’t available on those devices.
              You’ve still got good options:
            </p>
            <ul className="space-y-2 text-sm text-sub">
              <li className="flex gap-2">
                <span className="text-amber">•</span>
                <span><span className="text-bright">YouTube works fully on mobile</span> — no extension required. Great for phones and tablets.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber">•</span>
                <span><span className="text-bright">Join to chat, react &amp; talk</span> — open the room’s invite link on your phone to use live chat, emoji reactions and voice, even while others drive playback.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber">•</span>
                <span>
                  <span className="text-bright">Android — full sync is possible</span>. Stock Chrome for
                  Android can’t run extensions, but Chromium browsers like{' '}
                  <a
                    href="https://play.google.com/store/apps/details?id=com.kiwibrowser.browser"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber hover:underline underline-offset-2"
                  >
                    Kiwi
                  </a>{' '}
                  can — it’s the same way ad blockers like uBlock Origin run on Android.
                  Install one, open WatchParty in it, add the extension, and sync Netflix
                  or Prime right on your phone.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber">•</span>
                <span><span className="text-bright">iPhone / iPad</span> — no browser supports the sync extension, so use YouTube or join to chat, or continue on a computer.</span>
              </li>
            </ul>
            <a
              href={EXTENSION_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-amber text-sm hover:underline underline-offset-2"
            >
              Extension download &amp; source →
            </a>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="font-display font-bold text-xl text-bright mb-4">Frequently asked questions</h2>
          <FAQAccordion />
        </section>

        {/* CTA */}
        <section className="text-center pt-2">
          <button onClick={() => navigate('/')} className="btn-primary">
            Back to home — start watching →
          </button>
        </section>
      </main>
    </div>
  );
}
