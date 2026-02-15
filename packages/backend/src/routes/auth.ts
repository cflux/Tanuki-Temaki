import express from 'express';
import passport from '../config/passport';
import { AuthService } from '../services/auth';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Google OAuth - Initiate
router.get('/google', passport.authenticate('google', { scope: ['profile'], session: false }));

// Google OAuth - Callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const user = req.user as { userId: string; username: string | null; isNewUser: boolean };

    // Generate tokens
    const accessToken = AuthService.generateAccessToken(user.userId, user.username || 'temporary');
    const refreshToken = AuthService.generateRefreshToken(user.userId, user.username || 'temporary');

    // Set httpOnly cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Redirect to frontend with status
    if (user.isNewUser || !user.username) {
      res.redirect(`${FRONTEND_URL}/auth/callback?status=needs_username`);
    } else {
      res.redirect(`${FRONTEND_URL}/auth/callback?status=success`);
    }
  }
);

// GitHub OAuth - Initiate
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));

// GitHub OAuth - Callback
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const user = req.user as { userId: string; username: string | null; isNewUser: boolean };

    // Generate tokens
    const accessToken = AuthService.generateAccessToken(user.userId, user.username || 'temporary');
    const refreshToken = AuthService.generateRefreshToken(user.userId, user.username || 'temporary');

    // Set httpOnly cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Redirect to frontend with status
    if (user.isNewUser || !user.username) {
      res.redirect(`${FRONTEND_URL}/auth/callback?status=needs_username`);
    } else {
      res.redirect(`${FRONTEND_URL}/auth/callback?status=success`);
    }
  }
);

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await AuthService.getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching current user:', error);
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
  res.cookie('access_token', newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.json({ success: true });
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
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
    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, username });
  } catch (error) {
    console.error('Error updating username:', error);
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
    console.error('Error checking username availability:', error);
    res.status(500).json({ error: 'Failed to check username availability' });
  }
});

export default router;
