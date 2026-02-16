import express from 'express';
import passport from '../config/passport';
import { AuthService } from '../services/auth';
import { requireAuth } from '../middleware/auth';
import { FRONTEND_URL, COOKIE_CONFIG } from '../config/constants.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';
import { logger } from '../lib/logger.js';
import { createExchangeToken, exchangeToken } from '../services/tokenExchange.js';

const router: express.Router = express.Router();

// Google OAuth - Initiate
router.get('/google', passport.authenticate('google', { scope: ['profile'], session: false }));

// Google OAuth - Callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const user = req.user as unknown as { userId: string; username: string | null; isNewUser: boolean };

    // Create one-time exchange token instead of setting cookies
    // This allows OAuth to work across different domains (localhost → IP address)
    const token = createExchangeToken(user.userId, user.username, user.isNewUser);

    // Redirect to frontend with exchange token
    const status = user.isNewUser || !user.username ? 'needs_username' : 'success';
    res.redirect(`${FRONTEND_URL}/auth/callback?status=${status}&token=${token}`);
  }
);

// GitHub OAuth - Initiate
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));

// GitHub OAuth - Callback
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const user = req.user as unknown as { userId: string; username: string | null; isNewUser: boolean };

    // Create one-time exchange token instead of setting cookies
    // This allows OAuth to work across different domains (localhost → IP address)
    const token = createExchangeToken(user.userId, user.username, user.isNewUser);

    // Redirect to frontend with exchange token
    const status = user.isNewUser || !user.username ? 'needs_username' : 'success';
    res.redirect(`${FRONTEND_URL}/auth/callback?status=${status}&token=${token}`);
  }
);

// Exchange one-time token for auth cookies
router.post('/exchange', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  // Exchange token for user data
  const userData = exchangeToken(token);

  if (!userData) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Generate JWT tokens
  const accessToken = AuthService.generateAccessToken(userData.userId, userData.username || 'temporary');
  const refreshToken = AuthService.generateRefreshToken(userData.userId, userData.username || 'temporary');

  // Set httpOnly cookies for the current domain
  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    success: true,
    needsUsername: userData.isNewUser || !userData.username
  });
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await AuthService.getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Error fetching current user', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Refresh access token
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  const payload = AuthService.verifyToken(refreshToken);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  // Generate new access token
  const newAccessToken = AuthService.generateAccessToken(payload.userId, payload.username);

  // Set new access token cookie
  res.cookie(COOKIE_CONFIG.ACCESS_TOKEN.name, newAccessToken, COOKIE_CONFIG.ACCESS_TOKEN);

  res.json({ success: true });
});

// Logout
router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true });
});

// Update username
router.patch('/username', requireAuth, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Validate format
    const validation = AuthService.validateUsernameFormat(username);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check availability
    const isAvailable = await AuthService.isUsernameAvailable(username);
    if (!isAvailable) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Update username
    await AuthService.updateUsername(req.user!.userId, username);

    // Generate new tokens with updated username
    const newAccessToken = AuthService.generateAccessToken(req.user!.userId, username);
    const newRefreshToken = AuthService.generateRefreshToken(req.user!.userId, username);

    // Update cookies
    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.json({ success: true, username });
  } catch (error) {
    logger.error('Error updating username', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// Check username availability
router.get('/username/available/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Validate format
    const validation = AuthService.validateUsernameFormat(username);
    if (!validation.valid) {
      return res.json({ available: false, error: validation.error });
    }

    const isAvailable = await AuthService.isUsernameAvailable(username);
    res.json({ available: isAvailable });
  } catch (error) {
    logger.error('Error checking username availability', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Failed to check username availability' });
  }
});

export default router;
