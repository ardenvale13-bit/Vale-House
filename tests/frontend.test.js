const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const context = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('function md('), html.indexOf('function fmtTime(')), context);

test('enlarges custom, joined, flag, skin-tone and keycap emoji, but not ordinary text', () => {
  for (const value of [':sable-heart:', '🖤 🖤', '👩🏽‍💻', '🇳🇿', '1️⃣', ':sable-heart: 🖤']) assert.equal(context.isEmojiOnly(value), true, value);
  for (const value of ['hello 🖤', '123', '', '  ', 'hello :sable-heart:']) assert.equal(context.isEmojiOnly(value), false, value);
});

test('formats multiline text and custom emoji without changing asset attributes', () => {
  const result = context.emoji(context.md('**hello**\n:sable-heart: and *you*'));
  assert.match(result, /<strong>hello<\/strong><br>/);
  assert.match(result, /src="\/emojis\/sable-heart.png"/);
  assert.match(result, /<em>you<\/em>/);
});

test('emoji picker replaces the selected text at the caret and triggers input resizing', () => {
  let change, focused = false, closed = false;
  const input = { selectionStart:2, selectionEnd:5, setRangeText:(...args) => { change=args; }, dispatchEvent:event => assert.equal(event.type,'input'), focus:() => { focused=true; } };
  context.$ = id => id === 'chatIn' ? input : { classList:{ remove:() => { closed=true; } } };
  context.Event = class { constructor(type) { this.type=type; } };
  context.insertEmoji('🖤');
  assert.deepEqual(change, ['🖤',2,5,'end']);
  assert.equal(focused && closed, true);
});

test('stored replies recognize GIF tags and Markdown images without adding message rows', () => {
  const parser = vm.createContext({ URL, setLincolnStatus() {} });
  vm.runInContext(html.slice(html.indexOf('function processStoredMessage('), html.indexOf('function buildReacts(')), parser);
  const result = parser.processStoredMessage('hello [gif](https://example.com/a.gif) ![wave](<https://example.com/b.gif>)');
  assert.equal(result.gifs.length, 2);
  assert.equal(result.clean, 'hello');
});
