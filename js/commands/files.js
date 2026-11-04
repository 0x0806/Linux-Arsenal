// Linux Arsenal - filesystem commands
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const U = LA.util;
    const { getopt, usageError, readInputs, splitLines, humanSize, lsDate, isoDate, columnize, parseMode, register } = U;
    const VFS = LA.VFS;
    const { globMatch } = LA.shellUtil;

    const R = (name, fn, meta) => register(name, fn, meta);

    // ---------- collation ----------
    function isCLocale(sh) {
        const l = sh.getVar('LC_ALL') || sh.getVar('LC_COLLATE') || sh.getVar('LANG') || '';
        return l === 'C' || l === 'POSIX' || l === 'C.UTF-8';
    }
    function collateKey(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }
    function makeCollator(sh) {
        if (isCLocale(sh)) return (a, b) => (a < b ? -1 : a > b ? 1 : 0);
        return (a, b) => {
            const ka = collateKey(a), kb = collateKey(b);
            if (ka !== kb) return ka < kb ? -1 : 1;
            const la = a.toLowerCase(), lb = b.toLowerCase();
            if (la !== lb) return la < lb ? -1 : 1;
            // lowercase before uppercase in en_US
            return a < b ? 1 : a > b ? -1 : 0;
        };
    }
    LA.makeCollator = makeCollator;

    // ---------- ls ----------
    const ARCHIVE_EXT = /\.(tar|tgz|gz|bz2|xz|zip|7z|rar|deb|rpm|jar|zst|lz|tbz2|txz)$/i;
    const IMAGE_EXT = /\.(jpg|jpeg|png|gif|bmp|svg|webp|ico|tiff|mp4|mkv|avi|mov|mp3|wav|flac|ogg)$/i;
    function colorName(name, node, fs) {
        const C = U.C;
        if (!node) return name;
        if (node.type === 'dir') {
            if ((node.mode & 0o1002) === 0o1002) return '\x1b[30;42m' + name + C.reset;
            if (node.mode & 0o002) return '\x1b[34;42m' + name + C.reset;
            return '\x1b[01;34m' + name + C.reset;
        }
        if (node.type === 'link') {
            let target = null;
            try { target = fs.get(VFS.normalize(node.target, '/')); } catch (e) { target = null; }
            return (node.broken ? '\x1b[40;31;01m' : '\x1b[01;36m') + name + C.reset;
        }
        if (node.type === 'dev') return '\x1b[40;33;01m' + name + C.reset;
        if (node.mode & 0o4000) return '\x1b[37;41m' + name + C.reset;
        if (node.mode & 0o111) return '\x1b[01;32m' + name + C.reset;
        if (ARCHIVE_EXT.test(name)) return '\x1b[01;31m' + name + C.reset;
        if (IMAGE_EXT.test(name)) return '\x1b[01;35m' + name + C.reset;
        return name;
    }
    function classify(node) {
        if (!node) return '';
        if (node.type === 'dir') return '/';
        if (node.type === 'link') return '@';
        if (node.mode & 0o111) return '*';
        return '';
    }

    R('ls', (ctx) => {
        const sh = ctx.sh, fs = ctx.fs;
        const { opts, operands, error } = getopt(ctx.args, {
            flags: 'aAlhRtSr1dFiCxnogsUX',
            long: { all: 'a', 'almost-all': 'A', 'human-readable': 'h', recursive: 'R', reverse: 'r', directory: 'd', classify: 'F', inode: 'i', color: 'color?', 'group-directories-first': 'gdf', size: 's', 'full-time': 'fulltime' }
        });
        if (error) return usageError(ctx, error);
        const colorOpt = opts.color === undefined ? 'auto' : opts.color === true ? 'always' : opts.color;
        const useColor = colorOpt === 'always' || colorOpt === 'yes' || ((colorOpt === 'auto' || colorOpt === 'tty') && ctx.tty);
        const long = opts.l || opts.n || opts.o || opts.g || opts.fulltime;
        const oneCol = opts['1'] || (!ctx.tty && !opts.C && !opts.x);
        const collate = makeCollator(sh);
        let status = 0;
        const files = [];
        const dirs = [];
        const targets = operands.length ? operands : ['.'];
        for (const t of targets) {
            const p = ctx.resolve(t);
            let node, lnode;
            try { lnode = fs.get(p, { follow: false }); node = fs.get(p); } catch (e) { ctx.err("ls: cannot access '" + t + "': " + e.message + '\n'); status = 2; continue; }
            if (!lnode) { ctx.err("ls: cannot access '" + t + "': No such file or directory\n"); status = 2; continue; }
            if (node && node.type === 'dir' && !opts.d && !(long && lnode.type === 'link' && !t.endsWith('/'))) dirs.push({ name: t, path: p, node });
            else files.push({ name: t, path: p, node: lnode });
        }
        const sortEntries = (entries) => {
            entries.sort((a, b) => collate(a.name, b.name));
            if (opts.t) entries.sort((a, b) => (b.node.mtime - a.node.mtime));
            if (opts.S) entries.sort((a, b) => (fs.size(b.node) - fs.size(a.node)));
            if (opts.X) entries.sort((a, b) => collate(ext(a.name), ext(b.name)));
            if (opts.U) { /* unsorted: keep insertion */ }
            if (opts.gdf) entries.sort((a, b) => (b.node.type === 'dir') - (a.node.type === 'dir'));
            if (opts.r) entries.reverse();
            return entries;
        };
        const ext = (n) => { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1) : ''; };
        const ownBlocks = (n) => (n.type === 'dir' ? 4 : n.type === 'file' ? Math.ceil(fs.size(n) / 4096) * 4 : 0);
        const fmtName = (e) => {
            let s = useColor ? colorName(e.name, e.node, fs) : e.name;
            if (opts.F) s += classify(e.node);
            return s;
        };
        const render = (entries, showTotal) => {
            if (!entries.length) { if (long && showTotal) ctx.outln('total 0'); return; }
            if (long) {
                const rows = entries.map((e) => {
                    const n = e.node;
                    const size = fs.size(n);
                    let nlink = 1;
                    if (n.type === 'dir') nlink = 2 + Object.values(n.children).filter((c) => c.type === 'dir').length;
                    const uid = opts.n ? String(sh.system.uidOf ? sh.system.uidOf(n.owner) : 0) : n.owner;
                    const gid = opts.n ? String(sh.system.gidOf ? sh.system.gidOf(n.group) : 0) : n.group;
                    let name = fmtName(e);
                    if (n.type === 'link') name += ' -> ' + n.target;
                    return {
                        ino: String(n.ino), blocks: String(ownBlocks(n)),
                        mode: VFS.modeString(n), nlink: String(nlink), owner: uid, group: gid,
                        size: opts.h ? humanSize(size) : String(size),
                        date: opts.fulltime ? isoDate(n.mtime) + '.000000000 +0000' : lsDate(n.mtime), name
                    };
                });
                const w = (k) => Math.max(...rows.map((r) => r[k].length));
                const W = { ino: w('ino'), blocks: w('blocks'), nlink: w('nlink'), owner: w('owner'), group: w('group'), size: w('size') };
                if (showTotal) {
                    const total = entries.reduce((a, e) => a + ownBlocks(e.node), 0);
                    ctx.outln('total ' + (opts.h ? humanSize(total * 1024) : total));
                }
                for (const r of rows) {
                    let line = '';
                    if (opts.i) line += r.ino.padStart(W.ino) + ' ';
                    if (opts.s) line += r.blocks.padStart(W.blocks) + ' ';
                    line += r.mode + ' ' + r.nlink.padStart(W.nlink) + ' ';
                    if (!opts.g) line += r.owner.padEnd(W.owner) + ' ';
                    if (!opts.o) line += r.group.padEnd(W.group) + ' ';
                    line += r.size.padStart(W.size) + ' ' + r.date + ' ' + r.name;
                    ctx.outln(line);
                }
                return;
            }
            const names = entries.map((e) => (opts.i ? String(e.node.ino) + ' ' : '') + (opts.s ? String(ownBlocks(e.node)) + ' ' : '') + fmtName(e));
            if (oneCol) ctx.out(names.join('\n') + '\n');
            else ctx.out(columnize(names, sh.columns));
        };
        sortEntries(files);
        render(files, false);
        const listDir = (d, header) => {
            let names;
            try { names = fs.list(d.path); }
            catch (e) { ctx.err("ls: cannot open directory '" + d.name + "': " + e.message + '\n'); status = 2; return; }
            if (header) ctx.outln(d.name + ':');
            let entries = names.filter((nm) => opts.a || opts.A || !nm.startsWith('.')).map((nm) => ({ name: nm, path: d.path === '/' ? '/' + nm : d.path + '/' + nm, node: d.node.children[nm] }));
            sortEntries(entries);
            if (opts.a && !opts.A) {
                const parent = fs.get(VFS.dirname(d.path)) || d.node;
                const dots = [{ name: '.', path: d.path, node: d.node }, { name: '..', path: VFS.dirname(d.path), node: parent }];
                entries = opts.r ? entries.concat(dots.reverse()) : dots.concat(entries);
            }
            render(entries, true);
            if (opts.R) {
                for (const e of entries) {
                    if (e.name === '.' || e.name === '..') continue;
                    if (e.node.type === 'dir') {
                        ctx.outln('');
                        const nm = d.name === '.' && !operands.length ? './' + e.name : (d.name.endsWith('/') ? d.name + e.name : d.name + '/' + e.name);
                        listDir({ name: nm, path: e.path, node: e.node }, true);
                    }
                }
            }
        };
        sortEntries(dirs);
        dirs.forEach((d, idx) => {
            if (idx > 0 || files.length) ctx.outln('');
            listDir(d, opts.R || dirs.length + files.length > 1);
        });
        return status;
    });
    LA.commands.dir = { fn: (ctx) => LA.commands.ls.fn(Object.assign(ctx, { tty: false })) };
    LA.commands.ll = { fn: (ctx) => { ctx.args = ['-alF'].concat(ctx.args); return LA.commands.ls.fn(ctx); }, hidden: true };

    // ---------- cat / tac ----------
    R('cat', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'nbsETAvetu', long: { number: 'n', 'number-nonblank': 'b', 'squeeze-blank': 's', 'show-ends': 'E', 'show-tabs': 'T', 'show-all': 'A' } });
        if (error) return usageError(ctx, error);
        const inputs = readInputs(ctx, operands);
        let n = 0;
        let prevBlank = false;
        for (const inp of inputs) {
            let text = inp.content;
            if (!opts.n && !opts.b && !opts.s && !opts.E && !opts.T && !opts.A && !opts.e && !opts.t && !opts.v) { ctx.out(text); continue; }
            const lines = text.split('\n');
            const endsNl = text.endsWith('\n');
            if (endsNl) lines.pop();
            let out = '';
            lines.forEach((line, idx) => {
                const blank = line === '';
                if (opts.s && blank && prevBlank) return;
                prevBlank = blank;
                if (opts.T || opts.A || opts.t) line = line.replace(/\t/g, '^I');
                if (opts.A || opts.v || opts.e || opts.t) line = line.replace(/[\x00-\x08\x0b-\x1f]/g, (c) => '^' + String.fromCharCode(c.charCodeAt(0) + 64));
                if (opts.E || opts.A || opts.e) line += '$';
                if (opts.b) { if (!blank) line = String(++n).padStart(6) + '\t' + line; }
                else if (opts.n) line = String(++n).padStart(6) + '\t' + line;
                out += line + (idx < lines.length - 1 || endsNl ? '\n' : '');
            });
            ctx.out(out);
        }
        return inputs.failed ? 1 : 0;
    });

    R('tac', (ctx) => {
        const inputs = readInputs(ctx, ctx.args.filter((a) => !a.startsWith('-') || a === '-'));
        for (const inp of inputs) {
            const lines = splitLines(inp.content);
            if (lines.length) ctx.out(lines.reverse().join('\n') + '\n');
        }
        return inputs.failed ? 1 : 0;
    });

    // ---------- touch / mkdir / rmdir ----------
    R('touch', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'acmh', args: 'dtr', long: { 'no-create': 'c', date: 'd=', reference: 'r=' } });
        if (error) return usageError(ctx, error);
        if (!operands.length) return usageError(ctx, 'missing file operand');
        let time = Date.now();
        if (opts.d) {
            const t = parseDateString(opts.d);
            if (t === null) return ctx.fail("invalid date format '" + opts.d + "'");
            time = t;
        }
        if (opts.t) {
            const m = /^(?:(\d\d)?(\d\d))?(\d\d)(\d\d)(\d\d)(\d\d)(?:\.(\d\d))?$/.exec(opts.t);
            if (!m) return ctx.fail("invalid date format '" + opts.t + "'");
            const year = m[2] ? parseInt((m[1] || '20') + m[2], 10) : new Date().getFullYear();
            time = new Date(year, parseInt(m[3], 10) - 1, parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10), parseInt(m[7] || '0', 10)).getTime();
        }
        if (opts.r) {
            const ref = ctx.fs.get(ctx.resolve(opts.r));
            if (!ref) return ctx.fail("failed to get attributes of '" + opts.r + "': No such file or directory");
            time = ref.mtime;
        }
        let status = 0;
        for (const f of operands) {
            const p = ctx.resolve(f);
            try {
                const node = ctx.fs.get(p);
                if (node) {
                    if (!ctx.fs.can(node, 'w') && node.owner !== ctx.sh.user && ctx.sh.user !== 'root') throw new LA.FsError('EACCES');
                    node.mtime = time;
                } else if (!opts.c) {
                    const n = ctx.fs.writeFile(p, '');
                    n.mtime = time;
                }
            } catch (e) {
                if (!e.code) throw e;
                ctx.err("touch: cannot touch '" + f + "': " + e.message + '\n');
                status = 1;
            }
        }
        return status;
    });

    function parseDateString(s) {
        s = s.trim();
        const now = new Date();
        let m;
        if (s === 'now') return now.getTime();
        if (s === 'yesterday') return now.getTime() - 86400000;
        if (s === 'tomorrow') return now.getTime() + 86400000;
        if ((m = /^(\d+|-\d+|\+\d+)\s*(second|minute|hour|day|week|month|year)s?(\s+ago)?$/.exec(s))) {
            const mult = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }[m[2]];
            let k = parseInt(m[1], 10);
            if (m[3]) k = -k;
            return now.getTime() + k * mult;
        }
        if ((m = /^(\d+)\s*(day|week|hour|minute)s?\s+ago$/.exec(s))) return now.getTime() - parseInt(m[1], 10) * ({ day: 864e5, week: 6048e5, hour: 36e5, minute: 6e4 }[m[2]]);
        if ((m = /^@(\d+)$/.exec(s))) return parseInt(m[1], 10) * 1000;
        if ((m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?$/.exec(s))) {
            return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
        }
        const t = Date.parse(s);
        return isNaN(t) ? null : t;
    }
    LA.parseDateString = parseDateString;

    R('mkdir', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'pv', args: 'm', long: { parents: 'p', verbose: 'v', mode: 'm=' } });
        if (error) return usageError(ctx, error);
        if (!operands.length) return usageError(ctx, 'missing operand');
        let status = 0;
        const mode = opts.m ? parseMode(opts.m, 0o755, true) : undefined;
        for (const d of operands) {
            const p = ctx.resolve(d);
            try {
                if (opts.p) {
                    const parts = p.split('/').filter(Boolean);
                    let cur = '';
                    for (const part of parts) {
                        cur += '/' + part;
                        const n = ctx.fs.get(cur);
                        if (n) { if (n.type !== 'dir') throw new LA.FsError('EEXIST'); continue; }
                        ctx.fs.mkdir(cur, { mode: cur === p ? mode : undefined });
                        if (opts.v) ctx.outln("mkdir: created directory '" + (d.startsWith('/') ? cur : relFrom(ctx.sh.cwd, cur, d)) + "'");
                    }
                } else {
                    ctx.fs.mkdir(p, { mode });
                    if (opts.v) ctx.outln("mkdir: created directory '" + d + "'");
                }
            } catch (e) {
                if (!e.code) throw e;
                ctx.err("mkdir: cannot create directory '" + d + "': " + e.message + '\n');
                status = 1;
            }
        }
        return status;
    });
    function relFrom(cwd, abs, orig) {
        if (abs.startsWith(cwd + '/')) return abs.slice(cwd.length + 1);
        return orig;
    }

    R('rmdir', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'pv', long: { parents: 'p', verbose: 'v', 'ignore-fail-on-non-empty': 'ign' } });
        if (error) return usageError(ctx, error);
        if (!operands.length) return usageError(ctx, 'missing operand');
        let status = 0;
        for (const d of operands) {
            let p = ctx.resolve(d);
            let disp = d;
            for (;;) {
                try {
                    ctx.fs.rmdir(p);
                    if (opts.v) ctx.outln("rmdir: removing directory, '" + disp + "'");
                } catch (e) {
                    if (!e.code) throw e;
                    if (!(opts.ign && e.code === 'ENOTEMPTY')) { ctx.err("rmdir: failed to remove '" + disp + "': " + e.message + '\n'); status = 1; }
                    break;
                }
                if (!opts.p || !disp.includes('/')) break;
                disp = disp.slice(0, disp.lastIndexOf('/'));
                if (!disp) break;
                p = VFS.dirname(p);
            }
        }
        return status;
    });

    // ---------- rm ----------
    R('rm', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'rRfivdI', long: { recursive: 'r', force: 'f', verbose: 'v', dir: 'd', interactive: 'i', 'no-preserve-root': 'npr', 'preserve-root': 'pr' } });
        if (error) return usageError(ctx, error);
        if (!operands.length) { if (opts.f) return 0; return usageError(ctx, 'missing operand'); }
        const recursive = opts.r || opts.R;
        let status = 0;
        for (const f of operands) {
            const p = ctx.resolve(f);
            if (p === '/' && recursive && !opts.npr) {
                ctx.err("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n");
                status = 1; continue;
            }
            if (/(^|\/)\.\.?$/.test(f)) { ctx.err("rm: refusing to remove '.' or '..' directory: skipping '" + f + "'\n"); status = 1; continue; }
            let node;
            try { node = ctx.fs.get(p, { follow: false }); } catch (e) { node = null; }
            if (!node) { if (!opts.f) { ctx.err("rm: cannot remove '" + f + "': No such file or directory\n"); status = 1; } continue; }
            try {
                if (node.type === 'dir') {
                    if (!recursive) {
                        if (opts.d) { ctx.fs.rmdir(p); if (opts.v) ctx.outln("removed directory '" + f + "'"); continue; }
                        ctx.err("rm: cannot remove '" + f + "': Is a directory\n"); status = 1; continue;
                    }
                    if (opts.v) {
                        const removed = [];
                        ctx.fs.walk(p, (n, path) => removed.push({ n, path }));
                        removed.reverse();
                        ctx.fs.rmrf(p);
                        for (const r of removed) {
                            const disp = f.replace(/\/$/, '') + r.path.slice(p.length);
                            ctx.outln(r.n.type === 'dir' ? "removed directory '" + disp + "'" : "removed '" + disp + "'");
                        }
                    } else ctx.fs.rmrf(p);
                } else {
                    const { dir } = ctx.fs.parent(p);
                    if (!ctx.fs.can(dir, 'w')) throw new LA.FsError('EACCES');
                    // sticky directories (/tmp): only owner may delete
                    if ((dir.mode & 0o1000) && ctx.sh.user !== 'root' && node.owner !== ctx.sh.user && dir.owner !== ctx.sh.user) throw new LA.FsError('EPERM');
                    ctx.fs.unlink(p);
                    if (opts.v) ctx.outln("removed '" + f + "'");
                }
            } catch (e) {
                if (!e.code) throw e;
                ctx.err("rm: cannot remove '" + f + "': " + e.message + '\n');
                status = 1;
            }
        }
        return status;
    });

    // ---------- cp / mv / ln ----------
    R('cp', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'rRaipvnfuTl', args: 't', long: { recursive: 'r', archive: 'a', interactive: 'i', verbose: 'v', 'no-clobber': 'n', force: 'f', update: 'u', preserve: 'p', 'target-directory': 't=' } });
        if (error) return usageError(ctx, error);
        let srcs = operands.slice();
        let dest;
        if (opts.t) dest = opts.t;
        else {
            if (srcs.length < 2) return usageError(ctx, srcs.length ? "missing destination file operand after '" + srcs[0] + "'" : 'missing file operand');
            dest = srcs.pop();
        }
        const recursive = opts.r || opts.R || opts.a;
        const fs = ctx.fs;
        const dp = ctx.resolve(dest);
        const destIsDir = fs.isDir(dp);
        if (srcs.length > 1 && !destIsDir) return ctx.fail("target '" + dest + "' is not a directory");
        let status = 0;
        for (const s of srcs) {
            const sp = ctx.resolve(s);
            let node;
            try { node = fs.get(sp); } catch (e) { node = null; }
            if (!node) { ctx.err("cp: cannot stat '" + s + "': No such file or directory\n"); status = 1; continue; }
            if (node.type === 'dir' && !recursive) { ctx.err("cp: -r not specified; omitting directory '" + s + "'\n"); status = 1; continue; }
            let target = destIsDir && !opts.T ? (dp === '/' ? '' : dp) + '/' + VFS.basename(sp) : dp;
            if (target === sp) { ctx.err("cp: '" + s + "' and '" + dest + "' are the same file\n"); status = 1; continue; }
            if (node.type === 'dir' && (target + '/').startsWith(sp + '/')) { ctx.err("cp: cannot copy a directory, '" + s + "', into itself, '" + dest + "'\n"); status = 1; continue; }
            const existing = fs.get(target);
            if (existing && opts.n) continue;
            if (existing && opts.u && existing.mtime >= node.mtime) continue;
            if (existing && existing.type === 'dir' && node.type !== 'dir') { ctx.err("cp: cannot overwrite directory '" + target + "' with non-directory\n"); status = 1; continue; }
            try {
                if (node.type === 'dir' && existing && existing.type === 'dir') {
                    // merge copy into existing dir
                    for (const k of Object.keys(node.children)) {
                        const sub = getopt([], {});
                        void sub;
                        copyInto(fs, sp + '/' + k, target + '/' + k, opts.a || opts.p);
                    }
                } else if (node.type === 'file' && existing && existing.type === 'file') {
                    fs.writeFile(target, node.content);
                    if (opts.a || opts.p) { existing.mode = node.mode; existing.mtime = node.mtime; }
                } else {
                    fs.copy(sp, target, { preserve: opts.a || opts.p });
                }
                if (opts.v) ctx.outln("'" + s + "' -> '" + (destIsDir ? (dest.replace(/\/$/, '') + '/' + VFS.basename(sp)) : dest) + "'");
            } catch (e) {
                if (!e.code) throw e;
                ctx.err("cp: cannot create " + (node.type === 'dir' ? 'directory' : 'regular file') + " '" + (destIsDir ? dest.replace(/\/$/, '') + '/' + VFS.basename(sp) : dest) + "': " + e.message + '\n');
                status = 1;
            }
        }
        return status;
    });
    function copyInto(fs, src, dst, preserve) {
        const node = fs.get(src);
        const ex = fs.get(dst);
        if (node.type === 'dir' && ex && ex.type === 'dir') {
            for (const k of Object.keys(node.children)) copyInto(fs, src + '/' + k, dst + '/' + k, preserve);
            return;
        }
        if (ex && node.type === 'file' && ex.type === 'file') { fs.writeFile(dst, node.content); return; }
        if (ex) fs.rmrf(dst);
        fs.copy(src, dst, { preserve });
    }

    R('mv', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'ivnfuT', args: 't', long: { interactive: 'i', verbose: 'v', 'no-clobber': 'n', force: 'f', update: 'u', 'target-directory': 't=' } });
        if (error) return usageError(ctx, error);
        let srcs = operands.slice();
        let dest;
        if (opts.t) dest = opts.t;
        else {
            if (srcs.length < 2) return usageError(ctx, srcs.length ? "missing destination file operand after '" + srcs[0] + "'" : 'missing file operand');
            dest = srcs.pop();
        }
        const fs = ctx.fs;
        const dp = ctx.resolve(dest);
        const destIsDir = fs.isDir(dp);
        if (srcs.length > 1 && !destIsDir) return ctx.fail("target '" + dest + "' is not a directory");
        let status = 0;
        for (const s of srcs) {
            const sp = ctx.resolve(s);
            let node;
            try { node = fs.get(sp, { follow: false }); } catch (e) { node = null; }
            if (!node) { ctx.err("mv: cannot stat '" + s + "': No such file or directory\n"); status = 1; continue; }
            const target = destIsDir && !opts.T ? (dp === '/' ? '' : dp) + '/' + VFS.basename(sp) : dp;
            if (target === sp) { ctx.err("mv: '" + s + "' and '" + dest + "' are the same file\n"); status = 1; continue; }
            if (node.type === 'dir' && (target + '/').startsWith(sp + '/')) { ctx.err("mv: cannot move '" + s + "' to a subdirectory of itself, '" + dest + "'\n"); status = 1; continue; }
            const ex = fs.get(target, { follow: false });
            if (ex && opts.n) continue;
            if (ex && opts.u && ex.mtime >= node.mtime) continue;
            try {
                if (ex && ex.type !== 'dir') fs.unlink(target);
                fs.rename(sp, target);
                if (opts.v) ctx.outln("renamed '" + s + "' -> '" + (destIsDir ? dest.replace(/\/$/, '') + '/' + VFS.basename(sp) : dest) + "'");
            } catch (e) {
                if (!e.code) throw e;
                ctx.err("mv: cannot move '" + s + "' to '" + dest + "': " + e.message + '\n');
                status = 1;
            }
        }
        return status;
    });

    R('ln', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'sfvnrT', long: { symbolic: 's', force: 'f', verbose: 'v', relative: 'r' } });
        if (error) return usageError(ctx, error);
        if (!operands.length) return usageError(ctx, 'missing file operand');
        const fs = ctx.fs;
        let targets = operands.slice();
        let linkName;
        if (targets.length === 1) linkName = VFS.basename(targets[0]);
        else linkName = targets.pop();
        let lp = ctx.resolve(linkName);
        const isDir = fs.isDir(lp) && !opts.n;
        let status = 0;
        for (const t of targets) {
            const finalPath = isDir && targets.length >= 1 && (operands.length > 1 && fs.isDir(lp)) ? lp + '/' + VFS.basename(t) : lp;
            try {
                const ex = fs.get(finalPath, { follow: false });
                if (ex) {
                    if (!opts.f) throw new LA.FsError('EEXIST');
                    if (ex.type === 'dir') throw new LA.FsError('EISDIR');
                    fs.unlink(finalPath);
                }
                if (opts.s) {
                    fs.symlink(t, finalPath);
                } else {
                    const src = fs.get(ctx.resolve(t));
                    if (!src) { ctx.err("ln: failed to access '" + t + "': No such file or directory\n"); status = 1; continue; }
                    if (src.type === 'dir') { ctx.err("ln: " + t + ": hard link not allowed for directory\n"); status = 1; continue; }
                    const { dir, name } = fs.parent(finalPath, { write: true });
                    dir.children[name] = src; // hard link shares the inode
                    src.nlink = (src.nlink || 1) + 1;
                }
                if (opts.v) ctx.outln("'" + (finalPath === lp ? linkName : linkName + '/' + VFS.basename(t)) + "' -> '" + t + "'");
            } catch (e) {
                if (!e.code) throw e;
                ctx.err("ln: failed to create " + (opts.s ? 'symbolic ' : 'hard ') + "link '" + linkName + "': " + e.message + '\n');
                status = 1;
            }
        }
        return status;
    });

    // ---------- stat / file ----------
    function fileTypeName(node) {
        if (node.type === 'dir') return 'directory';
        if (node.type === 'link') return 'symbolic link';
        if (node.type === 'dev') return 'character special file';
        return node.content === '' ? 'regular empty file' : 'regular file';
    }
    R('stat', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'LtfF', args: 'c', long: { format: 'c=', dereference: 'L', printf: 'c=' } });
        if (error) return usageError(ctx, error);
        if (!operands.length) return usageError(ctx, 'missing operand');
        const sh = ctx.sh, fs = ctx.fs;
        let status = 0;
        for (const f of operands) {
            const p = ctx.resolve(f);
            let node;
            try { node = fs.get(p, { follow: !!opts.L }); } catch (e) { node = null; }
            if (!node) { ctx.err("stat: cannot statx '" + f + "': No such file or directory\n"); status = 1; continue; }
            const size = fs.size(node);
            const uid = sh.system.uidOf ? sh.system.uidOf(node.owner) : 0;
            const gid = sh.system.gidOf ? sh.system.gidOf(node.group) : 0;
            const octal = (node.mode & 0o7777).toString(8);
            const t = isoDate(node.mtime) + '.000000000 +0000';
            if (opts.c) {
                const s = opts.c.replace(/%(.)/g, (m, c) => {
                    switch (c) {
                        case 'n': return f;
                        case 'N': return "'" + f + "'" + (node.type === 'link' ? " -> '" + node.target + "'" : '');
                        case 's': return String(size);
                        case 'a': return octal;
                        case 'A': return VFS.modeString(node);
                        case 'U': return node.owner;
                        case 'G': return node.group;
                        case 'u': return String(uid);
                        case 'g': return String(gid);
                        case 'F': return fileTypeName(node);
                        case 'i': return String(node.ino);
                        case 'h': return '1';
                        case 'b': return String(Math.ceil(fs.diskUsage(node) / 512));
                        case 'y': case 'z': case 'x': return t;
                        case 'Y': case 'Z': case 'X': return String(Math.floor(node.mtime / 1000));
                        case '%': return '%';
                        default: return m;
                    }
                });
                ctx.outln(s.replace(/\\n/g, '\n').replace(/\\t/g, '\t'));
                continue;
            }
            const nameLine = node.type === 'link' ? f + ' -> ' + node.target : f;
            ctx.outln('  File: ' + nameLine);
            ctx.outln('  Size: ' + String(size).padEnd(10) + '\tBlocks: ' + String(Math.ceil(fs.diskUsage(node) / 512)).padEnd(10) + ' IO Block: 4096   ' + fileTypeName(node));
            ctx.outln('Device: 8,1\tInode: ' + String(node.ino).padEnd(11) + ' Links: ' + (node.type === 'dir' ? 2 : node.nlink || 1));
            ctx.outln('Access: (' + octal.padStart(4, '0') + '/' + VFS.modeString(node) + ')  Uid: (' + String(uid).padStart(5) + '/' + node.owner.padStart(8) + ')   Gid: (' + String(gid).padStart(5) + '/' + node.group.padStart(8) + ')');
            ctx.outln('Access: ' + t);
            ctx.outln('Modify: ' + t);
            ctx.outln('Change: ' + t);
            ctx.outln(' Birth: ' + t);
        }
        return status;
    });

    function describeFile(node, name, fs) {
        if (node.type === 'dir') return (node.mode & 0o1000) ? 'sticky, directory' : 'directory';
        if (node.type === 'link') return 'symbolic link to ' + node.target;
        if (node.type === 'dev') return 'character special (1/3)';
        const c = node.content;
        if (c === '') return 'empty';
        if (c.startsWith('#!LA-BUILTIN')) return 'ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, stripped';
        if (c.startsWith('\x1f\x8b')) return 'gzip compressed data, was "' + name.replace(/\.gz$/, '') + '", from Unix';
        if (c.startsWith('\x00LATAR')) return 'POSIX tar archive (GNU)';
        if (c.startsWith('PK\x03\x04')) return 'Zip archive data, at least v2.0 to extract, compression method=deflate';
        if (c.startsWith('\x89PNG')) return 'PNG image data, 800 x 600, 8-bit/color RGBA, non-interlaced';
        if (c.startsWith('\xff\xd8\xff')) return 'JPEG image data, JFIF standard 1.01';
        if (c.startsWith('%PDF')) return 'PDF document, version 1.7';
        if (c.startsWith('\x7fELF')) return 'ELF 64-bit LSB executable, x86-64';
        const exec = node.mode & 0o111 ? ' executable' : '';
        const first = c.split('\n')[0];
        const enc = /[^\x00-\x7f]/.test(c) ? 'Unicode text, UTF-8 text' : 'ASCII text';
        if (/^#!.*\b(bash|sh)\b/.test(first)) return (first.includes('bash') ? 'Bourne-Again shell script' : 'POSIX shell script') + ', ' + enc + exec;
        if (/^#!.*python/.test(first)) return 'Python script, ' + enc + exec;
        if (/^#!.*perl/.test(first)) return 'Perl script text executable';
        if (/^#!.*node/.test(first)) return 'Node.js script, ' + enc + exec;
        if (/^\s*<!DOCTYPE html|^\s*<html/i.test(c)) return 'HTML document, ' + enc;
        if (/^\s*[\[{]/.test(c)) { try { JSON.parse(c); return 'JSON text data'; } catch (e) { /* not json */ } }
        if (/^\s*<\?xml/.test(c)) return 'XML 1.0 document, ' + enc;
        if (/\.py$/.test(name)) return 'Python script, ' + enc + exec;
        if (/\.c$/.test(name)) return 'C source, ' + enc;
        if (/\.csv$/.test(name)) return 'CSV text';
        if (/[^\x09\x0a\x0d\x20-\x7e -￿]/.test(c)) return 'data';
        return enc + (exec ? exec : '') + (c.length > 0 && !c.includes('\n') ? ', with no line terminators' : '');
    }
    R('file', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'bLiz', long: { brief: 'b', 'mime-type': 'mime' } });
        if (!operands.length) return usageError(ctx, 'Usage: file [-bchikLlNnprsSvzZ0] [--apple] [--extension] [--mime-encoding] [--mime-type] [-e <testname>] [-F <separator>]  [-f <namefile>] [-m <magicfiles>] [-P <parameter=value>] [--exclude-quiet] <file> ...');
        for (const f of operands) {
            let node;
            try { node = ctx.fs.get(ctx.resolve(f), { follow: !!opts.L }); } catch (e) { node = null; }
            const desc = node ? describeFile(node, f, ctx.fs) : "cannot open `" + f + "' (No such file or directory)";
            if (opts.i || opts.mime) {
                const mime = !node ? 'cannot open' : node.type === 'dir' ? 'inode/directory' : /script/.test(desc) ? 'text/x-shellscript' : /gzip/.test(desc) ? 'application/gzip' : /HTML/.test(desc) ? 'text/html' : /JSON/.test(desc) ? 'application/json' : /text/.test(desc) ? 'text/plain' : /empty/.test(desc) ? 'inode/x-empty' : 'application/octet-stream';
                ctx.outln((opts.b ? '' : f + ': ') + mime + (opts.i && /text/.test(mime) ? '; charset=us-ascii' : ''));
            } else ctx.outln((opts.b ? '' : f + ': ') + desc);
        }
        return 0;
    });

    // ---------- tree ----------
    R('tree', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'adfFpshCnJ', args: 'LIP', long: { dirsfirst: 'dirsfirst', noreport: 'noreport' } });
        if (error) return usageError(ctx, error);
        const fs = ctx.fs;
        const roots = operands.length ? operands : ['.'];
        const maxDepth = opts.L ? parseInt(opts.L, 10) : Infinity;
        const collate = makeCollator(ctx.sh);
        let dirs = 0, files = 0;
        const color = ctx.tty && !opts.n;
        for (const r of roots) {
            const p = ctx.resolve(r);
            const node = fs.get(p);
            if (!node) { ctx.outln(r + '  [error opening dir]'); continue; }
            ctx.outln(color ? colorName(r, node, fs) : r);
            const walk = (n, path, prefix, depth) => {
                if (depth >= maxDepth) return;
                let names;
                try { names = fs.list(path); } catch (e) { return; }
                names = names.filter((nm) => opts.a || !nm.startsWith('.'));
                if (opts.I) names = names.filter((nm) => !globMatch(opts.I, nm));
                if (opts.d) names = names.filter((nm) => n.children[nm].type === 'dir');
                names.sort(collate);
                if (opts.dirsfirst) names.sort((a, b) => (n.children[b].type === 'dir') - (n.children[a].type === 'dir'));
                if (opts.P) names = names.filter((nm) => n.children[nm].type === 'dir' || globMatch(opts.P, nm));
                names.forEach((nm, idx) => {
                    const child = n.children[nm];
                    const last = idx === names.length - 1;
                    const childPath = (path === '/' ? '' : path) + '/' + nm;
                    let label = opts.f ? (r.replace(/\/$/, '') + childPath.slice(p.length)) : nm;
                    if (color) label = colorName(label, child, fs);
                    if (opts.F) label += classify(child);
                    if (opts.p) label = '[' + VFS.modeString(child) + ']  ' + label;
                    if (opts.s || opts.h) label = '[' + (opts.h ? humanSize(fs.size(child)) : String(fs.size(child))).padStart(opts.h ? 4 : 11) + ']  ' + label;
                    if (child.type === 'link') label += ' -> ' + child.target;
                    ctx.outln(prefix + (last ? '└── ' : '├── ') + label);
                    if (child.type === 'dir') { dirs++; walk(child, childPath, prefix + (last ? '    ' : '│   '), depth + 1); }
                    else files++;
                });
            };
            if (node.type === 'dir') walk(node, p, '', 0);
        }
        if (!opts.noreport) {
            ctx.outln('');
            ctx.outln(dirs + (dirs === 1 ? ' directory' : ' directories') + (opts.d ? '' : ', ' + files + (files === 1 ? ' file' : ' files')));
        }
        return 0;
    });

    // ---------- find ----------
    R('find', (ctx) => {
        const fs = ctx.fs;
        const args = ctx.args.slice();
        const paths = [];
        let k = 0;
        while (k < args.length && !args[k].startsWith('-') && args[k] !== '!' && args[k] !== '(') paths.push(args[k++]);
        if (!paths.length) paths.push('.');
        const exprArgs = args.slice(k);
        let maxDepth = Infinity, minDepth = 0;
        // pull out global options
        const filtered = [];
        for (let i = 0; i < exprArgs.length; i++) {
            if (exprArgs[i] === '-maxdepth') { maxDepth = parseInt(exprArgs[++i], 10); continue; }
            if (exprArgs[i] === '-mindepth') { minDepth = parseInt(exprArgs[++i], 10); continue; }
            filtered.push(exprArgs[i]);
        }
        let pos = 0;
        let hasAction = false;
        const execBatches = [];
        let status = 0;
        const now = Date.now();
        function parseOr() {
            let left = parseAnd();
            while (filtered[pos] === '-o' || filtered[pos] === '-or') { pos++; const right = parseAnd(); const l = left; left = (e) => l(e) || right(e); }
            return left;
        }
        function parseAnd() {
            let left = parseNot();
            while (pos < filtered.length && filtered[pos] !== '-o' && filtered[pos] !== '-or' && filtered[pos] !== ')') {
                if (filtered[pos] === '-a' || filtered[pos] === '-and') pos++;
                const right = parseNot();
                const l = left;
                left = (e) => l(e) && right(e);
            }
            return left;
        }
        function parseNot() {
            if (filtered[pos] === '!' || filtered[pos] === '-not') { pos++; const inner = parseNot(); return (e) => !inner(e); }
            return parsePrimary();
        }
        function need() { if (pos >= filtered.length) throw new Error("missing argument to `" + filtered[pos - 1] + "'"); return filtered[pos++]; }
        function cmpNum(spec, value) {
            const m = /^([+-]?)(\d+)$/.exec(spec);
            if (!m) throw new Error("invalid argument `" + spec + "'");
            const n = parseInt(m[2], 10);
            if (m[1] === '+') return value > n;
            if (m[1] === '-') return value < n;
            return value === n;
        }
        function parsePrimary() {
            const tok = filtered[pos++];
            switch (tok) {
                case '(': { const e = parseOr(); if (filtered[pos] !== ')') throw new Error("invalid expression; I was expecting to find a ')' somewhere but did not see one."); pos++; return e; }
                case '-name': { const p = need(); return (e) => globMatch(p, e.name); }
                case '-iname': { const p = need(); return (e) => globMatch(p, e.name, { nocase: true }); }
                case '-path': case '-wholename': { const p = need(); return (e) => globMatch(p, e.disp); }
                case '-ipath': { const p = need(); return (e) => globMatch(p, e.disp, { nocase: true }); }
                case '-regex': { const p = need(); const re = new RegExp('^' + p + '$'); return (e) => re.test(e.disp); }
                case '-iregex': { const p = need(); const re = new RegExp('^' + p + '$', 'i'); return (e) => re.test(e.disp); }
                case '-type': {
                    const t = need();
                    const types = t.split(',');
                    return (e) => types.some((x) => (x === 'f' && e.node.type === 'file') || (x === 'd' && e.node.type === 'dir') || (x === 'l' && e.node.type === 'link') || (x === 'c' && e.node.type === 'dev'));
                }
                case '-empty': return (e) => (e.node.type === 'dir' ? Object.keys(e.node.children).length === 0 : e.node.type === 'file' && e.node.content === '');
                case '-size': {
                    const s = need();
                    const m = /^([+-]?)(\d+)([bckwMG]?)$/.exec(s);
                    if (!m) throw new Error("invalid -size type `" + s + "'");
                    const unit = { b: 512, c: 1, k: 1024, w: 2, M: 1048576, G: 1073741824, '': 512 }[m[3]];
                    const n = parseInt(m[2], 10);
                    return (e) => {
                        if (e.node.type === 'dir') return cmpNum(m[1] + n, Math.ceil(4096 / unit));
                        const size = fs.size(e.node);
                        const units = Math.ceil(size / unit);
                        if (m[1] === '+') return units > n;
                        if (m[1] === '-') return units < n;
                        return units === n;
                    };
                }
                case '-mtime': case '-atime': case '-ctime': { const s = need(); return (e) => cmpNum(s, Math.floor((now - e.node.mtime) / 86400000)); }
                case '-mmin': case '-amin': case '-cmin': { const s = need(); return (e) => cmpNum(s, Math.ceil((now - e.node.mtime) / 60000)); }
                case '-newer': { const ref = fs.get(ctx.resolve(need())); return (e) => !!ref && e.node.mtime > ref.mtime; }
                case '-user': { const u = need(); return (e) => e.node.owner === u; }
                case '-group': { const g = need(); return (e) => e.node.group === g; }
                case '-nouser': return (e) => !(ctx.sh.system.userExists && ctx.sh.system.userExists(e.node.owner));
                case '-perm': {
                    const s = need();
                    let mode = s.replace(/^[-\/]/, '');
                    const prefix = s[0] === '-' || s[0] === '/' ? s[0] : '';
                    const m = /^[0-7]+$/.test(mode) ? parseInt(mode, 8) : parseMode(mode, 0, false);
                    return (e) => {
                        const pm = e.node.mode & 0o7777;
                        if (prefix === '-') return (pm & m) === m;
                        if (prefix === '/') return m === 0 || (pm & m) !== 0;
                        return pm === m;
                    };
                }
                case '-readable': return (e) => fs.can(e.node, 'r');
                case '-writable': return (e) => fs.can(e.node, 'w');
                case '-executable': return (e) => fs.can(e.node, 'x');
                case '-true': return () => true;
                case '-false': return () => false;
                case '-print': hasAction = true; return (e) => { ctx.outln(e.disp); return true; };
                case '-print0': hasAction = true; return (e) => { ctx.out(e.disp + '\0'); return true; };
                case '-printf': {
                    hasAction = true;
                    const f = need();
                    return (e) => {
                        ctx.out(LA.shellUtil.unescapeC(f.replace(/%(.)/g, (m, c) => {
                            switch (c) {
                                case 'p': return e.disp;
                                case 'f': return e.name;
                                case 'h': return VFS.dirname(e.disp) === '/' && !e.disp.startsWith('/') ? '.' : (e.disp.includes('/') ? e.disp.slice(0, e.disp.lastIndexOf('/')) || '/' : '.');
                                case 's': return String(fs.size(e.node));
                                case 'm': return (e.node.mode & 0o7777).toString(8);
                                case 'M': return VFS.modeString(e.node);
                                case 'u': return e.node.owner;
                                case 'g': return e.node.group;
                                case 'd': return String(e.depth);
                                case 'y': return VFS.typeChar(e.node) === '-' ? 'f' : VFS.typeChar(e.node);
                                case 't': return new Date(e.node.mtime).toString();
                                case '%': return '%';
                                default: return m;
                            }
                        })));
                        return true;
                    };
                }
                case '-ls': hasAction = true; return (e) => { ctx.outln(String(e.node.ino).padStart(8) + '      4 ' + VFS.modeString(e.node) + '   1 ' + e.node.owner.padEnd(8) + ' ' + e.node.group.padEnd(8) + ' ' + String(fs.size(e.node)).padStart(8) + ' ' + lsDate(e.node.mtime) + ' ' + e.disp); return true; };
                case '-delete': hasAction = true; return (e) => {
                    try { if (e.node.type === 'dir') fs.rmdir(e.path); else fs.unlink(e.path); }
                    catch (er) { ctx.err('find: cannot delete ‘' + e.disp + '’: ' + er.message + '\n'); status = 1; }
                    return true;
                };
                case '-prune': return (e) => { e.prune = true; return true; };
                case '-quit': return () => { throw { findQuit: true }; };
                case '-exec': case '-execdir': case '-ok': {
                    hasAction = true;
                    const cmd = [];
                    while (pos < filtered.length && filtered[pos] !== ';' && filtered[pos] !== '+') cmd.push(filtered[pos++]);
                    if (pos >= filtered.length) throw new Error("missing argument to `" + tok + "'");
                    const term = filtered[pos++];
                    if (term === '+') {
                        const batch = { cmd, items: [] };
                        execBatches.push(batch);
                        return (e) => { batch.items.push(e.disp); return true; };
                    }
                    return (e) => {
                        const argv = cmd.map((a) => a.split('{}').join(tok === '-execdir' ? './' + e.name : e.disp));
                        const code = ctx.exec(argv);
                        return code === 0;
                    };
                }
                default:
                    if (tok === undefined) return () => true;
                    throw new Error("unknown predicate `" + tok + "'");
            }
        }
        let expr;
        try {
            expr = filtered.length ? parseOr() : () => true;
            if (pos < filtered.length) throw new Error("paths must precede expression: `" + filtered[pos] + "'");
        } catch (e) {
            return ctx.fail(e.message);
        }
        try {
            for (const root of paths) {
                const rp = ctx.resolve(root);
                let rootNode;
                try { rootNode = fs.get(rp); } catch (e) { rootNode = null; }
                if (!rootNode) { ctx.err("find: ‘" + root + "’: No such file or directory\n"); status = 1; continue; }
                const visit = (node, path, disp, depth, name) => {
                    const e = { node, path, disp, depth, name };
                    if (depth >= minDepth && depth <= maxDepth) {
                        const r = expr(e);
                        if (r && !hasAction) ctx.outln(disp);
                    }
                    if (node.type === 'dir' && depth < maxDepth && !e.prune) {
                        let names;
                        try { names = fs.list(path); } catch (er) { ctx.err("find: ‘" + disp + "’: Permission denied\n"); status = 1; return; }
                        for (const nm of names) {
                            const child = node.children[nm];
                            if (!child) continue;
                            visit(child, (path === '/' ? '' : path) + '/' + nm, (disp === '/' ? '' : disp.replace(/\/$/, '')) + '/' + nm, depth + 1, nm);
                        }
                    }
                };
                visit(rootNode, rp, root, 0, root === '/' ? '/' : VFS.basename(rp) || root);
            }
        } catch (e) {
            if (!e || !e.findQuit) throw e;
        }
        for (const b of execBatches) {
            if (!b.items.length) continue;
            const argv = [];
            for (const a of b.cmd) { if (a === '{}') argv.push(...b.items); else argv.push(a); }
            ctx.exec(argv);
        }
        return status;
    });

    R('locate', (ctx) => {
        const pats = ctx.args.filter((a) => !a.startsWith('-'));
        const ci = ctx.args.includes('-i');
        if (!pats.length) return ctx.fail('no pattern to search for specified');
        let found = false;
        ctx.fs.walk('/', (n, p) => {
            if (p.startsWith('/proc') || p.startsWith('/sys')) return;
            for (const pat of pats) {
                const hit = LA.shellUtil.hasGlobChars(pat) ? globMatch('*' + pat + '*', p, { nocase: ci }) : (ci ? p.toLowerCase().includes(pat.toLowerCase()) : p.includes(pat));
                if (hit) { ctx.outln(p); found = true; break; }
            }
        });
        return found ? 0 : 1;
    });
    R('updatedb', () => 0);

    // ---------- du / df ----------
    R('du', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'shacbkmx', args: 'd', long: { summarize: 's', 'human-readable': 'h', all: 'a', total: 'c', 'max-depth': 'd=', 'apparent-size': 'apparent' } });
        if (error) return usageError(ctx, error);
        const fs = ctx.fs;
        const maxDepth = opts.s ? 0 : opts.d !== undefined ? parseInt(opts.d, 10) : Infinity;
        const fmt = (bytes) => {
            if (opts.h) return humanSize(bytes);
            if (opts.b) return String(bytes);
            if (opts.m) return String(Math.ceil(bytes / 1048576));
            return String(Math.ceil(bytes / 1024));
        };
        let grand = 0;
        let status = 0;
        for (const t of operands.length ? operands : ['.']) {
            const p = ctx.resolve(t);
            const node = fs.get(p);
            if (!node) { ctx.err("du: cannot access '" + t + "': No such file or directory\n"); status = 1; continue; }
            const visit = (n, disp, depth) => {
                let total = n.type === 'dir' ? 4096 : (opts.b || opts.apparent ? fs.size(n) : fs.diskUsage(n));
                if (n.type === 'dir') {
                    for (const k of Object.keys(n.children).sort()) total += visit(n.children[k], disp.replace(/\/$/, '') + '/' + k, depth + 1);
                    if (depth <= maxDepth) ctx.outln(fmt(total) + '\t' + disp);
                } else if ((opts.a || depth === 0) && depth <= maxDepth) ctx.outln(fmt(total) + '\t' + disp);
                return total;
            };
            grand += visit(node, t, 0);
        }
        if (opts.c) ctx.outln(fmt(grand) + '\ttotal');
        return status;
    });

    R('df', (ctx) => {
        const { opts, error } = getopt(ctx.args, { flags: 'hTiaklP', long: { 'human-readable': 'h', 'print-type': 'T', inodes: 'i' } });
        if (error) return usageError(ctx, error);
        const used = Math.ceil(ctx.fs.diskUsage(ctx.fs.root) / 1024) + 4812300;
        const rows = [
            ['udev', 'devtmpfs', 4002536, 0, '/dev'],
            ['tmpfs', 'tmpfs', 812420, 1692, '/run'],
            ['/dev/sda1', 'ext4', 61611820, used, '/'],
            ['tmpfs', 'tmpfs', 4062084, 0, '/dev/shm'],
            ['tmpfs', 'tmpfs', 5120, 4, '/run/lock'],
            ['/dev/sda15', 'vfat', 106858, 6182, '/boot/efi'],
            ['tmpfs', 'tmpfs', 812416, 24, '/run/user/1000']
        ];
        const h = opts.h;
        const fmt = (kb) => (h ? humanSize(kb * 1024) : String(kb));
        const header = ['Filesystem'].concat(opts.T ? ['Type'] : []).concat(opts.i ? ['Inodes', 'IUsed', 'IFree', 'IUse%'] : [h ? 'Size' : '1K-blocks', 'Used', 'Avail', 'Use%']).concat(['Mounted on']);
        const lines = [header];
        for (const r of rows) {
            const [fsn, type, size, u, mount] = r;
            const avail = Math.max(0, size - u);
            const pct = size ? Math.ceil((u / size) * 100) + '%' : '-';
            if (opts.i) lines.push([fsn].concat(opts.T ? [type] : []).concat([String(Math.floor(size / 16)), String(Math.floor(u / 32)), String(Math.floor(size / 16 - u / 32)), pct, mount]));
            else lines.push([fsn].concat(opts.T ? [type] : []).concat([fmt(size), fmt(u), fmt(avail), pct, mount]));
        }
        const widths = header.map((_, c) => Math.max(...lines.map((l) => l[c].length)));
        for (const l of lines) {
            ctx.outln(l.map((cell, c) => (c === 0 || c === l.length - 1 || (opts.T && c === 1) ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join(' ').trimEnd());
        }
        return 0;
    });

    // ---------- chmod / chown / chgrp ----------
    R('chmod', (ctx) => {
        const args = ctx.args.slice();
        let recursive = false, verbose = false, changes = false;
        const rest = [];
        for (const a of args) {
            if (a === '-R' || a === '--recursive') recursive = true;
            else if (a === '-v' || a === '--verbose') verbose = true;
            else if (a === '-c' || a === '--changes') changes = true;
            else if (/^-[Rvcf]+$/.test(a)) { if (a.includes('R')) recursive = true; if (a.includes('v')) verbose = true; }
            else rest.push(a);
        }
        if (rest.length < 2) return usageError(ctx, rest.length ? "missing operand after '" + rest[0] + "'" : 'missing operand');
        const spec = rest[0];
        let status = 0;
        const fs = ctx.fs;
        const apply = (node, disp) => {
            if (ctx.sh.user !== 'root' && node.owner !== ctx.sh.user) {
                ctx.err("chmod: changing permissions of '" + disp + "': Operation not permitted\n");
                status = 1;
                return;
            }
            const nm = parseMode(spec, node.mode & 0o7777, node.type === 'dir');
            if (nm === null) throw new Error("invalid mode: '" + spec + "'");
            const old = node.mode & 0o7777;
            node.mode = nm;
            if (verbose || (changes && old !== nm)) {
                ctx.outln("mode of '" + disp + "' " + (old === nm ? 'retained as ' : 'changed from ') + old.toString(8).padStart(4, '0') + ' (' + VFS.modeString(Object.assign({}, node, { mode: old })).slice(1) + ')' + (old === nm ? '' : ' to ' + nm.toString(8).padStart(4, '0') + ' (' + VFS.modeString(node).slice(1) + ')'));
            }
        };
        for (const f of rest.slice(1)) {
            const p = ctx.resolve(f);
            let node;
            try { node = fs.get(p); } catch (e) { node = null; }
            if (!node) { ctx.err("chmod: cannot access '" + f + "': No such file or directory\n"); status = 1; continue; }
            try {
                if (recursive && node.type === 'dir') fs.walk(p, (n, path) => apply(n, f.replace(/\/$/, '') + path.slice(p.length)));
                else apply(node, f);
            } catch (e) {
                if (e.message && e.message.startsWith('invalid mode')) { ctx.err('chmod: ' + e.message + "\nTry 'chmod --help' for more information.\n"); return 1; }
                throw e;
            }
        }
        return status;
    });

    function chownImpl(ctx, groupOnly) {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'Rvfch', long: { recursive: 'R', verbose: 'v', reference: 'reference=' } });
        if (error) return usageError(ctx, error);
        if (operands.length < 2) return usageError(ctx, operands.length ? "missing operand after '" + operands[0] + "'" : 'missing operand');
        const sys = ctx.sh.system;
        let user = null, group = null;
        if (groupOnly) group = operands[0];
        else {
            const m = /^([^:.]*)(?:[:.](.*))?$/.exec(operands[0]);
            user = m[1] || null;
            group = m[2] !== undefined ? (m[2] || (user ? sys.primaryGroupOf(user) : null)) : null;
        }
        if (user && sys.userExists && !sys.userExists(user) && !/^\d+$/.test(user)) return ctx.fail("invalid user: '" + operands[0] + "'");
        if (group && sys.groupExists && !sys.groupExists(group) && !/^\d+$/.test(group)) return ctx.fail("invalid group: '" + (groupOnly ? group : operands[0]) + "'");
        let status = 0;
        const fs = ctx.fs;
        for (const f of operands.slice(1)) {
            const p = ctx.resolve(f);
            const node = fs.get(p);
            if (!node) { ctx.err(ctx.name + ": cannot access '" + f + "': No such file or directory\n"); status = 1; continue; }
            const apply = (n, disp) => {
                const isRoot = ctx.sh.user === 'root';
                const allowedGroup = !user && group && n.owner === ctx.sh.user && fs.user.groups.includes(group);
                if (!isRoot && !allowedGroup) {
                    ctx.err(ctx.name + ": changing " + (user ? 'ownership' : 'group') + " of '" + disp + "': Operation not permitted\n");
                    status = 1;
                    return;
                }
                if (user) n.owner = user;
                if (group) n.group = group;
                if (opts.v) ctx.outln("changed ownership of '" + disp + "' to " + (user || n.owner) + ':' + (group || n.group));
            };
            if (opts.R && node.type === 'dir') fs.walk(p, (n, path) => apply(n, f.replace(/\/$/, '') + path.slice(p.length)));
            else apply(node, f);
        }
        return status;
    }
    R('chown', (ctx) => chownImpl(ctx, false));
    R('chgrp', (ctx) => chownImpl(ctx, true));

    // ---------- path utilities ----------
    R('basename', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'az', args: 's', long: { multiple: 'a', suffix: 's=' } });
        if (!operands.length) return usageError(ctx, 'missing operand');
        const multi = opts.a || opts.s;
        const names = multi ? operands : [operands[0]];
        const suffix = opts.s || (!multi ? operands[1] : undefined);
        for (const n of names) {
            let b = n.replace(/\/+$/, '');
            b = b === '' ? '/' : b.slice(b.lastIndexOf('/') + 1);
            if (suffix && b.endsWith(suffix) && b !== suffix) b = b.slice(0, -suffix.length);
            ctx.outln(b);
        }
        return 0;
    });
    R('dirname', (ctx) => {
        if (!ctx.args.length) return usageError(ctx, 'missing operand');
        for (const n of ctx.args) {
            let d = n.replace(/\/+$/, '');
            if (!d) { ctx.outln('/'); continue; }
            const i = d.lastIndexOf('/');
            if (i === -1) ctx.outln('.');
            else ctx.outln(d.slice(0, i).replace(/\/+$/, '') || '/');
        }
        return 0;
    });
    R('realpath', (ctx) => {
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        const allowMissing = ctx.args.includes('-m');
        let status = 0;
        for (const f of ops.length ? ops : ['.']) {
            try { ctx.outln(ctx.fs.realpath(ctx.resolve(f))); }
            catch (e) { if (allowMissing) ctx.outln(ctx.resolve(f)); else { ctx.err('realpath: ' + f + ': No such file or directory\n'); status = 1; } }
        }
        return status;
    });
    R('readlink', (ctx) => {
        const canon = ctx.args.includes('-f') || ctx.args.includes('-e') || ctx.args.includes('-m');
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        let status = 0;
        for (const f of ops) {
            const p = ctx.resolve(f);
            if (canon) { try { ctx.outln(ctx.fs.realpath(p)); } catch (e) { status = 1; } continue; }
            const n = ctx.fs.get(p, { follow: false });
            if (!n || n.type !== 'link') { status = 1; continue; }
            ctx.outln(n.target);
        }
        return status;
    });
    R('mktemp', (ctx) => {
        const dir = ctx.args.includes('-d');
        const tmpl = ctx.args.find((a) => !a.startsWith('-')) || 'tmp.XXXXXXXXXX';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const name = tmpl.replace(/X+$/, (m) => Array.from({ length: m.length }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
        const p = name.includes('/') ? ctx.resolve(name) : '/tmp/' + name;
        if (dir) ctx.fs.mkdir(p, { mode: 0o700 }); else ctx.fs.writeFile(p, '', { mode: 0o600 });
        ctx.outln(p);
        return 0;
    });
    R('truncate', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'c', args: 's', long: { size: 's=' } });
        if (!opts.s) return usageError(ctx, 'you must specify either ‘--size’ or ‘--reference’');
        for (const f of operands) {
            const p = ctx.resolve(f);
            const node = ctx.fs.get(p);
            const cur = node ? node.content : '';
            const m = /^([+-]?)(\d+)([KMG]?)$/.exec(opts.s);
            if (!m) return ctx.fail("Invalid number: '" + opts.s + "'");
            let size = parseInt(m[2], 10) * ({ K: 1024, M: 1048576, G: 1073741824, '': 1 }[m[3]]);
            if (m[1] === '+') size = cur.length + size;
            if (m[1] === '-') size = Math.max(0, cur.length - size);
            size = Math.min(size, 1048576);
            const content = size <= cur.length ? cur.slice(0, size) : cur + '\0'.repeat(size - cur.length);
            ctx.fs.writeFile(p, content);
        }
        return 0;
    });

    R('dd', (ctx) => {
        const kv = {};
        for (const a of ctx.args) { const i = a.indexOf('='); if (i > 0) kv[a.slice(0, i)] = a.slice(i + 1); }
        const parseSize = (s) => {
            const m = /^(\d+)([KMGkmg]?)B?$/.exec(s || '');
            if (!m) return null;
            return parseInt(m[1], 10) * ({ k: 1024, K: 1024, m: 1048576, M: 1048576, g: 1073741824, G: 1073741824, '': 1 }[m[2]]);
        };
        const bs = parseSize(kv.bs || '512') || 512;
        const count = kv.count !== undefined ? parseInt(kv.count, 10) : null;
        let data;
        if (kv.if) {
            const p = ctx.resolve(kv.if);
            const node = ctx.fs.get(p);
            if (!node) return ctx.fail("failed to open '" + kv.if + "': No such file or directory");
            if (node.type === 'dev' && node.device === 'zero') data = '\0'.repeat(Math.min((count || 1) * bs, 8 * 1048576));
            else if (node.type === 'dev' && (node.device === 'urandom' || node.device === 'random')) {
                const len = Math.min((count || 1) * bs, 1048576);
                let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(Math.floor(Math.random() * 256));
                data = s;
            } else data = ctx.fs.readFile(p);
        } else data = ctx.stdin.readAll();
        if (count !== null) data = data.slice(0, count * bs);
        if (kv.of) ctx.fs.writeFile(ctx.resolve(kv.of), data);
        else ctx.out(data);
        const records = Math.ceil(data.length / bs);
        ctx.err(records + '+0 records in\n' + records + '+0 records out\n' + data.length + ' bytes (' + humanSize(data.length, true) + 'B) copied, 0.00' + (1 + Math.floor(Math.random() * 9)) + ' s, ' + humanSize(data.length * 300, true) + 'B/s\n');
        return 0;
    });

    // ---------- archives ----------
    const TAR_MAGIC = '\x00LATAR\x00';
    const GZ_MAGIC = '\x1f\x8b\x08\x00';
    function b64encode(str) {
        const bytes = new TextEncoder().encode(str);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    }
    function b64decode(b64) {
        const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }
    LA.b64 = { encode: b64encode, decode: b64decode };
    function gzipEncode(content, name) { return GZ_MAGIC + b64encode(JSON.stringify({ n: name || '', c: content })); }
    function gzipDecode(data) {
        if (!data.startsWith(GZ_MAGIC)) return null;
        try { return JSON.parse(b64decode(data.slice(GZ_MAGIC.length))); } catch (e) { return null; }
    }
    function tarEncode(entries) { return TAR_MAGIC + b64encode(JSON.stringify(entries)); }
    function tarDecode(data) {
        const gz = gzipDecode(data);
        if (gz) data = gz.c;
        if (!data.startsWith(TAR_MAGIC)) return null;
        try { return JSON.parse(b64decode(data.slice(TAR_MAGIC.length))); } catch (e) { return null; }
    }
    LA.archive = { gzipEncode, gzipDecode, tarEncode, tarDecode };

    R('tar', (ctx) => {
        let args = ctx.args.slice();
        // first arg may be bundled flags without dash: tar czf ...
        if (args.length && !args[0].startsWith('-') && /^[a-zA-Z]+$/.test(args[0])) args[0] = '-' + args[0];
        const { opts, operands, error } = getopt(args, {
            flags: 'cxtvzjJrupkOaW',
            args: 'fC',
            multi: ['exclude'],
            long: { create: 'c', extract: 'x', get: 'x', list: 't', verbose: 'v', gzip: 'z', file: 'f=', directory: 'C=', exclude: 'exclude=', append: 'r', 'to-stdout': 'O', bzip2: 'j', xz: 'J' }
        });
        if (error) return usageError(ctx, error);
        const fs = ctx.fs;
        const modes = ['c', 'x', 't', 'r'].filter((m) => opts[m]);
        if (modes.length !== 1) return ctx.fail("You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information.", 2);
        const baseDir = opts.C ? ctx.resolve(opts.C) : ctx.sh.cwd;
        const compress = opts.z || opts.j || opts.J || (opts.f && /\.(tgz|tar\.gz|gz)$/.test(opts.f));
        if (opts.c || opts.r) {
            if (!operands.length) return ctx.fail('Cowardly refusing to create an empty archive', 2);
            let entries = [];
            if (opts.r && opts.f && fs.exists(ctx.resolve(opts.f))) entries = tarDecode(fs.readFile(ctx.resolve(opts.f))) || [];
            const excludes = opts.exclude || [];
            for (const op of operands) {
                const abs = VFS.normalize(op, baseDir, ctx.sh.home);
                const node = fs.get(abs);
                if (!node) { ctx.err('tar: ' + op + ': Cannot stat: No such file or directory\n'); continue; }
                const rel = op.replace(/^\/+/, '');
                if (op.startsWith('/')) ctx.err('tar: Removing leading `/\' from member names\n');
                fs.walk(abs, (n, p) => {
                    const name = (rel.replace(/\/$/, '') + p.slice(abs.length)) || rel;
                    if (excludes.some((x) => globMatch(x, VFS.basename(name)) || globMatch(x, name))) return;
                    const entry = { p: name + (n.type === 'dir' ? '/' : ''), t: n.type, m: n.mode, o: n.owner, g: n.group, d: n.mtime };
                    if (n.type === 'file') entry.c = n.content;
                    if (n.type === 'link') entry.l = n.target;
                    entries.push(entry);
                    if (opts.v) ctx.outln(entry.p);
                });
            }
            const data = compress ? gzipEncode(tarEncode(entries), opts.f ? VFS.basename(opts.f).replace(/\.(gz|tgz)$/, '') : '') : tarEncode(entries);
            if (opts.f && opts.f !== '-') {
                try { fs.writeFile(ctx.resolve(opts.f), data); }
                catch (e) { return ctx.fail(opts.f + ': Cannot open: ' + e.message, 2); }
            } else ctx.out(data);
            return 0;
        }
        // extract / list
        let data;
        if (opts.f && opts.f !== '-') {
            try { data = fs.readFile(ctx.resolve(opts.f)); }
            catch (e) { return ctx.fail(opts.f + ': Cannot open: ' + e.message + '\ntar: Error is not recoverable: exiting now', 2); }
        } else data = ctx.stdin.readAll();
        const entries = tarDecode(data);
        if (!entries) return ctx.fail('This does not look like a tar archive\ntar: Exiting with failure status due to previous errors', 2);
        const wanted = operands;
        const selected = entries.filter((e) => !wanted.length || wanted.some((w) => e.p === w || e.p.startsWith(w.replace(/\/$/, '') + '/') || e.p === w + '/' || globMatch(w, e.p.replace(/\/$/, ''))));
        if (opts.t) {
            for (const e of selected) {
                if (opts.v) ctx.outln(VFS.modeString({ type: e.t, mode: e.m }) + ' ' + (e.o + '/' + e.g).padEnd(13) + ' ' + String(e.c ? e.c.length : 0).padStart(6) + ' ' + isoDate(e.d || Date.now()).slice(0, 16) + ' ' + e.p + (e.l ? ' -> ' + e.l : ''));
                else ctx.outln(e.p);
            }
            return 0;
        }
        for (const e of selected) {
            const dest = VFS.normalize(e.p, baseDir, ctx.sh.home);
            try {
                if (opts.O) { if (e.t === 'file') ctx.out(e.c); continue; }
                if (e.t === 'dir') { if (!fs.isDir(dest)) fs.mkdir(dest, { parents: true, mode: e.m }); }
                else {
                    if (!fs.isDir(VFS.dirname(dest))) fs.mkdir(VFS.dirname(dest), { parents: true });
                    if (e.t === 'link') { if (fs.get(dest, { follow: false })) fs.unlink(dest); fs.symlink(e.l, dest); }
                    else { const n = fs.writeFile(dest, e.c || ''); n.mode = e.m; n.mtime = e.d || n.mtime; }
                }
                if (opts.v) ctx.outln(e.p);
            } catch (er) {
                if (!er.code) throw er;
                ctx.err('tar: ' + e.p + ': Cannot open: ' + er.message + '\n');
            }
        }
        return 0;
    });

    R('gzip', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'dckvlfrt123456789', long: { decompress: 'd', stdout: 'c', keep: 'k', verbose: 'v', list: 'l', force: 'f', recursive: 'r', test: 't' } });
        if (error) return usageError(ctx, error);
        const decompress = opts.d || ctx.name === 'gunzip';
        const fs = ctx.fs;
        if (!operands.length) {
            const input = ctx.stdin.readAll();
            if (decompress) { const g = gzipDecode(input); if (!g) return ctx.fail('stdin: not in gzip format'); ctx.out(g.c); }
            else ctx.out(gzipEncode(input, ''));
            return 0;
        }
        let status = 0;
        for (const f of operands) {
            const p = ctx.resolve(f);
            const node = fs.get(p);
            if (!node) { ctx.err(ctx.name + ': ' + f + ': No such file or directory\n'); status = 1; continue; }
            if (node.type === 'dir') { ctx.err(ctx.name + ': ' + f + ' is a directory -- ignored\n'); status = 2; continue; }
            if (opts.l) {
                const g = gzipDecode(node.content);
                if (!g) { ctx.err('gzip: ' + f + ': not in gzip format\n'); status = 1; continue; }
                ctx.outln('         compressed        uncompressed  ratio uncompressed_name');
                const ratio = g.c.length ? (100 - (node.content.length / g.c.length) * 100).toFixed(1) : '0.0';
                ctx.outln(String(node.content.length).padStart(19) + String(g.c.length).padStart(20) + (ratio + '%').padStart(7) + ' ' + f.replace(/\.gz$/, ''));
                continue;
            }
            if (decompress) {
                if (!/\.(gz|tgz|z)$/i.test(f)) { ctx.err(ctx.name + ': ' + f + ': unknown suffix -- ignored\n'); status = 2; continue; }
                const g = gzipDecode(node.content);
                if (!g) { ctx.err(ctx.name + ': ' + f + ': not in gzip format\n'); status = 1; continue; }
                if (opts.t) continue;
                if (opts.c) { ctx.out(g.c); continue; }
                const out = f.endsWith('.tgz') ? p.replace(/\.tgz$/, '.tar') : p.replace(/\.gz$/i, '');
                fs.writeFile(out, g.c).mode = node.mode;
                if (!opts.k) fs.unlink(p);
                if (opts.v) ctx.err(f + ':\t' + ' 60.0% -- replaced with ' + VFS.basename(out) + '\n');
            } else {
                if (f.endsWith('.gz')) { ctx.err('gzip: ' + f + ' already has .gz suffix -- unchanged\n'); continue; }
                const enc = gzipEncode(node.content, VFS.basename(p));
                if (opts.c) { ctx.out(enc); continue; }
                if (fs.exists(p + '.gz') && !opts.f) { ctx.err('gzip: ' + f + '.gz already exists; not overwritten\n'); status = 2; continue; }
                fs.writeFile(p + '.gz', enc).mode = node.mode;
                if (!opts.k) fs.unlink(p);
                if (opts.v) ctx.err(f + ':\t' + ' 58.3% -- replaced with ' + VFS.basename(p) + '.gz\n');
            }
        }
        return status;
    });
    LA.commands.gunzip = { fn: (ctx) => { ctx.name = 'gunzip'; return LA.commands.gzip.fn(ctx); } };
    R('zcat', (ctx) => {
        const inputs = readInputs(ctx, ctx.args);
        for (const i of inputs) {
            const g = gzipDecode(i.content);
            if (!g) { ctx.err('gzip: ' + i.name + ': not in gzip format\n'); continue; }
            ctx.out(g.c);
        }
        return 0;
    });

    const ZIP_MAGIC = 'PK\x03\x04';
    R('zip', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'rqvjmdT9' });
        if (error) return usageError(ctx, error);
        if (operands.length < 1) return ctx.fail('error: nothing to do!');
        let archive = operands[0];
        if (!/\.zip$/i.test(archive)) archive += '.zip';
        const fs = ctx.fs;
        const ap = ctx.resolve(archive);
        let entries = [];
        if (fs.exists(ap)) { try { entries = JSON.parse(b64decode(fs.readFile(ap).slice(4))); } catch (e) { entries = []; } }
        const files = operands.slice(1);
        if (!files.length) return ctx.fail('error: nothing to do!');
        for (const f of files) {
            const p = ctx.resolve(f);
            const node = fs.get(p);
            if (!node) { ctx.outln('\tzip warning: name not matched: ' + f); continue; }
            const add = (n, name) => {
                entries = entries.filter((e) => e.p !== name);
                const e = { p: name + (n.type === 'dir' ? '/' : ''), t: n.type, m: n.mode, d: n.mtime };
                if (n.type === 'file') e.c = n.content;
                entries.push(e);
                if (!opts.q) ctx.outln('  adding: ' + e.p + (n.type === 'dir' ? ' (stored 0%)' : ' (deflated ' + (20 + (name.length * 7) % 60) + '%)'));
            };
            if (node.type === 'dir' && opts.r) fs.walk(p, (n, path) => add(n, opts.j ? VFS.basename(path) : f.replace(/\/$/, '') + path.slice(p.length)));
            else add(node, opts.j ? VFS.basename(f) : f);
        }
        fs.writeFile(ap, ZIP_MAGIC + b64encode(JSON.stringify(entries)));
        return 0;
    });
    R('unzip', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'lqoncvt', args: 'd' });
        if (error) return usageError(ctx, error);
        if (!operands.length) return ctx.fail('UnZip 6.00 of 20 April 2009, by Debian.\nUsage: unzip [-Z] [-opts[modifiers]] file[.zip] [list] [-x xlist] [-d exdir]', 0);
        const fs = ctx.fs;
        let archive = operands[0];
        let ap = ctx.resolve(archive);
        if (!fs.exists(ap) && fs.exists(ap + '.zip')) { ap += '.zip'; archive += '.zip'; }
        if (!fs.exists(ap)) return ctx.fail('cannot find or open ' + archive + ', ' + archive + '.zip or ' + archive + '.ZIP.', 9);
        const data = fs.readFile(ap);
        if (!data.startsWith(ZIP_MAGIC)) return ctx.fail('End-of-central-directory signature not found.', 9);
        let entries;
        try { entries = JSON.parse(b64decode(data.slice(4))); } catch (e) { return ctx.fail('bad zipfile offset', 3); }
        if (opts.l) {
            ctx.outln('Archive:  ' + archive);
            ctx.outln('  Length      Date    Time    Name\n---------  ---------- -----   ----');
            let total = 0;
            for (const e of entries) {
                const len = e.c ? e.c.length : 0; total += len;
                ctx.outln(String(len).padStart(9) + '  ' + isoDate(e.d || Date.now()).slice(0, 16) + '   ' + e.p);
            }
            ctx.outln('---------                     -------\n' + String(total).padStart(9) + '                     ' + entries.length + ' file' + (entries.length === 1 ? '' : 's'));
            return 0;
        }
        const base = opts.d ? ctx.resolve(opts.d) : ctx.sh.cwd;
        if (!opts.q) ctx.outln('Archive:  ' + archive);
        for (const e of entries) {
            const dest = VFS.normalize(e.p, base, ctx.sh.home);
            if (e.t === 'dir') { if (!fs.isDir(dest)) fs.mkdir(dest, { parents: true }); if (!opts.q) ctx.outln('   creating: ' + (opts.d ? opts.d.replace(/\/$/, '') + '/' : '') + e.p); continue; }
            if (!fs.isDir(VFS.dirname(dest))) fs.mkdir(VFS.dirname(dest), { parents: true });
            if (fs.exists(dest) && opts.n) continue;
            fs.writeFile(dest, e.c || '').mode = e.m || 0o644;
            if (!opts.q) ctx.outln('  inflating: ' + (opts.d ? opts.d.replace(/\/$/, '') + '/' : '') + e.p);
        }
        return 0;
    });

    // ---------- checksums / encoding ----------
    function utf8Bytes(s) { return new TextEncoder().encode(s); }
    function latin1Bytes(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
    function toBytes(s) { return /[^\x00-\xff]/.test(s) ? utf8Bytes(s) : (/[\x80-\xff]/.test(s) && !isValidUtf8Text(s) ? latin1Bytes(s) : utf8Bytes(s)); }
    function isValidUtf8Text(s) { return !/[\x80-\xff]/.test(s); }
    function md5(bytes) {
        const K = new Int32Array(64), S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
        for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
        const len = bytes.length;
        const nBlocks = ((len + 8) >> 6) + 1;
        const words = new Int32Array(nBlocks * 16);
        for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
        words[len >> 2] |= 0x80 << ((len % 4) * 8);
        words[nBlocks * 16 - 2] = (len * 8) | 0;
        words[nBlocks * 16 - 1] = Math.floor(len / 536870912);
        let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
        for (let blk = 0; blk < nBlocks; blk++) {
            let A = a0, Bv = b0, Cv = c0, D = d0;
            for (let i = 0; i < 64; i++) {
                let F, g;
                if (i < 16) { F = (Bv & Cv) | (~Bv & D); g = i; }
                else if (i < 32) { F = (D & Bv) | (~D & Cv); g = (5 * i + 1) % 16; }
                else if (i < 48) { F = Bv ^ Cv ^ D; g = (3 * i + 5) % 16; }
                else { F = Cv ^ (Bv | ~D); g = (7 * i) % 16; }
                F = (F + A + K[i] + words[blk * 16 + g]) | 0;
                A = D; D = Cv; Cv = Bv;
                Bv = (Bv + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
            }
            a0 = (a0 + A) | 0; b0 = (b0 + Bv) | 0; c0 = (c0 + Cv) | 0; d0 = (d0 + D) | 0;
        }
        let hex = '';
        for (const v of [a0, b0, c0, d0]) for (let i = 0; i < 4; i++) hex += ((v >>> (i * 8)) & 255).toString(16).padStart(2, '0');
        return hex;
    }
    function sha256(bytes) {
        const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
        const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        const len = bytes.length;
        const total = ((len + 9 + 63) >> 6) << 6;
        const buf = new Uint8Array(total);
        buf.set(bytes);
        buf[len] = 0x80;
        const bitLen = len * 8;
        buf[total - 4] = (bitLen >>> 24) & 255; buf[total - 3] = (bitLen >>> 16) & 255; buf[total - 2] = (bitLen >>> 8) & 255; buf[total - 1] = bitLen & 255;
        buf[total - 5] = Math.floor(len / 536870912) & 255;
        const W = new Uint32Array(64);
        const rotr = (x, n) => (x >>> n) | (x << (32 - n));
        for (let off = 0; off < total; off += 64) {
            for (let i = 0; i < 16; i++) W[i] = (buf[off + i * 4] << 24) | (buf[off + i * 4 + 1] << 16) | (buf[off + i * 4 + 2] << 8) | buf[off + i * 4 + 3];
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
                const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
                W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
            }
            let [a, b, c, d, e, f, g, h] = H;
            for (let i = 0; i < 64; i++) {
                const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                const ch = (e & f) ^ (~e & g);
                const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
                const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const t2 = (S0 + maj) >>> 0;
                h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
            }
            H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
            H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
        }
        return H.map((x) => x.toString(16).padStart(8, '0')).join('');
    }
    function sha1(bytes) {
        const len = bytes.length;
        const total = ((len + 9 + 63) >> 6) << 6;
        const buf = new Uint8Array(total);
        buf.set(bytes);
        buf[len] = 0x80;
        const bitLen = len * 8;
        buf[total - 4] = (bitLen >>> 24) & 255; buf[total - 3] = (bitLen >>> 16) & 255; buf[total - 2] = (bitLen >>> 8) & 255; buf[total - 1] = bitLen & 255;
        let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
        const W = new Uint32Array(80);
        const rotl = (x, n) => (x << n) | (x >>> (32 - n));
        for (let off = 0; off < total; off += 64) {
            for (let i = 0; i < 16; i++) W[i] = (buf[off + i * 4] << 24) | (buf[off + i * 4 + 1] << 16) | (buf[off + i * 4 + 2] << 8) | buf[off + i * 4 + 3];
            for (let i = 16; i < 80; i++) W[i] = rotl(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
            let a = h0, b = h1, c = h2, d = h3, e = h4;
            for (let i = 0; i < 80; i++) {
                let f, k;
                if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
                else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
                else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
                else { f = b ^ c ^ d; k = 0xca62c1d6; }
                const t = (rotl(a, 5) + f + e + k + W[i]) >>> 0;
                e = d; d = c; c = rotl(b, 30) >>> 0; b = a; a = t;
            }
            h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
        }
        return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, '0')).join('');
    }
    LA.hash = { md5: (s) => md5(toBytes(s)), sha1: (s) => sha1(toBytes(s)), sha256: (s) => sha256(toBytes(s)) };
    function sumCmd(algo) {
        return (ctx) => {
            const check = ctx.args.includes('-c') || ctx.args.includes('--check');
            const files = ctx.args.filter((a) => !a.startsWith('-') || a === '-');
            const fn = LA.hash[algo];
            if (check) {
                const inputs = readInputs(ctx, files);
                let bad = 0;
                for (const inp of inputs) {
                    for (const line of splitLines(inp.content)) {
                        const m = /^([0-9a-f]+)\s+\*?(.+)$/.exec(line);
                        if (!m) continue;
                        let ok = false;
                        try { ok = fn(ctx.fs.readFile(ctx.resolve(m[2]))) === m[1]; } catch (e) { ok = false; }
                        ctx.outln(m[2] + ': ' + (ok ? 'OK' : 'FAILED'));
                        if (!ok) bad++;
                    }
                }
                if (bad) ctx.err(ctx.name + ': WARNING: ' + bad + ' computed checksum' + (bad > 1 ? 's' : '') + ' did NOT match\n');
                return bad ? 1 : 0;
            }
            const inputs = readInputs(ctx, files);
            for (const inp of inputs) ctx.outln(fn(inp.content) + '  ' + inp.name);
            return inputs.failed ? 1 : 0;
        };
    }
    R('md5sum', sumCmd('md5'));
    R('sha1sum', sumCmd('sha1'));
    R('sha256sum', sumCmd('sha256'));
    R('cksum', (ctx) => {
        const inputs = readInputs(ctx, ctx.args);
        for (const inp of inputs) {
            let crc = 0;
            const bytes = toBytes(inp.content);
            for (const b of bytes) { crc ^= b << 24; for (let k = 0; k < 8; k++) crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1; }
            let l = bytes.length;
            while (l > 0) { crc ^= (l & 255) << 24; for (let k = 0; k < 8; k++) crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1; l >>>= 8; }
            ctx.outln(((~crc) >>> 0) + ' ' + bytes.length + (inp.name === '-' ? '' : ' ' + inp.name));
        }
        return 0;
    });

    R('base64', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'di', args: 'w', long: { decode: 'd', wrap: 'w=', 'ignore-garbage': 'i' } });
        if (error) return usageError(ctx, error);
        const inputs = readInputs(ctx, operands.slice(0, 1));
        if (inputs.failed) return 1;
        const text = inputs.map((i) => i.content).join('');
        if (opts.d) {
            const clean = text.replace(/[\s]/g, '');
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return ctx.fail('invalid input');
            try { ctx.out(b64decode(clean)); } catch (e) { return ctx.fail('invalid input'); }
            return 0;
        }
        let enc;
        if (/[^\x00-\xff]/.test(text)) enc = b64encode(text);
        else { enc = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(text))) : Buffer.from(text, 'utf8').toString('base64'); }
        const w = opts.w !== undefined ? parseInt(opts.w, 10) : 76;
        if (w > 0) enc = enc.replace(new RegExp('(.{' + w + '})', 'g'), '$1\n').replace(/\n$/, '');
        ctx.outln(enc);
        return 0;
    });

    R('xxd', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'prui', args: 'lsc' });
        const inputs = readInputs(ctx, operands.slice(0, 1));
        if (inputs.failed) return 1;
        let bytes = Array.from(utf8Bytes(inputs[0].content));
        if (opts.r) {
            const hex = inputs[0].content.replace(opts.p ? /\s/g : /^[0-9a-f]+:\s|\s\s.*$/gm, '').replace(/\s/g, '');
            let s = '';
            for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
            ctx.out(s);
            return 0;
        }
        if (opts.s) bytes = bytes.slice(parseInt(opts.s, 10));
        if (opts.l) bytes = bytes.slice(0, parseInt(opts.l, 10));
        const hx = (b) => (opts.u ? b.toString(16).toUpperCase() : b.toString(16)).padStart(2, '0');
        if (opts.p) {
            let s = bytes.map(hx).join('');
            ctx.outln(s.replace(/(.{60})/g, '$1\n').replace(/\n$/, ''));
            return 0;
        }
        const cols = opts.c ? parseInt(opts.c, 10) : 16;
        for (let off = 0; off < bytes.length; off += cols) {
            const chunk = bytes.slice(off, off + cols);
            let hex = '';
            for (let i = 0; i < cols; i += 2) {
                hex += (chunk[i] !== undefined ? hx(chunk[i]) : '  ') + (chunk[i + 1] !== undefined ? hx(chunk[i + 1]) : '  ') + ' ';
            }
            const ascii = chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
            ctx.outln(off.toString(16).padStart(8, '0') + ': ' + hex + ' ' + ascii);
        }
        return 0;
    });

    R('od', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'cxbdo', args: 'At', long: {} });
        const inputs = readInputs(ctx, operands.slice(0, 1));
        if (inputs.failed) return 1;
        const bytes = Array.from(utf8Bytes(inputs[0].content));
        const noAddr = opts.A === 'n';
        const addr = (o) => (noAddr ? '' : o.toString(8).padStart(7, '0'));
        const mode = opts.c ? 'c' : opts.t === 'x1' || opts.x && opts.t === undefined && false ? 'x1' : opts.t || (opts.x ? 'x2' : 'o2');
        for (let off = 0; off < bytes.length; off += 16) {
            const chunk = bytes.slice(off, off + 16);
            let line = addr(off);
            if (mode === 'c') {
                line += chunk.map((b) => {
                    const m = { 0: '\\0', 7: '\\a', 8: '\\b', 9: '\\t', 10: '\\n', 11: '\\v', 12: '\\f', 13: '\\r' }[b];
                    return (m || (b >= 32 && b < 127 ? String.fromCharCode(b) : b.toString(8).padStart(3, '0'))).padStart(4);
                }).join('');
            } else if (mode === 'x1') {
                line += chunk.map((b) => ' ' + b.toString(16).padStart(2, '0')).join('');
            } else if (mode === 'd1' || mode === 'u1') {
                line += chunk.map((b) => String(b).padStart(4)).join('');
            } else {
                for (let i = 0; i < chunk.length; i += 2) {
                    const w = chunk[i] | ((chunk[i + 1] || 0) << 8);
                    line += ' ' + (mode === 'x2' ? w.toString(16).padStart(4, '0') : w.toString(8).padStart(6, '0'));
                }
            }
            ctx.outln(line);
        }
        if (!noAddr) ctx.outln(addr(bytes.length));
        return 0;
    });

    R('strings', (ctx) => {
        const n = ctx.args.includes('-n') ? parseInt(ctx.args[ctx.args.indexOf('-n') + 1], 10) : 4;
        const files = ctx.args.filter((a, i) => !a.startsWith('-') && ctx.args[i - 1] !== '-n');
        const inputs = readInputs(ctx, files);
        for (const inp of inputs) {
            const re = new RegExp('[\\x20-\\x7e\\t]{' + n + ',}', 'g');
            const m = inp.content.match(re) || [];
            for (const s of m) ctx.outln(s);
        }
        return 0;
    });

    R('which', (ctx) => {
        const all = ctx.args.includes('-a');
        let status = 0;
        for (const name of ctx.args.filter((a) => !a.startsWith('-'))) {
            const sh = ctx.sh;
            const found = [];
            for (const dir of (sh.getVar('PATH') || '').split(':')) {
                if (!dir) continue;
                const p = VFS.normalize(dir + '/' + name, sh.cwd, sh.home);
                let node = null;
                try { node = ctx.fs.get(p); } catch (e) { node = null; }
                if (node && node.type === 'file' && (node.mode & 0o111)) { found.push(p); if (!all) break; }
            }
            if (!found.length) status = 1;
            for (const f of found) ctx.outln(f);
        }
        return status;
    });
    R('whereis', (ctx) => {
        for (const name of ctx.args.filter((a) => !a.startsWith('-'))) {
            const locs = [];
            for (const d of ['/usr/bin', '/usr/sbin', '/bin', '/sbin', '/usr/local/bin']) {
                if (ctx.fs.isFile(d + '/' + name)) { locs.push(d + '/' + name); break; }
            }
            if (LA.docs && LA.docs.get(name)) locs.push('/usr/share/man/man1/' + name + '.1.gz');
            ctx.outln(name + ':' + (locs.length ? ' ' + locs.join(' ') : ''));
        }
        return 0;
    });
})();
