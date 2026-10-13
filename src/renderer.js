(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const board = $('board');
  const hint = $('hint');
  const toastEl = $('toast');
  const editor = $('editor');

  let pads = [];
  let editMode = false;
  let draft = null;
  let draftIsNew = false;
  let testAudio = null;
  let toastTimer = null;
  const players = new Map(); // pad id -> { audio, src }

  const mediaUrl = (name) => `media://file/${encodeURIComponent(name)}`;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 4000);
  }

  async function persist() {
    try {
      await window.api.savePads(pads);
    } catch (err) {
      toast('Could not save changes: ' + err.message);
    }
  }

  // ---------- Playback ----------

  function padElement(id) {
    return board.querySelector(`[data-id="${CSS.escape(id)}"]`);
  }

  function setPlaying(id, on) {
    const el = padElement(id);
    if (el) el.classList.toggle('playing', on);
  }

  function getPlayer(pad) {
    let entry = players.get(pad.id);
    if (entry && entry.src !== pad.sound) {
      entry.audio.pause();
      entry = null;
    }
    if (!entry) {
      const audio = new Audio(mediaUrl(pad.sound));
      audio.preload = 'auto';
      audio.addEventListener('play', () => setPlaying(pad.id, true));
      audio.addEventListener('pause', () => setPlaying(pad.id, false));
      audio.addEventListener('ended', () => setPlaying(pad.id, false));
      audio.addEventListener('error', () => {
        setPlaying(pad.id, false);
        toast(`Can't play "${pad.label}". Try choosing the sound file again.`);
      });
      entry = { audio, src: pad.sound };
      players.set(pad.id, entry);
    }
    return entry.audio;
  }

  function dropPlayer(id) {
    const entry = players.get(id);
    if (entry) {
      entry.audio.pause();
      players.delete(id);
    }
  }

  function stopAudio(audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  function stopAll() {
    for (const { audio } of players.values()) stopAudio(audio);
  }

  function triggerPad(pad) {
    if (!pad.sound) {
      toast(`"${pad.label}" has no sound yet. Turn on Edit Mode to add one.`);
      return;
    }
    const audio = getPlayer(pad);
    if (pad.loop && !audio.paused) {
      stopAudio(audio);
      return;
    }
    audio.loop = pad.loop;
    audio.volume = pad.volume;
    audio.currentTime = 0;
    audio.play().catch((err) => {
      if (err.name !== 'AbortError') toast(`Can't play "${pad.label}": ${err.message}`);
    });
  }

  // ---------- Board ----------

  function render() {
    board.textContent = '';
    hint.textContent = editMode
      ? 'Edit Mode: click a pad to change it, or drag pads to reorder. Turn Edit Mode off before the show.'
      : 'Click a pad (or press its key) to play. Esc stops everything.';

    if (!pads.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No sounds yet. Click "Edit Mode", then "+ Add Sound".';
      board.appendChild(empty);
    }

    for (const pad of pads) board.appendChild(buildPad(pad));

    for (const [id, { audio }] of players) {
      if (!audio.paused) setPlaying(id, true);
    }
  }

  function hueFor(text) {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  function buildPad(pad) {
    const el = document.createElement('div');
    el.className = 'pad' + (editMode ? ' editing' : '');
    el.dataset.id = pad.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.draggable = editMode;

    if (pad.image) {
      el.style.backgroundImage = `url("${mediaUrl(pad.image)}")`;
    } else {
      const hue = hueFor(pad.label || pad.id);
      el.style.backgroundImage = `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 55% 22%))`;
      const glyph = document.createElement('div');
      glyph.className = 'glyph';
      glyph.textContent = '🔊';
      el.appendChild(glyph);
    }

    if (pad.key) {
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = pad.key;
      el.appendChild(badge);
    }

    if (editMode) {
      const mark = document.createElement('div');
      mark.className = 'edit-mark';
      mark.textContent = '✎ Edit';
      el.appendChild(mark);
    } else if (pad.loop) {
      const mark = document.createElement('div');
      mark.className = 'loop-mark';
      mark.textContent = '🔁';
      el.appendChild(mark);
    }

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = pad.label;
    label.title = pad.label;
    el.appendChild(label);

    const activate = () => (editMode ? openEditor(pad) : triggerPad(pad));
    el.addEventListener('click', activate);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });

    el.addEventListener('dragstart', (e) => {
      if (!editMode) return e.preventDefault();
      e.dataTransfer.setData('text/plain', pad.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragover', (e) => {
      if (!editMode) return;
      e.preventDefault();
      el.classList.add('dragover');
    });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragover');
      if (!editMode) return;
      const fromId = e.dataTransfer.getData('text/plain');
      const from = pads.findIndex((p) => p.id === fromId);
      const to = pads.findIndex((p) => p.id === pad.id);
      if (from < 0 || to < 0 || from === to) return;
      pads.splice(to, 0, pads.splice(from, 1)[0]);
      render();
      persist();
    });

    return el;
  }

  function setEditMode(on) {
    editMode = on;
    $('editToggle').textContent = `Edit Mode: ${on ? 'On' : 'Off'}`;
    $('editToggle').setAttribute('aria-pressed', String(on));
    $('addBtn').classList.toggle('hidden', !on);
    render();
  }

  // ---------- Editor dialog ----------

  function showEditorError(message) {
    const el = $('editorError');
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }

  function refreshEditor() {
    $('fSoundName').textContent = draft.soundName || (draft.sound ? '(current sound)' : '(none chosen)');
    $('fImageName').textContent = draft.imageName || (draft.image ? '(current picture)' : '(none)');
    const preview = $('fImagePreview');
    preview.classList.toggle('hidden', !draft.image);
    if (draft.image) preview.src = mediaUrl(draft.image);
    $('fVolume').value = Math.round(draft.volume * 100);
    $('fVolumeOut').textContent = `${Math.round(draft.volume * 100)}%`;
    $('fLoop').checked = draft.loop;
    $('fKey').value = draft.key;
  }

  function openEditor(pad) {
    draftIsNew = !pad;
    draft = pad
      ? { ...pad }
      : { id: crypto.randomUUID(), label: '', sound: null, image: null, volume: 1, loop: false, key: '' };
    $('editorTitle').textContent = draftIsNew ? 'Add Sound' : 'Edit Sound';
    $('fDelete').classList.toggle('hidden', draftIsNew);
    $('fLabel').value = draft.label;
    showEditorError('');
    refreshEditor();
    editor.showModal();
    $('fLabel').focus();
  }

  function stopTest() {
    if (testAudio) {
      testAudio.pause();
      testAudio = null;
    }
  }

  function closeEditor() {
    stopTest();
    if (editor.open) editor.close();
    draft = null;
  }

  async function pick(kind) {
    try {
      const picked = await window.api.pickMedia(kind);
      if (!picked) return;
      if (kind === 'image') {
        draft.image = picked.file;
        draft.imageName = picked.original;
      } else {
        stopTest();
        draft.sound = picked.file;
        draft.soundName = picked.original;
        if (!$('fLabel').value.trim()) {
          $('fLabel').value = picked.original.replace(/\.[^.]+$/, '');
        }
      }
      refreshEditor();
    } catch (err) {
      showEditorError('Could not open that file: ' + err.message);
    }
  }

  function saveEditor() {
    const label = $('fLabel').value.trim() || (draft.soundName || '').replace(/\.[^.]+$/, '');
    if (!draft.sound) return showEditorError('Please choose a sound file.');
    if (!label) return showEditorError('Please give this sound a name.');
    if (draft.key) {
      const clash = pads.find((p) => p.key === draft.key && p.id !== draft.id);
      if (clash) return showEditorError(`Key ${draft.key} is already used by "${clash.label}".`);
    }

    const saved = {
      id: draft.id,
      label,
      sound: draft.sound,
      image: draft.image,
      volume: draft.volume,
      loop: draft.loop,
      key: draft.key,
    };
    const index = pads.findIndex((p) => p.id === saved.id);
    if (index >= 0) pads[index] = saved;
    else pads.push(saved);

    dropPlayer(saved.id);
    closeEditor();
    render();
    persist();
  }

  function deleteFromEditor() {
    if (!confirm(`Delete "${draft.label}"? This can't be undone.`)) return;
    const id = draft.id;
    pads = pads.filter((p) => p.id !== id);
    dropPlayer(id);
    closeEditor();
    render();
    persist();
  }

  // ---------- Wiring ----------

  $('editToggle').addEventListener('click', () => setEditMode(!editMode));
  $('addBtn').addEventListener('click', () => openEditor(null));
  $('stopAll').addEventListener('click', stopAll);

  $('fSoundPick').addEventListener('click', () => pick('audio'));
  $('fImagePick').addEventListener('click', () => pick('image'));
  $('fImageClear').addEventListener('click', () => {
    draft.image = null;
    draft.imageName = '';
    refreshEditor();
  });
  $('fSoundTest').addEventListener('click', () => {
    stopTest();
    if (!draft.sound) return showEditorError('Choose a sound file first.');
    testAudio = new Audio(mediaUrl(draft.sound));
    testAudio.volume = draft.volume;
    testAudio.play().catch((err) => showEditorError('Could not play: ' + err.message));
  });

  $('fVolume').addEventListener('input', (e) => {
    draft.volume = Number(e.target.value) / 100;
    $('fVolumeOut').textContent = `${e.target.value}%`;
    if (testAudio) testAudio.volume = draft.volume;
  });
  $('fLoop').addEventListener('change', (e) => { draft.loop = e.target.checked; });
  $('fLabel').addEventListener('input', () => showEditorError(''));

  $('fKey').addEventListener('keydown', (e) => {
    if (e.key === 'Tab') return;
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') draft.key = '';
    else if (e.key.length === 1 && e.key !== ' ') draft.key = e.key.toUpperCase();
    else return;
    showEditorError('');
    refreshEditor();
  });
  $('fKeyClear').addEventListener('click', () => {
    draft.key = '';
    refreshEditor();
  });

  $('editorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveEditor();
  });
  $('fCancel').addEventListener('click', closeEditor);
  $('fDelete').addEventListener('click', deleteFromEditor);
  editor.addEventListener('close', stopTest);

  document.addEventListener('keydown', (e) => {
    if (editor.open) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === 'Escape') return stopAll();
    if (editMode || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length !== 1) return;
    const pad = pads.find((p) => p.key && p.key === e.key.toUpperCase());
    if (pad) {
      e.preventDefault();
      triggerPad(pad);
    }
  });

  (async () => {
    try {
      pads = await window.api.loadPads();
    } catch (err) {
      toast('Could not load saved sounds: ' + err.message);
    }
    render();
  })();
})();
