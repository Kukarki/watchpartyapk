import { Router } from 'express';
import {
  guestLogin, register, login,
  getMe, updateProfile, supabaseCallback,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/guest',             authLimiter, guestLogin);
router.post('/register',          authLimiter, register);
router.post('/login',             authLimiter, login);
router.post('/supabase-callback', authLimiter, supabaseCallback);
router.get('/me',                 authenticate, getMe);
router.patch('/profile',          authenticate, updateProfile);

export default router;