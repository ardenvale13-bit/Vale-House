// Isolated UI fixture: no credentials, real chat files, providers, or push delivery.
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json());
let messages = [];
app.get('/', (req, res) => res.type('html').send(fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8').replace('boot();', "localStorage.setItem('vh-auth-token','preview'); boot();")));
app.get('/api/health', (req, res) => res.json({ currentChat:'preview' }));
app.get('/api/chats', (req, res) => res.json({ chats:messages.length ? [{id:'preview', preview:'Preview conversation', updated:new Date().toISOString(), messageCount:messages.length}] : [] }));
app.post('/api/chats/switch', (req, res) => res.json({ chatId:'preview', messages }));
app.get('/api/chats/preview', (req, res) => res.json({ messages }));
app.get('/api/model', (req, res) => res.json({ model:'letta', lettaAvailable:true }));
app.get('/api/emojis', (req, res) => res.json({ emojis:['sable-heart.png','zibb-wave.png'] }));
app.post('/api/message', (req, res) => {
  messages.push({ role:'user', content:req.body.message, gifUrl:req.body.gifUrl, reactions:[], timestamp:new Date().toISOString() });
  res.type('text/event-stream'); res.flushHeaders();
  const text = 'A **smooth reply** with 🖤 and :sable-heart: — you can keep typing while I reply.';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) res.write(`data: ${JSON.stringify({ type:'delta', text:text.slice(i, i += 3) })}\n\n`);
    else {
      clearInterval(timer);
      messages.push({ role:'assistant', content:text, timestamp:new Date().toISOString() });
      res.write(`data: ${JSON.stringify({ type:'done', timestamp:new Date().toISOString() })}\n\n`);
      res.write(`data: ${JSON.stringify({ type:'saved', text })}\n\n`); res.end();
    }
  }, 140);
});
app.get('/api/gifs', (req, res) => res.json({results:[{url:'https://127.0.0.1:1/test.gif',preview:'/emojis/zibb-wave.png'}]}));
app.post('/api/react', (req, res) => {
  const msg = messages[req.body.messageIndex];
  if (!msg) return res.status(400).json({error:'Invalid message'});
  msg.reactions ||= [];
  const index = msg.reactions.findIndex(r => r.emoji === req.body.emoji && r.from === 'arden');
  if (index < 0) msg.reactions.push({emoji:req.body.emoji, from:'arden'});
  else msg.reactions.splice(index,1);
  res.json({reactions:msg.reactions});
});
app.use('/api', (req, res) => res.json({ schedules:[], authenticated:true }));
app.use(express.static(path.join(__dirname, '../public')));
app.listen(3344, '127.0.0.1', () => console.log('Isolated preview on http://127.0.0.1:3344'));
