import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const PLATFORMS = [
  {
    id: 'primevideo',
    name: 'Prime Video',
    logo: '/logos/primevideo.svg',
    borderColor: '#00A8E1',
    glowColor: 'rgba(0,168,225,0.15)',
    bgFrom: 'rgba(0,168,225,0.08)',
    bgTo: 'rgba(0,48,135,0.08)',
    dot: '#00A8E1',
    url: 'https://www.primevideo.com',
    signupUrl: 'https://www.amazon.com/amazonprime',
    description: 'Thousands of movies & shows',
    invertLogo: false,
  },
  {
    id: 'netflix',
    name: 'Netflix',
    logo: '/logos/netflix.svg',
    borderColor: '#E50914',
    glowColor: 'rgba(229,9,20,0.15)',
    bgFrom: 'rgba(229,9,20,0.08)',
    bgTo: 'rgba(131,16,16,0.08)',
    dot: '#E50914',
    url: 'https://www.netflix.com',
    signupUrl: 'https://www.netflix.com/signup',
    description: 'Award-winning series & films',
    invertLogo: false,
  },
  {
    id: 'disneyplus',
    name: 'Disney+',
    logo: '/logos/disneyplus.svg',
    borderColor: '#0063E5',
    glowColor: 'rgba(0,99,229,0.15)',
    bgFrom: 'rgba(0,99,229,0.08)',
    bgTo: 'rgba(4,7,20,0.3)',
    dot: '#0063E5',
    url: 'https://www.disneyplus.com',
    signupUrl: 'https://www.disneyplus.com/welcome',
    description: 'Disney, Marvel, Star Wars & more',
    invertLogo: false,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    logo: '/logos/youtube.svg',
    borderColor: '#FF0000',
    glowColor: 'rgba(255,0,0,0.15)',
    bgFrom: 'rgba(255,0,0,0.08)',
    bgTo: 'rgba(40,40,40,0.3)',
    dot: '#FF0000',
    url: 'https://www.youtube.com',
    signupUrl: 'https://www.youtube.com',
    description: 'Free videos, no subscription',
    invertLogo: false,
  },
  {
    id: 'max',
    name: 'Max',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg',
    borderColor: '#002BE7',
    glowColor: 'rgba(0,43,231,0.15)',
    bgFrom: 'rgba(0,43,231,0.08)',
    bgTo: 'rgba(0,7,61,0.3)',
    dot: '#002BE7',
    url: 'https://www.max.com',
    signupUrl: 'https://www.max.com/plans',
    description: 'HBO originals & blockbusters',
    invertLogo: true,
  },
  {
    id: 'appletv',
    name: 'Apple TV+',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    borderColor: '#555555',
    glowColor: 'rgba(255,255,255,0.08)',
    bgFrom: 'rgba(255,255,255,0.05)',
    bgTo: 'rgba(255,255,255,0.01)',
    dot: '#ffffff',
    url: 'https://tv.apple.com',
    signupUrl: 'https://tv.apple.com',
    description: 'Apple originals & exclusives',
    invertLogo: true,
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [imgErrors, setImgErrors] = useState({});
  const [hovered, setHovered] = useState(null);

  const handlePlatformClick = (platformId) => {
    navigate(`/platform/${platformId}`);
  };

  const handleImgError = (id) => {
    setImgErrors((prev) => ({ ...prev, [id]: true }));
  };

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
          <button
            onClick={() => navigate('/join')}
            className="btn-ghost text-sm px-4 py-2 border border-border"
          >
            Join Room
          </button>
          <button
            onClick={() => navigate(isAuthenticated ? '/lobby' : '/join')}
            className="btn-primary text-sm"
          >
            {isAuthenticated ? 'My Rooms →' : 'Get Started →'}
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

        <p className="text-sub text-center text-lg sm:text-xl max-w-2xl leading-relaxed mb-5
                       animate-slide-up"
           style={{ animationDelay: '0.1s' }}>
          Pick your streaming service, create a room, and invite friends.
          Everyone's playback stays in perfect sync — automatically.
        </p>

        {/* How it works */}
        <div className="flex flex-wrap justify-center items-center gap-2 text-xs
                         text-dim font-mono mb-12 animate-fade-in"
             style={{ animationDelay: '0.15s' }}>
          {['Pick a platform', 'Install extension (once)', 'Create a room', 'Invite friends', 'Watch together']
            .map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span className="text-amber font-bold">{i + 1}</span>
                <span>{step}</span>
                {i < 4 && <span className="text-border">→</span>}
              </span>
            ))}
        </div>

        {/* Platform grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-4xl mb-16
                         animate-slide-up"
             style={{ animationDelay: '0.2s' }}>
          {PLATFORMS.map((platform) => (
            <div
              key={platform.id}
              onClick={() => handlePlatformClick(platform.id)}
              onMouseEnter={() => setHovered(platform.id)}
              onMouseLeave={() => setHovered(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handlePlatformClick(platform.id)}
              className="relative group p-6 text-left flex flex-col gap-4
                           rounded-xl border cursor-pointer
                           transition-all duration-300
                           hover:-translate-y-1 active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${platform.bgFrom}, ${platform.bgTo})`,
                borderColor: hovered === platform.id ? platform.borderColor : 'rgba(30,36,51,1)',
                boxShadow: hovered === platform.id ? `0 0 32px ${platform.glowColor}` : 'none',
              }}
            >
              {/* Logo */}
              <div className="h-8 flex items-center">
                {imgErrors[platform.id] ? (
                  <span className="font-display font-bold text-bright text-base">
                    {platform.name}
                  </span>
                ) : (
                  <img
                    src={platform.logo}
                    alt={platform.name}
                    className="h-full w-auto object-contain max-w-[130px] transition-all duration-300"
                    style={{
                      filter: platform.invertLogo ? 'invert(1) brightness(0.9)' : 'brightness(0.9)',
                      ...(hovered === platform.id && {
                        filter: platform.invertLogo ? 'invert(1) brightness(1.1)' : 'brightness(1.1)',
                      }),
                    }}
                    onError={() => handleImgError(platform.id)}
                  />
                )}
              </div>

              {/* Description */}
              <p className="text-dim text-xs leading-relaxed hidden sm:block">
                {platform.description}
              </p>

              {/* Bottom row */}
              <div className="flex items-center justify-between mt-auto">
                <span className="w-2 h-2 rounded-full opacity-60"
                      style={{ backgroundColor: platform.dot }} />
                <span className="text-xs text-dim group-hover:text-sub
                                  transition-colors flex items-center gap-1">
                  Watch together
                  <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl animate-slide-up"
             style={{ animationDelay: '0.3s' }}>
          {[
            { icon: '⚡', title: 'Frame-perfect sync', desc: 'Play, pause and seek stay in lock-step for everyone in the room.' },
            { icon: '💬', title: 'Live chat & reactions', desc: 'WhatsApp-style chat with emoji reactions that float on your screen.' },
            { icon: '🎙️', title: 'Built-in voice', desc: 'Discord-style voice rooms so you can talk while you watch.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="card p-6 text-left hover:border-amber/30 transition-colors duration-300">
              <div className="text-2xl mb-3">{icon}</div>
              <h3 className="font-display font-semibold text-bright text-sm mb-1.5">{title}</h3>
              <p className="text-dim text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}