import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { ADMIN_USERNAMES } from '../config/constants';
import { logger } from '../lib/logger.js';

const prisma = new PrismaClient();

interface TokenPayload {
  userId: string;
  username: string;
}

interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  username?: string;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  private static readonly JWT_ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY || '15m') as string | number;
  private static readonly JWT_REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY || '7d') as string | number;

  /**
   * Generate JWT access token (15min expiry)
   */
  static generateAccessToken(userId: string, username: string): string {
    const payload: TokenPayload = { userId, username };
    const options = { expiresIn: this.JWT_ACCESS_EXPIRY } as SignOptions;
    return jwt.sign(payload, this.JWT_SECRET, options);
  }

  /**
   * Generate JWT refresh token (7 day expiry)
   */
  static generateRefreshToken(userId: string, username: string): string {
    const payload: TokenPayload = { userId, username };
    const options = { expiresIn: this.JWT_REFRESH_EXPIRY } as SignOptions;
    return jwt.sign(payload, this.JWT_SECRET, options);
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, this.JWT_SECRET) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find or create user from OAuth profile
   */
  static async findOrCreateOAuthUser(profile: OAuthProfile): Promise<{ userId: string; username: string | null; isNewUser: boolean }> {
    // Check if OAuth identity exists
    const oauthIdentity = await prisma.oAuthIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: profile.provider,
          providerId: profile.providerId,
        },
      },
      include: {
        user: true,
      },
    });

    if (oauthIdentity) {
      // Existing user
      return {
        userId: oauthIdentity.user.id,
        username: oauthIdentity.user.username,
        isNewUser: false,
      };
    }

    // New user - create without username (will be set later)
    const user = await prisma.user.create({
      data: {
        username: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`, // Temporary username
        oauthIdentities: {
          create: {
            provider: profile.provider,
            providerId: profile.providerId,
          },
        },
      },
    });

    return {
      userId: user.id,
      username: null, // No username set yet
      isNewUser: true,
    };
  }

  /**
   * Update user's username
   */
  static async updateUsername(userId: string, username: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { username: username.toUpperCase() },
    });
  }

  /**
   * Check if username is available (case-insensitive)
   */
  static async isUsernameAvailable(username: string): Promise<boolean> {
    const normalizedUsername = username.toUpperCase();
    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });
    return !existingUser;
  }

  /**
   * Validate username format
   * - 3-20 characters
   * - Alphanumeric, underscores, hyphens only
   * - Must start with a letter or number
   */
  static validateUsernameFormat(username: string): { valid: boolean; error?: string } {
    if (!username || username.length < 3 || username.length > 20) {
      return { valid: false, error: 'Username must be 3-20 characters long' };
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(username)) {
      return { valid: false, error: 'Username must start with a letter or number and contain only letters, numbers, underscores, or hyphens' };
    }

    return { valid: true };
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return null;
    }

    const isAdmin = ADMIN_USERNAMES.has(user.username.toUpperCase());
    logger.debug('Admin check', {
      username: user.username,
      isAdmin,
    });

    return {
      ...user,
      isAdmin,
    };
  }
}
