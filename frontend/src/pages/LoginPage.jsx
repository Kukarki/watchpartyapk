import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { userApi } from '@/api/user.api.js';
import { useAuthStore } from '@/store/authStore.js';

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     || '';
const SUPABASE_ANON    = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const GOOGLE_AVAILABLE = !!(SUPABASE_URL && SUPABASE_ANON);

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [mode,        setMode]        = useState('login');
  const [displayName, setDisplayName] = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [dobDay,   setDobDay]   = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear,  setDobYear]  = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [info,        setInfo]        = useState('');

  const handleEmail = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Fill in all fields'); return; }
    setLoading(true);
    try {
      let data;
      if (mode === 'register') {
        if (!displayName.trim()) { setError('Enter your name'); setLoading(false); return; }
        const builtDob = (dobYear && dobMonth && dobDay)
          ? `${dobYear}-${String(dobMonth).padStart(2,'0')}-${String(dobDay).padStart(2,'0')}` : '';
        if (!builtDob) { setError('Select your date of birth'); setLoading(false); return; }
        const ageYears = (Date.now() - new Date(builtDob).getTime()) / (365.25*24*60*60*1000);
        if (ageYears < 18) { setError('You must be 18 or older to sign up'); setLoading(false); return; }
        data = await userApi.register(displayName.trim(), email, password, builtDob);
        if (data.pendingConfirmation) {
          setError('');
          setInfo(data.message || 'Check your email to confirm your account, then sign in.');
          setMode('login');
          setLoading(false);
          return;
        }
      } else {
        data = await userApi.login(email, password);
      }
      setAuth(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    if (!GOOGLE_AVAILABLE) {
      setError('Google login not configured. Use email.');
      return;
    }
    const redirectUrl = `${window.location.origin}/auth/callback`;
    window.location.href =
      `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
      `&redirect_to=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[700px] h-[500px] opacity-20 blur-[120px] rounded-full"
             style={{ background: 'radial-gradient(ellipse, rgba(245,166,35,0.4) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <Link to="/" className="text-4xl block mb-2">🎬</Link>
          <h1 className="font-display font-bold text-2xl text-bright">
            Watch<span className="text-gradient">Party</span>
          </h1>
          <p className="text-sub text-sm mt-1">Sign in to create or join a room</p>
        </div>

        <div className="flex gap-1 p-1 bg-raised border border-border rounded-xl mb-6">
          {[
            { id: 'login',    label: '📧 Sign In' },
            { id: 'register', label: '✨ Register' },
          ].map((tab) => (
            <button key={tab.id}
                    onClick={() => { setMode(tab.id); setError(''); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold
                                 transition-all duration-150
                                 ${mode === tab.id
                                   ? 'bg-amber text-void shadow-glow-sm'
                                   : 'text-dim hover:text-sub'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="card p-6">
          <form onSubmit={handleEmail} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sub text-xs font-mono uppercase
                                   tracking-widest mb-2">Display Name</label>
                <input className="input-base" placeholder="e.g. MovieNerd42"
                       value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                       maxLength={30} autoFocus disabled={loading} />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sub text-xs font-mono uppercase
                                   tracking-widest mb-2">Date of Birth · must be 18+</label>
                <div className="grid grid-cols-3 gap-2">
                  <select className="input-base" disabled={loading}
                    value={dobDay} onChange={(e) => setDobDay(e.target.value)}>
                    <option value="">Day</option>
                    {Array.from({length:31},(_,i)=>i+1).map(d=>(
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select className="input-base" disabled={loading}
                    value={dobMonth} onChange={(e) => setDobMonth(e.target.value)}>
                    <option value="">Month</option>
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i)=>(
                      <option key={m} value={i+1}>{m}</option>
                    ))}
                  </select>
                  <select className="input-base" disabled={loading}
                    value={dobYear} onChange={(e) => setDobYear(e.target.value)}>
                    <option value="">Year</option>
                    {Array.from({length:100},(_,i)=>new Date().getFullYear()-18-i).map(y=>(
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sub text-xs font-mono uppercase
                                 tracking-widest mb-2">Email</label>
              <input type="email" className="input-base" placeholder="you@example.com"
                     value={email} onChange={(e) => setEmail(e.target.value)}
                     autoFocus={mode === 'login'} disabled={loading} />
            </div>

            <div>
              <label className="block text-sub text-xs font-mono uppercase
                                 tracking-widest mb-2">Password</label>
              <input type="password" className="input-base"
                     placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
                     value={password} onChange={(e) => setPassword(e.target.value)}
                     disabled={loading} />
            </div>

            {info && (
              <p className="text-online text-xs bg-online/10 border border-online/20
                             rounded-lg px-3 py-2">{info}</p>
            )}
            {error && <ErrorMsg>{error}</ErrorMsg>}

            <button type="submit"
                    disabled={loading || !email || !password}
                    className="btn-primary w-full justify-center py-3
                                disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? '...' : mode === 'register' ? 'Create Account →' : 'Sign In →'}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-dim text-xs">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button type="button" onClick={handleGoogle}
                    className="w-full flex items-center justify-center gap-3 py-2.5
                               bg-raised border border-border rounded-xl text-sm text-bright
                               hover:border-amber/30 transition-colors duration-150">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
              {!GOOGLE_AVAILABLE && (
                <span className="text-dim text-xs">(not configured)</span>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-dim text-xs mt-4">
          <Link to="/" className="hover:text-sub transition-colors">← Back to home</Link>
        </p>
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
