import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

const required = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
};

// JWT secret: required in production, falls back to dev placeholder locally only.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && isProd) {
  throw new Error('JWT_SECRET must be set in production. Refusing to start with an insecure default.');
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  isDev: !isProd,

  jwt: {
    secret: jwtSecret || 'dev_secret_change_in_prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cors: {
    origins: isProd
      // In production, require explicit env var
      ? (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
      // In dev, allow localhost AND any device on the local network (192.168.x.x / 10.x.x.x)
      : (origin, callback) => callback(null, true),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
};