import { getClient } from '../client.js';
import type { ToolDefinition, CreateDropletParams } from '../types.js';

export const dropletTools: ToolDefinition[] = [
  {
    name: 'do__list_droplets',
    description: 'List all DigitalOcean droplets in your account. Optionally filter by tag.',
    inputSchema: {
      type: 'object',
      properties: {
        tag_name: {
          type: 'string',
          description: 'Filter droplets by tag name'
        }
      }
    },
    safety: 'read'
  },
  {
    name: 'do__get_droplet',
    description: 'Get detailed information about a specific droplet by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'The unique identifier of the droplet'
        }
      },
      required: ['id']
    },
    safety: 'read'
  },
  {
    name: 'do__create_droplet',
    description: 'Create a new DigitalOcean droplet (virtual machine). Returns the created droplet.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The human-readable name for the droplet'
        },
        region: {
          type: 'string',
          description: 'The region slug (e.g., nyc1, sfo3, ams3, sgp1)'
        },
        size: {
          type: 'string',
          description: 'The size slug (e.g., s-1vcpu-1gb, s-2vcpu-4gb)'
        },
        image: {
          type: 'string',
          description: 'The image slug (e.g., ubuntu-22-04-x64, debian-12-x64) or image ID'
        },
        ssh_keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of SSH key IDs or fingerprints to enable on the droplet'
        },
        backups: {
          type: 'boolean',
          description: 'Enable automated backups ($1/month extra)'
        },
        ipv6: {
          type: 'boolean',
          description: 'Enable IPv6 networking'
        },
        monitoring: {
          type: 'boolean',
          description: 'Enable DigitalOcean monitoring agent'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to apply to the droplet'
        },
        user_data: {
          type: 'string',
          description: 'Cloud-init user data script to run on first boot'
        }
      },
      required: ['name', 'region', 'size', 'image']
    },
    safety: 'write'
  },
  {
    name: 'do__delete_droplet',
    description: 'Permanently delete a droplet. This action is irreversible and will destroy all data on the droplet.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'The unique identifier of the droplet to delete'
        }
      },
      required: ['id']
    },
    safety: 'destructive'
  },
  {
    name: 'do__reboot_droplet',
    description: 'Reboot a droplet (graceful restart). The droplet will attempt to shut down cleanly.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'The unique identifier of the droplet to reboot'
        }
      },
      required: ['id']
    },
    safety: 'write'
  },
  {
    name: 'do__power_droplet',
    description: 'Power on, power off, or power cycle a droplet.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'The unique identifier of the droplet'
        },
        action: {
          type: 'string',
          enum: ['power_on', 'power_off', 'power_cycle'],
          description: 'The power action to perform'
        }
      },
      required: ['id', 'action']
    },
    safety: 'write'
  },
  {
    name: 'do__resize_droplet',
    description: 'Resize a droplet to a different size. The droplet must be powered off first.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'The unique identifier of the droplet'
        },
        size: {
          type: 'string',
          description: 'The new size slug (e.g., s-2vcpu-4gb)'
        }
      },
      required: ['id', 'size']
    },
    safety: 'write'
  },
  {
    name: 'do__snapshot_droplet',
    description: 'Create a snapshot image of a droplet. The droplet should be powered off for consistency.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'The unique identifier of the droplet'
        },
        name: {
          type: 'string',
          description: 'A name for the snapshot'
        }
      },
      required: ['id', 'name']
    },
    safety: 'write'
  },
  {
    name: 'do__list_regions',
    description: 'List all available DigitalOcean regions where droplets can be created.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    safety: 'read'
  },
  {
    name: 'do__list_sizes',
    description: 'List all available droplet sizes with pricing and specifications.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    safety: 'read'
  },
  {
    name: 'do__list_images',
    description: 'List available images (OS distributions, applications, or your snapshots).',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['distribution', 'application'],
          description: 'Filter by image type'
        },
        private: {
          type: 'boolean',
          description: 'Show only your private images/snapshots'
        }
      }
    },
    safety: 'read'
  },
  {
    name: 'do__list_ssh_keys',
    description: 'List SSH keys registered in your DigitalOcean account.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    safety: 'read'
  }
];

export async function executeDropletTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = getClient();

  switch (name) {
    case 'do__list_droplets':
      return client.listDroplets(args as { tag_name?: string });

    case 'do__get_droplet':
      return client.getDroplet(args.id as number);

    case 'do__create_droplet':
      return client.createDroplet(args as unknown as CreateDropletParams);

    case 'do__delete_droplet':
      await client.deleteDroplet(args.id as number);
      return { success: true, message: `Droplet ${args.id} has been deleted` };

    case 'do__reboot_droplet':
      return client.performDropletAction(args.id as number, { type: 'reboot' });

    case 'do__power_droplet':
      return client.performDropletAction(args.id as number, {
        type: args.action as 'power_on' | 'power_off' | 'power_cycle'
      });

    case 'do__resize_droplet':
      return client.performDropletAction(args.id as number, {
        type: 'resize',
        size: args.size as string
      });

    case 'do__snapshot_droplet':
      return client.performDropletAction(args.id as number, {
        type: 'snapshot',
        name: args.name as string
      });

    case 'do__list_regions':
      return client.listRegions();

    case 'do__list_sizes':
      return client.listSizes();

    case 'do__list_images':
      return client.listImages(args as { type?: 'distribution' | 'application'; private?: boolean });

    case 'do__list_ssh_keys':
      return client.listSSHKeys();

    default:
      throw new Error(`Unknown droplet tool: ${name}`);
  }
}
