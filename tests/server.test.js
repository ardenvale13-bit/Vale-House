const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('server preserves long histories, blocks switching during replies, and persists the final stream text', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vale-house-test-'));
  const serverPath = path.join(__dirname, '../server.js');
  const nativeRequire = createRequire(serverPath);
  const source = fs.readFileSync(serverPath, 'utf8');
  let release;
  const providerRequests = [];
  const gate = new Promise(resolve => { release = resolve; });
  const context = vm.createContext({
    require: name => name === '@letta-ai/letta-client' ? { Letta:class {
      constructor() { this.agents = { messages:{ create:async (agentId, body) => {
        providerRequests.push(body);
        await gate;
        return (async function* () { yield {message_type:'assistant_message', content:'Saved reply'}; })();
      } } }; }
    } } : nativeRequire(name),
    __dirname:root,
    process:{ env:{VALE_TOKEN:'test', LETTA_AGENT_ID:'test-agent', CLAUDE_MODEL:'letta'}, pid:process.pid },
    console:{log() {}, error() {}}, Buffer, URL, AbortSignal,
    fetch:async () => ({ok:true}),
    setInterval() {}, setTimeout() {}, clearTimeout() {},
    module:{exports:{}}
  });
  vm.runInContext(source.slice(0, source.indexOf('app.listen(PORT,')) + '\nmodule.exports = {app};', context);
  const server = context.module.exports.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('vale-house-test-')) throw new Error('Unexpected test directory');
    fs.rmSync(root, {recursive:true, force:true});
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, body) => fetch(base + url, { method:'POST', headers:{'Content-Type':'application/json','x-vale-token':'test'}, body:JSON.stringify(body) });
  const history = Array.from({length:60}, (_, i) => ({role:i % 2 ? 'assistant' : 'user', content:`message ${i}`, timestamp:new Date().toISOString()}));
  fs.writeFileSync(path.join(root, 'chats', 'existing.json'), JSON.stringify({meta:{id:'existing'}, messages:history}));
  assert.equal((await request('/api/chats/switch', {chatId:'existing'})).status, 200);
  const response = await request('/api/message', {chatId:'existing', message:'new message', imageUrl:'/uploads/img-test.png', gifUrl:'https://media.example.com/test.gif'});
  assert.equal(response.status, 200);
  assert.equal((await request('/api/chats/switch', {})).status, 409);
  release();
  const stream = await response.text();
  assert.match(stream, /"type":"saved","text":"Saved reply"/);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'chats', 'existing.json'), 'utf8'));
  assert.equal(saved.messages.length, 62);
  assert.equal(saved.messages[0].content, 'message 0');
  assert.equal(saved.messages[60].imageUrl, '/uploads/img-test.png');
  assert.equal(saved.messages[60].gifUrl, 'https://media.example.com/test.gif');
  assert.equal(saved.messages[61].content, 'Saved reply');
  assert.equal((await request('/api/react', {chatId:'other', messageIndex:60, emoji:'🖤', from:'arden'})).status, 409);
  assert.equal((await request('/api/react', {chatId:'existing', messageIndex:0.5, emoji:'🖤', from:'arden'})).status, 400);
  const reaction = {chatId:'existing', messageIndex:60, emoji:'🖤', from:'arden'};
  assert.equal((await (await request('/api/react', reaction)).json()).reactions.length, 1);
  assert.equal((await (await request('/api/react', reaction)).json()).reactions.length, 0);
  assert.equal(providerRequests.length, 1, 'Reactions must not wake Letta');
  const next = await request('/api/message', {chatId:'existing', message:'Did you see my reaction?'});
  await next.text();
  assert.equal(providerRequests.length, 2);
  const content = providerRequests[1].messages[0].content;
  assert.match(content, /VALE HOUSE INTERFACE CONTRACT/);
  assert.match(content, /"action":"added"/);
  assert.match(content, /"action":"removed"/);
  assert.match(content, /"messageIndex":60/);
  assert.match(content, /"messageText":"new message"/);
  assert.match(content, /Did you see my reaction\?/);
});
