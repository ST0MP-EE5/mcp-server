import { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MCPServerConfig, loadSkillContent, loadConfigContent, MCPConfig } from './config.js';
import { authMiddleware, verifyApiKey } from './middleware/auth.js';
import { logger } from './utils/logger.js';
import {
  fetchExternalMCPTools,
  routeToExternalMCP,
  initializeExternalMCP,
  getMCPStatus,
  getAllMCPStatus
} from './external-mcp-client.js';

// Types for MCP protocol
interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
}

interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

// SSE Client tracking
interface SSEClient {
  id: string;
  res: Response;
  apiKeyName: string;
}

const clients = new Map<string, SSEClient>();

// Hub's built-in tools
function getHubTools(): MCPTool[] {
  return [
    {
      name: 'mcp__list_mcps',
      description: 'List all available MCPs in the MCP Server',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'mcp__list_skills',
      description: 'List all available skills',
      inputSchema: {
        type: 'object',
        properties: {
          tag: {
            type: 'string',
            description: 'Optional tag to filter skills'
          }
        },
        required: []
      }
    },
    {
      name: 'mcp__get_skill',
      description: 'Get the content of a specific skill',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the skill to retrieve'
          }
        },
        required: ['name']
      }
    },
    {
      name: 'mcp__list_configs',
      description: 'List all available configuration files',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'mcp__get_config',
      description: 'Get the content of a specific configuration file',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the config (e.g., "claude_md", "cursor")'
          }
        },
        required: ['name']
      }
    },
    {
      name: 'mcp__health',
      description: 'Check the health status of the MCP Server and all MCPs',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'mcp__mcp_status',
      description: 'Get detailed status of a specific MCP',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the MCP to check'
          }
        },
        required: ['name']
      }
    }
  ];
}

// Execute hub's built-in tools
async function executeHubTool(
  config: MCPServerConfig,
  toolName: string,
  args: any
): Promise<any> {
  switch (toolName) {
    case 'mcp__list_mcps': {
      const allStatus = getAllMCPStatus();
      const mcps = [
        ...config.mcps.external.filter(m => m.enabled).map(m => ({
          name: m.name,
          type: 'external',
          url: m.url,
          status: allStatus[m.name]?.status || 'unknown'
        })),
        ...config.mcps.local.filter(m => m.enabled).map(m => ({
          name: m.name,
          type: 'local',
          status: 'healthy' // Local MCPs are always healthy if enabled
        }))
      ];
      return { mcps };
    }

    case 'mcp__list_skills': {
      let skills = config.skills;
      if (args.tag) {
        skills = skills.filter(s => s.tags.includes(args.tag));
      }
      return {
        skills: skills.map(s => ({
          name: s.name,
          description: s.description,
          tags: s.tags
        }))
      };
    }

    case 'mcp__get_skill': {
      const content = await loadSkillContent(config, args.name);
      if (!content) {
        throw new Error(`Skill '${args.name}' not found`);
      }
      return { name: args.name, content };
    }

    case 'mcp__list_configs': {
      return {
        configs: Object.entries(config.configs).map(([key, value]) => ({
          name: key,
          file: value.file
        }))
      };
    }

    case 'mcp__get_config': {
      const content = await loadConfigContent(config, args.name);
      if (!content) {
        throw new Error(`Config '${args.name}' not found`);
      }
      return { name: args.name, content };
    }

    case 'mcp__health': {
      const allStatus = getAllMCPStatus();
      const mcpHealth: Record<string, any> = {};

      for (const mcp of config.mcps.external.filter(m => m.enabled)) {
        const status = allStatus[mcp.name] || { status: 'not_initialized', circuitBreaker: 'closed', failures: 0 };
        mcpHealth[mcp.name] = {
          status: status.status,
          circuit_breaker: status.circuitBreaker,
          failures: status.failures
        };
      }

      return {
        status: 'healthy',
        uptime_seconds: Math.floor(process.uptime()),
        connections: {
          active: clients.size,
          max: 100
        },
        memory: {
          used_mb: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
          total_mb: Math.floor(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        mcps: mcpHealth,
        skills_count: config.skills.length,
        configs_count: Object.keys(config.configs).length
      };
    }

    case 'mcp__mcp_status': {
      const mcpName = args.name;
      const mcp = config.mcps.external.find(m => m.name === mcpName);

      if (!mcp) {
        throw new Error(`MCP '${mcpName}' not found`);
      }

      const status = getMCPStatus(mcpName);
      return {
        name: mcpName,
        url: mcp.url,
        enabled: mcp.enabled,
        has_auth: !!mcp.auth?.token,
        circuit_breaker: {
          state: status.circuitBreaker,
          failures: status.failures,
          last_failure: status.lastError || null
        }
      };
    }

    default:
      throw new Error(`Unknown hub tool: ${toolName}`);
  }
}

// External MCP functions are imported from external-mcp-client.ts

export async function initializeExternalMCPs(config: MCPServerConfig): Promise<void> {
  logger.info('Initializing external MCPs...');
  for (const mcp of config.mcps.external.filter(m => m.enabled)) {
    await initializeExternalMCP(mcp);
  }
  logger.info('External MCPs initialized');
}

export function createMCPGateway(app: Express, basePath: string): void {

  // SSE endpoint for MCP connections
  app.get(`${basePath}/sse`, (req: Request, res: Response) => {
    // Auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization' });
    }

    const apiKey = authHeader.substring(7);
    const config = req.app.locals.config as MCPServerConfig;
    const matchedKey = config.auth.api_keys.find(k => verifyApiKey(apiKey, k.key_hash));
    
    if (!matchedKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const clientId = uuidv4();
    clients.set(clientId, {
      id: clientId,
      res,
      apiKeyName: matchedKey.name
    });

    logger.info(`MCP client connected: ${clientId} (${matchedKey.name})`);

    // Send initial connection message
    const endpoint = `${req.protocol}://${req.get('host')}${basePath}/messages?clientId=${clientId}`;
    res.write(`event: endpoint\ndata: ${endpoint}\n\n`);

    // Keep-alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(clientId);
      logger.info(`MCP client disconnected: ${clientId}`);
    });
  });

  // Message handler for MCP protocol
  app.post(`${basePath}/messages`, authMiddleware, async (req: Request, res: Response) => {
    const config = req.app.locals.config as MCPServerConfig;
    const clientId = req.query.clientId as string;
    
    const client = clients.get(clientId);
    if (!client) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const message: MCPMessage = req.body;
    logger.debug('MCP message received:', { method: message.method, id: message.id });

    try {
      let response: MCPMessage;

      switch (message.method) {
        case 'initialize': {
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: {
                name: 'mcp-server',
                version: '1.0.0'
              },
              capabilities: {
                tools: {}
              }
            }
          };
          break;
        }

        case 'tools/list': {
          // Aggregate tools from hub + all MCPs
          const hubTools = getHubTools();
          
          // Get tools from external MCPs (with namespace prefix)
          const externalTools: MCPTool[] = [];
          for (const mcp of config.mcps.external.filter(m => m.enabled)) {
            try {
              const tools = await fetchExternalMCPTools(mcp);
              // Namespace the tools
              for (const tool of tools) {
                externalTools.push({
                  ...tool,
                  name: `${mcp.name}__${tool.name}`
                });
              }
            } catch (error) {
              logger.error(`Failed to fetch tools from ${mcp.name}:`, error);
            }
          }

          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: [...hubTools, ...externalTools]
            }
          };
          break;
        }

        case 'tools/call': {
          const { name, arguments: args } = message.params;
          
          // Check if it's a hub tool
          if (name.startsWith('mcp__')) {
            const result = await executeHubTool(config, name, args || {});
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
              }
            };
          } 
          // Route to external MCP
          else if (name.includes('__')) {
            const [mcpName, toolName] = name.split('__');
            const mcp = config.mcps.external.find(m => m.name === mcpName && m.enabled);
            
            if (!mcp) {
              throw new Error(`MCP '${mcpName}' not found or disabled`);
            }
            
            const result = await routeToExternalMCP(mcp, toolName, args || {});
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
              }
            };
          }
          else {
            throw new Error(`Unknown tool: ${name}`);
          }
          break;
        }

        case 'notifications/initialized': {
          // Client initialized, no response needed
          return res.status(204).send();
        }

        default: {
          response = {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Method not found: ${message.method}`
            }
          };
        }
      }

      res.json(response);
    } catch (error: any) {
      logger.error('MCP message error:', error);
      res.json({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32000,
          message: error.message || 'Internal error'
        }
      });
    }
  });
}
