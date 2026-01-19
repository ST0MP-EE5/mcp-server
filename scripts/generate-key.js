#!/usr/bin/env node

/**
 * AI Hub Key Generator
 * 
 * Usage:
 *   node scripts/generate-key.js [name]
 * 
 * Example:
 *   node scripts/generate-key.js claude-ai
 */

import crypto from 'crypto';

const name = process.argv[2] || 'unnamed';

// Generate a secure random key
const apiKey = crypto.randomBytes(32).toString('hex');

// Hash the key for storage
const keyHash = `sha256:${crypto.createHash('sha256').update(apiKey).digest('hex')}`;

console.log('\n🔑 AI Hub API Key Generated\n');
console.log('Name:', name);
console.log('─'.repeat(50));
console.log('\n📋 API Key (save this securely - shown only once):\n');
console.log(`   ${apiKey}`);
console.log('\n📝 Add this to your aih-config.yaml:\n');
console.log(`   - name: "${name}"`);
console.log(`     key_hash: "${keyHash}"`);
console.log(`     permissions: ["*"]  # Adjust as needed`);
console.log('\n💡 Use the API key in requests like:\n');
console.log(`   Authorization: Bearer ${apiKey}\n`);
