function applyReactions(text, history) {
  for (const match of text.matchAll(/\[REACT:(.+?):(\d+)\]/g)) {
    const index = Number(match[2]);
    const emoji = match[1].trim();
    const message = history[index];
    if (!message || !emoji || emoji.length > 100) continue;
    message.reactions ||= [];
    if (!message.reactions.some(r => r.from === 'lincoln' && r.emoji === emoji)) {
      message.reactions.push({ emoji, from:'lincoln', timestamp:new Date().toISOString() });
    }
  }
}

async function resolveGifs(text, lookup) {
  // Match the original string: replacing while iterating skips adjacent tags.
  const matches = [...text.matchAll(/\[GIF:([^\]]+)\]/gi)];
  for (const match of matches) {
    let url;
    try { url = await lookup(match[1].trim()); } catch (_) {}
    text = text.replace(match[0], url ? `[GIF](${url})` : '(GIF unavailable)');
  }
  return text;
}

module.exports = { applyReactions, resolveGifs };
