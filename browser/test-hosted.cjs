// Electron Node mode, installed Chrome, no npm install or live server required.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {app,BrowserWindow}=require('./chrome-test-driver.cjs');
const {validateBackup}=require('./hosted/backup.cjs');
const dir=path.join(__dirname,'test-results','hosted-'+crypto.randomUUID());
fs.mkdirSync(dir,{recursive:true});
const logFile=path.join(__dirname,'test-results','hosted.log'); fs.writeFileSync(logFile,'');
const log=line=>fs.appendFileSync(logFile,line+'\n');
const check=(ok,message)=>{assert.ok(ok,message);log('PASS '+message);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const origin='http://127.0.0.1:18787', base=origin+'/sb/';
const salt=crypto.randomBytes(16).toString('hex'), password='local-test-password-only';
const passwordHash=salt+':'+crypto.scryptSync(password,salt,64).toString('hex');
const wav=Buffer.alloc(1644);
wav.write('RIFF');wav.writeUInt32LE(1636,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);
wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(1600,40);
for(let i=0;i<800;i++) wav.writeInt16LE(Math.sin(i/8)*1000,44+i*2);
const fixture={format:'larry-soundboard-backup-v1',project:{schemaVersion:1,title:'Offline test performance',
  pads:[{id:'pulse',label:'Test Pulse',sound:'pulse.wav',volume:1,key:'P',loop:true}],
  people:[{id:'reader',name:'Test Reader',color:'#d5de78'}],passages:{},
  script:{pages:[{page:1,blocks:[{id:'line',text:'A rehearsal line.'},{id:'cue',cue:'Start pulse'}]}]},
  cues:{cue:{name:'Pulse cue',key:'!',personId:'reader',volume:.8}},
  assignments:{cue:[{padId:'pulse',action:'loop',delay:0,repeat:1,volume:.5}]}},
  media:[{name:'pulse.wav',mime:'audio/wav',sha256:crypto.createHash('sha256').update(wav).digest('hex'),base64:wav.toString('base64')}]};
validateBackup(fixture);
const seed=path.join(dir,'initial.json');fs.writeFileSync(seed,JSON.stringify(fixture));
const configFile=path.join(dir,'admin.json');fs.writeFileSync(configFile,JSON.stringify({adminHash:passwordHash}),{mode:0o600});
let server,win;
const finish=code=>{clearTimeout(watchdog);server?.kill();app.exit(code);};
const watchdog=setTimeout(()=>{log('FAIL timeout');finish(1)},120000);
process.on('uncaughtException',e=>{log(e.stack);finish(1)});
async function request(name,data,cookie,withOrigin=true) {
  return fetch(base+'api/'+name,{...(data?{method:'POST',body:JSON.stringify(data)}:{}),
    headers:{'Content-Type':'application/json',...(withOrigin?{Origin:origin,'X-Soundboard-Request':'1'}:{}),...(cookie?{Cookie:cookie}:{})}});
}
async function loaded() {
  await win.webContents.executeJavaScript('window.browserProject.ready');
  for(let i=0;i<100 && !await win.webContents.executeJavaScript("!!document.querySelector('.script-cue')");i++) await pause(50);
}
(async()=>{
  server=spawn(process.execPath,[path.join(__dirname,'hosted/start.cjs')],{
    env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PORT:'18787',SB_ORIGIN:origin,SB_CONFIG_FILE:configFile,
      SB_DATA_DIR:path.join(dir,'data'),SB_INITIAL_BACKUP:seed},windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stderr.on('data',d=>log('SERVER '+d));
  let started=false;
  for(let i=0;i<100;i++){try{if((await fetch(base+'api/current')).ok){started=true;break;}}catch{}await pause(50);}
  check(started,'isolated hosted server starts and seeds a complete backup');
  const initial=await (await request('current')).json();
  check((await request('publish',fixture)).status===401,'server rejects publishing without admin login');
  check((await request('login',{password},null,false)).status===403,'server rejects login without same-origin request protection');
  check((await request('login',{password:'wrong'})).status===401,'incorrect admin password rejected');
  const response=await request('login',{password});
  const cookie=response.headers.get('set-cookie')?.split(';')[0];
  check(response.ok && !!cookie && response.headers.get('set-cookie').includes('HttpOnly'),'login sets an HttpOnly scoped session cookie');
  check((await request('local-project/project.json')).status===404,'private snapshot is not exposed as a hosted API');
  check((await fetch(base+'local-project/project.json')).status===404,'local prototype files are not publicly served');
  const damaged=structuredClone(fixture);damaged.media[0].sha256='bad';
  check((await request('publish',damaged,cookie)).status===400,'damaged media cannot be published');
  check((await (await request('current')).json()).version===initial.version,'rejected publication keeps current complete version');
  await app.whenReady();win=new BrowserWindow();
  const js=code=>win.webContents.executeJavaScript(code);
  await win.loadURL(base);await loaded();
  check(await js("document.getElementById('projectStatus').textContent.includes('Ready offline') && window.browserProject.snapshot().downloadedVersion"),'first visit verifies media and app before Ready offline');
  check(await js("document.getElementById('editToggle').classList.contains('hidden') && document.getElementById('importBtn').classList.contains('hidden')"),'anonymous playback hides admin editing and import controls');
  check(await js("window.api.savePads([]).then(()=>false,()=>true)"),'local project adapter rejects anonymous edits');
  await js("document.getElementById('scriptView').click(); document.querySelector('.script-cue').click()");
  await pause(150);
  check(await js("!!document.querySelector('#board .playing')"),'downloaded media plays in real browser audio engine');
  await js("document.getElementById('stopAll').click()");
  await win.webContents.setOffline(true);await win.loadURL(base);await loaded();
  check(await js("document.querySelectorAll('#board .pad').length===1 && document.getElementById('projectStatus').textContent.includes('Ready offline')"),'closed-page navigation reopens complete app and performance with network disabled');
  await js("document.querySelector('#board .pad').click()");await pause(150);
  check(await js("!!document.querySelector('#board .playing')"),'audio plays with network disabled');
  await js("document.getElementById('stopAll').click()");
  await win.webContents.setOffline(false);
  const next=structuredClone(fixture);next.project.title='Published version two';
  const v2=await (await request('publish',next,cookie)).json();
  await win.loadURL(base);await loaded();
  check(await js(`window.browserProject.snapshot().downloadedVersion===${JSON.stringify(initial.version)}`),'revisiting online retains installed performance without auto-update');
  // Simulate a corrupt download by altering the pointer's expected digest.
  const pointer=path.join(dir,'data','current.json');
  const realPointer=fs.readFileSync(pointer,'utf8');const bad=JSON.parse(realPointer);bad.sha256='bad';fs.writeFileSync(pointer,JSON.stringify(bad));
  await js("document.getElementById('downloadPerformance').click()");await pause(500);
  check(await js(`window.browserProject.snapshot().downloadedVersion===${JSON.stringify(initial.version)} && document.getElementById('projectStatus').textContent.includes('failed verification')`),'corrupt download retains previous installed project');
  fs.writeFileSync(pointer,realPointer);
  const navigated=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
  await js("document.getElementById('downloadPerformance').click()");await navigated;await loaded();
  check(await js(`window.browserProject.snapshot().downloadedVersion===${JSON.stringify(v2.version)} && window.browserProject.snapshot().title==='Published version two'`),'deliberate verified update replaces the entire performance');
  await js(`document.getElementById('adminLogin').click();document.getElementById('adminPassword').value=${JSON.stringify(password)};document.getElementById('adminForm').requestSubmit()`);
  await pause(300);
  check(await js("!document.getElementById('editToggle').classList.contains('hidden')"),'admin login enables editing');
  await js("window.browserProject.savePassage('line',{text:'Edited draft online',note:'Rehearse this',color:'#fff0a8'})");
  await js("window.browserProject.applyHighlights([{id:'line',text:'Edited draft online',start:0,end:6},{id:'cue',blank:true}], '3')");
  await js("window.confirm=()=>true;document.getElementById('publishPerformance').click()");await pause(500);
  const published=await (await request('current')).json();
  const publishedBackup=await (await fetch(new URL(published.url,base))).json();
  check(publishedBackup.project.passages.line.text==='Edited draft online','admin Publish saves complete edited backup to server');
  check(publishedBackup.project.passages.line.highlights[0].color==='3' && publishedBackup.project.passages.cue.blankColor==='3','published backup includes text and blank-line highlights');
  await js("document.getElementById('adminLogin').click()");await pause(200);
  check(await js("document.getElementById('editToggle').classList.contains('hidden')"),'logout removes editing controls');
  await request('logout',{},cookie);
  check((await request('publish',fixture,cookie)).status===401,'server invalidates logged-out session');
  await win.webContents.setOffline(true);await win.loadURL(base);await loaded();
  check(await js("window.browserProject.snapshot().passages.line.text==='Edited draft online' && document.getElementById('editToggle').classList.contains('hidden')"),'saved draft survives offline reload while editing remains locked');
  check(await js("document.querySelector('[data-highlight-id=line] mark').textContent==='Edited' && window.browserProject.getPassage('cue').blankColor==='3'"),'published text and blank highlights render offline');
  fs.writeFileSync(path.join(dir,'offline-preview.png'),(await win.webContents.capturePage()).toPNG());
  // Exercise first installation before an admin has published anything.
  await win.webContents.setOffline(false);
  await win.loadURL('about:blank');
  await win.webContents.clearTestStorage(origin);
  fs.renameSync(pointer,pointer+'.test-retained');
  await win.loadURL(base);
  await js('window.browserProject.ready.catch(()=>null)');
  const loginReload=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
  await js(`document.getElementById('adminLogin').click();document.getElementById('adminPassword').value=${JSON.stringify(password)};document.getElementById('adminForm').requestSubmit()`);
  await loginReload;await js('window.browserProject.ready');
  check(await js("window.browserProject.snapshot().pads.length===0 && !document.getElementById('importBtn').disabled"),'first-ever admin login can initialize an empty site without a seed');
  await js(`(() => {
    window.confirm=()=>true;
    const originalClick=HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click=function(){
      if(this.type!=='file') return originalClick.call(this);
      HTMLInputElement.prototype.click=originalClick;
      const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(fixture))}],'backup.json',{type:'application/json'}));
      this.files=transfer.files;this.dispatchEvent(new Event('change'));
    };
    document.getElementById('importBtn').click();
  })()`);
  for(let i=0;i<100 && !await js("window.browserProject.snapshot()?.pads.length===1");i++) await pause(50);
  await loaded();
  check(await js("window.browserProject.snapshot().pads.length===1 && !window.browserProject.snapshot().downloadedVersion"),'admin can import the first real performance backup into an empty site');
  await js("window.confirm=()=>true;document.getElementById('publishPerformance').click()");await pause(300);
  check((await request('current')).ok,'first imported performance can be published');
  log('ALL CHECKS PASSED');finish(0);
})().catch(e=>{log('FAIL '+e.stack);finish(1)});
