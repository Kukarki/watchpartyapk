import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { spotifyApi } from '@/api/spotify.api.js';
import toast from 'react-hot-toast';

export default function SpotifyCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const err  = searchParams.get('error');

    if (err) {
      setError(err === 'access_denied' ? 'You declined the Spotify connection.' : 'Spotify sign-in failed.');
      setTimeout(() => navigate('/music'), 2500);
      return;
    }
    if (!code) {
      setError('Missing authorization code.');
      setTimeout(() => navigate('/music'), 2500);
      return;
    }

    spotifyApi.submitCallback(code)
      .then(() => {
        toast.success('Spotify connected!');
        navigate('/music', { replace: true });
      })
      .catch((e) => {
        setError(e.response?.data?.error || 'Could not connect Spotify.');
        setTimeout(() => navigate('/music'), 2500);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-in">
        {error ? (
          <>
            <div className="text-4xl">❌</div>
            <p className="text-danger text-sm">{error}</p>
            <p className="text-dim text-xs">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="text-4xl">🟢</div>
            <p className="text-sub text-sm font-mono">Connecting your Spotify account...</p>
            <div className="flex gap-2 justify-center">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
