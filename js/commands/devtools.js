// Linux Arsenal - simulated developer tools: git and docker
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const U = LA.util;
    const { getopt, usageError, splitLines, register } = U;
    const VFS = LA.VFS;
    const R = (name, fn, meta) => register(name, fn, meta);
    const { globMatch } = LA.shellUtil;

    // ================================================================= GIT
    const STATE_FILE = '.git/la-state.json';
    function findRepo(ctx, start) {
        let dir = start || ctx.sh.cwd;
        for (;;) {
            if (ctx.fs.isDir(dir + (dir === '/' ? '' : '/') + '.git') && ctx.fs.isFile((dir === '/' ? '' : dir) + '/' + STATE_FILE)) return dir;
            if (dir === '/') return null;
            dir = VFS.dirname(dir);
        }
    }
    function loadState(ctx, root) { return JSON.parse(ctx.fs.readFile(root + '/' + STATE_FILE)); }
    function saveState(ctx, root, st) {
        ctx.fs.writeFile(root + '/' + STATE_FILE, JSON.stringify(st));
        ctx.fs.writeFile(root + '/.git/HEAD', st.detached ? st.detached + '\n' : 'ref: refs/heads/' + st.head + '\n');
        for (const [b, id] of Object.entries(st.branches)) if (id) { if (!ctx.fs.isDir(root + '/.git/refs/heads')) ctx.fs.mkdir(root + '/.git/refs/heads', { parents: true }); ctx.fs.writeFile(root + '/.git/refs/heads/' + b.replace(/\//g, '_'), id + '\n'); }
    }
    let commitCounter = 0;
    function newId(seed) { return LA.hash.sha1(seed + ':' + Date.now() + ':' + (++commitCounter) + ':' + Math.random()); }
    function workingTree(ctx, root) {
        const tree = {};
        const ignore = gitignore(ctx, root);
        ctx.fs.walk(root, (n, p) => {
            if (n.type !== 'file') return;
            const rel = p.slice(root.length + 1);
            if (rel === '.git' || rel.startsWith('.git/')) return;
            if (isIgnored(rel, ignore)) return;
            tree[rel] = n.content;
        });
        return tree;
    }
    function gitignore(ctx, root) {
        try { return splitLines(ctx.fs.readFile(root + '/.gitignore')).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')); } catch (e) { return []; }
    }
    function isIgnored(rel, patterns) {
        let ignored = false;
        for (const raw of patterns) {
            const neg = raw.startsWith('!');
            let p = neg ? raw.slice(1) : raw;
            const dirOnly = p.endsWith('/');
            p = p.replace(/\/$/, '').replace(/^\//, '');
            const segs = rel.split('/');
            let hit;
            if (p.includes('/')) hit = globMatch(p, rel) || rel.startsWith(p + '/');
            else hit = segs.some((s, i) => globMatch(p, s) && (!dirOnly || i < segs.length - 1));
            if (hit) ignored = !neg;
        }
        return ignored;
    }
    function headCommit(st) { return st.detached || st.branches[st.head] || null; }
    function treeOf(st, id) { return id ? st.commits[id].tree : {}; }
    function short(id) { return id ? id.slice(0, 7) : '0000000'; }
    function gitConfig(ctx, root, st, key) {
        if (st && st.config[key] !== undefined) return st.config[key];
        try {
            const txt = ctx.fs.readFile(ctx.sh.home + '/.gitconfig');
            const [sec, name] = key.split('.');
            let cur = null;
            for (const line of splitLines(txt)) {
                const s = /^\s*\[([^\]\s]+)\]/.exec(line);
                if (s) { cur = s[1]; continue; }
                const kv = /^\s*(\w+)\s*=\s*(.*)$/.exec(line);
                if (kv && cur === sec && kv[1] === name) return kv[2].trim();
            }
        } catch (e) { /* no global config */ }
        return undefined;
    }
    function setGlobalConfig(ctx, key, value) {
        const path = ctx.sh.home + '/.gitconfig';
        let txt = '';
        try { txt = ctx.fs.readFile(path); } catch (e) { txt = ''; }
        const [sec, name] = key.split('.');
        const lines = txt ? splitLines(txt) : [];
        let secIdx = lines.findIndex((l) => new RegExp('^\\s*\\[' + sec + '\\]').test(l));
        if (secIdx === -1) { lines.push('[' + sec + ']'); secIdx = lines.length - 1; }
        let end = secIdx + 1;
        while (end < lines.length && !/^\s*\[/.test(lines[end])) end++;
        const keyIdx = lines.slice(secIdx + 1, end).findIndex((l) => new RegExp('^\\s*' + name + '\\s*=').test(l));
        if (keyIdx >= 0) lines[secIdx + 1 + keyIdx] = '\t' + name + ' = ' + value;
        else lines.splice(end, 0, '\t' + name + ' = ' + value);
        ctx.fs.writeFile(path, lines.join('\n') + '\n');
    }
    function diffTrees(a, b) {
        const out = { added: [], modified: [], deleted: [] };
        for (const k of Object.keys(b)) { if (!(k in a)) out.added.push(k); else if (a[k] !== b[k]) out.modified.push(k); }
        for (const k of Object.keys(a)) if (!(k in b)) out.deleted.push(k);
        for (const v of Object.values(out)) v.sort();
        return out;
    }
    function unifiedDiff(path, a, b, color) {
        const la = a === null ? [] : splitLines(a), lb = b === null ? [] : splitLines(b);
        const n = la.length, m = lb.length;
        const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = la[i] === lb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        const ops = [];
        let i = 0, j = 0;
        while (i < n && j < m) { if (la[i] === lb[j]) { ops.push(' ' + la[i]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push('-' + la[i++]); else ops.push('+' + lb[j++]); }
        while (i < n) ops.push('-' + la[i++]);
        while (j < m) ops.push('+' + lb[j++]);
        const c = (code, s) => (color ? '\x1b[' + code + 'm' + s + '\x1b[m' : s);
        let out = c('1', 'diff --git a/' + path + ' b/' + path) + '\n';
        if (a === null) out += c('1', 'new file mode 100644') + '\n';
        if (b === null) out += c('1', 'deleted file mode 100644') + '\n';
        out += c('1', 'index ' + LA.hash.sha1(a || '').slice(0, 7) + '..' + LA.hash.sha1(b || '').slice(0, 7) + (a !== null && b !== null ? ' 100644' : '')) + '\n';
        out += c('1', '--- ' + (a === null ? '/dev/null' : 'a/' + path)) + '\n' + c('1', '+++ ' + (b === null ? '/dev/null' : 'b/' + path)) + '\n';
        out += c('36', '@@ -' + (n ? 1 : 0) + (n === 1 ? '' : ',' + n) + ' +' + (m ? 1 : 0) + (m === 1 ? '' : ',' + m) + ' @@') + '\n';
        for (const o of ops) out += (o[0] === '+' ? c('32', o) : o[0] === '-' ? c('31', o) : o) + '\n';
        return out;
    }
    function writeTree(ctx, root, from, to) {
        // replace tracked files of `from` with `to`
        for (const p of Object.keys(from)) if (!(p in to)) { const ap = root + '/' + p; if (ctx.fs.exists(ap)) ctx.fs.unlink(ap); }
        for (const [p, c] of Object.entries(to)) {
            const ap = root + '/' + p;
            const d = VFS.dirname(ap);
            if (!ctx.fs.isDir(d)) ctx.fs.mkdir(d, { parents: true });
            ctx.fs.writeFile(ap, c);
        }
    }
    function resolveRev(st, rev) {
        if (!rev || rev === 'HEAD' || rev === '@') return headCommit(st);
        let m;
        if ((m = /^(.+?)(~(\d*)|\^+)$/.exec(rev))) {
            let id = resolveRev(st, m[1]);
            const n = m[2].startsWith('~') ? parseInt(m[3] || '1', 10) : m[2].length;
            for (let k = 0; k < n && id; k++) id = st.commits[id].parent;
            return id;
        }
        if (st.branches[rev] !== undefined) return st.branches[rev];
        if (st.tags[rev]) return st.tags[rev];
        const matches = Object.keys(st.commits).filter((id) => id.startsWith(rev));
        return matches.length === 1 ? matches[0] : null;
    }
    function ancestors(st, id) {
        const seen = new Set();
        const stack = [id];
        while (stack.length) { const c = stack.pop(); if (!c || seen.has(c)) continue; seen.add(c); stack.push(st.commits[c].parent, st.commits[c].parent2); }
        return seen;
    }
    function gitDate(ms) {
        const d = new Date(ms);
        return U.DAYS[d.getDay()] + ' ' + U.MONTHS[d.getMonth()] + ' ' + d.getDate() + ' ' + U.p2(d.getHours()) + ':' + U.p2(d.getMinutes()) + ':' + U.p2(d.getSeconds()) + ' ' + d.getFullYear() + ' +0000';
    }
    const KNOWN_REPOS = {
        'github.com/0x0806/linux-arsenal': { 'README.md': '# Linux Arsenal\n\nMaster the Linux command line with 1000+ interactive challenges.\n', 'index.html': '<!DOCTYPE html>\n<html><head><title>Linux Arsenal</title></head><body></body></html>\n', 'style.css': 'body { background: #0a0a0a; }\n', 'script.js': "console.log('Linux Arsenal');\n" },
        'github.com/torvalds/linux': { 'README': 'Linux kernel\n============\n\nThere are several guides for kernel developers and users.\n', 'Makefile': 'VERSION = 6\nPATCHLEVEL = 12\n', 'COPYING': 'NOTE! This copyright does *not* cover user programs that use kernel services.\n' },
        'github.com/octocat/hello-world': { 'README': 'Hello World!\n' }
    };

    R('git', (ctx) => {
        const sh = ctx.sh, fs = ctx.fs;
        let args = ctx.args.slice();
        let cwdOverride = null;
        while (args[0] === '-C') { cwdOverride = ctx.resolve(args[1]); args = args.slice(2); }
        while (args[0] === '--no-pager' || args[0] === '-P') args.shift();
        const sub = args[0];
        const rest = args.slice(1);
        const color = ctx.tty;
        const c = (code, s) => (color ? '\x1b[' + code + 'm' + s + '\x1b[m' : s);
        if (!sub || sub === 'help' || sub === '--help') {
            ctx.outln('usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]\n           [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]\n           [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--bare]\n           <command> [<args>]\n\nThese are common Git commands used in various situations:\n\nstart a working area\n   clone     Clone a repository into a new directory\n   init      Create an empty Git repository or reinitialize an existing one\n\nwork on the current change\n   add       Add file contents to the index\n   mv        Move or rename a file, a directory, or a symlink\n   restore   Restore working tree files\n   rm        Remove files from the working tree and from the index\n\nexamine the history and state\n   diff      Show changes between commits, commit and working tree, etc\n   log       Show commit logs\n   show      Show various types of objects\n   status    Show the working tree status\n\ngrow, mark and tweak your common history\n   branch    List, create, or delete branches\n   commit    Record changes to the repository\n   merge     Join two or more development histories together\n   reset     Reset current HEAD to the specified state\n   switch    Switch branches\n   tag       Create, list, delete or verify a tag object\n\ncollaborate\n   fetch     Download objects and refs from another repository\n   pull      Fetch from and integrate with another repository or a local branch\n   push      Update remote refs along with associated objects');
            return sub ? 0 : 1;
        }
        if (sub === '--version' || sub === 'version' || sub === '-v') { ctx.outln('git version 2.43.0'); return 0; }
        if (sub === 'config') {
            const global = rest.includes('--global');
            const list = rest.includes('--list') || rest.includes('-l');
            const ops = rest.filter((a) => !a.startsWith('--'));
            const root = findRepo(ctx, cwdOverride);
            const st = root ? loadState(ctx, root) : null;
            if (list) {
                try { const txt = fs.readFile(sh.home + '/.gitconfig'); let sec = ''; for (const l of splitLines(txt)) { const s = /^\s*\[(\S+)\]/.exec(l); if (s) { sec = s[1]; continue; } const kv = /^\s*(\w+)\s*=\s*(.*)$/.exec(l); if (kv) ctx.outln(sec + '.' + kv[1].toLowerCase() + '=' + kv[2]); } } catch (e) { /* none */ }
                if (st && !global) { ctx.outln('core.repositoryformatversion=0\ncore.filemode=true\ncore.bare=false'); for (const [k, v] of Object.entries(st.config)) ctx.outln(k + '=' + v); }
                return 0;
            }
            if (!ops.length) return ctx.fail('usage: git config [<options>]', 129);
            const key = ops[0];
            if (!/^[a-zA-Z][\w-]*\.[\w.-]+$/.test(key)) return ctx.fail('error: key does not contain a section: ' + key, 1);
            if (ops.length === 1) {
                const v = global ? gitConfig(ctx, null, null, key) : gitConfig(ctx, root, st, key);
                if (v === undefined) return 1;
                ctx.outln(v);
                return 0;
            }
            const value = ops.slice(1).join(' ');
            if (global || !root) {
                if (!global && !root) return ctx.fail('fatal: not in a git directory', 128);
                setGlobalConfig(ctx, key, value);
            } else { st.config[key] = value; saveState(ctx, root, st); }
            return 0;
        }
        if (sub === 'init') {
            const dir = rest.find((a) => !a.startsWith('-'));
            const target = dir ? ctx.resolve(dir) : (cwdOverride || sh.cwd);
            const branchOpt = rest.indexOf('-b') >= 0 ? rest[rest.indexOf('-b') + 1] : (rest.find((a) => a.startsWith('--initial-branch=')) || '').split('=')[1];
            try {
                if (!fs.isDir(target)) fs.mkdir(target, { parents: true });
                const existed = fs.isFile(target + '/' + STATE_FILE);
                if (!existed) {
                    fs.mkdir(target + '/.git', { parents: true });
                    for (const d of ['objects', 'refs/heads', 'refs/tags', 'hooks', 'info']) fs.mkdir(target + '/.git/' + d, { parents: true });
                    fs.writeFile(target + '/.git/config', '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n');
                    fs.writeFile(target + '/.git/description', "Unnamed repository; edit this file 'description' to name the repository.\n");
                    const b = branchOpt || gitConfig(ctx, null, null, 'init.defaultBranch') || 'main';
                    saveState(ctx, target, { head: b, detached: null, branches: { [b]: null }, commits: {}, index: {}, config: {}, stash: [], remotes: {}, tags: {}, reflog: [], merge: null });
                }
                if (!rest.includes('-q') && !rest.includes('--quiet')) ctx.outln((existed ? 'Reinitialized existing' : 'Initialized empty') + ' Git repository in ' + (target === '/' ? '' : target) + '/.git/');
            } catch (e) { return ctx.fail('fatal: cannot mkdir ' + (dir || target) + ': ' + e.message, 128); }
            return 0;
        }
        if (sub === 'clone') {
            const ops = rest.filter((a) => !a.startsWith('-'));
            const url = ops[0];
            if (!url) return ctx.fail('fatal: You must specify a repository to clone.', 129);
            const name = ops[1] || url.replace(/\.git$/, '').replace(/\/$/, '').split(/[\/:]/).pop();
            const target = ctx.resolve(name);
            if (fs.exists(target) && fs.list(target).length) return ctx.fail("fatal: destination path '" + name + "' already exists and is not an empty directory.", 128);
            const key = url.toLowerCase().replace(/^(https?:\/\/|git@)/, '').replace(/^github\.com:/, 'github.com/').replace(/\.git$/, '').replace(/\/$/, '');
            const host = key.split('/')[0];
            if (!LA.NET.HOSTS[host]) { ctx.err("Cloning into '" + name + "'...\nfatal: unable to access '" + url + "/': Could not resolve host: " + host + '\n'); return 128; }
            const files = KNOWN_REPOS[key] || { 'README.md': '# ' + name + '\n\nCloned from ' + url + '\n' };
            ctx.err("Cloning into '" + name + "'...\nremote: Enumerating objects: " + (12 + Object.keys(files).length * 7) + ', done.\nremote: Counting objects: 100% (' + (12 + Object.keys(files).length * 7) + '/' + (12 + Object.keys(files).length * 7) + '), done.\nremote: Compressing objects: 100% (9/9), done.\nReceiving objects: 100% (' + (12 + Object.keys(files).length * 7) + '/' + (12 + Object.keys(files).length * 7) + '), done.\nResolving deltas: 100% (3/3), done.\n');
            if (!fs.exists(target)) fs.mkdir(target);
            fs.mkdir(target + '/.git/refs/heads', { parents: true });
            const id = newId(url);
            const st = { head: 'main', detached: null, branches: { main: id }, commits: { [id]: { msg: 'Initial commit', author: 'Upstream Maintainer <dev@' + host + '>', date: Date.now() - 86400000 * 30, parent: null, tree: files } }, index: Object.assign({}, files), config: {}, stash: [], remotes: { origin: url }, tags: {}, reflog: [], merge: null, remoteRefs: { 'origin/main': id } };
            writeTree(ctx, target, {}, files);
            fs.writeFile(target + '/.git/config', '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = ' + url + '\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n\tmerge = refs/heads/main\n');
            saveState(ctx, target, st);
            return 0;
        }
        const root = findRepo(ctx, cwdOverride);
        if (!root) { ctx.err('fatal: not a git repository (or any of the parent directories): .git\n'); return 128; }
        const st = loadState(ctx, root);
        const save = () => saveState(ctx, root, st);
        const relOf = (p) => { const abs = VFS.normalize(p, cwdOverride || sh.cwd, sh.home); return abs === root ? '' : abs.startsWith(root + '/') ? abs.slice(root.length + 1) : null; };
        const pathspecMatch = (specs, f) => !specs.length || specs.some((s) => { const r = relOf(s); if (r === null) return false; return r === '' || f === r || f.startsWith(r + '/') || globMatch(r, f); });
        const author = () => {
            const name = gitConfig(ctx, root, st, 'user.name');
            const email = gitConfig(ctx, root, st, 'user.email');
            if (!name || !email) return null;
            return name + ' <' + email + '>';
        };
        switch (sub) {
            case 'status': {
                const shortFmt = rest.includes('-s') || rest.includes('--short') || rest.includes('--porcelain');
                const head = headCommit(st);
                const headTree = treeOf(st, head);
                const work = workingTree(ctx, root);
                const staged = diffTrees(headTree, st.index);
                const unstaged = diffTrees(st.index, work);
                const untracked = unstaged.added;
                if (shortFmt) {
                    const all = new Set([].concat(staged.added, staged.modified, staged.deleted, unstaged.modified, unstaged.deleted, untracked));
                    for (const f of Array.from(all).sort()) {
                        const x = staged.added.includes(f) ? 'A' : staged.modified.includes(f) ? 'M' : staged.deleted.includes(f) ? 'D' : untracked.includes(f) ? '?' : ' ';
                        const y = unstaged.modified.includes(f) ? 'M' : unstaged.deleted.includes(f) ? 'D' : untracked.includes(f) ? '?' : ' ';
                        ctx.outln((x === '?' ? c('31', '??') : c('32', x) + c('31', y)) + ' ' + f);
                    }
                    return 0;
                }
                ctx.outln(st.detached ? c('31', 'HEAD detached at ' + short(st.detached)) : 'On branch ' + st.head);
                if (st.remotes.origin && st.remoteRefs && st.remoteRefs['origin/' + st.head] !== undefined && !st.detached) {
                    const ahead = Array.from(ancestors(st, head)).filter((x) => !ancestors(st, st.remoteRefs['origin/' + st.head]).has(x)).length;
                    ctx.outln(ahead ? "Your branch is ahead of 'origin/" + st.head + "' by " + ahead + ' commit' + (ahead > 1 ? 's' : '') + '.\n  (use "git push" to publish your local commits)' : "Your branch is up to date with 'origin/" + st.head + "'.");
                }
                if (st.merge) ctx.outln('You have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)');
                if (!head) ctx.outln('\nNo commits yet');
                const anyStaged = staged.added.length + staged.modified.length + staged.deleted.length;
                if (anyStaged) {
                    ctx.outln('\nChanges to be committed:\n  (use "git ' + (head ? 'restore --staged' : 'rm --cached') + ' <file>..." to unstage)');
                    for (const f of staged.added) ctx.outln('\t' + c('32', 'new file:   ' + f));
                    for (const f of staged.modified) ctx.outln('\t' + c('32', 'modified:   ' + f));
                    for (const f of staged.deleted) ctx.outln('\t' + c('32', 'deleted:    ' + f));
                }
                if (unstaged.modified.length + unstaged.deleted.length) {
                    ctx.outln('\nChanges not staged for commit:\n  (use "git add' + (unstaged.deleted.length ? '/rm' : '') + ' <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)');
                    for (const f of unstaged.modified) ctx.outln('\t' + c('31', 'modified:   ' + f));
                    for (const f of unstaged.deleted) ctx.outln('\t' + c('31', 'deleted:    ' + f));
                }
                if (untracked.length) {
                    ctx.outln('\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)');
                    const shown = new Set();
                    for (const f of untracked) {
                        // collapse untracked directories like git does
                        const top = f.split('/')[0];
                        const dirUntracked = f.includes('/') && !Object.keys(st.index).some((k) => k.startsWith(top + '/'));
                        const label = dirUntracked ? top + '/' : f;
                        if (shown.has(label)) continue;
                        shown.add(label);
                        ctx.outln('\t' + c('31', label));
                    }
                }
                if (!anyStaged && !(unstaged.modified.length + unstaged.deleted.length)) {
                    if (untracked.length) ctx.outln('\nnothing added to commit but untracked files present (use "git add" to track)');
                    else ctx.outln(head ? 'nothing to commit, working tree clean' : '\nnothing to commit (create/copy files and use "git add" to track)');
                } else if (!anyStaged) ctx.outln('\nno changes added to commit (use "git add" and/or "git commit -a")');
                return 0;
            }
            case 'add': {
                const all = rest.includes('-A') || rest.includes('--all');
                const update = rest.includes('-u') || rest.includes('--update');
                const specs = rest.filter((a) => !a.startsWith('-'));
                if (!specs.length && !all && !update) { ctx.err('Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?\n'); return 0; }
                const work = workingTree(ctx, root);
                let matched = all || update;
                for (const s of specs) {
                    const r = relOf(s);
                    if (r === null) { ctx.err("fatal: " + s + ": '" + s + "' is outside repository at '" + root + "'\n"); return 128; }
                    const any = r === '' || Object.keys(work).some((f) => f === r || f.startsWith(r + '/') || globMatch(r, f)) || Object.keys(st.index).some((f) => f === r || f.startsWith(r + '/'));
                    if (!any) {
                        const ign = gitignore(ctx, root);
                        if (fs.exists(ctx.resolve(s)) && isIgnored(r, ign)) { ctx.err('The following paths are ignored by one of your .gitignore files:\n' + r + '\nhint: Use -f if you really want to add them.\n'); return 1; }
                        ctx.err("fatal: pathspec '" + s + "' did not match any files\n");
                        return 128;
                    }
                    matched = true;
                }
                if (!matched) return 0;
                for (const [f, content] of Object.entries(work)) {
                    if (update && !(f in st.index)) continue;
                    if (all || update || pathspecMatch(specs, f)) st.index[f] = content;
                }
                for (const f of Object.keys(st.index)) if (!(f in work) && (all || update || pathspecMatch(specs, f))) delete st.index[f];
                if (st.merge && specs.length) st.merge.resolved = true;
                save();
                return 0;
            }
            case 'rm': {
                const cached = rest.includes('--cached');
                const recursive = rest.includes('-r');
                const specs = rest.filter((a) => !a.startsWith('-'));
                if (!specs.length) return ctx.fail('usage: git rm [<options>] [--] <pathspec>...', 129);
                let any = false;
                for (const f of Object.keys(st.index)) {
                    if (!pathspecMatch(specs, f)) continue;
                    if (f.includes('/') && !recursive && specs.some((s) => relOf(s) === f.split('/')[0])) { ctx.err("fatal: not removing '" + f.split('/')[0] + "' recursively without -r\n"); return 128; }
                    delete st.index[f];
                    any = true;
                    ctx.outln("rm '" + f + "'");
                    if (!cached && fs.exists(root + '/' + f)) fs.unlink(root + '/' + f);
                }
                if (!any) { ctx.err("fatal: pathspec '" + specs[0] + "' did not match any files\n"); return 128; }
                save();
                return 0;
            }
            case 'mv': {
                const ops = rest.filter((a) => !a.startsWith('-'));
                if (ops.length !== 2) return ctx.fail('usage: git mv [<options>] <source>... <destination>', 129);
                const a = relOf(ops[0]); let b = relOf(ops[1]);
                if (!(a in st.index)) { ctx.err('fatal: not under version control, source=' + a + ', destination=' + b + '\n'); return 128; }
                if (fs.isDir(root + '/' + b)) b = b + '/' + VFS.basename(a);
                fs.rename(root + '/' + a, root + '/' + b);
                st.index[b] = st.index[a];
                delete st.index[a];
                save();
                return 0;
            }
            case 'commit': {
                const { opts, error } = getopt(rest, { flags: 'aqvn', args: 'mF', multi: ['m'], long: { message: 'm=', all: 'a', amend: 'amend', 'allow-empty': 'empty', 'no-edit': 'noedit', quiet: 'q', file: 'F=' } });
                if (error) return ctx.fail('error: ' + error, 129);
                const who = author();
                if (!who) {
                    ctx.err('Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account\'s default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address (got \'' + sh.user + '@' + sh.system.hostname + '.(none)\')\n');
                    return 128;
                }
                if (opts.a) { const work = workingTree(ctx, root); for (const f of Object.keys(st.index)) { if (f in work) st.index[f] = work[f]; else delete st.index[f]; } }
                const head = headCommit(st);
                let msg = opts.m ? opts.m.join('\n\n') : opts.F ? fs.readFile(ctx.resolve(opts.F)).trim() : null;
                if (opts.amend && !msg) msg = head ? st.commits[head].msg : null;
                if (st.merge && !msg) msg = "Merge branch '" + st.merge.branch + "'";
                if (!msg) { ctx.err('Aborting commit due to empty commit message.\n(the sandbox has no interactive editor here: use git commit -m "message")\n'); return 1; }
                const base = opts.amend && head ? st.commits[head].parent : head;
                const changes = diffTrees(treeOf(st, opts.amend ? head : head), st.index);
                const nChanges = changes.added.length + changes.modified.length + changes.deleted.length;
                if (!nChanges && !opts.empty && !opts.amend && !st.merge) {
                    const work = workingTree(ctx, root);
                    const unstaged = diffTrees(st.index, work);
                    ctx.outln((st.detached ? 'HEAD detached at ' + short(st.detached) : 'On branch ' + st.head) + '\n' + (unstaged.added.length || unstaged.modified.length || unstaged.deleted.length ? 'Changes not staged for commit:\n' + unstaged.modified.concat(unstaged.deleted).map((f) => '\tmodified:   ' + f).join('\n') + (unstaged.added.length ? '\nUntracked files:\n' + unstaged.added.map((f) => '\t' + f).join('\n') : '') + '\n\nno changes added to commit (use "git add" and/or "git commit -a")' : 'nothing to commit, working tree clean'));
                    return 1;
                }
                const id = newId(msg + JSON.stringify(st.index));
                st.commits[id] = { msg, author: who, date: Date.now(), parent: base, parent2: st.merge ? st.merge.other : null, tree: Object.assign({}, st.index) };
                if (st.detached) st.detached = id; else st.branches[st.head] = id;
                st.reflog.push({ id, msg: (opts.amend ? 'commit (amend): ' : !base ? 'commit (initial): ' : 'commit: ') + msg.split('\n')[0] });
                st.merge = null;
                save();
                const fromTree = treeOf(st, base);
                const d = diffTrees(fromTree, st.index);
                let ins = 0, del = 0;
                for (const f of d.added) ins += splitLines(st.index[f]).length;
                for (const f of d.deleted) del += splitLines(fromTree[f]).length;
                for (const f of d.modified) { const a = splitLines(fromTree[f]), b = splitLines(st.index[f]); const common = a.filter((l) => b.includes(l)).length; ins += b.length - common; del += a.length - common; }
                const files = d.added.length + d.modified.length + d.deleted.length;
                if (!opts.q) {
                    ctx.outln('[' + (st.detached ? 'detached HEAD' : st.head) + (!base ? ' (root-commit)' : '') + ' ' + short(id) + '] ' + msg.split('\n')[0]);
                    ctx.outln(' ' + files + ' file' + (files === 1 ? '' : 's') + ' changed' + (ins ? ', ' + ins + ' insertion' + (ins === 1 ? '' : 's') + '(+)' : '') + (del ? ', ' + del + ' deletion' + (del === 1 ? '' : 's') + '(-)' : ''));
                    for (const f of d.added) ctx.outln(' create mode 100644 ' + f);
                    for (const f of d.deleted) ctx.outln(' delete mode 100644 ' + f);
                }
                return 0;
            }
            case 'log': {
                const { opts, operands } = getopt(rest, { flags: 'p', args: 'n', long: { oneline: 'oneline', graph: 'graph', all: 'all', stat: 'stat', 'max-count': 'n=', decorate: 'decorate', reverse: 'reverse', author: 'author=', grep: 'grep=', format: 'format=', pretty: 'format=' } });
                const num = rest.find((a) => /^-\d+$/.test(a));
                const limit = opts.n ? parseInt(opts.n, 10) : num ? parseInt(num.slice(1), 10) : Infinity;
                let start = operands.length ? resolveRev(st, operands[0]) : headCommit(st);
                if (operands.length && !start) { ctx.err("fatal: ambiguous argument '" + operands[0] + "': unknown revision or path not in the working tree.\n"); return 128; }
                if (!start && !opts.all) { ctx.err("fatal: your current branch '" + st.head + "' does not have any commits yet\n"); return 128; }
                let ids;
                if (opts.all) { const set = new Set(); for (const b of Object.values(st.branches)) if (b) for (const a of ancestors(st, b)) set.add(a); ids = Array.from(set); }
                else ids = Array.from(ancestors(st, start));
                ids.sort((a, b) => st.commits[b].date - st.commits[a].date || (st.commits[a].parent === b ? -1 : st.commits[b].parent === a ? 1 : 0));
                if (opts.author) ids = ids.filter((id) => st.commits[id].author.includes(opts.author));
                if (opts.grep) ids = ids.filter((id) => st.commits[id].msg.includes(opts.grep));
                ids = ids.slice(0, limit);
                if (opts.reverse) ids.reverse();
                const decor = (id) => {
                    const refs = [];
                    const head = headCommit(st);
                    if (id === head) refs.push(st.detached ? c('1;36', 'HEAD') : c('1;36', 'HEAD -> ') + c('1;32', st.head));
                    for (const [b, bid] of Object.entries(st.branches)) if (bid === id && !(b === st.head && !st.detached && id === head)) refs.push(c('1;32', b));
                    for (const [r, rid] of Object.entries(st.remoteRefs || {})) if (rid === id) refs.push(c('1;31', r));
                    for (const [t, tid] of Object.entries(st.tags)) if (tid === id) refs.push(c('1;33', 'tag: ' + t));
                    return refs.length ? ' ' + c('33', '(') + refs.join(c('33', ', ')) + c('33', ')') : '';
                };
                for (const id of ids) {
                    const cm = st.commits[id];
                    const g = opts.graph ? '* ' : '';
                    if (opts.format) {
                        ctx.outln(opts.format.replace(/^format:|^tformat:/, '').replace(/%H/g, id).replace(/%h/g, short(id)).replace(/%s/g, cm.msg.split('\n')[0]).replace(/%an/g, cm.author.replace(/ <.*/, '')).replace(/%ae/g, (/<(.*)>/.exec(cm.author) || [])[1] || '').replace(/%ad/g, gitDate(cm.date)).replace(/%ar/g, 'some time ago').replace(/%n/g, '\n'));
                        continue;
                    }
                    if (opts.oneline) { ctx.outln(g + c('33', short(id)) + decor(id) + ' ' + cm.msg.split('\n')[0]); continue; }
                    ctx.outln(g + c('33', 'commit ' + id) + decor(id));
                    if (cm.parent2) ctx.outln((opts.graph ? '| ' : '') + 'Merge: ' + short(cm.parent) + ' ' + short(cm.parent2));
                    ctx.outln((opts.graph ? '| ' : '') + 'Author: ' + cm.author + '\n' + (opts.graph ? '| ' : '') + 'Date:   ' + gitDate(cm.date) + '\n' + (opts.graph ? '|' : ''));
                    for (const l of cm.msg.split('\n')) ctx.outln((opts.graph ? '| ' : '') + '    ' + l);
                    if (opts.stat || opts.p) {
                        const d = diffTrees(treeOf(st, cm.parent), cm.tree);
                        ctx.outln('');
                        if (opts.p) for (const f of d.added.concat(d.modified, d.deleted)) ctx.out(unifiedDiff(f, treeOf(st, cm.parent)[f] === undefined ? null : treeOf(st, cm.parent)[f], cm.tree[f] === undefined ? null : cm.tree[f], color));
                        else for (const f of d.added.concat(d.modified, d.deleted)) ctx.outln(' ' + f + ' | ' + (d.deleted.includes(f) ? '-' : '+'));
                    }
                    if (id !== ids[ids.length - 1]) ctx.outln('');
                }
                return 0;
            }
            case 'shortlog': {
                const by = {};
                for (const id of ancestors(st, headCommit(st))) { const a = st.commits[id].author.replace(/ <.*/, ''); (by[a] = by[a] || []).push(st.commits[id].msg.split('\n')[0]); }
                for (const [a, msgs] of Object.entries(by)) { ctx.outln(a + ' (' + msgs.length + '):'); for (const m of msgs) ctx.outln('      ' + m); ctx.outln(''); }
                return 0;
            }
            case 'branch': {
                const { opts, operands } = getopt(rest, { flags: 'dDavrlmMcq', long: { delete: 'd', all: 'a', verbose: 'v', list: 'l', move: 'm', 'show-current': 'showcur' } });
                if (opts.showcur) { if (!st.detached) ctx.outln(st.head); return 0; }
                if (opts.d || opts.D) {
                    let status = 0;
                    for (const b of operands) {
                        if (!(b in st.branches)) { ctx.err("error: branch '" + b + "' not found\n"); status = 1; continue; }
                        if (b === st.head && !st.detached) { ctx.err("error: cannot delete branch '" + b + "' used by worktree at '" + root + "'\n"); status = 1; continue; }
                        if (opts.d && st.branches[b] && !ancestors(st, headCommit(st)).has(st.branches[b])) { ctx.err("error: the branch '" + b + "' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D " + b + "'\n"); status = 1; continue; }
                        ctx.outln('Deleted branch ' + b + ' (was ' + short(st.branches[b]) + ').');
                        delete st.branches[b];
                    }
                    save();
                    return status;
                }
                if (opts.m || opts.M) {
                    const [from, to] = operands.length === 2 ? operands : [st.head, operands[0]];
                    if (!(from in st.branches)) return ctx.fail("error: refname refs/heads/" + from + " not found", 1);
                    st.branches[to] = st.branches[from]; delete st.branches[from];
                    if (st.head === from) st.head = to;
                    save();
                    return 0;
                }
                if (operands.length) {
                    const name = operands[0];
                    if (!/^[A-Za-z0-9._\/-]+$/.test(name) || name.startsWith('-')) return ctx.fail("fatal: '" + name + "' is not a valid branch name", 128);
                    if (name in st.branches) return ctx.fail("fatal: a branch named '" + name + "' already exists", 128);
                    const base = operands[1] ? resolveRev(st, operands[1]) : headCommit(st);
                    if (!base) return ctx.fail("fatal: not a valid object name: '" + (operands[1] || st.head) + "'", 128);
                    st.branches[name] = base;
                    save();
                    return 0;
                }
                const names = Object.keys(st.branches).filter((b) => st.branches[b] || b === st.head).sort();
                if (st.detached) ctx.outln('* ' + c('32', '(HEAD detached at ' + short(st.detached) + ')'));
                for (const b of names) {
                    const cur = b === st.head && !st.detached;
                    const id = st.branches[b];
                    ctx.outln((cur ? '* ' + c('32', b) : '  ' + b) + (opts.v && id ? ' '.repeat(Math.max(1, 12 - b.length)) + c('33', short(id)) + ' ' + st.commits[id].msg.split('\n')[0] : ''));
                }
                if (opts.a || opts.r) for (const r of Object.keys(st.remoteRefs || {})) ctx.outln('  ' + c('31', 'remotes/' + r));
                return 0;
            }
            case 'checkout': case 'switch': {
                let create = false, force = false;
                const ops = [];
                let dashdash = false;
                for (let i = 0; i < rest.length; i++) {
                    const a = rest[i];
                    if (a === '--') { dashdash = true; continue; }
                    if (!dashdash && (a === '-b' || a === '-c' || a === '-B' || a === '-C')) { create = true; continue; }
                    if (!dashdash && (a === '-f' || a === '--force')) { force = true; continue; }
                    if (!dashdash && a.startsWith('-')) continue;
                    ops.push({ v: a, file: dashdash });
                }
                if (!ops.length) return ctx.fail('fatal: missing branch or commit argument', 128);
                const target = ops[0].v;
                // restore files: git checkout -- file / git checkout file
                if (sub === 'checkout' && !create && (ops[0].file || (!(target in st.branches) && !resolveRev(st, target) && Object.keys(st.index).some((f) => pathspecMatch([target], f))))) {
                    const specs = ops.map((o) => o.v);
                    for (const f of Object.keys(st.index)) if (pathspecMatch(specs, f)) writeTree(ctx, root, {}, { [f]: st.index[f] });
                    const n = Object.keys(st.index).filter((f) => pathspecMatch(specs, f)).length;
                    ctx.err('Updated ' + n + ' path' + (n === 1 ? '' : 's') + ' from the index\n');
                    return 0;
                }
                const headTree = treeOf(st, headCommit(st));
                const work = workingTree(ctx, root);
                const dirty = diffTrees(headTree, st.index);
                const wdirty = diffTrees(st.index, work);
                if (create) {
                    if (target in st.branches) return ctx.fail("fatal: a branch named '" + target + "' already exists", 128);
                    const base = ops[1] ? resolveRev(st, ops[1].v) : headCommit(st);
                    st.branches[target] = base;
                    if (base !== headCommit(st)) writeTree(ctx, root, headTree, treeOf(st, base)), st.index = Object.assign({}, treeOf(st, base));
                    st.head = target; st.detached = null;
                    st.reflog.push({ id: base, msg: 'checkout: moving to ' + target });
                    save();
                    ctx.err("Switched to a new branch '" + target + "'\n");
                    return 0;
                }
                let destId, branch = null;
                if (target in st.branches) { destId = st.branches[target]; branch = target; }
                else if (target === '-') { const prev = st.reflog.slice().reverse().find((r) => /checkout: moving from/.test(r.msg)); branch = prev ? prev.msg.split(' ').slice(-3)[0] : null; destId = branch ? st.branches[branch] : null; if (!branch) return ctx.fail('error: no previous branch', 1); }
                else if (st.remoteRefs && st.remoteRefs['origin/' + target]) { st.branches[target] = st.remoteRefs['origin/' + target]; destId = st.branches[target]; branch = target; ctx.err("branch '" + target + "' set up to track 'origin/" + target + "'.\n"); }
                else {
                    destId = resolveRev(st, target);
                    if (!destId || sub === 'switch') { ctx.err(sub === 'switch' ? "fatal: invalid reference: " + target + '\n' : "error: pathspec '" + target + "' did not match any file(s) known to git\n"); return 1; }
                }
                const destTree = treeOf(st, destId);
                const conflicts = wdirty.modified.concat(dirty.modified).filter((f) => destTree[f] !== headTree[f]);
                if (conflicts.length && !force) {
                    ctx.err('error: Your local changes to the following files would be overwritten by checkout:\n' + conflicts.map((f) => '\t' + f).join('\n') + '\nPlease commit your changes or stash them before you switch branches.\nAborting\n');
                    return 1;
                }
                if (branch === st.head && !st.detached) { ctx.err("Already on '" + branch + "'\n"); return 0; }
                const prevName = st.detached ? short(st.detached) : st.head;
                writeTree(ctx, root, headTree, destTree);
                // keep local uncommitted changes that do not conflict
                for (const f of wdirty.modified) if (destTree[f] === headTree[f]) writeTree(ctx, root, {}, { [f]: work[f] });
                st.index = Object.assign({}, destTree);
                for (const f of dirty.added.concat(dirty.modified)) if (!(f in destTree) || destTree[f] === headTree[f]) st.index[f] = st.index[f] || work[f];
                if (branch) { st.head = branch; st.detached = null; ctx.err("Switched to branch '" + branch + "'\n"); }
                else { st.detached = destId; ctx.err("Note: switching to '" + target + "'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nHEAD is now at " + short(destId) + ' ' + st.commits[destId].msg.split('\n')[0] + '\n'); }
                st.reflog.push({ id: destId, msg: 'checkout: moving from ' + prevName + ' to ' + (branch || target) });
                save();
                return 0;
            }
            case 'merge': {
                const ops = rest.filter((a) => !a.startsWith('-'));
                if (rest.includes('--abort')) {
                    if (!st.merge) return ctx.fail('fatal: There is no merge to abort (MERGE_HEAD missing).', 128);
                    const ht = treeOf(st, headCommit(st));
                    writeTree(ctx, root, workingTree(ctx, root), ht);
                    st.index = Object.assign({}, ht); st.merge = null; save();
                    return 0;
                }
                const other = ops[0];
                const otherId = resolveRev(st, other);
                if (!otherId) return ctx.fail('merge: ' + other + ' - not something we can merge', 1);
                const head = headCommit(st);
                if (head && ancestors(st, head).has(otherId)) { ctx.outln('Already up to date.'); return 0; }
                const headTree = treeOf(st, head);
                const otherTree = treeOf(st, otherId);
                if (!head || ancestors(st, otherId).has(head)) {
                    ctx.outln('Updating ' + short(head) + '..' + short(otherId) + '\nFast-forward');
                    const d = diffTrees(headTree, otherTree);
                    for (const f of d.added.concat(d.modified)) ctx.outln(' ' + f + ' | ' + splitLines(otherTree[f]).length + ' +');
                    ctx.outln(' ' + (d.added.length + d.modified.length + d.deleted.length) + ' file' + (d.added.length + d.modified.length + d.deleted.length === 1 ? '' : 's') + ' changed');
                    writeTree(ctx, root, headTree, otherTree);
                    st.index = Object.assign({}, otherTree);
                    if (st.detached) st.detached = otherId; else st.branches[st.head] = otherId;
                    save();
                    return 0;
                }
                // three-way merge
                const baseSet = ancestors(st, head);
                let base = null;
                for (const id of Object.keys(st.commits).sort((a, b) => st.commits[b].date - st.commits[a].date)) if (baseSet.has(id) && ancestors(st, otherId).has(id)) { base = id; break; }
                const baseTree = treeOf(st, base);
                const merged = Object.assign({}, headTree);
                const conflicts = [];
                const files = new Set(Object.keys(headTree).concat(Object.keys(otherTree), Object.keys(baseTree)));
                for (const f of files) {
                    const b = baseTree[f], h = headTree[f], o = otherTree[f];
                    if (h === o) continue;
                    if (b === h) { if (o === undefined) delete merged[f]; else merged[f] = o; continue; }
                    if (b === o) continue;
                    conflicts.push(f);
                    merged[f] = '<<<<<<< HEAD\n' + (h || '') + '=======\n' + (o || '') + '>>>>>>> ' + other + '\n';
                }
                writeTree(ctx, root, headTree, merged);
                if (conflicts.length) {
                    for (const f of conflicts) ctx.outln('Auto-merging ' + f + '\nCONFLICT (content): Merge conflict in ' + f);
                    ctx.outln('Automatic merge failed; fix conflicts and then commit the result.');
                    st.merge = { other: otherId, branch: other };
                    for (const f of Object.keys(merged)) if (!conflicts.includes(f)) st.index[f] = merged[f];
                    save();
                    return 1;
                }
                const who = author() || 'Linux Arsenal User <user@linux-arsenal>';
                const id = newId('merge' + other);
                st.commits[id] = { msg: "Merge branch '" + other + "'" + (st.head !== 'main' && st.head !== 'master' ? " into " + st.head : ''), author: who, date: Date.now(), parent: head, parent2: otherId, tree: merged };
                st.index = Object.assign({}, merged);
                if (st.detached) st.detached = id; else st.branches[st.head] = id;
                save();
                ctx.outln("Merge made by the 'ort' strategy.");
                const d = diffTrees(headTree, merged);
                for (const f of d.added.concat(d.modified)) ctx.outln(' ' + f + ' | ' + splitLines(merged[f]).length + ' +');
                return 0;
            }
            case 'diff': {
                const staged = rest.includes('--staged') || rest.includes('--cached');
                const nameOnly = rest.includes('--name-only');
                const stat = rest.includes('--stat');
                const ops = rest.filter((a) => !a.startsWith('-'));
                let a, b;
                const revs = ops.filter((o) => resolveRev(st, o) && !(fs.exists(ctx.resolve(o)) && !(o in st.branches)));
                const specs = ops.filter((o) => !revs.includes(o));
                if (revs.length === 2) { a = treeOf(st, resolveRev(st, revs[0])); b = treeOf(st, resolveRev(st, revs[1])); }
                else if (revs.length === 1) { a = treeOf(st, resolveRev(st, revs[0])); b = staged ? st.index : workingTree(ctx, root); }
                else if (staged) { a = treeOf(st, headCommit(st)); b = st.index; }
                else { a = st.index; b = workingTree(ctx, root); }
                const d = diffTrees(a, b);
                const changed = (staged || revs.length ? d.added : []).concat(d.modified, d.deleted).filter((f) => pathspecMatch(specs, f)).sort();
                for (const f of changed) {
                    if (nameOnly) { ctx.outln(f); continue; }
                    if (stat) { ctx.outln(' ' + f + ' | ' + (d.deleted.includes(f) ? '-' : '+')); continue; }
                    ctx.out(unifiedDiff(f, f in a ? a[f] : null, f in b ? b[f] : null, color));
                }
                if (stat && changed.length) ctx.outln(' ' + changed.length + ' file' + (changed.length > 1 ? 's' : '') + ' changed');
                return 0;
            }
            case 'restore': {
                const stagedOnly = rest.includes('--staged') || rest.includes('-S');
                const specs = rest.filter((a) => !a.startsWith('-'));
                if (!specs.length) return ctx.fail('fatal: you must specify path(s) to restore', 128);
                const headTree = treeOf(st, headCommit(st));
                let any = false;
                const files = new Set(Object.keys(st.index).concat(Object.keys(headTree)));
                for (const f of files) {
                    if (!pathspecMatch(specs, f)) continue;
                    any = true;
                    if (stagedOnly) { if (f in headTree) st.index[f] = headTree[f]; else delete st.index[f]; }
                    else if (f in st.index) writeTree(ctx, root, {}, { [f]: st.index[f] });
                }
                if (!any) { ctx.err("error: pathspec '" + specs[0] + "' did not match any file(s) known to git\n"); return 1; }
                save();
                return 0;
            }
            case 'reset': {
                const hard = rest.includes('--hard');
                const soft = rest.includes('--soft');
                const ops = rest.filter((a) => !a.startsWith('-'));
                const revArg = ops.length && resolveRev(st, ops[0]) ? ops.shift() : null;
                const head = headCommit(st);
                if (ops.length && !hard && !soft) {
                    const headTree = treeOf(st, revArg ? resolveRev(st, revArg) : head);
                    for (const f of Object.keys(st.index).concat(Object.keys(headTree))) if (pathspecMatch(ops, f)) { if (f in headTree) st.index[f] = headTree[f]; else delete st.index[f]; }
                    save();
                    const unstaged = diffTrees(st.index, workingTree(ctx, root));
                    if (unstaged.modified.length) ctx.outln('Unstaged changes after reset:\n' + unstaged.modified.map((f) => 'M\t' + f).join('\n'));
                    return 0;
                }
                const target = revArg ? resolveRev(st, revArg) : head;
                const tTree = treeOf(st, target);
                if (st.detached) st.detached = target; else st.branches[st.head] = target;
                if (!soft) st.index = Object.assign({}, tTree);
                if (hard) { writeTree(ctx, root, workingTree(ctx, root), tTree); st.merge = null; ctx.outln('HEAD is now at ' + short(target) + ' ' + (target ? st.commits[target].msg.split('\n')[0] : '')); }
                else if (!soft) {
                    const unstaged = diffTrees(st.index, workingTree(ctx, root));
                    if (unstaged.modified.length || unstaged.deleted.length) ctx.outln('Unstaged changes after reset:\n' + unstaged.modified.map((f) => 'M\t' + f).concat(unstaged.deleted.map((f) => 'D\t' + f)).join('\n'));
                }
                save();
                return 0;
            }
            case 'revert': {
                const id = resolveRev(st, rest.filter((a) => !a.startsWith('-'))[0]);
                if (!id) return ctx.fail('fatal: bad revision', 128);
                const cm = st.commits[id];
                const parentTree = treeOf(st, cm.parent);
                const head = headCommit(st);
                const cur = Object.assign({}, treeOf(st, head));
                const d = diffTrees(parentTree, cm.tree);
                for (const f of d.added) delete cur[f];
                for (const f of d.modified.concat(d.deleted)) cur[f] = parentTree[f];
                writeTree(ctx, root, treeOf(st, head), cur);
                const nid = newId('revert' + id);
                st.commits[nid] = { msg: 'Revert "' + cm.msg.split('\n')[0] + '"\n\nThis reverts commit ' + id + '.', author: author() || cm.author, date: Date.now(), parent: head, tree: cur };
                st.index = Object.assign({}, cur);
                if (st.detached) st.detached = nid; else st.branches[st.head] = nid;
                save();
                ctx.outln('[' + st.head + ' ' + short(nid) + '] Revert "' + cm.msg.split('\n')[0] + '"');
                return 0;
            }
            case 'stash': {
                const action = rest[0] || 'push';
                const head = headCommit(st);
                const headTree = treeOf(st, head);
                if (action === 'push' || action === 'save' || action === '-m') {
                    const work = workingTree(ctx, root);
                    const d1 = diffTrees(headTree, st.index), d2 = diffTrees(st.index, work);
                    if (!d1.added.length && !d1.modified.length && !d1.deleted.length && !d2.modified.length && !d2.deleted.length) { ctx.outln('No local changes to save'); return 0; }
                    const tracked = {};
                    for (const f of Object.keys(work)) if (f in st.index || f in headTree) tracked[f] = work[f];
                    const msgI = rest.indexOf('-m');
                    const msg = msgI >= 0 ? rest[msgI + 1] : 'WIP on ' + st.head + ': ' + short(head) + ' ' + (head ? st.commits[head].msg.split('\n')[0] : '');
                    st.stash.unshift({ index: Object.assign({}, st.index), work: tracked, msg: msgI >= 0 ? 'On ' + st.head + ': ' + msg : msg });
                    writeTree(ctx, root, tracked, headTree);
                    st.index = Object.assign({}, headTree);
                    save();
                    ctx.outln('Saved working directory and index state ' + st.stash[0].msg);
                    return 0;
                }
                if (action === 'list') { st.stash.forEach((s, i) => ctx.outln('stash@{' + i + '}: ' + s.msg)); return 0; }
                if (action === 'pop' || action === 'apply') {
                    if (!st.stash.length) return ctx.fail('No stash entries found.', 1);
                    const s = action === 'pop' ? st.stash.shift() : st.stash[0];
                    writeTree(ctx, root, {}, s.work);
                    st.index = Object.assign({}, st.index, s.index);
                    save();
                    if (action === 'pop') ctx.outln('Dropped refs/stash@{0}');
                    return 0;
                }
                if (action === 'drop') { if (!st.stash.length) return ctx.fail('No stash entries found.', 1); st.stash.shift(); save(); ctx.outln('Dropped refs/stash@{0}'); return 0; }
                if (action === 'clear') { st.stash = []; save(); return 0; }
                return ctx.fail('fatal: unknown subcommand: ' + action, 129);
            }
            case 'tag': {
                const del = rest.includes('-d');
                const ops = rest.filter((a, i) => !a.startsWith('-') && rest[i - 1] !== '-m');
                if (del) { for (const t of ops) { if (!st.tags[t]) { ctx.err("error: tag '" + t + "' not found.\n"); return 1; } ctx.outln("Deleted tag '" + t + "' (was " + short(st.tags[t]) + ')'); delete st.tags[t]; } save(); return 0; }
                if (!ops.length || rest.includes('-l')) { for (const t of Object.keys(st.tags).sort()) ctx.outln(t); return 0; }
                if (st.tags[ops[0]]) return ctx.fail("fatal: tag '" + ops[0] + "' already exists", 128);
                const id = ops[1] ? resolveRev(st, ops[1]) : headCommit(st);
                if (!id) return ctx.fail('fatal: Failed to resolve \'HEAD\' as a valid ref.', 128);
                st.tags[ops[0]] = id;
                save();
                return 0;
            }
            case 'show': {
                const id = resolveRev(st, rest.filter((a) => !a.startsWith('-'))[0] || 'HEAD');
                if (!id) return ctx.fail("fatal: ambiguous argument '" + rest[0] + "': unknown revision or path not in the working tree.", 128);
                const cm = st.commits[id];
                ctx.outln(c('33', 'commit ' + id) + '\nAuthor: ' + cm.author + '\nDate:   ' + gitDate(cm.date) + '\n\n' + cm.msg.split('\n').map((l) => '    ' + l).join('\n') + '\n');
                const pt = treeOf(st, cm.parent);
                const d = diffTrees(pt, cm.tree);
                for (const f of d.added.concat(d.modified, d.deleted).sort()) ctx.out(unifiedDiff(f, f in pt ? pt[f] : null, f in cm.tree ? cm.tree[f] : null, color));
                return 0;
            }
            case 'remote': {
                const verbose = rest.includes('-v');
                const ops = rest.filter((a) => !a.startsWith('-'));
                if (ops[0] === 'add') {
                    if (st.remotes[ops[1]]) return ctx.fail('error: remote ' + ops[1] + ' already exists.', 3);
                    if (!ops[2]) return ctx.fail('usage: git remote add [<options>] <name> <url>', 129);
                    st.remotes[ops[1]] = ops[2]; save(); return 0;
                }
                if (ops[0] === 'remove' || ops[0] === 'rm') { if (!st.remotes[ops[1]]) return ctx.fail("error: No such remote: '" + ops[1] + "'", 2); delete st.remotes[ops[1]]; save(); return 0; }
                if (ops[0] === 'set-url') { if (!st.remotes[ops[1]]) return ctx.fail("error: No such remote '" + ops[1] + "'", 2); st.remotes[ops[1]] = ops[2]; save(); return 0; }
                if (ops[0] === 'get-url') { if (!st.remotes[ops[1]]) return ctx.fail("error: No such remote '" + ops[1] + "'", 2); ctx.outln(st.remotes[ops[1]]); return 0; }
                for (const [n, u] of Object.entries(st.remotes)) { if (verbose) { ctx.outln(n + '\t' + u + ' (fetch)'); ctx.outln(n + '\t' + u + ' (push)'); } else ctx.outln(n); }
                return 0;
            }
            case 'push': {
                const ops = rest.filter((a) => !a.startsWith('-'));
                const remote = ops[0] || 'origin';
                const branch = ops[1] || st.head;
                if (!st.remotes[remote]) { ctx.err("fatal: '" + remote + "' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n"); return 128; }
                if (!st.branches[branch]) return ctx.fail("error: src refspec " + branch + ' does not match any\nerror: failed to push some refs to \'' + st.remotes[remote] + "'", 1);
                st.remoteRefs = st.remoteRefs || {};
                const old = st.remoteRefs[remote + '/' + branch];
                if (old === st.branches[branch]) { ctx.err('Everything up-to-date\n'); return 0; }
                st.remoteRefs[remote + '/' + branch] = st.branches[branch];
                save();
                ctx.err('Enumerating objects: 5, done.\nCounting objects: 100% (5/5), done.\nDelta compression using up to 4 threads\nCompressing objects: 100% (3/3), done.\nWriting objects: 100% (3/3), 312 bytes | 312.00 KiB/s, done.\nTotal 3 (delta 1), reused 0 (delta 0), pack-reused 0\nTo ' + st.remotes[remote] + '\n   ' + (old ? short(old) + '..' + short(st.branches[branch]) + '  ' : ' * [new branch]      ') + branch + ' -> ' + branch + '\n' + (rest.includes('-u') || rest.includes('--set-upstream') ? "branch '" + branch + "' set up to track '" + remote + '/' + branch + "'.\n" : ''));
                return 0;
            }
            case 'pull': case 'fetch': {
                const remote = rest.filter((a) => !a.startsWith('-'))[0] || 'origin';
                if (!st.remotes[remote]) { ctx.err("fatal: '" + remote + "' does not appear to be a git repository\nfatal: Could not read from remote repository.\n"); return 128; }
                if (sub === 'pull') ctx.outln('Already up to date.');
                return 0;
            }
            case 'ls-files': { for (const f of Object.keys(st.index).sort()) ctx.outln(f); return 0; }
            case 'rev-parse': {
                if (rest.includes('--show-toplevel')) { ctx.outln(root); return 0; }
                if (rest.includes('--is-inside-work-tree')) { ctx.outln('true'); return 0; }
                if (rest.includes('--abbrev-ref')) { ctx.outln(st.detached ? 'HEAD' : st.head); return 0; }
                const r = rest.filter((a) => !a.startsWith('-'))[0] || 'HEAD';
                const id = resolveRev(st, r);
                if (!id) { ctx.err("fatal: ambiguous argument '" + r + "': unknown revision or path not in the working tree.\n"); return 128; }
                ctx.outln(rest.includes('--short') ? short(id) : id);
                return 0;
            }
            case 'reflog': { st.reflog.slice().reverse().forEach((r, i) => ctx.outln(c('33', short(r.id)) + ' HEAD@{' + i + '}: ' + r.msg)); return 0; }
            case 'blame': {
                const f = relOf(rest.filter((a) => !a.startsWith('-'))[0] || '');
                const head = headCommit(st);
                if (!head || !(f in treeOf(st, head))) return ctx.fail("fatal: no such path '" + f + "' in HEAD", 128);
                const cm = st.commits[head];
                splitLines(treeOf(st, head)[f]).forEach((l, i) => ctx.outln(short(head) + ' (' + cm.author.replace(/ <.*/, '').padEnd(10) + ' ' + U.isoDate(cm.date).slice(0, 10) + ' ' + String(i + 1).padStart(2) + ') ' + l));
                return 0;
            }
            case 'clean': {
                const force = rest.some((a) => /^-\w*f/.test(a));
                const dry = rest.some((a) => /^-\w*n/.test(a));
                if (!force && !dry) return ctx.fail('fatal: clean.requireForce defaults to true and neither -i, -n, nor -f given; refusing to clean', 128);
                const work = workingTree(ctx, root);
                for (const f of Object.keys(work).filter((x) => !(x in st.index)).sort()) {
                    ctx.outln((dry ? 'Would remove ' : 'Removing ') + f);
                    if (!dry) fs.unlink(root + '/' + f);
                }
                return 0;
            }
            case 'cherry-pick': {
                const id = resolveRev(st, rest[0]);
                if (!id) return ctx.fail('fatal: bad revision \'' + rest[0] + "'", 128);
                const cm = st.commits[id];
                const d = diffTrees(treeOf(st, cm.parent), cm.tree);
                const head = headCommit(st);
                const cur = Object.assign({}, treeOf(st, head));
                for (const f of d.added.concat(d.modified)) cur[f] = cm.tree[f];
                for (const f of d.deleted) delete cur[f];
                writeTree(ctx, root, treeOf(st, head), cur);
                const nid = newId('pick' + id);
                st.commits[nid] = { msg: cm.msg, author: cm.author, date: Date.now(), parent: head, tree: cur };
                st.index = Object.assign({}, cur);
                if (st.detached) st.detached = nid; else st.branches[st.head] = nid;
                save();
                ctx.outln('[' + st.head + ' ' + short(nid) + '] ' + cm.msg.split('\n')[0]);
                return 0;
            }
        }
        ctx.err("git: '" + sub + "' is not a git command. See 'git --help'.\n");
        return 1;
    });

    // ================================================================= DOCKER
    const IMAGES = {
        'hello-world': { tags: ['latest'], size: '13.3kB', cmd: '/hello', long: false },
        ubuntu: { tags: ['latest', '24.04', '22.04', '20.04'], size: '78.1MB', cmd: '/bin/bash', long: false },
        debian: { tags: ['latest', 'bookworm', 'bullseye'], size: '117MB', cmd: 'bash', long: false },
        alpine: { tags: ['latest', '3.20', '3.19'], size: '7.8MB', cmd: '/bin/sh', long: false },
        busybox: { tags: ['latest'], size: '4.26MB', cmd: 'sh', long: false },
        nginx: { tags: ['latest', 'alpine', '1.27', '1.25'], size: '188MB', cmd: '/docker-entrypoint.sh nginx -g \'daemon off;\'', long: true, port: 80 },
        httpd: { tags: ['latest', '2.4'], size: '148MB', cmd: 'httpd-foreground', long: true, port: 80 },
        redis: { tags: ['latest', '7', '7-alpine'], size: '117MB', cmd: 'docker-entrypoint.sh redis-server', long: true, port: 6379 },
        postgres: { tags: ['latest', '16', '15'], size: '432MB', cmd: 'docker-entrypoint.sh postgres', long: true, port: 5432 },
        mysql: { tags: ['latest', '8.0', '8.4'], size: '586MB', cmd: 'docker-entrypoint.sh mysqld', long: true, port: 3306 },
        node: { tags: ['latest', '20', '18', '20-alpine'], size: '1.1GB', cmd: 'node', long: false },
        python: { tags: ['latest', '3.12', '3.11', '3.12-slim'], size: '1.02GB', cmd: 'python3', long: false },
        mongo: { tags: ['latest', '7'], size: '757MB', cmd: 'mongod', long: true, port: 27017 }
    };
    function dockerState(sys) {
        if (!sys.docker) {
            sys.docker = {
                images: [{ repo: 'ubuntu', tag: '24.04', id: 'b1d9df8ab815', created: Date.now() - 86400000 * 20, size: '78.1MB' }],
                containers: [],
                volumes: [],
                networks: [{ id: '3f6d1c8b2a91', name: 'bridge', driver: 'bridge' }, { id: '9a8b7c6d5e4f', name: 'host', driver: 'host' }, { id: '1a2b3c4d5e6f', name: 'none', driver: 'null' }],
                counter: 0
            };
        }
        return sys.docker;
    }
    LA.dockerState = dockerState;
    const ADJ = ['admiring', 'brave', 'clever', 'eager', 'festive', 'gallant', 'happy', 'jolly', 'keen', 'lucid', 'nifty', 'quirky', 'serene', 'vibrant', 'zealous'];
    const NOUN = ['turing', 'hopper', 'lovelace', 'torvalds', 'ritchie', 'thompson', 'knuth', 'stallman', 'curie', 'tesla', 'darwin', 'babbage', 'hamilton', 'shannon', 'wozniak'];
    function ago(ms) {
        const s = Math.floor((Date.now() - ms) / 1000);
        if (s < 60) return (s < 2 ? 'Less than a second' : s + ' seconds') + ' ago';
        if (s < 3600) return Math.floor(s / 60) + ' minute' + (s < 120 ? '' : 's') + ' ago';
        if (s < 86400) return Math.floor(s / 3600) + ' hour' + (s < 7200 ? '' : 's') + ' ago';
        return Math.floor(s / 86400) + ' days ago';
    }
    R('docker', (ctx) => {
        const sh = ctx.sh, sys = sh.system;
        const args = ctx.args.slice();
        let sub = args[0];
        let rest = args.slice(1);
        if (sub === 'container' || sub === 'image') {
            const map = { container: { ls: 'ps', list: 'ps', rm: 'rm', start: 'start', stop: 'stop', inspect: 'inspect', logs: 'logs', prune: 'cprune' }, image: { ls: 'images', list: 'images', rm: 'rmi', pull: 'pull', build: 'build', inspect: 'inspect', prune: 'iprune', tag: 'tag' } };
            const mapped = map[sub][rest[0]];
            if (!mapped) return ctx.fail('docker: \'' + sub + ' ' + (rest[0] || '') + "' is not a docker command.", 1);
            sub = mapped; rest = rest.slice(1);
        }
        if (!sub || sub === '--help' || sub === 'help') {
            ctx.outln('\nUsage:  docker [OPTIONS] COMMAND\n\nA self-sufficient runtime for containers\n\nCommon Commands:\n  run         Create and run a new container from an image\n  exec        Execute a command in a running container\n  ps          List containers\n  build       Build an image from a Dockerfile\n  pull        Download an image from a registry\n  images      List images\n  version     Show the Docker version information\n  info        Display system-wide information\n\nManagement Commands:\n  container   Manage containers\n  image       Manage images\n  network     Manage networks\n  volume      Manage volumes\n  system      Manage Docker\n\nCommands:\n  logs        Fetch the logs of a container\n  rm          Remove one or more containers\n  rmi         Remove one or more images\n  start       Start one or more stopped containers\n  stop        Stop one or more running containers\n  restart     Restart one or more containers\n  inspect     Return low-level information on Docker objects\n  tag         Create a tag TARGET_IMAGE that refers to SOURCE_IMAGE');
            return 0;
        }
        if (sub === '--version' || sub === '-v') { ctx.outln('Docker version 24.0.7, build 24.0.7-0ubuntu4'); return 0; }
        if (sh.user !== 'root' && !sys.groupsOf(sh.user).includes('docker')) {
            ctx.err('permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Get "http://%2Fvar%2Frun%2Fdocker.sock/v1.24/containers/json": dial unix /var/run/docker.sock: connect: permission denied\n');
            return 1;
        }
        if (!sys.services.docker.active) {
            ctx.err('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?\n');
            return 1;
        }
        const D = dockerState(sys);
        const findC = (ref) => D.containers.find((c) => c.name === ref || c.id.startsWith(ref));
        const parseImage = (ref) => { const at = ref.lastIndexOf(':'); return at > 0 && !ref.slice(at).includes('/') ? { repo: ref.slice(0, at), tag: ref.slice(at + 1) } : { repo: ref, tag: 'latest' }; };
        const findImg = (ref) => { const { repo, tag } = parseImage(ref); return D.images.find((i) => (i.repo === repo && i.tag === tag) || i.id.startsWith(ref)); };
        const pull = (ref, quiet) => {
            const { repo, tag } = parseImage(ref);
            const meta = IMAGES[repo];
            if (!meta || !meta.tags.includes(tag)) {
                ctx.err('Error response from daemon: ' + (meta ? 'manifest for ' + repo + ':' + tag + ' not found: manifest unknown: manifest unknown' : 'pull access denied for ' + repo + ", repository does not exist or may require 'docker login': denied: requested access to the resource is denied") + '\n');
                return null;
            }
            let img = findImg(repo + ':' + tag);
            if (img) { if (!quiet) ctx.outln(tag + ': Pulling from library/' + repo + '\nDigest: sha256:' + LA.hash.sha256(repo + tag).slice(0, 64) + '\nStatus: Image is up to date for ' + repo + ':' + tag + '\ndocker.io/library/' + repo + ':' + tag); return img; }
            const id = LA.hash.sha256(repo + ':' + tag).slice(0, 12);
            img = { repo, tag, id, created: Date.now() - 86400000 * (3 + (U.hashString(repo) % 20)), size: meta.size };
            D.images.push(img);
            const layers = [LA.hash.sha1(repo + '1').slice(0, 12), LA.hash.sha1(repo + '2').slice(0, 12)];
            const lines = (quiet ? "Unable to find image '" + repo + ':' + tag + "' locally\n" : '') + tag + ': Pulling from library/' + repo + '\n' + layers.map((l) => l + ': Pull complete').join('\n') + '\nDigest: sha256:' + LA.hash.sha256(repo + tag) + '\nStatus: Downloaded newer image for ' + repo + ':' + tag + (quiet ? '' : '\ndocker.io/library/' + repo + ':' + tag);
            if (quiet) ctx.err(lines + '\n'); else ctx.outln(lines);
            return img;
        };
        const setRunning = (c, running) => {
            c.status = running ? 'running' : 'exited';
            c.since = Date.now();
            sys.processes = sys.processes.filter((p) => p.container !== c.id);
            if (running) sys.processes.push({ pid: 3000 + c.num, ppid: 880, user: 'root', cmd: c.cmd, stat: 'Ss', cpu: 0.3, mem: 0.9, vsz: 98000, rss: 12000, tty: '?', start: Date.now(), container: c.id });
        };
        switch (sub) {
            case 'version':
                ctx.outln('Client:\n Version:           24.0.7\n API version:       1.43\n Go version:        go1.22.2\n Git commit:        24.0.7-0ubuntu4\n OS/Arch:           linux/amd64\n\nServer:\n Engine:\n  Version:          24.0.7\n  API version:      1.43 (minimum version 1.12)\n  OS/Arch:          linux/amd64\n containerd:\n  Version:          1.7.12\n runc:\n  Version:          1.1.12-0ubuntu3');
                return 0;
            case 'info': {
                const running = D.containers.filter((c) => c.status === 'running').length;
                ctx.outln('Client:\n Version:    24.0.7\n Context:    default\n\nServer:\n Containers: ' + D.containers.length + '\n  Running: ' + running + '\n  Paused: 0\n  Stopped: ' + (D.containers.length - running) + '\n Images: ' + D.images.length + '\n Server Version: 24.0.7\n Storage Driver: overlay2\n Cgroup Driver: systemd\n Kernel Version: 6.8.0-45-generic\n Operating System: Ubuntu 24.04.1 LTS\n CPUs: 4\n Total Memory: 7.748GiB\n Name: ' + sys.hostname + '\n Docker Root Dir: /var/lib/docker');
                return 0;
            }
            case 'pull': {
                const ref = rest.filter((a) => !a.startsWith('-'))[0];
                if (!ref) return ctx.fail('"docker pull" requires exactly 1 argument.', 1);
                return pull(ref, false) ? 0 : 1;
            }
            case 'images': {
                const q = rest.includes('-q');
                const filter = rest.filter((a) => !a.startsWith('-'))[0];
                const list = D.images.filter((i) => !filter || i.repo === filter);
                if (q) { for (const i of list) ctx.outln(i.id); return 0; }
                ctx.outln('REPOSITORY    TAG       IMAGE ID       CREATED        SIZE');
                for (const i of list.slice().reverse()) ctx.outln(i.repo.padEnd(13) + ' ' + i.tag.padEnd(9) + ' ' + i.id + '   ' + ago(i.created).padEnd(14) + ' ' + i.size);
                return 0;
            }
            case 'ps': {
                const all = rest.includes('-a') || rest.includes('--all');
                const q = rest.includes('-q') || rest.includes('-aq') || rest.includes('-qa');
                const list = D.containers.filter((c) => all || rest.includes('-aq') || rest.includes('-qa') ? true : c.status === 'running');
                if (q) { for (const c of list) ctx.outln(c.id.slice(0, 12)); return 0; }
                const rows = [['CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES']];
                for (const c of list.slice().reverse()) {
                    const status = c.status === 'running' ? 'Up ' + ago(c.since).replace(' ago', '') : c.status === 'paused' ? 'Up (Paused)' : c.status === 'created' ? 'Created' : 'Exited (' + (c.exitCode || 0) + ') ' + ago(c.since);
                    const ports = (c.ports || []).map((p) => '0.0.0.0:' + p.host + '->' + p.container + '/tcp').join(', ') || (c.status === 'running' && IMAGES[c.image.split(':')[0]] && IMAGES[c.image.split(':')[0]].port ? IMAGES[c.image.split(':')[0]].port + '/tcp' : '');
                    rows.push([c.id.slice(0, 12), c.image, '"' + (c.cmd.length > 20 ? c.cmd.slice(0, 19) + '…' : c.cmd) + '"', ago(c.created), status, ports, c.name]);
                }
                const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
                for (const r of rows) ctx.outln(r.map((cell, i) => (i === r.length - 1 ? cell : cell.padEnd(widths[i]))).join('   '));
                return 0;
            }
            case 'run': case 'create': {
                const o = { detach: false, name: null, ports: [], env: [], rm: false, it: false, volumes: [] };
                let i = 0;
                for (; i < rest.length; i++) {
                    const a = rest[i];
                    if (!a.startsWith('-')) break;
                    if (a === '-d' || a === '--detach') o.detach = true;
                    else if (a === '-it' || a === '-ti' || a === '-i' || a === '-t') o.it = true;
                    else if (a === '-dit' || a === '-itd') { o.detach = true; o.it = true; }
                    else if (a === '--rm') o.rm = true;
                    else if (a === '--name') o.name = rest[++i];
                    else if (a.startsWith('--name=')) o.name = a.slice(7);
                    else if (a === '-p' || a === '--publish') { const m = /^(?:(\d+):)?(\d+)(?:\/\w+)?$/.exec(rest[++i] || ''); if (!m) return ctx.fail('invalid publish opts format', 125); o.ports.push({ host: parseInt(m[1] || m[2], 10), container: parseInt(m[2], 10) }); }
                    else if (a === '-e' || a === '--env') o.env.push(rest[++i]);
                    else if (a === '-v' || a === '--volume') o.volumes.push(rest[++i]);
                    else if (a === '--network' || a === '--restart' || a === '-w' || a === '--hostname' || a === '-h' || a === '--memory' || a === '-m' || a === '--cpus') i++;
                }
                const ref = rest[i];
                if (!ref) return ctx.fail('"docker ' + sub + '" requires at least 1 argument.', 125);
                const cmdArgs = rest.slice(i + 1);
                let img = findImg(ref);
                if (!img) { img = pull(ref.includes(':') ? ref : ref + ':latest', true); if (!img) return 125; }
                if (o.name && findC(o.name)) { ctx.err('docker: Error response from daemon: Conflict. The container name "/' + o.name + '" is already in use by container "' + findC(o.name).id + '". You have to remove (or rename) that container to be able to reuse that name.\n'); return 125; }
                for (const p of o.ports) {
                    const used = LA.listeningPorts(sh).some((s) => s.port === p.host);
                    if (used) { ctx.err('docker: Error response from daemon: driver failed programming external connectivity on endpoint: Bind for 0.0.0.0:' + p.host + ' failed: port is already allocated.\n'); return 125; }
                }
                const meta = IMAGES[img.repo] || { cmd: 'sh', long: false };
                D.counter++;
                const rnd = U.mulberry32(U.hashString(String(D.counter) + ref + (o.name || '')));
                const name = o.name || ADJ[Math.floor(rnd() * ADJ.length)] + '_' + NOUN[Math.floor(rnd() * NOUN.length)];
                const id = LA.hash.sha256(name + D.counter + Date.now());
                const c = { id, name, image: img.repo + (img.tag !== 'latest' ? ':' + img.tag : ''), cmd: cmdArgs.length ? cmdArgs.join(' ') : meta.cmd, status: 'created', created: Date.now(), since: Date.now(), ports: o.ports, env: o.env, num: D.counter, logs: '', exitCode: 0 };
                D.containers.push(c);
                if (sub === 'create') { ctx.outln(id); return 0; }
                // run
                let output = '';
                if (img.repo === 'hello-world') output = '\nHello from Docker!\nThis message shows that your installation appears to be working correctly.\n\nTo generate this message, Docker took the following steps:\n 1. The Docker client contacted the Docker daemon.\n 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.\n    (amd64)\n 3. The Docker daemon created a new container from that image which runs the\n    executable that produces the output you are currently reading.\n 4. The Docker daemon streamed that output to the Docker client, which sent it\n    to your terminal.\n\nTo try something more ambitious, you can run an Ubuntu container with:\n $ docker run -it ubuntu bash\n\nShare images, automate workflows, and more with a free Docker ID:\n https://hub.docker.com/\n\nFor more examples and ideas, visit:\n https://docs.docker.com/get-started/\n';
                else if (cmdArgs.length) output = containerExec(c, img, cmdArgs);
                else if (meta.long) output = img.repo === 'nginx' ? '/docker-entrypoint.sh: Configuration complete; ready for start up\n' + U.strftime('%Y/%m/%d %H:%M:%S', new Date()) + ' [notice] 1#1: nginx/1.27.2\n' + U.strftime('%Y/%m/%d %H:%M:%S', new Date()) + ' [notice] 1#1: start worker processes\n' : img.repo === 'redis' ? '1:M * Ready to accept connections tcp\n' : img.repo === 'postgres' ? 'database system is ready to accept connections\n' : 'ready\n';
                c.logs = output;
                const longRunning = meta.long && !cmdArgs.length || (o.it && o.detach) || (cmdArgs.join(' ').includes('sleep'));
                if (longRunning) setRunning(c, true);
                else { c.status = 'exited'; c.since = Date.now(); }
                if (o.detach) ctx.outln(id);
                else {
                    if (o.it && !cmdArgs.length && !meta.long) ctx.err('(interactive container shells are simulated: use "docker exec ' + name + ' <command>" or "docker run ' + img.repo + ' <command>")\n');
                    ctx.out(output);
                    if (meta.long && !cmdArgs.length) ctx.err('(container "' + name + '" keeps running in the background - the sandbox returned your prompt; use docker logs/stop)\n');
                }
                if (o.rm && c.status === 'exited') D.containers = D.containers.filter((x) => x !== c);
                return 0;
            }
            case 'exec': {
                const flagsEnd = rest.findIndex((a) => !a.startsWith('-'));
                const ref = rest[flagsEnd];
                const c = ref && findC(ref);
                if (!c) { ctx.err('Error response from daemon: No such container: ' + (ref || '') + '\n'); return 1; }
                if (c.status !== 'running') { ctx.err('Error response from daemon: container ' + c.id + ' is not running\n'); return 1; }
                const cmdArgs = rest.slice(flagsEnd + 1);
                if (!cmdArgs.length) return ctx.fail('"docker exec" requires at least 2 arguments.', 1);
                const img = findImg(c.image) || { repo: c.image.split(':')[0] };
                ctx.out(containerExec(c, img, cmdArgs));
                return 0;
            }
            case 'stop': case 'kill': case 'start': case 'restart': case 'pause': case 'unpause': {
                const refs = rest.filter((a) => !a.startsWith('-') && !/^\d+$/.test(a));
                if (!refs.length) return ctx.fail('"docker ' + sub + '" requires at least 1 argument.', 1);
                let status = 0;
                for (const r of refs) {
                    const c = findC(r);
                    if (!c) { ctx.err('Error response from daemon: No such container: ' + r + '\n'); status = 1; continue; }
                    if (sub === 'stop' || sub === 'kill') { if (c.status === 'running') { setRunning(c, false); c.exitCode = sub === 'kill' ? 137 : 0; } }
                    else if (sub === 'start' || sub === 'restart') {
                        const img = findImg(c.image) || { repo: c.image };
                        const meta = IMAGES[img.repo.split(':')[0]] || {};
                        if (meta.long || sub === 'restart' || c.cmd.includes('sleep')) setRunning(c, true);
                        else { c.since = Date.now(); }
                    } else if (sub === 'pause') c.status = 'paused';
                    else c.status = 'running';
                    ctx.outln(r);
                }
                return status;
            }
            case 'rm': {
                const force = rest.includes('-f') || rest.includes('--force');
                const refs = rest.filter((a) => !a.startsWith('-'));
                if (!refs.length) return ctx.fail('"docker rm" requires at least 1 argument.', 1);
                let status = 0;
                for (const r of refs) {
                    const c = findC(r);
                    if (!c) { ctx.err('Error response from daemon: No such container: ' + r + '\n'); status = 1; continue; }
                    if (c.status === 'running' && !force) { ctx.err('Error response from daemon: You cannot remove a running container ' + c.id + '. Stop the container before attempting removal or force remove\n'); status = 1; continue; }
                    setRunning(c, false);
                    D.containers = D.containers.filter((x) => x !== c);
                    ctx.outln(r);
                }
                return status;
            }
            case 'rmi': {
                const force = rest.includes('-f');
                let status = 0;
                for (const r of rest.filter((a) => !a.startsWith('-'))) {
                    const img = findImg(r);
                    if (!img) { ctx.err('Error response from daemon: No such image: ' + r + '\n'); status = 1; continue; }
                    const used = D.containers.find((c) => c.image === img.repo + (img.tag !== 'latest' ? ':' + img.tag : '') || c.image === img.repo + ':' + img.tag);
                    if (used && !force) { ctx.err('Error response from daemon: conflict: unable to remove repository reference "' + r + '" (must force) - container ' + used.id.slice(0, 12) + ' is using its referenced image ' + img.id + '\n'); status = 1; continue; }
                    D.images = D.images.filter((x) => x !== img);
                    ctx.outln('Untagged: ' + img.repo + ':' + img.tag + '\nDeleted: sha256:' + LA.hash.sha256(img.id));
                }
                return status;
            }
            case 'logs': {
                const ref = rest.filter((a) => !a.startsWith('-') && !/^\d+$/.test(a))[0];
                const c = ref && findC(ref);
                if (!c) { ctx.err('Error response from daemon: No such container: ' + (ref || '') + '\n'); return 1; }
                let logs = c.logs;
                const ti = rest.indexOf('--tail');
                if (ti >= 0) logs = splitLines(logs).slice(-parseInt(rest[ti + 1], 10)).join('\n') + (logs ? '\n' : '');
                ctx.out(logs);
                return 0;
            }
            case 'inspect': {
                const ref = rest.filter((a) => !a.startsWith('-'))[0];
                const c = ref && findC(ref);
                const fmtI = rest.indexOf('--format') >= 0 ? rest[rest.indexOf('--format') + 1] : rest.indexOf('-f') >= 0 ? rest[rest.indexOf('-f') + 1] : null;
                if (c) {
                    const info = { Id: c.id, Created: new Date(c.created).toISOString(), Path: c.cmd.split(' ')[0], State: { Status: c.status, Running: c.status === 'running', ExitCode: c.exitCode }, Name: '/' + c.name, Config: { Image: c.image, Env: c.env, Cmd: c.cmd.split(' ') }, NetworkSettings: { IPAddress: c.status === 'running' ? '172.17.0.' + (1 + c.num) : '', Ports: Object.fromEntries((c.ports || []).map((p) => [p.container + '/tcp', [{ HostIp: '0.0.0.0', HostPort: String(p.host) }]])) } };
                    if (fmtI) {
                        const v = fmtI.replace(/\{\{\s*\.([\w.]+)\s*\}\}/g, (m, path) => { let o = info; for (const k of path.split('.')) o = o == null ? undefined : o[k]; return o === undefined ? '<no value>' : typeof o === 'object' ? JSON.stringify(o) : String(o); });
                        ctx.outln(v);
                    } else ctx.outln(JSON.stringify([info], null, 4));
                    return 0;
                }
                const img = ref && findImg(ref);
                if (img) { ctx.outln(JSON.stringify([{ Id: 'sha256:' + LA.hash.sha256(img.id), RepoTags: [img.repo + ':' + img.tag], Created: new Date(img.created).toISOString(), Size: img.size, Architecture: 'amd64', Os: 'linux' }], null, 4)); return 0; }
                ctx.err('Error: No such object: ' + (ref || '') + '\n');
                return 1;
            }
            case 'rename': {
                const c = findC(rest[0]);
                if (!c) return ctx.fail('Error response from daemon: No such container: ' + rest[0], 1);
                if (findC(rest[1])) return ctx.fail('Error response from daemon: Conflict. The name "/' + rest[1] + '" is already in use', 1);
                c.name = rest[1];
                return 0;
            }
            case 'tag': {
                const src = findImg(rest[0] || '');
                if (!src) return ctx.fail('Error response from daemon: No such image: ' + (rest[0] || ''), 1);
                const { repo, tag } = parseImage(rest[1] || '');
                D.images.push(Object.assign({}, src, { repo, tag }));
                return 0;
            }
            case 'build': {
                let tagArg = null;
                let fileArg = null;
                const ops = [];
                for (let i = 0; i < rest.length; i++) {
                    if (rest[i] === '-t' || rest[i] === '--tag') tagArg = rest[++i];
                    else if (rest[i] === '-f' || rest[i] === '--file') fileArg = rest[++i];
                    else if (!rest[i].startsWith('-')) ops.push(rest[i]);
                }
                const dir = ops[0];
                if (!dir) return ctx.fail('"docker build" requires exactly 1 argument.', 1);
                const df = fileArg ? ctx.resolve(fileArg) : ctx.resolve(dir) + '/Dockerfile';
                let text;
                try { text = ctx.fs.readFile(df); } catch (e) { ctx.err('ERROR: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory\n'); return 1; }
                const lines = splitLines(text).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
                const from = lines.find((l) => /^FROM\s/i.test(l));
                if (!from) { ctx.err('ERROR: failed to solve: dockerfile parse error: no FROM instruction found\n'); return 1; }
                const base = from.split(/\s+/)[1];
                const bimg = findImg(base) || pull(base.includes(':') ? base : base + ':latest', true);
                if (!bimg) return 1;
                const steps = lines.length;
                ctx.err('[+] Building 2.4s (' + (steps + 2) + '/' + (steps + 2) + ') FINISHED                                       docker:default\n => [internal] load build definition from Dockerfile                    0.0s\n => [internal] load metadata for docker.io/library/' + base + '         0.5s\n');
                lines.forEach((l, i) => ctx.err(' => [' + (i + 1) + '/' + steps + '] ' + l.slice(0, 60).padEnd(60) + ' 0.' + (i + 1) + 's\n'));
                const { repo, tag } = tagArg ? parseImage(tagArg) : { repo: '<none>', tag: '<none>' };
                const id = LA.hash.sha256(text + repo + tag).slice(0, 12);
                D.images = D.images.filter((i) => !(i.repo === repo && i.tag === tag && repo !== '<none>'));
                D.images.push({ repo, tag, id, created: Date.now(), size: (parseFloat(bimg.size) + 12).toFixed(1) + 'MB', dockerfile: text });
                ctx.err(' => exporting to image                                                  0.1s\n => => writing image sha256:' + LA.hash.sha256(id) + '\n' + (tagArg ? ' => => naming to docker.io/library/' + repo + ':' + tag + '\n' : ''));
                return 0;
            }
            case 'volume': {
                const v = rest[0];
                const name = rest[1];
                if (v === 'create') { const n = name || LA.hash.sha256(String(Date.now())).slice(0, 64); if (!D.volumes.includes(n)) D.volumes.push(n); ctx.outln(n); return 0; }
                if (v === 'ls') { ctx.outln('DRIVER    VOLUME NAME'); for (const n of D.volumes) ctx.outln('local     ' + n); return 0; }
                if (v === 'rm') { if (!D.volumes.includes(name)) return ctx.fail('Error response from daemon: get ' + name + ': no such volume', 1); D.volumes = D.volumes.filter((x) => x !== name); ctx.outln(name); return 0; }
                if (v === 'inspect') { if (!D.volumes.includes(name)) return ctx.fail('Error: No such volume: ' + name, 1); ctx.outln(JSON.stringify([{ CreatedAt: new Date().toISOString(), Driver: 'local', Mountpoint: '/var/lib/docker/volumes/' + name + '/_data', Name: name, Scope: 'local' }], null, 4)); return 0; }
                if (v === 'prune') { ctx.outln('Total reclaimed space: 0B'); D.volumes = []; return 0; }
                return ctx.fail('Usage:  docker volume COMMAND', 1);
            }
            case 'network': {
                const v = rest[0];
                const name = rest[rest.length - 1];
                if (v === 'ls') { ctx.outln('NETWORK ID     NAME      DRIVER    SCOPE'); for (const n of D.networks) ctx.outln(n.id + '   ' + n.name.padEnd(9) + ' ' + n.driver.padEnd(9) + ' local'); return 0; }
                if (v === 'create') { if (D.networks.some((n) => n.name === name)) return ctx.fail('Error response from daemon: network with name ' + name + ' already exists', 1); const id = LA.hash.sha256(name).slice(0, 12); D.networks.push({ id, name, driver: 'bridge' }); ctx.outln(LA.hash.sha256(name)); return 0; }
                if (v === 'rm') { if (!D.networks.some((n) => n.name === name)) return ctx.fail('Error response from daemon: network ' + name + ' not found', 1); D.networks = D.networks.filter((n) => n.name !== name); ctx.outln(name); return 0; }
                if (v === 'inspect') { const n = D.networks.find((x) => x.name === name); if (!n) return ctx.fail('Error response from daemon: network ' + name + ' not found', 1); ctx.outln(JSON.stringify([{ Name: n.name, Id: n.id, Driver: n.driver, Scope: 'local' }], null, 4)); return 0; }
                return ctx.fail('Usage:  docker network COMMAND', 1);
            }
            case 'stats': {
                ctx.outln('CONTAINER ID   NAME              CPU %     MEM USAGE / LIMIT     MEM %     NET I/O          BLOCK I/O        PIDS');
                for (const c of D.containers.filter((x) => x.status === 'running')) ctx.outln(c.id.slice(0, 12) + '   ' + c.name.padEnd(17) + ' 0.0' + (c.num % 9) + '%     ' + (5 + c.num) + '.2MiB / 7.748GiB   0.0' + c.num + '%     1.2kB / 0B       0B / 4.1kB       ' + (1 + (c.num % 4)));
                return 0;
            }
            case 'system': {
                if (rest[0] === 'df') { ctx.outln('TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE\nImages          ' + D.images.length + '         ' + new Set(D.containers.map((c) => c.image)).size + '         ' + D.images.length * 120 + 'MB     0B (0%)\nContainers      ' + D.containers.length + '         ' + D.containers.filter((c) => c.status === 'running').length + '         0B        0B\nLocal Volumes   ' + D.volumes.length + '         0         0B        0B\nBuild Cache     0         0         0B        0B'); return 0; }
                if (rest[0] === 'prune') { const n = D.containers.filter((c) => c.status !== 'running').length; D.containers = D.containers.filter((c) => c.status === 'running'); ctx.outln('Deleted Containers: ' + n + '\n\nTotal reclaimed space: 0B'); return 0; }
                return ctx.fail('Usage:  docker system COMMAND', 1);
            }
            case 'cprune': { const n = D.containers.filter((c) => c.status !== 'running'); D.containers = D.containers.filter((c) => c.status === 'running'); ctx.outln('Deleted Containers:\n' + n.map((c) => c.id).join('\n') + '\n\nTotal reclaimed space: 0B'); return 0; }
            case 'iprune': ctx.outln('Total reclaimed space: 0B'); return 0;
            case 'login': ctx.outln('Authenticating with existing credentials...\nLogin Succeeded'); return 0;
            case 'compose': ctx.err('docker compose is not available in the sandbox; use docker run instead\n'); return 1;
        }
        ctx.err("docker: '" + sub + "' is not a docker command.\nSee 'docker --help'\n");
        return 1;
    });
    function containerExec(c, img, argv) {
        const repo = (img.repo || '').split(':')[0];
        const cmd = argv[0];
        const osName = repo === 'alpine' ? 'Alpine Linux v3.20' : repo === 'debian' ? 'Debian GNU/Linux 12 (bookworm)' : 'Ubuntu 24.04.1 LTS';
        const sub = argv.slice(1);
        if ((cmd === 'sh' || cmd === 'bash' || cmd === '/bin/sh' || cmd === '/bin/bash') && sub[0] === '-c') return containerExec(c, img, (sub[1] || '').split(/\s+/));
        switch (cmd) {
            case 'echo': return sub.join(' ').replace(/^["']|["']$/g, '') + '\n';
            case 'cat': if (sub[0] === '/etc/os-release') return 'PRETTY_NAME="' + osName + '"\nNAME="' + osName.split(' ')[0] + '"\nID=' + (repo === 'alpine' ? 'alpine' : repo === 'debian' ? 'debian' : 'ubuntu') + '\n'; return 'cat: ' + (sub[0] || '') + ': No such file or directory\n';
            case 'uname': return sub.includes('-a') ? 'Linux ' + c.id.slice(0, 12) + ' 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux\n' : 'Linux\n';
            case 'hostname': return c.id.slice(0, 12) + '\n';
            case 'whoami': return 'root\n';
            case 'pwd': return '/\n';
            case 'ls': return 'bin\nboot\ndev\netc\nhome\nlib\nmedia\nmnt\nopt\nproc\nroot\nrun\nsbin\nsrv\nsys\ntmp\nusr\nvar\n';
            case 'date': return U.defaultDate(new Date()) + '\n';
            case 'env': return 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nHOSTNAME=' + c.id.slice(0, 12) + '\n' + (c.env || []).map((e) => e + '\n').join('');
            case 'ps': return '    PID TTY          TIME CMD\n      1 ?        00:00:00 ' + c.cmd.split(' ')[0].split('/').pop() + '\n';
            case 'nginx': if (sub[0] === '-v') return 'nginx version: nginx/1.27.2\n'; return '';
            case 'python': case 'python3': if (sub[0] === '--version') return 'Python 3.12.7\n'; return '';
            case 'node': if (sub[0] === '--version' || sub[0] === '-v') return 'v20.18.0\n'; return '';
            case 'redis-cli': if (sub[0] === 'ping') return 'PONG\n'; return '';
            case 'sleep': case 'true': return '';
            default: return '';
        }
    }
})();
