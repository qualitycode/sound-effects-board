// Small CDP adapter for the integration test. Uses installed Chrome and a temporary profile.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
let child, socket, browserSocket, counter = 0;
const pending = new Map();
const downloads = new Map();
const session = new EventEmitter();
const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soundboard-chrome-download-'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'soundboard-chrome-profile-'));
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const task = pending.get(message.id);
        if (!task) return;
        pending.delete(message.id);
        message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
      } else {
        if (message.method === 'Page.loadEventFired') win.webContents.emit('did-finish-load');
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') win.webContents.emit('console-message', null, { level: 'error', message: message.params.args.map(a => a.value || a.description).join(' ') });
        if (message.method === 'Runtime.exceptionThrown') win.webContents.emit('console-message', null, { level: 'error', message: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text });
        if (message.method === 'Browser.downloadWillBegin') {
          const item = new EventEmitter();
          item.setSavePath = filename => { item.filename = filename; };
          downloads.set(message.params.guid, item);
          session.emit('will-download', null, item);
        }
        if (message.method === 'Browser.downloadProgress' && message.params.state !== 'inProgress') {
          const item = downloads.get(message.params.guid);
          if (item) {
            if (message.params.state === 'completed' && item.filename) fs.renameSync(path.join(downloadDir, message.params.guid), item.filename);
            item.emit('done', null, message.params.state);
            downloads.delete(message.params.guid);
          }
        }
      }
    });
  });
}
function send(method, params = {}, ws = socket) {
  return new Promise((resolve, reject) => {
    const id = ++counter; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
}
let win;
const app = {
  setPath() {},
  async whenReady() {
    const port = 19327;
    const binary = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    child = spawn(binary, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let startupError = '';
    child.stderr.on('data', data => { startupError += data.toString(); });
    child.on('error', err => { startupError += err.message; });
    let metadata;
    for (let i = 0; i < 100; i++) {
      try { metadata = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) })).json(); break; }
      catch { await new Promise(r => setTimeout(r, 100)); }
    }
    if (!metadata) throw new Error('Chrome debugging endpoint did not start. ' + startupError);
    browserSocket = await connect(metadata.webSocketDebuggerUrl);
    await send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloadDir, eventsEnabled: true }, browserSocket);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    socket = await connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  },
  exit(code) {
    const close = browserSocket ? send('Browser.close', {}, browserSocket).catch(() => {}) : Promise.resolve();
    close.finally(() => { child?.kill(); process.exit(code); });
    setTimeout(() => { child?.kill(); process.exit(code); }, 1000);
  },
};
class BrowserWindow {
  constructor() {
    win = this;
    this.webContents = new EventEmitter(); this.webContents.session = session;
    this.webContents.executeJavaScript = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    this.webContents.capturePage = async () => {
      const result = await send('Page.captureScreenshot', { format: 'png' });
      return { toPNG: () => Buffer.from(result.data, 'base64') };
    };
    this.webContents.setOffline = async offline => {
      await send('Network.enable');
      await send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    };
    this.webContents.clearTestStorage = async origin => {
      await send('Storage.clearDataForOrigin', { origin, storageTypes: 'indexeddb,local_storage,service_workers,cache_storage' });
    };
  }
  async loadURL(url) {
    const done = new Promise(resolve => this.webContents.once('did-finish-load', resolve));
    await send('Page.navigate', { url }); await done;
  }
}
module.exports = { app, BrowserWindow };
