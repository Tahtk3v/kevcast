// Settings for the desktop apps.
// Lookup order (first one wins for each key):
//   1. command line  --server=http://host:8080
//   2. environment   KEVCAST_SERVER
//   3. machine-wide file deployed by IT (player.json / studio.json):
//        Windows  C:\ProgramData\KevCast\
//        macOS    /Library/Application Support/KevCast/
//        Linux    /etc/kevcast/
//   4. the user's own settings (saved by the "connect to server" screen)
const fs = require('fs');
const path = require('path');

function machineDir() {
  if (process.platform === 'win32') return path.join(process.env.ProgramData || 'C:\\ProgramData', 'KevCast');
  if (process.platform === 'darwin') return '/Library/Application Support/KevCast';
  return '/etc/kevcast';
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function createConfig(app, kind) {
  const userFile = path.join(app.getPath('userData'), 'config.json');
  const machineFile = path.join(machineDir(), `${kind}.json`);
  const cli = {};
  for (const arg of process.argv) {
    const m = arg.match(/^--server=(.+)$/);
    if (m) cli.server = m[1];
  }
  if (process.env.KEVCAST_SERVER) cli.server = cli.server || process.env.KEVCAST_SERVER;

  function load() {
    const machine = readJson(machineFile);
    const user = readJson(userFile);
    return { ...user, ...machine, ...cli, managed: !!(machine.server || cli.server) };
  }
  function save(patch) {
    const user = { ...readJson(userFile), ...patch };
    fs.mkdirSync(path.dirname(userFile), { recursive: true });
    fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
    return load();
  }
  return { load, save, userFile, machineFile };
}

module.exports = { createConfig };
