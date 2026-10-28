// Isolated Chrome integration checks; no real project or user profile is changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow } = require('./chrome-test-driver.cjs');
const { validateBackup } = require('./hosted/backup.cjs');
const fixture = { schemaVersion: 1, title: 'Highlight test',
  pads: [{ id: 'sound', label: 'Old number shortcut', key: '1', volume: 1 }],
  script: { pages: [{ page: 1, blocks: [{ id: 'a', text: 'First passage words.' },
    { id: 'b', text: 'Second passage words.' }, { id: 'c', cue: 'SFX: Slippered shuffle.' }] }] },
  people: [], passages: {}, assignments: {}, cues: { c: { name: 'SFX: Slippered shuffle.', key: '2', volume: 1, live: true } } };
const dir = path.join(__dirname, 'test-results'); fs.mkdirSync(dir, { recursive: true });
const logPath = path.join(dir, 'highlights.log'); fs.writeFileSync(logPath, '');
const log = text => fs.appendFileSync(logPath, text + '\n');
const check = (value, message) => { assert.ok(value, message); log('PASS ' + message); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer((req, res) => {
  if (req.url === '/local-project/project.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ project: fixture, files: [] })); return; }
  const name = req.url === '/' ? 'index.html' : req.url.slice(1);
  if (!/^[a-z.-]+$/.test(name)) { res.writeHead(404).end(); return; }
  const file = path.join(__dirname, 'dist', name);
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(file));
});
let win;
const js = code => win.webContents.executeJavaScript(code, true);
const finish = code => { clearTimeout(watchdog); server.close(); app.exit(code); };
const watchdog = setTimeout(() => { log('FAIL timeout'); finish(1); }, 60000);
async function key(key) { await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},bubbles:true}))`); await pause(80); }
async function select(id, start, end, lastId = id) {
  await js(`(() => {
    const first = document.querySelector('[data-highlight-id="${id}"]');
    const last = document.querySelector('[data-highlight-id="${lastId}"]');
    function point(el, offset) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let node;
      while (node = walker.nextNode()) { if (offset <= node.length) return [node, offset]; offset -= node.length; }
      throw Error('Offset outside text');
    }
    const range = document.createRange(); range.setStart(...point(first,${start})); range.setEnd(...point(last,${end}));
    getSelection().removeAllRanges(); getSelection().addRange(range);
  })()`);
}
(async () => {
  try {
    await new Promise(resolve => server.listen(18788, '127.0.0.1', resolve));
    await app.whenReady(); win = new BrowserWindow({ show: false });
    const errors = []; win.webContents.on('console-message', (_, detail) => { if (detail.level === 'error') errors.push(detail.message); });
    await win.loadURL('http://127.0.0.1:18788'); await js('window.browserProject.ready');
    for (let i = 0; i < 50 && !await js("!!document.querySelector('[data-highlight-id]')"); i++) await pause(50);
    check(await js("window.browserProject.snapshot().pads[0].key==='' && window.browserProject.getCue('c').key===''") , 'existing numeric sound and cue shortcuts cleared');
    await js("document.getElementById('editToggle').click();document.getElementById('scriptView').click()");
    await select('a', 0, 5); await js("document.querySelector('.dialogue').click()");
    check(await js("!document.getElementById('passageEditor').open"), 'selecting passage does not open editor');
    await key('1');
    check(await js("document.querySelector('[data-highlight-id=a] mark').textContent==='First'"), '1 highlights selected words yellow');
    await select('a', 2, 7); await key('2');
    check(await js("window.browserProject.getPassage('a').highlights.some(r=>r.start===2&&r.end===7&&r.color==='2')"), 'overlapping selection changes color and splits old range');
    await select('a', 2, 7); await key('0');
    check(await js("window.browserProject.getPassage('a').highlights.length===1 && document.querySelector('[data-highlight-id=a] mark').textContent==='Fi'"), '0 clears only selected highlighting');
    await js("document.querySelector('[data-blank-id=c]').click()"); await key('3');
    check(await js("window.browserProject.getPassage('c').blankColor==='3'"), 'blank line below SFX cue can be highlighted green');
    await select('c', 0, 4); await js("document.querySelector('.script-cue').click()");
    check(await js("!document.getElementById('cueEditor').open"), 'selecting SFX text does not open cue editor');
    await key('2');
    check(await js("document.querySelector('[data-highlight-id=c] mark').textContent==='SFX:'"), 'SFX words accept pink highlighting independently of green blank line');
    await select('a', 6, 6, 'b'); await key('1');
    check(await js("window.browserProject.getPassage('b').highlights[0].end===6 && window.browserProject.getPassage('a').blankColor==='1'"), 'selection spanning passages highlights words and intervening blank line');
    await js("window.browserProject.savePassage('a',{note:'Keep note'})");
    check(await js("window.browserProject.getPassage('a').highlights.length>0"), 'note edits preserve text highlights');
    await js("getSelection().removeAllRanges();document.querySelector('.edit-passage').click();document.getElementById('passageText').value='Changed wording.';document.getElementById('passageForm').requestSubmit()"); await pause(100);
    check(await js("!window.browserProject.getPassage('a').highlights && !window.browserProject.getPassage('a').blankColor && window.browserProject.getPassage('b').highlights.length>0"), 'wording edit clears changed passage highlights and keeps other passages');
    await select('a', 0, 7); await key('3');
    check(await js("document.querySelector('[data-highlight-id=a] mark').textContent==='Changed'"), 'corrected wording can be highlighted again');
    await js("document.querySelector('.edit-passage').click();document.getElementById('passageText').focus();document.getElementById('passageText').dispatchEvent(new KeyboardEvent('keydown',{key:'2',bubbles:true}));document.getElementById('cancelPassage').click()");
    check(await js("window.browserProject.getPassage('a').highlights[0].color==='3'"), 'number typing inside passage editor does not change highlights');
    const backup = await js('window.browserProject.createBackup()'); validateBackup(backup);
    check(backup.project.passages.c.blankColor === '3', 'backup and hosted validator preserve text and blank highlights');
    const invalid = structuredClone(backup); invalid.project.passages.a.highlights[0].end = 9999;
    assert.throws(() => validateBackup(invalid)); log('PASS hosted validator rejects invalid highlight offsets');
    check(await js("window.browserProject.shortcutClash('1','c').includes('reserved')"), 'reserved keys cannot be assigned to cues');
    await js("document.getElementById('editToggle').click()");
    await key('1');
    check(await js("window.browserProject.getPassage('a').highlights[0].color==='3' && !document.querySelector('[data-blank-id=c]').hidden && document.querySelector('.highlight-tools').classList.contains('hidden')"), 'performance mode displays highlights and hides editing controls');
    await win.loadURL('http://127.0.0.1:18788'); await js('window.browserProject.ready'); await pause(100);
    check(await js("document.querySelector('[data-highlight-id=a] mark').textContent==='Changed' && window.browserProject.getPassage('c').blankColor==='3'"), 'text and blank-line highlights survive reload');
    fs.writeFileSync(path.join(dir, 'highlight-preview.png'), (await win.webContents.capturePage()).toPNG());
    check(errors.length === 0, 'no browser runtime errors'); log('ALL CHECKS PASSED'); finish(0);
  } catch (err) { log(err.stack); finish(1); }
})();
