import { Request, Response, NextFunction } from 'express';
import CryptoJS from 'crypto-js';
import { logger } from '../utils/logger.js';
import { MCPServerConfig } from '../config.js';

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
  
  // Extract API key from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const apiKey = authHeader.substring(7);
  
  // Find matching API key
  const matchedKey = config.auth.api_keys.find(k => verifyApiKey(apiKey, k.key_hash));
  
  if (!matchedKey) {
    logger.warn('Invalid API key', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Attach key info to request
  req.apiKeyName = matchedKey.name;
  req.permissions = matchedKey.permissions;

  logger.debug('Authenticated request', {
    apiKeyName: matchedKey.name,
    path: req.path
  });

  next();
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
