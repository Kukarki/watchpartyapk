import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore.js';
import { userApi } from '@/api/user.api.js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL     || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { setAuth }    = useAuthStore();
  const [error, setError] = useState('');
  const [needAge, setNeedAge] = useState(false);
  const [dob, setDob]     = useState('');
  const [busy, setBusy]   = useState(false);

  useEffect(() => { handleCallback(); }, []);

  async function finishLogin(token, user, ageVerified) {
    setAuth(token, user);
    if (!ageVerified) {
      setNeedAge(true);          // show DOB form, don't navigate yet
    } else {
      navigate('/', { replace: true });
    }
  }

  async function handleCallback() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.slice(1));
      const accessToken = params.get('access_token');
      if (accessToken && SUPABASE_URL && SUPABASE_ANON) {
        try {
          const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON },
          });
          const sbUser = await res.json();
          if (sbUser.id) {
            const apiRes = await fetch(
              `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/supabase-callback`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  supabaseToken: accessToken,
                  displayName: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User',
                  avatar: sbUser.user_metadata?.avatar_url || '',
                }),
              }
            );
            const data = await apiRes.json();
            if (data.token) {
              await finishLogin(data.token, data.user, data.ageVerified);
              return;
            }
          }
        } catch (err) {
          console.error('Supabase callback error:', err);
        }
      }
    }

    const token = searchParams.get('token');
    const err   = searchParams.get('error');
    if (err) { setError('Sign-in failed. Please try again.'); setTimeout(() => navigate('/login'), 3000); return; }
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        await finishLogin(token, {
          userId: payload.userId, displayName: payload.displayName, avatar: payload.avatar,
          email: payload.email, provider: payload.provider, role: payload.role,
        }, payload.ageVerified);
        return;
      } catch {
        setError('Invalid token. Please try again.'); setTimeout(() => navigate('/login'), 3000); return;
      }
    }
    setError('Authentication failed. Please try again.');
    setTimeout(() => navigate('/login'), 3000);
  }

  async function submitAge(e) {
    e.preventDefault();
    setError('');
    if (!dob) { setError('Enter your date of birth'); return; }
    const ageYears = (Date.now() - new Date(dob).getTime()) / (365.25*24*60*60*1000);
    if (ageYears < 18) { setError('You must be 18 or older to use WatchParty'); return; }
    setBusy(true);
    try {
      await userApi.verifyAge(dob);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not verify age');
      setBusy(false);
    }
  }

  if (needAge) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-4">
        <div className="w-full max-w-sm card p-6 space-y-4 animate-slide-up">
          <div className="text-center">
            <div className="text-3xl mb-2">🔞</div>
            <h2 className="text-bright font-bold text-lg">One more step</h2>
            <p className="text-sub text-sm mt-1">Confirm your date of birth · must be 18+</p>
          </div>
          <form onSubmit={submitAge} className="space-y-4">
            <input type="date" className="input-base"
                   value={dob} onChange={(e) => setDob(e.target.value)}
                   max={new Date().toISOString().slice(0,10)} disabled={busy} />
            {error && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={busy || !dob}
                    className="btn-primary w-full justify-center py-3 disabled:opacity-40">
              {busy ? 'Verifying...' : 'Confirm →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-in">
        {error ? (
          <>
            <div className="text-4xl">❌</div>
            <p className="text-danger text-sm">{error}</p>
            <p className="text-dim text-xs">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="text-4xl">🎬</div>
            <p className="text-sub text-sm font-mono">Signing you in...</p>
            <div className="flex gap-2 justify-center">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
