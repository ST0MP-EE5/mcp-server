import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { loadConfig, watchConfig } from './config.js';
import { createRegistryRouter } from './routes/registry.js';
import { createMCPGateway, setupGracefulShutdown } from './mcp-gateway.js';
import { authMiddleware } from './middleware/auth.js';
import { logger } from './utils/logger.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function main() {
  const app = express();

  // Trust proxy - required for DigitalOcean App Platform and other PaaS
  app.set('trust proxy', true);
  const server = createServer(app);

  // Load configuration
  const config = await loadConfig('./mcp-server.yaml');

  // Watch for config changes (hot reload)
  watchConfig('./mcp-server.yaml', (newConfig) => {
    logger.info('Configuration reloaded');
    app.locals.config = newConfig;
  });
  
  app.locals.config = config;

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false // Needed for SSE
  }));
  
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // requests per window
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.text({ limit: '1mb' }));

  // Health check (public, JSON output)
  app.get('/health', (req, res) => {
    res.json({ 
      ok: true,
      status: 'healthy', 
      version: '1.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  // API routes (authenticated)
  app.use('/api/v1', authMiddleware, createRegistryRouter());

  // MCP Gateway (authenticated)
  createMCPGateway(app, '/mcp');

  // 404 handler (JSON)
  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` }
    });
  });

  // Error handling (JSON)
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ 
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  });

  // Setup graceful shutdown
  setupGracefulShutdown();

  server.listen(PORT, () => {
    logger.info(`AI Hub started`, { port: PORT });
    
    // Output startup info as JSON for AI consumption
    if (process.env.NODE_ENV !== 'production') {
      console.log(JSON.stringify({
        ok: true,
        event: 'server_started',
        port: PORT,
        endpoints: {
          health: `http://localhost:${PORT}/health`,
          mcp_sse: `http://localhost:${PORT}/mcp/sse`,
          mcp_health: `http://localhost:${PORT}/mcp/health`,
          registry: `http://localhost:${PORT}/api/v1/registry`
        }
      }, null, 2));
    }
  });
}

main().catch((err) => {
  console.error(JSON.stringify({
    ok: false,
    event: 'startup_failed',
    error: { code: 'STARTUP_ERROR', message: err.message }
  }));
  process.exit(1);
});
