import { getClient } from '../client.js';
import type { ToolDefinition, AppSpec } from '../types.js';

export const appTools: ToolDefinition[] = [
  {
    name: 'do__list_apps',
    description: 'List all App Platform applications in your account.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    safety: 'read'
  },
  {
    name: 'do__get_app',
    description: 'Get detailed information about a specific App Platform application.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier (UUID) of the app'
        }
      },
      required: ['id']
    },
    safety: 'read'
  },
  {
    name: 'do__create_app',
    description: 'Create a new App Platform application from a specification.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          description: 'The app specification object',
          properties: {
            name: { type: 'string', description: 'App name' },
            region: { type: 'string', description: 'Region slug (e.g., nyc, sfo, ams)' },
            services: {
              type: 'array',
              description: 'Service components',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  github: {
                    type: 'object',
                    properties: {
                      repo: { type: 'string', description: 'GitHub repo (owner/name)' },
                      branch: { type: 'string' },
                      deploy_on_push: { type: 'boolean' }
                    }
                  },
                  build_command: { type: 'string' },
                  run_command: { type: 'string' },
                  http_port: { type: 'number' },
                  instance_size_slug: { type: 'string' },
                  instance_count: { type: 'number' }
                }
              }
            },
            static_sites: {
              type: 'array',
              description: 'Static site components',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  github: {
                    type: 'object',
                    properties: {
                      repo: { type: 'string' },
                      branch: { type: 'string' }
                    }
                  },
                  build_command: { type: 'string' },
                  output_dir: { type: 'string' }
                }
              }
            }
          },
          required: ['name']
        }
      },
      required: ['spec']
    },
    safety: 'write'
  },
  {
    name: 'do__update_app',
    description: 'Update an existing App Platform application with a new specification.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier (UUID) of the app'
        },
        spec: {
          type: 'object',
          description: 'The updated app specification'
        }
      },
      required: ['id', 'spec']
    },
    safety: 'write'
  },
  {
    name: 'do__delete_app',
    description: 'Permanently delete an App Platform application. This action is irreversible.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier (UUID) of the app to delete'
        }
      },
      required: ['id']
    },
    safety: 'destructive'
  },
  {
    name: 'do__get_app_logs',
    description: 'Get logs for an App Platform application. Returns URLs to view logs.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier (UUID) of the app'
        },
        component_name: {
          type: 'string',
          description: 'Name of the component to get logs for'
        },
        type: {
          type: 'string',
          enum: ['BUILD', 'DEPLOY', 'RUN'],
          description: 'Type of logs to retrieve'
        }
      },
      required: ['id']
    },
    safety: 'read'
  },
  {
    name: 'do__restart_app',
    description: 'Trigger a new deployment to restart the App Platform application.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier (UUID) of the app'
        }
      },
      required: ['id']
    },
    safety: 'write'
  }
];

export async function executeAppTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = getClient();

  switch (name) {
    case 'do__list_apps':
      return client.listApps();

    case 'do__get_app':
      return client.getApp(args.id as string);

    case 'do__create_app':
      return client.createApp(args.spec as AppSpec);

    case 'do__update_app':
      return client.updateApp(args.id as string, args.spec as AppSpec);

    case 'do__delete_app':
      await client.deleteApp(args.id as string);
      return { success: true, message: `App ${args.id} has been deleted` };

    case 'do__get_app_logs':
      return client.getAppLogs(args.id as string, {
        component_name: args.component_name as string | undefined,
        type: args.type as 'BUILD' | 'DEPLOY' | 'RUN' | undefined
      });

    case 'do__restart_app':
      return client.restartApp(args.id as string);

    default:
      throw new Error(`Unknown app tool: ${name}`);
  }
}
