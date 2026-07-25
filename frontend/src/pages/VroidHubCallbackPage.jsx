import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { vroidHubApi } from '@/api/vroidHub.api.js';
import toast from 'react-hot-toast';

export default function VroidHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const err  = searchParams.get('error');

    if (err) {
      setError(err === 'access_denied' ? 'You declined the VRoid Hub connection.' : 'VRoid Hub sign-in failed.');
      setTimeout(() => navigate('/avatar-closet'), 2500);
      return;
    }
    if (!code) {
      setError('Missing authorization code.');
      setTimeout(() => navigate('/avatar-closet'), 2500);
      return;
    }

    vroidHubApi.submitCallback(code)
      .then(() => {
        toast.success('VRoid Hub connected!');
        navigate('/avatar-closet', { replace: true });
      })
      .catch((e) => {
        setError(e.response?.data?.error || 'Could not connect VRoid Hub.');
        setTimeout(() => navigate('/avatar-closet'), 2500);
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
            <div className="text-4xl">🧑‍🎨</div>
            <p className="text-sub text-sm font-mono">Connecting your VRoid Hub account...</p>
            <div className="flex gap-2 justify-center">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
