// Read from a terminal without echoing; store only the resulting salted hash.
const crypto = require('node:crypto');
const {promisify} = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const configFile = path.join(os.homedir(), '.config', 'soundboard', 'admin.json');
async function main() {
  if (process.argv.includes('--save') && fs.existsSync(configFile)) throw Error('Admin configuration already exists at '+configFile+'. Keep it to retain your password.');
  if(!process.stdin.isTTY) throw Error('Run this in an interactive terminal.');
  process.stdout.write('New admin password (at least 12 characters): ');
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  let password='';
  process.stdin.on('data', async data=>{
    if(data.includes('\u0003')) {process.stdin.setRawMode(false); process.exit(1);}
    if(data.includes('\r') || data.includes('\n')) {
      process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');
      if(password.length<12) {console.error('Use at least 12 characters.'); process.exitCode=1; return;}
      const salt=crypto.randomBytes(16).toString('hex');
      const result=await promisify(crypto.scrypt)(password,salt,64);
      const value = salt+':'+result.toString('hex');
      if (process.argv.includes('--save')) {
        fs.mkdirSync(path.dirname(configFile), {recursive:true, mode:0o700});
        fs.writeFileSync(configFile, JSON.stringify({adminHash:value}, null, 2)+'\n', {flag:'wx', mode:0o600});
        console.log('Admin password saved securely. No password or hash needs to be pasted into chat.');
      } else console.log('SB_ADMIN_HASH='+value);
      return;
    }
    if(data==='\u007f' || data==='\b') password=password.slice(0,-1);
    else password+=data;
  });
}
main().catch(e=>{console.error(e.message); process.exitCode=1;});
