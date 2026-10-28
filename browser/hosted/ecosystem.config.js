const path = require('path');
const root = path.resolve(__dirname, '../..');
module.exports = {apps: [{
  name: 'soundboard',
  cwd: root,
  script: path.join(__dirname, 'start.cjs'),
  interpreter: path.join(root, 'runtime', 'bin', 'node'),
  instances: 1,
  exec_mode: 'fork',
  watch: false,
  restart_delay: 3000,
  env: {NODE_ENV: 'production', SB_ORIGIN: 'https://slidetrip.com', PORT: '8787'},
}]};
