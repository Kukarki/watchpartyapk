import { useState, useEffect, useCallback } from 'react';
import { youtubeApi } from '@/api/youtube.api.js';

// Reusable "search for a song, add it" panel — used in the Music Room queue
// and on playlist pages. Search itself needs no YouTube account connection,
// just the server's YouTube Data API key.
export default function MusicSearch({ onAdd, addedIds = new Set() }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { results } = await youtubeApi.search(q.trim());
      setResults(results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  return (
    <div>
      <input
        className="input-base text-sm mb-2"
        placeholder="Search for a song…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {searching && <p className="text-dim text-xs px-1 mb-1">Searching…</p>}
      {results.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {results.map((r) => {
            const added = addedIds.has(r.videoId);
            return (
              <div key={r.videoId} className="flex items-center gap-2 p-2 rounded-lg hover:bg-raised">
                {r.thumbnail && <img src={r.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-bright truncate">{r.title}</p>
                  <p className="text-[10px] text-dim truncate">{r.channel}</p>
                </div>
                <button
                  onClick={() => onAdd(r)}
                  disabled={added}
                  className="btn-primary text-[10px] px-2 py-1 shrink-0 disabled:opacity-40"
                >
                  {added ? '✓' : '+ Add'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
