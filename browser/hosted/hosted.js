/* Hosted controls. Loaded only by hosted/server.cjs, before the local adapter. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const base = new URL('./', location.href);
  let admin=false, busy=false, shellReady=false, registration;
  const status = text => { $('projectStatus').textContent=text; };
  const button = (id,text,handler) => {
    const el=document.createElement('button'); el.id=id; el.className='btn'; el.type='button'; el.textContent=text;
    el.addEventListener('click',()=>handler().catch(e=>status(e.message))); return el;
  };
  const api = async (name, data) => {
    const res=await fetch(new URL('api/'+name,base),{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(data?120000:10000),
      ...(data ? {method:'POST',headers:{'Content-Type':'application/json','X-Soundboard-Request':'1'},body:JSON.stringify(data)}:{})});
    const result=await res.json();
    if(!res.ok) throw Error(result.error || 'Server request failed.');
    return result;
  };
  const controls=document.querySelector('.project-bar .row');
  const download=button('downloadPerformance','Download latest',async()=>{
    if(busy) return;
    if(document.querySelector('dialog[open]')) throw Error('Save or cancel the open editor first.');
    if(document.querySelector('.playing')) throw Error('Stop playback before downloading an update.');
    const p=window.browserProject?.snapshot();
    const manifest=await api('current');
    if(p?.downloadedVersion===manifest.version) {showStatus(p); return;}
    if(p?.modifiedAt && !confirm('Replace this browser’s edits with the published performance? Export a backup first to keep your edits.')) return;
    busy=true; download.disabled=true;
    try {
      const seed=await getSeed(manifest);
      await window.browserProject.installSeed(seed);
      location.reload();
    } finally {busy=false; download.disabled=false;}
  });
  const publish=button('publishPerformance','Publish performance',async()=>{
    await assertAdmin();
    if(document.querySelector('dialog[open]')) throw Error('Save or cancel the open editor first.');
    if(document.querySelector('.playing')) throw Error('Stop playback before publishing.');
    if(!confirm('Publish this browser’s complete performance for everyone to download?')) return;
    publish.disabled=true;
    try {
      status('Publishing complete performance…');
      const backup=await window.browserProject.createBackup();
      // Download markers belong to a device, not the published project.
      delete backup.project.downloadedVersion; delete backup.project.modifiedAt;
      const result=await api('publish',backup);
      status('Performance published · '+result.version+' · Other computers can choose Download latest');
    } finally {publish.disabled=false;}
  });
  const login=button('adminLogin','Admin login',async()=>{
    if(admin) {await api('logout',{}); admin=false; updateControls(); return;}
    $('adminError').textContent=''; $('adminPassword').value=''; $('adminDialog').showModal();
  });
  controls.prepend(download,publish,login);
  const dialog=document.createElement('dialog'); dialog.id='adminDialog'; dialog.className='editor';
  dialog.innerHTML='<form id="adminForm"><h2>Admin login</h2><label class="field">Password<input id="adminPassword" type="password" autocomplete="current-password" required></label><p id="adminError" class="error" role="alert"></p><div class="actions"><button id="adminCancel" class="btn" type="button">Cancel</button><button class="btn primary" type="submit">Log in</button></div></form>';
  document.body.append(dialog);
  $('adminCancel').onclick=()=>dialog.close();
  $('adminForm').onsubmit=async event=>{
    event.preventDefault();
    try {await api('login',{password:$('adminPassword').value}); $('adminPassword').value=''; admin=true; dialog.close(); updateControls(); if(!window.browserProject?.snapshot()) location.reload();}
    catch(e) {$('adminError').textContent=e.message;}
  };
  function updateControls() {
    const edit=admin && navigator.onLine;
    for(const id of ['editToggle','peopleBtn','importBtn']) $(id).classList.toggle('hidden',!edit);
    publish.classList.toggle('hidden',!edit); login.textContent=admin?'Log out':'Admin login';
    download.disabled=!navigator.onLine || busy;
    if(!edit) window.dispatchEvent(new Event('project-readonly'));
  }
  async function assertAdmin() {
    if(!navigator.onLine) throw Error('Connect to the internet to edit or publish.');
    try {admin=(await api('session')).admin;}
    catch {admin=false;}
    updateControls();
    if(!admin) throw Error('Log in as admin to edit or publish.');
  }
  const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  async function getSeed(manifest) {
    status('Downloading complete performance…');
    const expected=new URL('api/versions/'+manifest.version+'.json',base);
    if(new URL(manifest.url,base).href!==expected.href) throw Error('Invalid performance URL.');
    const response=await fetch(expected,{cache:'no-store',signal:AbortSignal.timeout(120000)});
    if(!response.ok) throw Error('Performance download failed. Previous version retained.');
    const bytes=await response.arrayBuffer();
    if(await digest(bytes)!==manifest.sha256) throw Error('Performance download failed verification. Previous version retained.');
    const backup=JSON.parse(new TextDecoder().decode(bytes));
    if(backup.format!=='larry-soundboard-backup-v1' || !Array.isArray(backup.media)) throw Error('Unsupported performance.');
    const files=backup.media.map(m=>({...m,blob:new Blob([Uint8Array.from(atob(m.base64),c=>c.charCodeAt(0))],{type:m.mime})}));
    const project=backup.project; delete project.modifiedAt; project.downloadedVersion=manifest.version;
    return {project,files};
  }
  function showStatus(p) {
    if(!p?.downloadedVersion) {status(p?.pads.length?'Unpublished draft · Saved in this browser':'No published performance · Admin: import your backup, then publish'); return;}
    status(`${p.title} · Version ${p.downloadedVersion} · ${shellReady?'Ready offline':'App offline storage unavailable'}${p.modifiedAt?' · Local draft changes':''}`);
  }
  const ready=(async()=>{
    updateControls();
    try {admin=(await api('session')).admin;} catch {admin=false;}
    updateControls();
    try {
      if(!isSecureContext || !('serviceWorker' in navigator)) throw Error('HTTPS is required for offline use.');
      registration=await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'});
      await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Offline app download timed out.')),20000))]);
      const names=await caches.keys();
      const resources=['','index.html','styles.css','renderer.js','script-view.js','script-highlights.js','browser-api.js','hosted.js'];
      for(const name of names.filter(name=>name.startsWith('soundboard-shell-'))) {
        const cache=await caches.open(name);
        if((await Promise.all(resources.map(file=>cache.match(new URL(file,base))))).every(Boolean)) {shellReady=true; break;}
      }
    } catch(e) {status('Offline setup: '+e.message);}
  })();
  window.hostedBoard={
    ready, assertAdmin, canEdit:()=>admin && navigator.onLine,
    showStatus,
    async seed() {
      await ready;
      let manifest;
      try {manifest=await api('current');} catch(e) {
        if(admin && navigator.onLine) return {project:{schemaVersion:1,title:'New performance',pads:[],people:[],script:{pages:[]},assignments:{},cues:{},passages:{}},files:[]};
        throw e;
      }
      return getSeed(manifest);
    },
  };
  window.addEventListener('offline',()=>{updateControls(); if(window.browserProject) showStatus(window.browserProject.snapshot());});
  window.addEventListener('online',()=>{updateControls(); if(window.browserProject) showStatus(window.browserProject.snapshot());});
  navigator.storage?.persist?.().catch(()=>{});
})();
