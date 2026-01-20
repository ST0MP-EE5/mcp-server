// Local memory provider using mem0ai OSS SDK

import { logger } from '../utils/logger.js';
import type {
  Memory as MemoryType,
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

// Dynamic import for mem0ai OSS (ESM)
// Note: mem0ai SDK does not provide TypeScript definitions, so we use `any` for the client
let Mem0Class: any = null;

async function getMem0Class() {
  if (!Mem0Class) {
    // Import from the OSS subpath for local usage
    const mem0Module = await import('mem0ai/oss');
    Mem0Class = mem0Module.Memory || mem0Module.default;
  }
  return Mem0Class;
}

export class LocalMemoryProvider {
  private client: any = null;
  private config: MemoryConfig;
  private initialized = false;

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const Mem0 = await getMem0Class();

      // Build mem0 config based on our config
      const mem0Config: any = {};

      if (this.config.local?.embedder) {
        mem0Config.embedder = {
          provider: this.config.local.embedder.provider,
          config: {
            model: this.config.local.embedder.model,
          },
        };
      }

      if (this.config.local?.vectorStore) {
        const vs = this.config.local.vectorStore;
        if (vs.provider === 'memory') {
          // In-memory store (default, no config needed)
          mem0Config.vector_store = {
            provider: 'memory',
          };
        } else if (vs.provider === 'sqlite') {
          mem0Config.vector_store = {
            provider: 'sqlite',
            config: {
              path: vs.path || './data/memory.db',
            },
          };
        } else if (vs.provider === 'qdrant') {
          mem0Config.vector_store = {
            provider: 'qdrant',
            config: {
              host: vs.host || 'localhost',
              port: vs.port || 6333,
            },
          };
        }
      }

      if (this.config.local?.llm) {
        mem0Config.llm = {
          provider: this.config.local.llm.provider,
          config: {
            model: this.config.local.llm.model,
          },
        };
      }

      if (this.config.local?.historyDbPath) {
        mem0Config.history_db_path = this.config.local.historyDbPath;
      }

      // Initialize mem0 client
      this.client = new Mem0(mem0Config);
      this.initialized = true;

      logger.info('Memory service initialized', {
        provider: 'local',
        vectorStore: this.config.local?.vectorStore?.provider || 'memory',
      });
    } catch (error: any) {
      logger.error('Failed to initialize memory service', { error: error.message });
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

      // mem0 returns an object with memories array
      const memoriesAdded = result?.memories?.length || (result?.length || 0);

      logger.debug('Memories added', {
        user_id: options.user_id,
        count: memoriesAdded,
      });

      return {
        success: true,
        memories_added: memoriesAdded,
        message: `Added ${memoriesAdded} memories`,
      };
    } catch (error: any) {
      logger.error('Failed to add memories', { error: error.message });
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

      // Normalize results
      const memories: MemoryType[] = (results || []).map((r: any) => ({
        id: r.id,
        memory: r.memory,
        hash: r.hash,
        metadata: r.metadata,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      logger.debug('Memory search', {
        query,
        user_id: options.user_id,
        results: memories.length,
      });

      return {
        memories,
        count: memories.length,
      };
    } catch (error: any) {
      logger.error('Failed to search memories', { error: error.message });
      throw error;
    }
  }

  async list(options: ListMemoryOptions): Promise<MemoryListResult> {
    await this.initialize();

    try {
      const results = await this.client.getAll({
        user_id: options.user_id,
        agent_id: options.agent_id,
        run_id: options.session_id,
      });

      // Normalize and paginate results
      const allMemories: MemoryType[] = (results || []).map((r: any) => ({
        id: r.id,
        memory: r.memory,
        hash: r.hash,
        metadata: r.metadata,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      const offset = options.offset || 0;
      const limit = options.limit || 50;
      const paginatedMemories = allMemories.slice(offset, offset + limit);

      logger.debug('Memory list', {
        user_id: options.user_id,
        total: allMemories.length,
        returned: paginatedMemories.length,
      });

      return {
        memories: paginatedMemories,
        total: allMemories.length,
        offset,
        limit,
      };
    } catch (error: any) {
      logger.error('Failed to list memories', { error: error.message });
      throw error;
    }
  }

  async delete(memoryId: string, options: { user_id: string }): Promise<MemoryDeleteResult> {
    await this.initialize();

    try {
      await this.client.delete(memoryId);

      logger.debug('Memory deleted', { memoryId, user_id: options.user_id });

      return {
        success: true,
        deleted_count: 1,
        message: `Deleted memory ${memoryId}`,
      };
    } catch (error: any) {
      logger.error('Failed to delete memory', { error: error.message });
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

      logger.debug('All memories deleted', { user_id: options.user_id });

      return {
        success: true,
        deleted_count: -1, // Unknown count for bulk delete
        message: `Deleted all memories for user ${options.user_id}`,
      };
    } catch (error: any) {
      logger.error('Failed to delete all memories', { error: error.message });
      throw error;
    }
  }
}
