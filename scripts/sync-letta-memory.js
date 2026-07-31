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

  const headers = { 'Content-Type': 'application/json' };
  if (LETTA_API_KEY) headers['Authorization'] = `Bearer ${LETTA_API_KEY}`;

  try {
    const agentRes = await fetch(`${LETTA_URL.replace(/\/$/, '')}/v1/agents/${LETTA_AGENT_ID}`, { headers });
    if (!agentRes.ok) throw new Error(`Agent lookup failed (${agentRes.status})`);
    const agent = await agentRes.json();
    const blocks = agent.blocks || agent.memory?.blocks || [];
    const block = blocks.find(candidate => candidate.label === label);
    if (!block?.id) throw new Error(`Agent has no "${label}" memory block`);

    const res = await fetch(`${LETTA_URL.replace(/\/$/, '')}/v1/blocks/${block.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ value: content }),
    });
    if (!res.ok) throw new Error(`Block update failed (${res.status}): ${(await res.text()).substring(0, 200)}`);
    console.log(`✅ ${label} synced`);
    return true;
  } catch (e) {
    console.error(`❌ ${label}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('🧠 Letta Memory Sync');
  console.log(`   URL: ${LETTA_URL}`);
  console.log(`   Agent: ${LETTA_AGENT_ID}`);
  console.log(`   Memory dir: ${AGENT_DIR}\n`);

  // Verify that the configured agent is reachable.
  try {
    const headers = {};
    if (LETTA_API_KEY) headers.Authorization = `Bearer ${LETTA_API_KEY}`;
    const h = await fetch(`${LETTA_URL.replace(/\/$/, '')}/v1/agents/${LETTA_AGENT_ID}`, {
      headers,
      signal: AbortSignal.timeout(5000)
    });
    console.log(`   Health: ${h.status} ${h.ok ? '✅' : '❌'}\n`);
    if (!h.ok) process.exit(1);
  } catch (e) {
    console.log(`   Health: unreachable (${e.message})\n`);
    console.log('   Check LETTA_URL, LETTA_AGENT_ID, and LETTA_API_KEY.');
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
    console.log('\nCheck that the hosted agent contains persona and human memory blocks.');
  } else {
    console.log(`\n✅ ${ok}/${blocks.length} blocks synced. Test with a message now.`);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
