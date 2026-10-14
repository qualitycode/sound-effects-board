const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, shell, session, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { sanitizeAction, resolvePresets } = require('./cue-presets');

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const SAMPLES_DIR = path.join(__dirname, 'assets', 'samples');
const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'aif', 'aiff'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
const MAX_RECORDING_BYTES = 50 * 1024 * 1024;
const MAX_VOLUME = 3;

let mainWindow = null;

// Allow tests to point at a throwaway data folder.
if (process.env.SFX_DATA_DIR) app.setPath('userData', process.env.SFX_DATA_DIR);

const dataDir = () => app.getPath('userData');
const mediaDir = () => path.join(dataDir(), 'media');
const padsFile = () => path.join(dataDir(), 'pads.json');

function ensureDirs() {
  fs.mkdirSync(mediaDir(), { recursive: true });
}

function cleanString(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function cleanFileName(value) {
  if (typeof value !== 'string' || !value) return null;
  return path.basename(value);
}

function sanitizePad(p) {
  const volume = Number(p && p.volume);
  const key = cleanString(p && p.key, 1).toUpperCase();
  return {
    id: cleanString(p && p.id, 64) || crypto.randomUUID(),
    label: cleanString(p && p.label, 100),
    sound: cleanFileName(p && p.sound),
    image: cleanFileName(p && p.image),
    volume: Number.isFinite(volume) ? Math.min(MAX_VOLUME, Math.max(0, volume)) : 1,
    loop: Boolean(p && p.loop),
    key: key.trim(),
  };
}

function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function seedSamples() {
  const samples = [
    { file: 'doorbell.wav', label: 'Doorbell', key: '1', loop: false },
    { file: 'knock.wav', label: 'Knock Knock', key: '2', loop: false },
    { file: 'beep.wav', label: 'Beep', key: '3', loop: false },
    { file: 'wind.wav', label: 'Wind (loops)', key: '4', loop: true },
  ];
  const pads = [];
  for (const s of samples) {
    const src = path.join(SAMPLES_DIR, s.file);
    if (!fs.existsSync(src)) continue;
    const stored = `${crypto.randomUUID()}${path.extname(s.file)}`;
    fs.copyFileSync(src, path.join(mediaDir(), stored));
    pads.push(sanitizePad({ label: s.label, sound: stored, volume: 0.8, loop: s.loop, key: s.key }));
  }
  return pads;
}

// Remove copied media that no pad refers to anymore (replaced/deleted/cancelled picks).
function cleanupMedia(pads) {
  const used = new Set();
  for (const p of pads) {
    if (p.sound) used.add(p.sound);
    if (p.image) used.add(p.image);
  }
  for (const name of fs.readdirSync(mediaDir())) {
    if (!used.has(name)) {
      try { fs.unlinkSync(path.join(mediaDir(), name)); } catch { /* ignore */ }
    }
  }
}

function loadPads() {
  ensureDirs();
  if (!fs.existsSync(padsFile())) {
    const pads = seedSamples();
    writeJsonAtomic(padsFile(), { pads });
    return pads;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(padsFile(), 'utf8'));
    const pads = (Array.isArray(raw.pads) ? raw.pads : []).map(sanitizePad);
    cleanupMedia(pads);
    return pads;
  } catch (err) {
    // Keep the unreadable file for recovery instead of silently overwriting it.
    try { fs.copyFileSync(padsFile(), `${padsFile()}.corrupt-${Date.now()}`); } catch { /* ignore */ }
    return [];
  }
}

function registerIpc() {
  ipcMain.handle('script:load', () => {
    const saved = path.join(dataDir(), 'script.json');
    const bundled = path.join(__dirname, 'assets/playScript/script.json');
    const source = fs.existsSync(saved) ? saved : bundled;
    const script = fs.existsSync(source) ? JSON.parse(fs.readFileSync(source, 'utf8')) : { title: 'No play script loaded', pages: [] };
    const file = path.join(dataDir(), 'script-cues.json');
    let assignments = {};
    if (fs.existsSync(file)) assignments = JSON.parse(fs.readFileSync(file, 'utf8'));
    const pads = loadPads();
    const setupFile = path.join(dataDir(), 'script-cue-preset.json');
    const setup = fs.existsSync(setupFile) ? JSON.parse(fs.readFileSync(setupFile, 'utf8')) : {};
    if (script.presetVersion && setup.version !== script.presetVersion) {
      const prepared = resolvePresets(script, pads);
      const complete = Object.keys(prepared).length > 0 && Object.values(prepared).every(actions => actions.length && actions.every(a => pads.some(p => p.id === a.padId && p.sound)));
      if (complete) {
        if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.backup-${Date.now()}`);
        assignments = prepared;
        writeJsonAtomic(file, assignments);
        writeJsonAtomic(setupFile, { version: script.presetVersion });
      }
    }
    return { ...script, assignments: resolvePresets(script, pads, assignments) };
  });
  ipcMain.handle('script:save', (_e, assignments) => {
    if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) throw new Error('Invalid cues');
    const clean = {};
    for (const [id, actions] of Object.entries(assignments)) {
      if (!/^p\d+-c\d+$/.test(id) || !Array.isArray(actions)) continue;
      clean[id] = actions.slice(0, 50).map(sanitizeAction);
    }
    ensureDirs();
    writeJsonAtomic(path.join(dataDir(), 'script-cues.json'), clean);
    return clean;
  });
  ipcMain.handle('pads:load', () => loadPads());

  ipcMain.handle('pads:save', (_e, pads) => {
    if (!Array.isArray(pads)) throw new Error('Invalid pads');
    const clean = pads.map(sanitizePad);
    ensureDirs();
    writeJsonAtomic(padsFile(), { pads: clean });
    cleanupMedia(clean);
    return clean;
  });

  ipcMain.handle('media:pick', async (_e, kind) => {
    const isImage = kind === 'image';
    const result = await dialog.showOpenDialog(mainWindow, {
      title: isImage ? 'Choose a picture' : 'Choose a sound effect',
      properties: ['openFile'],
      filters: [
        isImage
          ? { name: 'Images', extensions: IMAGE_EXTS }
          : { name: 'Audio', extensions: AUDIO_EXTS },
      ],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const src = result.filePaths[0];
    ensureDirs();
    const stored = `${crypto.randomUUID()}${path.extname(src).toLowerCase()}`;
    fs.copyFileSync(src, path.join(mediaDir(), stored));
    return { file: stored, original: path.basename(src) };
  });

  ipcMain.handle('media:saveRecording', (_e, data) => {
    const bytes = Buffer.from(data);
    if (bytes.length < 44 || bytes.length > MAX_RECORDING_BYTES || bytes.toString('ascii', 0, 4) !== 'RIFF') {
      throw new Error('Invalid recording');
    }
    ensureDirs();
    const stored = `${crypto.randomUUID()}.wav`;
    fs.writeFileSync(path.join(mediaDir(), stored), bytes);
    return { file: stored };
  });

  // On a Mac the system asks the user once; Windows/Linux need no extra step here.
  ipcMain.handle('mic:request', async () => {
    if (process.platform !== 'darwin') return { ok: true };
    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'granted') return { ok: true };
    if (status === 'denied' || status === 'restricted') return { ok: false };
    return { ok: await systemPreferences.askForMediaAccess('microphone') };
  });

  ipcMain.handle('app:showDataFolder', () => shell.openPath(dataDir()));
}

function registerMicPermission() {
  const isAudioOnly = (details) => !details || !details.mediaTypes || details.mediaTypes.every((t) => t === 'audio');
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(permission === 'media' && isAudioOnly(details));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission) => permission === 'media');
}

function registerMediaProtocol() {
  protocol.handle('media', async (request) => {
    const name = path.basename(decodeURIComponent(new URL(request.url).pathname));
    const file = path.join(mediaDir(), name);
    if (!name || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
    const upstream = await net.fetch(pathToFileURL(file).toString(), { headers: request.headers });
    // The page is a file:// origin, so Web Audio needs explicit permission to read these sounds.
    const headers = new Headers(upstream.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  });
}

// ---------- Sound packs (a folder with pack.json + sound/picture files) ----------

const PACK_FILE = 'pack.json';

function slugify(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sound';
}

// A zip often unpacks to a folder inside a folder, so look one level down too.
function findPackFolder(folder) {
  if (fs.existsSync(path.join(folder, PACK_FILE))) return folder;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory() && fs.existsSync(path.join(folder, entry.name, PACK_FILE))) {
      return path.join(folder, entry.name);
    }
  }
  return null;
}

function copyFromPack(folder, name, exts) {
  if (typeof name !== 'string' || !name) return null;
  const base = path.basename(name);
  const ext = path.extname(base).slice(1).toLowerCase();
  const src = path.join(folder, base);
  if (!exts.includes(ext) || !fs.existsSync(src) || !fs.statSync(src).isFile()) return null;
  const stored = `${crypto.randomUUID()}.${ext}`;
  fs.copyFileSync(src, path.join(mediaDir(), stored));
  return stored;
}

function importPack(selected) {
  const folder = findPackFolder(selected);
  if (!folder) throw new Error(`That folder does not contain a ${PACK_FILE} file. Choose the folder that has ${PACK_FILE} inside it.`);
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(path.join(folder, PACK_FILE), 'utf8')).pads;
  } catch {
    throw new Error(`${PACK_FILE} could not be read.`);
  }
  if (!Array.isArray(entries)) throw new Error(`${PACK_FILE} does not contain a list of sounds.`);

  const pads = loadPads();
  const labels = new Set(pads.map((p) => p.label.toLowerCase()));
  const usedKeys = new Set(pads.map((p) => p.key).filter(Boolean));
  const result = { added: 0, duplicates: 0, invalid: 0, keysCleared: 0 };

  for (const e of entries) {
    const label = cleanString(e && e.label, 100).trim();
    if (!label) { result.invalid++; continue; }
    if (labels.has(label.toLowerCase())) { result.duplicates++; continue; }
    const sound = copyFromPack(folder, e.file, AUDIO_EXTS);
    if (!sound) { result.invalid++; continue; }
    const image = copyFromPack(folder, e.image, IMAGE_EXTS);
    let key = cleanString(e.key, 1).toUpperCase().trim();
    if (key && usedKeys.has(key)) { key = ''; result.keysCleared++; }
    if (key) usedKeys.add(key);
    labels.add(label.toLowerCase());
    pads.push(sanitizePad({ label, sound, image, volume: e.volume, loop: e.loop, key }));
    result.added++;
  }

  writeJsonAtomic(padsFile(), { pads });
  return { ...result, pads };
}

function exportPack(parentFolder) {
  const pads = loadPads();
  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `Sound Effects Board Pack ${stamp}`;
  let folder = path.join(parentFolder, baseName);
  for (let n = 2; fs.existsSync(folder); n++) folder = path.join(parentFolder, `${baseName} (${n})`);
  fs.mkdirSync(folder);

  const taken = new Set([PACK_FILE]);
  const copyOut = (stored, label) => {
    if (!stored) return null;
    const src = path.join(mediaDir(), stored);
    if (!fs.existsSync(src)) return null;
    const ext = path.extname(stored);
    let name = `${slugify(label)}${ext}`;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${slugify(label)}-${n}${ext}`;
    taken.add(name.toLowerCase());
    fs.copyFileSync(src, path.join(folder, name));
    return name;
  };

  const out = [];
  let skipped = 0;
  for (const p of pads) {
    const file = copyOut(p.sound, p.label);
    if (!file) { skipped++; continue; }
    const entry = { label: p.label, file, volume: p.volume, loop: p.loop, key: p.key };
    const image = copyOut(p.image, `${p.label} picture`);
    if (image) entry.image = image;
    out.push(entry);
  }
  writeJsonAtomic(path.join(folder, PACK_FILE), { pads: out });
  return { folder, count: out.length, skipped };
}

async function importPackFromMenu() {
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose the sound pack folder',
    message: `Choose the folder that contains ${PACK_FILE}`,
    properties: ['openDirectory'],
  });
  if (picked.canceled || !picked.filePaths.length) return;
  try {
    const r = importPack(picked.filePaths[0]);
    if (mainWindow) mainWindow.webContents.send('pads:replaced', r.pads);
    const notes = [];
    if (r.duplicates) notes.push(`${r.duplicates} already on your board (skipped)`);
    if (r.invalid) notes.push(`${r.invalid} could not be read (skipped)`);
    if (r.keysCleared) notes.push(`${r.keysCleared} keyboard shortcut(s) were already in use and were left blank`);
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: r.added ? `Added ${r.added} sound${r.added === 1 ? '' : 's'} to your board.` : 'No new sounds were added.',
      detail: notes.join('\n'),
    });
  } catch (err) {
    await dialog.showMessageBox(mainWindow, { type: 'error', message: 'Could not import the sound pack.', detail: err.message });
  }
}

async function exportPackFromMenu() {
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose where to save the sound pack',
    message: 'A new folder with your sounds will be created inside the folder you choose',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (picked.canceled || !picked.filePaths.length) return;
  try {
    const r = exportPack(picked.filePaths[0]);
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: `Saved ${r.count} sound${r.count === 1 ? '' : 's'}.`,
      detail: `${r.folder}${r.skipped ? `\n\n${r.skipped} pad(s) had no sound file and were left out.` : ''}`,
    });
    shell.showItemInFolder(path.join(r.folder, PACK_FILE));
  } catch (err) {
    await dialog.showMessageBox(mainWindow, { type: 'error', message: 'Could not save the sound pack.', detail: err.message });
  }
}

async function importScriptFromMenu() {
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: 'Import a prepared play script', properties: ['openFile'],
    filters: [{ name: 'Prepared script', extensions: ['json'] }],
  });
  if (picked.canceled || !picked.filePaths.length) return;
  try {
    const source = JSON.parse(fs.readFileSync(picked.filePaths[0], 'utf8'));
    if (!Array.isArray(source.pages) || !source.pages.length || source.pages.length > 500) throw new Error('Choose a prepared script.json file, not a sound pack or cue assignments file.');
    const ids = new Set();
    const pageNumbers = new Set();
    const pages = source.pages.map(p => {
      if (!Number.isInteger(p.page) || p.page < 1 || pageNumbers.has(p.page) || !Array.isArray(p.blocks)) throw new Error('Invalid script page.');
      pageNumbers.add(p.page);
      return { page: p.page, blocks: p.blocks.map(b => {
        if (typeof b.text === 'string') return { text: cleanString(b.text, 100000) };
        if (!/^p\d+-c\d+$/.test(b.id) || ids.has(b.id) || typeof b.cue !== 'string') throw new Error('Invalid or duplicate script cue.');
        ids.add(b.id); return { id: b.id, cue: cleanString(b.cue, 5000), note: cleanString(b.note, 5000),
          defaults: Array.isArray(b.defaults) ? b.defaults.slice(0, 50).map(a => ({
            ...sanitizeAction(a), label: cleanString(a && a.label, 100),
          })) : [],
        };
      }) };
    });
    ensureDirs();
    const current = path.join(dataDir(), 'script.json');
    const cues = path.join(dataDir(), 'script-cues.json');
    // Preserve the previous script and assignments for recovery when replacing a play.
    const stamp = Date.now();
    for (const file of [current, cues]) if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.backup-${stamp}`);
    writeJsonAtomic(current, { title: cleanString(source.title, 200), presetVersion: cleanString(source.presetVersion, 100), pages });
    writeJsonAtomic(cues, {});
    mainWindow.webContents.send('script:replaced');
  } catch (err) {
    await dialog.showMessageBox(mainWindow, { type: 'error', message: 'Could not import the script.', detail: err.message });
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { id: 'importPack', label: 'Import Sound Pack…', click: importPackFromMenu },
        { id: 'exportPack', label: 'Export Board as Sound Pack…', click: exportPackFromMenu },
        { label: 'Import Play Script…', click: importScriptFromMenu },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'reload' }, { role: 'toggleDevTools' }]),
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        { label: 'Show Saved Sounds Folder', click: () => shell.openPath(dataDir()) },
        ...(isMac
          ? [{
              label: 'Open Microphone Privacy Settings',
              click: () => shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'),
            }]
          : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 520,
    minHeight: 400,
    backgroundColor: '#14161c',
    title: 'Sound Effects Board',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAboutPanelOptions({
      applicationName: 'Sound Effects Board',
      applicationVersion: app.getVersion(),
      copyright: 'Created by Larry Maddocks',
    });
    registerIpc();
    registerMediaProtocol();
    registerMicPermission();
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
