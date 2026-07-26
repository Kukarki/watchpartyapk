import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';

// react-three-fiber/drei/rapier/postprocessing are a heavy bundle — keep them
// out of every other route via the same lazy()+Suspense pattern already used
// for the VRM avatar viewer (see AvatarClosetPage.jsx / VrmViewer.jsx).
const Ludo3DApp = lazy(() => import('@/games/ludo3d/components/Ludo3DApp.jsx'));

export default function Ludo3DPage() {
  const navigate = useNavigate();

  return (
    <div className="h-[100dvh] w-full bg-void relative overflow-hidden">
      <button
        onClick={() => navigate('/games')}
        className="absolute top-4 left-4 z-20 btn-ghost text-xs px-3 py-1.5
                   border border-border bg-surface/80 backdrop-blur-md"
      >
        ← Back to Games
      </button>

      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-3 animate-fade-in">
              <div className="text-4xl">🎲</div>
              <p className="text-sub font-mono text-sm">Loading the table…</p>
            </div>
          </div>
        }
      >
        <Ludo3DApp />
      </Suspense>
    </div>
  );
}
