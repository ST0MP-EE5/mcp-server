import { Router, Request, Response } from 'express';
import { MCPServerConfig, loadSkillContent, loadConfigContent } from '../config.js';
import { requirePermission } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export function createRegistryRouter(): Router {
  const router = Router();

  // Get full registry
  router.get('/registry', requirePermission('registry'), (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    
    res.json({
      name: config.name,
      version: config.version,
      mcps: {
        external: config.mcps.external.filter(m => m.enabled).map(m => ({
          name: m.name,
          url: m.url,
          hasAuth: !!m.auth
        })),
        local: config.mcps.local.filter(m => m.enabled).map(m => ({
          name: m.name,
          port: m.port
        }))
      },
      skills: config.skills.map(s => ({
        name: s.name,
        description: s.description,
        tags: s.tags
      })),
      plugins: config.plugins.map(p => ({
        name: p.name,
        description: p.description,
        runtime: p.runtime
      })),
      hooks: config.hooks.map(h => ({
        name: h.name,
        trigger: h.trigger
      })),
      configs: Object.keys(config.configs)
    });
  });

  // List MCPs
  router.get('/registry/mcps', requirePermission('mcps/*'), (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    
    const mcps = [
      ...config.mcps.external.filter(m => m.enabled).map(m => ({
        name: m.name,
        type: 'external',
        url: m.url,
        hasAuth: !!m.auth
      })),
      ...config.mcps.local.filter(m => m.enabled).map(m => ({
        name: m.name,
        type: 'local',
        port: m.port
      }))
    ];
    
    res.json({ mcps });
  });

  // List skills
  router.get('/registry/skills', requirePermission('skills/*'), (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    
    res.json({
      skills: config.skills.map(s => ({
        name: s.name,
        description: s.description,
        tags: s.tags
      }))
    });
  });

  // Get specific skill content
  router.get('/skills/:name', requirePermission('skills/*'), async (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    const { name } = req.params;
    
    const content = await loadSkillContent(config, name);
    
    if (!content) {
      return res.status(404).json({ error: `Skill '${name}' not found` });
    }
    
    // Return as plain text for easy consumption
    res.type('text/markdown').send(content);
  });

  // List plugins
  router.get('/registry/plugins', requirePermission('plugins/*'), (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    
    res.json({
      plugins: config.plugins.map(p => ({
        name: p.name,
        description: p.description,
        runtime: p.runtime
      }))
    });
  });

  // List configs
  router.get('/registry/configs', requirePermission('configs/*'), (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    
    res.json({
      configs: Object.entries(config.configs).map(([key, value]) => ({
        name: key,
        file: value.file
      }))
    });
  });

  // Get specific config content
  router.get('/configs/:name', requirePermission('configs/*'), async (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    const { name } = req.params;
    
    const content = await loadConfigContent(config, name);
    
    if (!content) {
      return res.status(404).json({ error: `Config '${name}' not found` });
    }
    
    res.type('text/plain').send(content);
  });

  // Trigger a hook manually
  router.post('/hooks/:name/trigger', requirePermission('hooks/*'), async (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    const { name } = req.params;
    
    const hook = config.hooks.find(h => h.name === name);
    
    if (!hook) {
      return res.status(404).json({ error: `Hook '${name}' not found` });
    }
    
    // TODO: Implement hook execution
    logger.info(`Hook triggered: ${name}`, { payload: req.body });
    
    res.json({ 
      success: true, 
      message: `Hook '${name}' triggered`,
      hook: {
        name: hook.name,
        trigger: hook.trigger
      }
    });
  });

  // Sync from git (if configured)
  router.post('/sync', requirePermission('admin'), async (req: Request, res: Response) => {
    // TODO: Implement git sync
    res.json({ success: true, message: 'Sync not yet implemented' });
  });

  // Hot reload config
  router.post('/reload', requirePermission('admin'), async (req: Request, res: Response) => {
    try {
      const { loadConfig } = await import('../config.js');
      const newConfig = await loadConfig('./mcp-config.yaml');
      req.app.locals.config = newConfig;
      
      logger.info('Configuration manually reloaded');
      res.json({ success: true, message: 'Configuration reloaded' });
    } catch (error) {
      logger.error('Failed to reload config:', error);
      res.status(500).json({ error: 'Failed to reload configuration' });
    }
  });

  // Logs endpoint
  router.get('/logs', requirePermission('admin'), (req: Request, res: Response) => {
    // Return recent logs (simplified implementation)
    res.json({ message: 'Logs endpoint - check logs/combined.log' });
  });

  return router;
}
