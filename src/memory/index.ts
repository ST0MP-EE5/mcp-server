// Memory service singleton and initialization

import { logger } from '../utils/logger.js';
import { LocalMemoryProvider } from './local-provider.js';
import { CloudMemoryProvider } from './cloud-provider.js';
import type {
  Memory,
  MemoryMessage,
  AddMemoryOptions,
  SearchMemoryOptions,
  ListMemoryOptions,
  DeleteMemoryOptions,
  MemoryAddResult,
  MemorySearchResult,
  MemoryListResult,
  MemoryDeleteResult,
  MemoryConfig,
} from './types.js';

// Re-export types
export type {
  Memory,
  MemoryMessage,
  AddMemoryOptions,
  SearchMemoryOptions,
  ListMemoryOptions,
  DeleteMemoryOptions,
  MemoryAddResult,
  MemorySearchResult,
  MemoryListResult,
  MemoryDeleteResult,
  MemoryConfig,
};

// Memory service interface
export interface IMemoryService {
  add(messages: MemoryMessage[], options: AddMemoryOptions): Promise<MemoryAddResult>;
  search(query: string, options: SearchMemoryOptions): Promise<MemorySearchResult>;
  list(options: ListMemoryOptions): Promise<MemoryListResult>;
  delete(memoryId: string, options: { user_id: string }): Promise<MemoryDeleteResult>;
  deleteAll(options: DeleteMemoryOptions): Promise<MemoryDeleteResult>;
}

// Singleton instance
let memoryService: IMemoryService | null = null;
let memoryEnabled = false;

/**
 * Initialize the memory service
 */
export async function initializeMemoryService(config: MemoryConfig): Promise<void> {
  if (!config.enabled) {
    logger.info('Memory service disabled');
    memoryEnabled = false;
    return;
  }

  try {
    if (config.provider === 'local') {
      const provider = new LocalMemoryProvider(config);
      await provider.initialize();
      memoryService = provider;
    } else if (config.provider === 'cloud') {
      const provider = new CloudMemoryProvider(config);
      await provider.initialize();
      memoryService = provider;
    } else {
      throw new Error(`Unknown memory provider: ${config.provider}`);
    }

    memoryEnabled = true;
    logger.info('Memory service initialized', { provider: config.provider });
  } catch (error: any) {
    logger.error('Failed to initialize memory service', { error: error.message });
    memoryEnabled = false;
    memoryService = null;
  }
}

/**
 * Get the memory service instance
 * Throws if not initialized or disabled
 */
export function getMemoryService(): IMemoryService {
  if (!memoryEnabled || !memoryService) {
    throw new Error('Memory service is not enabled or initialized');
  }
  return memoryService;
}

/**
 * Check if memory service is enabled and available
 */
export function isMemoryEnabled(): boolean {
  return memoryEnabled && memoryService !== null;
}

/**
 * Shutdown the memory service
 */
export async function shutdownMemoryService(): Promise<void> {
  memoryService = null;
  memoryEnabled = false;
  logger.info('Memory service shut down');
}
