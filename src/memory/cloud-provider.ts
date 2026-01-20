// Cloud memory provider using mem0 Cloud API

import { logger } from '../utils/logger.js';
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

// Dynamic import for mem0ai cloud client (ESM)
let MemoryClientClass: any = null;

async function getMemoryClientClass() {
  if (!MemoryClientClass) {
    const mem0Module = await import('mem0ai');
    MemoryClientClass = mem0Module.MemoryClient || mem0Module.default;
  }
  return MemoryClientClass;
}

export class CloudMemoryProvider {
  private client: any = null;
  private config: MemoryConfig;
  private initialized = false;

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const apiKey = this.config.cloud?.apiKey || process.env.MEM0_API_KEY;
    if (!apiKey) {
      throw new Error('mem0 cloud API key is required. Set MEM0_API_KEY env var or config.cloud.apiKey');
    }

    try {
      const MemoryClient = await getMemoryClientClass();

      this.client = new MemoryClient({
        apiKey,
      });

      // Test connection
      await this.client.ping();

      this.initialized = true;
      logger.info('Memory service initialized', { provider: 'cloud' });
    } catch (error: any) {
      logger.error('Failed to initialize mem0 cloud', { error: error.message });
      throw error;
    }
  }

  async add(messages: MemoryMessage[], options: AddMemoryOptions): Promise<MemoryAddResult> {
    await this.initialize();

    try {
      const result = await this.client.add(messages, {
        user_id: options.user_id,
        agent_id: options.agent_id,
        run_id: options.session_id,
        metadata: options.metadata,
      });

      const memoriesAdded = Array.isArray(result) ? result.length : 1;

      logger.debug('Memories added (cloud)', {
        user_id: options.user_id,
        count: memoriesAdded,
      });

      return {
        success: true,
        memories_added: memoriesAdded,
        message: `Added ${memoriesAdded} memories`,
      };
    } catch (error: any) {
      logger.error('Failed to add memories (cloud)', { error: error.message });
      throw error;
    }
  }

  async search(query: string, options: SearchMemoryOptions): Promise<MemorySearchResult> {
    await this.initialize();

    try {
      const results = await this.client.search(query, {
        user_id: options.user_id,
        agent_id: options.agent_id,
        run_id: options.session_id,
        limit: options.limit || 10,
      });

      const memories: Memory[] = (results || []).map((r: any) => ({
        id: r.id,
        memory: r.memory,
        hash: r.hash,
        metadata: r.metadata,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      logger.debug('Memory search (cloud)', {
        query,
        user_id: options.user_id,
        results: memories.length,
      });

      return {
        memories,
        count: memories.length,
      };
    } catch (error: any) {
      logger.error('Failed to search memories (cloud)', { error: error.message });
      throw error;
    }
  }

  async list(options: ListMemoryOptions): Promise<MemoryListResult> {
    await this.initialize();

    try {
      const response = await this.client.getAll({
        user_id: options.user_id,
        agent_id: options.agent_id,
        run_id: options.session_id,
        page_size: options.limit || 50,
        page: options.offset ? Math.floor(options.offset / (options.limit || 50)) + 1 : 1,
      });

      // Handle both array response and paginated object response
      const resultArray = Array.isArray(response) ? response : (response?.results || []);
      const total = Array.isArray(response) ? resultArray.length : (response?.count || resultArray.length);

      const memories: Memory[] = resultArray.map((r: any) => ({
        id: r.id,
        memory: r.memory,
        hash: r.hash,
        metadata: r.metadata,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      logger.debug('Memory list (cloud)', {
        user_id: options.user_id,
        returned: memories.length,
      });

      return {
        memories,
        total,
        offset: options.offset || 0,
        limit: options.limit || 50,
      };
    } catch (error: any) {
      logger.error('Failed to list memories (cloud)', { error: error.message });
      throw error;
    }
  }

  async delete(memoryId: string, options: { user_id: string }): Promise<MemoryDeleteResult> {
    await this.initialize();

    try {
      await this.client.delete(memoryId);

      logger.debug('Memory deleted (cloud)', { memoryId, user_id: options.user_id });

      return {
        success: true,
        deleted_count: 1,
        message: `Deleted memory ${memoryId}`,
      };
    } catch (error: any) {
      logger.error('Failed to delete memory (cloud)', { error: error.message });
      throw error;
    }
  }

  async deleteAll(options: DeleteMemoryOptions): Promise<MemoryDeleteResult> {
    await this.initialize();

    try {
      await this.client.deleteAll({
        user_id: options.user_id,
        agent_id: options.agent_id,
        run_id: options.session_id,
      });

      logger.debug('All memories deleted (cloud)', { user_id: options.user_id });

      return {
        success: true,
        deleted_count: -1,
        message: `Deleted all memories for user ${options.user_id}`,
      };
    } catch (error: any) {
      logger.error('Failed to delete all memories (cloud)', { error: error.message });
      throw error;
    }
  }
}
