import { createClient } from '@supabase/supabase-js';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

let supabaseClient     = null;
let supabaseAdminClient = null;
let supabaseConnected = false;

export function getSupabase() {
  if (!config.supabase.url || !config.supabase.anonKey) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(config.supabase.url, config.supabase.anonKey);
  }
  return supabaseClient;
}

// Admin client — bypasses RLS, used for server-side operations
export function getSupabaseAdmin() {
  if (!config.supabase.url || !config.supabase.serviceKey) return null;
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      config.supabase.url,
      config.supabase.serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return supabaseAdminClient;
}

export function isSupabaseConnected() {
  return supabaseConnected;
}

export async function testSupabaseConnection() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    supabaseConnected = false;
    logger.info('Supabase not configured — running without persistence');
    return false;
  }
  try {
    const { error } = await sb.from('rooms').select('room_id').limit(1);
    if (error) throw error;
    supabaseConnected = true;
    logger.info('Supabase connected');
    return true;
  } catch (err) {
    supabaseConnected = false;
    logger.warn('Supabase connection failed — running without persistence', {
      reason: err.message,
    });
    return false;
  }
}
