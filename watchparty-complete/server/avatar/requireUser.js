// Verifies the Supabase access token from `Authorization: Bearer <jwt>`
// and puts the user on req.user. If your backend already has an auth
// middleware that does this, use that instead and delete this file.
const { getSupabase } = require('./supabaseClient');

async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing bearer token' });

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
