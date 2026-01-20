import { readFile, watch } from 'fs/promises';
import { parse } from 'yaml';
import chokidar from 'chokidar';
import { logger } from './utils/logger.js';

// Types
export interface MCPConfig {
  name: string;
  url?: string;
  path?: string;
  port?: number;
  auth?: {
    type: 'bearer' | 'oauth' | 'api_key';
    token?: string;
    header?: string;
  };
  enabled: boolean;
}

export interface SkillConfig {
  name: string;
  description: string;
  file: string;
  tags: string[];
}

export interface PluginConfig {
  name: string;
  description: string;
  file: string;
  runtime: 'node' | 'python' | 'shell';
}

export interface HookConfig {
  name: string;
  trigger: string;
  action: string;
}

export interface ConfigFile {
  name: string;
  file: string;
}

export interface AuthConfig {
  api_keys: Array<{
    name: string;
    key_hash: string;
    permissions: string[];
  }>;
  oauth?: {
    enabled: boolean;
    provider: 'github';
    client_id?: string;
    jwt_secret?: string;
    token_expiry?: string;
    allowed_users?: string[];  // Optional: restrict to specific GitHub usernames
  };
}

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

export interface MCPServerConfig {
  version: string;
  name: string;
  auth: AuthConfig;
  mcps: {
    external: MCPConfig[];
    local: MCPConfig[];
  };
  skills: SkillConfig[];
  plugins: PluginConfig[];
  hooks: HookConfig[];
  configs: Record<string, ConfigFile>;
  memory?: MemoryConfig;
}

// Resolve environment variables in config values
function resolveEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] || '');
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVars);
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVars(value);
    }
    return result;
  }
  return obj;
}

export async function loadConfig(path: string): Promise<MCPServerConfig> {
  try {
    const content = await readFile(path, 'utf-8');
    const config = parse(content) as MCPServerConfig;
    return resolveEnvVars(config);
  } catch (error) {
    logger.error(`Failed to load config from ${path}:`, error);
    throw error;
  }
}

export function watchConfig(path: string, onChange: (config: MCPServerConfig) => void): void {
  const watcher = chokidar.watch(path, {
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('change', async () => {
    try {
      const config = await loadConfig(path);
      onChange(config);
    } catch (error) {
      logger.error('Failed to reload config:', error);
    }
  });
}

// Skill content cache
const skillCache = new Map<string, { content: string; mtime: number }>();

export async function loadSkillContent(config: MCPServerConfig, skillName: string): Promise<string | null> {
  const skill = config.skills.find(s => s.name === skillName);
  if (!skill) return null;

  try {
    const content = await readFile(skill.file, 'utf-8');
    return content;
  } catch (error) {
    logger.error(`Failed to load skill ${skillName}:`, error);
    return null;
  }
}

export async function loadConfigContent(config: MCPServerConfig, configName: string): Promise<string | null> {
  const configDef = config.configs[configName];
  if (!configDef) return null;

  try {
    const content = await readFile(configDef.file, 'utf-8');
    return content;
  } catch (error) {
    logger.error(`Failed to load config ${configName}:`, error);
    return null;
  }
}
