// Verifies EVERY generated challenge: solvable by its reference solution, not solvable by doing nothing.
const LA = require('./load.js');
const C = LA.challenges;
const all = C.generateAll();
let failures = [];
const ids = new Set();
const byDiff = {}, byCat = {};
const t0 = Date.now();
for (const ch of all) {
  byDiff[ch.difficulty] = (byDiff[ch.difficulty] || 0) + 1;
  byCat[ch.category] = (byCat[ch.category] || 0) + 1;
  if (ids.has(ch.id)) failures.push([ch.id, 'duplicate id']);
  ids.add(ch.id);
  for (const k of ['title', 'description', 'solution', 'difficulty', 'category']) if (!ch[k]) failures.push([ch.id, 'missing ' + k]);
  if (!ch.hints || !ch.hints.length) failures.push([ch.id, 'no hints']);
  try {
    // positive: reference solution solves it
    const sh = C.createSandbox(ch, { strict: true });
    const cwdBefore = sh.cwd;
    const res = sh.exec(ch.solution, { tty: false });
    if (/command not found|syntax error|bad substitution/.test(res.stderr)) failures.push([ch.id, 'solution error: ' + res.stderr.trim().split('\n')[0]]);
    const kind = C.checkKind(ch);
    if ((kind === 'output' || kind === 'output+state') && !C.expectedOutput(ch).trim()) failures.push([ch.id, 'empty expected output']);
    if (!C.evaluate(ch, sh, { stdout: res.stdout, cwdBefore })) failures.push([ch.id, 'reference solution does not pass (' + kind + ') stderr=' + res.stderr.trim().slice(0, 120) + ' stdout=' + res.stdout.trim().slice(0, 120)]);
    // negative: doing nothing must not pass
    const sh2 = C.createSandbox(ch);
    const r2 = sh2.exec('true');
    if (C.evaluate(ch, sh2, { stdout: r2.stdout, cwdBefore: sh2.cwd })) failures.push([ch.id, 'passes without doing anything']);
    // negative 2: listing the directory must not pass (unless the challenge is about listing)
    if (!/^(ls-|pwd|tree|file-type|count-files|whoami)/.test(ch.templateId)) {
      const sh3 = C.createSandbox(ch);
      const r3 = sh3.exec('ls -la');
      if (C.evaluate(ch, sh3, { stdout: r3.stdout, cwdBefore: sh3.cwd })) failures.push([ch.id, 'passes with just "ls -la"']);
    }
  } catch (e) {
    failures.push([ch.id, 'exception: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')]);
  }
}
// random generator
for (let s = 1; s <= 200; s++) {
  const ch = C.generateRandom(s * 7919);
  const sh = C.createSandbox(ch);
  const res = sh.exec(ch.solution);
  if (!C.evaluate(ch, sh, { stdout: res.stdout, cwdBefore: ch.cwd })) failures.push([ch.id, 'random challenge not solvable']);
  if (!C.fromId(ch.id) || C.fromId(ch.id).title !== ch.title) failures.push([ch.id, 'fromId mismatch for generated challenge']);
}
console.log('challenges:', all.length, 'templates:', C.templates.length, 'time:', Date.now() - t0, 'ms');
console.log('by difficulty:', JSON.stringify(byDiff));
console.log('by category:', JSON.stringify(byCat));
if (all.length < 1000) failures.push(['*', 'fewer than 1000 challenges: ' + all.length]);
if (failures.length) {
  console.log('FAILURES (' + failures.length + '):');
  const seen = {};
  for (const [id, msg] of failures) { const t = id.replace(/-\d+$/, ''); seen[t] = (seen[t] || 0) + 1; if (seen[t] <= 2) console.log(' -', id, ':', msg); }
  process.exit(1);
}
console.log('ALL CHALLENGES PASS');
