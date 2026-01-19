#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { tools, executeTool, toolCount, getTool } from './tools/index.js';

// Validate environment
if (!process.env.DO_API_TOKEN) {
  console.error('Error: DO_API_TOKEN environment variable is required');
  process.exit(1);
}

// Create the MCP server
const server = new Server(
  {
    name: 'digitalocean-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Validate tool exists
  const tool = getTool(name);
  if (!tool) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${name}`
    );
  }

  try {
    // Execute the tool
    const result = await executeTool(name, args || {});

    // Format response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Return error as content (not throwing) for better UX
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message,
            tool: name
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  console.error(`DigitalOcean MCP Server starting...`);
  console.error(`Loaded ${toolCount} tools`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('DigitalOcean MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
