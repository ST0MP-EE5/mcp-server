import { getClient } from '../client.js';
import type { ToolDefinition } from '../types.js';

export const accountTools: ToolDefinition[] = [
  {
    name: 'do__get_account',
    description: 'Get information about your DigitalOcean account including limits and status.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    safety: 'read'
  },
  {
    name: 'do__get_balance',
    description: 'Get your current billing balance and month-to-date usage.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    safety: 'read'
  }
];

export async function executeAccountTool(name: string, _args: Record<string, unknown>): Promise<unknown> {
  const client = getClient();

  switch (name) {
    case 'do__get_account':
      return client.getAccount();

    case 'do__get_balance':
      return client.getBalance();

    default:
      throw new Error(`Unknown account tool: ${name}`);
  }
}
