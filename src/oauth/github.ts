// GitHub OAuth with Device Flow for CLI tools (Claude Code, Codex)

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret?: string; // Optional for device flow
  jwtSecret: string;
  tokenExpiry?: string; // e.g., '7d', '30d'
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export interface OAuthToken {
  access_token: string;
  token_type: string;
  scope: string;
}

/**
 * Start GitHub Device Flow - returns code for user to enter
 */
export async function startDeviceFlow(config: GitHubOAuthConfig): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      scope: 'read:user user:email',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub device flow failed: ${error}`);
  }

  return response.json() as Promise<DeviceCodeResponse>;
}

/**
 * Poll for access token after user enters code
 */
export async function pollForToken(
  config: GitHubOAuthConfig,
  deviceCode: string,
  _interval: number = 5
): Promise<OAuthToken | null> {
  const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  const data = await response.json() as any;

  if (data.error) {
    if (data.error === 'authorization_pending') {
      return null; // User hasn't entered code yet
    }
    if (data.error === 'slow_down') {
      return null; // Need to slow down polling
    }
    if (data.error === 'expired_token') {
      throw new Error('Device code expired. Please start again.');
    }
    if (data.error === 'access_denied') {
      throw new Error('User denied access.');
    }
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    scope: data.scope,
  };
}

/**
 * Get GitHub user from access token
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'User-Agent': 'MCP-Server',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get GitHub user: ${response.status}`);
  }

  return response.json() as Promise<GitHubUser>;
}

/**
 * Generate JWT for authenticated user
 */
export function generateToken(config: GitHubOAuthConfig, user: GitHubUser): string {
  const expiresIn = config.tokenExpiry || '7d';

  return jwt.sign(
    {
      sub: user.login,
      github_id: user.id,
      name: user.name,
      email: user.email,
      type: 'oauth',
    },
    config.jwtSecret,
    { expiresIn } as jwt.SignOptions
  );
}

/**
 * Verify JWT and return user info
 */
export function verifyToken(config: GitHubOAuthConfig, token: string): {
  sub: string;
  github_id: number;
  name: string | null;
  email: string | null;
  type: 'oauth';
} | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    if (decoded.type !== 'oauth') {
      return null;
    }
    return decoded;
  } catch (error: any) {
    logger.debug('JWT verification failed', { error: error.message });
    return null;
  }
}
