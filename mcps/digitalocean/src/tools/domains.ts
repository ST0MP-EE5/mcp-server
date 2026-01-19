import { getClient } from '../client.js';
import type { ToolDefinition, CreateRecordParams } from '../types.js';

export const domainTools: ToolDefinition[] = [
  {
    name: 'do__list_domains',
    description: 'List all domains in your DigitalOcean DNS management.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    safety: 'read'
  },
  {
    name: 'do__get_domain',
    description: 'Get information about a specific domain including its zone file.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The domain name (e.g., example.com)'
        }
      },
      required: ['name']
    },
    safety: 'read'
  },
  {
    name: 'do__create_domain',
    description: 'Add a domain to DigitalOcean DNS management.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The domain name to add (e.g., example.com)'
        },
        ip_address: {
          type: 'string',
          description: 'Optional IP address to create an A record for the root domain'
        }
      },
      required: ['name']
    },
    safety: 'write'
  },
  {
    name: 'do__delete_domain',
    description: 'Remove a domain from DigitalOcean DNS management. Does not affect domain registration.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The domain name to remove'
        }
      },
      required: ['name']
    },
    safety: 'destructive'
  },
  {
    name: 'do__list_records',
    description: 'List all DNS records for a domain.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'The domain name'
        }
      },
      required: ['domain']
    },
    safety: 'read'
  },
  {
    name: 'do__create_record',
    description: 'Create a new DNS record for a domain.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'The domain name'
        },
        type: {
          type: 'string',
          enum: ['A', 'AAAA', 'CAA', 'CNAME', 'MX', 'NS', 'TXT', 'SRV'],
          description: 'The type of DNS record'
        },
        name: {
          type: 'string',
          description: 'The record name (@ for root, subdomain name, etc.)'
        },
        data: {
          type: 'string',
          description: 'The record data (IP address, hostname, text value, etc.)'
        },
        priority: {
          type: 'number',
          description: 'Priority for MX and SRV records'
        },
        port: {
          type: 'number',
          description: 'Port for SRV records'
        },
        ttl: {
          type: 'number',
          description: 'Time to live in seconds (default: 1800)'
        },
        weight: {
          type: 'number',
          description: 'Weight for SRV records'
        }
      },
      required: ['domain', 'type', 'name', 'data']
    },
    safety: 'write'
  },
  {
    name: 'do__delete_record',
    description: 'Delete a DNS record from a domain.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'The domain name'
        },
        record_id: {
          type: 'number',
          description: 'The ID of the DNS record to delete'
        }
      },
      required: ['domain', 'record_id']
    },
    safety: 'destructive'
  }
];

export async function executeDomainTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = getClient();

  switch (name) {
    case 'do__list_domains':
      return client.listDomains();

    case 'do__get_domain':
      return client.getDomain(args.name as string);

    case 'do__create_domain':
      return client.createDomain(args.name as string, args.ip_address as string | undefined);

    case 'do__delete_domain':
      await client.deleteDomain(args.name as string);
      return { success: true, message: `Domain ${args.name} has been removed` };

    case 'do__list_records':
      return client.listDomainRecords(args.domain as string);

    case 'do__create_record':
      const { domain, ...recordParams } = args;
      return client.createDomainRecord(domain as string, recordParams as unknown as CreateRecordParams);

    case 'do__delete_record':
      await client.deleteDomainRecord(args.domain as string, args.record_id as number);
      return { success: true, message: `Record ${args.record_id} has been deleted from ${args.domain}` };

    default:
      throw new Error(`Unknown domain tool: ${name}`);
  }
}
