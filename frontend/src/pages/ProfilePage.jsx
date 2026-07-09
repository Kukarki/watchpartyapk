import { useState, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore.js';
import { userApi } from '@/api/user.api.js';
import AppShell from '@/components/layout/AppShell.jsx';

const BASE = 'https://api.dicebear.com/8.x/avataaars/svg';

const OPTS = {
  skinColor:  ['edb98a','f8d25c','fd9841','ffdbb4','d08b5b','ae5d29','614335'],
  top:        ['shortFlat','shortRound','shortWaved','theCaesar','bigHair','bob','bun','curly','curvy','dreads','fro','longButNotTooLong','miaWallace','shavedSides','straight01','straight02','hat','hijab','turban','winterHat1'],
  hairColor:  ['2c1b18','724133','a55728','b58143','c93305','d6b370','e8e1e1','ecdcbf','f59797'],
  eyes:       ['default','closed','cry','eyeRoll','happy','hearts','side','squint','surprised','wink','winkWacky','xDizzy'],
  eyebrows:   ['default','angry','flatNatural','raisedExcited','sadConcerned','unibrowNatural','upDown'],
  mouth:      ['default','smile','twinkle','tongue','serious','screamOpen','sad','disbelief','concerned','eating','grimace'],
  facialHair: ['','beardLight','beardMajestic','beardMedium','moustacheFancy','moustacheMagnum'],
  clothing:   ['blazerAndShirt','blazerAndSweater','collarAndSweater','graphicShirt','hoodie','overall','shirtCrewNeck','shirtScoopNeck','shirtVNeck'],
  clothingColor: ['3c4f5c','5199e4','25557c','929598','a7ffc4','b1e2ff','e6e6e6','ff488e','ff5c5c','ffafb9','ffffb1','ffffff','262e33','65c9ff'],
  accessories: ['','kurt','prescription01','prescription02','round','sunglasses','wayfarers'],
};

const LABELS = {
  skinColor: 'Skin', top: 'Hair Style', hairColor: 'Hair Color', eyes: 'Eyes',
  eyebrows: 'Eyebrows', mouth: 'Mouth', facialHair: 'Facial Hair',
  clothing: 'Clothing', clothingColor: 'Clothes Color', accessories: 'Accessories',
};

const isColor = (k) => ['skinColor','hairColor','clothingColor'].includes(k);

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [traits, setTraits] = useState({
    seed: user?.displayName || 'User',
    skinColor: 'edb98a', top: 'shortFlat', hairColor: '724133',
    eyes: 'default', eyebrows: 'default', mouth: 'smile',
    facialHair: '', clothing: 'hoodie', clothingColor: '5199e4', accessories: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Build the DiceBear URL from current traits
  const avatarUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('seed', traits.seed || 'User');
    Object.entries(traits).forEach(([k, v]) => {
      if (k === 'seed') return;
      if (v) params.set(k, v);
    });
    return `${BASE}?${params.toString()}`;
  }, [traits]);

  const setTrait = (k, v) => setTraits((t) => ({ ...t, [k]: v }));

  const handleSave = async () => {
    setError(''); setSaved(false);
    if (!displayName.trim()) { setError('Name cannot be empty'); return; }
    setLoading(true);
    try {
      const data = await userApi.updateProfile({ displayName: displayName.trim(), avatar: avatarUrl });
      updateUser({ displayName: data.user.displayName, avatar: data.user.avatar });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save changes');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="min-h-screen bg-void flex items-center justify-center">
      <p className="text-sub text-sm">Please sign in.</p></div>;
  }

  return (
    <AppShell>
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto animate-slide-up">
        <h1 className="font-display font-bold text-bright text-lg mb-6 text-center">Customize Character</h1>

        <div className="card p-6 space-y-6">
          {/* Live preview */}
          <div className="flex flex-col items-center gap-3">
            <img src={avatarUrl} alt="avatar preview"
                 className="w-32 h-32 rounded-2xl border-2 border-amber/40 bg-raised" />
            <input className="input-base max-w-xs text-center" value={displayName}
                   onChange={(e) => { setDisplayName(e.target.value); setTrait('seed', e.target.value || 'User'); }}
                   maxLength={30} placeholder="Your name" disabled={loading} />
            {user?.username && (
              <span
                title="Your username — permanent, can't be changed"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                           bg-raised border border-border text-sub text-xs font-mono"
              >
                @{user.username}
                <span className="text-dim">🔒</span>
              </span>
            )}
          </div>

          {/* Trait pickers */}
          <div className="space-y-4">
            {Object.keys(OPTS).map((key) => (
              <div key={key}>
                <label className="block text-sub text-xs font-mono uppercase tracking-widest mb-2">
                  {LABELS[key]}
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {OPTS[key].map((val) => {
                    const selected = traits[key] === val;
                    if (isColor(key)) {
                      return (
                        <button key={val || 'none'} type="button" onClick={() => setTrait(key, val)}
                          className={`w-8 h-8 rounded-full shrink-0 border-2 transition-all
                            ${selected ? 'border-amber scale-110' : 'border-border'}`}
                          style={{ backgroundColor: `#${val}` }} title={val} />
                      );
                    }
                    return (
                      <button key={val || 'none'} type="button" onClick={() => setTrait(key, val)}
                        className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 border transition-all
                          ${selected ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-sub'}`}>
                        {val === '' ? 'None' : val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
          {saved && <p className="text-online text-xs bg-online/10 border border-online/20 rounded-lg px-3 py-2">✓ Character saved</p>}

          <button onClick={handleSave} disabled={loading}
                  className="btn-primary w-full justify-center py-3 disabled:opacity-40">
            {loading ? 'Saving...' : 'Save Character'}
          </button>
        </div>
      </div>
    </div>
    </AppShell>
  );
}
