import { getSupabaseAdmin, isSupabaseConnected } from '../config/supabase.js';
import { roomService } from '../services/room.service.js';

// Authorization helper: is this user the host of the room?
async function isRoomHost(roomId, userId) {
  const room = await roomService.getRoomWithState(roomId);
  return !!(room && room.hostId === userId);
}

export async function createPoll(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.status(503).json({ error: 'DB not configured' });
    const { roomId } = req.params;
    const { question, options, durationMinutes = 5 } = req.body;
    const { userId, displayName } = req.user;

    if (!question?.trim()) return res.status(400).json({ error: 'Question required' });
    if (!options?.length || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options required' });
    }
    if (options.length > 6) {
      return res.status(400).json({ error: 'At most 6 options allowed' });
    }

    // SECURITY: only the room host may create a poll.
    if (!(await isRoomHost(roomId, userId))) {
      return res.status(403).json({ error: 'Only the host can create a poll' });
    }

    // Clamp duration to a sane 1–30 min range.
    const safeDuration = Math.min(Math.max(parseInt(durationMinutes, 10) || 5, 1), 30);

    const sb = getSupabaseAdmin();

    // End any existing active polls
    await sb.from('polls')
      .update({ is_active: false })
      .eq('room_id', roomId).eq('is_active', true);

    const endsAt = new Date(Date.now() + safeDuration * 60 * 1000).toISOString();

    const { data: poll, error } = await sb
      .from('polls')
      .insert({
        room_id:         roomId,
        question:        question.trim(),
        created_by:      userId,
        created_by_name: displayName,
        is_active:       true,
        ends_at:         endsAt,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert options
    const optionRows = options.map((text, idx) => ({
      poll_id:    poll.id,
      text:       String(text).trim(),
      vote_count: 0,
      position:   idx,
    }));

    const { data: pollOptions, error: optErr } = await sb
      .from('poll_options')
      .insert(optionRows)
      .select();

    if (optErr) throw optErr;

    res.status(201).json({ poll: { ...poll, options: pollOptions } });
  } catch (err) {
    next(err);
  }
}

export async function votePoll(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.status(503).json({ error: 'DB not configured' });
    const { roomId, pollId, optionIndex } = req.params;
    const { userId } = req.user;
    const sb = getSupabaseAdmin();
    const idx = parseInt(optionIndex);

    // Get poll with options
    const { data: poll } = await sb
      .from('polls').select('*, poll_options(*)').eq('id', pollId).single();
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (!poll.is_active) return res.status(400).json({ error: 'Poll has ended' });
    if (poll.ends_at && new Date() > new Date(poll.ends_at)) {
      await sb.from('polls').update({ is_active: false }).eq('id', pollId);
      return res.status(400).json({ error: 'Poll expired' });
    }

    const sortedOptions = [...poll.poll_options].sort((a, b) => a.position - b.position);
    if (idx < 0 || idx >= sortedOptions.length) {
      return res.status(400).json({ error: 'Invalid option' });
    }
    const targetOption = sortedOptions[idx];

    // Remove previous vote if any
    const { data: existing } = await sb
      .from('poll_votes').select('*, poll_options!inner(id)')
      .eq('poll_id', pollId).eq('user_id', userId).single();

    if (existing) {
      await sb.from('poll_votes').delete().eq('poll_id', pollId).eq('user_id', userId);
      await sb.rpc('decrement_poll_vote', { option_id_arg: existing.option_id });
    }

    // Add new vote
    await sb.from('poll_votes').insert({
      poll_id: pollId, option_id: targetOption.id, user_id: userId,
    });
    await sb.rpc('increment_poll_vote', { option_id_arg: targetOption.id });

    // Return updated poll
    const { data: updated } = await sb
      .from('polls').select('*, poll_options(*), poll_votes(user_id, option_id)')
      .eq('id', pollId).single();

    res.json({ poll: updated });
  } catch (err) {
    next(err);
  }
}

export async function getActivePoll(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.json({ poll: null });
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('polls')
      .select('*, poll_options(*), poll_votes(user_id, option_id)')
      .eq('room_id', req.params.roomId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    res.json({ poll: data || null });
  } catch {
    res.json({ poll: null });
  }
}

export async function endPoll(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.status(503).json({ error: 'DB not configured' });
    const { roomId, pollId } = req.params;
    const { userId } = req.user;
    const sb = getSupabaseAdmin();

    // Load the poll first so we can verify ownership.
    const { data: poll, error: loadErr } = await sb
      .from('polls').select('id, room_id, created_by').eq('id', pollId).single();
    if (loadErr || !poll) return res.status(404).json({ error: 'Poll not found' });

    // SECURITY: only the poll creator OR the room host may end it.
    const creator = poll.created_by === userId;
    const host    = await isRoomHost(poll.room_id || roomId, userId);
    if (!creator && !host) {
      return res.status(403).json({ error: 'Not allowed to end this poll' });
    }

    const { data, error } = await sb
      .from('polls').update({ is_active: false }).eq('id', pollId)
      .select().single();
    if (error) throw error;
    res.json({ poll: data });
  } catch (err) {
    next(err);
  }
}