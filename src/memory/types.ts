// Memory service types

export interface Memory {
  id: string;
  memory: string;
  hash?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AddMemoryOptions {
  user_id: string;
  session_id?: string;
  agent_id?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchMemoryOptions {
  user_id: string;
  session_id?: string;
  agent_id?: string;
  limit?: number;
}

export interface ListMemoryOptions {
  user_id: string;
  session_id?: string;
  agent_id?: string;
  limit?: number;
  offset?: number;
}

export interface DeleteMemoryOptions {
  user_id: string;
  session_id?: string;
  agent_id?: string;
}

export interface MemoryAddResult {
  success: boolean;
  memories_added: number;
  message: string;
}

export interface MemorySearchResult {
  memories: Memory[];
  count: number;
}

export interface MemoryListResult {
  memories: Memory[];
  total: number;
  offset: number;
  limit: number;
}

export interface MemoryDeleteResult {
  success: boolean;
  deleted_count: number;
  message: string;
}

// Config types
export interface MemoryConfig {
  enabled: boolean;
  provider: 'local' | 'cloud';

  local?: {
    embedder?: {
      provider: string;
      model: string;
    };
    vectorStore?: {
      provider: 'memory' | 'sqlite' | 'qdrant';
      path?: string;
      host?: string;
      port?: number;
    };
    llm?: {
      provider: string;
      model: string;
    };
    historyDbPath?: string;
  };

  cloud?: {
    apiKey?: string;
  };
}
