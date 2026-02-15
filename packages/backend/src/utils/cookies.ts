/**
 * Cookie utility functions for authentication
 * Centralizes cookie configuration and setting logic
 */
import type { Response } from 'express';
import { COOKIE_CONFIG } from '../config/constants.js';

/**
 * Set authentication cookies (access token and refresh token)
 * Uses centralized cookie configuration for consistency
 *
 * @param res - Express response object
 * @param accessToken - JWT access token
 * @param refreshToken - JWT refresh token
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  res.cookie(
    COOKIE_CONFIG.ACCESS_TOKEN.name,
    accessToken,
    COOKIE_CONFIG.ACCESS_TOKEN
  );

  res.cookie(
    COOKIE_CONFIG.REFRESH_TOKEN.name,
    refreshToken,
    COOKIE_CONFIG.REFRESH_TOKEN
  );
}

/**
 * Clear authentication cookies (used for logout)
 *
 * @param res - Express response object
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_CONFIG.ACCESS_TOKEN.name);
  res.clearCookie(COOKIE_CONFIG.REFRESH_TOKEN.name);
}
