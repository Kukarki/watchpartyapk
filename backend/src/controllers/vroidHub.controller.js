import { vroidHubService } from '../services/vroidHub.service.js';
import { isSupabaseConnected } from '../config/supabase.js';
import { config } from '../config/index.js';

export async function getAuthUrl(req, res, next) {
  try {
    if (!config.vroidHub.clientId) {
      return res.status(503).json({ error: 'VRoid Hub is not configured on this server yet' });
    }
    const url = vroidHubService.getAuthUrl(req.user.userId);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function handleCallback(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.status(503).json({ error: 'Database not configured' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });
    const result = await vroidHubService.connectAccount(req.user.userId, code);
    res.json({ connected: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listModels(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.json({ connected: false, models: [] });
    const data = await vroidHubService.listModels(req.user.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function selectModel(req, res, next) {
  try {
    const { modelId } = req.body;
    if (!modelId) return res.status(400).json({ error: 'modelId is required' });
    await vroidHubService.selectModel(req.user.userId, modelId);
    res.json({ selected: true, modelId });
  } catch (err) {
    next(err);
  }
}

export async function getAvatarUrl(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.json({ vrmUrl: null });
    const vrmUrl = await vroidHubService.getSelectedAvatarUrl(req.user.userId);
    res.json({ vrmUrl });
  } catch (err) {
    next(err);
  }
}

export async function disconnect(req, res, next) {
  try {
    await vroidHubService.disconnectAccount(req.user.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
