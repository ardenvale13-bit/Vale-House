#!/usr/bin/env node
/**
 * sync-letta-memory.js
 * Reads Lincoln's persona/human memory from Letta Code local files
 * and PATCHes them into the Letta agent via API.
 *
 * Usage: node scripts/sync-letta-memory.js
 */

const fs = require('fs');
const path = require('path');

// Load .env
try {
  const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && k.trim() && !k.startsWith('#')) {
      process.env[k.trim()] = v.join('=').trim();
    }
  });
} catch (e) {}

const LETTA_URL = process.env.LETTA_URL || 'http://localhost:49885';
const LETTA_AGENT_ID = process.env.LETTA_AGENT_ID;
const LETTA_API_KEY = process.env.LETTA_API_KEY || '';

if (!LETTA_AGENT_ID) {
  console.error('❌ LETTA_AGENT_ID not set in .env');
  process.exit(1);
}

const AGENT_DIR = path.resolve(
  process.env.USERPROFILE || process.env.HOME || '',
  '.letta', 'agents', LETTA_AGENT_ID, 'memory', 'system'
);

const blocks = [
  { label: 'persona', file: path.join(AGENT_DIR, 'persona.md') },
  { label: 'human', file: path.join(AGENT_DIR, 'human.md') },
];

async function syncBlock(label, filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠ ${label}: not found at ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) {
    console.warn(`⚠ ${label}: empty file`);
    return false;
  }

  console.log(`📤 Syncing ${label} (${content.length} chars)...`);
  console.log(`   Preview: ${content.substring(0, 100)}...`);

  const endpoints = [
    { path: `agents/${LETTA_AGENT_ID}/core-memory/blocks/${label}`, body: { value: content } },
    { path: `agents/${LETTA_AGENT_ID}/memory/blocks/${label}`, body: { value: content } },
    { path: `agents/${LETTA_AGENT_ID}/memory`, body: { [label]: content } },
  ];

  const headers = { 'Content-Type': 'application/json' };
  if (LETTA_API_KEY) headers['Authorization'] = `Bearer ${LETTA_API_KEY}`;

  for (const ep of endpoints) {
    const url = `${LETTA_URL}/v1/${ep.path}`;
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(ep.body),
      });
      if (res.ok) {
        console.log(`✅ ${label} synced via /v1/${ep.path}`);
        return true;
      }
      console.log(`   /v1/${ep.path} → ${res.status}`);
    } catch (e) {
      console.log(`   /v1/${ep.path} → ${e.message}`);
    }
  }

  console.error(`❌ ${label}: all endpoints failed`);
  return false;
}

async function main() {
  console.log('🧠 Letta Memory Sync');
  console.log(`   URL: ${LETTA_URL}`);
  console.log(`   Agent: ${LETTA_AGENT_ID}`);
  console.log(`   Memory dir: ${AGENT_DIR}\n`);

  // First check health
  try {
    const h = await fetch(`${LETTA_URL}/v1/health`, { signal: AbortSignal.timeout(3000) });
    console.log(`   Health: ${h.status} ${h.ok ? '✅' : '❌'}\n`);
  } catch (e) {
    console.log(`   Health: unreachable (${e.message})\n`);
    console.log('   Is your Cloudflare tunnel running? Is Letta Code open?');
    process.exit(1);
  }

  let ok = 0;
  for (const { label, file } of blocks) {
    if (await syncBlock(label, file)) ok++;
  }

  if (ok === 0) {
    console.log('\n⚠ No blocks synced.');
    console.log('Files found:');
    for (const { label, file } of blocks) {
      console.log(`   ${label}: ${fs.existsSync(file) ? '✓ exists' : '✗ missing'} — ${file}`);
    }
    console.log('\nIf files exist, Letta may not expose PATCH on this port.');
    console.log('Update persona directly in Letta Code UI instead.');
  } else {
    console.log(`\n✅ ${ok}/${blocks.length} blocks synced. Test with a message now.`);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
