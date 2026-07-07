import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore.js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL     || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * AuthCallbackPage
 * Handles two cases:
 * 1. Supabase Google OAuth redirect  → URL has #access_token=...
 * 2. Backend OAuth redirect          → URL has ?token=JWT
 */
export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { setAuth }    = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    // ── Case 1: Supabase OAuth (hash fragment) ────────────
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.slice(1));
      const accessToken = params.get('access_token');

      if (accessToken && SUPABASE_URL && SUPABASE_ANON) {
        try {
          // Get user info from Supabase
          const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const sbUser = await res.json();

          if (sbUser.id) {
            // Exchange Supabase token for our JWT
            const apiRes = await fetch(
              `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/auth/supabase-callback`,
              {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                  supabaseToken: accessToken,
                  userId:        sbUser.id,
                  email:         sbUser.email,
                  displayName:   sbUser.user_metadata?.full_name ||
                                 sbUser.email?.split('@')[0] || 'User',
                  avatar:        sbUser.user_metadata?.avatar_url || '',
                }),
              }
            );
            const data = await apiRes.json();
            if (data.token) {
              setAuth(data.token, data.user);
              navigate('/lobby', { replace: true });
              return;
            }
          }
        } catch (err) {
          console.error('Supabase callback error:', err);
        }
      }
    }

    // ── Case 2: Backend JWT redirect ─────────────────────
    const token = searchParams.get('token');
    const err   = searchParams.get('error');

    if (err) {
      setError('Sign-in failed. Please try again.');
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setAuth(token, {
          userId:      payload.userId,
          displayName: payload.displayName,
          avatar:      payload.avatar,
          email:       payload.email,
          provider:    payload.provider,
          role:        payload.role,
        });
        navigate('/lobby', { replace: true });
        return;
      } catch {
        setError('Invalid token. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }
    }

    // Nothing matched
    setError('Authentication failed. Please try again.');
    setTimeout(() => navigate('/login'), 3000);
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
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}