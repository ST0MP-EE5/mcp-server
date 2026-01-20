import { MCPConfig } from './config.js';
import { logger } from './utils/logger.js';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
}

interface MCPClientState {
  tools: MCPTool[];
  initialized: boolean;
  lastError?: string;
  lastHealthCheck?: Date;
  failures: number;
  circuitBreakerOpen: boolean;
}

// Store state for each external MCP
const mcpClients = new Map<string, MCPClientState>();

// Circuit breaker settings
const FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIME = 60000; // 1 minute

function getAuthHeaders(mcp: MCPConfig): Record<string, string> {
  // Build headers for Streamable HTTP transport
  // Accept header MUST include both application/json and text/event-stream per MCP spec
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  if (mcp.auth) {
    if (mcp.auth.type === 'bearer' && mcp.auth.token) {
      headers['Authorization'] = `Bearer ${mcp.auth.token}`;
    } else if (mcp.auth.type === 'api_key' && mcp.auth.token && mcp.auth.header) {
      headers[mcp.auth.header] = mcp.auth.token;
    }
  }

  return headers;
}

async function sendMCPRequest(mcp: MCPConfig, method: string, params?: any): Promise<any> {
  const headers = getAuthHeaders(mcp);
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params: params || {}
  };

  const response = await fetch(mcp.url!, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000) // 30 second timeout
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json() as { error?: { message?: string }; result?: any };

  if (result.error) {
    throw new Error(result.error.message || JSON.stringify(result.error));
  }

  return result.result;
}

export async function initializeExternalMCP(mcp: MCPConfig): Promise<void> {
  if (!mcp.url) {
    logger.warn(`MCP ${mcp.name} has no URL, skipping`);
    return;
  }

  const state: MCPClientState = {
    tools: [],
    initialized: false,
    failures: 0,
    circuitBreakerOpen: false
  };

  mcpClients.set(mcp.name, state);

  try {
    // Try to initialize the MCP connection
    logger.info(`Initializing external MCP: ${mcp.name} at ${mcp.url}`);

    // Send initialize request
    await sendMCPRequest(mcp, 'initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: {
        name: 'mcp-server-proxy',
        version: '1.0.0'
      },
      capabilities: {}
    });

    // Fetch available tools
    const toolsResult = await sendMCPRequest(mcp, 'tools/list');
    state.tools = toolsResult.tools || [];
    state.initialized = true;
    state.lastHealthCheck = new Date();

    logger.info(`MCP ${mcp.name} initialized with ${state.tools.length} tools`);
  } catch (error: any) {
    state.lastError = error.message;
    state.failures++;
    logger.error(`Failed to initialize MCP ${mcp.name}:`, error.message);
  }
}

export async function fetchExternalMCPTools(mcp: MCPConfig): Promise<MCPTool[]> {
  const state = mcpClients.get(mcp.name);

  if (!state) {
    // Not initialized yet, try to initialize
    await initializeExternalMCP(mcp);
    return mcpClients.get(mcp.name)?.tools || [];
  }

  // If circuit breaker is open, return cached tools or empty
  if (state.circuitBreakerOpen) {
    const timeSinceOpen = Date.now() - (state.lastHealthCheck?.getTime() || 0);
    if (timeSinceOpen < CIRCUIT_RESET_TIME) {
      logger.debug(`Circuit breaker open for ${mcp.name}, using cached tools`);
      return state.tools;
    }
    // Try to reset circuit breaker
    state.circuitBreakerOpen = false;
    state.failures = 0;
  }

  // Refresh tools periodically (every 5 minutes)
  const toolAge = Date.now() - (state.lastHealthCheck?.getTime() || 0);
  if (toolAge > 300000 || !state.initialized) {
    try {
      const toolsResult = await sendMCPRequest(mcp, 'tools/list');
      state.tools = toolsResult.tools || [];
      state.initialized = true;
      state.lastHealthCheck = new Date();
      state.failures = 0;
    } catch (error: any) {
      state.lastError = error.message;
      state.failures++;

      if (state.failures >= FAILURE_THRESHOLD) {
        state.circuitBreakerOpen = true;
        logger.warn(`Circuit breaker opened for ${mcp.name} after ${state.failures} failures`);
      }
    }
  }

  return state.tools;
}

export async function routeToExternalMCP(
  mcp: MCPConfig,
  toolName: string,
  args: any
): Promise<any> {
  const state = mcpClients.get(mcp.name);

  if (!state || !state.initialized) {
    await initializeExternalMCP(mcp);
  }

  const currentState = mcpClients.get(mcp.name);
  if (currentState?.circuitBreakerOpen) {
    throw new Error(`MCP ${mcp.name} is temporarily unavailable (circuit breaker open)`);
  }

  try {
    const result = await sendMCPRequest(mcp, 'tools/call', {
      name: toolName,
      arguments: args
    });

    // Reset failure count on success
    if (currentState) {
      currentState.failures = 0;
    }

    return result;
  } catch (error: any) {
    if (currentState) {
      currentState.lastError = error.message;
      currentState.failures++;

      if (currentState.failures >= FAILURE_THRESHOLD) {
        currentState.circuitBreakerOpen = true;
        currentState.lastHealthCheck = new Date();
        logger.warn(`Circuit breaker opened for ${mcp.name}`);
      }
    }
    throw error;
  }
}

export function getMCPStatus(mcpName: string): {
  status: string;
  tools: number;
  circuitBreaker: string;
  failures: number;
  lastError?: string;
} {
  const state = mcpClients.get(mcpName);

  if (!state) {
    return {
      status: 'not_initialized',
      tools: 0,
      circuitBreaker: 'closed',
      failures: 0
    };
  }

  return {
    status: state.initialized ? 'healthy' : 'error',
    tools: state.tools.length,
    circuitBreaker: state.circuitBreakerOpen ? 'open' : 'closed',
    failures: state.failures,
    lastError: state.lastError
  };
}

export function getAllMCPStatus(): Record<string, ReturnType<typeof getMCPStatus>> {
  const status: Record<string, ReturnType<typeof getMCPStatus>> = {};
  for (const [name] of mcpClients) {
    status[name] = getMCPStatus(name);
  }
  return status;
}
