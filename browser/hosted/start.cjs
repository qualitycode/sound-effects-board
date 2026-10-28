// Private credentials live outside both the public site and the application bundle.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
try {
  const file = process.env.SB_CONFIG_FILE || path.join(os.homedir(), '.config', 'soundboard', 'admin.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(config.adminHash)) throw Error('Invalid admin configuration.');
  process.env.SB_ADMIN_HASH = config.adminHash;
  process.env.SB_DATA_DIR ||= path.join(os.homedir(), '.local', 'share', 'soundboard');
  require('./server.cjs').main().catch(error => {console.error(error.message); process.exitCode=1;});
} catch (error) {
  console.error(error.code==='ENOENT' ? 'Set your password first: runtime/bin/node browser/hosted/password.cjs --save' : error.message);
  process.exitCode=1;
}
