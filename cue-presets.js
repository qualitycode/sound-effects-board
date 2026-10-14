// Prepared scripts use sound names for portability; saved edits use stable pad IDs.
function sanitizeAction(action) {
  const number = (value, max, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Number(value))) : fallback;
  return {
    padId: typeof action?.padId === 'string' ? action.padId.slice(0, 64) : '',
    action: ['play', 'loop', 'hold', 'stop', 'fade'].includes(action?.action) ? action.action : 'play',
    delay: number(action?.delay, 120),
    repeat: Math.max(1, Math.floor(number(action?.repeat, 12, 1))),
  };
}

function resolvePresets(script, pads, saved = {}) {
  const assignments = {};
  for (const page of script.pages || []) for (const cue of page.blocks || []) {
    if (!cue.id) continue;
    if (Object.hasOwn(saved, cue.id)) {
      assignments[cue.id] = saved[cue.id].map(sanitizeAction);
    } else if (Array.isArray(cue.defaults)) {
      assignments[cue.id] = cue.defaults.map(action => sanitizeAction({
        ...action, padId: pads.find(p => p.label.toLowerCase() === String(action.label).toLowerCase())?.id || '',
      }));
    }
  }
  return assignments;
}
module.exports = { sanitizeAction, resolvePresets };
