import { getSupabaseAdmin, isSupabaseConnected } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export async function addToQueue(req, res, next) {
  try {
    if (!isSupabaseConnected()) {
      return res.status(503).json({ error: 'Database not configured' });
    }
    const { roomId } = req.params;
    const { url, title, thumbnail, type } = req.body;
    const { userId, displayName } = req.user;

    if (!url?.trim()) return res.status(400).json({ error: 'URL required' });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('queue_items')
      .insert({
        room_id:       roomId,
        url,
        title:         title || 'Unknown',
        thumbnail:     thumbnail || '',
        type:          type || 'native',
        added_by:      userId,
        added_by_name: displayName,
        vote_count:    1,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-vote for own item
    await sb.from('queue_votes').insert({ item_id: data.id, user_id: userId });

    res.status(201).json({ item: data });
  } catch (err) {
    next(err);
  }
}

export async function getQueue(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.json({ queue: [] });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('queue_items')
      .select('*, queue_votes(user_id)')
      .eq('room_id', req.params.roomId)
      .order('vote_count', { ascending: false });

    if (error) throw error;
    res.json({ queue: data || [] });
  } catch (err) {
    next(err);
  }
}

export async function voteQueueItem(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.status(503).json({ error: 'DB not configured' });
    const { itemId } = req.params;
    const { userId } = req.user;
    const sb = getSupabaseAdmin();

    // Check if already voted
    const { data: existing } = await sb
      .from('queue_votes')
      .select('id')
      .eq('item_id', itemId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Remove vote — use RPC for atomic decrement (avoids read-modify-write race)
      await sb.from('queue_votes').delete()
        .eq('item_id', itemId).eq('user_id', userId);
      await sb.rpc('decrement_queue_vote', { item_id_arg: itemId });
    } else {
      // Add vote
      await sb.from('queue_votes').insert({ item_id: itemId, user_id: userId });
      await sb.rpc('increment_queue_vote', { item_id_arg: itemId });
    }

    const { data } = await sb
      .from('queue_items')
      .select('*, queue_votes(user_id)')
      .eq('id', itemId)
      .single();

    res.json({ item: data });
  } catch (err) {
    next(err);
  }
}

export async function removeQueueItem(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.status(503).json({ error: 'DB not configured' });
    const { roomId, itemId } = req.params;
    const { userId } = req.user;
    const sb = getSupabaseAdmin();

    // Get item to check ownership
    const { data: item } = await sb
      .from('queue_items').select('*').eq('id', itemId).single();

    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Get room to check if host
    const { data: room } = await sb
      .from('rooms').select('host_id').eq('room_id', roomId).single();

    if (item.added_by !== userId && room?.host_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await sb.from('queue_items').delete().eq('id', itemId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function playNext(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.status(503).json({ error: 'DB not configured' });
    const { roomId } = req.params;
    const { userId } = req.user;
    const sb = getSupabaseAdmin();

    const { data: room } = await sb
      .from('rooms').select('host_id').eq('room_id', roomId).single();
    if (room?.host_id !== userId) {
      return res.status(403).json({ error: 'Only host can advance queue' });
    }

    // Get top voted item
    const { data: items } = await sb
      .from('queue_items')
      .select('*')
      .eq('room_id', roomId)
      .order('vote_count', { ascending: false })
      .limit(1);

    if (!items?.length) return res.status(404).json({ error: 'Queue is empty' });

    const next = items[0];

    // Update current video in room
    await sb.from('rooms').update({
      current_url:   next.url,
      current_title: next.title,
      current_type:  next.type,
    }).eq('room_id', roomId);

    // Remove played item
    await sb.from('queue_items').delete().eq('id', next.id);

    // Get updated queue
    const { data: queue } = await sb
      .from('queue_items')
      .select('*, queue_votes(user_id)')
      .eq('room_id', roomId)
      .order('vote_count', { ascending: false });

    res.json({ video: { url: next.url, title: next.title, type: next.type }, queue: queue || [] });
  } catch (err) {
    next(err);
  }
}