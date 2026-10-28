// Node 22+, built-in modules only. Nginx terminates HTTPS; listen on loopback.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {promisify} = require('node:util');
const {hash, validateBackup} = require('./backup.cjs');
const scrypt = promisify(crypto.scrypt);
const ROOT = path.resolve(__dirname, '../dist');
const DATA = path.resolve(process.env.SB_DATA_DIR || path.join(__dirname, '../server-data'));
const BASE = '/sb/';
const ORIGIN = process.env.SB_ORIGIN || 'https://slidetrip.com';
const LIMIT = 128 * 1024 * 1024;
const shell = ['index.html','styles.css','renderer.js','script-view.js','script-highlights.js','browser-api.js','hosted.js'];
const sessions = new Map(), attempts = new Map();
let publication = Promise.resolve();

async function publish(backup) {
  validateBackup(backup);
  await fs.mkdir(DATA, {recursive:true, mode:0o700});
  const bytes = Buffer.from(JSON.stringify(backup));
  const version = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
  const manifest = {version, sha256:hash(bytes), url:`api/versions/${version}.json`, title:backup.project.title, createdAt:new Date().toISOString()};
  await fs.writeFile(path.join(DATA, version + '.json'), bytes, {flag:'wx', mode:0o600});
  const temp = path.join(DATA, 'current-' + crypto.randomUUID() + '.tmp');
  await fs.writeFile(temp, JSON.stringify(manifest), {mode:0o600});
  await fs.rename(temp, path.join(DATA, 'current.json'));
  return manifest;
}
async function current() {
  try {return JSON.parse(await fs.readFile(path.join(DATA, 'current.json'), 'utf8'));}
  catch(e) {if(e.code==='ENOENT') return null; throw e;}
}
async function body(req, limit=LIMIT) {
  let size=0; const chunks=[];
  for await (const chunk of req) {size+=chunk.length; if(size>limit) throw Object.assign(Error('Upload too large.'),{status:413}); chunks.push(chunk);}
  try {return JSON.parse(Buffer.concat(chunks).toString());} catch {throw Object.assign(Error('Invalid JSON.'),{status:400});}
}
function session(req) {
  const token = /(?:^|;\s*)sb_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  const value = sessions.get(token);
  if (!value || value.expires < Date.now()) {sessions.delete(token); return null;}
  return {token,...value};
}
function send(res,status,value,headers={}) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  res.end(JSON.stringify(value));
}
async function main() {
  const password = process.env.SB_ADMIN_HASH;
  if (!password || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(password)) throw Error('Set SB_ADMIN_HASH using password.cjs before starting.');
  if (process.env.SB_INITIAL_BACKUP && !await current()) await publish(JSON.parse(await fs.readFile(process.env.SB_INITIAL_BACKUP,'utf8')));
  const assets = new Map();
  for (const name of shell) {
    let bytes = await fs.readFile(path.join(name==='hosted.js' ? __dirname : ROOT,name));
    if (name==='index.html') bytes=Buffer.from(bytes.toString()
      .replace('<script src="browser-api.js">','<script src="hosted.js"></script>\n  <script src="browser-api.js">')
      .replaceAll('Browser Preview','Soundboard').replaceAll('Browser preview','Soundboard'));
    assets.set(name,bytes);
  }
  const release = hash(Buffer.concat([...assets.values()])).slice(0,20);
  const worker = (await fs.readFile(path.join(__dirname,'sw.js'),'utf8')).replace('__RELEASE__',release);
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/sb') {res.writeHead(308,{Location:BASE}); return res.end();}
      if(!url.pathname.startsWith(BASE)) return send(res,404,{error:'Not found.'});
      const name=url.pathname.slice(BASE.length);
      if(req.method==='POST') {
        if(req.headers.origin!==ORIGIN || req.headers['x-soundboard-request']!=='1') return send(res,403,{error:'Invalid request origin.'});
        if(name==='api/login') {
          const now=Date.now(), ip=req.socket.remoteAddress;
          for(const [key,a] of attempts) if(a.until<now) attempts.delete(key);
          const attempt=attempts.get(ip) || {count:0,until:now+15*60*1000};
          if(attempt.count>=10) return send(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
          attempt.count++; attempts.set(ip,attempt);
          const input=await body(req,4096);
          const [salt,expected]=password.split(':');
          const actual=await scrypt(typeof input.password==='string' ? input.password : '',salt,64);
          if(!crypto.timingSafeEqual(actual,Buffer.from(expected,'hex'))) return send(res,401,{error:'Incorrect password.'});
          attempts.delete(ip);
          for(const [token,s] of sessions) if(s.expires<now) sessions.delete(token);
          if(sessions.size>=20) sessions.delete(sessions.keys().next().value);
          const token=crypto.randomBytes(32).toString('hex');
          sessions.set(token,{expires:now+8*60*60*1000});
          return send(res,200,{admin:true},{'Set-Cookie':`sb_session=${token}; Path=/sb/; HttpOnly; SameSite=Strict; Max-Age=28800${ORIGIN.startsWith('https:')?'; Secure':''}`});
        }
        const auth=session(req);
        if(!auth) return send(res,401,{error:'Log in as admin first.'});
        if(name==='api/logout') {sessions.delete(auth.token); return send(res,200,{admin:false},{'Set-Cookie':'sb_session=; Path=/sb/; HttpOnly; SameSite=Strict; Max-Age=0'});}
        if(name==='api/publish') {
          const backup=await body(req);
          const task=publication.then(()=>publish(backup)); publication=task.catch(()=>{});
          try {return send(res,200,await task);} catch {return send(res,400,{error:'Backup validation failed. Nothing was published.'});}
        }
        return send(res,404,{error:'Not found.'});
      }
      if(req.method!=='GET' && req.method!=='HEAD') return send(res,405,{error:'Method not allowed.'});
      if(name==='api/session') return send(res,200,{admin:Boolean(session(req))});
      if(name==='api/current') {const m=await current(); return send(res,m?200:404,m || {error:'No performance published yet. Log in to import and publish a backup.'});}
      if(/^api\/versions\/\d+-[a-f0-9]{8}\.json$/.test(name)) {
        const bytes=await fs.readFile(path.join(DATA,path.basename(name)));
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
        return res.end(req.method==='HEAD'?undefined:bytes);
      }
      const file=name===''?'index.html':name;
      if(file==='sw.js') {res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-cache'}); return res.end(req.method==='HEAD'?undefined:worker);}
      if(!assets.has(file)) return send(res,404,{error:'Not found.'});
      const mime=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
      res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:assets.get(file));
    } catch(e) {if(!res.headersSent) send(res,e.status || (e.code==='ENOENT'?404:500),{error:e.status?e.message:'Request failed.'}); else res.end();}
  });
  server.requestTimeout=120000;
  server.listen(Number(process.env.PORT || 8787),'127.0.0.1',()=>console.log('Soundboard listening on 127.0.0.1:'+server.address().port+'/sb/'));
}
if(require.main===module) main().catch(e=>{console.error(e.message); process.exitCode=1;});
module.exports={validateBackup,publish,main};
