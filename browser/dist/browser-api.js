/* Browser-only persistence. Never reads or writes the desktop app's data. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const hosted = window.hostedBoard;
  const urls = new Map();
  let db, project;
  let writes = Promise.resolve();
  const clone = value => structuredClone(value);
  const status = text => { $('projectStatus').textContent = text; };
  const openDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(hosted ? 'larry-soundboard-hosted-v1' : 'larry-soundboard-browser-v1', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('project'); req.result.createObjectStore('media'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Close other browser-preview tabs and try again.'));
  });
  const read = (store, key) => new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const transaction = callback => new Promise((resolve, reject) => {
    const tx = db.transaction(['project', 'media'], 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Local save was cancelled.'));
    try { callback(tx); } catch (err) { tx.abort(); reject(err); }
  });
  function enqueue(operation) {
    const result = writes.then(operation);
    writes = result.catch(() => {});
    return result;
  }
  function save(change) {
    return enqueue(async () => {
      if (hosted) await hosted.assertAdmin();
      const next = clone(project);
      change(next);
      validate(next);
      next.modifiedAt = new Date().toISOString();
      await transaction(tx => tx.objectStore('project').put(next, 'active'));
      project = next;
      if (hosted) hosted.showStatus(project);
      else status(`${project.title} · Saved on this browser · Local preview`);
    });
  }
  const validColor = color => /^#[0-9a-f]{6}$/i.test(color);
  const references = p => [...new Set(p.pads.flatMap(pad => [pad.sound, pad.image]).filter(Boolean))];
  function validate(p) {
    if (!p || p.schemaVersion !== 1 || !Array.isArray(p.pads) || !Array.isArray(p.script?.pages) || !p.assignments || !p.cues || !p.passages || !Array.isArray(p.people)) throw new Error('Not a supported soundboard backup.');
    for (const field of ['assignments', 'cues', 'passages']) {
      if (typeof p[field] !== 'object' || Array.isArray(p[field])) throw new Error(`Invalid ${field}.`);
    }
    const ids = new Set();
    for (const pad of p.pads) {
      if (typeof pad.id !== 'string' || !pad.id || ids.has(pad.id) || typeof pad.label !== 'string' || !Number.isFinite(pad.volume) || pad.volume < 0 || pad.volume > 3) throw new Error('Invalid or duplicate sound in backup.');
      ids.add(pad.id);
      for (const name of [pad.sound, pad.image].filter(Boolean)) if (typeof name !== 'string' || /[\\/]/.test(name)) throw new Error('Invalid media filename.');
    }
    for (const page of p.script.pages) if (!Number.isInteger(page.page) || !Array.isArray(page.blocks)) throw new Error('Invalid script page.');
    for (const actions of Object.values(p.assignments)) {
      if (!Array.isArray(actions)) throw new Error('Invalid cue actions.');
      for (const a of actions) {
        if (!['play', 'loop', 'hold', 'stop', 'fade'].includes(a.action) || typeof a.padId !== 'string' || !Number.isFinite(a.delay) || a.delay < 0 || a.delay > 120 || !Number.isInteger(a.repeat) || a.repeat < 1 || a.repeat > 12 || (a.volume !== undefined && (!Number.isFinite(a.volume) || a.volume < 0 || a.volume > 3))) throw new Error('Invalid cue action values.');
      }
    }
    for (const cue of Object.values(p.cues)) if (typeof cue.name !== 'string' || !Number.isFinite(cue.volume) || cue.volume < 0 || cue.volume > 3 || typeof cue.key !== 'string' || cue.key.length > 1) throw new Error('Invalid cue settings.');
    for (const person of p.people) if (typeof person.id !== 'string' || typeof person.name !== 'string' || !validColor(person.color)) throw new Error('Invalid person or color.');
    for (const meta of Object.values(p.passages)) {
      if (!meta || typeof meta !== 'object') throw new Error('Invalid passage.');
      if (meta.blankColor !== undefined && !['', '1', '2', '3'].includes(meta.blankColor)) throw new Error('Invalid blank highlight.');
      if (meta.highlights !== undefined) {
        if (!Array.isArray(meta.highlights) || typeof meta.highlightText !== 'string') throw new Error('Invalid highlights.');
        let end = 0;
        for (const r of meta.highlights) {
          if (!Number.isInteger(r.start) || !Number.isInteger(r.end) || r.start < end || r.end <= r.start ||
              r.end > meta.highlightText.length || !['1', '2', '3'].includes(r.color)) throw new Error('Invalid highlight range.');
          end = r.end;
        }
      }
    }
    // Older projects and backups may still assign these reserved keys.
    for (const item of [...p.pads, ...Object.values(p.cues)]) if (['1', '2', '3'].includes(item.key)) item.key = '';
  }
  async function digest(blob) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function hydrate(files) {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
    for (const [name, blob] of files) urls.set(name, URL.createObjectURL(blob));
  }
  function chooseFile(accept) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept; input.hidden = true;
      let done = false;
      const finish = file => { if (done) return; done = true; input.remove(); resolve(file || null); };
      input.addEventListener('change', () => finish(input.files[0]));
      input.addEventListener('cancel', () => finish(null));
      document.body.append(input); input.click();
    });
  }
  async function storeFile(blob, original) {
    await ready;
    if (hosted) await hosted.assertAdmin();
    const ext = original.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() || '.wav';
    const name = crypto.randomUUID() + ext;
    await enqueue(() => transaction(tx => tx.objectStore('media').put(blob, name)));
    urls.set(name, URL.createObjectURL(blob));
    return { file: name, original };
  }
  const ready = (async () => {
    try {
      if (hosted) await hosted.ready;
      db = await openDB();
      project = await read('project', 'active');
      const files = new Map();
      if (!project) {
        let seed;
        if (hosted) seed = await hosted.seed();
        else {
          const res = await fetch('local-project/project.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('The local board copy is unavailable. Check the preview console for a missing-file or permissions error, then restart Open Browser Preview.cmd.');
          seed = await res.json();
        }
        validate(seed.project);
        for (let i = 0; i < seed.files.length; i++) {
          const item = seed.files[i];
          status(`Copying recordings into this browser… ${i + 1}/${seed.files.length}`);
          let blob = item.blob;
          if (!blob) {
            const res = await fetch(`local-project/media/${encodeURIComponent(item.name)}`);
            if (!res.ok) throw new Error(`Missing recording: ${item.name}`);
            blob = new Blob([await res.arrayBuffer()], { type: item.mime });
          }
          if (await digest(blob) !== item.sha256) throw new Error(`Recording verification failed: ${item.name}`);
          files.set(item.name, blob);
        }
        for (const name of references(seed.project)) if (!files.has(name)) throw new Error(`Missing media: ${name}`);
        await transaction(tx => {
          for (const [name, blob] of files) tx.objectStore('media').put(blob, name);
          tx.objectStore('project').put(seed.project, 'active');
        });
        project = seed.project;
      } else {
        validate(project);
        for (const name of references(project)) {
          const blob = await read('media', name);
          if (!blob) throw new Error(`Local media missing: ${name}. Restore an exported backup.`);
          files.set(name, blob);
        }
      }
      hydrate(files);
      $('exportBtn').disabled = $('importBtn').disabled = false;
      if (hosted) hosted.showStatus(project);
      else status(`${project.title} · Saved on this browser · Local preview`);
    } catch (err) {
      status(`Could not open project: ${err.message}`);
      throw err;
    }
  })();
  // Attach a rejection handler immediately; loadPads also reports startup errors.
  ready.catch(() => {});
  window.browserProject = {
    ready,
    async createBackup() {
      await ready; await writes;
      const snapshot = clone(project), media = [];
      for (const name of references(snapshot)) {
        const blob = await read('media', name);
        if (!blob) throw new Error(`Missing media: ${name}`);
        media.push({ name, mime: blob.type, sha256: await digest(blob), base64: await toBase64(blob) });
      }
      return { format: 'larry-soundboard-backup-v1', project: snapshot, media };
    },
    async installSeed(seed) {
      validate(seed.project);
      const files = new Map();
      for (const item of seed.files) {
        if (typeof item.name !== 'string' || files.has(item.name) || await digest(item.blob) !== item.sha256) throw new Error('Damaged performance media. Previous version retained.');
        files.set(item.name, item.blob);
      }
      for (const name of references(seed.project)) if (!files.has(name)) throw new Error(`Missing media: ${name}`);
      await enqueue(() => transaction(tx => {
        tx.objectStore('media').clear();
        for (const [name, blob] of files) tx.objectStore('media').put(blob, name);
        tx.objectStore('project').put(seed.project, 'active');
      }));
    },
    mediaUrl(name) { if (!urls.has(name)) throw new Error(`Media not loaded: ${name}`); return urls.get(name); },
    person(id) { return project?.people.find(p => p.id === id); },
    personOptions(select, value) {
      select.replaceChildren(new Option('Unassigned', ''));
      for (const p of project.people) select.add(new Option(p.name, p.id));
      select.value = value || '';
    },
    getCue(id) { return clone(project.cues[id] || {}); },
    getPassage(id) { return clone(project.passages[id] || {}); },
    async savePassage(id, value) { await save(p => {
      const previous = p.passages[id] || {};
      const block = p.script.pages.flatMap(page => page.blocks).find(block => block.id === id);
      const changed = value.text !== undefined && value.text !== (previous.text ?? block?.text ?? '');
      p.passages[id] = { ...previous, ...clone(value) };
      if (changed) { delete p.passages[id].highlights; delete p.passages[id].highlightText; delete p.passages[id].blankColor; }
    }); },
    async saveCue(id, meta, actions) { await save(p => {
      const block = p.script.pages.flatMap(page => page.blocks).find(block => block.id === id);
      if (meta.name !== (p.cues[id]?.name || block?.cue) && p.passages[id]) {
        delete p.passages[id].highlights; delete p.passages[id].highlightText; delete p.passages[id].blankColor;
      }
      p.cues[id] = clone(meta); p.assignments[id] = clone(actions);
    }); },
    async applyHighlights(parts, color) { await save(p => {
      if (!['', '1', '2', '3'].includes(color)) throw new Error('Invalid highlight color.');
      for (const part of parts) {
        const block = p.script.pages.flatMap(page => page.blocks).find(block => block.id === part.id);
        if (!block) throw new Error('Script passage is unavailable.');
        const meta = p.passages[part.id] ||= {};
        if (part.blank) { meta.blankColor = color; continue; }
        const text = block.cue ? p.cues[part.id]?.name || block.cue : meta.text ?? block.text ?? '';
        if (part.text !== text) throw new Error('Script text changed. Select the words again.');
        const ranges = meta.highlightText === text ? meta.highlights || [] : [];
        const next = [];
        for (const r of ranges) {
          if (r.end <= part.start || r.start >= part.end) next.push(r);
          else {
            if (r.start < part.start) next.push({ ...r, end: part.start });
            if (r.end > part.end) next.push({ ...r, start: part.end });
          }
        }
        if (color) next.push({ start: part.start, end: part.end, color });
        meta.highlightText = text; meta.highlights = next.sort((a, b) => a.start - b.start);
      }
    }); },
    shortcutClash(key, id) {
      if (!key) return '';
      if (['1', '2', '3'].includes(key)) return 'Keys 1, 2 and 3 are reserved for script highlighting.';
      const pad = project.pads.find(p => p.key === key);
      if (pad) return `Key ${key} is used by sound “${pad.label}”.`;
      return Object.entries(project.cues).some(([cueId, c]) => cueId !== id && c.key === key) ? `Key ${key} is used by another cue.` : '';
    },
    snapshot() { return clone(project); },
  };
  window.api = {
    async loadPads() { await ready; return clone(project.pads); },
    async savePads(pads) { await save(p => { p.pads = clone(pads); }); return clone(project.pads); },
    async loadScript() { await ready; return { ...clone(project.script), assignments: clone(project.assignments) }; },
    async saveScript(assignments) { await save(p => { p.assignments = clone(assignments); }); return clone(project.assignments); },
    onScriptReplaced() {}, onPadsReplaced() {},
    async pickMedia(kind) {
      const file = await chooseFile(kind === 'image' ? 'image/png,image/jpeg,image/gif,image/webp' : 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff');
      return file ? storeFile(file, file.name) : null;
    },
    saveRecording(wav) { return storeFile(new Blob([wav], { type: 'audio/wav' }), 'recording.wav'); },
    async requestMic() { return { ok: true }; },
  };
  const error = err => { status(`Error: ${err.message}`); };
  const toBase64 = blob => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
  });
  $('exportBtn').addEventListener('click', async () => {
    $('exportBtn').disabled = true;
    try {
      const blob = new Blob([JSON.stringify(await window.browserProject.createBackup())], { type: 'application/json' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `Soundboard-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status('Backup exported · Keep it somewhere safe');
    } catch (err) { error(err); } finally { $('exportBtn').disabled = false; }
  });
  $('importBtn').addEventListener('click', async () => {
    try {
      if (hosted) await hosted.assertAdmin();
      const file = await chooseFile('.json,application/json');
      if (!file) return;
      if (document.querySelector('dialog[open]')) throw new Error('Save or cancel the open editor first.');
      if (!confirm('Replace this browser’s project with the backup? Export a backup first if you want to keep your edits. Your desktop board is unaffected.')) return;
      $('importBtn').disabled = $('exportBtn').disabled = true;
      window.dispatchEvent(new Event('project-stop'));
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'larry-soundboard-backup-v1' || !Array.isArray(backup.media)) throw new Error('Unsupported backup file.');
      validate(backup.project);
      if (hosted) { delete backup.project.downloadedVersion; backup.project.modifiedAt = new Date().toISOString(); }
      const files = new Map();
      for (const item of backup.media) {
        if (typeof item.name !== 'string' || /[\\/]/.test(item.name) || files.has(item.name) || typeof item.base64 !== 'string') throw new Error('Invalid or duplicate backup media.');
        const bytes = Uint8Array.from(atob(item.base64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: item.mime });
        if (await digest(blob) !== item.sha256) throw new Error(`Damaged backup recording: ${item.name}`);
        files.set(item.name, blob);
      }
      for (const name of references(backup.project)) if (!files.has(name)) throw new Error(`Missing backup recording: ${name}`);
      await enqueue(() => transaction(tx => {
        tx.objectStore('media').clear();
        for (const [name, blob] of files) tx.objectStore('media').put(blob, name);
        tx.objectStore('project').put(backup.project, 'active');
      }));
      location.reload();
    } catch (err) { error(err); } finally { $('importBtn').disabled = $('exportBtn').disabled = false; }
  });
  let peopleDraft = [];
  function personRow(person) {
    const row = document.createElement('div'); row.className = 'person-row row'; row.dataset.id = person.id;
    const name = document.createElement('input'); name.type = 'text'; name.value = person.name; name.maxLength = 80; name.required = true; name.setAttribute('aria-label', 'Person name');
    const color = document.createElement('input'); color.type = 'color'; color.value = person.color; color.setAttribute('aria-label', 'Person color');
    row.append(name, color); $('peopleRows').append(row);
  }
  $('peopleBtn').addEventListener('click', async () => {
    try { await ready; if (hosted) await hosted.assertAdmin(); peopleDraft = clone(project.people); $('peopleRows').replaceChildren(); peopleDraft.forEach(personRow); $('peopleError').textContent = ''; $('peopleEditor').showModal(); }
    catch (err) { error(err); }
  });
  $('addPerson').addEventListener('click', () => {
    const person = { id: crypto.randomUUID(), name: '', color: '#5a7fc7' }; peopleDraft.push(person); personRow(person);
  });
  $('cancelPeople').addEventListener('click', () => $('peopleEditor').close());
  $('peopleForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const people = [...$('peopleRows').children].map(row => ({ id: row.dataset.id, name: row.querySelector('input[type=text]').value.trim(), color: row.querySelector('input[type=color]').value }));
      if (people.some(p => !p.name)) throw new Error('Enter a name for each person.');
      await save(p => { p.people = people; }); $('peopleEditor').close(); window.dispatchEvent(new Event('project-people-changed'));
    } catch (err) { $('peopleError').textContent = err.message; }
  });
})();
