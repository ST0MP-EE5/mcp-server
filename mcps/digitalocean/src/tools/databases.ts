import { getClient } from '../client.js';
import type { ToolDefinition, CreateDatabaseParams } from '../types.js';

export const databaseTools: ToolDefinition[] = [
  {
    name: 'do__list_databases',
    description: 'List all managed databases in your DigitalOcean account.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    safety: 'read'
  },
  {
    name: 'do__get_database',
    description: 'Get detailed information about a specific managed database including connection details.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier (UUID) of the database cluster'
        }
      },
      required: ['id']
    },
    safety: 'read'
  },
  {
    name: 'do__create_database',
    description: 'Create a new managed database cluster (PostgreSQL, MySQL, Redis, or MongoDB).',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'A unique name for the database cluster'
        },
        engine: {
          type: 'string',
          enum: ['pg', 'mysql', 'redis', 'mongodb'],
          description: 'The database engine type'
        },
        version: {
          type: 'string',
          description: 'Engine version (e.g., "15" for PostgreSQL 15)'
        },
        size: {
          type: 'string',
          description: 'Size slug (e.g., db-s-1vcpu-1gb, db-s-2vcpu-4gb)'
        },
        region: {
          type: 'string',
          description: 'Region slug (e.g., nyc1, sfo3)'
        },
        num_nodes: {
          type: 'number',
          description: 'Number of nodes in the cluster (1-3)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to apply to the database'
        }
      },
      required: ['name', 'engine', 'size', 'region']
    },
    safety: 'write'
  },
  {
    name: 'do__delete_database',
    description: 'Permanently delete a managed database cluster. This action is irreversible and destroys all data.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier (UUID) of the database cluster to delete'
        }
      },
      required: ['id']
    },
    safety: 'destructive'
  }
];

export async function executeDatabaseTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = getClient();

  switch (name) {
    case 'do__list_databases':
      return client.listDatabases();

    case 'do__get_database':
      return client.getDatabase(args.id as string);

    case 'do__create_database':
      return client.createDatabase(args as unknown as CreateDatabaseParams);

    case 'do__delete_database':
      await client.deleteDatabase(args.id as string);
      return { success: true, message: `Database ${args.id} has been deleted` };

    default:
      throw new Error(`Unknown database tool: ${name}`);
  }
}
