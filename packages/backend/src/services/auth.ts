import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { ADMIN_USERNAMES } from '../config/constants.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

const BCRYPT_ROUNDS = 12;

interface TokenPayload {
  userId: string;
  username: string;
  type: 'access' | 'refresh';
}

interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  username?: string;
}

export class AuthService {
  private static readonly JWT_SECRET = (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return secret;
  })();
  private static readonly JWT_ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY || '15m') as string | number;
  private static readonly JWT_REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY || '7d') as string | number;

  /**
   * Generate JWT access token (15min expiry)
   */
  static generateAccessToken(userId: string, username: string): string {
    const payload: TokenPayload = { userId, username, type: 'access' };
    const options = { expiresIn: this.JWT_ACCESS_EXPIRY } as SignOptions;
    return jwt.sign(payload, this.JWT_SECRET, options);
  }

  /**
   * Generate JWT refresh token (7 day expiry)
   */
  static generateRefreshToken(userId: string, username: string): string {
    const payload: TokenPayload = { userId, username, type: 'refresh' };
    const options = { expiresIn: this.JWT_REFRESH_EXPIRY } as SignOptions;
    return jwt.sign(payload, this.JWT_SECRET, options);
  }

  /**
   * Verify and decode JWT token, optionally checking the token type
   */
  static verifyToken(token: string, expectedType?: 'access' | 'refresh'): TokenPayload | null {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      if (expectedType && payload.type !== expectedType) {
        return null;
      }
      return payload;
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
   * Create a new local (email/password) user account
   */
  static async createLocalUser(email: string, username: string, password: string): Promise<{ userId: string; username: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toUpperCase().trim();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    try {
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          username: normalizedUsername,
          passwordHash,
        },
      });
      return { userId: user.id, username: user.username };
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        if (field === 'email') throw new Error('An account with this email already exists');
        if (field === 'username') throw new Error('This username is already taken');
      }
      throw error;
    }
  }

  /**
   * Verify email/password credentials — timing-safe (always runs bcrypt)
   */
  static async verifyLocalUser(email: string, password: string): Promise<{ userId: string; username: string } | null> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, username: true, passwordHash: true },
    });

    // Always run bcrypt.compare to prevent timing attacks
    const hashToCompare = user?.passwordHash ?? '$2b$12$invalidhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn';
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) return null;
    return { userId: user.id, username: user.username };
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
