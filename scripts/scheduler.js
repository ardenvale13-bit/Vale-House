// Delivery retries reuse the saved response and never create another chat message.
async function runSchedule(schedule, { generate, saveMessage, push, persist, now = Date.now }) {
  schedule.status = 'running';
  schedule.attempts = (schedule.attempts || 0) + 1;
  persist();
  try {
    if (!schedule.response) {
      schedule.response = await generate(schedule.prompt);
      if (!schedule.response?.trim()) throw new Error('Lincoln returned an empty response');
      persist();
    }
    await saveMessage(schedule);
    const result = await push(schedule.response);
    if (!result.delivered) throw new Error(result.total ? 'Push delivery failed; will retry' : 'No notification device registered; enable notifications in Settings');
    schedule.status = 'sent';
    schedule.sentAt = new Date(now()).toISOString();
    delete schedule.error;
    delete schedule.nextAttemptAt;
  } catch (error) {
    schedule.status = 'pending';
    schedule.error = error.message;
    schedule.nextAttemptAt = new Date(now() + Math.min(3600000, 30000 * 2 ** Math.min(schedule.attempts - 1, 7))).toISOString();
  }
  persist();
}

function isDue(schedule, now = Date.now()) {
  return schedule.status === 'pending' && new Date(schedule.nextAttemptAt || schedule.runAt).getTime() <= now;
}

module.exports = { runSchedule, isDue };
