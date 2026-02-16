/**
 * Token Exchange Service
 * Handles temporary tokens for OAuth callback scenarios where cookies can't be set directly
 * due to domain mismatch (e.g., localhost OAuth callback → IP address frontend)
 */

import { randomBytes } from 'crypto';

interface ExchangeTokenData {
  userId: string;
  username: string | null;
  isNewUser: boolean;
  expiresAt: number;
}

// In-memory store for exchange tokens (expires after 2 minutes)
const exchangeTokens = new Map<string, ExchangeTokenData>();

const TOKEN_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Generate a one-time exchange token
 */
export function createExchangeToken(userId: string, username: string | null, isNewUser: boolean): string {
  // Generate cryptographically secure random token
  const token = randomBytes(32).toString('hex');

  // Store with expiration
  exchangeTokens.set(token, {
    userId,
    username,
    isNewUser,
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
  });

  // Clean up expired tokens periodically
  cleanupExpiredTokens();

  return token;
}

/**
 * Exchange a token for user data (one-time use)
 */
export function exchangeToken(token: string): ExchangeTokenData | null {
  const data = exchangeTokens.get(token);

  if (!data) {
    return null;
  }

  // Check expiration
  if (Date.now() > data.expiresAt) {
    exchangeTokens.delete(token);
    return null;
  }

  // Delete token after use (one-time use)
  exchangeTokens.delete(token);

  return data;
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, data] of exchangeTokens.entries()) {
    if (now > data.expiresAt) {
      exchangeTokens.delete(token);
    }
  }
}
