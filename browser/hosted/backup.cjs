const crypto = require('node:crypto');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function validateBackup(backup) {
  const p = backup?.project;
  if (backup?.format !== 'larry-soundboard-backup-v1' || !p || p.schemaVersion !== 1 ||
      !Array.isArray(p.pads) || !Array.isArray(p.people) || !Array.isArray(p.script?.pages) ||
      !Array.isArray(backup.media)) throw Error('Unsupported backup.');
  for (const field of ['cues', 'passages', 'assignments']) {
    if (!p[field] || typeof p[field] !== 'object' || Array.isArray(p[field])) throw Error('Invalid ' + field);
  }
  const files = new Set(), ids = new Set();
  for (const m of backup.media) {
    if (typeof m.name !== 'string' || !/^[\w.-]+$/.test(m.name) || files.has(m.name) ||
        typeof m.base64 !== 'string' || typeof m.mime !== 'string' ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(m.base64) ||
        hash(Buffer.from(m.base64, 'base64')) !== m.sha256) throw Error('Invalid or damaged backup media.');
    files.add(m.name);
  }
  for (const pad of p.pads) {
    if (typeof pad.id !== 'string' || !pad.id || ids.has(pad.id) || typeof pad.label !== 'string' ||
        !Number.isFinite(pad.volume) || pad.volume < 0 || pad.volume > 3) throw Error('Invalid sound.');
    ids.add(pad.id);
    for (const name of [pad.sound, pad.image].filter(Boolean)) if (!files.has(name)) throw Error('Missing sound or image.');
  }
  for (const page of p.script.pages) {
    if (!Number.isInteger(page.page) || !Array.isArray(page.blocks)) throw Error('Invalid page.');
    for (const block of page.blocks) if (typeof block.id !== 'string' ||
      (block.text !== undefined && typeof block.text !== 'string') ||
      (block.cue !== undefined && typeof block.cue !== 'string')) throw Error('Invalid passage.');
  }
  for (const actions of Object.values(p.assignments)) {
    if (!Array.isArray(actions)) throw Error('Invalid actions.');
    for (const a of actions) if (!['play','loop','hold','fade','stop'].includes(a.action) ||
      typeof a.padId !== 'string' || !Number.isFinite(a.delay) || a.delay < 0 || a.delay > 120 ||
      !Number.isInteger(a.repeat) || a.repeat < 1 || a.repeat > 12 ||
      (a.volume !== undefined && (!Number.isFinite(a.volume) || a.volume < 0 || a.volume > 3))) throw Error('Invalid action.');
  }
  for (const c of Object.values(p.cues)) if (typeof c.name !== 'string' || typeof c.key !== 'string' ||
    c.key.length > 1 || !Number.isFinite(c.volume) || c.volume < 0 || c.volume > 3) throw Error('Invalid cue.');
  for (const person of p.people) if (typeof person.id !== 'string' || typeof person.name !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(person.color)) throw Error('Invalid person.');
  for (const meta of Object.values(p.passages)) {
    if (!meta || typeof meta !== 'object') throw Error('Invalid passage.');
    if (meta.blankColor !== undefined && !['', '1', '2', '3'].includes(meta.blankColor)) throw Error('Invalid blank highlight.');
    if (meta.highlights !== undefined) {
      if (!Array.isArray(meta.highlights) || typeof meta.highlightText !== 'string') throw Error('Invalid highlights.');
      let end = 0;
      for (const r of meta.highlights) {
        if (!Number.isInteger(r.start) || !Number.isInteger(r.end) || r.start < end || r.end <= r.start ||
            r.end > meta.highlightText.length || !['1', '2', '3'].includes(r.color)) throw Error('Invalid highlight range.');
        end = r.end;
      }
    }
  }
  return backup;
}
module.exports = {hash, validateBackup};
