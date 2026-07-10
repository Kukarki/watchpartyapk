import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { youtubeApi } from '@/api/youtube.api.js';
import toast from 'react-hot-toast';

export default function YouTubeCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const err  = searchParams.get('error');

    if (err) {
      setError(err === 'access_denied' ? 'You declined the Google connection.' : 'Google sign-in failed.');
      setTimeout(() => navigate('/music'), 2500);
      return;
    }
    if (!code) {
      setError('Missing authorization code.');
      setTimeout(() => navigate('/music'), 2500);
      return;
    }

    youtubeApi.submitCallback(code)
      .then(() => {
        toast.success('YouTube connected!');
        navigate('/music', { replace: true });
      })
      .catch((e) => {
        setError(e.response?.data?.error || 'Could not connect YouTube.');
        setTimeout(() => navigate('/music'), 3500);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-4">
      <div className="text-center space-y-4 animate-fade-in">
        {error ? (
          <>
            <div className="text-4xl">❌</div>
            <p className="text-danger text-sm max-w-sm">{error}</p>
            <p className="text-dim text-xs">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="text-4xl">▶️</div>
            <p className="text-sub text-sm font-mono">Connecting your YouTube account...</p>
            <div className="flex gap-2 justify-center">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
