const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const SAMPLES_DIR = path.join(__dirname, 'assets', 'samples');
const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'aif', 'aiff'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];

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
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
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

  ipcMain.handle('app:showDataFolder', () => shell.openPath(dataDir()));
}

function registerMediaProtocol() {
  protocol.handle('media', (request) => {
    const name = path.basename(decodeURIComponent(new URL(request.url).pathname));
    const file = path.join(mediaDir(), name);
    if (!name || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString(), { headers: request.headers });
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
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
    registerIpc();
    registerMediaProtocol();
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
