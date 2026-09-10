const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveGifs, applyReactions } = require('../scripts/message-content');

test('resolves adjacent GIF requests without skipping after replacement changes length', async () => {
  assert.equal(await resolveGifs('[GIF:one][GIF:two][GIF:one]', async q => `https://example.com/${q}.gif`), '[GIF](https://example.com/one.gif)[GIF](https://example.com/two.gif)[GIF](https://example.com/one.gif)');
});

test('failed GIF lookup leaves an understandable fallback', async () => {
  assert.equal(await resolveGifs('hello [GIF:wave]', async () => { throw new Error('offline'); }), 'hello (GIF unavailable)');
});

test('Lincoln reactions persist once, rather than toggling on replay', () => {
  const history = [{ content:'hello' }];
  applyReactions('[REACT:🖤:0][REACT:😂:999]', history);
  applyReactions('[REACT:🖤:0]', history);
  assert.equal(history[0].reactions.length, 1);
  assert.equal(history[0].reactions[0].from, 'lincoln');
});
