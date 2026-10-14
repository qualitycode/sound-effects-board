// Run with node_modules/electron/dist/electron.exe scripts/test-script-view.cjs.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
process.env.SFX_DATA_DIR = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sfx-script-test-'));
// GUI processes can outlive their launching shell. Never log to its output pipe:
// writing to a closed pipe raises EPIPE and Electron shows a main-process dialog.
const resultsFile = process.env.SFX_TEST_LOG || path.join(__dirname, '../build/script-test-results.log');
fs.writeFileSync(resultsFile, '');
const log = message => fs.appendFileSync(resultsFile, message + '\n');
const finish = code => { clearTimeout(watchdog); app.exit(code); };
const watchdog = setTimeout(() => {
  log('FAIL: Integration test exceeded 45 seconds.');
  finish(1);
}, 45000);
process.on('uncaughtException', err => { log(err.stack || String(err)); finish(1); });
process.on('unhandledRejection', err => { log(err?.stack || String(err)); finish(1); });
app.on('browser-window-created', (_event, win) => win.hide());
require(process.env.SFX_TEST_APP || (process.env.SFX_TEST_PACKAGED ? '../dist/win-unpacked/resources/app.asar/main.js' : '../main.js'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
function check(value, message) { assert.ok(value, message); log('PASS ' + message); checks++; }
app.whenReady().then(async () => {
  try {
    let win;
    for (let i = 0; i < 100; i++) {
      win = BrowserWindow.getAllWindows()[0];
      if (win && !win.webContents.isLoading()) break;
      await sleep(100);
    }
    const js = code => win.webContents.executeJavaScript(code);
    for (let i = 0; i < 100; i++) {
      if (await js("document.querySelectorAll('.script-cue').length > 0")) break;
      await sleep(100);
    }
    check(await js("document.querySelectorAll('.script-cue').length === 95"), '95 embedded cues load');
    check(await js("document.querySelectorAll('#scriptText section').length === 41"), '41 dialogue pages load');
    await js("document.getElementById('scriptView').click(); document.getElementById('scriptPage').value='12'; document.getElementById('scriptPage').dispatchEvent(new Event('change'));");
    check(await js("document.getElementById('board').classList.contains('hidden') && !document.getElementById('scriptPanel').classList.contains('hidden')"), 'view switches to script');
    await js("document.querySelector('[data-cue-id=\"p12-c2\"]').click()");
    check(await js("document.getElementById('toast').textContent.includes('Assign all sounds')"), 'unassigned cue refuses playback');
    await js("document.getElementById('editToggle').click(); document.querySelector('[data-cue-id=\"p12-c2\"]').click()");
    check(await js("document.getElementById('cueEditor').open"), 'Edit Mode opens cue editor');
    await js("document.getElementById('cueActions').replaceChildren(); document.getElementById('addCueAction').click()");
    await js(`(async () => {
      const pads = await window.api.loadPads();
      document.querySelector('.cue-pad').value = pads.find(p => p.loop).id;
      document.querySelector('.cue-kind').value = 'loop';
      document.getElementById('cueForm').requestSubmit();
    })()`);
    await sleep(300);
    check(await js("!document.getElementById('cueEditor').open"), 'cue assignment saves');
    check(await js("document.getElementById('sceneSounds').textContent.includes('Wind')"), 'scene panel shows assigned sound');
    await js("document.getElementById('editToggle').click(); document.querySelector('[data-cue-id=\"p12-c2\"]').click()");
    await sleep(400);
    check(await js("document.getElementById('nowPlaying').textContent.includes('Wind')"), 'cue starts real audio loop');
    await js("document.querySelector('[data-cue-id=\"p12-c2\"]').click()");
    await sleep(200);
    check(await js("document.getElementById('nowPlaying').textContent.includes('Wind')"), 'repeating script cue restarts instead of toggling loop off');
    await js("document.querySelector('[data-cue-id=\"p12-c2\"]').scrollIntoView({block:'center'}); document.getElementById('toast').classList.add('hidden')");
    await sleep(100);
    fs.writeFileSync(path.join(__dirname, '../build/script-view-preview.png'), (await win.webContents.capturePage()).toPNG());
    await js("document.getElementById('padsView').click(); document.getElementById('stopAll').click()");
    await sleep(150);
    check(await js("document.getElementById('nowPlaying').textContent.includes('No sounds')"), 'Stop All works across views');
    await js("document.getElementById('scriptView').click(); document.querySelector('[data-cue-id=\"p12-c2\"]').click()");
    await sleep(200);
    await js("[...document.querySelectorAll('#nowPlaying button')].find(b => b.textContent === 'Fade').click()");
    await sleep(2200);
    check(await js("document.getElementById('nowPlaying').textContent.includes('No sounds')"), 'fade ends playback');
    await js("document.querySelector('[data-cue-id=\"p12-c2\"]').click()");
    await sleep(200);
    await js("[...document.querySelectorAll('#nowPlaying button')].find(b => b.textContent === 'Fade').click(); document.querySelector('[data-cue-id=\"p12-c2\"]').click()");
    await sleep(2200);
    check(await js("document.getElementById('nowPlaying').textContent.includes('Wind')"), 'restarting a fading sound cancels its delayed stop');
    await js("document.getElementById('stopAll').click(); document.getElementById('nextCue').click()");
    check(await js("document.querySelector('.script-cue.selected').dataset.cueId === 'p12-c3'"), 'next cue navigation does not play');
    win.webContents.reload();
    await sleep(1000);
    check(await js("document.querySelector('[data-cue-id=\"p12-c2\"]').title.includes('Wind')"), 'assignment persists after reload');
    check(await js("!document.getElementById('scriptPanel').classList.contains('hidden')"), 'view preference persists');
    await js(`(async () => {
      const pads = await window.api.loadPads();
      const data = await window.api.loadScript();
      await window.api.saveScript({ ...data.assignments, 'p12-c3': [{padId:pads.find(p=>!p.loop).id,action:'play'}, {padId:pads.find(p=>p.loop).id,action:'stop'}] });
    })()`);
    win.webContents.reload(); await sleep(1000);
    await js("document.querySelector('[data-cue-id=\"p12-c2\"]').click()"); await sleep(200);
    check(await js("document.getElementById('nowPlaying').textContent.includes('Wind')"), 'group stop test begins with wind playing');
    await js("document.querySelector('[data-cue-id=\"p12-c3\"]').click()"); await sleep(200);
    check(await js("!document.getElementById('nowPlaying').textContent.includes('Wind')"), 'group cue plays a sound and stops wind');
    await js(`(async () => { const data = await window.api.loadScript(); data.assignments['p12-c3'].push({padId:'deleted-pad', action:'play'}); await window.api.saveScript(data.assignments); })()`);
    win.webContents.reload(); await sleep(1000);
    await js("document.querySelector('[data-cue-id=\"p12-c3\"]').click()");
    check(await js("document.querySelector('[data-cue-id=\"p12-c3\"]').classList.contains('unassigned') && document.getElementById('nowPlaying').textContent.includes('No sounds')"), 'missing pad prevents partial group playback');
    await js(`(async () => {
      const pads = await window.api.loadPads(); const data = await window.api.loadScript();
      const wind = pads.find(p=>p.loop).id; const beep = pads.find(p=>p.label==='Beep').id;
      await window.api.saveScript({ ...data.assignments,
        'p12-c1': [{padId:beep,action:'play',repeat:3}],
        'p14-c1': [{padId:wind,action:'loop',delay:.5}],
        'p14-c2': [{padId:wind,action:'hold'}],
      });
    })()`);
    win.webContents.reload(); await sleep(1000);
    await js(`window.testPlayCount=0; const originalPlay=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){ window.testPlayCount++; return originalPlay.call(this); };
      document.querySelector('[data-cue-id="p12-c1"]').click();`);
    await sleep(1900);
    check(await js("window.testPlayCount===3 && document.getElementById('nowPlaying').textContent.includes('No sounds')"), 'counted playback plays exactly three times and ends');
    await js("document.querySelector('[data-cue-id=\"p14-c1\"]').click()"); await sleep(200);
    check(await js("document.getElementById('nowPlaying').textContent.includes('No sounds')"), 'delayed sound waits before starting');
    await sleep(500);
    check(await js("document.getElementById('nowPlaying').textContent.includes('Wind')"), 'delayed loop starts after its delay');
    await js("window.beforeHold=window.testPlayCount; document.querySelector('[data-cue-id=\"p14-c2\"]').click()");
    check(await js("window.testPlayCount===window.beforeHold && document.getElementById('nowPlaying').textContent.includes('Wind')"), 'continue keeps a playing loop without restarting');
    await js("document.getElementById('stopAll').click(); document.querySelector('[data-cue-id=\"p14-c1\"]').click(); document.getElementById('stopAll').click()"); await sleep(700);
    check(await js("document.getElementById('nowPlaying').textContent.includes('No sounds')"), 'Stop All cancels delayed starts');
    await js("window.testPlayCount=0; document.querySelector('[data-cue-id=\"p12-c1\"]').click()"); await sleep(150);
    await js("document.getElementById('stopAll').click()"); await sleep(1400);
    check(await js("window.testPlayCount===1 && document.getElementById('nowPlaying').textContent.includes('No sounds')"), 'Stop All cancels remaining repetitions');
    // Use the actual project pack to exercise first-run population and backup.
    const packFolder = path.join(__dirname, '../soundpack');
    const pack = JSON.parse(fs.readFileSync(path.join(packFolder, 'pack.json')));
    const mediaFolder = path.join(process.env.SFX_DATA_DIR, 'media');
    const productionPads = pack.pads.map((p, i) => {
      fs.copyFileSync(path.join(packFolder, p.file), path.join(mediaFolder, p.file));
      return { ...p, id: `production-${i}`, sound: p.file, image: null };
    });
    await js(`window.api.savePads(${JSON.stringify(productionPads)})`);
    win.webContents.reload(); await sleep(1000);
    check(await js("document.querySelectorAll('.script-cue.unassigned').length===0"), 'all 95 production cues populate with actual pack sounds');
    check(await js("(async()=>{const d=await window.api.loadScript();return d.assignments['p12-c1'][0].repeat===3;})()"), 'production setup replaces trial assignment with three clock strikes');
    check(fs.readdirSync(process.env.SFX_DATA_DIR).some(name => name.startsWith('script-cues.json.backup-')), 'production setup backs up existing assignments');
    await js(`(async()=>{const d=await window.api.loadScript(); d.assignments['p12-c1'][0].repeat=4; await window.api.saveScript(d.assignments);})()`);
    check(await js("(async()=>{const d=await window.api.loadScript();return d.assignments['p12-c1'][0].repeat===4;})()"), 'later user edits survive prepared setup');
    await js("document.querySelector('[data-cue-id=\"p12-c2\"]').scrollIntoView({block:'center'})"); await sleep(100);
    fs.writeFileSync(path.join(__dirname, '../build/script-view-preview.png'), (await win.webContents.capturePage()).toPNG());
    log(`${checks} checks passed. Test data: ${process.env.SFX_DATA_DIR}`);
    finish(0);
  } catch (err) { log(err.stack || String(err)); finish(1); }
});
