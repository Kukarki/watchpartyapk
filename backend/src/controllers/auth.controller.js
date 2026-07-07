import { v4 as uuidv4 } from 'uuid';
import { signToken } from '../utils/jwt.js';
import { getSupabaseAdmin, isSupabaseConnected } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { generateAvatar } from '../utils/avatar.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: upsert a row into `profiles` (non-fatal — DB down ≠ login fail)
// ─────────────────────────────────────────────────────────────────────────────
async function upsertProfile(sb, { id, displayName, avatarUrl, email = null, provider }) {
  const { error } = await sb.from('profiles').upsert(
    {
      id,
      display_name: displayName,
      avatar_url:   avatarUrl,
      email:        email || null,
      provider,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) logger.warn('upsertProfile failed', { id, provider, error: error.message });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/me — return the current user from DB (or JWT for guests)
// ─────────────────────────────────────────────────────────────────────────────
export async function getMe(req, res, next) {
  try {
    // Guests: no DB row needed — JWT payload is the source of truth
    if (req.user.provider === 'guest' || !isSupabaseConnected()) {
      return res.json({ user: req.user });
    }

    const sb = getSupabaseAdmin();
    const { data: profile, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', req.user.userId)
      .single();

    if (error || !profile) {
      // Profile may not exist yet (legacy user) — return JWT payload
      return res.json({ user: req.user });
    }

    // Update last_seen_at in background
    sb.from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', req.user.userId)
      .then(() => {})
      .catch(() => {});

    res.json({
      user: {
        userId:      profile.id,
        displayName: profile.display_name,
        email:       profile.email || req.user.email,
        avatar:      profile.avatar_url,
        provider:    profile.provider,
        role:        'user',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/guest — always works, stores a row in profiles
// ─────────────────────────────────────────────────────────────────────────────
export async function guestLogin(req, res, next) {
  try {
    const { displayName } = req.body;
    if (!displayName?.trim()) {
      return res.status(400).json({ error: 'displayName is required' });
    }

    const name   = displayName.trim().slice(0, 30);
    const userId = `guest_${uuidv4()}`;
    const avatar = generateAvatar(name);

    const payload = { userId, displayName: name, avatar, provider: 'guest', role: 'user' };

    // Persist to DB (non-fatal) so chat history can attribute messages to this guest
    if (isSupabaseConnected()) {
      await upsertProfile(getSupabaseAdmin(), {
        id: userId, displayName: name, avatarUrl: avatar, provider: 'guest',
      });
    }

    const token = signToken(payload);
    logger.info('Guest login', { userId, displayName: name });
    res.json({ token, user: payload });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/register — email + password, stored in Supabase Auth + profiles
// ─────────────────────────────────────────────────────────────────────────────
export async function register(req, res, next) {
  try {
    if (!isSupabaseConnected()) {
      return res.status(503).json({ error: 'Database not configured. Use guest login.' });
    }

    const { displayName, email, password } = req.body;
    if (!displayName?.trim())              return res.status(400).json({ error: 'Name is required' });
    if (!email?.trim())                    return res.status(400).json({ error: 'Email is required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const sb   = getSupabaseAdmin();
    const name = displayName.trim().slice(0, 30);

    // 1. Create Supabase Auth user
    const { data, error } = await sb.auth.admin.createUser({
      email:         email.toLowerCase().trim(),
      password,
      email_confirm: true,                          // skip email verification for now
      user_metadata: { full_name: name },
    });

    if (error) {
      if (error.message?.toLowerCase().includes('already')) {
        return res.status(409).json({ error: 'Email already registered. Try signing in instead.' });
      }
      throw error;
    }

    const avatar = generateAvatar(name);

    // 2. Create profiles row (matches Supabase Auth UUID)
    await upsertProfile(sb, {
      id: data.user.id, displayName: name, avatarUrl: avatar,
      email: email.toLowerCase().trim(), provider: 'email',
    });

    const userPayload = {
      userId:      data.user.id,
      displayName: name,
      email:       email.toLowerCase().trim(),
      avatar,
      provider:    'email',
      role:        'user',
    };

    const token = signToken(userPayload);
    logger.info('User registered', { userId: data.user.id, email: userPayload.email });
    res.status(201).json({ token, user: userPayload });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login — email + password
// ─────────────────────────────────────────────────────────────────────────────
export async function login(req, res, next) {
  try {
    if (!isSupabaseConnected()) {
      return res.status(503).json({ error: 'Database not configured. Use guest login.' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const sb = getSupabaseAdmin();

    // 1. Verify credentials via Supabase Auth
    const { data, error } = await sb.auth.signInWithPassword({
      email:    email.toLowerCase().trim(),
      password,
    });

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 2. Read profile (created at registration; create on first login if missing)
    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const displayName = profile?.display_name ||
                        data.user.user_metadata?.full_name ||
                        data.user.email?.split('@')[0] || 'User';
    const avatar      = profile?.avatar_url || generateAvatar(displayName);

    // Ensure profile exists (handles users who registered before this migration)
    if (!profile) {
      await upsertProfile(sb, {
        id: data.user.id, displayName, avatarUrl: avatar,
        email: data.user.email, provider: 'email',
      });
    } else {
      // Update last_seen
      sb.from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', data.user.id)
        .then(() => {}).catch(() => {});
    }

    const userPayload = {
      userId:      data.user.id,
      displayName,
      email:       data.user.email,
      avatar,
      provider:    'email',
      role:        'user',
    };

    const token = signToken(userPayload);
    logger.info('User logged in', { userId: data.user.id });
    res.json({ token, user: userPayload });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/supabase-callback — Google OAuth via Supabase
// Frontend sends the Supabase access_token; we verify it server-side.
// ─────────────────────────────────────────────────────────────────────────────
export async function supabaseCallback(req, res, next) {
  try {
    const { supabaseToken, displayName, avatar } = req.body;

    if (!supabaseToken) {
      return res.status(400).json({ error: 'Missing supabaseToken' });
    }
    if (!isSupabaseConnected()) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const sb = getSupabaseAdmin();

    // Verify the Supabase token — never trust client-sent userId/email
    const { data: { user: sbUser }, error: authErr } = await sb.auth.getUser(supabaseToken);
    if (authErr || !sbUser) {
      return res.status(401).json({ error: 'Invalid Supabase token' });
    }

    const userId      = sbUser.id;
    const email       = sbUser.email;
    const name        = displayName ||
                        sbUser.user_metadata?.full_name ||
                        sbUser.user_metadata?.name ||
                        email?.split('@')[0] || 'User';
    const avatarUrl   = avatar ||
                        sbUser.user_metadata?.avatar_url ||
                        sbUser.user_metadata?.picture ||
                        generateAvatar(userId);

    // Upsert profile (creates on first OAuth login, updates on subsequent)
    await upsertProfile(sb, {
      id: userId, displayName: name, avatarUrl, email, provider: 'google',
    });

    const userPayload = { userId, displayName: name, email, avatar: avatarUrl, provider: 'google', role: 'user' };
    const token = signToken(userPayload);

    logger.info('Google OAuth login', { userId, email });
    res.json({ token, user: userPayload });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /auth/profile — update display name / avatar (non-guests only)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateProfile(req, res, next) {
  try {
    if (req.user.provider === 'guest') {
      return res.status(403).json({ error: 'Guests cannot update their profile' });
    }
    if (!isSupabaseConnected()) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { displayName, avatar } = req.body;
    const updates = {};
    if (displayName?.trim()) updates.display_name = displayName.trim().slice(0, 30);
    if (avatar?.trim())      updates.avatar_url   = avatar.trim();

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('profiles')
      .update(updates)
      .eq('id', req.user.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      user: {
        userId:      data.id,
        displayName: data.display_name,
        email:       data.email,
        avatar:      data.avatar_url,
        provider:    data.provider,
        role:        'user',
      },
    });
  } catch (err) {
    next(err);
  }
}
