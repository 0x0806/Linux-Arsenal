// Differential test: run the same commands in real GNU bash/coreutils and in the simulated shell, compare stdout + exit code.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const LA = require('./load.js');
const WORK = process.env.LA_DIFF_DIR || path.join(require('os').tmpdir(), 'la-bash-diff');
fs.rmSync(WORK, { recursive: true, force: true });
for (const [rel, content] of Object.entries(LA.PRACTICE_FILES)) {
  if (/\.(jpg|png|pdf)$/.test(rel)) continue;
  const p = path.join(WORK, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
const CMDS = require('./bash-cases.js');
let fail = 0, pass = 0;
for (const cmd of CMDS) {
  let real, realCode = 0;
  try {
    real = execFileSync('bash', ['--norc', '--noprofile', '-c', 'export LC_ALL=C; ' + cmd], { cwd: WORK, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, HOME: WORK, LC_ALL: 'C', USER: 'user' } });
  } catch (e) { real = e.stdout || ''; realCode = e.status; }
  const sh = LA.createMachine();
  sh.aliases = Object.create(null);
  sh.exec('export LC_ALL=C; cd ~');
  const res = sh.exec(cmd);
  if (res.stdout === real && res.code === realCode) { pass++; continue; }
  fail++;
  console.log('MISMATCH: ' + cmd + '\n  bash  [' + realCode + ']: ' + JSON.stringify(real.slice(0, 400)) + '\n  arsenal[' + res.code + ']: ' + JSON.stringify(res.stdout.slice(0, 400)) + (res.stderr ? '\n  stderr: ' + JSON.stringify(res.stderr.slice(0, 200)) : ''));
}
console.log('bash differential: ' + pass + ' passed, ' + fail + ' failed of ' + CMDS.length);
process.exit(fail ? 1 : 0);
