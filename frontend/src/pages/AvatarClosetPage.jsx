import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore.js';
import { avatarSystemApi } from '@/api/avatarSystem.api.js';
import AppShell from '@/components/layout/AppShell.jsx';
import Avatar from '@/components/ui/Avatar.jsx';
import { RARITY_COLORS } from '@/lib/itemRarity.js';
import toast from 'react-hot-toast';

// Heavy only in the sense of pulling in an external iframe flow — keep it
// out of the initial closet-page bundle until someone clicks "Customize".
const RPMAvatarCreator = lazy(() => import('@/components/avatar/RPMAvatarCreator.jsx'));

export default function AvatarClosetPage() {
  const { user, updateUser } = useAuthStore();
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);
  const [equippedItems, setEquippedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    avatarSystemApi.getAvatar()
      .then((data) => {
        setAvatarUrl(data.avatarUrl || user?.avatar || null);
        setEquippedItems(data.equippedItems || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAvatarCreated = async (glbUrl) => {
    setShowCreator(false);
    setSaving(true);
    try {
      // RPM's 2D render API — a portrait PNG of the same avatar, cheap to
      // embed wherever the app already shows a flat avatar image (chat,
      // member list, room header) via the existing <Avatar src=.../>.
      const renderUrl = glbUrl.replace(/\.glb($|\?)/, '.png$1');
      const data = await avatarSystemApi.saveAvatarUrl(renderUrl);
      setAvatarUrl(data.avatarUrl);
      updateUser({ avatar: data.avatarUrl });
      toast.success('Avatar saved!');
    } catch {
      toast.error('Could not save your avatar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 animate-slide-up">
        <h1 className="font-display font-bold text-bright text-lg mb-6 text-center">Avatar Closet</h1>

        <div className="card p-6 flex flex-col items-center gap-4 text-center">
          {loading ? (
            <div className="w-32 h-32 rounded-2xl bg-raised animate-pulse" />
          ) : (
            <Avatar src={avatarUrl} name={user?.displayName} size="lg" className="!w-32 !h-32 !text-3xl" />
          )}
          <div>
            <p className="text-bright font-medium">{user?.displayName}</p>
            <p className="text-dim text-xs mt-1">
              {avatarUrl ? 'Powered by Ready Player Me' : "You haven't created an avatar yet"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreator(true)}
            disabled={saving}
            className="btn-primary disabled:opacity-40"
          >
            {saving ? 'Saving…' : avatarUrl ? 'Edit Avatar' : 'Create Avatar'}
          </button>
        </div>

        <div className="card p-6 mt-6">
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

      {showCreator && (
        <Suspense fallback={null}>
          <RPMAvatarCreator
            onAvatarCreated={handleAvatarCreated}
            onClose={() => setShowCreator(false)}
          />
        </Suspense>
      )}
    </AppShell>
  );
}
