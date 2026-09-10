const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runSchedule, isDue } = require('../scripts/scheduler');

test('no registered devices remains retryable and reuses the generated response', async () => {
  const job = { id:'one', status:'pending', runAt:new Date(0).toISOString() };
  let generations = 0, deliveries = 0;
  const messages = new Map();
  const deps = { generate:async () => { generations++; return 'Hello'; }, saveMessage:async job => messages.set(job.id, job.response), push:async () => ({ total:deliveries, delivered:deliveries }), persist:() => {}, now:() => 1000 };
  await runSchedule(job, deps);
  assert.equal(job.status, 'pending');
  assert.match(job.error, /No notification device/);
  assert.equal(isDue(job, 1001), false);
  deliveries = 1;
  await runSchedule(job, deps);
  assert.equal(job.status, 'sent');
  assert.equal(generations, 1);
  assert.equal(messages.size, 1);
  assert.equal(job.error, undefined);
});

test('provider failure retries later without saving a message or pushing', async () => {
  const job = { status:'pending' };
  await runSchedule(job, { generate:async () => { throw new Error('offline'); }, saveMessage:() => assert.fail(), push:() => assert.fail(), persist:() => {}, now:() => 0 });
  assert.equal(job.status, 'pending');
  assert.equal(isDue(job, 29999), false);
  assert.equal(isDue(job, 30000), true);
});

test('one successful endpoint completes the job despite another device failing', async () => {
  const job = { response:'Saved reply' };
  await runSchedule(job, { generate:() => assert.fail(), saveMessage:async () => {}, push:async () => ({ total:2, delivered:1 }), persist:() => {} });
  assert.equal(job.status, 'sent');
});

test('push transport exceptions preserve the saved response for retry', async () => {
  const job = { response:'Saved reply' };
  await runSchedule(job, { generate:() => assert.fail(), saveMessage:async () => {}, push:async () => { throw new Error('network'); }, persist:() => {} });
  assert.equal(job.status, 'pending');
  assert.equal(job.response, 'Saved reply');
});
