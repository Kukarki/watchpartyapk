import { useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { PLATFORMS } from './HomePage.jsx';
import { EXTENSION_REPO_URL, HOW_IT_WORKS_STEPS } from '@/constants.js';

// A punchier two-tone gradient reserved for this marketing page's primary
// CTAs, distinct from the flat amber `.btn-primary` used everywhere else in
// the app — gives the landing page its own "dashing" identity.
const BRAND_GRADIENT = 'linear-gradient(135deg, #f5a623 0%, #ec4899 100%)';

const FEATURES = [
  { icon: '⚡', title: 'Frame-perfect sync', desc: 'Play, pause and seek stay in lock-step for everyone in the room.' },
  { icon: '🎙️', title: 'Built-in voice & video', desc: 'Discord-style voice rooms and video calls so you can talk while you watch.' },
  { icon: '💬', title: 'Live chat & reactions', desc: 'WhatsApp-style chat with emoji reactions that float on your screen.' },
  { icon: '🌈', title: 'Everyone gets a color', desc: 'Names, avatars and chat bubbles are color-coded per person, so it\'s always easy to tell who\'s who.' },
];

const CHAT_PREVIEW = [
  { name: 'Ava', color: '#f5a623', msg: 'okay starting it now 🍿' },
  { name: 'Sam', color: '#3b82f6', msg: 'lfg' },
  { name: 'Kai', color: '#22d3a0', msg: '😂😂😂' },
];

function GradientButton({ as: As = 'button', className = '', children, ...props }) {
  return (
    <As
      className={`inline-flex items-center justify-center font-display font-semibold text-void
                  rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${className}`}
      style={{ background: BRAND_GRADIENT, boxShadow: '0 8px 24px -8px rgba(236,72,153,0.5)' }}
      {...props}
    >
      {children}
    </As>
  );
}

// ── Browser-window mockup pieces, built from CSS — not a real screenshot ──
function BrowserFrame({ children, url = 'watchparty.app' }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-surface shadow-2xl">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-raised border-b border-border">
        <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-online/70" />
        <span className="ml-3 text-[10px] font-mono text-dim truncate">{url}</span>
      </div>
      {children}
    </div>
  );
}

function HeroMockup() {
  return (
    <BrowserFrame url="netflix.com/watch/•••">
      <div className="flex bg-void">
        <div className="flex-1 aspect-video relative flex items-center justify-center bg-gradient-to-br from-raised to-void">
          <button className="w-14 h-14 rounded-full bg-amber/90 flex items-center justify-center shadow-glow-amber animate-ring-pulse">
            <span className="text-void text-xl ml-0.5">▶</span>
          </button>
        </div>
        <div className="w-[124px] sm:w-[150px] shrink-0 bg-surface border-l border-border p-2 flex flex-col gap-2">
          <span className="text-[9px] font-mono text-dim uppercase tracking-widest px-0.5">Live chat</span>
          {CHAT_PREVIEW.map((m) => (
            <div key={m.name} className="text-[9px] sm:text-[10px] leading-snug">
              <span className="font-semibold" style={{ color: m.color }}>{m.name}</span>
              <div className="rounded-lg px-1.5 py-1 mt-0.5 border" style={{ background: `${m.color}18`, borderColor: `${m.color}40`, color: '#eef2fc' }}>
                {m.msg}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function StepMockup({ index }) {
  if (index === 0) {
    return (
      <div className="aspect-video rounded-lg bg-raised border border-border flex flex-col items-center justify-center gap-3">
        <div className="text-4xl">🧩</div>
        <span className="inline-flex items-center gap-1.5 text-online text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-online" /> Extension installed
        </span>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="aspect-video rounded-lg bg-raised border border-border p-5 flex flex-col justify-center gap-2">
        <span className="text-[10px] font-mono text-dim uppercase tracking-widest">Room Code</span>
        <span className="font-mono text-3xl font-bold tracking-widest" style={{ backgroundImage: BRAND_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          8K3P2X
        </span>
        <span className="inline-flex items-center gap-1.5 text-online text-[10px] font-mono w-fit mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-online animate-pulse-dot" /> SYNCED
        </span>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="aspect-video rounded-lg bg-raised border border-border flex flex-col items-center justify-center gap-3">
        <div className="flex items-center">
          {CHAT_PREVIEW.map((m, i) => (
            <div
              key={m.name}
              className="w-9 h-9 rounded-full border-2 border-surface flex items-center justify-center text-xs font-display font-semibold text-void"
              style={{ background: m.color, marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }}
            >
              {m.name[0]}
            </div>
          ))}
        </div>
        <span className="text-dim text-xs">Invite link copied ✓</span>
      </div>
    );
  }
  return <HeroMockup />;
}

// ── Interactive "how it works" — click a step, preview updates ──
function HowItWorks() {
  const [active, setActive] = useState(0);
  const step = HOW_IT_WORKS_STEPS[active];

  return (
    <div id="how-it-works" className="w-full max-w-5xl mb-16 scroll-mt-24 animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <h2 className="font-display font-bold text-2xl sm:text-3xl text-bright text-center mb-8">
        How <span className="text-gradient">WatchParty</span> works
      </h2>
      <div className="grid md:grid-cols-[1fr_1.4fr] gap-8 items-center">
        <div className="space-y-1">
          {HOW_IT_WORKS_STEPS.map((s, i) => {
            const isActive = i === active;
            return (
              <button
                key={s.n}
                onClick={() => setActive(i)}
                className={`w-full text-left flex gap-3 px-3 py-3 rounded-lg border-l-2 transition-all
                            ${isActive ? 'bg-raised' : 'border-transparent hover:bg-raised/50'}`}
                style={isActive ? { borderLeftColor: '#ec4899' } : undefined}
              >
                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-display font-bold
                                   ${isActive ? 'text-void' : 'bg-raised border border-border text-dim'}`}
                      style={isActive ? { background: BRAND_GRADIENT } : undefined}>
                  {s.n}
                </span>
                <div>
                  <p className={`font-display font-semibold text-sm ${isActive ? 'text-bright' : 'text-sub'}`}>{s.title}</p>
                  {isActive && <p className="text-dim text-xs leading-relaxed mt-1">{s.desc}</p>}
                </div>
              </button>
            );
          })}
          <a
            href={EXTENSION_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 ml-3"
          >
            <GradientButton as="span" className="text-sm px-5 py-2.5">Get the Extension →</GradientButton>
          </a>
        </div>
        <div className="w-full">
          <StepMockup index={active} />
          <p className="text-dim text-xs text-center mt-3">{step.title}</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen bg-void flex flex-col overflow-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px]
                        opacity-40 blur-[140px] rounded-full"
             style={{ background: 'radial-gradient(ellipse, rgba(245,166,35,0.15) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px]
                        opacity-30 blur-[120px] rounded-full"
             style={{ background: 'radial-gradient(ellipse, rgba(236,72,153,0.12) 0%, transparent 70%)' }} />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between px-6 sm:px-10 py-4
                       max-w-7xl mx-auto w-full bg-void/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🎬</span>
          <span className="font-display font-bold text-xl text-bright">
            Watch<span className="text-gradient">Party</span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-6">
          <a href="#features" className="text-sub text-sm hover:text-bright transition-colors">Features</a>
          <a href="#how-it-works" className="text-sub text-sm hover:text-bright transition-colors">How It Works</a>
          <Link to="/how-to" className="text-sub text-sm hover:text-bright transition-colors">Support</Link>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="btn-ghost text-sm px-4 py-2 border border-border">
            Log In
          </button>
          <a href={EXTENSION_REPO_URL} target="_blank" rel="noopener noreferrer">
            <GradientButton as="span" className="text-sm px-4 py-2">Install Extension</GradientButton>
          </a>
        </div>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 pt-14 pb-24
                        max-w-7xl mx-auto w-full">

        {/* Hero — split layout: pitch on the left, mockup on the right */}
        <div className="grid lg:grid-cols-2 gap-12 items-center w-full mb-20">
          <div className="text-center lg:text-left animate-slide-up">
            <p className="text-dim text-xs font-mono uppercase tracking-[0.2em] mb-4">Watch with friends</p>
            <h1 className="font-display font-extrabold text-5xl sm:text-6xl text-bright leading-[0.98] tracking-tight mb-5">
              A new way to
              <br />
              <span className="text-gradient">watch TV together</span>
            </h1>
            <p className="text-sub text-lg leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
              WatchParty synchronizes video playback and adds live chat, reactions and
              voice/video calls to Netflix, Prime Video, Disney+, YouTube and more.
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <GradientButton onClick={() => navigate('/login')} className="text-base px-8 py-3.5">
                Get WatchParty for free!
              </GradientButton>
            </div>
            <p className="text-dim text-xs mt-4">*Works on Chrome, Edge, and Brave · YouTube works everywhere, no install needed</p>
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <HeroMockup />
          </div>
        </div>

        <HowItWorks />

        {/* Feature cards */}
        <div id="features" className="w-full max-w-4xl mb-16 scroll-mt-24 animate-slide-up" style={{ animationDelay: '0.25s' }}>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-bright text-center mb-8">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="card p-6 text-left hover:border-amber/30 transition-colors duration-300">
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-display font-semibold text-bright text-sm mb-1.5">{title}</h3>
                <p className="text-dim text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Supported platforms */}
        <div className="w-full max-w-4xl mb-16 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <p className="text-dim text-xs font-mono uppercase tracking-widest text-center mb-5">
            Works with
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4">
            {PLATFORMS.map((p) => (
              <div key={p.id} className="h-6 flex items-center opacity-70 hover:opacity-100 transition-opacity">
                {p.logo ? (
                  <img
                    src={p.logo}
                    alt={p.name}
                    className="h-full w-auto object-contain max-w-[100px]"
                    style={{ filter: p.invertLogo ? 'invert(1) brightness(0.95)' : 'brightness(0.95)' }}
                    onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { className: 'font-display font-semibold text-sub text-sm', textContent: p.name })); }}
                  />
                ) : (
                  <span className="font-display font-semibold text-sub text-sm">{p.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center animate-slide-up mb-20" style={{ animationDelay: '0.35s' }}>
          <GradientButton onClick={() => navigate('/login')} className="text-base px-8 py-3.5">
            Start a Watch Party →
          </GradientButton>
          <p className="text-dim text-xs mt-3">Free to join · No credit card required</p>
        </div>

        {/* Footer */}
        <footer className="w-full pt-10 border-t border-border">
          <div className="flex flex-col sm:flex-row justify-between gap-10 sm:gap-6">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🎬</span>
              <span className="font-display font-bold text-bright">
                Watch<span className="text-gradient">Party</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-10 text-sm">
              <div>
                <p className="text-dim text-xs font-mono uppercase tracking-widest mb-2.5">Resources</p>
                <Link to="/how-to" className="block text-sub hover:text-bright transition-colors mb-1.5">How It Works</Link>
                <Link to="/how-to" className="block text-sub hover:text-bright transition-colors">Support</Link>
              </div>
              <div>
                <p className="text-dim text-xs font-mono uppercase tracking-widest mb-2.5">Policies</p>
                <Link to="/privacy" className="block text-sub hover:text-bright transition-colors">Privacy</Link>
              </div>
            </div>
          </div>
          <p className="text-dim text-xs mt-10 mb-6 text-center sm:text-left">© {new Date().getFullYear()} WatchParty</p>
        </footer>
      </main>
    </div>
  );
}
