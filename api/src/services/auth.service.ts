import crypto from 'crypto';
import type { IUser } from '../models/User';
import { generateTokens } from '../utils/jwt';

// Refresh tokens are hashed before storage so that a DB breach does not expose
// tokens that could be replayed directly against the refresh endpoint.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const MAX_CONCURRENT_SESSIONS = 10;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Generate a new access + refresh token pair, store the refresh token hash on
 * the user document, and return the raw tokens to send to the client.
 *
 * This is the single authoritative place where tokens are issued. Every auth
 * flow (OTP verify, Google, Apple, register, login, refresh rotation) must go
 * through this function so the DB and the client stay in sync.
 */
export async function issueAndStoreTokens(
  user: IUser
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokens = generateTokens({
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
    subscription: user.subscription,
    role: user.role,
    orgId: user.orgId?.toString(),
  });

  const hash = hashToken(tokens.refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  if (!user.refreshTokenHashes) {
    user.refreshTokenHashes = [];
  }

  // Drop the oldest sessions when the cap is reached so the array never grows
  // unbounded while still supporting the expected number of concurrent devices.
  if (user.refreshTokenHashes.length >= MAX_CONCURRENT_SESSIONS) {
    user.refreshTokenHashes = user.refreshTokenHashes.slice(
      -(MAX_CONCURRENT_SESSIONS - 1)
    );
  }

  user.refreshTokenHashes.push({ hash, createdAt: new Date(), expiresAt });
  await user.save();

  return tokens;
}
