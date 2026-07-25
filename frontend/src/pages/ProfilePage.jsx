import { useState, useMemo, useRef, lazy, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore.js';
import { userApi } from '@/api/user.api.js';
import AppShell from '@/components/layout/AppShell.jsx';
import AvatarErrorBoundary from '@/components/avatar/AvatarErrorBoundary.jsx';
import { defaultRecipe, EXPRESSIONS } from '@/lib/avatar/avatarCore.js';
import { buildStarterCatalog, CLOTHING_OPTIONS } from '@/lib/avatar/starterCatalog.js';
import toast from 'react-hot-toast';

// Lazy-loaded: three.js (and, for the selfie flow, MediaPipe's WASM model)
// are heavy dependencies, keep them out of the main bundle until someone
// actually opens the profile page / clicks "Create from selfie".
const AvatarStage    = lazy(() => import('@/components/avatar/AvatarStage.jsx'));
const SelfieCapture  = lazy(() => import('@/components/avatar/SelfieCapture.jsx'));

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

  // ── 3D avatar preview (new, experimental — not yet wired to save) ────────
  const avatarStageRef = useRef(null);
  const [recipe3d, setRecipe3d] = useState(defaultRecipe);
  const [catalog3d] = useState(buildStarterCatalog);
  const [framing3d, setFraming3d] = useState('full');
  const [expression3d, setExpression3d] = useState('soft_smile');
  const [showSelfie, setShowSelfie] = useState(false);

  const handleFraming = (name) => {
    setFraming3d(name);
    avatarStageRef.current?.setFraming(name);
  };
  const handleExpression = (id) => {
    setExpression3d(id);
    avatarStageRef.current?.setExpression(id);
  };
  const handleOutfit = (slot, id) => {
    setRecipe3d((r) => {
      if (slot === 'full') {
        // toggle: clicking the equipped full outfit again clears it
        return { ...r, outfit: { ...r.outfit, full: r.outfit.full === id ? null : id } };
      }
      // picking a separate top/bottom/shoes piece overrides any full outfit
      return { ...r, outfit: { ...r.outfit, [slot]: id, full: null } };
    });
  };
  const handleSelfieResult = ({ skin, faceShape, hairColor, hairStyle }) => {
    setRecipe3d((r) => ({
      ...r,
      body: { ...r.body, skin },
      face: { ...r.face, shape: faceShape },
      hair: { ...r.hair, id: hairStyle, color: hairColor },
    }));
    setShowSelfie(false);
    toast.success('Applied! Fine-tune anything below.');
  };

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

        {/* 3D avatar preview — new, experimental, not yet wired to save.
            Isolated in its own error boundary + lazy chunk so if WebGL is
            unsupported or three.js fails to load, nothing above breaks. */}
        <div className="card p-6 mt-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold text-bright text-base">3D Character Preview</h2>
              <p className="text-dim text-xs mt-0.5">Early preview — not connected to your saved profile yet.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSelfie(true)}
              className="btn-ghost text-xs px-3 py-1.5 border border-border shrink-0 whitespace-nowrap"
            >
              📸 Create from selfie
            </button>
          </div>

          <div className="h-80 rounded-xl overflow-hidden bg-void border border-border">
            <AvatarErrorBoundary>
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center text-dim text-xs">
                  Loading 3D preview…
                </div>
              }>
                <AvatarStage
                  ref={avatarStageRef}
                  recipe={recipe3d}
                  catalogIndex={catalog3d}
                  framing={framing3d}
                  autoRotate
                />
              </Suspense>
            </AvatarErrorBoundary>
          </div>

          <div className="flex flex-wrap gap-2">
            {['full', 'bust', 'head', 'face'].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => handleFraming(name)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize border transition-all
                  ${framing3d === name ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-sub'}`}
              >
                {name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => avatarStageRef.current?.playEmote('wave')}
              className="px-3 py-1.5 rounded-lg text-xs border border-border text-dim hover:text-sub transition-all"
            >
              👋 Wave
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXPRESSIONS.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => handleExpression(ex.id)}
                title={ex.name}
                className={`w-9 h-9 flex items-center justify-center rounded-lg text-base border transition-all
                  ${expression3d === ex.id ? 'border-amber bg-amber/10' : 'border-border hover:border-sub/40'}`}
              >
                {ex.emoji}
              </button>
            ))}
          </div>

          {/* Outfit pickers */}
          <div className="space-y-3 pt-2 border-t border-border">
            {[
              { slot: 'top',    label: 'Top' },
              { slot: 'bottom', label: 'Bottom' },
              { slot: 'shoes',  label: 'Shoes' },
              { slot: 'full',   label: 'Full outfit' },
            ].map(({ slot, label }) => (
              <div key={slot}>
                <label className="block text-sub text-xs font-mono uppercase tracking-widest mb-2">
                  {label}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CLOTHING_OPTIONS[slot].map((item) => {
                    const selected = slot === 'full'
                      ? recipe3d.outfit.full === item.id
                      : recipe3d.outfit[slot] === item.id && !recipe3d.outfit.full;
                    const color = item.colorways?.[0]?.primary || '#5A6273';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleOutfit(slot, item.id)}
                        title={item.name}
                        className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full border transition-all
                          ${selected ? 'border-amber bg-amber/10' : 'border-border hover:border-sub/40'}`}
                      >
                        <span className="w-5 h-5 rounded-full border border-border/50 shrink-0"
                              style={{ backgroundColor: color }} />
                        <span className={`text-xs whitespace-nowrap ${selected ? 'text-amber' : 'text-dim'}`}>
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSelfie && (
        <AvatarErrorBoundary>
          <Suspense fallback={null}>
            <SelfieCapture
              onResult={handleSelfieResult}
              onClose={() => setShowSelfie(false)}
            />
          </Suspense>
        </AvatarErrorBoundary>
      )}
    </div>
    </AppShell>
  );
}
