// Linux Arsenal - procedurally generated challenges
// Every challenge runs in its own sandbox machine and is verified by RESULT (output or system state),
// not by string-matching the command, so any correct approach is accepted.
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const U = LA.util;
    const VFS = LA.VFS;
    const HOME = '/home/user';

    // ------------------------------------------------------------------ random helpers
    function rng(seed) {
        const r = U.mulberry32(seed);
        r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
        r.pick = (arr) => arr[Math.floor(r() * arr.length)];
        r.shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
        r.sample = (arr, n) => r.shuffle(arr).slice(0, n);
        r.bool = () => r() < 0.5;
        return r;
    }
    const POOL = {
        fruits: ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'kiwi', 'lemon', 'mango', 'nectarine', 'orange', 'papaya', 'pear', 'plum', 'quince', 'raspberry', 'strawberry'],
        colors: ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'black', 'white', 'cyan', 'magenta', 'silver', 'gold', 'teal', 'navy'],
        animals: ['cat', 'dog', 'eagle', 'fox', 'horse', 'lion', 'otter', 'panda', 'rabbit', 'shark', 'tiger', 'whale', 'wolf', 'zebra', 'koala', 'falcon'],
        cities: ['Berlin', 'London', 'Paris', 'Tokyo', 'Madrid', 'Rome', 'Oslo', 'Cairo', 'Lima', 'Delhi', 'Seoul', 'Sydney', 'Toronto', 'Dublin'],
        names: ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'heidi', 'ivan', 'judy', 'mallory', 'nina', 'oscar', 'peggy', 'rupert', 'sybil', 'trent', 'victor', 'wendy'],
        langs: ['bash', 'python', 'rust', 'go', 'java', 'ruby', 'perl', 'c', 'haskell', 'lua', 'kotlin', 'swift'],
        planets: ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'],
        depts: ['Engineering', 'Marketing', 'Sales', 'Support', 'Finance', 'Legal', 'Design', 'Research'],
        levels: ['INFO', 'WARN', 'ERROR', 'DEBUG'],
        services: ['auth', 'billing', 'search', 'gateway', 'cache', 'mailer', 'scheduler', 'api'],
        bases: ['report', 'notes', 'budget', 'inventory', 'todo', 'server', 'access', 'config', 'backup', 'data', 'users', 'invoice', 'readme', 'draft', 'summary', 'meeting', 'release', 'changelog', 'journal', 'recipes', 'playlist', 'tasks', 'contacts', 'metrics', 'orders', 'customers', 'events', 'alerts', 'scores', 'grades', 'ideas', 'shopping', 'travel', 'books', 'movies'],
        dirs: ['projects', 'archive', 'backup', 'logs', 'reports', 'photos', 'music', 'src', 'docs', 'build', 'assets', 'scripts', 'configs', 'exports', 'workspace', 'notes', 'datasets', 'releases', 'vault', 'sandbox', 'lab', 'staging', 'media', 'inbox', 'outbox', 'research', 'drafts', 'website', 'tools', 'old'],
        words: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu'],
        secrets: ['penguin', 'kernel', 'daemon', 'pipeline', 'sudoer', 'inode', 'shebang', 'symlink', 'cronjob', 'payload', 'firewall', 'socket', 'process', 'signal', 'mountpoint'],
        hosts: ['google.com', 'github.com', 'example.com', 'cloudflare.com', 'wikipedia.org', 'kernel.org', 'archlinux.org', 'ubuntu.com', 'debian.org', 'stackoverflow.com', 'httpbin.org', 'db.internal', 'web01.internal', 'web02.internal', 'backup.internal'],
        ext: ['txt', 'log', 'md', 'csv', 'conf', 'json', 'cfg', 'dat']
    };
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const q = (s) => (/^[\w.\/~@%+=:,-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'");

    function wordLines(r, pool, n, dupes) {
        const out = [];
        for (let i = 0; i < n; i++) out.push(dupes ? r.pick(pool) : pool[i % pool.length]);
        return dupes ? out : r.shuffle(out);
    }
    function logLines(r, n, opts) {
        opts = opts || {};
        const msgs = {
            INFO: ['User login successful', 'Request completed in 120ms', 'Cache warmed', 'Job finished', 'Connection established', 'Config reloaded', 'Health check passed'],
            WARN: ['Disk usage at 85%', 'Slow query detected', 'Retrying request', 'Certificate expires soon', 'High memory usage'],
            ERROR: ['Database connection timeout', 'Failed to write file', 'Permission denied', 'Upstream returned 502', 'Out of memory', 'Payment declined'],
            DEBUG: ['Entering handler', 'Payload parsed', 'Token refreshed']
        };
        const out = [];
        for (let i = 0; i < n; i++) {
            const lvl = opts.levels ? r.pick(opts.levels) : r.pick(['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG']);
            const svc = r.pick(POOL.services);
            out.push('2026-11-0' + (1 + (i % 5)) + ' ' + String(8 + Math.floor(i / 6)).padStart(2, '0') + ':' + String((i * 7) % 60).padStart(2, '0') + ':' + String((i * 13) % 60).padStart(2, '0') + ' ' + lvl + ' [' + svc + '] ' + r.pick(msgs[lvl]));
        }
        return out;
    }
    function csvRows(r, n) {
        const rows = ['id,name,department,salary,city'];
        const names = r.shuffle(POOL.names);
        for (let i = 0; i < n; i++) rows.push((i + 1) + ',' + cap(names[i % names.length]) + ',' + r.pick(POOL.depts) + ',' + (40 + r.int(0, 80)) * 1000 + ',' + r.pick(POOL.cities));
        return rows;
    }
    function numbers(r, n, max) { const out = []; for (let i = 0; i < n; i++) out.push(r.int(1, max || 500)); return out; }
    const L = (arr) => arr.join('\n') + '\n';
    function sortedC(arr) { return arr.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); }

    // ------------------------------------------------------------------ check helpers
    const H = {
        abs: (p) => (p.startsWith('/') ? p : p.startsWith('~/') ? HOME + p.slice(1) : HOME + '/' + p),
        node: (sh, p) => { try { return sh.fs.get(H.abs(p), { follow: false, checkPerms: false }); } catch (e) { return null; } },
        exists: (sh, p) => !!H.node(sh, p),
        isFile: (sh, p) => { const n = H.node(sh, p); return !!n && n.type === 'file'; },
        isDir: (sh, p) => { const n = H.node(sh, p); return !!n && n.type === 'dir'; },
        content: (sh, p) => { const n = H.node(sh, p); return n && n.type === 'file' ? n.content : null; },
        mode: (sh, p) => { const n = H.node(sh, p); return n ? n.mode & 0o7777 : -1; },
        owner: (sh, p) => { const n = H.node(sh, p); return n ? n.owner : null; },
        group: (sh, p) => { const n = H.node(sh, p); return n ? n.group : null; },
        tar: (sh, p) => { const c = H.content(sh, p); return c ? LA.archive.tarDecode(c) : null; },
        norm: (s) => U.stripAnsi(String(s || '')).replace(/\r/g, '').split(/\s+/).filter(Boolean).join(' '),
        tokens: (s) => U.stripAnsi(String(s || '')).split(/\s+/).filter(Boolean),
        lines: (s) => U.stripAnsi(String(s || '')).split('\n').map((l) => l.trim()).filter(Boolean),
        firstNumber: (s) => { const m = /-?\d+(\.\d+)?/.exec(U.stripAnsi(String(s || ''))); return m ? parseFloat(m[0]) : null; },
        git: (sh, dir) => { const c = H.content(sh, dir + '/.git/la-state.json'); try { return c ? JSON.parse(c) : null; } catch (e) { return null; } },
        procAlive: (sh, pred) => { sh.system.reap(); return sh.system.processes.some(pred); }
    };
    LA.challengeHelpers = H;

    // ------------------------------------------------------------------ templates
    const T = [];
    function tpl(id, cat, diff, count, xp, build) { T.push({ id, cat, diff, count, xp, build }); }

    // ============ FILES & NAVIGATION ============
    tpl('pwd', 'Files & Navigation', 'beginner', 10, 15, (r) => {
        const d = r.pick(['/var/log', '/etc/nginx', '/usr/share/doc', '/tmp', '/opt/app', HOME + '/' + r.pick(POOL.dirs) + '/' + r.pick(POOL.dirs), '/var/www/html', '/srv/shared', '/etc/ssh', '/usr/local/bin']);
        return {
            title: 'Where am I? (' + d.split('/').pop() + ')', desc: 'You were dropped somewhere in the filesystem. Print the absolute path of your current working directory.',
            dirs: [d], cwd: d, solution: 'pwd', hints: ['The command name stands for "print working directory".', 'Type pwd'], check: 'output'
        };
    });
    tpl('ls-dir', 'Files & Navigation', 'beginner', 16, 20, (r) => {
        const d = r.pick(POOL.dirs);
        const files = r.sample(POOL.bases, r.int(3, 6)).map((b) => b + '.' + r.pick(POOL.ext));
        return {
            title: 'List the contents of ' + d + '/', desc: 'A directory named "' + d + '" exists in your home directory. List the files inside it.',
            files: Object.fromEntries(files.map((f) => [d + '/' + f, 'content of ' + f + '\n'])), solution: 'ls ' + d,
            hints: ['ls lists directory contents.', 'Give ls the directory name as an argument.', 'ls ' + d], check: 'output'
        };
    });
    tpl('ls-hidden', 'Files & Navigation', 'beginner', 12, 25, (r) => {
        const d = r.pick(POOL.dirs);
        const visible = r.sample(POOL.bases, 3).map((b) => b + '.txt');
        const hidden = r.sample(['.env', '.secret', '.config', '.cache', '.token', '.history', '.vault', '.keys'], 2);
        const files = {};
        for (const f of visible.concat(hidden)) files[d + '/' + f] = f + '\n';
        return {
            title: 'Reveal hidden files in ' + d + '/', desc: 'Some files in "' + d + '" start with a dot, so plain ls hides them. List ALL entries of ' + d + ' (including hidden files, and the . and .. entries).',
            files, solution: 'ls -a ' + d, hints: ['Files whose names start with "." are hidden.', 'ls has an option for "all".', 'ls -a ' + d], check: 'output'
        };
    });
    tpl('ls-long', 'Files & Navigation', 'beginner', 10, 25, (r) => {
        const d = r.pick(POOL.dirs);
        const files = r.sample(POOL.bases, 3).map((b) => b + '.' + r.pick(POOL.ext));
        return {
            title: 'Long listing of ' + d + '/', desc: 'Show a detailed listing (permissions, owner, size, date) of the files in "' + d + '".',
            files: Object.fromEntries(files.map((f, i) => [d + '/' + f, 'x'.repeat(10 + i * 37) + '\n'])), solution: 'ls -l ' + d,
            hints: ['The long format shows permissions and sizes.', 'Use the -l option of ls.'], check: 'output'
        };
    });
    tpl('cat-file', 'Files & Navigation', 'beginner', 22, 20, (r) => {
        const d = r.bool() ? r.pick(POOL.dirs) + '/' : '';
        const f = d + r.pick(POOL.bases) + '.txt';
        const secret = r.pick(POOL.secrets) + '-' + r.int(100, 999);
        return {
            title: 'Read ' + f, desc: 'The file ' + f + ' contains a code word. Display the whole file on the screen.',
            files: { [f]: 'This file belongs to the challenge.\nThe code word is: ' + secret + '\nEnd of file.\n' }, solution: 'cat ' + f,
            hints: ['cat prints files.', 'cat ' + f], check: 'output'
        };
    });
    tpl('touch-file', 'Files & Navigation', 'beginner', 16, 20, (r) => {
        const d = r.bool() ? r.pick(POOL.dirs) : null;
        const f = (d ? d + '/' : '') + r.pick(POOL.bases) + '-' + r.int(1, 99) + '.' + r.pick(POOL.ext);
        return {
            title: 'Create an empty file ' + f, desc: 'Create a new, empty file called ' + f + (d ? ' (the directory ' + d + ' already exists)' : ' in your home directory') + '.',
            dirs: d ? [d] : [], solution: 'touch ' + f, hints: ['touch creates empty files.', 'touch ' + f], check: { state: (sh) => H.isFile(sh, f) }
        };
    });
    tpl('mkdir', 'Files & Navigation', 'beginner', 16, 20, (r) => {
        const d = r.pick(POOL.dirs) + '_' + r.pick(POOL.words);
        return {
            title: 'Make the directory ' + d, desc: 'Create a new directory named "' + d + '" in your home directory.',
            solution: 'mkdir ' + d, hints: ['The command is short for "make directory".', 'mkdir ' + d], check: { state: (sh) => H.isDir(sh, d) }
        };
    });
    tpl('mkdir-p', 'Files & Navigation', 'beginner', 14, 30, (r) => {
        const parts = r.sample(POOL.dirs, 3);
        const p = parts.join('/');
        return {
            title: 'Nested directories ' + p, desc: 'Create the nested directory path ' + p + ' with a single command (none of these directories exist yet).',
            solution: 'mkdir -p ' + p, hints: ['mkdir fails if the parent does not exist...', '...unless you ask it to create parents.', 'mkdir -p ' + p], check: { state: (sh) => H.isDir(sh, p) }
        };
    });
    tpl('cp-file', 'Files & Navigation', 'beginner', 16, 25, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const b = r.pick(['backup', 'copy', 'old', 'orig', 'bak', 'v1', 'safe']);
        const dst = f.replace('.txt', '.' + b + '.txt');
        const text = 'Version ' + r.int(1, 9) + ' of ' + f + '\n' + L(wordLines(r, POOL.words, 4, true));
        return {
            title: 'Copy ' + f + ' to ' + dst, desc: 'Make a copy of ' + f + ' called ' + dst + '. The original must stay where it is.',
            files: { [f]: text }, solution: 'cp ' + f + ' ' + dst, hints: ['cp SOURCE DEST', 'cp ' + f + ' ' + dst],
            check: { state: (sh) => H.content(sh, dst) === text && H.content(sh, f) === text }
        };
    });
    tpl('cp-into-dir', 'Files & Navigation', 'beginner', 12, 30, (r) => {
        const fs = r.sample(POOL.bases, 2).map((b) => b + '.' + r.pick(['txt', 'md', 'csv']));
        const d = r.pick(POOL.dirs);
        return {
            title: 'Copy two files into ' + d + '/', desc: 'Copy both ' + fs[0] + ' and ' + fs[1] + ' into the existing directory ' + d + '/ (keep the originals).',
            files: { [fs[0]]: 'one\n', [fs[1]]: 'two\n' }, dirs: [d], solution: 'cp ' + fs[0] + ' ' + fs[1] + ' ' + d + '/',
            hints: ['cp accepts several sources when the last argument is a directory.', 'cp ' + fs[0] + ' ' + fs[1] + ' ' + d + '/'],
            check: { state: (sh) => H.content(sh, d + '/' + fs[0]) === 'one\n' && H.content(sh, d + '/' + fs[1]) === 'two\n' && H.isFile(sh, fs[0]) && H.isFile(sh, fs[1]) }
        };
    });
    tpl('mv-into-dir', 'Files & Navigation', 'beginner', 16, 25, (r) => {
        const f = r.pick(POOL.bases) + '.' + r.pick(POOL.ext);
        const d = r.pick(POOL.dirs);
        const text = 'move me ' + r.int(1, 1000) + '\n';
        return {
            title: 'Move ' + f + ' into ' + d + '/', desc: 'Move the file ' + f + ' into the directory ' + d + '/. After you are done it must no longer be in your home directory.',
            files: { [f]: text }, dirs: [d], solution: 'mv ' + f + ' ' + d + '/', hints: ['mv moves (and renames) files.', 'mv ' + f + ' ' + d + '/'],
            check: { state: (sh) => H.content(sh, d + '/' + f) === text && !H.exists(sh, f) }
        };
    });
    tpl('rename', 'Files & Navigation', 'beginner', 14, 25, (r) => {
        const a = r.pick(POOL.bases) + '_old.' + r.pick(POOL.ext);
        const b = a.replace('_old', '_' + r.pick(['new', 'final', 'v2', 'latest', 'clean']));
        const text = 'rename ' + r.int(1, 1000) + '\n';
        return {
            title: 'Rename ' + a + ' to ' + b, desc: 'Rename the file ' + a + ' to ' + b + '.',
            files: { [a]: text }, solution: 'mv ' + a + ' ' + b, hints: ['Renaming is moving a file to a new name.', 'mv ' + a + ' ' + b],
            check: { state: (sh) => H.content(sh, b) === text && !H.exists(sh, a) }
        };
    });
    tpl('rm-file', 'Files & Navigation', 'beginner', 16, 20, (r) => {
        const keep = r.sample(POOL.bases, 3).map((b) => b + '.txt');
        const del = keep.pop().replace('.txt', '.tmp');
        const files = { [del]: 'garbage\n' };
        for (const k of keep) files[k] = 'keep\n';
        return {
            title: 'Delete ' + del, desc: 'Remove the file ' + del + ' from your home directory. Do not delete anything else.',
            files, solution: 'rm ' + del, hints: ['rm removes files.', 'rm ' + del],
            check: { state: (sh) => !H.exists(sh, del) && keep.every((k) => H.isFile(sh, k)) }
        };
    });
    tpl('rm-r', 'Files & Navigation', 'beginner', 12, 30, (r) => {
        const d = r.pick(POOL.dirs) + '_' + r.pick(['old', 'tmp', 'trash', 'junk', 'cache']);
        const keep = r.pick(POOL.dirs);
        const files = { [d + '/a.txt']: 'a\n', [d + '/sub/b.txt']: 'b\n', [keep + '/important.txt']: 'keep me\n' };
        return {
            title: 'Remove the directory ' + d + '/', desc: 'Delete the directory ' + d + ' and everything inside it. Keep the ' + keep + ' directory.',
            files, solution: 'rm -r ' + d, hints: ['rm refuses to remove directories by default.', 'Add the recursive option.', 'rm -r ' + d],
            check: { state: (sh) => !H.exists(sh, d) && H.isFile(sh, keep + '/important.txt') }
        };
    });
    tpl('cd', 'Files & Navigation', 'beginner', 14, 20, (r) => {
        const path = r.pick(['/var/log', '/etc', '/tmp', '/usr/share', '/opt/app', '/var/www/html', HOME + '/' + r.pick(POOL.dirs) + '/' + r.pick(POOL.dirs), '/etc/nginx', '/srv', '/usr/local/bin']);
        return {
            title: 'Go to ' + path, desc: 'Change your current directory to ' + path + '.',
            dirs: [path], solution: 'cd ' + path, hints: ['cd changes directory.', 'cd ' + path], check: { state: (sh) => sh.cwd === path }
        };
    });
    tpl('cd-parent', 'Files & Navigation', 'beginner', 8, 20, (r) => {
        const parts = r.sample(POOL.dirs, 3);
        const deep = HOME + '/' + parts.join('/');
        const up = r.int(1, 2);
        const target = HOME + '/' + parts.slice(0, 3 - up).join('/');
        return {
            title: 'Climb ' + up + ' level' + (up > 1 ? 's' : '') + ' up', desc: 'You are in ' + deep.replace(HOME, '~') + '. Move up ' + up + ' director' + (up > 1 ? 'ies' : 'y') + ' so that you end up in ' + target.replace(HOME, '~') + '.',
            dirs: [deep], cwd: deep, solution: 'cd ' + Array(up).fill('..').join('/'), hints: ['".." means the parent directory.', 'cd ' + Array(up).fill('..').join('/')],
            check: { state: (sh) => sh.cwd === target }
        };
    });
    tpl('head', 'Text Processing', 'beginner', 14, 25, (r) => {
        const f = r.pick(POOL.bases) + '.log';
        const n = r.int(2, 7);
        return {
            title: 'First ' + n + ' lines of ' + f, desc: 'Print only the first ' + n + ' lines of ' + f + '.',
            files: { [f]: L(logLines(r, 20)) }, solution: 'head -n ' + n + ' ' + f, hints: ['head shows the beginning of a file.', 'head -n NUMBER FILE'], check: 'output'
        };
    });
    tpl('tail', 'Text Processing', 'beginner', 14, 25, (r) => {
        const f = r.pick(POOL.bases) + '.log';
        const n = r.int(2, 7);
        return {
            title: 'Last ' + n + ' lines of ' + f, desc: 'Print only the last ' + n + ' lines of ' + f + '.',
            files: { [f]: L(logLines(r, 20)) }, solution: 'tail -n ' + n + ' ' + f, hints: ['tail shows the end of a file.', 'tail -n NUMBER FILE'], check: 'output'
        };
    });
    tpl('wc-l', 'Text Processing', 'beginner', 14, 25, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const n = r.int(5, 40);
        return {
            title: 'Count the lines of ' + f, desc: 'How many lines does ' + f + ' have? Print the number (the file name may appear next to it).',
            files: { [f]: L(wordLines(r, POOL.words, n, true)) }, solution: 'wc -l ' + f, hints: ['wc counts lines, words and bytes.', 'wc -l ' + f],
            check: { match: (out) => H.firstNumber(out) === n && H.tokens(out).length <= 2 }
        };
    });
    tpl('wc-w', 'Text Processing', 'beginner', 10, 25, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const lines = [];
        let total = 0;
        for (let i = 0; i < r.int(3, 8); i++) { const k = r.int(2, 9); total += k; lines.push(r.sample(POOL.words, k).join(' ')); }
        return {
            title: 'Count the words in ' + f, desc: 'Print the number of words in ' + f + '.',
            files: { [f]: L(lines) }, solution: 'wc -w ' + f, hints: ['wc can count words.', 'wc -w ' + f],
            check: { match: (out) => H.firstNumber(out) === total && H.tokens(out).length <= 2 }
        };
    });
    tpl('brace-touch', 'Files & Navigation', 'beginner', 10, 30, (r) => {
        const base = r.pick(['file', 'test', 'note', 'part', 'chapter', 'day', 'img', 'log']);
        const n = r.int(3, 9);
        const ext = r.pick(POOL.ext);
        const names = Array.from({ length: n }, (_, i) => base + (i + 1) + '.' + ext);
        return {
            title: 'Create ' + base + '1..' + base + n + '.' + ext, desc: 'Create the ' + n + ' empty files ' + names[0] + ', ' + names[1] + ', ... ' + names[n - 1] + '. Bonus: do it with one short command using brace expansion.',
            solution: 'touch ' + base + '{1..' + n + '}.' + ext, hints: ['touch accepts many file names.', 'Brace expansion: {1..5} expands to 1 2 3 4 5.', 'touch ' + base + '{1..' + n + '}.' + ext],
            check: { state: (sh) => names.every((x) => H.isFile(sh, x)) }
        };
    });
    tpl('cp-r', 'Files & Navigation', 'intermediate', 12, 40, (r) => {
        const d = r.pick(POOL.dirs);
        const b = d + '_' + r.pick(['backup', 'copy', 'snapshot', 'mirror']);
        const files = { [d + '/a.txt']: 'A\n', [d + '/b.txt']: 'B\n', [d + '/deep/c.txt']: 'C\n' };
        return {
            title: 'Back up the ' + d + ' directory', desc: 'Copy the whole directory ' + d + ' (including its subdirectory) to a new directory called ' + b + '.',
            files, solution: 'cp -r ' + d + ' ' + b, hints: ['cp needs an option to copy directories.', 'cp -r SOURCE DEST'],
            check: { state: (sh) => H.content(sh, b + '/a.txt') === 'A\n' && H.content(sh, b + '/deep/c.txt') === 'C\n' && H.isFile(sh, d + '/b.txt') }
        };
    });
    tpl('find-name', 'Files & Navigation', 'intermediate', 20, 45, (r) => {
        const ext = r.pick(['log', 'conf', 'md', 'bak', 'tmp', 'csv', 'py', 'sh']);
        const root = r.pick(POOL.dirs);
        const files = {};
        const expected = [];
        const subs = r.sample(POOL.dirs.filter((x) => x !== root), 3);
        for (let i = 0; i < 6; i++) {
            const p = root + '/' + (i % 3 ? subs[i % 3] + '/' : '') + r.pick(POOL.bases) + i + '.' + (i % 2 ? ext : r.pick(POOL.ext.filter((e) => e !== ext)));
            files[p] = 'data\n';
            if (p.endsWith('.' + ext)) expected.push(HOME + '/' + p);
        }
        return {
            title: 'Find every .' + ext + ' file under ' + root + '/', desc: 'Files are scattered in ' + root + '/ and its subdirectories. Print the paths of all files ending in .' + ext + ' (one per line).',
            files, solution: 'find ' + root + " -name '*." + ext + "'", hints: ['find walks directories recursively.', 'Use -name with a quoted glob pattern.', 'find ' + root + " -name '*." + ext + "'"],
            check: { paths: expected }
        };
    });
    tpl('find-type-d', 'Files & Navigation', 'intermediate', 8, 45, (r) => {
        const root = r.pick(POOL.dirs);
        const subs = r.sample(POOL.dirs.filter((x) => x !== root), 3);
        const files = { [root + '/' + subs[0] + '/x.txt']: 'x\n', [root + '/' + subs[1] + '/' + subs[2] + '/y.txt']: 'y\n', [root + '/z.txt']: 'z\n' };
        const expected = [root, root + '/' + subs[0], root + '/' + subs[1], root + '/' + subs[1] + '/' + subs[2]].map((p) => HOME + '/' + p);
        return {
            title: 'List only the directories in ' + root + '/', desc: 'Print the paths of all directories inside ' + root + ' (including ' + root + ' itself), but no regular files.',
            files, solution: 'find ' + root + ' -type d', hints: ['find can filter by type.', 'find ' + root + ' -type d'], check: { paths: expected }
        };
    });
    tpl('find-size', 'Files & Navigation', 'intermediate', 10, 50, (r) => {
        const root = r.pick(POOL.dirs);
        const limit = r.pick([1, 2, 4, 8]);
        const files = {};
        const expected = [];
        for (let i = 0; i < 6; i++) {
            const size = r.bool() ? r.int(limit * 1024 + 100, limit * 1024 * 3) : r.int(10, limit * 1024 - 100);
            const p = root + '/' + r.pick(POOL.bases) + i + '.dat';
            files[p] = 'x'.repeat(size);
            if (size > limit * 1024) expected.push(HOME + '/' + p);
        }
        if (!expected.length) { const p = root + '/huge.dat'; files[p] = 'x'.repeat(limit * 1024 * 2); expected.push(HOME + '/' + p); }
        return {
            title: 'Find files bigger than ' + limit + 'K in ' + root + '/', desc: 'Print the paths of the files in ' + root + '/ that are larger than ' + limit + ' KiB (' + limit * 1024 + ' bytes).',
            files, solution: 'find ' + root + ' -type f -size +' + limit + 'k', hints: ['find has a -size test.', '+Nk means "more than N kibibytes".', 'find ' + root + ' -type f -size +' + limit + 'k'],
            check: { paths: expected }
        };
    });
    tpl('find-empty', 'Files & Navigation', 'intermediate', 8, 45, (r) => {
        const root = r.pick(POOL.dirs);
        const files = {};
        const expected = [];
        for (let i = 0; i < 5; i++) {
            const p = root + '/' + r.pick(POOL.bases) + i + '.txt';
            const empty = i % 2 === 0;
            files[p] = empty ? '' : 'not empty\n';
            if (empty) expected.push(HOME + '/' + p);
        }
        return {
            title: 'Spot the empty files in ' + root + '/', desc: 'Some files in ' + root + '/ are empty (0 bytes). Print the path of each empty regular file.',
            files, solution: 'find ' + root + ' -type f -empty', hints: ['find has an -empty test.', 'find ' + root + ' -type f -empty'], check: { paths: expected }
        };
    });
    tpl('ln-s', 'Files & Navigation', 'intermediate', 10, 40, (r) => {
        const target = r.pick(['/var/log', '/etc/nginx', '/opt/app', '/var/www/html', '/usr/share/doc', HOME + '/' + r.pick(POOL.dirs) + '/' + r.pick(POOL.dirs)]);
        const link = r.pick(['logs', 'web', 'app', 'docs', 'shortcut', 'cfg', 'site', 'here']);
        return {
            title: 'Shortcut "' + link + '" to ' + target, desc: 'Create a symbolic link named ' + link + ' in your home directory that points to ' + target + '.',
            dirs: [target], solution: 'ln -s ' + target + ' ' + link, hints: ['ln creates links; -s makes it symbolic.', 'ln -s TARGET LINK_NAME', 'ln -s ' + target + ' ' + link],
            check: { state: (sh) => { const n = H.node(sh, link); if (!n || n.type !== 'link') return false; try { return sh.fs.realpath(HOME + '/' + link) === sh.fs.realpath(target); } catch (e) { return false; } } }
        };
    });
    tpl('stat-size', 'Files & Navigation', 'intermediate', 10, 35, (r) => {
        const f = r.pick(POOL.bases) + '.bin';
        const size = r.int(100, 9000);
        return {
            title: 'Exact size of ' + f, desc: 'Print the exact size of ' + f + ' in bytes.',
            files: { [f]: 'z'.repeat(size) }, solution: 'stat -c %s ' + f, hints: ['stat shows file details; wc -c counts bytes too.', 'stat -c %s ' + f + '  or  wc -c < ' + f],
            check: { match: (out) => H.tokens(out).length <= 2 && H.firstNumber(out) === size }
        };
    });
    tpl('file-type', 'Files & Navigation', 'beginner', 6, 25, (r) => {
        const kinds = [['script', '#!/bin/bash\necho hi\n'], ['page', '<!DOCTYPE html>\n<html></html>\n'], ['data', '{"a": 1}\n'], ['notes', 'plain text\n']];
        const [name, content] = r.pick(kinds);
        const f = name + r.int(1, 99);
        return {
            title: 'What kind of file is ' + f + '?', desc: 'The file ' + f + ' has no extension. Use a command that inspects its contents and reports its type.',
            files: { [f]: content }, solution: 'file ' + f, hints: ['There is a command literally called "file".', 'file ' + f], check: 'output'
        };
    });
    tpl('tree', 'Files & Navigation', 'beginner', 6, 25, (r) => {
        const d = r.pick(POOL.dirs);
        const s = r.sample(POOL.dirs, 2);
        return {
            title: 'Draw the tree of ' + d + '/', desc: 'Show the structure of ' + d + '/ as an indented tree.',
            files: { [d + '/' + s[0] + '/one.txt']: '1\n', [d + '/' + s[1] + '/two.txt']: '2\n', [d + '/root.txt']: 'r\n' }, solution: 'tree ' + d,
            hints: ['There is a command that draws directory trees.', 'tree ' + d], check: 'output'
        };
    });

    // ============ TEXT PROCESSING ============
    function wordFile(r) {
        const pool = r.pick([POOL.fruits, POOL.colors, POOL.animals, POOL.langs]);
        return { pool, lines: wordLines(r, pool, r.int(10, 18), true) };
    }
    tpl('grep-word', 'Text Processing', 'beginner', 24, 30, (r) => {
        const f = r.pick(POOL.bases) + '.log';
        const lines = logLines(r, 18);
        const lvl = r.pick(['ERROR', 'WARN', 'INFO']);
        if (!lines.some((l) => l.includes(lvl))) lines[3] = lines[3].replace(/INFO|WARN|ERROR|DEBUG/, lvl);
        return {
            title: 'Find the ' + lvl + ' lines in ' + f, desc: 'Print only the lines of ' + f + ' that contain the word ' + lvl + '.',
            files: { [f]: L(lines) }, solution: 'grep ' + lvl + ' ' + f, hints: ['grep prints lines matching a pattern.', 'grep PATTERN FILE'], check: 'output'
        };
    });
    tpl('grep-i', 'Text Processing', 'beginner', 14, 35, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const w = r.pick(POOL.animals);
        const lines = [];
        for (let i = 0; i < 12; i++) {
            const forms = [w, w.toUpperCase(), cap(w)];
            lines.push(r.bool() ? 'The ' + r.pick(forms) + ' is ' + r.pick(POOL.colors) : 'A ' + r.pick(POOL.fruits) + ' a day');
        }
        lines[0] = 'The ' + w.toUpperCase() + ' strikes back';
        return {
            title: 'Case-insensitive search for "' + w + '"', desc: 'Print all lines of ' + f + ' that mention "' + w + '" in any capitalization (' + w + ', ' + cap(w) + ', ' + w.toUpperCase() + '...).',
            files: { [f]: L(lines) }, solution: 'grep -i ' + w + ' ' + f, hints: ['grep is case sensitive by default.', 'Look for the "ignore case" option.', 'grep -i ' + w + ' ' + f], check: 'output'
        };
    });
    tpl('grep-v', 'Text Processing', 'intermediate', 12, 40, (r) => {
        const f = r.pick(['app', 'nginx', 'sshd', 'server', 'mail']) + '.conf';
        const lines = [];
        for (let i = 0; i < 12; i++) lines.push(i % 3 === 0 ? '# ' + r.pick(['comment', 'old setting', 'see docs', 'TODO']) : r.pick(['port', 'host', 'user', 'timeout', 'workers', 'log_level', 'max_conn']) + '=' + r.int(1, 9000));
        return {
            title: 'Strip comments from ' + f, desc: 'Print every line of ' + f + ' that does NOT start with "#".',
            files: { [f]: L(lines) }, solution: "grep -v '^#' " + f, hints: ['grep can invert its match.', '^ anchors a pattern to the start of the line.', "grep -v '^#' " + f], check: 'output'
        };
    });
    tpl('grep-c', 'Text Processing', 'intermediate', 14, 40, (r) => {
        const f = r.pick(POOL.bases) + '.log';
        const lines = logLines(r, r.int(15, 30));
        const lvl = r.pick(['ERROR', 'WARN']);
        const n = lines.filter((l) => l.includes(lvl)).length || (lines[0] = lines[0].replace(/INFO|WARN|ERROR|DEBUG/, lvl), 1);
        return {
            title: 'How many ' + lvl + ' lines in ' + f + '?', desc: 'Count the lines of ' + f + ' that contain ' + lvl + ' and print just that number.',
            files: { [f]: L(lines) }, solution: 'grep -c ' + lvl + ' ' + f, hints: ['grep can count matches.', 'grep -c PATTERN FILE  (or pipe grep into wc -l)'],
            check: { match: (out) => H.tokens(out).length === 1 && H.firstNumber(out) === lines.filter((l) => l.includes(lvl)).length }
        };
    });
    tpl('grep-n', 'Text Processing', 'intermediate', 10, 40, (r) => {
        const f = r.pick(['main', 'app', 'utils', 'server']) + '.' + r.pick(['py', 'js', 'sh', 'go']);
        const lines = [];
        for (let i = 0; i < 14; i++) lines.push(i % 4 === 1 ? '# TODO: ' + r.pick(['refactor', 'add tests', 'fix bug', 'handle errors', 'document']) : r.pick(['x = 1', 'print(x)', 'return x', 'call()', 'import os', 'y = x * 2']));
        return {
            title: 'TODOs with line numbers in ' + f, desc: 'Print every line of ' + f + ' containing TODO, prefixed with its line number.',
            files: { [f]: L(lines) }, solution: 'grep -n TODO ' + f, hints: ['grep can show line numbers.', 'grep -n TODO ' + f], check: 'output'
        };
    });
    tpl('grep-rl', 'Text Processing', 'intermediate', 12, 50, (r) => {
        const root = r.pick(POOL.dirs);
        const needle = r.pick(['password', 'api_key', 'secret', 'token', 'deprecated', 'FIXME']);
        const files = {};
        const expected = [];
        const subs = r.sample(POOL.dirs, 2);
        for (let i = 0; i < 6; i++) {
            const p = root + '/' + (i % 2 ? subs[i % 2] + '/' : '') + r.pick(POOL.bases) + i + '.' + r.pick(['conf', 'txt', 'ini', 'yml']);
            const has = r.bool() || i === 0;
            files[p] = 'line one\n' + (has ? 'config ' + needle + '=xyz\n' : 'nothing here\n');
            if (has) expected.push(HOME + '/' + p);
        }
        return {
            title: 'Which files mention "' + needle + '"?', desc: 'Search ' + root + '/ recursively and print the NAMES of the files that contain the text "' + needle + '" (one path per line, no matching lines).',
            files, solution: 'grep -rl ' + needle + ' ' + root, hints: ['grep can search directories recursively (-r).', 'Another option prints only file names (-l).', 'grep -rl ' + needle + ' ' + root],
            check: { paths: expected }
        };
    });
    tpl('grep-anchor', 'Text Processing', 'intermediate', 10, 45, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const letter = r.pick(['a', 'b', 'c', 'd', 'g', 'm', 'p', 's', 't']);
        const pool = POOL.fruits.concat(POOL.animals, POOL.colors, POOL.words);
        const lines = r.sample(pool, 16);
        if (!lines.some((w) => w.startsWith(letter))) lines.push(pool.find((w) => w.startsWith(letter)) || letter + 'xyz');
        return {
            title: 'Words starting with "' + letter + '"', desc: 'Print only the lines of ' + f + ' that start with the letter "' + letter + '".',
            files: { [f]: L(lines) }, solution: "grep '^" + letter + "' " + f, hints: ['Regular expressions: ^ matches the start of a line.', "grep '^" + letter + "' " + f], check: 'output'
        };
    });
    tpl('grep-E', 'Text Processing', 'intermediate', 10, 45, (r) => {
        const f = r.pick(POOL.bases) + '.log';
        const [a, b] = r.sample(['ERROR', 'WARN', 'DEBUG'], 2);
        return {
            title: a + ' or ' + b + ' in ' + f, desc: 'Print the lines of ' + f + ' that contain either ' + a + ' or ' + b + ' (in their original order).',
            files: { [f]: L(logLines(r, 20)) }, solution: "grep -E '" + a + '|' + b + "' " + f, hints: ['Extended regular expressions support alternation with |.', "grep -E 'A|B' FILE"], check: 'output'
        };
    });
    tpl('grep-o-ip', 'Text Processing', 'advanced', 8, 70, (r) => {
        const f = r.pick(['firewall', 'access', 'audit', 'connections']) + '.log';
        const lines = [];
        for (let i = 0; i < 10; i++) lines.push('conn from ' + r.int(10, 223) + '.' + r.int(0, 255) + '.' + r.int(0, 255) + '.' + r.int(1, 254) + ' port ' + r.int(1000, 65000) + ' ' + r.pick(['accepted', 'dropped']));
        return {
            title: 'Extract the IP addresses from ' + f, desc: 'Print only the IP addresses that appear in ' + f + ', one per line, in order (not the whole lines).',
            files: { [f]: L(lines) }, solution: "grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+' " + f, hints: ['grep -o prints only the matching part.', 'An IPv4 address is four groups of digits separated by dots.', "grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+' " + f],
            check: 'output'
        };
    });
    tpl('sort', 'Text Processing', 'beginner', 14, 25, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const { lines } = wordFile(r);
        return {
            title: 'Sort ' + f + ' alphabetically', desc: 'Print the lines of ' + f + ' in alphabetical order.',
            files: { [f]: L(lines) }, solution: 'sort ' + f, hints: ['There is a command named after what you want to do.', 'sort ' + f], check: 'output'
        };
    });
    tpl('sort-n', 'Text Processing', 'beginner', 14, 30, (r) => {
        const f = r.pick(['numbers', 'scores', 'ages', 'prices', 'sizes', 'counts']) + '.txt';
        const nums = numbers(r, r.int(8, 15), 999);
        return {
            title: 'Sort ' + f + ' numerically', desc: 'Print the numbers in ' + f + ' from smallest to largest (numeric order, so 9 comes before 10).',
            files: { [f]: L(nums) }, solution: 'sort -n ' + f, hints: ['Plain sort compares text: "10" < "9".', 'sort has a numeric option.', 'sort -n ' + f], check: 'output'
        };
    });
    tpl('sort-top', 'Text Processing', 'intermediate', 12, 45, (r) => {
        const f = r.pick(['scores', 'latency', 'sales', 'downloads', 'votes']) + '.txt';
        const nums = Array.from(new Set(numbers(r, 18, 5000)));
        const n = r.int(2, 5);
        return {
            title: 'Top ' + n + ' values of ' + f, desc: 'Print the ' + n + ' largest numbers in ' + f + ', biggest first.',
            files: { [f]: L(nums) }, solution: 'sort -rn ' + f + ' | head -n ' + n, hints: ['Sort numerically in reverse...', '...then keep only the first lines with head.', 'sort -rn ' + f + ' | head -n ' + n], check: 'output'
        };
    });
    tpl('uniq', 'Text Processing', 'intermediate', 14, 40, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const { lines } = wordFile(r);
        return {
            title: 'Unique values in ' + f, desc: 'Print each distinct line of ' + f + ' exactly once, sorted alphabetically.',
            files: { [f]: L(lines) }, solution: 'sort ' + f + ' | uniq', hints: ['uniq only removes ADJACENT duplicates.', 'Sort first, then uniq (or use sort -u).', 'sort ' + f + ' | uniq'], check: 'output'
        };
    });
    tpl('uniq-c', 'Text Processing', 'intermediate', 10, 45, (r) => {
        const f = r.pick(['votes', 'orders', 'visits', 'picks', 'answers']) + '.txt';
        const { lines } = wordFile(r);
        return {
            title: 'Count occurrences in ' + f, desc: 'For each distinct line in ' + f + ', print how many times it appears followed by the value (sorted by value).',
            files: { [f]: L(lines) }, solution: 'sort ' + f + ' | uniq -c', hints: ['uniq can prefix lines with a count.', 'Remember to sort first.', 'sort ' + f + ' | uniq -c'], check: 'output'
        };
    });
    tpl('most-frequent', 'Text Processing', 'advanced', 10, 70, (r) => {
        const f = r.pick(['votes', 'orders', 'visits', 'picks']) + '.txt';
        const pool = r.pick([POOL.fruits, POOL.colors, POOL.animals]).slice(0, 6);
        const lines = wordLines(r, pool, 15, true);
        const winner = r.pick(pool);
        for (let i = 0; i < 6; i++) lines.push(winner);
        const counts = {};
        for (const l of lines) counts[l] = (counts[l] || 0) + 1;
        return {
            title: 'Most popular entry in ' + f, desc: 'Which value appears most often in ' + f + '? Print a single line with the count and the value, e.g. "7 apple".',
            files: { [f]: L(r.shuffle(lines)) }, solution: 'sort ' + f + ' | uniq -c | sort -rn | head -n 1', hints: ['Count with sort | uniq -c.', 'Sort those counts numerically in reverse.', 'sort ' + f + ' | uniq -c | sort -rn | head -n 1'],
            check: { match: (out) => { const t = H.tokens(out); return t.length === 2 && t[0] === String(counts[winner]) && t[1] === winner; } }
        };
    });
    tpl('cut-csv', 'Text Processing', 'intermediate', 18, 40, (r) => {
        const f = r.pick(['employees', 'staff', 'team', 'payroll', 'people']) + '.csv';
        const rows = csvRows(r, r.int(5, 9));
        const col = r.int(2, 5);
        const names = rows[0].split(',');
        return {
            title: 'Extract the "' + names[col - 1] + '" column of ' + f, desc: f + ' is comma separated. Print only column ' + col + ' (' + names[col - 1] + ') for every line, header included.',
            files: { [f]: L(rows) }, solution: 'cut -d, -f' + col + ' ' + f, hints: ['cut extracts fields.', '-d sets the delimiter, -f the field number.', 'cut -d, -f' + col + ' ' + f], check: 'output'
        };
    });
    tpl('cut-passwd', 'Text Processing', 'intermediate', 4, 40, (r) => {
        const fields = [[1, 'usernames'], [6, 'home directories'], [7, 'login shells'], [3, 'numeric user IDs']];
        const [n, what] = fields[r.int(0, 3)];
        return {
            title: 'All ' + what + ' from /etc/passwd', desc: '/etc/passwd has one account per line with fields separated by ":". Print field ' + n + ' (the ' + what + ') of every line.',
            solution: 'cut -d: -f' + n + ' /etc/passwd', hints: ['The separator is a colon.', 'cut -d: -f' + n + ' /etc/passwd  (awk -F: works too)'], check: 'output'
        };
    });
    tpl('awk-sum', 'Text Processing', 'intermediate', 14, 50, (r) => {
        const f = r.pick(['expenses', 'sales', 'hours', 'transfers', 'orders']) + '.txt';
        const lines = [];
        let sum = 0;
        for (let i = 0; i < r.int(5, 10); i++) { const v = r.int(1, 500); sum += v; lines.push(r.pick(POOL.names) + ' ' + v); }
        return {
            title: 'Total of the second column in ' + f, desc: 'Each line of ' + f + ' is "name amount". Print the sum of all amounts (just the number).',
            files: { [f]: L(lines) }, solution: "awk '{s += $2} END {print s}' " + f, hints: ['awk splits lines into fields $1, $2...', 'Accumulate in a variable, print it in an END block.', "awk '{s += $2} END {print s}' " + f],
            check: { match: (out) => H.tokens(out).length === 1 && H.firstNumber(out) === sum }
        };
    });
    tpl('awk-filter', 'Text Processing', 'intermediate', 14, 50, (r) => {
        const f = r.pick(['employees', 'staff', 'payroll']) + '.csv';
        const rows = csvRows(r, 9);
        const limit = r.pick([50000, 60000, 70000, 80000, 90000]);
        if (!rows.slice(1).some((x) => +x.split(',')[3] > limit)) rows[1] = rows[1].replace(/,\d+,/, ',' + (limit + 5000) + ',');
        return {
            title: 'Who earns more than ' + limit + '?', desc: 'In ' + f + ' (comma separated: id,name,department,salary,city) print the NAME of every person whose salary is greater than ' + limit + '.',
            files: { [f]: L(rows) }, solution: "awk -F, '$4 > " + limit + " {print $2}' " + f, hints: ['awk -F, uses comma as the separator.', 'A pattern before the action filters lines: $4 > N', "awk -F, '$4 > " + limit + " {print $2}' " + f],
            check: 'output'
        };
    });
    tpl('awk-avg', 'Text Processing', 'advanced', 10, 70, (r) => {
        const f = r.pick(['grades', 'temps', 'ratings', 'latency']) + '.txt';
        const nums = numbers(r, r.int(4, 9), 100);
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        return {
            title: 'Average of ' + f, desc: 'Print the average of the numbers in ' + f + ' (one number per line). Decimals are fine.',
            files: { [f]: L(nums) }, solution: "awk '{s += $1} END {print s/NR}' " + f, hints: ['NR is the number of records (lines) read.', "awk '{s += $1} END {print s/NR}' " + f],
            check: { match: (out) => H.tokens(out).length === 1 && Math.abs(H.firstNumber(out) - avg) < 0.01 }
        };
    });
    tpl('awk-group', 'Text Processing', 'expert', 8, 120, (r) => {
        const f = r.pick(['employees', 'staff']) + '.csv';
        const rows = csvRows(r, 10);
        return {
            title: 'Headcount per department', desc: 'Using ' + f + ' (id,name,department,salary,city), print each department and how many people work in it as "Department N", one per line, sorted alphabetically by department. Skip the header.',
            files: { [f]: L(rows) }, solution: "awk -F, 'NR > 1 {c[$3]++} END {for (d in c) print d, c[d]}' " + f + ' | sort',
            hints: ['awk arrays can count: c[$3]++', 'Skip the header with NR > 1.', 'Pipe into sort for a stable order.'], check: 'output'
        };
    });
    tpl('sed-sub', 'Text Processing', 'intermediate', 18, 40, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const [a, b] = r.sample(POOL.colors, 2);
        const lines = [];
        for (let i = 0; i < 8; i++) lines.push('the ' + (r.bool() ? a : r.pick(POOL.colors)) + ' car and the ' + (i % 3 === 0 ? a : r.pick(POOL.colors)) + ' bike');
        lines[0] = 'the ' + a + ' house has a ' + a + ' door';
        return {
            title: 'Replace "' + a + '" with "' + b + '"', desc: 'Print ' + f + ' with EVERY occurrence of "' + a + '" replaced by "' + b + '" (do not modify the file).',
            files: { [f]: L(lines) }, solution: "sed 's/" + a + '/' + b + "/g' " + f, hints: ["sed 's/OLD/NEW/' replaces the first match per line.", 'The g flag replaces all matches.', "sed 's/" + a + '/' + b + "/g' " + f], check: 'output'
        };
    });
    tpl('sed-inplace', 'Text Processing', 'intermediate', 14, 50, (r) => {
        const f = r.pick(['app', 'server', 'site', 'db']) + '.conf';
        const key = r.pick(['port', 'workers', 'timeout', 'max_clients']);
        const [oldV, newV] = [String(r.int(10, 99) * 100), String(r.int(10, 99) * 100 + 1)];
        const text = L(['# config', 'name=' + r.pick(POOL.words), key + '=' + oldV, 'debug=false']);
        const expected = text.replace(key + '=' + oldV, key + '=' + newV);
        return {
            title: 'Change ' + key + ' to ' + newV + ' in ' + f, desc: 'Edit ' + f + ' so that the line "' + key + '=' + oldV + '" becomes "' + key + '=' + newV + '". Everything else must stay the same. (Try doing it without an editor!)',
            files: { [f]: text }, solution: "sed -i 's/" + key + '=' + oldV + '/' + key + '=' + newV + "/' " + f, hints: ['sed -i edits a file in place.', "sed -i 's/OLD/NEW/' FILE  (or use nano)"],
            check: { state: (sh) => H.content(sh, f) === expected }
        };
    });
    tpl('sed-delete', 'Text Processing', 'intermediate', 10, 45, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const lines = [];
        for (let i = 0; i < 12; i++) lines.push(i % 3 === 2 ? '' : r.pick(POOL.words) + ' ' + r.pick(POOL.words));
        return {
            title: 'Remove blank lines from ' + f, desc: 'Print ' + f + ' without its empty lines.',
            files: { [f]: L(lines) }, solution: "sed '/^$/d' " + f, hints: ['^$ matches an empty line.', "sed '/^$/d' FILE  or  grep -v '^$' FILE"], check: 'output'
        };
    });
    tpl('sed-range', 'Text Processing', 'intermediate', 10, 40, (r) => {
        const f = r.pick(POOL.bases) + '.log';
        const a = r.int(3, 8), b = a + r.int(2, 5);
        return {
            title: 'Lines ' + a + ' to ' + b + ' of ' + f, desc: 'Print only lines ' + a + ' through ' + b + ' (inclusive) of ' + f + '.',
            files: { [f]: L(logLines(r, 20)) }, solution: "sed -n '" + a + ',' + b + "p' " + f, hints: ['sed -n with a p command prints selected lines.', "sed -n 'A,Bp' FILE  (or head | tail)"], check: 'output'
        };
    });
    tpl('nth-line', 'Text Processing', 'intermediate', 12, 35, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const n = r.int(2, 12);
        return {
            title: 'Only line ' + n + ' of ' + f, desc: 'Print line number ' + n + ' of ' + f + ' and nothing else.',
            files: { [f]: L(r.sample(POOL.words, 14)) }, solution: "sed -n '" + n + "p' " + f, hints: ['Several ways work: sed -n, awk NR==N, head | tail.', "sed -n '" + n + "p' " + f], check: 'output'
        };
    });
    tpl('tr-upper', 'Text Processing', 'beginner', 12, 30, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        return {
            title: 'SHOUT the contents of ' + f, desc: 'Print ' + f + ' converted to UPPERCASE.',
            files: { [f]: L([r.sample(POOL.words, 4).join(' '), r.sample(POOL.fruits, 3).join(' and ')]) }, solution: 'tr a-z A-Z < ' + f, hints: ['tr translates characters from standard input.', 'tr a-z A-Z < ' + f], check: 'output'
        };
    });
    tpl('tr-delete', 'Text Processing', 'intermediate', 8, 40, (r) => {
        const f = r.pick(['codes', 'serials', 'messy', 'tokens']) + '.txt';
        const lines = [];
        for (let i = 0; i < 5; i++) lines.push(r.pick(POOL.words) + r.int(10, 999) + r.pick(POOL.words) + r.int(1, 9));
        return {
            title: 'Remove all digits from ' + f, desc: 'Print ' + f + ' with every digit (0-9) deleted.',
            files: { [f]: L(lines) }, solution: "tr -d '0-9' < " + f, hints: ['tr -d deletes characters.', "tr -d '0-9' < " + f], check: 'output'
        };
    });
    tpl('rev', 'Text Processing', 'beginner', 5, 20, (r) => {
        const f = 'mirror' + r.int(1, 99) + '.txt';
        return {
            title: 'Mirror the lines of ' + f, desc: 'Print each line of ' + f + ' with its characters reversed.',
            files: { [f]: L(r.sample(POOL.words, 4)) }, solution: 'rev ' + f, hints: ['The command is the first three letters of "reverse".'], check: 'output'
        };
    });
    tpl('paste', 'Text Processing', 'intermediate', 6, 40, (r) => {
        const n = r.int(3, 6);
        const names = r.sample(POOL.names, n), scores = numbers(r, n, 100);
        return {
            title: 'Join names.txt and scores.txt side by side', desc: 'names.txt and scores.txt have matching lines. Print them side by side, separated by a TAB (name<TAB>score).',
            files: { 'names.txt': L(names), 'scores.txt': L(scores) }, solution: 'paste names.txt scores.txt', hints: ['paste merges lines of files.'], check: 'output'
        };
    });
    tpl('diff', 'Text Processing', 'intermediate', 8, 40, (r) => {
        const base = r.sample(POOL.words, 6);
        const changed = base.slice();
        changed[r.int(0, 5)] = r.pick(POOL.fruits);
        const v = r.pick(['config', 'list', 'roster', 'plan']);
        return {
            title: 'What changed between ' + v + '_v1 and ' + v + '_v2?', desc: 'Show the differences between ' + v + '_v1.txt and ' + v + '_v2.txt.',
            files: { [v + '_v1.txt']: L(base), [v + '_v2.txt']: L(changed) }, solution: 'diff ' + v + '_v1.txt ' + v + '_v2.txt', hints: ['There is a command named diff.'], check: 'output'
        };
    });
    tpl('nl', 'Text Processing', 'beginner', 5, 20, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        return {
            title: 'Number the lines of ' + f, desc: 'Print ' + f + ' with a line number in front of every line.',
            files: { [f]: L(r.sample(POOL.animals, 5)) }, solution: 'cat -n ' + f, hints: ['cat has a numbering option; nl does it too.'], check: 'output'
        };
    });
    tpl('echo-file', 'Pipes & Redirection', 'beginner', 14, 25, (r) => {
        const f = r.pick(['greeting', 'motto', 'message', 'status', 'note']) + '.txt';
        const text = r.pick(['Hello Linux', 'I love the shell', 'Keep calm and grep on', 'Root is power', 'Pipes are magic', 'Learning bash']) + ' ' + r.int(1, 99);
        return {
            title: 'Write "' + text + '" into ' + f, desc: 'Create the file ' + f + ' whose only line is exactly: ' + text,
            solution: 'echo ' + q(text) + ' > ' + f, hints: ['echo prints text.', '> redirects output into a file.', 'echo "' + text + '" > ' + f],
            check: { state: (sh) => (H.content(sh, f) || '').replace(/\n$/, '') === text }
        };
    });
    tpl('append', 'Pipes & Redirection', 'beginner', 14, 30, (r) => {
        const f = r.pick(['journal', 'todo', 'shopping', 'diary', 'ideas']) + '.txt';
        const orig = L(r.sample(POOL.words, 3));
        const line = r.pick(['buy milk', 'call mom', 'learn awk', 'fix the server', 'water plants', 'read man pages']);
        return {
            title: 'Append "' + line + '" to ' + f, desc: 'Add the line "' + line + '" to the END of ' + f + ' without losing the existing lines.',
            files: { [f]: orig }, solution: 'echo ' + q(line) + ' >> ' + f, hints: ['> overwrites, but >> appends.', 'echo "' + line + '" >> ' + f],
            check: { state: (sh) => H.content(sh, f) === orig + line + '\n' }
        };
    });
    tpl('redirect-sort', 'Pipes & Redirection', 'intermediate', 14, 40, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const out = 'sorted_' + f;
        const { lines } = wordFile(r);
        const expected = L(sortedC(lines));
        return {
            title: 'Save a sorted copy as ' + out, desc: 'Sort the lines of ' + f + ' alphabetically and SAVE the result into ' + out + '.',
            files: { [f]: L(lines) }, solution: 'sort ' + f + ' > ' + out, hints: ['sort prints to the screen...', '...and > sends output into a file.', 'sort ' + f + ' > ' + out],
            check: { state: (sh) => { const c = H.content(sh, out); return c !== null && (c === expected || H.norm(c) === H.norm(expected)); } }
        };
    });
    tpl('count-files', 'Pipes & Redirection', 'intermediate', 12, 40, (r) => {
        const d = r.pick(POOL.dirs);
        const n = r.int(4, 17);
        const files = {};
        for (let i = 0; i < n; i++) files[d + '/file' + i + '.' + r.pick(POOL.ext)] = '';
        return {
            title: 'How many files are in ' + d + '/?', desc: 'Print the number of entries in ' + d + '/ (just the number).',
            files, solution: 'ls ' + d + ' | wc -l', hints: ['Pipe the output of ls into a command that counts lines.', 'ls ' + d + ' | wc -l'],
            check: { match: (out) => H.tokens(out).length === 1 && H.firstNumber(out) === n }
        };
    });
    tpl('tee', 'Pipes & Redirection', 'intermediate', 6, 45, (r) => {
        const f = r.pick(['listing', 'snapshot', 'inventory']) + '.txt';
        const d = r.pick(POOL.dirs);
        const files = {};
        for (const b of r.sample(POOL.bases, 3)) files[d + '/' + b + '.txt'] = '';
        return {
            title: 'See it AND save it with tee', desc: 'List the contents of ' + d + '/ so that the listing is shown on screen and also saved into ' + f + ' at the same time.',
            files, solution: 'ls ' + d + ' | tee ' + f, hints: ['tee copies its input to a file and to the screen.', 'ls ' + d + ' | tee ' + f],
            check: { output: true, state: (sh) => H.norm(H.content(sh, f)) === H.norm(Object.keys(files).map((x) => x.split('/')[1]).sort().join('\n')) }
        };
    });
    tpl('stderr', 'Pipes & Redirection', 'intermediate', 6, 50, (r) => {
        const missing = r.pick(POOL.bases) + '_missing.txt';
        const log = r.pick(['errors', 'err', 'problems', 'failures']) + '.log';
        return {
            title: 'Capture an error message in ' + log, desc: 'Run cat on the file ' + missing + ' (which does not exist) and redirect the ERROR message into ' + log + ' instead of the screen.',
            solution: 'cat ' + missing + ' 2> ' + log, hints: ['Errors go to file descriptor 2 (stderr).', 'Use 2> to redirect stderr.', 'cat ' + missing + ' 2> ' + log],
            check: { state: (sh) => /No such file or directory/.test(H.content(sh, log) || '') }
        };
    });
    tpl('xargs-rm', 'Pipes & Redirection', 'advanced', 8, 70, (r) => {
        const victims = r.sample(POOL.bases, 3).map((b) => b + '.old');
        const keep = r.sample(POOL.bases, 2).map((b) => b + '.txt');
        const files = { 'delete-me.txt': L(victims) };
        for (const v of victims) files[v] = 'x\n';
        for (const k of keep) files[k] = 'k\n';
        return {
            title: 'Delete the files listed in delete-me.txt', desc: 'delete-me.txt contains a list of file names, one per line. Delete exactly those files (use the list, don\'t type the names!).',
            files, solution: 'cat delete-me.txt | xargs rm', hints: ['xargs turns input lines into command arguments.', 'cat delete-me.txt | xargs rm'],
            check: { state: (sh) => victims.every((v) => !H.exists(sh, v)) && keep.every((k) => H.isFile(sh, k)) }
        };
    });
    tpl('heredoc', 'Pipes & Redirection', 'advanced', 6, 60, (r) => {
        const f = r.pick(['hosts', 'servers', 'targets', 'nodes']) + '.list';
        const lines = r.sample(POOL.hosts, 3);
        return {
            title: 'Write a 3-line file with a here-document', desc: 'Create ' + f + ' containing exactly these three lines: ' + lines.join(', ') + ' (in that order). Try a here-document: cat > file <<EOF ... EOF',
            solution: 'cat > ' + f + ' <<EOF\n' + lines.join('\n') + '\nEOF', hints: ['A here-document feeds the following lines to a command.', 'cat > ' + f + ' <<EOF  (press Enter, type lines, finish with EOF)'],
            check: { state: (sh) => H.content(sh, f) === L(lines) }
        };
    });

    // ============ PERMISSIONS ============
    tpl('chmod-x', 'Permissions', 'beginner', 12, 35, (r) => {
        const f = r.pick(['deploy', 'backup', 'cleanup', 'start', 'build', 'install']) + '.sh';
        return {
            title: 'Make ' + f + ' executable', desc: 'The script ' + f + ' cannot be run yet because it lacks execute permission. Give the owner execute permission.',
            files: { [f]: { content: '#!/bin/bash\necho "running ' + f + '"\n', mode: 0o644 } }, solution: 'chmod +x ' + f, hints: ['chmod changes permissions.', 'The x bit means execute.', 'chmod +x ' + f],
            check: { state: (sh) => (H.mode(sh, f) & 0o100) !== 0 }
        };
    });
    const MODES = [['644', 'rw-r--r--'], ['600', 'rw-------'], ['755', 'rwxr-xr-x'], ['700', 'rwx------'], ['640', 'rw-r-----'], ['750', 'rwxr-x---'], ['444', 'r--r--r--'], ['400', 'r--------'], ['664', 'rw-rw-r--'], ['775', 'rwxrwxr-x']];
    tpl('chmod-octal', 'Permissions', 'intermediate', 20, 45, (r) => {
        const [oct, sym] = r.pick(MODES);
        const f = r.pick(POOL.bases) + '.' + r.pick(['txt', 'key', 'conf', 'sh', 'pem']);
        const start = r.pick(MODES.filter((m) => m[0] !== oct))[0];
        return {
            title: 'Set ' + f + ' to ' + sym, desc: 'Change the permissions of ' + f + ' to exactly ' + sym + ' (octal ' + oct + ').',
            files: { [f]: { content: 'data\n', mode: parseInt(start, 8) } }, solution: 'chmod ' + oct + ' ' + f, hints: ['r=4, w=2, x=1. Add them per group: owner, group, others.', 'chmod ' + oct + ' ' + f],
            check: { state: (sh) => H.mode(sh, f) === parseInt(oct, 8) }
        };
    });
    tpl('chmod-sym', 'Permissions', 'intermediate', 10, 45, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const tasks = [
            ['remove write permission for group and others', 'go-w', 0o777, (m) => (m & 0o022) === 0 && (m & 0o755) === 0o755],
            ['remove all permissions for others', 'o-rwx', 0o755, (m) => (m & 0o007) === 0 && (m & 0o750) === 0o750],
            ['add write permission for the group', 'g+w', 0o644, (m) => (m & 0o020) !== 0 && (m & 0o644) === 0o644],
            ['make it readable by everyone', 'a+r', 0o600, (m) => (m & 0o444) === 0o444 && (m & 0o200) !== 0],
            ['remove execute permission for everybody', 'a-x', 0o755, (m) => (m & 0o111) === 0 && (m & 0o644) === 0o644]
        ];
        const [what, spec, start, ok] = r.pick(tasks);
        return {
            title: cap(what) + ' (' + f + ')', desc: 'For ' + f + ': ' + what + '. Keep the other permission bits as they are.',
            files: { [f]: { content: 'x\n', mode: start } }, solution: 'chmod ' + spec + ' ' + f, hints: ['Symbolic modes: u/g/o/a then +/-/= then r/w/x.', 'chmod ' + spec + ' ' + f],
            check: { state: (sh) => ok(H.mode(sh, f)) }
        };
    });
    tpl('chmod-R', 'Permissions', 'advanced', 6, 60, (r) => {
        const d = r.pick(['private', 'secrets', 'vault', 'keys']) + '_' + r.pick(POOL.words);
        return {
            title: 'Lock down ' + d + '/ recursively', desc: 'Remove ALL permissions for group and others on ' + d + ' and everything inside it, recursively.',
            files: { [d + '/a.txt']: { content: 'a\n', mode: 0o644 }, [d + '/sub/b.txt']: { content: 'b\n', mode: 0o664 } }, solution: 'chmod -R go-rwx ' + d,
            hints: ['chmod has a recursive option.', 'chmod -R go-rwx ' + d],
            check: { state: (sh) => [d, d + '/a.txt', d + '/sub', d + '/sub/b.txt'].every((p) => H.exists(sh, p) && (H.mode(sh, p) & 0o077) === 0) }
        };
    });
    tpl('run-script', 'Permissions', 'intermediate', 10, 45, (r) => {
        const f = r.pick(['reveal', 'unlock', 'decode', 'magic', 'oracle']) + '.sh';
        const word = r.pick(POOL.secrets) + r.int(10, 99);
        return {
            title: 'Run the script ' + f, desc: 'Make ' + f + ' executable and run it as ./' + f + '. It prints a secret word.',
            files: { [f]: { content: '#!/bin/bash\necho "The secret is ' + word + '"\n', mode: 0o644 } }, solution: 'chmod +x ' + f + ' && ./' + f,
            hints: ['Scripts need the execute bit.', 'Run a program in the current directory with ./', 'chmod +x ' + f + ' && ./' + f],
            check: { match: (out, sh) => H.norm(out).includes(word) && (H.mode(sh, f) & 0o100) !== 0 }
        };
    });
    tpl('chown', 'Permissions', 'intermediate', 12, 50, (r) => {
        const u = r.pick(['alice', 'bob', 'www-data', 'root']);
        const f = r.pick(['site', 'report', 'shared', 'deploy', 'data']) + '.' + r.pick(['html', 'txt', 'sh', 'csv']);
        return {
            title: 'Give ' + f + ' to ' + u, desc: 'Change the owner of ' + f + ' to the user ' + u + '. (Only root may give files away...)',
            files: { [f]: 'x\n' }, solution: 'sudo chown ' + u + ' ' + f, hints: ['chown changes the owner.', 'You need root: prefix with sudo.', 'sudo chown ' + u + ' ' + f],
            check: { state: (sh) => H.owner(sh, f) === u }
        };
    });
    tpl('chown-group', 'Permissions', 'intermediate', 8, 55, (r) => {
        const [u, g] = r.pick([['alice', 'developers'], ['bob', 'developers'], ['www-data', 'www-data'], ['root', 'adm'], ['alice', 'sudo']]);
        const d = r.pick(POOL.dirs);
        return {
            title: 'Set owner ' + u + ' and group ' + g + ' on ' + d + '/', desc: 'Make ' + u + ' the owner and ' + g + ' the group of the directory ' + d + ' (just the directory itself is enough).',
            dirs: [d], solution: 'sudo chown ' + u + ':' + g + ' ' + d, hints: ['chown accepts OWNER:GROUP.', 'sudo chown ' + u + ':' + g + ' ' + d],
            check: { state: (sh) => H.owner(sh, d) === u && H.group(sh, d) === g }
        };
    });
    tpl('chgrp', 'Permissions', 'intermediate', 6, 45, (r) => {
        const g = r.pick(['docker', 'adm', 'users', 'sudo']);
        const f = r.pick(POOL.bases) + '.txt';
        return {
            title: 'Change the group of ' + f + ' to ' + g, desc: 'You are a member of the "' + g + '" group. Change the group of ' + f + ' to ' + g + '.',
            files: { [f]: 'x\n' }, solution: 'chgrp ' + g + ' ' + f, hints: ['chgrp changes the group (no sudo needed for groups you belong to).', 'chgrp ' + g + ' ' + f],
            check: { state: (sh) => H.group(sh, f) === g }
        };
    });
    tpl('find-perm', 'Security', 'advanced', 8, 70, (r) => {
        const d = r.pick(POOL.dirs);
        const files = {};
        const expected = [];
        for (let i = 0; i < 6; i++) {
            const p = d + '/' + r.pick(POOL.bases) + i + '.txt';
            const ww = i % 2 === 0;
            files[p] = { content: 'x\n', mode: ww ? 0o777 : r.pick([0o644, 0o600, 0o755]) };
            if (ww) expected.push(HOME + '/' + p);
        }
        return {
            title: 'Find world-writable files in ' + d + '/', desc: 'Security audit: print the paths of all files in ' + d + '/ whose permissions are exactly 777.',
            files, solution: 'find ' + d + ' -type f -perm 777', hints: ['find has a -perm test.', 'find ' + d + ' -type f -perm 777'], check: { paths: expected }
        };
    });
    tpl('sudo-read', 'Permissions', 'intermediate', 8, 45, (r) => {
        const f = '/root/' + r.pick(['vault', 'codes', 'admin', 'keys', 'notes']) + '.txt';
        const code = r.pick(POOL.secrets).toUpperCase() + '-' + r.int(1000, 9999);
        return {
            title: 'Read the root-only file ' + f, desc: 'Only root can read ' + f + '. Display its contents.',
            setup: (sh) => LA.asRoot(sh, () => { const n = sh.fs.writeFile(f, 'Admin code: ' + code + '\n'); n.mode = 0o600; n.owner = 'root'; n.group = 'root'; }),
            solution: 'sudo cat ' + f, hints: ['Permission denied? Become root for one command.', 'sudo cat ' + f], check: 'output'
        };
    });
    tpl('umask-private', 'Permissions', 'advanced', 4, 60, (r) => {
        const f = r.pick(['diary', 'private', 'mine']) + '.txt';
        return {
            title: 'Create ' + f + ' readable only by you', desc: 'Create a file ' + f + ' (any content) that only you can read or write: permissions rw------- (600).',
            solution: 'touch ' + f + ' && chmod 600 ' + f, hints: ['Create it, then chmod it.', 'touch ' + f + ' && chmod 600 ' + f],
            check: { state: (sh) => H.isFile(sh, f) && H.mode(sh, f) === 0o600 }
        };
    });

    // ============ USERS & GROUPS ============
    tpl('whoami', 'Users & Groups', 'beginner', 3, 15, (r) => {
        const v = r.pick([['whoami', 'your user name'], ['id -un', 'your user name using id'], ['groups', 'the groups you belong to']]);
        return { title: 'Identity check: ' + v[1], desc: 'Print ' + v[1] + '.', solution: v[0], hints: ['whoami, id and groups tell you who you are.', v[0]], check: 'output' };
    });
    tpl('id-user', 'Users & Groups', 'beginner', 4, 20, (r) => {
        const u = r.pick(['alice', 'bob', 'root', 'www-data']);
        return { title: 'What groups is ' + u + ' in?', desc: 'Print the user ID, group ID and groups of the user ' + u + '.', solution: 'id ' + u, hints: ['id USER'], check: 'output' };
    });
    tpl('useradd', 'Users & Groups', 'intermediate', 12, 55, (r) => {
        const u = r.pick(['carol', 'dave', 'erin', 'frank', 'grace', 'heidi', 'ivan', 'judy', 'nina', 'oscar', 'peggy', 'trent']);
        return {
            title: 'Create the user ' + u + ' with a home directory', desc: 'Create a new user account named ' + u + ' that has a home directory /home/' + u + '.',
            solution: 'sudo useradd -m ' + u, hints: ['useradd creates users; -m creates the home directory.', 'Requires root.', 'sudo useradd -m ' + u + '  (or sudo adduser ' + u + ')'],
            check: { state: (sh) => sh.system.userExists(u) && H.isDir(sh, '/home/' + u) }
        };
    });
    tpl('usermod-aG', 'Users & Groups', 'intermediate', 12, 55, (r) => {
        const [u, g] = r.pick([['bob', 'docker'], ['bob', 'sudo'], ['alice', 'docker'], ['alice', 'adm'], ['bob', 'adm'], ['user', 'developers'], ['bob', 'www-data'], ['alice', 'www-data']]);
        return {
            title: 'Add ' + u + ' to the ' + g + ' group', desc: 'Add the existing user ' + u + ' to the supplementary group ' + g + ', without removing ' + u + ' from any other group.',
            solution: 'sudo usermod -aG ' + g + ' ' + u, hints: ['usermod modifies users. -G sets groups, -a appends.', 'Never forget -a or you replace all groups!', 'sudo usermod -aG ' + g + ' ' + u],
            check: { state: (sh) => sh.system.groupsOf(u).includes(g) && (u !== 'alice' || sh.system.groupsOf('alice').includes('sudo') || g === 'sudo') && (u !== 'bob' || sh.system.groupsOf('bob').includes('developers') || g === 'developers') }
        };
    });
    tpl('groupadd', 'Users & Groups', 'intermediate', 8, 45, (r) => {
        const g = r.pick(['devops', 'qa', 'analysts', 'webteam', 'admins', 'interns', 'security', 'ops']);
        return {
            title: 'Create the group ' + g, desc: 'Create a new group called ' + g + '.',
            solution: 'sudo groupadd ' + g, hints: ['groupadd creates groups (as root).', 'sudo groupadd ' + g], check: { state: (sh) => sh.system.groupExists(g) }
        };
    });
    tpl('userdel', 'Users & Groups', 'intermediate', 6, 50, (r) => {
        const u = r.pick(['tempuser', 'intern', 'olduser', 'contractor', 'guest', 'testacct']);
        return {
            title: 'Remove the account ' + u, desc: 'The account ' + u + ' is no longer needed. Delete the user (and its home directory).',
            setup: (sh) => { sh.exec('sudo useradd -m ' + u); }, solution: 'sudo userdel -r ' + u, hints: ['userdel deletes users; -r removes the home too.', 'sudo userdel -r ' + u],
            check: { state: (sh) => !sh.system.userExists(u) && !H.exists(sh, '/home/' + u) }
        };
    });
    tpl('passwd-shell', 'Users & Groups', 'intermediate', 5, 40, (r) => {
        const u = r.pick(['alice', 'bob', 'root', 'www-data', 'mysql']);
        return {
            title: 'What is the login shell of ' + u + '?', desc: 'Print ONLY the login shell of ' + u + ' (the last field of its /etc/passwd line).',
            solution: "grep '^" + u + ":' /etc/passwd | cut -d: -f7", hints: ['Find the line with grep, then cut the 7th ":" field.', "grep '^" + u + ":' /etc/passwd | cut -d: -f7"], check: 'output'
        };
    });
    tpl('sudo-u', 'Users & Groups', 'intermediate', 3, 40, (r) => {
        const u = r.pick(['alice', 'bob', 'www-data']);
        return { title: 'Run a command as ' + u, desc: 'Run whoami as the user ' + u + ' so that it prints "' + u + '".', solution: 'sudo -u ' + u + ' whoami', hints: ['sudo -u USER COMMAND'], check: 'output' };
    });

    // ============ PROCESSES ============
    const ROGUE = ['cryptominer', 'spambot', 'keylogger', 'rogue_worker', 'zombie_job', 'memory_hog', 'fork_bomb', 'netscan', 'stuck_backup', 'old_server'];
    function addRogue(sh, name, pid, user, cpu) {
        sh.system.processes.push({ pid, ppid: 1, user: user || 'user', cmd: '/tmp/.' + name + ' --daemon', stat: 'R', cpu: cpu || 64.0, mem: 4.2, vsz: 302112, rss: 120400, tty: '?', start: Date.now() - 600000 });
    }
    tpl('pgrep', 'Processes', 'intermediate', 8, 45, (r) => {
        const name = r.pick(ROGUE);
        const pid = r.int(3000, 9000);
        return {
            title: 'What is the PID of ' + name + '?', desc: 'A process called ' + name + ' is running. Print its process ID (PID).',
            setup: (sh) => addRogue(sh, name, pid), solution: 'pgrep -f ' + name, hints: ['pgrep finds PIDs by name; ps aux | grep works too.', 'pgrep -f ' + name],
            check: { match: (out) => H.lines(out).length <= 3 && H.tokens(out).includes(String(pid)) }
        };
    });
    tpl('kill', 'Processes', 'intermediate', 14, 50, (r) => {
        const name = r.pick(ROGUE);
        const pid = r.int(3000, 9000);
        return {
            title: 'Terminate ' + name + ' (PID ' + pid + ')', desc: 'The process ' + name + ' with PID ' + pid + ' is misbehaving. Stop it.',
            setup: (sh) => addRogue(sh, name, pid), solution: 'kill ' + pid, hints: ['kill sends a signal to a PID.', 'kill ' + pid],
            check: { state: (sh) => !H.procAlive(sh, (p) => p.pid === pid) }
        };
    });
    tpl('kill-find', 'Processes', 'advanced', 10, 75, (r) => {
        const name = r.pick(ROGUE);
        const pid = r.int(3000, 9000);
        return {
            title: 'Hunt down and kill ' + name, desc: 'Something called "' + name + '" is eating CPU. You do NOT know its PID. Find it and terminate it.',
            setup: (sh) => addRogue(sh, name, pid), solution: 'pkill -f ' + name, hints: ['Find the PID with ps aux | grep ' + name + ' or pgrep.', 'pkill kills by name pattern.', 'pkill -f ' + name],
            check: { state: (sh) => !H.procAlive(sh, (p) => p.pid === pid) && H.procAlive(sh, (p) => p.pid === 1) }
        };
    });
    tpl('killall', 'Processes', 'advanced', 6, 70, (r) => {
        const name = r.pick(['worker', 'crawler', 'renderer', 'encoder']);
        const pids = [r.int(3000, 3999), r.int(4000, 4999), r.int(5000, 5999)];
        return {
            title: 'Stop all ' + name + ' processes', desc: 'Three processes named ' + name + ' are running. Stop all of them with one command.',
            setup: (sh) => { for (const p of pids) sh.system.processes.push({ pid: p, ppid: 1, user: 'user', cmd: name + ' --job ' + p, stat: 'S', cpu: 5, mem: 1, vsz: 9000, rss: 3000, tty: '?', start: Date.now() }); },
            solution: 'killall ' + name, hints: ['killall kills by exact name; pkill by pattern.', 'killall ' + name],
            check: { state: (sh) => pids.every((p) => !H.procAlive(sh, (x) => x.pid === p)) }
        };
    });
    tpl('bg-job', 'Processes', 'intermediate', 6, 45, (r) => {
        const secs = r.pick([120, 300, 600, 900, 1200, 3600]);
        return {
            title: 'Start "sleep ' + secs + '" in the background', desc: 'Start the command sleep ' + secs + ' as a background job so you get your prompt back immediately.',
            solution: 'sleep ' + secs + ' &', hints: ['Append & to run a command in the background.', 'sleep ' + secs + ' &'],
            check: { state: (sh) => H.procAlive(sh, (p) => /^sleep\s+/.test(p.cmd) && p.cmd.includes(String(secs))) }
        };
    });
    tpl('top-cpu', 'Processes', 'advanced', 6, 65, (r) => {
        const name = r.pick(ROGUE);
        const pid = r.int(3000, 9000);
        return {
            title: 'Which process uses the most CPU?', desc: 'Print the PID of the process with the highest CPU usage.',
            setup: (sh) => { sh.system.processes = sh.system.processes.filter((p) => p.pid !== 2187); addRogue(sh, name, pid, 'user', 97.3); },
            solution: 'ps -eo pid --sort=-%cpu --no-headers | head -n 1', hints: ['ps can sort: --sort=-%cpu', 'top -b -n 1 also shows the busiest first.', 'ps -eo pid --sort=-%cpu --no-headers | head -n 1'],
            check: { match: (out) => H.lines(out).length <= 2 && H.tokens(out).includes(String(pid)) }
        };
    });
    tpl('count-procs', 'Processes', 'intermediate', 5, 45, (r) => {
        const u = r.pick(['www-data', 'root', 'user', 'syslog']);
        return {
            title: 'How many processes does ' + u + ' run?', desc: 'Print the number of processes owned by ' + u + ' (just the number).',
            solution: 'pgrep -u ' + u + ' | wc -l', hints: ['pgrep -u USER lists their PIDs.', 'Count lines with wc -l.'],
            check: { match: (out, sh) => { const n = sh.system.processes.filter((p) => p.user === u).length + (u === 'user' ? 0 : 0); return H.tokens(out).length === 1 && Math.abs(H.firstNumber(out) - n) <= 2; } }
        };
    });

    // ============ SYSTEM INFO & SERVICES ============
    tpl('sysinfo', 'System Information', 'beginner', 10, 20, (r) => {
        const v = r.pick([['hostname', 'the machine\'s host name'], ['uname -r', 'the kernel release'], ['uname -m', 'the machine hardware architecture'], ['nproc', 'the number of CPUs'], ['uname -s', 'the kernel name'], ['cat /etc/hostname', 'the content of /etc/hostname'], ['free -h', 'memory usage in human readable units'], ['df -h', 'disk space usage in human readable units'], ['lsb_release', 'the OS release']]);
        if (v[0] === 'lsb_release') v[0] = 'cat /etc/os-release';
        return { title: 'System info: ' + v[1], desc: 'Print ' + v[1] + '.', solution: v[0], hints: ['Useful commands: hostname, uname, nproc, free, df, cat /etc/os-release.', v[0]], check: 'output' };
    });
    tpl('date-fmt', 'System Information', 'intermediate', 8, 40, (r) => {
        const v = r.pick([
            ['+%Y', 'the current year (4 digits)', /^\d{4}$/, () => String(new Date().getFullYear())],
            ['+%F', "today's date as YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/, () => U.strftime('%F', new Date())],
            ['+%H:%M', 'the current time as HH:MM', /^\d{2}:\d{2}$/, null],
            ['+%A', 'the full name of today\'s weekday', /^[A-Z][a-z]+day$/, () => U.strftime('%A', new Date())],
            ['+%s', 'the current Unix timestamp (seconds since 1970)', /^\d{10}$/, null],
            ['+%B', 'the full name of the current month', /^[A-Z][a-z]+$/, () => U.strftime('%B', new Date())],
            ['+%d/%m/%Y', "today's date as DD/MM/YYYY", /^\d{2}\/\d{2}\/\d{4}$/, () => U.strftime('%d/%m/%Y', new Date())],
            ['+%j', 'the day of the year (001-366)', /^\d{3}$/, () => U.strftime('%j', new Date())]
        ]);
        return {
            title: 'Date format: ' + v[1], desc: 'Print ' + v[1] + ' - and nothing else.', solution: 'date ' + q(v[0]),
            hints: ['date accepts a +FORMAT argument.', 'See man date for %Y %m %d %H %M ...', 'date ' + q(v[0])],
            check: { match: (out) => { const s = H.norm(out); return v[2].test(s) && (!v[3] || s === v[3]()); } }
        };
    });
    tpl('uptime', 'System Information', 'beginner', 2, 20, (r) => {
        const pretty = r.bool();
        return { title: pretty ? 'Pretty uptime' : 'How long has the system been up?', desc: pretty ? 'Print how long the machine has been running in "pretty" format (e.g. up 3 days, 4 hours, ...).' : 'Print how long the system has been running, together with the load average.', solution: pretty ? 'uptime -p' : 'uptime', hints: ['uptime'], check: { match: (out) => /up /.test(out) && (pretty ? /^up /.test(H.norm(out)) : /load average/.test(out)) } };
    });
    const SVC_START = ['apache2', 'mysql'];
    tpl('svc-start', 'Services', 'intermediate', 10, 50, (r) => {
        const s = r.pick(SVC_START.concat(['nginx', 'cron', 'ssh', 'docker']));
        return {
            title: 'Start the ' + s + ' service', desc: 'The ' + s + ' service is stopped. Start it.',
            setup: (sh) => { if (sh.system.services[s].active) sh.system.stopService(s); }, solution: 'sudo systemctl start ' + s,
            hints: ['systemctl controls services.', 'Changing services requires root.', 'sudo systemctl start ' + s], check: { state: (sh) => sh.system.services[s].active }
        };
    });
    tpl('svc-stop', 'Services', 'intermediate', 8, 50, (r) => {
        const s = r.pick(['nginx', 'cron', 'ssh', 'docker', 'rsyslog', 'apache2', 'mysql']);
        return {
            title: 'Stop the ' + s + ' service', desc: 'Stop the running ' + s + ' service.',
            setup: (sh) => { if (!sh.system.services[s].active) sh.system.startService(s); }, solution: 'sudo systemctl stop ' + s,
            hints: ['systemctl stop UNIT', 'sudo systemctl stop ' + s], check: { state: (sh) => !sh.system.services[s].active }
        };
    });
    tpl('svc-enable', 'Services', 'intermediate', 6, 50, (r) => {
        const s = r.pick(['apache2', 'mysql']);
        return {
            title: 'Start ' + s + ' at boot', desc: 'Make sure ' + s + ' starts automatically at boot AND is running right now.',
            solution: 'sudo systemctl enable --now ' + s, hints: ['enable = start at boot. --now also starts it immediately.', 'sudo systemctl enable --now ' + s],
            check: { state: (sh) => sh.system.services[s].enabled && sh.system.services[s].active }
        };
    });
    tpl('svc-restart-failed', 'Services', 'advanced', 4, 70, (r) => {
        const s = r.pick(['nginx', 'ssh', 'cron', 'docker']);
        return {
            title: 'Recover the failed ' + s + ' service', desc: 'The ' + s + ' service crashed (state: failed). Inspect it with systemctl status and bring it back up.',
            setup: (sh) => { sh.system.stopService(s); sh.system.services[s].failed = true; sh.system.log(s, s + '.service: Main process exited, code=exited, status=1/FAILURE'); },
            solution: 'sudo systemctl restart ' + s, hints: ['systemctl status ' + s + ' shows why it failed.', 'sudo systemctl restart ' + s],
            check: { state: (sh) => sh.system.services[s].active && !sh.system.services[s].failed }
        };
    });
    tpl('svc-is-active', 'Services', 'beginner', 4, 30, (r) => {
        const s = r.pick(['ssh', 'nginx', 'cron', 'apache2']);
        return {
            title: 'Is ' + s + ' running?', desc: 'Print the one-word activity state of the ' + s + ' service (e.g. "active" or "inactive").',
            solution: 'systemctl is-active ' + s, hints: ['systemctl has an is-active verb that prints a single word.'], check: 'output'
        };
    });
    tpl('auth-failed', 'Security', 'advanced', 6, 70, (r) => {
        const n = r.int(4, 12);
        const lines = [];
        for (let i = 0; i < n; i++) lines.push('Nov  4 0' + (i % 9) + ':1' + (i % 6) + ':0' + (i % 9) + ' linux-arsenal sshd[' + (5000 + i) + ']: Failed password for root from 203.0.113.' + r.int(1, 254) + ' port ' + r.int(30000, 60000) + ' ssh2');
        for (let i = 0; i < r.int(3, 8); i++) lines.splice(r.int(0, lines.length), 0, 'Nov  4 07:0' + i + ':00 linux-arsenal sshd[600' + i + ']: Accepted publickey for user from 192.168.1.15 port 5000' + i + ' ssh2');
        const f = r.pick(['auth.log', 'secure.log', 'ssh.log']);
        return {
            title: 'Count failed SSH logins in ' + f, desc: 'How many "Failed password" attempts are recorded in ' + f + '? Print the number.',
            files: { [f]: L(lines) }, solution: "grep -c 'Failed password' " + f, hints: ['grep -c counts matching lines.', "grep -c 'Failed password' " + f],
            check: { match: (out) => H.tokens(out).length === 1 && H.firstNumber(out) === n }
        };
    });
    const CRONS = [
        ['every day at 03:00', '0 3 * * *'], ['every day at 23:30', '30 23 * * *'], ['every 15 minutes', '*/15 * * * *'], ['every hour, on the hour', '0 * * * *'],
        ['every Monday at 08:00', '0 8 * * 1'], ['on the 1st of every month at midnight', '0 0 1 * *'], ['every 5 minutes', '*/5 * * * *'], ['every Sunday at 04:30', '30 4 * * 0'],
        ['every weekday (Mon-Fri) at 09:00', '0 9 * * 1-5'], ['every day at 12:00 noon', '0 12 * * *']
    ];
    function cronMatch(line, spec, cmd) {
        const p = line.trim().split(/\s+/);
        if (p.length < 6) return false;
        const want = spec.split(' ');
        const norm = (x, i) => (i === 4 ? x.replace(/^7$/, '0').toLowerCase().replace('sun', '0').replace('mon', '1').replace('mon-fri', '1-5') : x).replace(/^0(\d)$/, '$1');
        return want.every((w, i) => norm(p[i], i) === norm(w, i)) && p.slice(5).join(' ') === cmd;
    }
    tpl('crontab', 'Services', 'advanced', 12, 70, (r) => {
        const [when, spec] = r.pick(CRONS);
        const cmd = '/home/user/scripts/' + r.pick(['backup', 'cleanup', 'report', 'sync', 'rotate']) + '.sh';
        return {
            title: 'Schedule ' + cmd.split('/').pop() + ' ' + when, desc: 'Add a cron job for your user that runs ' + cmd + ' ' + when + '.',
            files: { ['scripts/' + cmd.split('/').pop()]: { content: '#!/bin/bash\necho done\n', mode: 0o755 } },
            setup: (sh) => { sh.system.crontabs.user = ''; LA.asRoot(sh, () => { if (sh.fs.exists('/var/spool/cron/crontabs/user')) sh.fs.unlink('/var/spool/cron/crontabs/user'); }); },
            solution: 'echo "' + spec + ' ' + cmd + '" | crontab -', hints: ['A cron line is: minute hour day month weekday command.', when + ' is: ' + spec, 'crontab -e to edit, or: echo "LINE" | crontab -'],
            check: { state: (sh) => (sh.system.crontabs.user || '').split('\n').some((l) => cronMatch(l, spec, cmd)) }
        };
    });

    // ============ PACKAGES ============
    const INSTALLABLE = ['htop', 'cowsay', 'sl', 'figlet', 'jq', 'nmap', 'neofetch', 'fortune-mod', 'cmatrix', 'ripgrep', 'tmux', 'redis-server', 'nodejs', 'golang'];
    tpl('apt-install', 'Package Management', 'intermediate', 12, 45, (r) => {
        const p = r.pick(INSTALLABLE);
        return {
            title: 'Install the package ' + p, desc: 'Install the ' + p + ' package with the package manager.',
            solution: 'sudo apt install -y ' + p, hints: ['apt installs packages.', 'Installing software needs root.', 'sudo apt install ' + p],
            check: { state: (sh) => !!sh.system.packages[p] }
        };
    });
    tpl('apt-remove', 'Package Management', 'intermediate', 5, 45, (r) => {
        const p = r.pick(['tree', 'nano', 'zip', 'traceroute', 'bc', 'curl']);
        return {
            title: 'Uninstall ' + p, desc: 'Remove the installed package ' + p + '.',
            solution: 'sudo apt remove -y ' + p, hints: ['apt remove PKG (as root).'], check: { state: (sh) => !sh.system.packages[p] }
        };
    });
    tpl('apt-use', 'Package Management', 'intermediate', 6, 55, (r) => {
        const word = r.pick(['Moo', 'Hello', 'Linux rocks', 'Root access', 'Bash is fun', 'Grep me']);
        return {
            title: 'Make a cow say "' + word + '"', desc: 'The cowsay program is not installed. Install it and make the cow say "' + word + '".',
            solution: 'sudo apt install -y cowsay && cowsay ' + q(word), hints: ['Try running cowsay: the error tells you how to install it.', 'sudo apt install cowsay', 'cowsay "' + word + '"'],
            check: { match: (out, sh) => out.includes(word) && out.includes('^__^') && !!sh.system.packages.cowsay }
        };
    });
    tpl('dpkg-version', 'Package Management', 'intermediate', 4, 40, (r) => {
        const p = r.pick(['nginx', 'git', 'curl', 'bash', 'vim', 'openssh-server']);
        return {
            title: 'Which version of ' + p + ' is installed?', desc: 'Print the "Version:" line of the installed ' + p + ' package.',
            solution: 'dpkg -s ' + p + ' | grep Version', hints: ['dpkg -s PKG shows package status.', 'Filter with grep Version.'], check: { match: (out) => H.norm(out) === 'Version: ' + LA.PACKAGES[p].v }
        };
    });

    // ============ NETWORKING ============
    tpl('ping', 'Networking', 'beginner', 12, 30, (r) => {
        const host = r.pick(POOL.hosts.slice(0, 11));
        const n = r.int(1, 6);
        return {
            title: 'Send exactly ' + n + ' ping' + (n > 1 ? 's' : '') + ' to ' + host, desc: 'Check whether ' + host + ' is reachable by sending exactly ' + n + ' ICMP echo request' + (n > 1 ? 's' : '') + '.',
            solution: 'ping -c ' + n + ' ' + host, hints: ['ping keeps going unless you give it a count.', 'ping -c COUNT HOST'],
            check: { match: (out) => new RegExp('^' + n + ' packets transmitted').test(H.lines(out).find((l) => /packets transmitted/.test(l)) || '') && out.includes(host) }
        };
    });
    tpl('dns', 'Networking', 'beginner', 12, 30, (r) => {
        const host = r.pick(POOL.hosts.filter((h) => h !== 'localhost'));
        const ip = LA.NET.HOSTS[host];
        return {
            title: 'IP address of ' + host, desc: 'Look up the IP address of ' + host + ' using a DNS tool.',
            solution: 'dig +short ' + host, hints: ['nslookup, host and dig resolve names.', 'dig +short ' + host],
            check: { match: (out) => out.includes(ip) }
        };
    });
    tpl('curl', 'Networking', 'beginner', 8, 30, (r) => {
        const url = r.pick(['https://example.com', 'https://httpbin.org/ip', 'https://httpbin.org/get', 'https://linux-arsenal.dev/motd.txt', 'https://linux-arsenal.dev/api/status', 'https://api.github.com/users/octocat', 'https://httpbin.org/user-agent', 'https://linux-arsenal.dev/data.csv']);
        return {
            title: 'Fetch ' + url.replace('https://', ''), desc: 'Print the body of the web resource ' + url + ' in your terminal.',
            solution: 'curl -s ' + url, hints: ['curl transfers URLs and prints the body.', 'curl ' + url], check: 'output'
        };
    });
    tpl('wget', 'Networking', 'beginner', 8, 35, (r) => {
        const url = r.pick(['https://linux-arsenal.dev/data.csv', 'https://linux-arsenal.dev/install.sh', 'https://linux-arsenal.dev/motd.txt']);
        const name = url.split('/').pop();
        const body = LA.NET.WEB['linux-arsenal.dev/' + name].body;
        const d = r.bool() ? r.pick(['downloads', 'inbox', 'tmp_dl']) : null;
        return {
            title: 'Download ' + name + (d ? ' into ' + d + '/' : ''), desc: 'Download ' + url + ' and save it as ' + (d ? d + '/' : '') + name + '.',
            dirs: d ? [d] : [], solution: d ? 'wget -P ' + d + ' ' + url : 'wget ' + url, hints: ['wget downloads files; curl -O does too.', d ? 'wget -P DIR URL  or  curl -o ' + d + '/' + name + ' URL' : 'wget ' + url],
            check: { state: (sh) => H.content(sh, (d ? d + '/' : '') + name) === body }
        };
    });
    tpl('http-code', 'Networking', 'intermediate', 6, 50, (r) => {
        const [url, code] = r.pick([['https://example.com', '200'], ['https://example.com/missing-page', '404'], ['https://httpbin.org/status/418', '418'], ['https://httpbin.org/status/503', '503'], ['https://linux-arsenal.dev/', '200'], ['https://httpbin.org/status/201', '201']]);
        return {
            title: 'HTTP status code of ' + url.replace('https://', ''), desc: 'Print ONLY the HTTP status code returned by ' + url + ' (e.g. 200).',
            solution: 'curl -s -o /dev/null -w "%{http_code}" ' + url, hints: ['curl -w can print variables like %{http_code}.', 'Discard the body with -o /dev/null.', 'curl -s -o /dev/null -w "%{http_code}" ' + url],
            check: { match: (out) => H.norm(out) === code }
        };
    });
    tpl('listen-ports', 'Networking', 'intermediate', 4, 45, (r) => ({
        title: 'Which TCP ports are listening?', desc: 'Show the TCP sockets in LISTEN state, with numeric port numbers.',
        solution: 'ss -tln', hints: ['ss (or netstat) shows sockets.', '-t TCP, -l listening, -n numeric.'],
        check: { match: (out) => /LISTEN/.test(out) && /:22\b/.test(out) && /:80\b/.test(out) }
    }));
    tpl('my-ip', 'Networking', 'beginner', 3, 25, (r) => ({
        title: 'What is my IP address?', desc: 'Show the IP addresses of this machine\'s network interfaces.',
        solution: 'ip addr', hints: ['ip addr (or ifconfig, or hostname -I)'], check: { match: (out) => out.includes('192.168.1.100') }
    }));
    tpl('ufw-allow', 'Security', 'intermediate', 10, 55, (r) => {
        const [port, label] = r.pick([['3306', '3306'], ['8080', '8080'], ['5432', '5432'], ['6379', '6379'], ['25', '25'], ['53', '53'], ['21', '21'], ['8443', '8443'], ['9090', '9090'], ['2222', '2222']]);
        const proto = r.pick(['tcp', null]);
        return {
            title: 'Open port ' + label + (proto ? '/' + proto : '') + ' in the firewall', desc: 'Add a firewall rule (ufw) that allows incoming traffic on port ' + port + (proto ? '/' + proto : '') + '.',
            solution: 'sudo ufw allow ' + port + (proto ? '/' + proto : ''), hints: ['ufw is the uncomplicated firewall.', 'sudo ufw allow PORT[/PROTO]'],
            check: { state: (sh) => sh.system.firewall.rules.some((x) => x.startsWith(port + (proto ? '/' + proto : '')) && x.includes('ALLOW')) }
        };
    });
    tpl('ufw-deny', 'Security', 'intermediate', 6, 55, (r) => {
        const port = r.pick(['23', '3389', '445', '139', '5900', '111']);
        return {
            title: 'Block port ' + port, desc: 'Add a firewall rule that denies incoming traffic on port ' + port + '.',
            solution: 'sudo ufw deny ' + port, hints: ['sudo ufw deny PORT'], check: { state: (sh) => sh.system.firewall.rules.some((x) => x.startsWith(port + ' ') && x.includes('DENY')) }
        };
    });

    // ============ ARCHIVES ============
    tpl('tar-c', 'Archives', 'intermediate', 12, 50, (r) => {
        const d = r.pick(POOL.dirs);
        const a = d + '_' + r.pick(['backup', 'archive', 'snapshot', 'export']) + '.tar.gz';
        const fs = r.sample(POOL.bases, 3);
        const files = {};
        for (const f of fs) files[d + '/' + f + '.txt'] = f + '\n';
        return {
            title: 'Create ' + a, desc: 'Create a gzip-compressed tar archive named ' + a + ' containing the directory ' + d + '/.',
            files, solution: 'tar -czf ' + a + ' ' + d, hints: ['tar: c=create, z=gzip, f=file name.', 'tar -czf ARCHIVE DIR', 'tar -czf ' + a + ' ' + d],
            check: { state: (sh) => { const e = H.tar(sh, a); return !!e && fs.every((f) => e.some((x) => x.p === d + '/' + f + '.txt' && x.c === f + '\n')) && LA.archive.gzipDecode(H.content(sh, a)) !== null; } }
        };
    });
    tpl('tar-x', 'Archives', 'intermediate', 10, 50, (r) => {
        const d = r.pick(POOL.dirs);
        const a = r.pick(['release', 'payload', 'site', 'dataset', 'bundle']) + '.tar.gz';
        const fs = r.sample(POOL.bases, 3);
        return {
            title: 'Extract ' + a, desc: 'Extract the archive ' + a + ' into your home directory. It contains a folder named ' + d + '.',
            setup: (sh) => {
                LA.asRoot(sh, () => {});
                for (const f of fs) { sh.fs.mkdir(HOME + '/' + d, { parents: true }); sh.fs.writeFile(HOME + '/' + d + '/' + f + '.txt', f + '\n'); }
                sh.exec('tar -czf ' + a + ' ' + d + ' && rm -r ' + d);
            },
            solution: 'tar -xzf ' + a, hints: ['tar: x=extract.', 'tar -xzf ' + a],
            check: { state: (sh) => fs.every((f) => H.content(sh, d + '/' + f + '.txt') === f + '\n') }
        };
    });
    tpl('tar-t', 'Archives', 'intermediate', 6, 40, (r) => {
        const d = r.pick(POOL.dirs);
        const a = r.pick(['mystery', 'unknown', 'delivery', 'parcel']) + '.tar';
        const fs = r.sample(POOL.bases, 4);
        return {
            title: 'Peek inside ' + a + ' without extracting', desc: 'List the contents of the archive ' + a + ' without extracting it.',
            setup: (sh) => { for (const f of fs) { sh.fs.mkdir(HOME + '/' + d, { parents: true }); sh.fs.writeFile(HOME + '/' + d + '/' + f, f + '\n'); } sh.exec('tar -cf ' + a + ' ' + d + ' && rm -r ' + d); },
            solution: 'tar -tf ' + a, hints: ['tar: t=list.', 'tar -tf ' + a], check: 'output'
        };
    });
    tpl('gzip', 'Archives', 'beginner', 8, 35, (r) => {
        const f = r.pick(POOL.bases) + '.log';
        const text = L(r.sample(POOL.words, 10));
        return {
            title: 'Compress ' + f + ' with gzip', desc: 'Compress ' + f + ' with gzip, so that it becomes ' + f + '.gz.',
            files: { [f]: text }, solution: 'gzip ' + f, hints: ['gzip FILE replaces it with FILE.gz.'],
            check: { state: (sh) => { const g = LA.archive.gzipDecode(H.content(sh, f + '.gz') || ''); return !!g && g.c === text && !H.exists(sh, f); } }
        };
    });
    tpl('gunzip', 'Archives', 'beginner', 6, 35, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        const text = L(r.sample(POOL.fruits, 5));
        return {
            title: 'Decompress ' + f + '.gz', desc: 'Decompress ' + f + '.gz back into ' + f + '.',
            setup: (sh) => { sh.fs.writeFile(HOME + '/' + f + '.gz', LA.archive.gzipEncode(text, f)); }, solution: 'gunzip ' + f + '.gz', hints: ['gunzip (or gzip -d).'],
            check: { state: (sh) => H.content(sh, f) === text }
        };
    });
    tpl('zip', 'Archives', 'intermediate', 8, 45, (r) => {
        const d = r.pick(POOL.dirs);
        const z = d + '.zip';
        return {
            title: 'Zip up ' + d + '/', desc: 'Create ' + z + ' containing the directory ' + d + ' and all of its files.',
            files: { [d + '/one.txt']: '1\n', [d + '/two.txt']: '2\n' }, solution: 'zip -r ' + z + ' ' + d, hints: ['zip -r ARCHIVE DIR'],
            check: { state: (sh) => { const c = H.content(sh, z); if (!c || !c.startsWith('PK')) return false; try { const e = JSON.parse(LA.b64.decode(c.slice(4))); return e.some((x) => x.p === d + '/one.txt') && e.some((x) => x.p === d + '/two.txt'); } catch (er) { return false; } } }
        };
    });

    // ============ SHELL SCRIPTING ============
    tpl('export-var', 'Shell Scripting', 'beginner', 10, 30, (r) => {
        const name = r.pick(['APP_ENV', 'EDITOR', 'API_URL', 'LOG_LEVEL', 'PROJECT', 'REGION', 'DB_HOST', 'MODE']);
        const value = r.pick(['production', 'vim', 'https://api.local', 'debug', 'arsenal', 'eu-west-1', 'db.internal', 'safe']);
        return {
            title: 'Export ' + name + '=' + value, desc: 'Set the environment variable ' + name + ' to "' + value + '" and export it so child processes see it.',
            solution: 'export ' + name + '=' + value, hints: ['export NAME=VALUE'], check: { state: (sh) => { const v = sh.vars.get(name); return !!v && v.exported && v.value === value; } }
        };
    });
    tpl('alias', 'Shell Scripting', 'beginner', 10, 30, (r) => {
        const [name, cmd] = r.pick([['ll', 'ls -la'], ['gs', 'git status'], ['c', 'clear'], ['h', 'history'], ['..', 'cd ..'], ['ports', 'ss -tuln'], ['myip', 'hostname -I'], ['update', 'sudo apt update'], ['k', 'kill -9'], ['dfh', 'df -h']]);
        return {
            title: 'Create the alias "' + name + '"', desc: 'Define an alias named ' + name + ' that runs: ' + cmd,
            solution: "alias " + name + "='" + cmd + "'", hints: ["alias NAME='COMMAND'"], check: { state: (sh) => sh.aliases[name] === cmd }
        };
    });
    tpl('arith', 'Shell Scripting', 'beginner', 14, 25, (r) => {
        const a = r.int(2, 99), b = r.int(2, 30), c = r.int(1, 50);
        const op = r.pick(['*', '+', '-', '%']);
        const val = op === '*' ? a * b + c : op === '+' ? a + b + c : op === '-' ? a - b + c : (a % b) + c;
        const expr = a + ' ' + op + ' ' + b + ' + ' + c;
        return {
            title: 'Compute ' + expr, desc: 'Use the shell to calculate ' + expr + ' and print the result.',
            solution: 'echo $((' + expr + '))', hints: ['$(( ... )) performs integer arithmetic.', 'echo $((' + expr + '))'],
            check: { match: (out) => H.norm(out) === String(val) }
        };
    });
    tpl('loop-dirs', 'Shell Scripting', 'intermediate', 8, 50, (r) => {
        const base = r.pick(['day', 'week', 'sprint', 'test', 'module', 'level']);
        const n = r.int(3, 7);
        return {
            title: 'Create ' + base + '1 ... ' + base + n + ' with a loop', desc: 'Create directories ' + base + '1 through ' + base + n + '. Try a for loop: for i in $(seq 1 ' + n + '); do ...; done',
            solution: 'for i in $(seq 1 ' + n + '); do mkdir ' + base + '$i; done', hints: ['for VAR in LIST; do COMMANDS; done', 'seq 1 N produces numbers.', 'for i in $(seq 1 ' + n + '); do mkdir ' + base + '$i; done'],
            check: { state: (sh) => Array.from({ length: n }, (_, i) => base + (i + 1)).every((d) => H.isDir(sh, d)) }
        };
    });
    tpl('write-script', 'Shell Scripting', 'advanced', 10, 75, (r) => {
        const f = r.pick(['hello', 'greet', 'banner', 'motd', 'welcome']) + '.sh';
        const msg = r.pick(['Hello from my script', 'Linux is awesome', 'Automation rocks', 'Scripts save time', 'I am a bash pro']);
        return {
            title: 'Write and run the script ' + f, desc: 'Create a bash script ' + f + ' that prints "' + msg + '". Make it executable. Then run it.',
            solution: "printf '#!/bin/bash\\necho \"" + msg + "\"\\n' > " + f + ' && chmod +x ' + f + ' && ./' + f,
            hints: ['Start with the line #!/bin/bash, then an echo.', 'Use nano ' + f + ' or echo/printf with redirection.', 'chmod +x ' + f + ' && ./' + f],
            check: { state: (sh) => { if (!H.isFile(sh, f) || !(H.mode(sh, f) & 0o100)) return false; const clone = cloneShell(sh); const res = clone.exec(HOME + '/' + f); return H.norm(res.stdout) === H.norm(msg); } }
        };
    });
    tpl('print-var', 'Shell Scripting', 'beginner', 6, 20, (r) => {
        const v = r.pick(['HOME', 'USER', 'SHELL', 'PATH', 'PWD', 'HOSTNAME']);
        return { title: 'Show the value of $' + v, desc: 'Print the value of the ' + v + ' environment variable.', solution: 'echo $' + v, hints: ['Variables expand with $NAME.', 'echo $' + v], check: 'output' };
    });
    tpl('function', 'Shell Scripting', 'advanced', 6, 70, (r) => {
        const name = r.pick(['greet', 'hello', 'banner', 'shout', 'info']);
        const msg = r.pick(['Hi there', 'Welcome back', 'Linux Arsenal', 'Have fun']);
        return {
            title: 'Define a shell function ' + name, desc: 'Define a shell function named ' + name + ' that prints "' + msg + '". Then call it.',
            solution: name + '() { echo "' + msg + '"; }; ' + name, hints: ['name() { commands; }', name + '() { echo "' + msg + '"; }'],
            check: { match: (out, sh) => !!sh.functions[name] && H.norm(out) === msg }
        };
    });
    tpl('exit-status', 'Shell Scripting', 'intermediate', 4, 40, (r) => {
        const cmd = r.pick([['ls /does/not/exist', 2], ['false', 1], ['grep nothing_here /etc/hostname', 1], ['cat /no/such/file', 1]]);
        return {
            title: 'Exit status of "' + cmd[0] + '"', desc: 'Run ' + cmd[0] + ' and then print its exit status (the special variable $?).',
            solution: cmd[0] + '; echo $?', hints: ['$? holds the exit status of the last command.', cmd[0] + '; echo $?'],
            check: { match: (out) => H.tokens(out).slice(-1)[0] === String(cmd[1]) }
        };
    });
    tpl('and-cd', 'Shell Scripting', 'beginner', 6, 30, (r) => {
        const d = r.pick(POOL.dirs) + '_' + r.int(1, 99);
        return {
            title: 'Make ' + d + ' and step into it', desc: 'Create the directory ' + d + ' and, only if that succeeded, change into it - in one line using &&.',
            solution: 'mkdir ' + d + ' && cd ' + d, hints: ['A && B runs B only if A succeeds.'], check: { state: (sh) => sh.cwd === HOME + '/' + d }
        };
    });
    tpl('glob-rm', 'Files & Navigation', 'intermediate', 10, 40, (r) => {
        const ext = r.pick(['tmp', 'bak', 'swp', 'old', 'cache']);
        const d = r.pick(POOL.dirs);
        const files = {};
        const del = [], keep = [];
        for (const b of r.sample(POOL.bases, 6)) {
            const isDel = r.bool() || !del.length;
            const p = d + '/' + b + '.' + (isDel ? ext : r.pick(['txt', 'md', 'csv']));
            files[p] = 'x\n';
            (isDel ? del : keep).push(p);
        }
        if (!keep.length) { const p = d + '/keep.txt'; files[p] = 'k\n'; keep.push(p); }
        return {
            title: 'Delete every .' + ext + ' file in ' + d + '/', desc: 'Remove all files ending in .' + ext + ' from ' + d + '/ but keep every other file.',
            files, solution: 'rm ' + d + '/*.' + ext, hints: ['* is a wildcard (glob).', 'rm ' + d + '/*.' + ext],
            check: { state: (sh) => del.every((p) => !H.exists(sh, p)) && keep.every((p) => H.isFile(sh, p)) }
        };
    });
    tpl('glob-cp', 'Files & Navigation', 'intermediate', 8, 40, (r) => {
        const ext = r.pick(['jpg', 'png', 'pdf', 'mp3', 'csv']);
        const [src, dst] = r.sample(POOL.dirs, 2);
        const files = {};
        const wanted = [];
        for (const b of r.sample(POOL.bases, 5)) { const e = r.bool() || !wanted.length ? ext : 'txt'; files[src + '/' + b + '.' + e] = b + '\n'; if (e === ext) wanted.push(b + '.' + ext); }
        return {
            title: 'Copy all .' + ext + ' files from ' + src + '/ to ' + dst + '/', desc: 'Copy every .' + ext + ' file from ' + src + '/ into ' + dst + '/ (which exists). Do not copy other files.',
            files, dirs: [dst], solution: 'cp ' + src + '/*.' + ext + ' ' + dst + '/', hints: ['Use a glob as the source.', 'cp ' + src + '/*.' + ext + ' ' + dst + '/'],
            check: { state: (sh) => wanted.every((w) => H.isFile(sh, dst + '/' + w)) && sh.fs.list(HOME + '/' + dst).length === wanted.length }
        };
    });
    tpl('path-bin', 'Shell Scripting', 'advanced', 4, 70, (r) => {
        const cmd = r.pick(['hello', 'mytool', 'greet', 'arsenal']);
        return {
            title: 'Run your own command "' + cmd + '" from anywhere', desc: 'The executable script ~/bin/' + cmd + ' exists, but typing ' + cmd + ' says "command not found". Add ~/bin to your PATH so that ' + cmd + ' works.',
            files: { ['bin/' + cmd]: { content: '#!/bin/bash\necho "' + cmd + ' works!"\n', mode: 0o755 } },
            solution: 'export PATH="$HOME/bin:$PATH"', hints: ['PATH lists directories searched for commands, separated by ":".', 'export PATH="$HOME/bin:$PATH"'],
            check: { state: (sh) => (sh.getVar('PATH') || '').split(':').some((p) => p === HOME + '/bin' || p === '~/bin') }
        };
    });

    // ============ GIT ============
    function gitRepo(sh, dir, files, commits) {
        const abs = HOME + '/' + dir;
        sh.exec('mkdir -p ' + abs + ' && cd ' + abs + ' && git init -q .');
        for (const [n, c] of Object.entries(files || {})) sh.fs.writeFile(abs + '/' + n, c);
        for (const msg of commits || []) sh.exec('cd ' + abs + ' && git add -A && git commit -q -m ' + q(msg) + ' --allow-empty');
        sh.cwd = HOME; sh.setVar('PWD', HOME);
    }
    tpl('git-init', 'Git', 'beginner', 6, 35, (r) => {
        const d = r.pick(['myproject', 'webapp', 'dotfiles', 'notes-repo', 'scripts-repo', 'homework']);
        return {
            title: 'Turn ' + d + '/ into a git repository', desc: 'Initialize a new git repository inside the existing directory ' + d + '.',
            files: { [d + '/README.md']: '# ' + d + '\n' }, solution: 'cd ' + d + ' && git init', hints: ['git init creates a repository in the current directory.'],
            check: { state: (sh) => !!H.git(sh, d) }
        };
    });
    tpl('git-commit', 'Git', 'intermediate', 10, 50, (r) => {
        const d = r.pick(['blog', 'api', 'game', 'cli-tool', 'website', 'thesis']);
        const msg = r.pick(['Initial commit', 'Add project files', 'First version', 'Import sources', 'Start project']);
        const files = { [d + '/main.py']: 'print("hi")\n', [d + '/README.md']: '# ' + d + '\n' };
        return {
            title: 'First commit in ' + d + '/', desc: d + '/ is a git repo with untracked files. Stage ALL files and commit them with the message "' + msg + '".',
            files, setup: (sh) => gitRepo(sh, d, {}, []), solution: 'cd ' + d + ' && git add . && git commit -m ' + q(msg),
            hints: ['git add stages files; git commit records them.', 'git add .', 'git commit -m "' + msg + '"'],
            check: { state: (sh) => { const st = H.git(sh, d); if (!st) return false; const head = st.branches[st.head]; return !!head && st.commits[head].msg === msg && 'main.py' in st.commits[head].tree && 'README.md' in st.commits[head].tree; } }
        };
    });
    tpl('git-branch', 'Git', 'intermediate', 8, 45, (r) => {
        const d = r.pick(['shop', 'portal', 'engine', 'docs-site']);
        const b = r.pick(['feature/login', 'bugfix', 'dev', 'experiment', 'feature/search', 'hotfix', 'release-1.0', 'refactor']);
        return {
            title: 'Create the branch ' + b + ' in ' + d, desc: 'In the repository ' + d + '/, create a new branch named ' + b + '.',
            setup: (sh) => gitRepo(sh, d, { 'app.txt': 'v1\n' }, ['Initial commit']), solution: 'cd ' + d + ' && git branch ' + b,
            hints: ['git branch NAME creates a branch (git switch -c also switches to it).'], check: { state: (sh) => { const st = H.git(sh, d); return !!st && b in st.branches; } }
        };
    });
    tpl('git-switch', 'Git', 'intermediate', 6, 45, (r) => {
        const d = r.pick(['shop', 'portal', 'engine']);
        const b = r.pick(['develop', 'staging', 'feature-x', 'gh-pages']);
        return {
            title: 'Switch to the ' + b + ' branch', desc: 'The repo ' + d + '/ already has a branch ' + b + '. Make it the current branch.',
            setup: (sh) => { gitRepo(sh, d, { 'a.txt': 'a\n' }, ['init']); sh.exec('cd ' + HOME + '/' + d + ' && git branch ' + b); sh.cwd = HOME; },
            solution: 'cd ' + d + ' && git switch ' + b, hints: ['git switch BRANCH  (or git checkout BRANCH)'], check: { state: (sh) => { const st = H.git(sh, d); return !!st && st.head === b && !st.detached; } }
        };
    });
    tpl('git-commit-change', 'Git', 'intermediate', 8, 55, (r) => {
        const d = r.pick(['app', 'site', 'lib']);
        const f = r.pick(['config.yml', 'index.html', 'main.c', 'notes.md']);
        const msg = r.pick(['Update config', 'Fix typo', 'Improve wording', 'Bump version']);
        return {
            title: 'Commit your change to ' + f, desc: 'In ' + d + '/ the file ' + f + ' was modified but not committed. Commit the change with message "' + msg + '" so that git status is clean.',
            setup: (sh) => { gitRepo(sh, d, { [f]: 'version 1\n' }, ['Initial commit']); sh.fs.writeFile(HOME + '/' + d + '/' + f, 'version 2\n'); },
            solution: 'cd ' + d + ' && git commit -am ' + q(msg), hints: ['git status shows the modified file.', 'git add FILE then git commit -m MSG (or git commit -am).'],
            check: { state: (sh) => { const st = H.git(sh, d); if (!st) return false; const h = st.branches[st.head]; return st.commits[h].msg === msg && st.commits[h].tree[f] === 'version 2\n'; } }
        };
    });
    tpl('git-log-count', 'Git', 'intermediate', 5, 40, (r) => {
        const d = r.pick(['history', 'timeline', 'chronicle']);
        const n = r.int(3, 8);
        const msgs = Array.from({ length: n }, (_, i) => 'Change number ' + (i + 1));
        return {
            title: 'How many commits does ' + d + ' have?', desc: 'Count the commits in the repository ' + d + '/ and print the number.',
            setup: (sh) => gitRepo(sh, d, { 'f.txt': 'x\n' }, msgs), solution: 'cd ' + d + ' && git log --oneline | wc -l',
            hints: ['git log --oneline prints one line per commit.', 'Count lines with wc -l (or git rev-list --count HEAD).'], check: { match: (out) => H.tokens(out).length === 1 && H.firstNumber(out) === n }
        };
    });
    tpl('git-merge', 'Git', 'advanced', 6, 75, (r) => {
        const d = r.pick(['product', 'service', 'platform']);
        const b = r.pick(['feature', 'feature-auth', 'improvements', 'new-ui']);
        return {
            title: 'Merge ' + b + ' into main', desc: 'In ' + d + '/ the branch ' + b + ' has a new commit that adds feature.txt. Merge ' + b + ' into main (you must be on main).',
            setup: (sh) => { gitRepo(sh, d, { 'base.txt': 'base\n' }, ['Initial commit']); sh.exec('cd ' + HOME + '/' + d + ' && git switch -q -c ' + b + ' && echo feature > feature.txt && git add . && git commit -q -m "Add feature" && git switch -q main'); sh.cwd = HOME; },
            solution: 'cd ' + d + ' && git merge ' + b, hints: ['Make sure you are on main: git branch', 'git merge BRANCH'],
            check: { state: (sh) => { const st = H.git(sh, d); if (!st) return false; const h = st.branches.main; return !!h && st.commits[h].tree['feature.txt'] === 'feature\n'; } }
        };
    });
    tpl('git-restore', 'Git', 'intermediate', 6, 50, (r) => {
        const d = r.pick(['oops', 'careful', 'project']);
        const f = r.pick(['important.txt', 'data.csv', 'settings.ini']);
        return {
            title: 'Undo the accidental edit of ' + f, desc: 'Someone overwrote ' + f + ' in ' + d + '/ with garbage (not committed). Restore it to the last committed version.',
            setup: (sh) => { gitRepo(sh, d, { [f]: 'precious data\n' }, ['Initial commit']); sh.fs.writeFile(HOME + '/' + d + '/' + f, 'GARBAGE\n'); },
            solution: 'cd ' + d + ' && git restore ' + f, hints: ['git restore FILE discards working tree changes (git checkout -- FILE too).'],
            check: { state: (sh) => H.content(sh, d + '/' + f) === 'precious data\n' }
        };
    });
    tpl('git-config', 'Git', 'beginner', 4, 35, (r) => {
        const name = cap(r.pick(POOL.names)) + ' ' + cap(r.pick(POOL.animals));
        return {
            title: 'Set your git name to "' + name + '"', desc: 'Configure git (globally) so that your commits are authored by "' + name + '".',
            setup: (sh) => { if (sh.fs.exists(HOME + '/.gitconfig')) sh.fs.unlink(HOME + '/.gitconfig'); }, solution: 'git config --global user.name ' + q(name),
            hints: ['git config --global user.name "Your Name"'], check: { state: (sh) => /name\s*=\s*(.*)/.test(H.content(sh, '.gitconfig') || '') && /name\s*=\s*(.*)/.exec(H.content(sh, '.gitconfig'))[1].trim() === name }
        };
    });
    tpl('gitignore', 'Git', 'advanced', 5, 60, (r) => {
        const d = r.pick(['service', 'webapp', 'tool']);
        const ext = r.pick(['log', 'tmp', 'pyc', 'cache', 'env']);
        return {
            title: 'Make git ignore *.' + ext + ' files', desc: 'In the repo ' + d + '/ there is debug.' + ext + ' that keeps showing up in git status. Make git ignore all *.' + ext + ' files.',
            setup: (sh) => { gitRepo(sh, d, { 'main.txt': 'x\n' }, ['init']); sh.fs.writeFile(HOME + '/' + d + '/debug.' + ext, 'noise\n'); },
            solution: "cd " + d + " && echo '*." + ext + "' >> .gitignore", hints: ['Patterns in a file named .gitignore are ignored.', "echo '*." + ext + "' >> .gitignore"],
            check: { state: (sh) => { const c = H.content(sh, d + '/.gitignore'); if (!c) return false; const clone = cloneShell(sh); const res = clone.exec('cd ' + HOME + '/' + d + ' && git status --short'); return !res.stdout.includes('debug.' + ext); } }
        };
    });

    // ============ DOCKER ============
    tpl('docker-pull', 'Containers', 'beginner', 8, 35, (r) => {
        const img = r.pick(['nginx', 'alpine', 'redis', 'postgres', 'busybox', 'python', 'node', 'httpd', 'debian', 'mysql']);
        return {
            title: 'Pull the ' + img + ' image', desc: 'Download the ' + img + ' container image from Docker Hub.',
            solution: 'docker pull ' + img, hints: ['docker pull IMAGE'], check: { state: (sh) => !!sh.system.docker && sh.system.docker.images.some((i) => i.repo === img) }
        };
    });
    tpl('docker-run', 'Containers', 'intermediate', 10, 60, (r) => {
        const img = r.pick(['nginx', 'httpd']);
        const name = r.pick(['web', 'frontend', 'site', 'proxy', 'blog']) + r.int(1, 9);
        const port = r.pick([8080, 8081, 8888, 9000, 3001, 5000]);
        return {
            title: 'Run ' + img + ' as "' + name + '" on port ' + port, desc: 'Start a detached ' + img + ' container named ' + name + ' that publishes host port ' + port + ' to container port 80.',
            solution: 'docker run -d --name ' + name + ' -p ' + port + ':80 ' + img, hints: ['-d detaches, --name names it, -p HOST:CONTAINER publishes ports.', 'docker run -d --name ' + name + ' -p ' + port + ':80 ' + img],
            check: { state: (sh) => !!sh.system.docker && sh.system.docker.containers.some((c) => c.name === name && c.status === 'running' && c.image.startsWith(img) && (c.ports || []).some((p) => p.host === port && p.container === 80)) }
        };
    });
    function dockerSetup(sh, name, img, running) {
        sh.exec('docker run -d --name ' + name + ' ' + img);
        if (!running) sh.exec('docker stop ' + name);
    }
    tpl('docker-stop', 'Containers', 'intermediate', 6, 45, (r) => {
        const name = r.pick(['cache', 'db', 'queue', 'worker']) + r.int(1, 9);
        const img = r.pick(['redis', 'postgres', 'nginx']);
        return {
            title: 'Stop the container ' + name, desc: 'The container ' + name + ' is running. Stop it (do not remove it).',
            setup: (sh) => dockerSetup(sh, name, img, true), solution: 'docker stop ' + name, hints: ['docker ps lists containers; docker stop NAME stops one.'],
            check: { state: (sh) => sh.system.docker.containers.some((c) => c.name === name && c.status !== 'running') }
        };
    });
    tpl('docker-rm', 'Containers', 'intermediate', 6, 45, (r) => {
        const name = r.pick(['old', 'legacy', 'test', 'tmp']) + '_' + r.pick(['api', 'web', 'job']);
        return {
            title: 'Remove the container ' + name, desc: 'Delete the stopped container ' + name + '.',
            setup: (sh) => dockerSetup(sh, name, 'nginx', false), solution: 'docker rm ' + name, hints: ['docker ps -a shows stopped containers.', 'docker rm NAME'],
            check: { state: (sh) => !sh.system.docker.containers.some((c) => c.name === name) }
        };
    });
    tpl('docker-build', 'Containers', 'advanced', 6, 75, (r) => {
        const tag = r.pick(['myapp', 'webapp', 'api', 'tool', 'site']) + ':' + r.pick(['1.0', 'latest', 'v2', 'dev']);
        const d = r.pick(['app', 'service', 'image-src']);
        return {
            title: 'Build the image ' + tag, desc: 'The directory ' + d + '/ contains a Dockerfile. Build an image from it tagged ' + tag + '.',
            files: { [d + '/Dockerfile']: 'FROM alpine:3.20\nRUN echo building\nCOPY . /app\nCMD ["sh"]\n', [d + '/app.sh']: 'echo hi\n' },
            solution: 'docker build -t ' + tag + ' ' + d, hints: ['docker build -t NAME:TAG PATH'],
            check: { state: (sh) => { const [repo, t] = tag.split(':'); return !!sh.system.docker && sh.system.docker.images.some((i) => i.repo === repo && i.tag === t); } }
        };
    });
    tpl('docker-hello', 'Containers', 'beginner', 1, 25, () => ({
        title: 'Your first container: hello-world', desc: 'Run the hello-world image to verify that Docker works.', solution: 'docker run hello-world',
        hints: ['docker run IMAGE'], check: { match: (out) => out.includes('Hello from Docker!') }
    }));
    tpl('docker-volume', 'Containers', 'intermediate', 5, 40, (r) => {
        const v = r.pick(['dbdata', 'uploads', 'cache_vol', 'logs_vol', 'pgdata']);
        return { title: 'Create the volume ' + v, desc: 'Create a named docker volume called ' + v + '.', solution: 'docker volume create ' + v, hints: ['docker volume create NAME'], check: { state: (sh) => !!sh.system.docker && sh.system.docker.volumes.includes(v) } };
    });
    tpl('docker-network', 'Containers', 'intermediate', 4, 40, (r) => {
        const n = r.pick(['backend', 'frontend', 'internal', 'appnet']);
        return { title: 'Create the network ' + n, desc: 'Create a docker network named ' + n + '.', solution: 'docker network create ' + n, hints: ['docker network create NAME'], check: { state: (sh) => !!sh.system.docker && sh.system.docker.networks.some((x) => x.name === n) } };
    });

    // ============ SECURITY / ENCODING ============
    tpl('sha256', 'Security', 'intermediate', 8, 40, (r) => {
        const f = r.pick(['release', 'installer', 'image', 'backup']) + '-' + r.int(1, 9) + '.' + r.pick(['tar.gz', 'iso', 'bin']);
        return {
            title: 'SHA-256 checksum of ' + f, desc: 'Compute the SHA-256 checksum of ' + f + ' to verify the download.',
            files: { [f]: 'binary payload ' + r.int(1, 99999) + '\n' }, solution: 'sha256sum ' + f, hints: ['sha256sum FILE'], check: 'output'
        };
    });
    tpl('md5', 'Security', 'intermediate', 5, 35, (r) => {
        const f = r.pick(POOL.bases) + '.txt';
        return { title: 'MD5 of ' + f, desc: 'Print the MD5 checksum of ' + f + '.', files: { [f]: r.pick(POOL.words) + '\n' }, solution: 'md5sum ' + f, hints: ['md5sum FILE'], check: 'output' };
    });
    tpl('base64-dec', 'Security', 'intermediate', 6, 40, (r) => {
        const msg = r.pick(['The password is ' + r.pick(POOL.secrets), 'meet me at ' + r.pick(POOL.cities), 'flag{' + r.pick(POOL.secrets) + '_' + r.int(10, 99) + '}', 'root access granted']);
        const enc = LA.b64.encode(msg + '\n');
        return {
            title: 'Decode the secret message', desc: 'message.b64 contains a base64 encoded message. Decode it.',
            files: { 'message.b64': enc + '\n' }, solution: 'base64 -d message.b64', hints: ['base64 -d decodes.'], check: { match: (out) => H.norm(out) === H.norm(msg) }
        };
    });
    tpl('base64-enc', 'Security', 'beginner', 4, 30, (r) => {
        const w = r.pick(POOL.secrets);
        return { title: 'Base64-encode "' + w + '"', desc: 'Print the base64 encoding of the text "' + w + '" (without a trailing newline in the input).', solution: 'echo -n ' + w + ' | base64', hints: ['echo -n avoids the newline.', 'echo -n ' + w + ' | base64'], check: { match: (out) => H.norm(out) === LA.b64.encode(w) } };
    });
    tpl('suid', 'Security', 'expert', 2, 110, (r) => ({
        title: 'Find SUID binaries', desc: 'Security audit: print the paths of all regular files under /usr that have the SUID bit set (permission bit 4000). Hide permission errors.',
        solution: 'find /usr -type f -perm -4000 2>/dev/null', hints: ['find -perm -4000 matches files with SUID.', 'Redirect errors with 2>/dev/null.'],
        check: { paths: ['/usr/bin/sudo', '/usr/bin/passwd'] }
    }));
    tpl('ctf-hidden', 'Security', 'advanced', 10, 80, (r) => {
        const flag = 'FLAG{' + r.pick(POOL.secrets) + '_' + r.pick(POOL.words) + '_' + r.int(100, 999) + '}';
        const d = '.' + r.pick(['cache', 'local', 'config', 'trash', 'secret']) + '/' + r.pick(POOL.dirs) + '/' + r.pick(['.x', '.hidden', 'deep', '.stash']);
        const f = r.pick(['.flag', 'note.txt', '.treasure', 'readme']);
        const decoys = {};
        for (const b of r.sample(POOL.bases, 3)) decoys[r.pick(POOL.dirs) + '/' + b + '.txt'] = 'nothing to see here\n';
        return {
            title: 'Capture the hidden flag #' + r.int(1, 999), desc: 'A flag of the form FLAG{...} is hidden somewhere inside your home directory - possibly in hidden directories. Find it and print it.',
            files: Object.assign({ [d + '/' + f]: 'You found it: ' + flag + '\n' }, decoys), solution: 'grep -r FLAG ~',
            hints: ['Hidden files start with a dot - ls -a reveals them.', 'grep -r searches recursively through all files.', 'grep -r FLAG ~'],
            check: { match: (out) => out.includes(flag) }
        };
    });

    // ============ EXPERT SCENARIOS ============
    tpl('scn-logs', 'Scenarios', 'expert', 6, 150, (r) => {
        const d = r.pick(['logs', 'var_logs', 'applogs']);
        const names = r.sample(POOL.services, 4).map((s) => s + '.log');
        const files = {};
        for (const n of names) files[d + '/' + n] = L(logLines(r, 5));
        files[d + '/README.txt'] = 'do not archive me\n';
        return {
            title: 'Log rotation: archive the .log files in ' + d + '/', desc: 'Move every .log file from ' + d + '/ into a new directory ' + d + '/archive/ and compress each of them with gzip (ending up as archive/NAME.log.gz). Leave README.txt alone.',
            files, solution: 'mkdir ' + d + '/archive && mv ' + d + '/*.log ' + d + '/archive/ && gzip ' + d + '/archive/*.log',
            hints: ['Step 1: mkdir the archive directory.', 'Step 2: mv with a glob.', 'Step 3: gzip accepts many files.'],
            check: { state: (sh) => names.every((n) => !H.exists(sh, d + '/' + n) && LA.archive.gzipDecode(H.content(sh, d + '/archive/' + n + '.gz') || '') !== null) && H.isFile(sh, d + '/README.txt') }
        };
    });
    tpl('scn-deploy', 'Scenarios', 'expert', 6, 160, (r) => {
        const title = r.pick(['Launch Day', 'Hello Production', 'Version 2', 'Coming Soon', 'Arsenal Web']);
        const page = '<!DOCTYPE html>\n<html><head><title>' + title + '</title></head><body><h1>' + title + '</h1></body></html>\n';
        return {
            title: 'Deploy "' + title + '" to the web server', desc: 'site/index.html is the new homepage. Deploy it to /var/www/html/index.html (root-owned), then verify with curl http://localhost that nginx serves it.',
            files: { 'site/index.html': page }, solution: 'sudo cp site/index.html /var/www/html/index.html && curl -s localhost',
            hints: ['/var/www/html belongs to root: use sudo.', 'sudo cp site/index.html /var/www/html/index.html', 'curl localhost to verify.'],
            check: { state: (sh) => LA.asRoot(sh, () => { try { return sh.fs.readFile('/var/www/html/index.html'); } catch (e) { return ''; } }) === page && sh.system.services.nginx.active }
        };
    });
    tpl('scn-incident', 'Scenarios', 'expert', 6, 180, (r) => {
        const name = r.pick(ROGUE);
        const pid = r.int(3000, 9000);
        return {
            title: 'Incident response: ' + name, desc: 'A malicious program /tmp/.' + name + ' is running and using lots of CPU. Kill the process AND delete the program file /tmp/.' + name + '.',
            setup: (sh) => { addRogue(sh, name, pid); const n = sh.fs.writeFile('/tmp/.' + name, '#!/bin/bash\nwhile true; do :; done\n'); n.mode = 0o755; },
            solution: 'pkill -f ' + name + ' && rm /tmp/.' + name, hints: ['ps aux --sort=-%cpu | head shows the busiest processes.', 'kill the PID (or pkill -f NAME).', 'Then rm the file in /tmp.'],
            check: { state: (sh) => !H.procAlive(sh, (p) => p.pid === pid) && !H.exists(sh, '/tmp/.' + name) }
        };
    });
    tpl('scn-onboard', 'Scenarios', 'expert', 8, 170, (r) => {
        const u = r.pick(['carol', 'dave', 'erin', 'frank', 'grace', 'heidi', 'ivan', 'judy']);
        const g = r.pick(['developers', 'docker', 'adm']);
        return {
            title: 'Onboard ' + u + ' to the ' + g + ' team', desc: 'Create the user ' + u + ' with a home directory and bash as login shell, and add them to the ' + g + ' group.',
            solution: 'sudo useradd -m -s /bin/bash -G ' + g + ' ' + u, hints: ['useradd options: -m home, -s shell, -G groups.', 'Or create first, then usermod -aG.'],
            check: { state: (sh) => { const usr = sh.system.getUser(u); return !!usr && usr.shell === '/bin/bash' && H.isDir(sh, '/home/' + u) && sh.system.groupsOf(u).includes(g); } }
        };
    });
    tpl('scn-cleanup', 'Scenarios', 'expert', 6, 150, (r) => {
        const d = r.pick(['uploads', 'cache', 'scratch', 'dumps']);
        const limit = r.pick([2, 4, 8]);
        const files = {};
        const big = [], small = [];
        for (let i = 0; i < 7; i++) {
            const isBig = i % 2 === 0;
            const p = d + '/' + r.pick(POOL.bases) + i + '.bin';
            files[p] = 'x'.repeat(isBig ? limit * 1024 + r.int(500, 5000) : r.int(10, limit * 1024 - 200));
            (isBig ? big : small).push(p);
        }
        return {
            title: 'Disk cleanup: delete files over ' + limit + 'K in ' + d + '/', desc: 'The disk is full! Delete every file in ' + d + '/ that is bigger than ' + limit + ' KiB. Keep the smaller files.',
            files, solution: 'find ' + d + ' -type f -size +' + limit + 'k -delete', hints: ['find ... -size +Nk selects big files.', 'Add -delete (or -exec rm {} \\;).'],
            check: { state: (sh) => big.every((p) => !H.exists(sh, p)) && small.every((p) => H.isFile(sh, p)) }
        };
    });
    tpl('scn-config', 'Scenarios', 'expert', 6, 160, (r) => {
        const port = r.pick([8081, 8888, 9090, 8000, 7000]);
        const text = 'server {\n    listen 80 default_server;\n    root /var/www/html;\n}\n';
        return {
            title: 'Move nginx to port ' + port, desc: 'Edit /etc/nginx/sites-available/default so nginx listens on port ' + port + ' instead of 80 ("listen ' + port + ' default_server;"), then restart nginx.',
            setup: (sh) => LA.asRoot(sh, () => sh.fs.writeFile('/etc/nginx/sites-available/default', text)),
            solution: "sudo sed -i 's/listen 80 /listen " + port + " /' /etc/nginx/sites-available/default && sudo systemctl restart nginx",
            hints: ['The file is owned by root: sudo nano, or sudo sed -i.', "sudo sed -i 's/listen 80 /listen " + port + " /' FILE", 'sudo systemctl restart nginx'],
            check: { state: (sh) => { const c = LA.asRoot(sh, () => sh.fs.readFile('/etc/nginx/sites-available/default')); return c.includes('listen ' + port + ' default_server') && !/listen 80\b/.test(c) && sh.system.services.nginx.active && (sh.system.services.nginx.since || 0) > 0; } }
        };
    });
    tpl('scn-report', 'Scenarios', 'expert', 6, 160, (r) => {
        const rows = csvRows(r, 10);
        const n = r.int(2, 3);
        const totals = {};
        for (const row of rows.slice(1)) { const c = row.split(','); totals[c[2]] = (totals[c[2]] || 0) + +c[3]; }
        const top = Object.entries(totals).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map((x) => x[0]);
        return {
            title: 'Top ' + n + ' departments by payroll', desc: 'From employees.csv (id,name,department,salary,city) compute the total salary per department and write the names of the top ' + n + ' departments (highest total first), one per line, into top.txt.',
            files: { 'employees.csv': L(rows) }, solution: "awk -F, 'NR>1 {t[$3]+=$4} END {for (d in t) print t[d], d}' employees.csv | sort -k1,1nr -k2 | head -n " + n + " | awk '{print $2}' > top.txt",
            hints: ['awk can sum per key: t[$3] += $4', 'Print total and name, sort numerically in reverse.', 'Keep the first lines and only the name column, then redirect into top.txt.'],
            check: { state: (sh) => H.lines(H.content(sh, 'top.txt') || '').join('\n') === top.join('\n') }
        };
    });
    tpl('scn-unique-ips', 'Scenarios', 'expert', 4, 140, (r) => {
        const ips = Array.from({ length: r.int(4, 9) }, () => '10.' + r.int(0, 9) + '.' + r.int(0, 9) + '.' + r.int(1, 99));
        const uniq = Array.from(new Set(ips));
        const lines = [];
        for (let i = 0; i < 25; i++) lines.push(r.pick(ips) + ' - - [04/Nov/2026:10:' + String(i).padStart(2, '0') + ':00 +0000] "GET /' + r.pick(['', 'login', 'api', 'img.png']) + ' HTTP/1.1" ' + r.pick([200, 200, 404, 500]) + ' ' + r.int(100, 9000));
        const seen = new Set(lines.map((l) => l.split(' ')[0]));
        void uniq;
        return {
            title: 'Count unique visitors in access.log', desc: 'How many DIFFERENT client IP addresses (first column) appear in access.log? Print the number.',
            files: { 'access.log': L(lines) }, solution: "awk '{print $1}' access.log | sort -u | wc -l", hints: ['Extract the first column.', 'Make it unique (sort -u).', 'Count with wc -l.'],
            check: { match: (out) => H.tokens(out).length === 1 && H.firstNumber(out) === seen.size }
        };
    });
    tpl('scn-status-codes', 'Scenarios', 'expert', 3, 140, (r) => {
        const lines = [];
        for (let i = 0; i < 30; i++) lines.push('192.168.1.' + r.int(2, 40) + ' - - [04/Nov/2026:09:' + String(i).padStart(2, '0') + ':11 +0000] "GET /p' + r.int(1, 9) + ' HTTP/1.1" ' + r.pick([200, 200, 200, 301, 404, 404, 500]) + ' ' + r.int(100, 5000));
        return {
            title: 'HTTP status code summary', desc: 'For access.log, print how many requests got each HTTP status code (field 9), like "uniq -c" output sorted by status code.',
            files: { 'access.log': L(lines) }, solution: "awk '{print $9}' access.log | sort | uniq -c", hints: ['awk \'{print $9}\' extracts the status code.', 'sort | uniq -c counts them.'], check: 'output'
        };
    });
    tpl('scn-backup', 'Scenarios', 'expert', 4, 150, (r) => {
        const d = r.pick(['documents', 'projects', 'website']);
        const files = {};
        for (const b of r.sample(POOL.bases, 4)) files[d + '/' + b + '.txt'] = b + ' contents\n';
        const target = '/tmp/' + d + '-backup.tar.gz';
        return {
            title: 'Back up ~/' + d + ' to /tmp and verify', desc: 'Create a compressed archive ' + target + ' of ~/' + d + ', then list its contents to verify the backup worked.',
            files, solution: 'tar -czf ' + target + ' ' + d + ' && tar -tzf ' + target, hints: ['tar -czf creates, tar -tzf lists.'],
            check: { match: (out, sh) => { const e = H.tar(sh, target); return !!e && Object.keys(files).every((f) => e.some((x) => x.p.endsWith(f))) && Object.keys(files).every((f) => out.includes(f)); } }
        };
    });

    // ------------------------------------------------------------------ build instances
    function cloneShell(sh) {
        const fs = sh.fs.clone();
        const sys = Object.assign(Object.create(Object.getPrototypeOf(sh.system)), JSON.parse(JSON.stringify(sh.system)));
        Object.assign(sys, sh.system.constructor === Object ? {} : {});
        for (const k of Object.keys(sh.system)) if (typeof sh.system[k] === 'function') sys[k] = sh.system[k];
        const c = new LA.Shell({ fs, system: sys, user: sh.user, cwd: sh.cwd });
        c.vars = new Map(Array.from(sh.vars, ([k, v]) => [k, Object.assign({}, v)]));
        c.aliases = Object.assign(Object.create(null), sh.aliases);
        c.functions = Object.assign(Object.create(null), sh.functions);
        return c;
    }
    LA.cloneShell = cloneShell;

    const DIFF_ORDER = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };
    function instantiate(t, index, seedOverride) {
        const seed = seedOverride !== undefined ? seedOverride : U.hashString(t.id + ':' + index);
        const r = rng(seed);
        const b = t.build(r, index);
        return Object.assign({
            id: t.id + '-' + (seedOverride !== undefined ? 'g' + seedOverride : index),
            templateId: t.id,
            seed,
            variant: index,
            category: t.cat,
            difficulty: t.diff,
            xp: t.xp + (index % 5) * 2,
            files: {},
            dirs: [],
            hints: [],
            cwd: HOME
        }, b, { description: b.desc });
    }

    let ALL = null;
    function generateAll() {
        if (ALL) return ALL;
        const out = [];
        const seenTitles = new Set();
        for (const t of T) {
            let made = 0;
            const want = t.count * (t.diff === 'advanced' ? 2 : t.diff === 'expert' ? 3 : 1);
            for (let i = 0; made < want && i < want * 8; i++) {
                const c = instantiate(t, i);
                const key = c.title + '|' + c.description;
                if (seenTitles.has(key)) continue;
                seenTitles.add(key);
                out.push(c);
                made++;
            }
        }
        // stable numbering: order by difficulty, then template declaration order
        out.sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty] || T.findIndex((t) => t.id === a.templateId) - T.findIndex((t) => t.id === b.templateId) || a.variant - b.variant);
        out.forEach((c, i) => { c.number = i + 1; });
        ALL = out;
        return out;
    }
    function generateRandom(seed, opts) {
        opts = opts || {};
        const r = rng(seed);
        let pool = T;
        if (opts.difficulty) pool = pool.filter((t) => t.diff === opts.difficulty);
        if (opts.category) pool = pool.filter((t) => t.cat === opts.category);
        if (!pool.length) pool = T;
        const t = pool[Math.floor(r() * pool.length)];
        const c = instantiate(t, 10000 + (seed % 100000), seed);
        c.generated = true;
        return c;
    }
    function fromId(id) {
        const all = generateAll();
        const found = all.find((c) => c.id === id);
        if (found) return found;
        const m = /^(.*)-g(\d+)$/.exec(id);
        if (m) {
            const t = T.find((x) => x.id === m[1]);
            if (t) { const c = instantiate(t, 10000 + (+m[2] % 100000), +m[2]); c.generated = true; return c; }
        }
        return null;
    }

    // ------------------------------------------------------------------ sandbox machine
    let baseCache = null;
    function baseFs() {
        if (!baseCache) {
            const sys = LA.createSystemState();
            baseCache = LA.buildFilesystem({ system: sys, home: 'empty' });
        }
        return baseCache.clone();
    }
    function createSandbox(ch, opts) {
        opts = opts || {};
        const fs = baseFs();
        const sh = LA.createMachine({ fs, ui: opts.ui, cwd: HOME });
        sh.system.syncFiles(fs);
        const own = (n, spec) => { n.owner = (spec && spec.owner) || 'user'; n.group = (spec && spec.group) || (spec && spec.owner) || 'user'; };
        LA.asRoot(sh, () => {
            for (const d of ch.dirs || []) {
                const p = H.abs(d);
                if (!fs.isDir(p)) fs.mkdir(p, { parents: true });
                if (p.startsWith(HOME)) {
                    let cur = p;
                    while (cur.startsWith(HOME + '/')) { own(fs.get(cur)); cur = VFS.dirname(cur); }
                }
            }
            for (const [rel, spec] of Object.entries(ch.files || {})) {
                const p = H.abs(rel);
                const dir = VFS.dirname(p);
                if (!fs.isDir(dir)) {
                    fs.mkdir(dir, { parents: true });
                    let cur = dir;
                    while (cur.startsWith(HOME + '/')) { own(fs.get(cur)); cur = VFS.dirname(cur); }
                }
                const isObj = spec && typeof spec === 'object';
                const n = fs.writeFile(p, isObj ? spec.content : spec);
                n.mode = isObj && spec.mode !== undefined ? spec.mode : (/\.sh$/.test(p) && false ? 0o755 : 0o644);
                own(n, isObj ? spec : null);
            }
        });
        if (ch.setup) {
            try { ch.setup(sh); } catch (e) { /* setup errors surface in tests */ if (opts.strict) throw e; }
        }
        sh.cwd = ch.cwd ? H.abs(ch.cwd) : HOME;
        sh.setVar('PWD', sh.cwd);
        sh.setVar('OLDPWD', sh.cwd);
        sh.history = [];
        sh.execLog = [];
        return sh;
    }

    // Compute the reference output for "output" checks by running the solution in a fresh sandbox.
    const expectedCache = new Map();
    function expectedOutput(ch) {
        if (expectedCache.has(ch.id)) return expectedCache.get(ch.id);
        const sh = createSandbox(ch);
        const res = sh.exec(ch.solution, { tty: false });
        expectedCache.set(ch.id, res.stdout);
        return res.stdout;
    }

    function checkKind(ch) {
        if (ch.check === 'output') return 'output';
        if (ch.check && ch.check.paths) return 'paths';
        if (ch.check && ch.check.match) return 'match';
        if (ch.check && ch.check.output) return 'output+state';
        return 'state';
    }
    function pathsFromOutput(out, sh, cwdAtRun) {
        const set = new Set();
        for (const line of H.lines(out)) {
            const raw = line.replace(/^\.\//, '');
            const p = VFS.normalize(raw, cwdAtRun || sh.cwd, sh.home);
            set.add(p);
        }
        return set;
    }
    // Evaluate a challenge after a command. `last` = { stdout, cwdBefore }
    function evaluate(ch, sh, last) {
        last = last || { stdout: '' };
        try {
            const kind = checkKind(ch);
            if (kind === 'output') return H.norm(last.stdout) !== '' && H.norm(last.stdout) === H.norm(expectedOutput(ch));
            if (kind === 'paths') {
                const got = pathsFromOutput(last.stdout, sh, last.cwdBefore);
                const want = new Set(ch.check.paths);
                if (got.size !== want.size) return false;
                for (const p of want) if (!got.has(p)) return false;
                return true;
            }
            if (kind === 'match') return !!ch.check.match(last.stdout || '', sh);
            if (kind === 'output+state') return H.norm(last.stdout) === H.norm(expectedOutput(ch)) && !!ch.check.state(sh);
            return !!ch.check.state(sh);
        } catch (e) {
            return false;
        }
    }

    class ChallengeSession {
        constructor(ch, opts) {
            this.challenge = ch;
            this.opts = opts || {};
            this.shell = createSandbox(ch, { ui: this.opts.ui });
            this.attempts = 0;
            this.hintsUsed = 0;
            this.solved = false;
            this.startTime = Date.now();
        }
        reset() {
            const ui = this.shell.ui;
            this.shell = createSandbox(this.challenge, { ui });
            return this.shell;
        }
        // call after each executed command line
        afterCommand(stdout, cwdBefore) {
            if (this.solved) return true;
            this.attempts++;
            if (evaluate(this.challenge, this.shell, { stdout, cwdBefore })) { this.solved = true; this.solvedAt = Date.now(); }
            return this.solved;
        }
        // re-check state (e.g. after closing an editor)
        recheck() {
            if (this.solved) return true;
            const kind = checkKind(this.challenge);
            if (kind === 'state' && evaluate(this.challenge, this.shell, { stdout: '' })) { this.solved = true; this.solvedAt = Date.now(); }
            return this.solved;
        }
        nextHint() {
            const hints = this.challenge.hints || [];
            if (!hints.length) return null;
            const h = hints[Math.min(this.hintsUsed, hints.length - 1)];
            this.hintsUsed = Math.min(this.hintsUsed + 1, hints.length);
            return h;
        }
        get elapsed() { return Math.floor(((this.solvedAt || Date.now()) - this.startTime) / 1000); }
    }

    // ------------------------------------------------------------------ tutorial lessons (reuse the challenge machinery)
    const TUTORIAL = [
        { title: 'Where am I?', text: 'Every shell has a current working directory. Print it with the pwd command.', solution: 'pwd', check: (s, sh, out) => H.norm(out) === sh.cwd },
        { title: 'Look around', text: 'List the files in the current directory with ls.', solution: 'ls', check: (s, sh, out, argv) => argv.some((a) => a[0] === 'ls') && !!H.norm(out) },
        { title: 'Hidden files', text: 'Files starting with a dot are hidden. Show them with ls -a.', solution: 'ls -a', check: (s, sh, out, argv) => argv.some((a) => a[0] === 'ls' && a.some((x) => /^-\w*a/.test(x) || x === '--all')) },
        { title: 'Read a file', text: 'Display the file documents/readme.txt with cat.', solution: 'cat documents/readme.txt', check: (s, sh, out) => out.includes('Welcome to Linux Arsenal') },
        { title: 'Move around', text: 'Change into the documents directory with cd.', solution: 'cd documents', check: (s, sh) => sh.cwd === HOME + '/documents' },
        { title: 'Go back up', text: 'Return to the parent directory with cd .. (two dots = parent).', solution: 'cd ..', check: (s, sh) => sh.cwd === HOME },
        { title: 'Make a directory', text: 'Create a directory called playground.', solution: 'mkdir playground', check: (s, sh) => H.isDir(sh, 'playground') },
        { title: 'Create a file', text: 'Create an empty file playground/hello.txt with touch.', solution: 'touch playground/hello.txt', check: (s, sh) => H.isFile(sh, 'playground/hello.txt') },
        { title: 'Write into a file', text: 'Put the text "Hello Linux" into playground/hello.txt using echo and > (redirection).', solution: 'echo "Hello Linux" > playground/hello.txt', check: (s, sh) => (H.content(sh, 'playground/hello.txt') || '').trim() === 'Hello Linux' },
        { title: 'Copy it', text: 'Copy playground/hello.txt to playground/copy.txt.', solution: 'cp playground/hello.txt playground/copy.txt', check: (s, sh) => H.isFile(sh, 'playground/copy.txt') },
        { title: 'Search text', text: 'Find the lines containing ERROR in data/server.log with grep.', solution: 'grep ERROR data/server.log', check: (s, sh, out) => out.includes('ERROR') && !out.includes('INFO') },
        { title: 'Pipes', text: 'Count how many ERROR lines there are by piping grep into wc -l.', solution: 'grep ERROR data/server.log | wc -l', check: (s, sh, out) => H.norm(out) === '3' },
        { title: 'Sort and unique', text: 'Show the distinct fruits in data/fruits.txt: sort them and remove duplicates.', solution: 'sort data/fruits.txt | uniq', check: (s, sh, out) => H.norm(out) === 'apple banana cherry date elderberry fig grape' },
        { title: 'Permissions', text: 'Make scripts/hello.sh executable (it already is - run chmod +x anyway) and run it with ./scripts/hello.sh', solution: 'chmod +x scripts/hello.sh && ./scripts/hello.sh', check: (s, sh, out) => out.includes('Hello, World!') },
        { title: 'Become root', text: 'Some files need root. Read /etc/shadow using sudo.', solution: 'sudo cat /etc/shadow', check: (s, sh, out) => out.includes('root:') },
        { title: 'Processes', text: 'List every running process with ps aux.', solution: 'ps aux', check: (s, sh, out) => out.includes('PID') && out.includes('/sbin/init') },
        { title: 'Get help', text: 'Open the manual page for ls (press q to quit the pager).', solution: 'man ls', check: (s, sh, out, argv) => argv.some((a) => a[0] === 'man') },
        { title: 'You did it!', text: 'Tutorial complete! Try the challenges: type "challenge list" or "challenge random". Type tutorial again to restart.', solution: 'challenge list', check: () => true, final: true }
    ];

    LA.challenges = { templates: T, generateAll, generateRandom, fromId, createSandbox, evaluate, expectedOutput, checkKind, ChallengeSession, helpers: H, TUTORIAL, DIFF_ORDER };
})();
