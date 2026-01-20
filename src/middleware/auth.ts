import { Request, Response, NextFunction } from 'express';
import CryptoJS from 'crypto-js';
import { logger } from '../utils/logger.js';
import { MCPServerConfig } from '../config.js';
import { verifyToken as verifyOAuthToken, GitHubOAuthConfig } from '../oauth/github.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKeyName?: string;
      permissions?: string[];
    }
  }
}

export function hashApiKey(key: string): string {
  return `sha256:${CryptoJS.SHA256(key).toString()}`;
}

export function verifyApiKey(key: string, hash: string): boolean {
  return hashApiKey(key) === hash;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = req.app.locals.config as MCPServerConfig;

  // Extract token from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  // Try API key first
  const matchedKey = config.auth.api_keys.find(k => verifyApiKey(token, k.key_hash));

  if (matchedKey) {
    // Attach key info to request
    req.apiKeyName = matchedKey.name;
    req.permissions = matchedKey.permissions;

    logger.debug('Authenticated via API key', {
      apiKeyName: matchedKey.name,
      path: req.path
    });

    return next();
  }

  // Try OAuth JWT if configured
  if (config.auth.oauth?.enabled) {
    const jwtSecret = config.auth.oauth.jwt_secret || process.env.JWT_SECRET;
    if (jwtSecret) {
      const oauthConfig: GitHubOAuthConfig = {
        clientId: config.auth.oauth.client_id || '',
        jwtSecret,
      };

      const decoded = verifyOAuthToken(oauthConfig, token);
      if (decoded) {
        // Check allowed users if configured
        const allowedUsers = config.auth.oauth.allowed_users;
        if (allowedUsers && allowedUsers.length > 0) {
          if (!allowedUsers.includes(decoded.sub)) {
            logger.warn('User not in allowed list', {
              user: decoded.sub,
              ip: req.ip,
            });
            return res.status(403).json({ error: 'User not authorized' });
          }
        }

        // Attach OAuth user info to request
        req.apiKeyName = `github:${decoded.sub}`;
        req.permissions = ['*']; // OAuth users get full access

        logger.debug('Authenticated via OAuth', {
          user: decoded.sub,
          path: req.path
        });

        return next();
      }
    }
  }

  logger.warn('Invalid credentials', {
    ip: req.ip,
    path: req.path
  });
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Check if a permission pattern matches a resource
export function checkPermission(permissions: string[], resource: string): boolean {
  for (const permission of permissions) {
    if (permission === '*') return true;
    if (permission === resource) return true;
    
    // Wildcard matching (e.g., "mcps/*" matches "mcps/stripe")
    if (permission.endsWith('/*')) {
      const prefix = permission.slice(0, -1);
      if (resource.startsWith(prefix)) return true;
    }
  }
  return false;
}

export function requirePermission(resource: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.permissions || !checkPermission(req.permissions, resource)) {
      logger.warn('Permission denied', {
        apiKeyName: req.apiKeyName,
        resource,
        permissions: req.permissions
      });
      return res.status(403).json({ error: 'Permission denied' });
    }
    next();
  };
}
