// Script controls share the board's players, so stops work across both views.
window.createScriptView = async function (host) {
  const $ = id => document.getElementById(id);
  const button = (label, fn, className = 'btn') => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = className; el.textContent = label;
    el.addEventListener('click', fn); return el;
  };
  let data;
  try { data = await window.api.loadScript(); }
  catch (err) { host.toast('Could not load the script: ' + err.message); return null; }
  let assignments = data.assignments;
  window.api.onScriptReplaced(() => window.location.reload());
  let selectedPage = Number(localStorage.getItem('scriptPage')) || 8;
  let selectedCue = null;
  let draftCue = null;
  const cueButtons = new Map();
  const highlighter = window.createScriptHighlighter(host);
  function colorCue(el, person) {
    el.classList.toggle('person-cue', Boolean(person));
    if (!person) {
      el.style.removeProperty('--cue-person-color');
      el.style.removeProperty('--cue-person-text');
      return;
    }
    const rgb = person.color.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
    const linear = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    el.style.setProperty('--cue-person-color', person.color);
    el.style.setProperty('--cue-person-text', luminance > .179 ? '#000000' : '#ffffff');
  }
  const allCues = data.pages.flatMap(page => page.blocks.filter(b => b.cue).map(b => ({ ...b, page: page.page })));
  if (!data.pages.some(p => p.page === selectedPage)) selectedPage = data.pages[0]?.page || 1;
  if (!data.pages.length) $('scriptText').textContent = 'No script is loaded. Choose File > Import Play Script and select the prepared script.json file. Then assign sounds in Edit Mode.';

  function cueReady(cue) {
    if (window.browserProject.getCue(cue.id).live) return true;
    const actions = assignments[cue.id] || [];
    return actions.length > 0 && actions.every(a => host.getPads().some(p => p.id === a.padId && p.sound));
  }
  function actionSummary(cue) {
    return (assignments[cue.id] || []).map(a => `${a.action}: ${host.getPads().find(p => p.id === a.padId)?.label || '(missing sound)'}${a.repeat > 1 ? ` ×${a.repeat}` : ''}${a.delay ? ` after ${a.delay}s` : ''}`).join('; ');
  }
  function runCue(cue) {
    selectPage(cue.page);
    selectedCue = cue.id;
    markSelected();
    if (host.isEditing()) return editCue(cue);
    if (!cueReady(cue)) return host.toast('Assign all sounds for this cue in Edit Mode before playing it.');
    const meta = window.browserProject.getCue(cue.id);
    if (meta.live) { host.toast(`Live cue: ${meta.name || cue.cue}`); return; }
    host.runCueActions((assignments[cue.id] || []).map(action => ({ ...action,
      level: (action.volume ?? host.getPads().find(p => p.id === action.padId)?.volume ?? 1) * (meta.volume ?? 1),
    })));
  }
  function markSelected() {
    for (const [id, el] of cueButtons) el.classList.toggle('selected', id === selectedCue);
  }
  function selectPage(number, scroll = false) {
    selectedPage = number;
    $('scriptPage').value = String(number);
    localStorage.setItem('scriptPage', String(number));
    refreshScene();
    if (scroll) $('script-page-' + number)?.scrollIntoView({ block: 'start' });
  }
  function navigateCue(direction) {
    let index = allCues.findIndex(c => c.id === selectedCue);
    if (index < 0) index = allCues.findIndex(c => c.page >= selectedPage) - (direction > 0 ? 1 : 0);
    const cue = allCues[Math.max(0, Math.min(allCues.length - 1, index + direction))];
    if (!cue) return;
    selectedCue = cue.id;
    selectPage(cue.page);
    markSelected();
    cueButtons.get(cue.id)?.scrollIntoView({ block: 'center' });
    cueButtons.get(cue.id)?.focus({ preventScroll: true });
  }
  function soundControl(pad, container) {
    const row = document.createElement('div'); row.className = 'sound-control';
    const name = document.createElement('strong'); name.textContent = pad.label; row.append(name);
    const controls = document.createElement('div'); controls.className = 'row';
    controls.append(button(pad.loop ? 'Loop' : 'Play', () => host.runAction(pad.id, pad.loop ? 'loop' : 'play')),
      button('Stop', () => host.runAction(pad.id, 'stop')),
      button('Fade', () => host.runAction(pad.id, 'fade')));
    row.classList.toggle('playing', host.isPlaying(pad.id));
    row.append(controls); container.append(row);
  }
  function refreshScene() {
    $('sceneTitle').textContent = `Page ${selectedPage} sounds`;
    $('sceneSounds').replaceChildren();
    const ids = new Set(allCues.filter(c => c.page === selectedPage).flatMap(c => assignments[c.id] || []).map(a => a.padId));
    for (const pad of host.getPads().filter(p => ids.has(p.id))) soundControl(pad, $('sceneSounds'));
    if (!ids.size) $('sceneSounds').textContent = 'Assign this page’s cues in Edit Mode to show their sounds here.';
    refreshPlayback();
  }
  function refreshPlayback() {
    $('nowPlaying').replaceChildren();
    const playing = host.getPads().filter(p => host.isPlaying(p.id));
    for (const pad of playing) soundControl(pad, $('nowPlaying'));
    if (!playing.length) $('nowPlaying').textContent = 'No sounds playing.';
    for (const cue of allCues) {
      const active = (assignments[cue.id] || []).some(a => ['play', 'loop', 'hold'].includes(a.action) && host.isPlaying(a.padId));
      cueButtons.get(cue.id)?.classList.toggle('playing', active);
      $('cueBoard').querySelector(`[data-cue-id="${CSS.escape(cue.id)}"]`)?.classList.toggle('playing', active);
    }
  }
  function refresh() {
    if (!$('scriptPanel').classList.contains('hidden')) {
      $('hint').textContent = host.isEditing()
        ? 'Edit Mode: select words or a blank line; 1 = yellow, 2 = pink, 3 = green, 0 = clear. Use Edit passage to change wording.'
        : 'Click a cue to play its actions. Page controls and Next cue move without playing. Esc stops everything.';
    }
    if (!$('cueBoard').classList.contains('hidden')) {
      $('hint').textContent = host.isEditing()
        ? 'Edit Mode: click a cue to change its name, actions, person, or notes.'
        : 'Click a cue (or press its key) to play its actions. Esc stops everything.';
    }
    for (const cue of allCues) {
      const el = cueButtons.get(cue.id);
      const meta = window.browserProject.getCue(cue.id);
      const person = window.browserProject.person(meta.personId);
      el.textContent = `${host.isEditing() ? 'Edit' : '▶'} ${meta.name || cue.cue}${person ? ' · ' + person.name : ''}${meta.key ? ' · Key ' + meta.key : ''}${meta.live ? ' · Live performer' : ''}${cueReady(cue) ? '' : ' — needs assignment'}`;
      const cueWords = document.createElement('span');
      highlighter.renderText(cueWords, cue.id, meta.name || cue.cue);
      const fullLabel = el.textContent;
      const offset = host.isEditing() ? 'Edit '.length : '\u25b6 '.length;
      el.replaceChildren(document.createTextNode(fullLabel.slice(0, offset)), cueWords, document.createTextNode(fullLabel.slice(offset + (meta.name || cue.cue).length)));
      colorCue(el, person);
      el.title = meta.live ? 'Live performer instruction' : actionSummary(cue) || 'No sounds assigned';
      const note = document.querySelector(`[data-note-for="${CSS.escape(cue.id)}"]`);
      note.textContent = meta.note ?? cue.note ?? '';
      note.hidden = !note.textContent;
      note.style.backgroundColor = meta.noteColor || '#fff0a8';
      el.classList.toggle('unassigned', !cueReady(cue));
      el.setAttribute('aria-label', el.textContent);
    }
    renderCueBoard();
    refreshPassages();
    highlighter.refresh();
    refreshScene();
  }
  function addAction(action = { padId: '', action: 'play' }) {
    const row = document.createElement('div'); row.className = 'cue-action row';
    const select = document.createElement('select'); select.className = 'cue-pad'; select.setAttribute('aria-label', 'Sound');
    select.add(new Option('Choose sound…', ''));
    for (const pad of host.getPads()) select.add(new Option(pad.label, pad.id));
    if (action.padId && !host.getPads().some(p => p.id === action.padId)) select.add(new Option('(missing sound — choose replacement)', action.padId));
    select.value = action.padId;
    const kind = document.createElement('select'); kind.className = 'cue-kind'; kind.setAttribute('aria-label', 'Action');
    for (const [value, label] of [['play', 'Play / repeat'], ['loop', 'Start loop'], ['hold', 'Continue / start loop'], ['stop', 'Stop'], ['fade', 'Fade out (2s)']]) kind.add(new Option(label, value));
    kind.value = action.action;
    const numeric = (title, className, value, max, step) => {
      const label = document.createElement('label'); label.textContent = title + ' ';
      const input = document.createElement('input'); input.type = 'number'; input.min = className === 'cue-repeat' ? 1 : 0;
      input.max = max; input.step = step; input.className = className; input.value = value;
      input.required = true; label.append(input); return label;
    };
    row.append(select, kind, numeric('Delay (s)', 'cue-delay', action.delay || 0, 120, .1),
      numeric('Times', 'cue-repeat', action.repeat || 1, 12, 1), numeric('Volume (%)', 'cue-level', Math.round((action.volume ?? host.getPads().find(p => p.id === action.padId)?.volume ?? 1) * 100), 300, 1), button('Remove', () => row.remove()));
    $('cueActions').append(row);
  }
  function editCue(cue) {
    draftCue = cue;
    const meta = window.browserProject.getCue(cue.id);
    $('cueName').value = meta.name || cue.cue;
    $('cueKey').value = meta.key || '';
    $('cueVolume').value = Math.round((meta.volume ?? 1) * 100);
    $('cueLive').checked = Boolean(meta.live);
    $('cueNote').value = meta.note ?? cue.note ?? '';
    $('cueNoteColor').value = meta.noteColor || '#fff0a8';
    window.browserProject.personOptions($('cuePerson'), meta.personId);
    $('preparedCue').disabled = !cue.defaults?.length;
    $('cueDescription').textContent = `PDF page ${cue.page} · ${cue.cue}${cue.note ? '\n\nRehearsal note: ' + cue.note : ''}`;
    $('cueActions').replaceChildren(); $('cueError').textContent = '';
    for (const action of assignments[cue.id] || []) addAction(action);
    if (!$('cueActions').children.length) addAction();
    $('cueEditor').showModal();
  }
  $('addCueAction').addEventListener('click', () => addAction());
  $('preparedCue').addEventListener('click', () => {
    $('cueActions').replaceChildren();
    for (const action of draftCue.defaults || []) addAction({ ...action,
      padId: host.getPads().find(p => p.label.toLowerCase() === action.label.toLowerCase())?.id || '',
    });
  });
  $('cancelCue').addEventListener('click', () => $('cueEditor').close());
  $('cueForm').addEventListener('submit', async event => {
    event.preventDefault();
    const actions = [...$('cueActions').children].map(row => ({ padId: row.querySelector('.cue-pad').value, action: row.querySelector('.cue-kind').value,
      delay: Number(row.querySelector('.cue-delay').value), repeat: Number(row.querySelector('.cue-repeat').value), volume: Number(row.querySelector('.cue-level').value) / 100 }));
    if (!$('cueLive').checked && (!actions.length || actions.some(a => !host.getPads().some(p => p.id === a.padId && p.sound)))) {
      $('cueError').textContent = 'Choose an available sound for every action, or remove the action.'; return;
    }
    const meta = { name: $('cueName').value.trim(), key: $('cueKey').value.trim().toUpperCase(),
      personId: $('cuePerson').value, volume: Number($('cueVolume').value) / 100, live: $('cueLive').checked,
      note: $('cueNote').value, noteColor: $('cueNoteColor').value };
    if (!meta.name) { $('cueError').textContent = 'Give this cue a name.'; return; }
    const clash = window.browserProject.shortcutClash(meta.key, draftCue.id);
    if (clash) { $('cueError').textContent = clash; return; }
    $('saveCue').disabled = true;
    try {
      await window.browserProject.saveCue(draftCue.id, meta, meta.live ? [] : actions);
      assignments = (await window.api.loadScript()).assignments;
      $('cueEditor').close(); refresh();
    } catch (err) { $('cueError').textContent = 'Could not save cue: ' + err.message; }
    finally { $('saveCue').disabled = false; }
  });

  for (const page of data.pages) {
    $('scriptPage').add(new Option(`PDF ${page.page} / printed ${page.page - 1}`, String(page.page)));
    const section = document.createElement('section'); section.id = 'script-page-' + page.page; section.dataset.page = page.page;
    const heading = document.createElement('h2'); heading.textContent = `${page.page < 28 ? 'Act I' : 'Act II'} · PDF page ${page.page} · printed ${page.page - 1}`; section.append(heading);
    for (const block of page.blocks) {
      if (block.cue) {
        const cue = allCues.find(c => c.id === block.id);
        const el = button(block.cue, () => { if (!highlighter.hasSelection()) runCue(cue); }, 'btn script-cue');
        el.dataset.cueId = block.id; cueButtons.set(block.id, el); section.append(el);
        const note = document.createElement('p'); note.className = 'cue-note user-note'; note.dataset.noteFor = block.id; section.append(note);
      } else {
        const text = document.createElement('p'); text.className = 'dialogue'; text.dataset.blockId = block.id;
        text.textContent = block.text; section.append(text);
        const edit = button('Edit passage', () => { if (host.isEditing()) editPassage(block); }, 'btn edit-passage');
        section.append(edit);
        const note = document.createElement('p'); note.className = 'user-note'; note.dataset.passageNote = block.id; section.append(note);
      }
      highlighter.addBlank(section, block.id);
    }
    $('scriptText').append(section);
  }
  const setView = view => {
    const script = view === 'script';
    $('board').classList.toggle('hidden', view !== 'pads');
    $('cueBoard').classList.toggle('hidden', view !== 'cues');
    $('cuesView').setAttribute('aria-pressed', String(view === 'cues')); $('scriptPanel').classList.toggle('hidden', !script);
    $('padsView').setAttribute('aria-pressed', String(view === 'pads')); $('scriptView').setAttribute('aria-pressed', String(script));
    localStorage.setItem('boardView', view);
    if (script) { refresh(); selectPage(selectedPage, true); }
    else if (view === 'cues') $('hint').textContent = host.isEditing()
      ? 'Edit Mode: click a cue to change its name, actions, person, or notes.'
      : 'Click a cue (or press its key) to play its actions. Esc stops everything.';
    else $('hint').textContent = host.isEditing()
      ? 'Edit Mode: click a pad to change it, or drag pads to reorder. Turn Edit Mode off before the show.'
      : 'Click a pad (or press its key) to play. Esc stops everything.';
  };
  $('cuesView').addEventListener('click', () => { renderCueBoard(); setView('cues'); });
  $('padsView').addEventListener('click', () => setView('pads'));
  $('scriptView').addEventListener('click', () => setView('script'));
  $('scriptPage').addEventListener('change', event => { selectedCue = null; markSelected(); selectPage(Number(event.target.value), true); });
  $('previousCue').addEventListener('click', () => navigateCue(-1));
  $('nextCue').addEventListener('click', () => navigateCue(1));
  const size = Number(localStorage.getItem('scriptSize')) || 18;
  $('scriptSize').value = size; $('scriptText').style.fontSize = size + 'px';
  $('scriptSize').addEventListener('input', event => {
    $('scriptText').style.fontSize = event.target.value + 'px'; localStorage.setItem('scriptSize', event.target.value);
  });
  let scrollPending = false;
  $('scriptText').addEventListener('scroll', () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => {
      scrollPending = false;
      const top = $('scriptText').getBoundingClientRect().top;
      const page = [...$('scriptText').children].find(section => section.getBoundingClientRect().bottom > top + 40);
      if (page && Number(page.dataset.page) !== selectedPage) selectPage(Number(page.dataset.page));
    });
  });
  const passages = data.pages.flatMap(p => p.blocks.filter(b => !b.cue));
  function refreshPassages() {
    for (const block of passages) {
      const el = document.querySelector(`[data-block-id="${CSS.escape(block.id)}"]`);
      const meta = window.browserProject.getPassage(block.id);
      const person = window.browserProject.person(meta.personId);
      el.replaceChildren();
      if (person) { const label = document.createElement('strong'); label.className = 'reader-label'; label.textContent = person.name; el.append(label); }
      const words = document.createElement('span');
      highlighter.renderText(words, block.id, meta.text ?? block.text ?? '');
      el.append(words);
      el.style.borderLeft = person ? `5px solid ${person.color}` : '';
      el.style.backgroundColor = person ? person.color + '18' : '';
      el.classList.toggle('editable-passage', host.isEditing());
      el.removeAttribute('role'); el.removeAttribute('aria-label');
      const note = document.querySelector(`[data-passage-note="${CSS.escape(block.id)}"]`);
      note.textContent = meta.note || ''; note.hidden = !meta.note; note.style.backgroundColor = meta.color || '#fff0a8';
    }
  }
  let passageDraft;
  function editPassage(block) {
    passageDraft = block;
    const meta = window.browserProject.getPassage(block.id);
    $('passageText').value = meta.text ?? block.text ?? '';
    $('passageNote').value = meta.note || '';
    $('passageColor').value = meta.color || '#fff0a8';
    window.browserProject.personOptions($('passagePerson'), meta.personId);
    $('passageError').textContent = ''; $('passageEditor').showModal();
  }
  $('cancelPassage').addEventListener('click', () => $('passageEditor').close());
  $('passageForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const previous = window.browserProject.getPassage(passageDraft.id);
      const changed = $('passageText').value !== (previous.text ?? passageDraft.text ?? '');
      await window.browserProject.savePassage(passageDraft.id, { text: $('passageText').value,
        personId: $('passagePerson').value, note: $('passageNote').value, color: $('passageColor').value });
      $('passageEditor').close(); refreshPassages(); highlighter.refresh();
      if (changed && (previous.highlights?.length || previous.blankColor)) host.toast('Text changed. Please reapply highlights in this passage.');
    } catch (err) { $('passageError').textContent = err.message; }
  });
  function renderCueBoard() {
    $('cueBoard').replaceChildren();
    for (const cue of allCues) {
      const meta = window.browserProject.getCue(cue.id), person = window.browserProject.person(meta.personId);
      const el = button('', () => runCue(cue), 'pad cue-card'); el.dataset.cueId = cue.id;
      const title = document.createElement('strong'); title.textContent = meta.name || cue.cue;
      const info = document.createElement('small'); info.textContent = `Page ${cue.page} · ${person?.name || 'Unassigned'}${meta.key ? ' · Key ' + meta.key : ''}${meta.live ? ' · Live performer' : ''}${cueReady(cue) ? '' : ' · Needs assignment'}`;
      el.append(title, info); colorCue(el, person);
      el.classList.toggle('editing', host.isEditing()); $('cueBoard').append(el);
    }
  }
  window.addEventListener('project-people-changed', refresh);
  refresh(); setView(localStorage.getItem('boardView') || 'pads');
  return { refresh, refreshPlayback, runShortcut: key => { if (['1', '2', '3'].includes(key)) return false; const cue = allCues.find(c => window.browserProject.getCue(c.id).key === key); if (!cue) return false; runCue(cue); return true; }, reloadAssignments: async () => {
    try { assignments = (await window.api.loadScript()).assignments; refresh(); }
    catch (err) { host.toast('Could not reload cue assignments: ' + err.message); }
  } };
};
