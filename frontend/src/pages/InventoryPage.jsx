import { useState, useEffect, useMemo } from 'react';
import { avatarSystemApi } from '@/api/avatarSystem.api.js';
import AppShell from '@/components/layout/AppShell.jsx';
import { RARITY_COLORS } from '@/lib/itemRarity.js';
import toast from 'react-hot-toast';

const CATEGORY_LABELS = {
  clothes: 'Clothes',
  hats: 'Hats',
  glasses: 'Glasses',
  shoes: 'Shoes',
  backgrounds: 'Backgrounds',
  room_decorations: 'Room Decorations',
  special_items: 'Special Items',
};

// Placeholder art: the starter catalog (supabase_migration_v12.sql) seeded
// every item with asset_url = NULL -- no real artwork exists yet. Until
// each item has one, at least distinguish item *types* at a glance instead
// of showing the same icon for everything.
const CATEGORY_ICONS = {
  clothes: '👕',
  hats: '🎩',
  glasses: '🕶️',
  shoes: '👟',
  backgrounds: '🖼️',
  room_decorations: '🪴',
  special_items: '🏆',
};

function ItemCard({ item, owned, equipped, onEquip, onUnequip, pending }) {
  const color = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
  return (
    <div
      className="card p-4 flex flex-col gap-2 relative overflow-hidden"
      style={{ borderColor: owned ? `${color}40` : undefined }}
    >
      <div
        className="w-full aspect-square rounded-lg flex items-center justify-center text-3xl overflow-hidden"
        style={{ background: `${color}18` }}
      >
        {item.asset_url
          ? <img src={item.asset_url} alt={item.name} className="w-full h-full object-cover" />
          : (CATEGORY_ICONS[item.category] || '🎨')}
      </div>
      <div>
        <p className="text-bright text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs mt-0.5 capitalize" style={{ color }}>{item.rarity}</p>
      </div>
      {owned ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => (equipped ? onUnequip(item.id) : onEquip(item.id))}
          className={`text-xs py-1.5 rounded-lg border transition-all disabled:opacity-40
            ${equipped ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-sub'}`}
        >
          {equipped ? '✓ Equipped' : 'Equip'}
        </button>
      ) : (
        <p className="text-dim text-xs py-1.5 text-center">
          🔒 {item.price_coins > 0 ? `${item.price_coins} coins` : 'Locked'}
        </p>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const [catalog, setCatalog] = useState([]);
  const [owned, setOwned] = useState({}); // itemId -> { equipped }
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    Promise.all([avatarSystemApi.getCatalog(), avatarSystemApi.getInventory()])
      .then(([catalogRes, invRes]) => {
        setCatalog(catalogRes.items || catalogRes || []);
        const map = {};
        for (const row of invRes.items || []) map[row.item_id] = { equipped: row.equipped };
        setOwned(map);
      })
      .catch(() => toast.error('Could not load your inventory'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const set = new Set(catalog.map((it) => it.category));
    return ['all', ...Array.from(set)];
  }, [catalog]);

  const visibleItems = activeCategory === 'all'
    ? catalog
    : catalog.filter((it) => it.category === activeCategory);

  const handleEquip = async (itemId) => {
    setPendingId(itemId);
    try {
      await avatarSystemApi.equipItem(itemId);
      setOwned((prev) => ({ ...prev, [itemId]: { equipped: true } }));
    } catch {
      toast.error('Could not equip that item');
    } finally {
      setPendingId(null);
    }
  };

  const handleUnequip = async (itemId) => {
    setPendingId(itemId);
    try {
      await avatarSystemApi.unequipItem(itemId);
      setOwned((prev) => ({ ...prev, [itemId]: { equipped: false } }));
    } catch {
      toast.error('Could not unequip that item');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 animate-slide-up">
        <h1 className="font-display font-bold text-bright text-lg mb-1 text-center">Inventory</h1>
        <p className="text-dim text-xs text-center mb-6">Equip owned items to show them off around your avatar.</p>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize border transition-all
                ${activeCategory === cat ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-sub'}`}
            >
              {cat === 'all' ? 'All' : (CATEGORY_LABELS[cat] || cat)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-dim text-sm text-center py-10">Loading…</p>
        ) : visibleItems.length === 0 ? (
          <p className="text-dim text-sm text-center py-10">No items in this category yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {visibleItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                owned={!!owned[item.id]}
                equipped={!!owned[item.id]?.equipped}
                pending={pendingId === item.id}
                onEquip={handleEquip}
                onUnequip={handleUnequip}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
