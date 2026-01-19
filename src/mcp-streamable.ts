import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import { loadConfig } from './config.js';
import { verifyApiKey } from './middleware/auth.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 3000;

// Store transports by session
const transports = new Map<string, StreamableHTTPServerTransport>();

async function main() {
  const config = await loadConfig('./mcp-server.yaml');
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      status: 'healthy',
      version: '1.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  // SSE endpoint - redirect to main /mcp endpoint which handles both SSE and HTTP
  app.get('/mcp/sse', async (req, res) => {
    // Forward to /mcp handler with SSE Accept header
    req.headers.accept = 'text/event-stream';
    req.url = '/mcp';
    app._router.handle(req, res, () => {});
  });

  // MCP endpoint - handles both GET (SSE) and POST (messages)
  app.all('/mcp', async (req, res) => {
    // Auth check
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization' });
      return;
    }

    const apiKey = authHeader.substring(7);
    const matchedKey = config.auth.api_keys.find(k => verifyApiKey(apiKey, k.key_hash));
    if (!matchedKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Get or create session
    const sessionId = req.headers['mcp-session-id'] as string;
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      // Create new transport and server
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const server = new Server(
        { name: 'ai-hub', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );

      // Register tools
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
          {
            name: 'aih__health',
            description: 'Check the health status of the AI Hub',
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
          }
        ]
      }));

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        if (name === 'aih__health') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'healthy',
                uptime: process.uptime(),
                skills: config.skills.length
              }, null, 2)
            }]
          };
        }

        if (name === 'aih__list_skills') {
          let skills = config.skills;
          if (args?.tag) {
            skills = skills.filter(s => s.tags.includes(args.tag as string));
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                skills: skills.map(s => ({ name: s.name, description: s.description, tags: s.tags }))
              }, null, 2)
            }]
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
          isError: true
        };
      });

      await server.connect(transport);

      // Store transport by session ID after connection
      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
        logger.info(`New MCP session: ${transport.sessionId}`);
      }
    }

    // Handle the request
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (err: any) {
      logger.error('MCP request error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // Start server
  app.listen(PORT, () => {
    logger.info(`AI Hub (Streamable HTTP) started on port ${PORT}`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
