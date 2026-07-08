import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

const STEPS = ['Pick a platform', 'Create a room', 'Invite friends', 'Watch together'];

const FEATURES = [
  { icon: '⚡', title: 'Frame-perfect sync', desc: 'Play, pause and seek stay in lock-step for everyone in the room.' },
  { icon: '🎙️', title: 'Built-in voice & video', desc: 'Discord-style voice rooms and video calls so you can talk while you watch.' },
  { icon: '💬', title: 'Live chat & reactions', desc: 'WhatsApp-style chat with emoji reactions that float on your screen.' },
];

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
             style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.15) 0%, transparent 70%)' }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5
                       max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🎬</span>
          <span className="font-display font-bold text-xl text-bright">
            Watch<span className="text-gradient">Party</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="btn-ghost text-sm px-4 py-2 border border-border">
            Sign In
          </button>
          <button onClick={() => navigate('/login')} className="btn-primary text-sm">
            Get Started →
          </button>
        </div>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 pt-10 pb-24
                        max-w-7xl mx-auto w-full">

        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                         bg-amber/10 border border-amber/20 text-amber text-xs font-mono
                         mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
          LIVE · Real-time sync across all devices
        </div>

        {/* Headline */}
        <h1 className="font-display font-extrabold text-center
                        text-5xl sm:text-6xl md:text-7xl
                        text-bright leading-[0.95] tracking-tight mb-5
                        animate-slide-up max-w-4xl"
            style={{ animationDelay: '0.05s' }}>
          Watch together.
          <br />
          <span className="text-gradient">Feel together.</span>
        </h1>

        <p className="text-sub text-center text-lg sm:text-xl max-w-2xl leading-relaxed mb-10
                       animate-slide-up"
           style={{ animationDelay: '0.1s' }}>
          Pick your streaming service, create a room, and invite friends.
          Everyone's playback stays in perfect sync — automatically.
        </p>

        {/* Signature element: a live-feeling mock room card */}
        <div className="w-full max-w-md mb-10 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="card p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-screen-glow pointer-events-none" />
            <div className="relative flex items-center justify-between mb-4">
              <span className="text-xs font-mono text-dim uppercase tracking-widest">Friday Night Movies</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-online">
                <span className="w-1.5 h-1.5 rounded-full bg-online animate-pulse-dot" />
                SYNCED
              </span>
            </div>

            <div className="relative aspect-video rounded-lg bg-raised border border-border mb-4
                             flex items-center justify-center">
              <button className="w-12 h-12 rounded-full bg-amber/90 flex items-center justify-center
                                   shadow-glow-amber animate-ring-pulse">
                <span className="text-void text-lg ml-0.5">▶</span>
              </button>
            </div>

            <div className="relative flex items-center gap-2">
              {['Ava', 'Sam', 'Kai'].map((name, i) => (
                <div
                  key={name}
                  className="w-8 h-8 rounded-full border-2 border-surface bg-amber/20 text-amber
                             flex items-center justify-center text-[11px] font-display font-semibold"
                  style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }}
                >
                  {name[0]}
                </div>
              ))}
              <span className="text-xs text-dim ml-2">3 friends watching now</span>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="flex flex-wrap justify-center items-center gap-2 text-xs
                         text-dim font-mono mb-16 animate-fade-in"
             style={{ animationDelay: '0.2s' }}>
          {STEPS.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="text-amber font-bold">{i + 1}</span>
              <span>{step}</span>
              {i < STEPS.length - 1 && <span className="text-border">→</span>}
            </span>
          ))}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl mb-16 animate-slide-up"
             style={{ animationDelay: '0.25s' }}>
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="card p-6 text-left hover:border-amber/30 transition-colors duration-300">
              <div className="text-2xl mb-3">{icon}</div>
              <h3 className="font-display font-semibold text-bright text-sm mb-1.5">{title}</h3>
              <p className="text-dim text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Final CTA */}
        <div className="text-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <button onClick={() => navigate('/login')} className="btn-primary text-base px-8 py-3">
            Start a Watch Party →
          </button>
          <p className="text-dim text-xs mt-3">Free to join · No credit card required</p>
        </div>
      </main>
    </div>
  );
}
