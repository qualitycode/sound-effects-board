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
  let testVoice = null;
  let toastTimer = null;
  const players = new Map(); // pad id -> { audio, src }
  let scriptView = null;
  const pendingActions = new Map();
  function cancelScheduled(id) {
    for (const timer of pendingActions.get(id) || []) clearTimeout(timer);
    pendingActions.delete(id);
    const entry = players.get(id);
    if (entry) entry.repeatRemaining = 1;
  }

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

  let audioCtx = null;
  let limiter = null;

  // Everything plays through a limiter so boosted quiet sounds can't clip harshly.
  function audioGraph() {
    if (!audioCtx) {
      audioCtx = new AudioContext();
      limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.15;
      limiter.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return { ctx: audioCtx, out: limiter };
  }

  // An <audio> element can't go above 100%, so volume is applied with a gain node (up to 300%).
  function createVoice(name) {
    const { ctx, out } = audioGraph();
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.src = mediaUrl(name);
    const gain = ctx.createGain();
    ctx.createMediaElementSource(audio).connect(gain);
    gain.connect(out);
    return { audio, gain };
  }

  function padElement(id) {
    return board.querySelector(`[data-id="${CSS.escape(id)}"]`);
  }

  function setPlaying(id, on) {
    const el = padElement(id);
    if (el) el.classList.toggle('playing', on);
    scriptView?.refreshPlayback();
  }

  function getPlayer(pad) {
    let entry = players.get(pad.id);
    if (entry && entry.src !== pad.sound) {
      dropPlayer(pad.id);
      entry = null;
    }
    if (!entry) {
      const { audio, gain } = createVoice(pad.sound);
      audio.addEventListener('play', () => setPlaying(pad.id, true));
      audio.addEventListener('pause', () => setPlaying(pad.id, false));
      audio.addEventListener('ended', () => {
        if (entry.repeatRemaining > 1) {
          entry.repeatRemaining--;
          audio.currentTime = 0;
          audio.play().catch(err => toast(`Can't repeat "${pad.label}": ${err.message}`));
        } else setPlaying(pad.id, false);
      });
      audio.addEventListener('error', () => {
        setPlaying(pad.id, false);
        toast(`Can't play "${pad.label}". Try choosing the sound file again.`);
      });
      entry = { audio, gain, src: pad.sound };
      players.set(pad.id, entry);
    }
    return entry;
  }

  function dropPlayer(id) {
    cancelScheduled(id);
    const entry = players.get(id);
    if (entry) {
      clearTimeout(entry.fadeTimer);
      entry.audio.pause();
      entry.gain.disconnect();
      players.delete(id);
    }
  }

  function stopAudio(audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  function stopAll() {
    for (const id of pendingActions.keys()) cancelScheduled(id);
    for (const entry of players.values()) {
      entry.repeatRemaining = 1;
      clearTimeout(entry.fadeTimer);
      stopAudio(entry.audio);
    }
    scriptView?.refreshPlayback();
  }

  function triggerPad(pad) {
    cancelScheduled(pad.id);
    if (!pad.sound) {
      toast(`"${pad.label}" has no sound yet. Turn on Edit Mode to add one.`);
      return;
    }
    const { audio, gain } = getPlayer(pad);
    clearTimeout(players.get(pad.id).fadeTimer);
    if (pad.loop && !audio.paused) {
      stopAudio(audio);
      return;
    }
    audio.loop = pad.loop;
    gain.gain.cancelScheduledValues(audioCtx.currentTime);
    gain.gain.value = pad.volume;
    audio.currentTime = 0;
    audioGraph();
    audio.play().catch((err) => {
      if (err.name !== 'AbortError') toast(`Can't play "${pad.label}": ${err.message}`);
    });
  }

  // ---------- Board ----------

  function runScriptAction(id, action, options = {}) {
    const pad = pads.find(p => p.id === id);
    if (!pad || !pad.sound) return;
    if (['play', 'loop', 'hold'].includes(action)) {
      const entry = getPlayer(pad);
      clearTimeout(entry.fadeTimer);
      entry.gain.gain.cancelScheduledValues(audioCtx.currentTime);
      entry.gain.gain.value = pad.volume;
      if (action === 'hold' && !entry.audio.paused) return;
      entry.audio.loop = action !== 'play';
      entry.repeatRemaining = action === 'play' ? Math.max(1, options.repeat || 1) : 1;
      entry.audio.currentTime = 0;
      entry.audio.play().catch(err => { if (err.name !== 'AbortError') toast(`Can't play "${pad.label}": ${err.message}`); });
    } else {
      const entry = players.get(id);
      if (!entry) return;
      entry.repeatRemaining = 1;
      clearTimeout(entry.fadeTimer);
      if (action === 'fade' && !entry.audio.paused) {
        const now = audioCtx.currentTime;
        entry.gain.gain.cancelAndHoldAtTime(now);
        entry.gain.gain.linearRampToValueAtTime(0, now + 2);
        entry.fadeTimer = setTimeout(() => stopAudio(entry.audio), 2000);
      } else stopAudio(entry.audio);
    }
  }

  function runCueActions(actions) {
    for (const id of new Set(actions.map(a => a.padId))) cancelScheduled(id);
    for (const action of actions) {
      if (!action.delay) runScriptAction(action.padId, action.action, action);
      else {
        if (!pendingActions.has(action.padId)) pendingActions.set(action.padId, new Set());
        const timers = pendingActions.get(action.padId);
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!timers.size) pendingActions.delete(action.padId);
          runScriptAction(action.padId, action.action, action);
        }, action.delay * 1000);
        timers.add(timer);
      }
    }
  }

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
    scriptView?.refresh();
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
    if (testVoice) {
      testVoice.audio.pause();
      testVoice.gain.disconnect();
      testVoice = null;
    }
  }

  // ---------- Recording ----------

  const MAX_RECORD_SECONDS = 120;
  let recording = null;

  const formatTime = (secs) => {
    const s = Math.floor(secs);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function setRecordingUi(on) {
    const btn = $('fRecord');
    btn.disabled = false;
    btn.classList.toggle('recording', on);
    btn.textContent = on ? '■ Stop 0:00' : '● Record';
    for (const id of ['fSoundPick', 'fSoundTest', 'fSave', 'fDelete']) $(id).disabled = on;
  }

  function micErrorMessage(err) {
    switch (err && err.name) {
      case 'NotAllowedError':
        return 'Microphone access is blocked. On a Mac, open System Settings > Privacy & Security > Microphone and turn on Sound Effects Board. On Windows, check Settings > Privacy > Microphone.';
      case 'NotFoundError':
        return 'No microphone was found. Plug one in and try again.';
      default:
        return 'Could not start recording: ' + ((err && err.message) || err);
    }
  }

  function encodeWav(audio) {
    const frames = audio.length;
    const rate = audio.sampleRate;
    const channels = audio.numberOfChannels;
    const mono = new Float32Array(frames);
    for (let c = 0; c < channels; c++) {
      const data = audio.getChannelData(c);
      for (let i = 0; i < frames; i++) mono[i] += data[i] / channels;
    }
    const buffer = new ArrayBuffer(44 + frames * 2);
    const view = new DataView(buffer);
    const text = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
    text(0, 'RIFF');
    view.setUint32(4, 36 + frames * 2, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, frames * 2, true);
    for (let i = 0; i < frames; i++) {
      const s = Math.max(-1, Math.min(1, mono[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return { wav: buffer, seconds: frames / rate };
  }

  async function blobToWav(blob) {
    const ctx = new AudioContext();
    try {
      return encodeWav(await ctx.decodeAudioData(await blob.arrayBuffer()));
    } finally {
      ctx.close();
    }
  }

  function releaseRecording(rec) {
    clearInterval(rec.timer);
    rec.stream.getTracks().forEach((t) => t.stop());
  }

  async function startRecording() {
    showEditorError('');
    stopTest();
    let stream;
    try {
      const access = await window.api.requestMic();
      if (!access.ok) throw Object.assign(new Error('Microphone access denied'), { name: 'NotAllowedError' });
      // Raw capture: sound effects should not be "cleaned up" like a phone call.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      showEditorError(micErrorMessage(err));
      return;
    }
    if (!editor.open) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const rec = { stream, chunks: [], discard: false, startedAt: Date.now(), timer: null, mediaRecorder: new MediaRecorder(stream) };
    rec.mediaRecorder.addEventListener('dataavailable', (e) => { if (e.data.size) rec.chunks.push(e.data); });
    rec.mediaRecorder.addEventListener('stop', () => finishRecording(rec));
    rec.timer = setInterval(() => {
      const secs = (Date.now() - rec.startedAt) / 1000;
      $('fRecord').textContent = `■ Stop ${formatTime(secs)}`;
      if (secs >= MAX_RECORD_SECONDS) stopRecording();
    }, 250);
    recording = rec;
    rec.mediaRecorder.start();
    setRecordingUi(true);
  }

  function stopRecording() {
    if (recording && recording.mediaRecorder.state !== 'inactive') {
      $('fRecord').disabled = true;
      recording.mediaRecorder.stop();
    }
  }

  function cancelRecording() {
    if (!recording) return;
    const rec = recording;
    rec.discard = true;
    releaseRecording(rec);
    if (rec.mediaRecorder.state !== 'inactive') rec.mediaRecorder.stop();
    recording = null;
    setRecordingUi(false);
  }

  async function finishRecording(rec) {
    releaseRecording(rec);
    if (rec.discard) return;
    $('fRecord').textContent = 'Saving…';
    let saved = null;
    let seconds = 0;
    let error = null;
    try {
      if (!rec.chunks.length) throw new Error('Nothing was recorded.');
      const encoded = await blobToWav(new Blob(rec.chunks, { type: rec.mediaRecorder.mimeType }));
      seconds = encoded.seconds;
      saved = await window.api.saveRecording(encoded.wav);
    } catch (err) {
      error = err;
    }
    if (rec.discard) return;
    recording = null;
    setRecordingUi(false);
    if (error) {
      showEditorError('Could not save the recording: ' + error.message);
      return;
    }
    draft.sound = saved.file;
    draft.soundName = `New recording (${formatTime(seconds)})`;
    if (!$('fLabel').value.trim()) $('fLabel').value = 'New recording';
    refreshEditor();
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
  $('fRecord').addEventListener('click', () => (recording ? stopRecording() : startRecording()));
  $('fImagePick').addEventListener('click', () => pick('image'));
  $('fImageClear').addEventListener('click', () => {
    draft.image = null;
    draft.imageName = '';
    refreshEditor();
  });
  $('fSoundTest').addEventListener('click', () => {
    stopTest();
    if (!draft.sound) return showEditorError('Choose a sound file first.');
    testVoice = createVoice(draft.sound);
    testVoice.gain.gain.value = draft.volume;
    testVoice.audio.play().catch((err) => showEditorError('Could not play: ' + err.message));
  });

  $('fVolume').addEventListener('input', (e) => {
    draft.volume = Number(e.target.value) / 100;
    $('fVolumeOut').textContent = `${e.target.value}%`;
    if (testVoice) testVoice.gain.gain.value = draft.volume;
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

  // Sent by the File > Import Sound Pack menu after new sounds were added on disk.
  window.api.onPadsReplaced((next) => {
    if (editor.open) closeEditor();
    pads = next;
    render();
    scriptView?.reloadAssignments();
  });
  editor.addEventListener('close', () => {
    stopTest();
    cancelRecording();
  });

  document.addEventListener('keydown', (e) => {
    if (editor.open || $('cueEditor').open) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
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
    scriptView = await window.createScriptView({
      getPads: () => pads,
      isEditing: () => editMode,
      isPlaying: (id) => !!players.get(id) && !players.get(id).audio.paused,
      toast,
      runCueActions,
      runAction: (id, action) => { cancelScheduled(id); runScriptAction(id, action); },
    });
  })();
})();
