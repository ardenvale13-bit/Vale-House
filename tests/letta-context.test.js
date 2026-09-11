const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildHouseContext } = require('../scripts/letta-context');

function dataOf(text) { return JSON.parse(text.split('\n').find(line => line.startsWith('{'))); }

test('Letta receives actual emoji names, Arden mood, and supported directives', () => {
  const text = buildHouseContext({chatId:'one', presence:{status:'online', mood:'soft'}, emojiFiles:['linc-heart-offering.png', 'arden-heh-innocent.webp', '.gitkeep'], gifAvailable:true});
  const data = dataOf(text);
  assert.deepEqual(data.customEmojiCodes, [':linc-heart-offering:', ':arden-heh-innocent:']);
  assert.equal(data.arden.mood, 'soft');
  assert.equal(data.gifSearchAvailable, true);
  for (const directive of ['[STATUS:short status text]', '[GIF:search phrase]', '[REACT:emoji:index]']) assert.ok(text.includes(directive));
  assert.match(text, /Clicking React alone does not currently wake you/);
});

test('reaction targets retain full conversation indices even outside the recent window', () => {
  const history = Array.from({length:30}, (_, i) => ({role:'assistant', content:`reply ${i}`, reactions:[]}));
  history[2].reactions = [{emoji:'🖤', from:'arden'}];
  history[2].reactionChanges = [{emoji:'🖤', from:'arden', action:'added', timestamp:'2026-09-11T00:00:00Z'}];
  const data = dataOf(buildHouseContext({history}));
  assert.equal(data.recentMessages[0].index, 18);
  assert.equal(data.reactedMessages[0].index, 2);
  assert.equal(data.reactedMessages[0].text, 'reply 2');
  assert.equal(data.recentReactionChanges[0].messageIndex, 2);
});

test('removed reactions stay visible as changes with no false active reaction', () => {
  const data = dataOf(buildHouseContext({history:[{role:'assistant', content:'Hello', reactions:[], reactionChanges:[{emoji:'😂', from:'arden', action:'removed', timestamp:'2026-09-11T00:00:00Z'}]}]}));
  assert.equal(data.reactedMessages.length, 0);
  assert.equal(data.recentReactionChanges[0].action, 'removed');
  assert.equal(data.recentReactionChanges[0].messageText, 'Hello');
});
