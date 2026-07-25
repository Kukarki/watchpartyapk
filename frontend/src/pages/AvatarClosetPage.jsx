import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore.js';
import { avatarSystemApi } from '@/api/avatarSystem.api.js';
import AppShell from '@/components/layout/AppShell.jsx';
import Avatar from '@/components/ui/Avatar.jsx';
import { RARITY_COLORS } from '@/lib/itemRarity.js';

export default function AvatarClosetPage() {
  const { user } = useAuthStore();
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);
  const [equippedItems, setEquippedItems] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    avatarSystemApi.getAvatar()
      .then((data) => {
        setAvatarUrl(data.avatarUrl || user?.avatar || null);
        setEquippedItems(data.equippedItems || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          </div>
          <Link to="/profile" className="btn-primary">
            Edit Avatar
          </Link>
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
    </AppShell>
  );
}
