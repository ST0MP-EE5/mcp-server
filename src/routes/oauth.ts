// OAuth routes for GitHub Device Flow

import { Router, Request, Response } from 'express';
import { MCPServerConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  startDeviceFlow,
  pollForToken,
  getGitHubUser,
  generateToken,
  GitHubOAuthConfig,
} from '../oauth/github.js';

// In-memory store for pending device flows
const pendingFlows = new Map<string, {
  deviceCode: string;
  expiresAt: number;
  interval: number;
}>();

// Cleanup expired flows periodically
setInterval(() => {
  const now = Date.now();
  for (const [userCode, flow] of pendingFlows) {
    if (flow.expiresAt < now) {
      pendingFlows.delete(userCode);
    }
  }
}, 60000);

function getOAuthConfig(config: MCPServerConfig): GitHubOAuthConfig | null {
  if (!config.auth.oauth?.enabled || config.auth.oauth.provider !== 'github') {
    return null;
  }

  const clientId = config.auth.oauth.client_id || process.env.GITHUB_CLIENT_ID;
  const jwtSecret = config.auth.oauth.jwt_secret || process.env.JWT_SECRET;

  if (!clientId || !jwtSecret) {
    return null;
  }

  return {
    clientId,
    jwtSecret,
    tokenExpiry: config.auth.oauth.token_expiry || '7d',
  };
}

export function createOAuthRouter(): Router {
  const router = Router();

  /**
   * Start device flow - returns user code to display
   * POST /oauth/device
   */
  router.post('/device', async (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    const oauthConfig = getOAuthConfig(config);

    if (!oauthConfig) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and JWT_SECRET.',
        },
      });
    }

    try {
      const deviceResponse = await startDeviceFlow(oauthConfig);

      // Store for polling
      pendingFlows.set(deviceResponse.user_code, {
        deviceCode: deviceResponse.device_code,
        expiresAt: Date.now() + deviceResponse.expires_in * 1000,
        interval: deviceResponse.interval,
      });

      logger.info('OAuth device flow started', { userCode: deviceResponse.user_code });

      res.json({
        ok: true,
        user_code: deviceResponse.user_code,
        verification_uri: deviceResponse.verification_uri,
        expires_in: deviceResponse.expires_in,
        interval: deviceResponse.interval,
        instructions: `Go to ${deviceResponse.verification_uri} and enter code: ${deviceResponse.user_code}`,
      });
    } catch (error: any) {
      logger.error('OAuth device flow failed', { error: error.message });
      res.status(500).json({
        ok: false,
        error: { code: 'OAUTH_ERROR', message: error.message },
      });
    }
  });

  /**
   * Poll for token - client calls this after user enters code
   * POST /oauth/token
   * Body: { user_code: string }
   */
  router.post('/token', async (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    const oauthConfig = getOAuthConfig(config);

    if (!oauthConfig) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'GitHub OAuth is not configured.',
        },
      });
    }

    const { user_code } = req.body;
    if (!user_code) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_USER_CODE', message: 'user_code is required' },
      });
    }

    const flow = pendingFlows.get(user_code);
    if (!flow) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_USER_CODE', message: 'User code not found or expired' },
      });
    }

    if (flow.expiresAt < Date.now()) {
      pendingFlows.delete(user_code);
      return res.status(400).json({
        ok: false,
        error: { code: 'EXPIRED', message: 'Device code expired. Please start again.' },
      });
    }

    try {
      const oauthToken = await pollForToken(oauthConfig, flow.deviceCode, flow.interval);

      if (!oauthToken) {
        // User hasn't authorized yet
        return res.json({
          ok: true,
          status: 'pending',
          message: 'Waiting for user to authorize. Keep polling.',
          retry_after: flow.interval,
        });
      }

      // Got token - get user info
      const githubUser = await getGitHubUser(oauthToken.access_token);

      // Generate JWT for MCP auth
      const token = generateToken(oauthConfig, githubUser);

      // Clean up
      pendingFlows.delete(user_code);

      logger.info('OAuth authentication successful', { user: githubUser.login });

      res.json({
        ok: true,
        status: 'success',
        token,
        user: {
          id: githubUser.login,
          name: githubUser.name,
          avatar: githubUser.avatar_url,
        },
        usage: {
          header: 'Authorization: Bearer <token>',
          example: `curl -H "Authorization: Bearer ${token.substring(0, 20)}..." https://your-server/mcp/sse`,
        },
      });
    } catch (error: any) {
      logger.error('OAuth token exchange failed', { error: error.message });

      // Check for specific errors
      if (error.message.includes('expired') || error.message.includes('denied')) {
        pendingFlows.delete(user_code);
      }

      res.status(400).json({
        ok: false,
        error: { code: 'TOKEN_ERROR', message: error.message },
      });
    }
  });

  /**
   * Get OAuth status/info
   * GET /oauth/info
   */
  router.get('/info', (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    const oauthConfig = getOAuthConfig(config);

    res.json({
      ok: true,
      oauth: {
        enabled: !!oauthConfig,
        provider: oauthConfig ? 'github' : null,
        instructions: oauthConfig ? [
          '1. POST /oauth/device to start authentication',
          '2. Go to the verification_uri and enter the user_code',
          '3. POST /oauth/token with user_code to get your token',
          '4. Use token as Bearer token for MCP SSE/messages endpoints',
        ] : [
          'OAuth not configured.',
          'Set GITHUB_CLIENT_ID and JWT_SECRET environment variables.',
        ],
      },
    });
  });

  return router;
}
