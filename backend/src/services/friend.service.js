import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

class FriendService {
  get sb() {
    return getSupabaseAdmin();
  }

  // ── Friend IDs ─────────────────────────────────────────────────────────────

  async getFriendIds(userId) {
    const [{ data: asRequester, error: e1 }, { data: asAddressee, error: e2 }] = await Promise.all([
      this.sb.from('friendships').select('addressee_id').eq('requester_id', userId).eq('status', 'accepted'),
      this.sb.from('friendships').select('requester_id').eq('addressee_id', userId).eq('status', 'accepted'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    return [
      ...(asRequester || []).map((r) => r.addressee_id),
      ...(asAddressee || []).map((r) => r.requester_id),
    ];
  }

  // ── Requests ───────────────────────────────────────────────────────────────

  async createRequest(requesterId, { toUserId, email, username }) {
    let addresseeId = toUserId;

    if (!addresseeId && username) {
      const { data } = await this.sb.from('profiles').select('id').eq('username', username.trim().toLowerCase()).maybeSingle();
      if (!data) throw httpError(404, 'No user found with that username');
      addresseeId = data.id;
    }

    if (!addresseeId && email) {
      const { data } = await this.sb.from('profiles').select('id').eq('email', email).maybeSingle();
      if (!data) throw httpError(404, 'No user found with that email');
      addresseeId = data.id;
    }

    if (!addresseeId) throw httpError(400, 'toUserId, username, or email is required');
    if (addresseeId === requesterId) throw httpError(400, 'Cannot send a friend request to yourself');

    const [{ data: existing1 }, { data: existing2 }] = await Promise.all([
      this.sb.from('friendships').select('id, status')
        .eq('requester_id', requesterId).eq('addressee_id', addresseeId).maybeSingle(),
      this.sb.from('friendships').select('id, status')
        .eq('requester_id', addresseeId).eq('addressee_id', requesterId).maybeSingle(),
    ]);
    const existing = existing1 || existing2;
    if (existing) {
      throw httpError(409, existing.status === 'accepted' ? 'Already friends' : 'Friend request already pending');
    }

    const { data, error } = await this.sb
      .from('friendships')
      .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
      .select()
      .single();

    if (error) throw error;
    logger.info('Friend request created', { requesterId, addresseeId });
    return this._mapFriendship(data);
  }

  async respondToRequest(requestId, addresseeId, action) {
    const { data: row, error } = await this.sb.from('friendships').select('*').eq('id', requestId).single();
    if (error || !row) throw httpError(404, 'Friend request not found');
    if (row.addressee_id !== addresseeId) throw httpError(403, 'Not authorized to respond to this request');
    if (row.status !== 'pending') throw httpError(409, 'Friend request already resolved');

    if (action === 'accept') {
      const { data, error: updErr } = await this.sb
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .single();
      if (updErr) throw updErr;
      logger.info('Friend request accepted', { requestId, addresseeId });
      return this._mapFriendship(data);
    }

    if (action === 'decline') {
      const { error: delErr } = await this.sb.from('friendships').delete().eq('id', requestId);
      if (delErr) throw delErr;
      logger.info('Friend request declined', { requestId, addresseeId });
      return null;
    }

    throw httpError(400, "action must be 'accept' or 'decline'");
  }

  async listRequests(userId) {
    const [{ data: incoming, error: e1 }, { data: outgoing, error: e2 }] = await Promise.all([
      this.sb.from('friendships').select('id, requester_id, created_at').eq('addressee_id', userId).eq('status', 'pending'),
      this.sb.from('friendships').select('id, addressee_id, created_at').eq('requester_id', userId).eq('status', 'pending'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const otherIds = [
      ...(incoming || []).map((r) => r.requester_id),
      ...(outgoing || []).map((r) => r.addressee_id),
    ];
    const profileById = await this._profilesById(otherIds);

    return {
      incoming: (incoming || []).map((r) => ({
        requestId: r.id,
        userId: r.requester_id,
        displayName: profileById[r.requester_id]?.display_name || 'Unknown',
        username: profileById[r.requester_id]?.username || null,
        avatar: profileById[r.requester_id]?.avatar_url || '',
        createdAt: r.created_at,
      })),
      outgoing: (outgoing || []).map((r) => ({
        requestId: r.id,
        userId: r.addressee_id,
        displayName: profileById[r.addressee_id]?.display_name || 'Unknown',
        username: profileById[r.addressee_id]?.username || null,
        avatar: profileById[r.addressee_id]?.avatar_url || '',
        createdAt: r.created_at,
      })),
    };
  }

  // ── Friends ────────────────────────────────────────────────────────────────

  async listFriends(userId, onlineIds = new Set()) {
    const friendIds = await this.getFriendIds(userId);
    if (friendIds.length === 0) return [];

    const { data, error } = await this.sb
      .from('profiles')
      .select('id, display_name, username, avatar_url, last_seen_at')
      .in('id', friendIds);
    if (error) throw error;

    return (data || []).map((p) => ({
      userId: p.id,
      displayName: p.display_name,
      username: p.username,
      avatar: p.avatar_url,
      online: onlineIds.has(p.id),
      lastSeenAt: p.last_seen_at,
    }));
  }

  async removeFriendship(userId, friendId) {
    const [del1, del2] = await Promise.all([
      this.sb.from('friendships').delete()
        .eq('requester_id', userId).eq('addressee_id', friendId).eq('status', 'accepted').select(),
      this.sb.from('friendships').delete()
        .eq('requester_id', friendId).eq('addressee_id', userId).eq('status', 'accepted').select(),
    ]);
    if (del1.error) throw del1.error;
    if (del2.error) throw del2.error;

    const removedCount = (del1.data?.length || 0) + (del2.data?.length || 0);
    if (removedCount === 0) throw httpError(404, 'Friendship not found');
    logger.info('Friendship removed', { userId, friendId });
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  async searchProfiles(userId, query) {
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const friendIds = await this.getFriendIds(userId);
    const exclude = new Set([userId, ...friendIds]);

    const pattern = `%${q}%`;
    const cols = 'id, display_name, username, avatar_url';
    const [{ data: byName, error: e1 }, { data: byEmail, error: e2 }, { data: byUsername, error: e3 }] = await Promise.all([
      this.sb.from('profiles').select(cols).ilike('display_name', pattern).limit(20),
      this.sb.from('profiles').select(cols).ilike('email', pattern).limit(20),
      this.sb.from('profiles').select(cols).ilike('username', pattern).limit(20),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    const results = new Map();
    for (const p of [...(byUsername || []), ...(byName || []), ...(byEmail || [])]) {
      if (exclude.has(p.id) || results.has(p.id)) continue;
      results.set(p.id, { userId: p.id, displayName: p.display_name, username: p.username, avatar: p.avatar_url });
    }
    return Array.from(results.values()).slice(0, 20);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async _profilesById(ids) {
    if (ids.length === 0) return {};
    const { data, error } = await this.sb.from('profiles').select('id, display_name, username, avatar_url').in('id', ids);
    if (error) throw error;
    return Object.fromEntries((data || []).map((p) => [p.id, p]));
  }

  _mapFriendship(row) {
    return {
      id: row.id,
      requesterId: row.requester_id,
      addresseeId: row.addressee_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const friendService = new FriendService();
