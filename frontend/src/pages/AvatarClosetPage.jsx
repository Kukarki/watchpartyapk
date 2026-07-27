import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore.js';
import { avatarSystemApi } from '@/api/avatarSystem.api.js';
import { vroidHubApi } from '@/api/vroidHub.api.js';
import AppShell from '@/components/layout/AppShell.jsx';
import Avatar from '@/components/ui/Avatar.jsx';
import { RARITY_COLORS } from '@/lib/itemRarity.js';
import toast from 'react-hot-toast';

// three.js + @pixiv/three-vrm are a heavy pair — keep them out of the main
// bundle until a VRM model actually needs rendering.
const VrmViewer = lazy(() => import('@/components/avatar/VrmViewer.jsx'));

export default function AvatarClosetPage() {
  const { user } = useAuthStore();
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);
  const [equippedItems, setEquippedItems] = useState({});
  const [loading, setLoading] = useState(true);

  // Preset gallery — zero-setup 3D characters, no VRoid Hub account needed.
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [selectingPresetId, setSelectingPresetId] = useState(null);

  // VRoid Hub / VRM state — the "bring your own character" option.
  const [vroidConnected, setVroidConnected] = useState(false);
  const [vroidModels, setVroidModels] = useState([]);
  const [vrmUrl, setVrmUrl] = useState(null);
  const [loadingVroid, setLoadingVroid] = useState(true);
  const [connectingVroid, setConnectingVroid] = useState(false);
  const [selectingId, setSelectingId] = useState(null);

  // Whichever source is active wins the preview — a preset and a VRoid
  // model are mutually exclusive server-side (selecting one clears the
  // other), so at most one of these is ever actually set at a time.
  const activeVrmUrl = selectedPreset?.vrm_url || vrmUrl;

  useEffect(() => {
    avatarSystemApi.getAvatar()
      .then((data) => {
        setAvatarUrl(data.avatarUrl || user?.avatar || null);
        setEquippedItems(data.equippedItems || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    Promise.all([avatarSystemApi.getPresets(), avatarSystemApi.getMyPreset()])
      .then(([list, mine]) => {
        setPresets(list.presets || []);
        setSelectedPreset(mine.preset || null);
      })
      .catch(() => {})
      .finally(() => setLoadingPresets(false));

    Promise.all([vroidHubApi.listModels(), vroidHubApi.getAvatarUrl()])
      .then(([models, avatar]) => {
        setVroidConnected(models.connected);
        setVroidModels(models.models || []);
        setVrmUrl(avatar.vrmUrl || null);
      })
      .catch(() => {})
      .finally(() => setLoadingVroid(false));
  }, []);

  const handleSelectPreset = async (preset) => {
    setSelectingPresetId(preset.id);
    try {
      await avatarSystemApi.selectPreset(preset.id);
      setSelectedPreset(preset);
      setVrmUrl(null); // server also clears the VRoid selection — mirror locally
      toast.success('Character selected!');
    } catch {
      toast.error('Could not select that character');
    } finally {
      setSelectingPresetId(null);
    }
  };

  const handleConnectVroid = async () => {
    setConnectingVroid(true);
    try {
      const { url } = await vroidHubApi.getAuthUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'VRoid Hub is not available right now');
      setConnectingVroid(false);
    }
  };

  const handleSelectModel = async (modelId) => {
    setSelectingId(modelId);
    try {
      await vroidHubApi.selectModel(modelId);
      const { vrmUrl: url } = await vroidHubApi.getAvatarUrl();
      setVrmUrl(url);
      setSelectedPreset(null); // server also clears the preset selection — mirror locally
      toast.success('3D avatar updated!');
    } catch {
      toast.error('Could not select that model');
    } finally {
      setSelectingId(null);
    }
  };

  const handleDisconnectVroid = async () => {
    try {
      await vroidHubApi.disconnect();
      setVroidConnected(false);
      setVroidModels([]);
      toast.success('VRoid Hub disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 animate-slide-up space-y-6">
        <h1 className="font-display font-bold text-bright text-lg text-center">Avatar Closet</h1>

        {/* 2D avatar — shown in chat, member lists, room headers */}
        <div className="card p-6 flex flex-col items-center gap-4 text-center">
          {loading ? (
            <div className="w-32 h-32 rounded-2xl bg-raised animate-pulse" />
          ) : (
            <Avatar src={avatarUrl} name={user?.displayName} size="lg" className="!w-32 !h-32 !text-3xl" />
          )}
          <div>
            <p className="text-bright font-medium">{user?.displayName}</p>
            <p className="text-dim text-xs mt-1">2D avatar — shown in chat and rooms</p>
          </div>
          <Link to="/profile" className="btn-primary">
            Edit Avatar
          </Link>
        </div>

        {/* 3D character preview — whichever source (preset or VRoid) is active */}
        {activeVrmUrl && (
          <div className="card p-6">
            <h2 className="font-display font-semibold text-bright text-base mb-4">Your 3D Character</h2>
            <Suspense fallback={<div className="w-full aspect-square rounded-xl bg-raised animate-pulse" />}>
              <VrmViewer vrmUrl={activeVrmUrl} />
            </Suspense>
          </div>
        )}

        {/* Preset gallery — pick a character, no account/setup needed */}
        <div className="card p-6">
          <h2 className="font-display font-semibold text-bright text-base">Choose Your Character</h2>
          <p className="text-dim text-xs mt-0.5 mb-4">Pick a 3D character — free to use, nothing to make or upload.</p>

          {loadingPresets ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="w-full aspect-square rounded-lg bg-raised animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  disabled={selectingPresetId === p.id}
                  title={p.name}
                  className={`rounded-lg overflow-hidden border transition-colors disabled:opacity-40
                    ${selectedPreset?.id === p.id ? 'border-amber' : 'border-border hover:border-amber/50'}`}
                >
                  <img src={p.thumbnail_url} alt={p.name} className="w-full aspect-square object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3D VRM avatar — VRoid Hub, the "bring your own character" option */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-bright text-base">Bring Your Own Character</h2>
              <p className="text-dim text-xs mt-0.5">Optional — link a model you made in VRoid Studio, via VRoid Hub</p>
            </div>
            {vroidConnected && (
              <button type="button" onClick={handleDisconnectVroid} className="text-danger text-xs hover:underline underline-offset-2 shrink-0">
                Disconnect
              </button>
            )}
          </div>

          {loadingVroid ? (
            <div className="w-full aspect-square rounded-xl bg-raised animate-pulse" />
          ) : !vroidConnected ? (
            <div className="space-y-3">
              <p className="text-dim text-xs leading-relaxed">
                Design your own character — hair, outfits, glasses, accessories — for free in{' '}
                <a href="https://vroid.com/en/studio" target="_blank" rel="noopener noreferrer" className="text-amber hover:underline underline-offset-2">
                  VRoid Studio
                </a>
                , upload it to VRoid Hub, then connect your account here to use it instead of a preset.
              </p>
              <button
                type="button"
                onClick={handleConnectVroid}
                disabled={connectingVroid}
                className="btn-primary w-full justify-center py-2.5 disabled:opacity-40"
              >
                {connectingVroid ? 'Connecting…' : 'Connect VRoid Hub'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {vroidModels.length === 0 ? (
                <p className="text-dim text-xs">
                  No models found on your VRoid Hub account yet — make one in{' '}
                  <a href="https://vroid.com/en/studio" target="_blank" rel="noopener noreferrer" className="text-amber hover:underline underline-offset-2">
                    VRoid Studio
                  </a>{' '}
                  and upload it to Hub.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {vroidModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectModel(m.id)}
                        disabled={selectingId === m.id}
                        className="rounded-lg overflow-hidden border border-border hover:border-amber/50 transition-colors disabled:opacity-40"
                        title={m.name}
                      >
                        {m.thumbnailUrl ? (
                          <img src={m.thumbnailUrl} alt={m.name} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square bg-raised flex items-center justify-center text-xl">🧑‍🎨</div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-dim text-xs">
                    Want a different outfit or accessories? Edit your character in{' '}
                    <a href="https://vroid.com/en/studio" target="_blank" rel="noopener noreferrer" className="text-amber hover:underline underline-offset-2">
                      VRoid Studio
                    </a>
                    , re-upload to VRoid Hub, then pick it here.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Inventory summary */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-bright text-base">Equipped</h2>
            <Link to="/inventory" className="text-amber text-xs hover:underline underline-offset-2">
              Open Inventory →
            </Link>
          </div>
          {Object.keys(equippedItems).length === 0 ? (
            <p className="text-dim text-xs">Nothing equipped yet — visit your inventory to equip items.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(equippedItems).map(([category, itemId]) => (
                <span
                  key={category}
                  className="px-2.5 py-1 rounded-full text-xs border"
                  style={{ borderColor: `${RARITY_COLORS.common}40`, color: RARITY_COLORS.common }}
                >
                  {category.replace('_', ' ')}: {itemId}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
