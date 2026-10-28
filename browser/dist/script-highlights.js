// Text offsets refer only to the script words, never to reader labels or controls.
window.createScriptHighlighter = function (host) {
  const root = document.getElementById('scriptText');
  const colors = { '1': '#fff176', '2': '#ff9fce', '3': '#91df78' };
  let blankId = null, busy = false;
  root.addEventListener('mousedown', event => {
    if (event.target.closest('[data-blank-id]')) return;
    blankId = null;
    root.querySelectorAll('.blank-selected').forEach(line => line.classList.remove('blank-selected'));
  });
  const toolbar = document.createElement('div');
  toolbar.className = 'highlight-tools hidden';
  toolbar.setAttribute('aria-label', 'Script highlighter');
  const help = document.createElement('span');
  help.textContent = 'Select words or a blank line: ';
  toolbar.append(help);
  for (const [key, label] of [['1', 'Yellow'], ['2', 'Pink'], ['3', 'Green'], ['0', 'Clear highlight']]) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn'; button.textContent = key === '0' ? label : `${key} ${label}`;
    if (colors[key]) { button.style.backgroundColor = colors[key]; button.style.color = '#111'; }
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => apply(colors[key] || ''));
    toolbar.append(button);
  }
  root.closest('section').querySelector('.script-tools').after(toolbar);
  function renderText(el, id, text) {
    el.dataset.highlightId = id;
    const meta = window.browserProject.getPassage(id);
    const ranges = meta.highlightText === text ? meta.highlights || [] : [];
    el.replaceChildren();
    let at = 0;
    for (const range of ranges) {
      el.append(document.createTextNode(text.slice(at, range.start)));
      const mark = document.createElement('mark'); mark.style.backgroundColor = colors[range.color];
      mark.textContent = text.slice(range.start, range.end); el.append(mark); at = range.end;
    }
    el.append(document.createTextNode(text.slice(at)));
  }
  function addBlank(section, id) {
    const line = document.createElement('span');
    line.className = 'script-blank'; line.dataset.blankId = id;
    // Nonbreaking spaces make the empty line draggable as well as clickable.
    line.textContent = '\u00a0'.repeat(24);
    line.addEventListener('click', () => {
      if (!host.isEditing() || !getSelection().isCollapsed) return;
      blankId = id; getSelection().removeAllRanges(); refresh(); line.focus();
    });
    section.append(line);
  }
  function refresh() {
    toolbar.classList.toggle('hidden', !host.isEditing());
    for (const el of root.querySelectorAll('[data-blank-id]')) {
      const color = window.browserProject.getPassage(el.dataset.blankId).blankColor;
      el.style.backgroundColor = colors[color] || '';
      el.hidden = !host.isEditing() && !color;
      el.tabIndex = host.isEditing() ? 0 : -1;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Blank line: press 1 for yellow, 2 for pink, 3 for green, or 0 to clear');
      el.classList.toggle('blank-selected', host.isEditing() && blankId === el.dataset.blankId);
    }
    for (const button of root.querySelectorAll('.edit-passage')) button.hidden = !host.isEditing();
  }
  function selectedParts() {
    const selection = getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
      const id = document.activeElement?.dataset.blankId || blankId;
      return id ? [{ id, blank: true }] : [];
    }
    const selected = selection.getRangeAt(0);
    if (!root.contains(selected.startContainer) || !root.contains(selected.endContainer)) return [];
    const parts = [];
    for (const el of root.querySelectorAll('[data-highlight-id], [data-blank-id]')) {
      if (!selected.intersectsNode(el)) continue;
      if (el.dataset.blankId) { parts.push({ id: el.dataset.blankId, blank: true }); continue; }
      const range = document.createRange(); range.selectNodeContents(el);
      const before = range.cloneRange();
      if (el.contains(selected.startContainer)) range.setStart(selected.startContainer, selected.startOffset);
      if (el.contains(selected.endContainer)) range.setEnd(selected.endContainer, selected.endOffset);
      before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length, end = start + range.toString().length;
      if (end > start) parts.push({ id: el.dataset.highlightId, text: el.textContent, start, end });
    }
    return parts;
  }
  async function apply(color) {
    if (!host.isEditing() || document.querySelector('dialog[open]') || busy) return;
    const parts = selectedParts();
    if (!parts.length) { host.toast('Select script words or click a blank line first.'); return; }
    busy = true;
    try {
      await window.browserProject.applyHighlights(parts, Object.keys(colors).find(key => colors[key] === color) || '');
      getSelection().removeAllRanges();
      for (const el of root.querySelectorAll('[data-highlight-id]')) renderText(el, el.dataset.highlightId, el.textContent);
      refresh();
    } catch (err) { host.toast('Could not save highlight: ' + err.message); }
    finally { busy = false; }
  }
  document.addEventListener('keydown', event => {
    if (!host.isEditing() || root.closest('section').classList.contains('hidden') || document.querySelector('dialog[open]') ||
        event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (!['0', '1', '2', '3'].includes(event.key)) return;
    event.preventDefault(); apply(colors[event.key] || '');
  });
  return { renderText, addBlank, refresh, hasSelection: () => !getSelection().isCollapsed };
};
