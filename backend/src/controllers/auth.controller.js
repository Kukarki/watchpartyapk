import { v4 as uuidv4 } from 'uuid';
import { signToken } from '../utils/jwt.js';
import { getSupabaseAdmin, isSupabaseConnected } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { generateAvatar } from '../utils/avatar.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: upsert a row into `profiles` (non-fatal — DB down ≠ login fail)
// ─────────────────────────────────────────────────────────────────────────────
async function upsertProfile(sb, { id, displayName, avatarUrl, email = null, provider, dateOfBirth = null, ageVerified = null }) {
  const row = {
    id,
    display_name: displayName,
    avatar_url:   avatarUrl,
    email:        email || null,
    provider,
    last_seen_at: new Date().toISOString(),
  };
  if (dateOfBirth !== null) row.date_of_birth = dateOfBirth;
  if (ageVerified !== null) row.age_verified  = ageVerified;
  const { error } = await sb.from('profiles').upsert(row, { onConflict: 'id' });
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
      return res.status(503).json({ error: 'Database not configured.' });
    }
    const { displayName, email, password, dateOfBirth } = req.body;
    if (!displayName?.trim())             return res.status(400).json({ error: 'Name is required' });
    if (!email?.trim())                   return res.status(400).json({ error: 'Email is required' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!dateOfBirth)                     return res.status(400).json({ error: 'Date of birth is required' });
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return res.status(400).json({ error: 'Invalid date of birth' });
    const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 18)  return res.status(403).json({ error: 'You must be 18 or older to create an account' });
    if (ageYears > 120) return res.status(400).json({ error: 'Please enter a valid date of birth' });

    const sb   = getSupabaseAdmin();
    const name = displayName.trim().slice(0, 30);
    const cleanEmail = email.toLowerCase().trim();

    // Use signUp() so Supabase creates an UNCONFIRMED user and sends the
    // confirmation email itself (via the configured Resend SMTP).
    const redirectTo = (process.env.PUBLIC_URL || 'https://sandipwatch7.dedyn.io') + '/login';
    const { data, error } = await sb.auth.signUp({
      email:    cleanEmail,
      password,
      options: {
        data: { full_name: name, date_of_birth: dob.toISOString().slice(0,10) },
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      if (error.message?.toLowerCase().includes('already') ||
          error.message?.toLowerCase().includes('registered')) {
        return res.status(409).json({ error: 'Email already registered. Try signing in, or check your inbox to confirm.' });
      }
      throw error;
    }

    // Store profile now (id from signUp). Age is verified at signup time.
    if (data.user?.id) {
      const avatar = generateAvatar(name);
      await upsertProfile(sb, {
        id: data.user.id, displayName: name, avatarUrl: avatar,
        email: cleanEmail, provider: 'email',
        dateOfBirth: dob.toISOString().slice(0, 10), ageVerified: true,
      });
    }

    logger.info('User signed up (pending email confirmation)', { email: cleanEmail });
    res.status(201).json({
      pendingConfirmation: true,
      message: 'Account created! Check your email for the confirmation link, then sign in.',
    });
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
      const msg = error?.message?.toLowerCase() || '';
      if (msg.includes('not confirmed') || msg.includes('email')) {
        return res.status(403).json({ error: 'Please confirm your email first. Check your inbox for the confirmation link.' });
      }
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

    // Check existing age verification status before upsert
    const { data: existing } = await sb.from('profiles')
      .select('age_verified').eq('id', userId).single();
    const ageVerified = existing?.age_verified === true;

    await upsertProfile(sb, {
      id: userId, displayName: name, avatarUrl, email, provider: 'google',
    });

    const userPayload = { userId, displayName: name, email, avatar: avatarUrl, provider: 'google', role: 'user', ageVerified };
    const token = signToken(userPayload);

    logger.info('Google OAuth login', { userId, email, ageVerified });
    res.json({ token, user: userPayload, ageVerified });
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


// ── Age verification for OAuth users (one-time DOB confirmation) ──
export async function verifyAge(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.status(503).json({ error: 'Database not configured' });
    const { userId } = req.user;
    const { dateOfBirth } = req.body;
    if (!dateOfBirth) return res.status(400).json({ error: 'Date of birth is required' });
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return res.status(400).json({ error: 'Invalid date of birth' });
    const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 18)  return res.status(403).json({ error: 'You must be 18 or older' });
    if (ageYears > 120) return res.status(400).json({ error: 'Please enter a valid date of birth' });

    const sb = getSupabaseAdmin();
    const { error } = await sb.from('profiles').update({
      date_of_birth: dob.toISOString().slice(0, 10),
      age_verified:  true,
    }).eq('id', userId);
    if (error) throw error;

    res.json({ ageVerified: true });
  } catch (err) {
    next(err);
  }
}