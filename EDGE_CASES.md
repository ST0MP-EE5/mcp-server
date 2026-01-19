# Edge Cases & Hardening Guide

This document covers all known edge cases and how MCP-Server handles them.

## Connection & Network

### 1. MCP Connection Failures

**Problem**: External MCP becomes unreachable mid-conversation.

**Handling**:
```javascript
// Implemented in mcp-gateway.ts
- Timeout: 30s for initial connection, 10s for tool calls
- Retry: 3 attempts with exponential backoff (1s, 2s, 4s)
- Circuit breaker: After 5 failures in 60s, mark MCP as degraded
- Graceful degradation: Return error for that MCP's tools, others continue working
```

**CLI Check**:
```bash
mcp remote test stripe
# Returns: { ok: false, error: "timeout", latency_ms: 10000 }
```

### 2. SSE Connection Drops

**Problem**: Client SSE connection drops (network issue, client crash).

**Handling**:
- Heartbeat every 30s to detect dead connections
- Automatic cleanup of stale connections after 60s no activity
- Connection ID tracking for proper resource cleanup
- No state stored per-connection (stateless design)

### 3. Concurrent Connection Limits

**Problem**: Too many simultaneous SSE connections exhaust resources.

**Handling**:
```javascript
// Limits
MAX_CONNECTIONS_PER_KEY = 10    // Per API key
MAX_TOTAL_CONNECTIONS = 100     // Server-wide
CONNECTION_TIMEOUT = 3600000    // 1 hour max connection

// When limit hit: 429 Too Many Requests with retry-after header
```

---

## Authentication & Security

### 4. Token Expiration

**Problem**: External MCP tokens expire.

**Handling**:
- Store token refresh info in config
- On 401 from external MCP: 
  1. Try refresh if refresh_token available
  2. Mark MCP as `auth_expired`
  3. Return clear error to client
  4. Log for monitoring

**Detection**:
```bash
mcpstatus
# Shows: mcps.stripe.status: "auth_expired"
```

### 5. API Key Rotation

**Problem**: Need to rotate keys without downtime.

**Handling**:
- Support multiple active keys per name (key_hashes array)
- Deprecation period: old key works for 24h after new key added
- Audit log shows which key was used

```bash
# Add new key
mcpkey generate main-v2
# Old key still works for 24h
# Then revoke old key
mcpkey revoke main
```

### 6. Timing Attacks on Auth

**Problem**: Different response times leak valid vs invalid keys.

**Handling**:
- Constant-time comparison for key verification
- Same response time for valid/invalid keys
- No information leakage in error messages

---

## Configuration

### 7. Hot Reload Race Conditions

**Problem**: Config changes during active request processing.

**Handling**:
```javascript
// Atomic config swap
- Load new config into memory
- Validate completely before swap
- Swap reference atomically
- In-flight requests complete with old config
- New requests use new config

// No partial configs ever visible
```

### 8. Invalid Config on Startup

**Problem**: Server starts with invalid/corrupt config.

**Handling**:
- Strict validation on load
- Fail fast with clear error message
- Keep last-known-good config in `.mcp-config.backup.yaml`
- Recovery: `mcprestore <backup>`

```bash
# Validate without starting
mcpconfig validate
# Returns: { ok: true } or { ok: false, errors: [...] }
```

### 9. Environment Variable Missing

**Problem**: Referenced env var (e.g., `${STRIPE_TOKEN}`) not set.

**Handling**:
- On startup: Warn but don't fail (MCP marked as `misconfigured`)
- On use: Clear error message indicating which var is missing
- Status shows misconfigured MCPs

---

## Resource Management

### 10. Memory Leaks from SSE

**Problem**: Long-running SSE connections accumulate memory.

**Handling**:
- WeakMap for client tracking (auto GC when connection drops)
- Explicit cleanup on disconnect
- Memory monitoring endpoint
- Max connection lifetime (1 hour, reconnect required)

### 11. Log Rotation

**Problem**: Logs grow unbounded.

**Handling**:
```javascript
// Built-in rotation
logs/
  combined.log      // Current, max 10MB
  combined.1.log    // Previous
  combined.2.log    // Older (max 5 files)
  error.log         // Errors only, same rotation

// Or use external: logrotate, systemd journal
```

### 12. Disk Full

**Problem**: Disk fills up (logs, backups).

**Handling**:
- Monitor disk usage in status
- Automatic log rotation (see above)
- Backup pruning: keep last 10 backups
- Graceful handling: stop writes, continue serving cached data

---

## Tool Execution

### 13. Tool Name Collisions

**Problem**: Two MCPs expose same tool name.

**Handling**:
- Namespacing: `{mcp_name}__{tool_name}`
- On collision: Later MCP's tool shadows earlier
- Config warning on collision detected
- Can disable specific tools per MCP

### 14. Large Payload Handling

**Problem**: Tool returns massive response (e.g., 100MB file content).

**Handling**:
```javascript
// Limits
MAX_TOOL_RESPONSE_SIZE = 10 * 1024 * 1024  // 10MB
MAX_REQUEST_SIZE = 1 * 1024 * 1024          // 1MB

// On exceed: Truncate with warning, or error if critical
```

### 15. Slow Tool Execution

**Problem**: Tool takes too long, blocks other requests.

**Handling**:
- Timeout per tool call: 60s default, configurable per MCP
- Async execution: doesn't block other connections
- Progress events for long-running tools (if MCP supports)

### 16. Tool Returns Invalid JSON

**Problem**: External MCP returns malformed response.

**Handling**:
- Validate all responses
- On invalid: wrap in error response with raw content
- Log for debugging
- Don't crash, continue serving other requests

---

## Availability

### 17. Graceful Shutdown

**Problem**: Server restart loses in-flight requests.

**Handling**:
```javascript
// On SIGTERM/SIGINT:
1. Stop accepting new connections
2. Wait up to 30s for in-flight requests
3. Send "server shutting down" to SSE clients
4. Close all connections
5. Exit cleanly
```

### 18. Health Monitoring

**Problem**: No UI means no visibility into health.

**Handling**:
```bash
# Quick check
mcpstatus
# Returns JSON with all health info

# Detailed health endpoint
curl localhost:3000/health
# Returns: { status, uptime, connections, mcps_health, memory, cpu }

# For monitoring systems (Prometheus-compatible)
curl localhost:3000/metrics
```

### 19. Startup Dependencies

**Problem**: Server starts before dependencies ready (Redis, etc.).

**Handling**:
- Health check waits for dependencies
- Retry connection to optional dependencies
- Start serving with degraded functionality
- Clear status indicating what's unavailable

---

## Data Integrity

### 20. Backup Corruption

**Problem**: Backup file corrupted or incomplete.

**Handling**:
- Checksum in backup metadata
- Validate on restore before applying
- Atomic writes (write to temp, rename)
- Multiple backup retention

### 21. Concurrent Config Edits

**Problem**: Two processes edit config simultaneously.

**Handling**:
- File locking on write
- Optimistic concurrency: check version before save
- CLI prevents concurrent operations

---

## Operational

### 22. Clock Skew

**Problem**: Server clock wrong affects token validation, logs.

**Handling**:
- Log timestamps in UTC
- Token validation allows 5 minute skew
- Health check includes time sync status

### 23. Resource Exhaustion

**Problem**: File descriptors, memory, CPU exhausted.

**Handling**:
```javascript
// Limits enforced
MAX_OPEN_FILES = 1024
MAX_MEMORY_MB = 512  // Restart if exceeded
MAX_CPU_PERCENT = 80 // Throttle new connections

// Monitoring
mcpstatus
# Shows resource usage, warns at 80%
```

### 24. Dependency Vulnerabilities

**Problem**: npm packages have CVEs.

**Handling**:
- Minimal dependencies
- Lock file for reproducible builds
- Regular `npm audit` in CI
- Dependabot/Renovate for updates

---

## Recovery Procedures

### Config Corrupted
```bash
mcprestore ./backups/backup-latest.json
```

### Server Won't Start
```bash
# Check config validity
cat mcp-config.yaml | python -c "import yaml, sys; yaml.safe_load(sys.stdin)"

# Check logs
cat logs/error.log | tail -50

# Start with debug
LOG_LEVEL=debug mcpserver start
```

### MCP Stuck in Bad State
```bash
mcp remote disable problematic-mcp
mcpserver restart
# Fix the MCP
mcp remote test problematic-mcp
mcp remote enable problematic-mcp
```

### Out of Disk Space
```bash
# Clear old backups
ls -la backups/ | head -n -10 | xargs rm

# Clear old logs
rm logs/*.log.[0-9]

# Check what's using space
du -sh */ | sort -h
```

---

## Monitoring Checklist

For production, monitor these:

| Metric | Alert Threshold |
|--------|-----------------|
| `health.status` | != "healthy" |
| `connections.active` | > 80 |
| `memory.percent` | > 80% |
| `disk.percent` | > 90% |
| `mcps.*.status` | != "healthy" |
| `errors.rate` | > 10/min |
| `latency.p99` | > 5s |

Query via:
```bash
mcpstatus | jq '.server.status'
curl localhost:3000/health | jq '.memory.percent'
```
