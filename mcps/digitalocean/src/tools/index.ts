import { dropletTools, executeDropletTool } from './droplets.js';
import { appTools, executeAppTool } from './apps.js';
import { databaseTools, executeDatabaseTool } from './databases.js';
import { domainTools, executeDomainTool } from './domains.js';
import { accountTools, executeAccountTool } from './account.js';
import type { ToolDefinition } from '../types.js';

// Aggregate all tools
export const tools: ToolDefinition[] = [
  ...dropletTools,
  ...appTools,
  ...databaseTools,
  ...domainTools,
  ...accountTools
];

// Tool execution router
export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // Route to appropriate tool handler based on tool name prefix
  if (name.startsWith('do__list_droplets') ||
      name.startsWith('do__get_droplet') ||
      name.startsWith('do__create_droplet') ||
      name.startsWith('do__delete_droplet') ||
      name.startsWith('do__reboot_droplet') ||
      name.startsWith('do__power_droplet') ||
      name.startsWith('do__resize_droplet') ||
      name.startsWith('do__snapshot_droplet') ||
      name.startsWith('do__list_regions') ||
      name.startsWith('do__list_sizes') ||
      name.startsWith('do__list_images') ||
      name.startsWith('do__list_ssh_keys')) {
    return executeDropletTool(name, args);
  }

  if (name.startsWith('do__list_apps') ||
      name.startsWith('do__get_app') ||
      name.startsWith('do__create_app') ||
      name.startsWith('do__update_app') ||
      name.startsWith('do__delete_app') ||
      name.startsWith('do__get_app_logs') ||
      name.startsWith('do__restart_app')) {
    return executeAppTool(name, args);
  }

  if (name.startsWith('do__list_databases') ||
      name.startsWith('do__get_database') ||
      name.startsWith('do__create_database') ||
      name.startsWith('do__delete_database')) {
    return executeDatabaseTool(name, args);
  }

  if (name.startsWith('do__list_domains') ||
      name.startsWith('do__get_domain') ||
      name.startsWith('do__create_domain') ||
      name.startsWith('do__delete_domain') ||
      name.startsWith('do__list_records') ||
      name.startsWith('do__create_record') ||
      name.startsWith('do__delete_record')) {
    return executeDomainTool(name, args);
  }

  if (name.startsWith('do__get_account') ||
      name.startsWith('do__get_balance')) {
    return executeAccountTool(name, args);
  }

  throw new Error(`Unknown tool: ${name}`);
}

// Export tool count for logging
export const toolCount = tools.length;

// Get tool by name
export function getTool(name: string): ToolDefinition | undefined {
  return tools.find(t => t.name === name);
}

// Get tools by safety level
export function getToolsBySafety(safety: 'read' | 'write' | 'destructive'): ToolDefinition[] {
  return tools.filter(t => t.safety === safety);
}
