// End-to-end test in headless Chromium via the DevTools protocol (no dependencies).
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const SHOTS = process.env.LA_SHOTS || path.join(os.tmpdir(), 'la-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const CHROME = process.env.CHROME || ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'la-chrome-'));
const proc = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=1400,950', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const errors = [];
function send(method, params) {
  return new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function key(k, mods) {
  const map = { Enter: [13, '\r'], Tab: [9, ''], Escape: [27, ''], Backspace: [8, ''], ArrowUp: [38, ''], ArrowDown: [40, ''] };
  const [code, text] = map[k] || [k.toUpperCase().charCodeAt(0), ''];
  const modifiers = mods || 0;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, windowsVirtualKeyCode: code, modifiers, text: modifiers ? '' : text });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, windowsVirtualKeyCode: code, modifiers });
}
async function type(text) { await send('Input.insertText', { text }); }
async function run(cmd) { await type(cmd); await key('Enter'); await sleep(60); }
async function termText(sel) { return evaluate(`document.querySelector(${JSON.stringify(sel || '#terminal-host')}).innerText`); }
async function shot(name) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64')); }
const results = [];
function check(name, ok, info) { results.push([name, ok]); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + String(info || '').slice(0, 300))); }

(async () => {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); if (targets.length) break; } catch (e) { /* retry */ } await sleep(200); }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon|fonts\.g|cdnjs|ERR_INTERNET|ERR_NAME/.test(m.params.entry.text + m.params.entry.url)) errors.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  });
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Page.navigate', { url });
  for (let i = 0; i < 100; i++) { await sleep(100); if (await evaluate('!!(window.linuxArsenal && !document.getElementById("main-app").classList.contains("hidden"))')) break; }
  check('app boots', await evaluate('!!window.linuxArsenal'));
  check('1000+ challenges', (await evaluate('window.linuxArsenal.challenges.length')) >= 1000, await evaluate('window.linuxArsenal.challenges.length'));
  await shot('01-dashboard');

  // terminal
  await evaluate('document.querySelector(\'[data-section="terminal"]\').click()');
  await sleep(200);
  await evaluate('window.linuxArsenal.terminal.focus()');
  await run('echo "hello from e2e" | tr a-z A-Z');
  check('echo | tr', (await termText()).includes('HELLO FROM E2E'));
  await run('ls');
  check('ls lists home', /documents/.test(await termText()));
  await run('cd documents && pwd');
  check('cd + pwd', (await termText()).includes('/home/user/documents'));
  await run('cd ~');
  // tab completion
  await type('ec'); await key('Tab'); await sleep(50);
  check('tab completes command', (await evaluate('window.linuxArsenal.terminal.buffer')) === 'echo ', await evaluate('window.linuxArsenal.terminal.buffer'));
  await type('docu'); await key('Tab'); await sleep(50);
  check('tab completes path', (await evaluate('window.linuxArsenal.terminal.buffer')) === 'echo documents/', await evaluate('window.linuxArsenal.terminal.buffer'));
  await key('U', 2); // ctrl+u
  check('ctrl+u clears line', (await evaluate('window.linuxArsenal.terminal.buffer')) === '');
  // history
  await key('ArrowUp'); await sleep(30);
  check('history up', (await evaluate('window.linuxArsenal.terminal.buffer')) === 'cd ~', await evaluate('window.linuxArsenal.terminal.buffer'));
  await key('U', 2);
  // multi-line continuation
  await type('for i in 1 2 3'); await key('Enter'); await type('do echo "n$i"'); await key('Enter'); await type('done'); await key('Enter'); await sleep(80);
  check('multi-line for loop', /n1\s+n2\s+n3/.test(await termText()));
  // colors
  await run('ls --color=always /etc | head -3');
  await run('grep --color=always ERROR data/server.log | head -1');
  check('ANSI colors rendered', await evaluate('!!document.querySelector("#terminal-host .ansi-fg-c9, #terminal-host .ansi-fg-c1")'));
  // nano
  await run('nano e2e_nano.txt');
  check('nano opens', await evaluate('!!(window.linuxArsenal.terminal.app && window.linuxArsenal.terminal.app.mode === "nano")'));
  await shot('03-nano');
  await type('written with nano');
  await key('O', 2); await sleep(30); await key('Enter'); await sleep(30); await key('X', 2); await sleep(80);
  await run('cat e2e_nano.txt');
  check('nano saves file', (await termText()).includes('written with nano'));
  // vim
  await run('vim e2e_vim.txt');
  await type('i'); await type('vim works'); await key('Escape'); await type(':wq'); await key('Enter'); await sleep(80);
  await run('cat e2e_vim.txt');
  check('vim saves file', (await termText()).includes('vim works'));
  // man pager
  await run('man grep');
  check('man opens pager', await evaluate('!!(window.linuxArsenal.terminal.app && window.linuxArsenal.terminal.app.lines)'));
  await shot('04-man');
  await type('q'); await sleep(60);
  check('pager quits', await evaluate('!window.linuxArsenal.terminal.app'));
  // top
  await run('top'); await sleep(100);
  check('top opens', await evaluate('!!window.linuxArsenal.terminal.app'));
  await type('q'); await sleep(50);
  // ctrl+r
  await key('R', 2); await type('tr a-z'); await sleep(30);
  check('reverse search finds', (await evaluate('window.linuxArsenal.terminal.search && window.linuxArsenal.terminal.search.match || ""')).includes('tr a-z'));
  await key('G', 2);
  // sudo + apt + cowsay
  await run('sudo apt install -y cowsay > /dev/null && cowsay moo');
  check('apt install + cowsay', (await termText()).includes('^__^'));
  // tutorial
  await run('tutorial');
  check('tutorial starts', (await termText()).includes('Tutorial 1/'));
  await run('pwd');
  check('tutorial advances', (await termText()).includes('Tutorial 2/'));
  await run('tutorial quit');
  // in-terminal challenge
  await run('challenge start 1');
  check('challenge loads in terminal', (await termText()).includes('Challenge #1'));
  const sol = await evaluate('window.linuxArsenal.termChallenge.challenge.solution');
  await run(sol);
  check('terminal challenge solved', (await termText()).includes('Challenge solved'));
  await run('challenge quit');
  await shot('02-terminal');

  // challenges page + modal
  await evaluate('document.querySelector(\'[data-section="challenges"]\').click()');
  await sleep(200);
  check('challenge cards rendered', (await evaluate('document.querySelectorAll(".challenge-card").length')) >= 30);
  await evaluate('document.querySelector(\'.filter-btn[data-filter="expert"]\').click()');
  await sleep(100);
  check('difficulty filter', await evaluate('[...document.querySelectorAll(".challenge-card .challenge-difficulty")].every(e => e.textContent === "expert")'));
  await evaluate('document.getElementById("load-more-challenges").click()');
  await evaluate('document.querySelector(\'.filter-btn[data-filter="all"]\').click()');
  await evaluate('(() => { const s = document.getElementById("challenge-search"); s.value = "tar"; s.dispatchEvent(new Event("input")); })()');
  await sleep(300);
  check('search filter', await evaluate('document.querySelectorAll(".challenge-card").length > 0 && [...document.querySelectorAll(".challenge-card")].every(c => /tar/i.test(c.innerText))'));
  await evaluate('(() => { const s = document.getElementById("challenge-search"); s.value = ""; s.dispatchEvent(new Event("input")); })()');
  await sleep(300);
  // solve several challenges of different kinds through the modal UI
  const ids = await evaluate('(() => { const A = window.linuxArsenal; const want = ["cat-file","chmod-octal","grep-c","find-name","git-commit","docker-run","scn-incident","crontab","sed-inplace","awk-filter"]; return want.map(t => A.challenges.find(c => c.templateId === t && !A.state.completed[c.id])).filter(Boolean).map(c => c.id); })()');
  let solved = 0;
  for (const cid of ids) {
    await evaluate('window.linuxArsenal.openChallenge(' + JSON.stringify(cid) + ')');
    await sleep(150);
    const solution = await evaluate('window.linuxArsenal.session.challenge.solution');
    await evaluate('window.linuxArsenal.modalTerm.focus()');
    if (solution.includes('\n')) { await send('Input.insertText', { text: solution }); await key('Enter'); }
    else await run(solution);
    await sleep(150);
    const ok = await evaluate('!document.getElementById("challenge-result").classList.contains("hidden")');
    if (ok) solved++; else check('modal solve ' + cid, false, await termText('#challenge-terminal-host'));
    if (cid.startsWith('docker-run')) await shot('05-challenge-modal');
  }
  check('solved ' + ids.length + ' challenges via modal', solved === ids.length, solved + '/' + ids.length);
  // wrong answer must not solve
  const wrong = await evaluate('(() => { const A = window.linuxArsenal; const c = A.challenges.find(c => c.templateId === "chmod-octal" && !A.state.completed[c.id]); A.openChallenge(c.id); return c.id; })()');
  await sleep(100);
  await evaluate('window.linuxArsenal.modalTerm.focus()');
  await run('ls -la'); await run('echo nope');
  check('wrong commands do not solve', await evaluate('document.getElementById("challenge-result").classList.contains("hidden")'), wrong);
  await evaluate('document.getElementById("show-hint").click()');
  check('hint shows', await evaluate('!document.getElementById("hint-display").classList.contains("hidden") && /Hint 1/.test(document.getElementById("hint-display").innerText)'));
  await evaluate('document.getElementById("close-challenge").click()');
  await evaluate('document.getElementById("generate-challenge").click()');
  await sleep(200);
  check('generate opens new challenge', await evaluate('!document.getElementById("challenge-modal").classList.contains("hidden") && window.linuxArsenal.session.challenge.generated === true'));
  await evaluate('document.getElementById("close-challenge").click()');
  // other sections
  for (const s of ['achievements', 'leaderboard', 'analytics', 'dashboard']) {
    await evaluate('document.querySelector(\'[data-section="' + s + '"]\').click()');
    await sleep(150);
    await shot('06-' + s);
  }
  check('achievements unlocked', (await evaluate('window.linuxArsenal.state.achievements.length')) >= 3, await evaluate('JSON.stringify(window.linuxArsenal.state.achievements)'));
  check('xp awarded', (await evaluate('window.linuxArsenal.state.xp')) > 100);
  // assistant with XSS attempt
  await evaluate('(() => { const i = document.getElementById("chat-input"); i.value = "<img src=x onerror=window.__xss=1> what does grep do"; document.getElementById("send-message").click(); })()');
  await sleep(600);
  check('assistant answers', /grep/.test(await evaluate('document.getElementById("chat-messages").innerText')));
  check('no XSS via chat', await evaluate('!window.__xss && !document.querySelector("#chat-messages img")'));
  // settings
  await evaluate('document.getElementById("open-settings").click()');
  await evaluate('(() => { const s = document.getElementById("theme-select"); s.value = "dracula"; s.dispatchEvent(new Event("change")); })()');
  check('theme applies', await evaluate('document.querySelector("#terminal-host").dataset.theme === "dracula"'));
  await evaluate('document.getElementById("close-settings").click()');
  // persistence across reload
  await evaluate('window.linuxArsenal.saveMachine(); window.linuxArsenal.saveState()');
  const xpBefore = await evaluate('window.linuxArsenal.state.xp');
  await send('Page.reload');
  for (let i = 0; i < 100; i++) { await sleep(100); if (await evaluate('!!window.linuxArsenal')) break; }
  await sleep(300);
  check('progress persists', (await evaluate('window.linuxArsenal.state.xp')) === xpBefore);
  await evaluate('document.querySelector(\'[data-section="terminal"]\').click()');
  await sleep(150);
  await evaluate('window.linuxArsenal.terminal.focus()');
  await run('cat e2e_vim.txt');
  check('machine files persist', (await termText()).includes('vim works'));
  // mobile viewport
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(300);
  await shot('07-mobile-terminal');
  check('no horizontal overflow on mobile', await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'), await evaluate('document.documentElement.scrollWidth'));
  check('no JS errors', errors.length === 0, errors.join(' | '));
  const failed = results.filter((r) => !r[1]).length;
  console.log('\nE2E: ' + (results.length - failed) + ' passed, ' + failed + ' failed. Screenshots: ' + SHOTS);
  ws.close(); proc.kill(); fs.rmSync(profile, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e); proc.kill(); process.exit(1); });
