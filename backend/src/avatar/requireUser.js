// Accepts EITHER the backend's own JWT (email/password + guest users)
// OR a Supabase access token (OAuth users), so the avatar system works
// regardless of how the user authenticated.
const { getSupabase } = require('./supabaseClient');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod';

async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing bearer token' });

    // 1. Try the backend's own JWT first — fast, no network call.
    //    The backend signs { userId, ... } with JWT_SECRET; userId IS the
    //    Supabase UUID so req.user.id is consistent either way.
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.userId) {
        req.user = { id: decoded.userId, ...decoded };
        return next();
      }
    } catch {
      // Not a backend JWT — fall through to Supabase check.
    }

    // 2. Fall back to Supabase JWT (Google / Apple OAuth users).
    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'invalid or expired token' });
    }
    req.user = data.user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireUser };
