#!/usr/bin/env node

/**
 * AI Hub CLI - Machine-readable interface
 * 
 * All commands output JSON to stdout.
 * Errors go to stderr with exit code 1.
 * 
 * Usage:
 *   aih <command> [args] [--flags]
 *   
 * Commands:
 *   init              Initialize new hub
 *   status            System health and stats
 *   key generate      Generate API key
 *   key list          List API keys (hashes only)
 *   key revoke <n>    Revoke a key by name
 *   mcp list          List MCPs
 *   mcp add           Add external MCP
 *   mcp test <n>      Test MCP connection
 *   mcp enable <n>    Enable MCP
 *   mcp disable <n>   Disable MCP
 *   skill list        List skills
 *   skill add         Add skill
 *   skill get <n>     Get skill content
 *   config list       List configs
 *   config get <n>    Get config content
 *   config set        Update config value
 *   server start      Start server (foreground)
 *   server stop       Stop server (if daemonized)
 *   server logs       Tail logs (JSON lines)
 *   backup            Export full state
 *   restore           Import state from backup
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'yaml';
import { spawn, execSync } from 'child_process';

// Output helpers - all output is JSON
const output = (data) => {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
};

const error = (message, code = 'ERROR', details = null) => {
  console.error(JSON.stringify({ 
    ok: false, 
    error: { code, message, details },
    timestamp: new Date().toISOString()
  }, null, 2));
  process.exit(1);
};

// Config helpers
const CONFIG_PATH = process.env.AIH_CONFIG || './aih-config.yaml';
const ENV_PATH = process.env.AIH_ENV || './.env';

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      error('Config not found. Run: aih init', 'CONFIG_NOT_FOUND');
    }
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return yaml.parse(content);
  } catch (e) {
    error(`Failed to load config: ${e.message}`, 'CONFIG_PARSE_ERROR');
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, yaml.stringify(config, { lineWidth: 0 }));
    return true;
  } catch (e) {
    error(`Failed to save config: ${e.message}`, 'CONFIG_WRITE_ERROR');
  }
}

function loadEnv() {
  const env = {};
  if (fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) env[match[1].trim()] = match[2].trim();
    });
  }
  return env;
}

function saveEnv(env) {
  const content = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  fs.writeFileSync(ENV_PATH, content + '\n');
}

// Key management
function generateKey() {
  const key = crypto.randomBytes(32).toString('hex');
  const hash = `sha256:${crypto.createHash('sha256').update(key).digest('hex')}`;
  return { key, hash };
}

// Commands
const commands = {
  init: async (args) => {
    const name = args[0] || 'ai-hub';
    
    // Generate initial keys
    const mainKey = generateKey();
    const readonlyKey = generateKey();
    
    const config = {
      version: '1.0',
      name,
      auth: {
        api_keys: [
          { name: 'main', key_hash: mainKey.hash, permissions: ['*'] },
          { name: 'readonly', key_hash: readonlyKey.hash, permissions: ['skills/*', 'configs/*'] }
        ]
      },
      mcps: { external: [], local: [] },
      skills: [],
      plugins: [],
      hooks: [],
      configs: {}
    };
    
    // Create directories
    ['skills', 'configs', 'plugins', 'hooks', 'logs', 'mcps', 'backups'].forEach(dir => {
      fs.mkdirSync(dir, { recursive: true });
    });
    
    saveConfig(config);
    saveEnv({ NODE_ENV: 'production', PORT: '3000', LOG_LEVEL: 'info' });
    
    output({
      ok: true,
      action: 'init',
      hub_name: name,
      keys: {
        main: { key: mainKey.key, hash: mainKey.hash, permissions: ['*'] },
        readonly: { key: readonlyKey.key, hash: readonlyKey.hash, permissions: ['skills/*', 'configs/*'] }
      },
      paths: {
        config: CONFIG_PATH,
        env: ENV_PATH
      },
      next_steps: [
        'Add MCP tokens to .env',
        'Run: aih mcp add <name> <url>',
        'Run: aih server start'
      ]
    });
  },

  status: async () => {
    const config = loadConfig();
    const env = loadEnv();
    
    // Check server status
    let serverStatus = 'stopped';
    let serverPid = null;
    const pidFile = './aih.pid';
    
    if (fs.existsSync(pidFile)) {
      serverPid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      try {
        process.kill(serverPid, 0); // Check if process exists
        serverStatus = 'running';
      } catch {
        serverStatus = 'dead';
        fs.unlinkSync(pidFile);
      }
    }
    
    // Count resources
    const stats = {
      mcps: {
        external: config.mcps.external.length,
        external_enabled: config.mcps.external.filter(m => m.enabled).length,
        local: config.mcps.local.length
      },
      skills: config.skills.length,
      configs: Object.keys(config.configs).length,
      api_keys: config.auth.api_keys.length
    };
    
    // Check disk usage
    let diskUsage = null;
    try {
      const du = execSync('du -sh . 2>/dev/null', { encoding: 'utf-8' }).trim();
      diskUsage = du.split('\t')[0];
    } catch {}
    
    output({
      ok: true,
      hub_name: config.name,
      version: config.version,
      server: {
        status: serverStatus,
        pid: serverPid,
        port: env.PORT || 3000
      },
      stats,
      disk_usage: diskUsage,
      timestamp: new Date().toISOString()
    });
  },

  key: {
    generate: async (args) => {
      const name = args[0];
      if (!name) error('Key name required', 'MISSING_ARG');
      
      const permissions = args[1]?.split(',') || ['*'];
      const config = loadConfig();
      
      // Check for duplicate
      if (config.auth.api_keys.find(k => k.name === name)) {
        error(`Key '${name}' already exists`, 'DUPLICATE_KEY');
      }
      
      const { key, hash } = generateKey();
      
      config.auth.api_keys.push({
        name,
        key_hash: hash,
        permissions
      });
      
      saveConfig(config);
      
      output({
        ok: true,
        action: 'key_generate',
        name,
        key,  // Only shown once!
        hash,
        permissions,
        warning: 'Save this key now. It cannot be retrieved later.'
      });
    },
    
    list: async () => {
      const config = loadConfig();
      
      output({
        ok: true,
        keys: config.auth.api_keys.map(k => ({
          name: k.name,
          hash_prefix: k.key_hash.substring(0, 20) + '...',
          permissions: k.permissions
        }))
      });
    },
    
    revoke: async (args) => {
      const name = args[0];
      if (!name) error('Key name required', 'MISSING_ARG');
      
      const config = loadConfig();
      const idx = config.auth.api_keys.findIndex(k => k.name === name);
      
      if (idx === -1) error(`Key '${name}' not found`, 'KEY_NOT_FOUND');
      
      config.auth.api_keys.splice(idx, 1);
      saveConfig(config);
      
      output({ ok: true, action: 'key_revoke', name });
    }
  },

  mcp: {
    list: async () => {
      const config = loadConfig();
      
      output({
        ok: true,
        mcps: {
          external: config.mcps.external.map(m => ({
            name: m.name,
            url: m.url,
            enabled: m.enabled,
            has_auth: !!m.auth
          })),
          local: config.mcps.local.map(m => ({
            name: m.name,
            port: m.port,
            enabled: m.enabled
          }))
        }
      });
    },
    
    add: async (args, flags) => {
      const [name, url] = args;
      if (!name || !url) error('Usage: aih mcp add <name> <url>', 'MISSING_ARG');
      
      const config = loadConfig();
      
      if (config.mcps.external.find(m => m.name === name)) {
        error(`MCP '${name}' already exists`, 'DUPLICATE_MCP');
      }
      
      const mcp = {
        name,
        url,
        auth: null,
        enabled: true
      };
      
      // Handle auth
      if (flags.token) {
        const envVar = `${name.toUpperCase().replace(/-/g, '_')}_TOKEN`;
        mcp.auth = { type: flags.authType || 'bearer', token: `\${${envVar}}` };
        
        // Add to .env
        const env = loadEnv();
        env[envVar] = flags.token;
        saveEnv(env);
      }
      
      config.mcps.external.push(mcp);
      saveConfig(config);
      
      output({
        ok: true,
        action: 'mcp_add',
        mcp: { name, url, enabled: true, has_auth: !!mcp.auth }
      });
    },
    
    test: async (args) => {
      const name = args[0];
      if (!name) error('MCP name required', 'MISSING_ARG');
      
      const config = loadConfig();
      const mcp = config.mcps.external.find(m => m.name === name);
      
      if (!mcp) error(`MCP '${name}' not found`, 'MCP_NOT_FOUND');
      
      // Test connection
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(mcp.url, {
          signal: controller.signal,
          headers: { 'Accept': 'text/event-stream' }
        });
        
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        
        output({
          ok: true,
          action: 'mcp_test',
          name,
          url: mcp.url,
          status: response.status,
          latency_ms: latency,
          reachable: response.ok
        });
      } catch (e) {
        output({
          ok: false,
          action: 'mcp_test',
          name,
          url: mcp.url,
          error: e.message,
          latency_ms: Date.now() - startTime,
          reachable: false
        });
      }
    },
    
    enable: async (args) => {
      const name = args[0];
      if (!name) error('MCP name required', 'MISSING_ARG');
      
      const config = loadConfig();
      const mcp = config.mcps.external.find(m => m.name === name);
      
      if (!mcp) error(`MCP '${name}' not found`, 'MCP_NOT_FOUND');
      
      mcp.enabled = true;
      saveConfig(config);
      
      output({ ok: true, action: 'mcp_enable', name });
    },
    
    disable: async (args) => {
      const name = args[0];
      if (!name) error('MCP name required', 'MISSING_ARG');
      
      const config = loadConfig();
      const mcp = config.mcps.external.find(m => m.name === name);
      
      if (!mcp) error(`MCP '${name}' not found`, 'MCP_NOT_FOUND');
      
      mcp.enabled = false;
      saveConfig(config);
      
      output({ ok: true, action: 'mcp_disable', name });
    },
    
    remove: async (args) => {
      const name = args[0];
      if (!name) error('MCP name required', 'MISSING_ARG');
      
      const config = loadConfig();
      const idx = config.mcps.external.findIndex(m => m.name === name);
      
      if (idx === -1) error(`MCP '${name}' not found`, 'MCP_NOT_FOUND');
      
      config.mcps.external.splice(idx, 1);
      saveConfig(config);
      
      output({ ok: true, action: 'mcp_remove', name });
    }
  },

  skill: {
    list: async () => {
      const config = loadConfig();
      
      output({
        ok: true,
        skills: config.skills.map(s => ({
          name: s.name,
          description: s.description,
          tags: s.tags,
          file: s.file
        }))
      });
    },
    
    add: async (args, flags) => {
      const [name, description] = args;
      if (!name) error('Usage: aih skill add <name> [description]', 'MISSING_ARG');
      
      const config = loadConfig();
      
      if (config.skills.find(s => s.name === name)) {
        error(`Skill '${name}' already exists`, 'DUPLICATE_SKILL');
      }
      
      const filePath = `./skills/${name}.md`;
      const tags = flags.tags?.split(',') || ['general'];
      
      // Create skill file
      const template = `# ${name}\n\n${description || 'Skill description'}\n\n## Instructions\n\n<!-- Add instructions here -->\n`;
      fs.writeFileSync(filePath, template);
      
      config.skills.push({
        name,
        description: description || '',
        file: filePath,
        tags
      });
      
      saveConfig(config);
      
      output({
        ok: true,
        action: 'skill_add',
        skill: { name, description, file: filePath, tags }
      });
    },
    
    get: async (args) => {
      const name = args[0];
      if (!name) error('Skill name required', 'MISSING_ARG');
      
      const config = loadConfig();
      const skill = config.skills.find(s => s.name === name);
      
      if (!skill) error(`Skill '${name}' not found`, 'SKILL_NOT_FOUND');
      
      let content = null;
      try {
        content = fs.readFileSync(skill.file, 'utf-8');
      } catch {
        error(`Skill file not found: ${skill.file}`, 'FILE_NOT_FOUND');
      }
      
      output({
        ok: true,
        skill: {
          name: skill.name,
          description: skill.description,
          tags: skill.tags,
          content
        }
      });
    },
    
    update: async (args) => {
      const [name, content] = args;
      if (!name || !content) error('Usage: aih skill update <name> <content>', 'MISSING_ARG');
      
      const config = loadConfig();
      const skill = config.skills.find(s => s.name === name);
      
      if (!skill) error(`Skill '${name}' not found`, 'SKILL_NOT_FOUND');
      
      fs.writeFileSync(skill.file, content);
      
      output({ ok: true, action: 'skill_update', name });
    },
    
    remove: async (args) => {
      const name = args[0];
      if (!name) error('Skill name required', 'MISSING_ARG');
      
      const config = loadConfig();
      const idx = config.skills.findIndex(s => s.name === name);
      
      if (idx === -1) error(`Skill '${name}' not found`, 'SKILL_NOT_FOUND');
      
      const skill = config.skills[idx];
      
      // Remove file
      if (fs.existsSync(skill.file)) {
        fs.unlinkSync(skill.file);
      }
      
      config.skills.splice(idx, 1);
      saveConfig(config);
      
      output({ ok: true, action: 'skill_remove', name });
    }
  },

  config: {
    list: async () => {
      const config = loadConfig();
      
      output({
        ok: true,
        configs: Object.entries(config.configs).map(([name, cfg]) => ({
          name,
          file: cfg.file,
          exists: fs.existsSync(cfg.file)
        }))
      });
    },
    
    get: async (args) => {
      const name = args[0];
      if (!name) error('Config name required', 'MISSING_ARG');
      
      const config = loadConfig();
      const cfg = config.configs[name];
      
      if (!cfg) error(`Config '${name}' not found`, 'CONFIG_NOT_FOUND');
      
      let content = null;
      try {
        content = fs.readFileSync(cfg.file, 'utf-8');
      } catch {
        error(`Config file not found: ${cfg.file}`, 'FILE_NOT_FOUND');
      }
      
      output({ ok: true, name, file: cfg.file, content });
    },
    
    set: async (args) => {
      const [name, content] = args;
      if (!name || content === undefined) error('Usage: aih config set <name> <content>', 'MISSING_ARG');
      
      const config = loadConfig();
      
      if (!config.configs[name]) {
        // Create new config
        const filePath = `./configs/${name}`;
        config.configs[name] = { file: filePath };
      }
      
      fs.writeFileSync(config.configs[name].file, content);
      saveConfig(config);
      
      output({ ok: true, action: 'config_set', name });
    }
  },

  backup: async () => {
    const config = loadConfig();
    const env = loadEnv();
    
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      config,
      env: Object.fromEntries(
        Object.entries(env).filter(([k]) => !k.includes('TOKEN') && !k.includes('KEY'))
      ),
      skills: {},
      configs: {}
    };
    
    // Include skill contents
    for (const skill of config.skills) {
      if (fs.existsSync(skill.file)) {
        backup.skills[skill.name] = fs.readFileSync(skill.file, 'utf-8');
      }
    }
    
    // Include config contents
    for (const [name, cfg] of Object.entries(config.configs)) {
      if (fs.existsSync(cfg.file)) {
        backup.configs[name] = fs.readFileSync(cfg.file, 'utf-8');
      }
    }
    
    // Save backup
    const backupPath = `./backups/backup-${Date.now()}.json`;
    fs.mkdirSync('./backups', { recursive: true });
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    output({
      ok: true,
      action: 'backup',
      path: backupPath,
      size_bytes: fs.statSync(backupPath).size,
      skills_count: Object.keys(backup.skills).length,
      configs_count: Object.keys(backup.configs).length
    });
  },

  restore: async (args) => {
    const backupPath = args[0];
    if (!backupPath) error('Backup path required', 'MISSING_ARG');
    
    if (!fs.existsSync(backupPath)) {
      error(`Backup not found: ${backupPath}`, 'FILE_NOT_FOUND');
    }
    
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    
    // Restore config
    saveConfig(backup.config);
    
    // Restore skills
    for (const [name, content] of Object.entries(backup.skills)) {
      const skill = backup.config.skills.find(s => s.name === name);
      if (skill) {
        fs.mkdirSync(path.dirname(skill.file), { recursive: true });
        fs.writeFileSync(skill.file, content);
      }
    }
    
    // Restore configs
    for (const [name, content] of Object.entries(backup.configs)) {
      const cfg = backup.config.configs[name];
      if (cfg) {
        fs.mkdirSync(path.dirname(cfg.file), { recursive: true });
        fs.writeFileSync(cfg.file, content);
      }
    }
    
    output({
      ok: true,
      action: 'restore',
      backup_timestamp: backup.timestamp,
      skills_restored: Object.keys(backup.skills).length,
      configs_restored: Object.keys(backup.configs).length
    });
  },

  deploy: {
    // Generate DigitalOcean App Platform spec
    'app-spec': async (args, flags) => {
      const config = loadConfig();
      const env = loadEnv();
      
      const repo = flags.repo;
      if (!repo) error('--repo=owner/name required', 'MISSING_ARG');
      
      const region = flags.region || 'nyc';
      const branch = flags.branch || 'main';
      const size = flags.size || 'basic-xxs';
      
      // Build env vars for spec (exclude actual secrets, use references)
      const envVars = [];
      for (const [key, value] of Object.entries(env)) {
        if (key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')) {
          envVars.push({ key, value: '${' + key + '}', type: 'SECRET' });
        } else {
          envVars.push({ key, value, type: 'GENERAL' });
        }
      }
      
      const spec = {
        name: config.name || 'ai-hub',
        region,
        services: [{
          name: 'api',
          github: { repo, branch, deploy_on_push: true },
          build_command: 'npm ci && npm run build',
          run_command: 'npm start',
          http_port: 3000,
          instance_size_slug: size,
          instance_count: 1,
          routes: [{ path: '/' }],
          health_check: {
            http_path: '/health',
            initial_delay_seconds: 10,
            period_seconds: 30
          },
          envs: envVars
        }]
      };
      
      // Save spec
      const specPath = '.do/app.yaml';
      fs.mkdirSync('.do', { recursive: true });
      
      // Convert to YAML manually (simple case)
      let yaml = `name: ${spec.name}\n`;
      yaml += `region: ${spec.region}\n`;
      yaml += `services:\n`;
      yaml += `  - name: api\n`;
      yaml += `    github:\n`;
      yaml += `      repo: ${repo}\n`;
      yaml += `      branch: ${branch}\n`;
      yaml += `      deploy_on_push: true\n`;
      yaml += `    build_command: npm ci && npm run build\n`;
      yaml += `    run_command: npm start\n`;
      yaml += `    http_port: 3000\n`;
      yaml += `    instance_size_slug: ${size}\n`;
      yaml += `    instance_count: 1\n`;
      yaml += `    routes:\n`;
      yaml += `      - path: /\n`;
      yaml += `    health_check:\n`;
      yaml += `      http_path: /health\n`;
      yaml += `      initial_delay_seconds: 10\n`;
      yaml += `      period_seconds: 30\n`;
      yaml += `    envs:\n`;
      for (const e of envVars) {
        yaml += `      - key: ${e.key}\n`;
        yaml += `        value: "${e.value}"\n`;
        yaml += `        type: ${e.type}\n`;
      }
      
      fs.writeFileSync(specPath, yaml);
      
      output({
        ok: true,
        action: 'deploy_app_spec',
        path: specPath,
        spec: {
          name: spec.name,
          region,
          repo,
          branch,
          size,
          env_count: envVars.length
        },
        next_steps: [
          'Commit .do/app.yaml to your repo',
          'Run: doctl apps create --spec .do/app.yaml',
          'Or: Connect repo in DO dashboard and it auto-detects'
        ]
      });
    },
    
    // Generate droplet setup script
    'droplet-script': async (args, flags) => {
      const config = loadConfig();
      const port = flags.port || 3000;
      const user = flags.user || 'aih';
      const installDir = flags.dir || '/opt/ai-hub';
      const repo = flags.repo;
      
      if (!repo) error('--repo=https://github.com/owner/name.git required', 'MISSING_ARG');
      
      const script = `#!/bin/bash
# AI Hub Droplet Setup Script
# Generated: ${new Date().toISOString()}
# Run as root: curl -fsSL <url> | bash

set -euo pipefail

echo '{"event":"setup_start","timestamp":"'$(date -Iseconds)'"}'

# Update system
apt-get update -qq
apt-get upgrade -y -qq

# Install Node.js 20
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo '{"event":"node_installed","version":"'$(node --version)'"}'

# Create user
if ! id -u ${user} &> /dev/null; then
  useradd -m -s /bin/bash ${user}
fi

# Clone/update repo
if [ -d "${installDir}" ]; then
  cd ${installDir}
  git pull
else
  git clone ${repo} ${installDir}
  cd ${installDir}
fi

# Install dependencies
npm ci --production

# Build
npm run build

# Set ownership
chown -R ${user}:${user} ${installDir}

echo '{"event":"app_installed","dir":"${installDir}"}'

# Create systemd service
cat > /etc/systemd/system/ai-hub.service << 'SERVICEEOF'
[Unit]
Description=AI Infrastructure Hub
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${installDir}
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=${port}

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=${installDir}/logs ${installDir}/backups
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and start
systemctl daemon-reload
systemctl enable ai-hub
systemctl start ai-hub

echo '{"event":"service_started","status":"'$(systemctl is-active ai-hub)'"}'

# Setup firewall
if command -v ufw &> /dev/null; then
  ufw allow ${port}/tcp
  ufw --force enable
fi

# Final status
sleep 2
curl -s http://localhost:${port}/health || echo '{"error":"health_check_failed"}'

echo '{"event":"setup_complete","url":"http://'$(curl -s ifconfig.me)':${port}'"}'
`;
      
      const scriptPath = './scripts/setup-droplet.sh';
      fs.mkdirSync('./scripts', { recursive: true });
      fs.writeFileSync(scriptPath, script);
      fs.chmodSync(scriptPath, '755');
      
      output({
        ok: true,
        action: 'deploy_droplet_script',
        path: scriptPath,
        config: {
          repo,
          user,
          install_dir: installDir,
          port
        },
        usage: [
          `scp ${scriptPath} root@<droplet-ip>:/tmp/setup.sh`,
          `scp .env root@<droplet-ip>:${installDir}/.env`,
          `ssh root@<droplet-ip> 'bash /tmp/setup.sh'`
        ]
      });
    },
    
    // Check doctl status
    'doctl-check': async () => {
      let doctlVersion = null;
      let authenticated = false;
      let account = null;
      
      try {
        doctlVersion = execSync('doctl version', { encoding: 'utf-8' }).trim();
      } catch {
        output({
          ok: false,
          doctl_installed: false,
          install_url: 'https://docs.digitalocean.com/reference/doctl/how-to/install/'
        });
        return;
      }
      
      try {
        const acct = execSync('doctl account get -o json', { encoding: 'utf-8' });
        account = JSON.parse(acct);
        authenticated = true;
      } catch {
        authenticated = false;
      }
      
      output({
        ok: true,
        doctl_installed: true,
        doctl_version: doctlVersion,
        authenticated,
        account: account ? {
          email: account.email,
          status: account.status,
          droplet_limit: account.droplet_limit
        } : null,
        next_steps: authenticated ? [] : ['Run: doctl auth init']
      });
    },
    
    // Create app via doctl
    'app-create': async (args, flags) => {
      const specPath = flags.spec || '.do/app.yaml';
      
      if (!fs.existsSync(specPath)) {
        error(`Spec not found: ${specPath}. Run: aih deploy app-spec --repo=...`, 'FILE_NOT_FOUND');
      }
      
      try {
        execSync('doctl version', { stdio: 'pipe' });
      } catch {
        error('doctl not installed', 'DOCTL_NOT_FOUND');
      }
      
      try {
        const result = execSync(`doctl apps create --spec ${specPath} -o json`, { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        const app = JSON.parse(result);
        
        output({
          ok: true,
          action: 'deploy_app_create',
          app: {
            id: app.id,
            name: app.spec?.name,
            default_ingress: app.default_ingress,
            created_at: app.created_at,
            phase: app.phase
          },
          next_steps: [
            `Monitor: doctl apps get ${app.id}`,
            `Logs: doctl apps logs ${app.id}`,
            `URL will be available after deploy completes`
          ]
        });
      } catch (e) {
        error(`doctl failed: ${e.message}`, 'DOCTL_ERROR');
      }
    },
    
    // List apps
    'app-list': async () => {
      try {
        const result = execSync('doctl apps list -o json', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const apps = JSON.parse(result);
        
        output({
          ok: true,
          apps: apps.map(a => ({
            id: a.id,
            name: a.spec?.name,
            phase: a.phase,
            url: a.default_ingress,
            updated_at: a.updated_at
          }))
        });
      } catch (e) {
        error(`doctl failed: ${e.message}`, 'DOCTL_ERROR');
      }
    },
    
    // Get app status
    'app-status': async (args) => {
      const appId = args[0];
      if (!appId) error('App ID required', 'MISSING_ARG');
      
      try {
        const result = execSync(`doctl apps get ${appId} -o json`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const app = JSON.parse(result);
        
        output({
          ok: true,
          app: {
            id: app.id,
            name: app.spec?.name,
            phase: app.phase,
            url: app.default_ingress,
            created_at: app.created_at,
            updated_at: app.updated_at,
            region: app.region?.slug,
            tier: app.tier_slug
          }
        });
      } catch (e) {
        error(`doctl failed: ${e.message}`, 'DOCTL_ERROR');
      }
    }
  },

  server: {
    start: async (args, flags) => {
      const daemon = flags.daemon || flags.d;
      
      if (daemon) {
        // Start as daemon
        const out = fs.openSync('./logs/server.log', 'a');
        const err = fs.openSync('./logs/server.log', 'a');
        
        const child = spawn('node', ['dist/index.js'], {
          detached: true,
          stdio: ['ignore', out, err]
        });
        
        fs.writeFileSync('./aih.pid', String(child.pid));
        child.unref();
        
        output({
          ok: true,
          action: 'server_start',
          mode: 'daemon',
          pid: child.pid,
          log: './logs/server.log'
        });
      } else {
        // Start in foreground (for container/systemd)
        output({
          ok: true,
          action: 'server_start',
          mode: 'foreground',
          message: 'Starting server...'
        });
        
        // Import and run server
        await import('./index.js');
      }
    },
    
    stop: async () => {
      const pidFile = './aih.pid';
      
      if (!fs.existsSync(pidFile)) {
        error('Server not running (no PID file)', 'NOT_RUNNING');
      }
      
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      
      try {
        process.kill(pid, 'SIGTERM');
        fs.unlinkSync(pidFile);
        
        output({ ok: true, action: 'server_stop', pid });
      } catch (e) {
        fs.unlinkSync(pidFile);
        error(`Failed to stop server: ${e.message}`, 'STOP_FAILED');
      }
    },
    
    logs: async (args, flags) => {
      const lines = parseInt(flags.n || flags.lines) || 50;
      const logFile = './logs/combined.log';
      
      if (!fs.existsSync(logFile)) {
        output({ ok: true, logs: [] });
        return;
      }
      
      const content = fs.readFileSync(logFile, 'utf-8');
      const allLines = content.trim().split('\n').slice(-lines);
      
      // Try to parse as JSON lines
      const logs = allLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });
      
      output({ ok: true, count: logs.length, logs });
    }
  },

  help: async () => {
    output({
      ok: true,
      version: '1.0.0',
      commands: {
        init: 'Initialize new hub',
        status: 'System health and stats',
        'key generate <name> [permissions]': 'Generate API key',
        'key list': 'List API keys',
        'key revoke <name>': 'Revoke API key',
        'mcp list': 'List MCPs',
        'mcp add <name> <url> [--token=X]': 'Add external MCP',
        'mcp test <name>': 'Test MCP connection',
        'mcp enable|disable <name>': 'Toggle MCP',
        'mcp remove <name>': 'Remove MCP',
        'skill list': 'List skills',
        'skill add <name> [desc] [--tags=X]': 'Add skill',
        'skill get <name>': 'Get skill content',
        'skill update <name> <content>': 'Update skill',
        'skill remove <name>': 'Remove skill',
        'config list': 'List configs',
        'config get <name>': 'Get config content',
        'config set <name> <content>': 'Set config',
        backup: 'Export full state to JSON',
        'restore <path>': 'Restore from backup',
        'server start [--daemon]': 'Start server',
        'server stop': 'Stop daemon',
        'server logs [--lines=N]': 'View logs',
        'deploy doctl-check': 'Check doctl CLI status',
        'deploy app-spec --repo=owner/repo': 'Generate DO App Platform spec',
        'deploy app-create [--spec=path]': 'Create app via doctl',
        'deploy app-list': 'List your DO apps',
        'deploy app-status <app-id>': 'Get app deployment status',
        'deploy droplet-script --repo=url': 'Generate droplet setup script'
      }
    });
  }
};

// Parse args and flags
function parseArgs(argv) {
  const args = [];
  const flags = {};
  
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value ?? true;
    } else if (arg.startsWith('-')) {
      flags[arg.slice(1)] = true;
    } else {
      args.push(arg);
    }
  }
  
  return { args, flags };
}

// Main
async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  
  if (args.length === 0 || flags.help || flags.h) {
    await commands.help();
    return;
  }
  
  const [cmd, subcmd, ...rest] = args;
  
  // Handle nested commands (key generate, mcp list, etc.)
  if (commands[cmd] && typeof commands[cmd] === 'object' && subcmd) {
    if (commands[cmd][subcmd]) {
      await commands[cmd][subcmd](rest, flags);
    } else {
      error(`Unknown subcommand: ${cmd} ${subcmd}`, 'UNKNOWN_COMMAND');
    }
  } else if (commands[cmd] && typeof commands[cmd] === 'function') {
    await commands[cmd](args.slice(1), flags);
  } else {
    error(`Unknown command: ${cmd}`, 'UNKNOWN_COMMAND');
  }
}

main().catch(e => error(e.message, 'UNEXPECTED_ERROR', e.stack));
