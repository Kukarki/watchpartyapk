import { useState } from 'react';

const OPTIONS = [
  { count: 2, label: '2 Players', desc: 'You vs 1 bot, opposite corners' },
  { count: 3, label: '3 Players', desc: 'You vs 2 bots' },
  { count: 4, label: '4 Players', desc: 'You vs 3 bots' },
];

export default function SetupScreen({ onStart }) {
  const [starting, setStarting] = useState(false);

  const handleStart = (count) => {
    setStarting(true);
    onStart(count);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.78)' }}>
      <div
        className="text-center px-8 py-10 rounded-2xl space-y-6"
        style={{ background: 'rgba(18,18,18,0.95)', border: '1px solid #333' }}
      >
        <div>
          <div className="text-4xl mb-2">🎲</div>
          <h1 className="text-xl font-bold" style={{ color: '#fff' }}>Ludo 3D</h1>
          <p className="text-sm mt-1" style={{ color: '#999' }}>Choose how many players -- the rest are bots.</p>
        </div>
        <div className="flex gap-3 justify-center">
          {OPTIONS.map((opt) => (
            <button
              key={opt.count}
              disabled={starting}
              onClick={() => handleStart(opt.count)}
              className="px-4 py-3 rounded-xl text-left disabled:opacity-40 active:scale-95 transition-transform"
              style={{ background: '#f5a623', minWidth: 130 }}
            >
              <div className="font-bold text-sm" style={{ color: '#0a0a0a' }}>{opt.label}</div>
              <div className="text-[11px] mt-1" style={{ color: '#4a3a10' }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
