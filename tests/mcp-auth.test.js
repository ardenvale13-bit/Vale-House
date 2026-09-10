const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

function clientClass(fetch) {
  const context = vm.createContext({ EventEmitter, fetch, URL, TextDecoder, setTimeout, clearTimeout, console:{log() {}, error() {}} });
  return vm.runInContext(source.slice(source.indexOf('class McpClient '), source.indexOf('class McpHttpClient ')) + '\nMcpClient;', context);
}

test('Hub credential accompanies SSE, initialization, notification and tool listing only for configured client', async () => {
  const requests=[];
  const Client=clientClass(async (url, options) => {
    requests.push({url, ...options});
    if (url.endsWith('/sse')) return new Response(new ReadableStream({start(controller) { controller.enqueue(new TextEncoder().encode('event: endpoint\ndata: /mcp/message?session_id=test\n\n')); }}), {headers:{'Content-Type':'text/event-stream'}});
    const rpc = JSON.parse(options.body);
    return Response.json({id:rpc.id, result:rpc.method === 'tools/list' ? {tools:[]} : {}});
  });
  const client = new Client('https://hub.example/sse', 'Hub', 1000, 'test-secret');
  client._scheduleReconnect = () => {};
  try {
    await client.connect();
    assert.equal(requests.length, 4);
    for (const request of requests) {
      assert.equal(request.headers.Authorization, 'Bearer test-secret');
      assert.equal(request.redirect, 'error');
      assert.ok(!request.url.includes('test-secret'));
    }
    const other = new Client('https://other.example/sse', 'Other');
    assert.equal(other.authHeaders.Authorization, undefined);
  } finally { client.disconnect(); }
});

test('authenticated endpoint cannot redirect credentials to another origin', async () => {
  const Client=clientClass(async () => new Response(new ReadableStream({start(controller) { controller.enqueue(new TextEncoder().encode('event: endpoint\ndata: https://other.example/messages\n\n')); }})));
  const client=new Client('https://hub.example/sse', 'Hub', 1000, 'test-secret');
  await assert.rejects(client.connect(), /cross-origin/);
});

test('rejected POST reports 401 immediately instead of waiting for an RPC timeout', async () => {
  const Client=clientClass(async () => new Response('', {status:401}));
  const client=new Client('https://hub.example/sse', 'Hub', 1000, 'test-secret');
  client.postEndpoint='https://hub.example/messages';
  await assert.rejects(client._postRpc('tools/list', {}), /HTTP 401/);
  assert.equal(client.pending.size, 0);
});
