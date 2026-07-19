// Coins/gems wallet + item grants. Ledger-first: every change writes a
// wallet_tx row, balances in `wallets` are the cached rollup.
const { getSupabase } = require('./supabaseClient');

async function ensureWallet(userId) {
  const sb = getSupabase();
  const { data } = await sb.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data;
  const { data: created, error } = await sb
    .from('wallets').insert({ user_id: userId }).select().single();
  if (error) throw error;
  return created;
}

async function grantCoins(userId, amount, reason, refId = null) {
  if (!amount) return { coins: (await ensureWallet(userId)).coins };
  const sb = getSupabase();
  const wallet = await ensureWallet(userId);
  const coins = Number(wallet.coins) + amount;
  const { error: txErr } = await sb.from('wallet_tx').insert({
    user_id: userId, currency: 'coins', amount, reason, ref_id: refId,
  });
  if (txErr) throw txErr;
  const { error } = await sb.from('wallets').update({ coins }).eq('user_id', userId);
  if (error) throw error;
  return { coins, granted: amount };
}

// Spend coins/gems with a balance check. Uses optimistic concurrency
// (update only succeeds if the balance hasn't changed since we read it),
// retried 3x — good enough without DB transactions.
async function spendCurrency(userId, currency, amount, reason, refId = null) {
  if (!['coins', 'gems'].includes(currency)) throw new Error(`bad currency '${currency}'`);
  if (!(amount > 0)) throw new Error('amount must be positive');
  const sb = getSupabase();

  for (let attempt = 0; attempt < 3; attempt++) {
    const wallet = await ensureWallet(userId);
    const balance = Number(wallet[currency]);
    if (balance < amount) {
      const err = new Error(`not enough ${currency} (have ${balance}, need ${amount})`);
      err.status = 402;
      throw err;
    }
    const { data, error } = await sb
      .from('wallets')
      .update({ [currency]: balance - amount })
      .eq('user_id', userId)
      .eq(currency, balance) // optimistic lock
      .select();
    if (error) throw error;
    if (data && data.length) {
      const { error: txErr } = await sb.from('wallet_tx').insert({
        user_id: userId, currency, amount: -amount, reason, ref_id: refId,
      });
      if (txErr) throw txErr;
      return { balance: balance - amount };
    }
    // balance changed concurrently — retry
  }
  const err = new Error('wallet busy, try again');
  err.status = 409;
  throw err;
}

async function grantItem(userId, itemId, source) {
  const sb = getSupabase();
  const { error } = await sb.from('user_inventory').upsert(
    { user_id: userId, item_id: itemId, source },
    { onConflict: 'user_id,item_id', ignoreDuplicates: true },
  );
  if (error) throw error;
  return { itemId };
}

// Random unowned shop/event item of a rarity. Returns the item row or null.
async function grantRandomItemOfRarity(userId, rarity, source) {
  const sb = getSupabase();
  const { data: owned } = await sb
    .from('user_inventory').select('item_id').eq('user_id', userId);
  const ownedIds = new Set((owned || []).map((r) => r.item_id));

  const { data: pool, error } = await sb
    .from('items').select('*')
    .eq('rarity', rarity)
    .in('unlock_type', ['shop', 'event']);
  if (error) throw error;

  const candidates = (pool || []).filter((it) => !ownedIds.has(it.id));
  if (!candidates.length) return null;
  const item = candidates[Math.floor(Math.random() * candidates.length)];
  await grantItem(userId, item.id, source);
  return item;
}

module.exports = { ensureWallet, grantCoins, spendCurrency, grantItem, grantRandomItemOfRarity };
