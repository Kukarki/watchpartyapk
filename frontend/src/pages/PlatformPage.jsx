import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useAuthStore } from '@/store/authStore.js';
import { roomApi } from '@/api/room.api.js';
import { PLATFORMS } from './HomePage.jsx';

const API_BASE  = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const SERVER_URL = API_BASE.replace('/api/v1', '');

// Platforms whose videos can be embedded via IFrame — no browser extension required
const EMBEDDABLE = ['youtube'];

export default function PlatformPage() {
  const { platformId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, guestLogin, user } = useAuth();
  const { token } = useAuthStore();

  const platform      = PLATFORMS.find((p) => p.id === platformId);
  const needsExtension = platform ? !EMBEDDABLE.includes(platform.id) : true;

  const [step, setStep]               = useState('init');   // init|auth|ready|launching|launched|no-ext
  const [displayName, setDisplayName] = useState('');
  const [roomId, setRoomId]           = useState(null);
  const [copied, setCopied]           = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const inputRef                      = useRef(null);

  const extensionPresent = !!window.__WATCHPARTY_EXTENSION__;

  useEffect(() => {
    if (!platform) navigate('/', { replace: true });
  }, [platformId]);

  useEffect(() => {
    if (!platform) return;
    setStep(isAuthenticated ? 'ready' : 'auth');
  }, [isAuthenticated, platform]);

  useEffect(() => {
    if (step === 'auth') inputRef.current?.focus();
  }, [step]);

  if (!platform) return null;

  // ── Guest login ────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) { setError('Enter your name'); return; }
    setLoading(true);
    setError('');
    try {
      await guestLogin(name);
      setStep('ready');
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // ── Start watching ─────────────────────────────────────────
  const handleStart = async () => {
    setLoading(true);
    setError('');
    setStep('launching');
    try {
      const { room } = await roomApi.createRoom({
        name: `${platform.name} Watch Party`,
      });

      if (!needsExtension) {
        // YouTube (and other embeddable platforms): go straight to the room.
        // The IFrame player will load when the user pastes a video URL.
        navigate(`/room/${room.id}`);
        return;
      }

      if (extensionPresent) {
        // Tell the extension to open the streaming platform in a new tab,
        // storing roomId + auth so content-main.js can connect automatically.
        window.postMessage({
          type:        'WATCHPARTY_LAUNCH',
          roomId:      room.id,
          platformId:  platform.id,
          platformUrl: platform.url,
          token,
          user,
          serverUrl:   SERVER_URL,
        }, '*');
        setRoomId(room.id);
        setStep('launched');
      } else {
        // No extension installed — show room code + install instructions
        setRoomId(room.id);
        setStep('no-ext');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room');
      setStep('ready');
    } finally {
      setLoading(false);
    }
  };

  const inviteUrl = `${window.location.origin}/join/${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[600px] h-[400px] opacity-20 blur-[120px] rounded-full"
             style={{ background: `radial-gradient(ellipse, ${platform.glowColor} 0%, transparent 70%)` }} />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-slide-up">

        {/* Back */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-dim text-xs
                                  hover:text-sub transition-colors mb-6">
          ← Back to home
        </Link>

        {/* Platform header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-border bg-raised">
            <span className="text-lg" style={{ color: platform.borderColor }}>▶</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-bright">{platform.name}</h1>
            <p className="text-dim text-xs">Watch together in sync</p>
          </div>
        </div>

        <div className="card p-6 space-y-4">

          {/* ── Auth step ── */}
          {step === 'auth' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <p className="text-bright text-sm font-medium mb-1">Enter your name to continue</p>
                <p className="text-dim text-xs mb-4">No account required — guest access is free</p>
                <label className="block text-sub text-xs font-mono uppercase tracking-widest mb-2">
                  Display Name
                </label>
                <input
                  ref={inputRef}
                  className="input-base"
                  placeholder="e.g. MovieNerd42"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  disabled={loading}
                />
              </div>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button
                type="submit"
                disabled={loading || !displayName.trim()}
                className="btn-primary w-full justify-center py-3
                            disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Setting up...' : 'Continue →'}
              </button>
            </form>
          )}

          {/* ── Ready step ── */}
          {step === 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <img src={user?.avatar} alt="" className="w-8 h-8 rounded-full border border-border" />
                <div>
                  <p className="text-bright text-sm font-medium">{user?.displayName}</p>
                  <p className="text-dim text-xs">Ready to watch</p>
                </div>
              </div>

              {/* YouTube — no extension needed */}
              {!needsExtension && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl
                                 bg-online/10 border border-online/20">
                  <span className="text-online text-base shrink-0 mt-0.5">✓</span>
                  <div>
                    <p className="text-online text-xs font-semibold mb-0.5">Works in any browser</p>
                    <p className="text-dim text-xs leading-relaxed">
                      YouTube videos are embedded directly — no extension required.
                      Create a room and paste any YouTube URL to start watching together.
                    </p>
                  </div>
                </div>
              )}

              {/* DRM platforms — extension status */}
              {needsExtension && !extensionPresent && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl
                                 bg-amber/5 border border-amber/20">
                  <span className="text-amber text-base shrink-0 mt-0.5">⚡</span>
                  <div>
                    <p className="text-amber text-xs font-semibold mb-0.5">Extension not detected</p>
                    <p className="text-dim text-xs leading-relaxed">
                      {platform.name} requires the WatchParty extension to sync playback.
                      You can still create a room and share the code.
                    </p>
                  </div>
                </div>
              )}

              {needsExtension && extensionPresent && (
                <div className="flex items-center gap-2 p-3 rounded-xl
                                 bg-online/10 border border-online/20">
                  <span className="w-2 h-2 rounded-full bg-online shrink-0" />
                  <p className="text-xs text-sub">WatchParty extension detected — sync ready</p>
                </div>
              )}

              {error && <ErrorMsg>{error}</ErrorMsg>}

              <button
                onClick={handleStart}
                className="btn-primary w-full justify-center py-3"
              >
                {needsExtension
                  ? `Start Watching on ${platform.name} →`
                  : 'Create Watch Room →'}
              </button>
            </div>
          )}

          {/* ── Launching ── */}
          {step === 'launching' && (
            <div className="flex items-center justify-center py-6 gap-3">
              <div className="w-5 h-5 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
              <p className="text-sub text-sm">Creating room…</p>
            </div>
          )}

          {/* ── Launched (extension present) ── */}
          {step === 'launched' && roomId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl
                               bg-online/10 border border-online/20">
                <span className="text-online text-base">✓</span>
                <p className="text-xs text-sub">
                  {platform.name} is opening with the WatchParty overlay
                </p>
              </div>

              <div className="p-4 rounded-xl bg-raised border border-border space-y-2">
                <p className="text-sub text-xs font-mono uppercase tracking-widest">Room Code</p>
                <p className="font-mono text-2xl font-bold text-amber tracking-widest">{roomId}</p>
                <p className="text-dim text-xs">Share this with friends so they can join</p>
              </div>

              <button
                onClick={handleCopy}
                className="btn-primary w-full justify-center py-2.5"
              >
                {copied ? '✓ Copied!' : '🔗 Copy Invite Link'}
              </button>

              <button
                onClick={() => navigate(`/room/${roomId}`)}
                className="btn-ghost w-full justify-center py-2 text-sm border border-border"
              >
                Open Room Dashboard →
              </button>
            </div>
          )}

          {/* ── No extension ── */}
          {step === 'no-ext' && roomId && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-raised border border-border space-y-2">
                <p className="text-sub text-xs font-mono uppercase tracking-widest">Room Code</p>
                <p className="font-mono text-2xl font-bold text-amber tracking-widest">{roomId}</p>
              </div>

              <div className="p-3 rounded-xl bg-amber/5 border border-amber/20 space-y-2">
                <p className="text-amber text-xs font-semibold">Install extension for sync</p>
                <p className="text-dim text-xs leading-relaxed">
                  The WatchParty extension syncs everyone's playback automatically.
                  Load it in Chrome via <span className="font-mono text-sub">chrome://extensions</span> →
                  Developer mode → Load unpacked → select the{' '}
                  <span className="font-mono text-sub">extension/</span> folder.
                </p>
              </div>

              <button
                onClick={handleCopy}
                className="btn-primary w-full justify-center py-2.5"
              >
                {copied ? '✓ Copied!' : '🔗 Copy Invite Link'}
              </button>

              <button
                onClick={() => navigate(`/room/${roomId}`)}
                className="btn-ghost w-full justify-center py-2 text-sm border border-border"
              >
                Open Room Dashboard →
              </button>
            </div>
          )}
        </div>

        {/* Switch account */}
        {(step === 'ready' || step === 'launched' || step === 'no-ext') && (
          <p className="text-center text-dim text-xs mt-4">
            Not {user?.displayName}?{' '}
            <button
              onClick={() => { setStep('auth'); setDisplayName(''); }}
              className="text-sub hover:text-bright underline underline-offset-2"
            >
              Change name
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function ErrorMsg({ children }) {
  return (
    <p className="text-danger text-xs bg-danger/10 border border-danger/20
                   rounded-lg px-3 py-2">{children}</p>
  );
}
