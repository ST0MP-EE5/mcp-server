import { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AIHubConfig, loadSkillContent, loadConfigContent, MCPConfig } from './config.js';
import { verifyApiKey } from './middleware/auth.js';
import { logger } from './utils/logger.js';

// ============================================================================
// CONSTANTS & LIMITS
// ============================================================================

const LIMITS = {
  MAX_CONNECTIONS_PER_KEY: 10,
  MAX_TOTAL_CONNECTIONS: 100,
  CONNECTION_TIMEOUT_MS: 3600000,        // 1 hour
  HEARTBEAT_INTERVAL_MS: 30000,          // 30 seconds
  STALE_CONNECTION_MS: 60000,            // 60 seconds
  TOOL_CALL_TIMEOUT_MS: 60000,           // 60 seconds
  MCP_CONNECTION_TIMEOUT_MS: 30000,      // 30 seconds
  MAX_TOOL_RESPONSE_SIZE: 10 * 1024 * 1024,  // 10MB
  CIRCUIT_BREAKER_THRESHOLD: 5,          // failures before open
  CIRCUIT_BREAKER_WINDOW_MS: 60000,      // 60 seconds
  CIRCUIT_BREAKER_RESET_MS: 30000,       // 30 seconds
};

// ============================================================================
// TYPES
// ============================================================================

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

interface SSEClient {
  id: string;
  res: Response;
  apiKeyName: string;
  connectedAt: number;
  lastActivity: number;
  heartbeatInterval: NodeJS.Timeout;
}

interface CircuitBreaker {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  openedAt?: number;
}

// ============================================================================
// STATE
// ============================================================================

const clients = new Map<string, SSEClient>();
const connectionsByKey = new Map<string, Set<string>>();
const circuitBreakers = new Map<string, CircuitBreaker>();

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

function getCircuitBreaker(mcpName: string): CircuitBreaker {
  if (!circuitBreakers.has(mcpName)) {
    circuitBreakers.set(mcpName, {
      failures: 0,
      lastFailure: 0,
      state: 'closed'
    });
  }
  return circuitBreakers.get(mcpName)!;
}

function recordFailure(mcpName: string): void {
  const breaker = getCircuitBreaker(mcpName);
  const now = Date.now();
  
  // Reset if outside window
  if (now - breaker.lastFailure > LIMITS.CIRCUIT_BREAKER_WINDOW_MS) {
    breaker.failures = 0;
  }
  
  breaker.failures++;
  breaker.lastFailure = now;
  
  if (breaker.failures >= LIMITS.CIRCUIT_BREAKER_THRESHOLD) {
    breaker.state = 'open';
    breaker.openedAt = now;
    logger.warn(`Circuit breaker opened for MCP: ${mcpName}`);
  }
}

function recordSuccess(mcpName: string): void {
  const breaker = getCircuitBreaker(mcpName);
  breaker.failures = 0;
  breaker.state = 'closed';
}

function canCallMCP(mcpName: string): { allowed: boolean; reason?: string } {
  const breaker = getCircuitBreaker(mcpName);
  const now = Date.now();
  
  if (breaker.state === 'open') {
    // Check if we should try half-open
    if (now - (breaker.openedAt || 0) > LIMITS.CIRCUIT_BREAKER_RESET_MS) {
      breaker.state = 'half-open';
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: `MCP ${mcpName} circuit breaker open. Retry after ${Math.ceil((LIMITS.CIRCUIT_BREAKER_RESET_MS - (now - (breaker.openedAt || 0))) / 1000)}s`
    };
  }
  
  return { allowed: true };
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

function cleanupClient(clientId: string): void {
  const client = clients.get(clientId);
  if (client) {
    clearInterval(client.heartbeatInterval);
    
    // Remove from key tracking
    const keyConnections = connectionsByKey.get(client.apiKeyName);
    if (keyConnections) {
      keyConnections.delete(clientId);
      if (keyConnections.size === 0) {
        connectionsByKey.delete(client.apiKeyName);
      }
    }
    
    clients.delete(clientId);
    logger.debug(`Client cleaned up: ${clientId}`);
  }
}

function cleanupStaleConnections(): void {
  const now = Date.now();
  for (const [clientId, client] of clients) {
    // Check for stale (no activity)
    if (now - client.lastActivity > LIMITS.STALE_CONNECTION_MS) {
      logger.info(`Removing stale connection: ${clientId}`);
      try {
        client.res.end();
      } catch {}
      cleanupClient(clientId);
    }
    // Check for max lifetime
    else if (now - client.connectedAt > LIMITS.CONNECTION_TIMEOUT_MS) {
      logger.info(`Connection exceeded max lifetime: ${clientId}`);
      try {
        client.res.write(`event: reconnect\ndata: {"reason": "max_lifetime"}\n\n`);
        client.res.end();
      } catch {}
      cleanupClient(clientId);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupStaleConnections, 60000);

// ============================================================================
// HUB TOOLS
// ============================================================================

function getHubTools(): MCPTool[] {
  return [
    {
      name: 'aih__list_mcps',
      description: 'List all available MCPs in the AI Hub',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'aih__list_skills',
      description: 'List all available skills',
      inputSchema: {
        type: 'object',
        properties: { tag: { type: 'string', description: 'Filter by tag' } },
        required: []
      }
    },
    {
      name: 'aih__get_skill',
      description: 'Get the content of a specific skill',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name']
      }
    },
    {
      name: 'aih__list_configs',
      description: 'List all available configuration files',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'aih__get_config',
      description: 'Get the content of a specific configuration file',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name']
      }
    },
    {
      name: 'aih__health',
      description: 'Check the health status of the AI Hub and all MCPs',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'aih__mcp_status',
      description: 'Get detailed status of a specific MCP',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name']
      }
    }
  ];
}

async function executeHubTool(config: AIHubConfig, toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'aih__list_mcps': {
      const mcps = [
        ...config.mcps.external.filter(m => m.enabled).map(m => {
          const breaker = getCircuitBreaker(m.name);
          return {
            name: m.name,
            type: 'external',
            url: m.url,
            status: breaker.state === 'open' ? 'degraded' : 'healthy'
          };
        }),
        ...config.mcps.local.filter(m => m.enabled).map(m => ({
          name: m.name,
          type: 'local',
          port: m.port,
          status: 'healthy'
        }))
      ];
      return { mcps };
    }

    case 'aih__list_skills': {
      let skills = config.skills;
      if (args.tag) {
        skills = skills.filter(s => s.tags.includes(args.tag));
      }
      return { skills: skills.map(s => ({ name: s.name, description: s.description, tags: s.tags })) };
    }

    case 'aih__get_skill': {
      const content = await loadSkillContent(config, args.name);
      if (!content) throw new Error(`Skill '${args.name}' not found`);
      return { name: args.name, content };
    }

    case 'aih__list_configs': {
      return {
        configs: Object.entries(config.configs).map(([key, value]) => ({
          name: key,
          file: value.file
        }))
      };
    }

    case 'aih__get_config': {
      const content = await loadConfigContent(config, args.name);
      if (!content) throw new Error(`Config '${args.name}' not found`);
      return { name: args.name, content };
    }

    case 'aih__health': {
      const mcpStatuses: Record<string, any> = {};
      for (const mcp of config.mcps.external.filter(m => m.enabled)) {
        const breaker = getCircuitBreaker(mcp.name);
        mcpStatuses[mcp.name] = {
          status: breaker.state === 'open' ? 'degraded' : 'healthy',
          circuit_breaker: breaker.state,
          failures: breaker.failures
        };
      }
      
      return {
        status: 'healthy',
        uptime_seconds: Math.floor(process.uptime()),
        connections: {
          active: clients.size,
          max: LIMITS.MAX_TOTAL_CONNECTIONS
        },
        memory: {
          used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        mcps: mcpStatuses,
        skills_count: config.skills.length,
        configs_count: Object.keys(config.configs).length
      };
    }

    case 'aih__mcp_status': {
      const mcp = config.mcps.external.find(m => m.name === args.name);
      if (!mcp) throw new Error(`MCP '${args.name}' not found`);
      
      const breaker = getCircuitBreaker(args.name);
      return {
        name: mcp.name,
        url: mcp.url,
        enabled: mcp.enabled,
        has_auth: !!mcp.auth,
        circuit_breaker: {
          state: breaker.state,
          failures: breaker.failures,
          last_failure: breaker.lastFailure ? new Date(breaker.lastFailure).toISOString() : null
        }
      };
    }

    default:
      throw new Error(`Unknown hub tool: ${toolName}`);
  }
}

// ============================================================================
// EXTERNAL MCP ROUTING
// ============================================================================

async function routeToExternalMCP(
  mcp: MCPConfig,
  toolName: string,
  args: any,
  timeout: number = LIMITS.TOOL_CALL_TIMEOUT_MS
): Promise<any> {
  // Check circuit breaker
  const { allowed, reason } = canCallMCP(mcp.name);
  if (!allowed) {
    throw new Error(reason);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // This is a simplified implementation
    // Real implementation would maintain SSE connection to external MCP
    // and route tool calls through it

    logger.debug(`Routing ${toolName} to ${mcp.name}`, { args });

    // Placeholder for actual MCP client implementation
    throw new Error(`External MCP routing not yet implemented for ${mcp.name}`);

  } catch (error: any) {
    if (error.name === 'AbortError') {
      recordFailure(mcp.name);
      throw new Error(`Tool call to ${mcp.name} timed out after ${timeout}ms`);
    }

    recordFailure(mcp.name);
    throw error;

  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// LOCAL MCP ROUTING
// ============================================================================

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

// Store for local MCP processes
const localMCPProcesses = new Map<string, {
  process: ChildProcess;
  tools: MCPTool[];
  ready: boolean;
  pendingCalls: Map<string | number, { resolve: (val: any) => void; reject: (err: any) => void }>;
}>();

async function startLocalMCP(mcp: MCPConfig): Promise<void> {
  if (localMCPProcesses.has(mcp.name)) {
    return; // Already started
  }

  const mcpPath = mcp.path;
  if (!mcpPath) {
    throw new Error(`Local MCP ${mcp.name} has no path configured`);
  }

  const distPath = path.join(mcpPath, 'dist', 'index.js');

  logger.info(`Starting local MCP: ${mcp.name}`, { path: distPath });

  const child = spawn('node', [distPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
    cwd: mcpPath
  });

  const mcpState = {
    process: child,
    tools: [] as MCPTool[],
    ready: false,
    pendingCalls: new Map<string | number, { resolve: (val: any) => void; reject: (err: any) => void }>()
  };

  localMCPProcesses.set(mcp.name, mcpState);

  // Handle stdout (JSON-RPC responses)
  let buffer = '';
  child.stdout?.on('data', (data: Buffer) => {
    buffer += data.toString();

    // Try to parse complete JSON messages
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);

        // Handle response to pending call
        if (message.id !== undefined && mcpState.pendingCalls.has(message.id)) {
          const pending = mcpState.pendingCalls.get(message.id)!;
          mcpState.pendingCalls.delete(message.id);

          if (message.error) {
            pending.reject(new Error(message.error.message || 'MCP error'));
          } else {
            pending.resolve(message.result);
          }
        }
      } catch (e) {
        // Ignore parse errors for incomplete messages
      }
    }
  });

  // Handle stderr (logs)
  child.stderr?.on('data', (data: Buffer) => {
    logger.debug(`[${mcp.name}] ${data.toString().trim()}`);
  });

  child.on('error', (error) => {
    logger.error(`Local MCP ${mcp.name} error`, { error: error.message });
    localMCPProcesses.delete(mcp.name);
  });

  child.on('exit', (code) => {
    logger.info(`Local MCP ${mcp.name} exited`, { code });
    localMCPProcesses.delete(mcp.name);
  });

  // Initialize the MCP
  await sendToLocalMCP(mcp.name, {
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'ai-hub', version: '1.0.0' },
      capabilities: {}
    }
  });

  // Fetch tools
  const toolsResult = await sendToLocalMCP(mcp.name, {
    jsonrpc: '2.0',
    id: 'tools',
    method: 'tools/list',
    params: {}
  });

  mcpState.tools = toolsResult.tools || [];
  mcpState.ready = true;

  logger.info(`Local MCP ${mcp.name} ready`, { toolCount: mcpState.tools.length });
}

async function sendToLocalMCP(mcpName: string, message: any): Promise<any> {
  const mcpState = localMCPProcesses.get(mcpName);
  if (!mcpState) {
    throw new Error(`Local MCP ${mcpName} is not running`);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      mcpState.pendingCalls.delete(message.id);
      reject(new Error(`Local MCP ${mcpName} call timed out`));
    }, LIMITS.TOOL_CALL_TIMEOUT_MS);

    mcpState.pendingCalls.set(message.id, {
      resolve: (val) => {
        clearTimeout(timeout);
        resolve(val);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      }
    });

    mcpState.process.stdin?.write(JSON.stringify(message) + '\n');
  });
}

async function routeToLocalMCP(
  mcp: MCPConfig,
  toolName: string,
  args: any
): Promise<any> {
  // Ensure MCP is started
  if (!localMCPProcesses.has(mcp.name)) {
    await startLocalMCP(mcp);
  }

  const mcpState = localMCPProcesses.get(mcp.name);
  if (!mcpState?.ready) {
    throw new Error(`Local MCP ${mcp.name} is not ready`);
  }

  const fullToolName = `${mcp.name}__${toolName}`;
  logger.debug(`Routing to local MCP`, { mcp: mcp.name, tool: toolName, args });

  const result = await sendToLocalMCP(mcp.name, {
    jsonrpc: '2.0',
    id: `call-${Date.now()}`,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  });

  return result;
}

function getLocalMCPTools(mcpName: string): MCPTool[] {
  const mcpState = localMCPProcesses.get(mcpName);
  if (!mcpState?.ready) return [];

  // Namespace tools with MCP name
  return mcpState.tools.map(tool => ({
    ...tool,
    name: `${mcpName}__${tool.name}`,
    description: `[${mcpName}] ${tool.description}`
  }));
}

// Initialize local MCPs on startup
export async function initializeLocalMCPs(config: AIHubConfig): Promise<void> {
  for (const mcp of config.mcps.local.filter(m => m.enabled)) {
    try {
      await startLocalMCP(mcp);
    } catch (error: any) {
      logger.error(`Failed to start local MCP ${mcp.name}`, { error: error.message });
    }
  }
}

// ============================================================================
// GATEWAY SETUP
// ============================================================================

export function createMCPGateway(app: Express, basePath: string): void {
  
  // -------------------------------------------------------------------------
  // SSE ENDPOINT
  // -------------------------------------------------------------------------
  
  app.get(`${basePath}/sse`, (req: Request, res: Response) => {
    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        ok: false, 
        error: { code: 'AUTH_REQUIRED', message: 'Missing authorization header' }
      });
    }

    const apiKey = authHeader.substring(7);
    const config = req.app.locals.config as AIHubConfig;
    const matchedKey = config.auth.api_keys.find(k => verifyApiKey(apiKey, k.key_hash));
    
    if (!matchedKey) {
      return res.status(401).json({ 
        ok: false, 
        error: { code: 'INVALID_KEY', message: 'Invalid API key' }
      });
    }

    // Check connection limits
    if (clients.size >= LIMITS.MAX_TOTAL_CONNECTIONS) {
      return res.status(429).json({ 
        ok: false, 
        error: { code: 'TOO_MANY_CONNECTIONS', message: 'Server at capacity' },
        retry_after: 60
      });
    }

    const keyConnections = connectionsByKey.get(matchedKey.name) || new Set();
    if (keyConnections.size >= LIMITS.MAX_CONNECTIONS_PER_KEY) {
      return res.status(429).json({ 
        ok: false, 
        error: { code: 'TOO_MANY_CONNECTIONS', message: 'Too many connections for this API key' },
        retry_after: 60
      });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Disable Nagle's algorithm for immediate data sending
    if (res.socket) {
      res.socket.setNoDelay(true);
    }

    // Flush headers immediately to establish the SSE connection
    res.flushHeaders();

    // Send initial comment to establish connection
    res.write(': ok\n\n');

    const clientId = uuidv4();
    const now = Date.now();
    
    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
        const client = clients.get(clientId);
        if (client) client.lastActivity = Date.now();
      } catch {
        cleanupClient(clientId);
      }
    }, LIMITS.HEARTBEAT_INTERVAL_MS);

    // Track client
    const client: SSEClient = {
      id: clientId,
      res,
      apiKeyName: matchedKey.name,
      connectedAt: now,
      lastActivity: now,
      heartbeatInterval
    };
    
    clients.set(clientId, client);
    
    // Track by key
    if (!connectionsByKey.has(matchedKey.name)) {
      connectionsByKey.set(matchedKey.name, new Set());
    }
    connectionsByKey.get(matchedKey.name)!.add(clientId);

    logger.info(`MCP client connected`, { 
      clientId, 
      apiKeyName: matchedKey.name,
      totalConnections: clients.size 
    });

    // Send endpoint
    const endpoint = `${req.protocol}://${req.get('host')}${basePath}/messages?clientId=${clientId}`;
    res.write(`event: endpoint\ndata: ${endpoint}\n\n`);

    // Cleanup on disconnect
    req.on('close', () => {
      cleanupClient(clientId);
      logger.info(`MCP client disconnected`, { clientId });
    });
  });

  // -------------------------------------------------------------------------
  // MESSAGE HANDLER
  // -------------------------------------------------------------------------
  
  app.post(`${basePath}/messages`, async (req: Request, res: Response) => {
    const clientId = req.query.clientId as string;
    const client = clients.get(clientId);
    
    if (!client) {
      return res.status(400).json({ 
        ok: false, 
        error: { code: 'INVALID_CLIENT', message: 'Invalid or expired client ID' }
      });
    }

    // Update activity
    client.lastActivity = Date.now();
    
    const config = req.app.locals.config as AIHubConfig;
    const message: MCPMessage = req.body;
    
    logger.debug('MCP message', { method: message.method, id: message.id, clientId });

    try {
      let response: MCPMessage;

      switch (message.method) {
        case 'initialize': {
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: { name: 'ai-hub', version: '1.0.0' },
              capabilities: { tools: {} }
            }
          };
          break;
        }

        case 'tools/list': {
          const hubTools = getHubTools();

          // Get external MCP tools (with circuit breaker awareness)
          const externalTools: MCPTool[] = [];
          for (const mcp of config.mcps.external.filter(m => m.enabled)) {
            const { allowed } = canCallMCP(mcp.name);
            if (!allowed) {
              // Still list tools but mark as unavailable
              externalTools.push({
                name: `${mcp.name}__unavailable`,
                description: `[DEGRADED] MCP ${mcp.name} is temporarily unavailable`,
                inputSchema: { type: 'object', properties: {} }
              });
              continue;
            }

            // TODO: Fetch actual tools from external MCP
          }

          // Get local MCP tools
          const localTools: MCPTool[] = [];
          for (const mcp of config.mcps.local.filter(m => m.enabled)) {
            const tools = getLocalMCPTools(mcp.name);
            localTools.push(...tools);
          }

          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: { tools: [...hubTools, ...localTools, ...externalTools] }
          };
          break;
        }

        case 'tools/call': {
          const { name, arguments: args } = message.params;

          try {
            let result: any;

            if (name.startsWith('aih__')) {
              // Hub tool
              result = await executeHubTool(config, name, args || {});
            } else if (name.includes('__')) {
              // Namespaced tool - check local MCPs first, then external
              const [mcpName, toolName] = name.split('__', 2);

              // Check local MCPs first
              const localMcp = config.mcps.local.find(m => m.name === mcpName && m.enabled);
              if (localMcp) {
                result = await routeToLocalMCP(localMcp, toolName, args || {});
              } else {
                // Check external MCPs
                const externalMcp = config.mcps.external.find(m => m.name === mcpName && m.enabled);

                if (!externalMcp) {
                  throw new Error(`MCP '${mcpName}' not found or disabled`);
                }

                result = await routeToExternalMCP(externalMcp, toolName, args || {});
                recordSuccess(mcpName);
              }
            } else {
              throw new Error(`Unknown tool: ${name}. Tools must be namespaced as 'mcp__tool'`);
            }

            // Check response size
            const resultStr = JSON.stringify(result);
            if (resultStr.length > LIMITS.MAX_TOOL_RESPONSE_SIZE) {
              throw new Error(`Response too large (${Math.round(resultStr.length / 1024 / 1024)}MB > ${LIMITS.MAX_TOOL_RESPONSE_SIZE / 1024 / 1024}MB limit)`);
            }

            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
              }
            };
          } catch (error: any) {
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
                isError: true
              }
            };
          }
          break;
        }

        case 'notifications/initialized': {
          return res.status(204).send();
        }

        default: {
          response = {
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32601, message: `Method not found: ${message.method}` }
          };
        }
      }

      res.json(response);
      
    } catch (error: any) {
      logger.error('MCP message error', { error: error.message, clientId });
      res.json({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32000, message: error.message || 'Internal error' }
      });
    }
  });

  // -------------------------------------------------------------------------
  // HEALTH ENDPOINT (Public)
  // -------------------------------------------------------------------------
  
  app.get(`${basePath}/health`, (req: Request, res: Response) => {
    const config = req.app.locals.config as AIHubConfig;
    
    const mcpStatuses: Record<string, string> = {};
    for (const mcp of config.mcps.external) {
      const breaker = getCircuitBreaker(mcp.name);
      mcpStatuses[mcp.name] = mcp.enabled 
        ? (breaker.state === 'open' ? 'degraded' : 'healthy')
        : 'disabled';
    }
    
    res.json({
      ok: true,
      status: 'healthy',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      connections: {
        active: clients.size,
        limit: LIMITS.MAX_TOTAL_CONNECTIONS
      },
      memory: {
        used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      mcps: mcpStatuses
    });
  });

  // -------------------------------------------------------------------------
  // METRICS ENDPOINT (Prometheus-compatible)
  // -------------------------------------------------------------------------
  
  app.get(`${basePath}/metrics`, (req: Request, res: Response) => {
    const config = req.app.locals.config as AIHubConfig;
    const mem = process.memoryUsage();
    
    let metrics = '';
    
    // Uptime
    metrics += `# HELP aih_uptime_seconds Server uptime in seconds\n`;
    metrics += `# TYPE aih_uptime_seconds gauge\n`;
    metrics += `aih_uptime_seconds ${Math.floor(process.uptime())}\n\n`;
    
    // Connections
    metrics += `# HELP aih_connections_active Active SSE connections\n`;
    metrics += `# TYPE aih_connections_active gauge\n`;
    metrics += `aih_connections_active ${clients.size}\n\n`;
    
    // Memory
    metrics += `# HELP aih_memory_bytes Memory usage in bytes\n`;
    metrics += `# TYPE aih_memory_bytes gauge\n`;
    metrics += `aih_memory_bytes{type="heap_used"} ${mem.heapUsed}\n`;
    metrics += `aih_memory_bytes{type="heap_total"} ${mem.heapTotal}\n`;
    metrics += `aih_memory_bytes{type="rss"} ${mem.rss}\n\n`;
    
    // MCP status
    metrics += `# HELP aih_mcp_status MCP health status (1=healthy, 0=degraded)\n`;
    metrics += `# TYPE aih_mcp_status gauge\n`;
    for (const mcp of config.mcps.external) {
      const breaker = getCircuitBreaker(mcp.name);
      const healthy = mcp.enabled && breaker.state !== 'open' ? 1 : 0;
      metrics += `aih_mcp_status{name="${mcp.name}"} ${healthy}\n`;
    }
    
    res.type('text/plain').send(metrics);
  });
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    // Stop accepting new connections
    // (handled by HTTP server close)
    
    // Notify all clients
    for (const [clientId, client] of clients) {
      try {
        client.res.write(`event: shutdown\ndata: {"reason": "server_shutdown"}\n\n`);
        client.res.end();
      } catch {}
      cleanupClient(clientId);
    }
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
