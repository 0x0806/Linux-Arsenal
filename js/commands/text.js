// Linux Arsenal - text processing commands
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const U = LA.util;
    const { getopt, usageError, readInputs, splitLines, joinLines, buildRegex, register, formatPrintf } = U;
    const VFS = LA.VFS;
    const R = (name, fn, meta) => register(name, fn, meta);

    // ---------- grep ----------
    function grepCmd(ctx, mode) {
        const { opts, operands, error } = getopt(ctx.args, {
            flags: 'ivcnlLhHrRwxoqsEFGPzZaIbU',
            args: 'efmABC',
            multi: ['e', 'f'],
            negativeNumbers: false,
            long: {
                'ignore-case': 'i', 'invert-match': 'v', count: 'c', 'line-number': 'n', 'files-with-matches': 'l', 'files-without-match': 'L',
                'no-filename': 'h', 'with-filename': 'H', recursive: 'r', 'dereference-recursive': 'R', 'word-regexp': 'w', 'line-regexp': 'x',
                'only-matching': 'o', quiet: 'q', silent: 'q', 'no-messages': 's', 'extended-regexp': 'E', 'fixed-strings': 'F', 'basic-regexp': 'G',
                'perl-regexp': 'P', regexp: 'e=', file: 'f=', 'max-count': 'm=', 'after-context': 'A=', 'before-context': 'B=', context: 'C=',
                color: 'color?', colour: 'color?', include: 'include=', exclude: 'exclude=', 'exclude-dir': 'excludedir=', 'byte-offset': 'b', 'null-data': 'z'
            }
        });
        if (error) return usageError(ctx, error);
        const ops = operands.slice();
        let patterns = [];
        if (opts.e) patterns.push(...opts.e);
        if (opts.f) for (const f of opts.f) { try { patterns.push(...splitLines(ctx.fs.readFile(ctx.resolve(f)))); } catch (e) { return ctx.fail(f + ': No such file or directory', 2); } }
        if (!patterns.length) {
            if (!ops.length) return ctx.fail('Usage: grep [OPTION]... PATTERNS [FILE]...\nTry \'grep --help\' for more information.', 2);
            patterns = ops.shift().split('\n');
        }
        const extended = opts.E || opts.P || mode === 'E';
        const fixed = opts.F || mode === 'F';
        let regexes;
        try {
            regexes = patterns.map((p) => {
                if (opts.P) {
                    let src = p;
                    if (opts.w) src = '\\b(?:' + src + ')\\b';
                    if (opts.x) src = '^(?:' + src + ')$';
                    return new RegExp(src, opts.i ? 'i' : '');
                }
                return buildRegex(p, { extended, fixed, ignoreCase: opts.i, word: opts.w, line: opts.x });
            });
        } catch (e) {
            return ctx.fail('Unmatched ( or \\(', 2);
        }
        const colorOpt = opts.color === undefined ? 'auto' : opts.color === true ? 'auto' : opts.color;
        const color = colorOpt === 'always' || (colorOpt === 'auto' && ctx.tty);
        const fs = ctx.fs;
        let files = [];
        const recursive = opts.r || opts.R;
        if (!ops.length) files = recursive ? ['.'] : ['-'];
        else files = ops;
        const expanded = [];
        for (const f of files) {
            if (f === '-') { expanded.push({ name: '(standard input)', stdin: true }); continue; }
            const p = ctx.resolve(f);
            let node;
            try { node = fs.get(p); } catch (e) { node = null; }
            if (!node) { if (!opts.s) ctx.err('grep: ' + f + ': No such file or directory\n'); expanded.push({ missing: true }); continue; }
            if (node.type === 'dir') {
                if (!recursive) { if (!opts.s) ctx.err('grep: ' + f + ': Is a directory\n'); continue; }
                fs.walk(p, (n, path) => {
                    if (n.type !== 'file') return;
                    const rel = (f === '.' && !ops.length) ? path.slice(p.length + 1) : f.replace(/\/$/, '') + path.slice(p.length);
                    if (opts.include && !LA.shellUtil.globMatch(opts.include, VFS.basename(path))) return;
                    if (opts.exclude && LA.shellUtil.globMatch(opts.exclude, VFS.basename(path))) return;
                    if (opts.excludedir && rel.split('/').slice(0, -1).some((seg) => LA.shellUtil.globMatch(opts.excludedir, seg))) return;
                    expanded.push({ name: rel, path });
                });
            } else expanded.push({ name: f, path: p });
        }
        const showName = opts.H || (!opts.h && (expanded.filter((e) => !e.missing).length > 1 || recursive));
        let matchedAny = false;
        let errors = expanded.some((e) => e.missing);
        const after = parseInt(opts.A || opts.C || '0', 10);
        const before = parseInt(opts.B || opts.C || '0', 10);
        const maxCount = opts.m !== undefined ? parseInt(opts.m, 10) : Infinity;
        const C = U.C;
        const hl = (line) => {
            if (!color || opts.v) return line;
            let out = line;
            for (const re of regexes) {
                const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
                out = out.replace(g, (m) => (m ? '\x1b[01;31m\x1b[K' + m + '\x1b[m\x1b[K' : m));
            }
            return out;
        };
        const prefix = (name, num, sep) => {
            let s = '';
            if (showName) s += (color ? '\x1b[35m\x1b[K' + name + '\x1b[m\x1b[K\x1b[36m\x1b[K' + sep + '\x1b[m\x1b[K' : name + sep);
            if (opts.n) s += (color ? '\x1b[32m\x1b[K' + num + '\x1b[m\x1b[K\x1b[36m\x1b[K' + sep + '\x1b[m\x1b[K' : num + sep);
            return s;
        };
        for (const f of expanded) {
            if (f.missing) continue;
            let content;
            if (f.stdin) content = ctx.stdin.readAll();
            else {
                try { content = fs.readFile(f.path); }
                catch (e) { if (!opts.s) ctx.err('grep: ' + f.name + ': ' + e.message + '\n'); errors = true; continue; }
            }
            if (/\x00/.test(content) && !opts.a && !opts.z) {
                if (regexes.some((re) => re.test(content))) { if (!opts.q && !opts.c && !opts.l) ctx.outln('grep: ' + f.name + ': binary file matches'); matchedAny = true; }
                continue;
            }
            const lines = opts.z ? content.split('\0') : splitLines(content);
            let count = 0;
            let lastPrinted = -1;
            let pendingAfter = 0;
            const matches = lines.map((line) => regexes.some((re) => re.test(line)) !== !!opts.v);
            for (let i = 0; i < lines.length; i++) {
                if (count >= maxCount) {
                    if (pendingAfter > 0 && !matches[i]) { ctx.outln(prefix(f.name, i + 1, '-') + lines[i]); pendingAfter--; lastPrinted = i; continue; }
                    break;
                }
                if (matches[i]) {
                    count++;
                    matchedAny = true;
                    if (opts.q) return 0;
                    if (opts.l || opts.L || opts.c) continue;
                    if (opts.o && !opts.v) {
                        for (const re of regexes) {
                            const g = new RegExp(re.source, re.flags + 'g');
                            let m;
                            while ((m = g.exec(lines[i])) !== null) {
                                if (m[0] === '') { g.lastIndex++; continue; }
                                ctx.outln(prefix(f.name, i + 1, ':') + (opts.b ? m.index + ':' : '') + (color ? '\x1b[01;31m\x1b[K' + m[0] + '\x1b[m\x1b[K' : m[0]));
                            }
                        }
                        continue;
                    }
                    if (before || after) {
                        const start = Math.max(lastPrinted + 1, i - before);
                        if (lastPrinted >= 0 && start > lastPrinted + 1) ctx.outln(color ? '\x1b[36m\x1b[K--\x1b[m\x1b[K' : '--');
                        for (let k = start; k < i; k++) ctx.outln(prefix(f.name, k + 1, '-') + lines[k]);
                    }
                    ctx.outln(prefix(f.name, i + 1, ':') + hl(lines[i]));
                    lastPrinted = i;
                    pendingAfter = after;
                } else if (pendingAfter > 0 && !opts.l && !opts.L && !opts.c) {
                    ctx.outln(prefix(f.name, i + 1, '-') + lines[i]);
                    lastPrinted = i;
                    pendingAfter--;
                }
            }
            if (opts.c) ctx.outln((showName ? f.name + ':' : '') + count);
            if (opts.l && count) ctx.outln(color ? '\x1b[35m\x1b[K' + f.name + '\x1b[m\x1b[K' : f.name);
            if (opts.L && !count) ctx.outln(f.name);
        }
        if (opts.q) return matchedAny ? 0 : (errors ? 2 : 1);
        if (errors && !matchedAny) return 2;
        if (opts.L) return matchedAny ? 1 : 0;
        return matchedAny ? 0 : 1;
    }
    R('grep', (ctx) => grepCmd(ctx, 'G'));
    R('egrep', (ctx) => grepCmd(ctx, 'E'));
    R('fgrep', (ctx) => grepCmd(ctx, 'F'));
    R('rg', (ctx) => { ctx.args = ['-rn'].concat(ctx.args); return grepCmd(ctx, 'E'); }, { pkg: 'ripgrep' });

    // ---------- sed ----------
    function parseSedScript(script, extended) {
        const cmds = [];
        let i = 0;
        const n = script.length;
        const skipWs = () => { while (i < n && /[ \t]/.test(script[i])) i++; };
        const readDelimited = (delim) => {
            let s = '';
            while (i < n && script[i] !== delim) {
                if (script[i] === '\\' && i + 1 < n) {
                    if (script[i + 1] === delim) { s += delim === '/' ? '\\/' : delim; i += 2; continue; }
                    if (script[i + 1] === 'n') { s += '\\n'; i += 2; continue; }
                    s += script[i] + script[i + 1]; i += 2; continue;
                }
                if (script[i] === '\n') throw new Error('unterminated `s\' command');
                s += script[i++];
            }
            if (i >= n) throw new Error("unterminated `s' command");
            i++;
            return s;
        };
        const readAddr = () => {
            skipWs();
            if (script[i] === '$') { i++; return { type: 'last' }; }
            let m = /^(\d+)(~(\d+))?/.exec(script.slice(i));
            if (m) { i += m[0].length; return m[2] ? { type: 'step', first: +m[1], step: +m[3] } : { type: 'line', n: +m[1] }; }
            if (script[i] === '/' || script[i] === '\\') {
                let delim = '/';
                if (script[i] === '\\') { i++; delim = script[i]; }
                i++;
                const re = readDelimited(delim);
                let flags = '';
                while (script[i] === 'I' || script[i] === 'M') { if (script[i] === 'I') flags += 'i'; i++; }
                return { type: 're', re: re === '' ? null : U.buildRegex(re, { extended }), flags };
            }
            return null;
        };
        while (i < n) {
            skipWs();
            while (i < n && (script[i] === ';' || script[i] === '\n' || script[i] === ' ')) i++;
            if (i >= n) break;
            if (script[i] === '}') { cmds.push({ cmd: '}' }); i++; continue; }
            const a1 = readAddr();
            let a2 = null;
            skipWs();
            if (a1 && script[i] === ',') {
                i++;
                const m = /^\+(\d+)/.exec(script.slice(i));
                if (m) { i += m[0].length; a2 = { type: 'rel', n: +m[1] }; }
                else a2 = readAddr();
            }
            skipWs();
            let negate = false;
            if (script[i] === '!') { negate = true; i++; skipWs(); }
            const c = script[i++];
            const cmd = { a1, a2, negate, cmd: c };
            switch (c) {
                case 's': {
                    const delim = script[i++];
                    const re = readDelimited(delim);
                    const rep = readDelimited(delim);
                    let flags = '';
                    while (i < n && /[gpiIe0-9mMw]/.test(script[i])) {
                        if (script[i] === 'w') { i++; skipWs(); let f = ''; while (i < n && script[i] !== '\n' && script[i] !== ';') f += script[i++]; cmd.wfile = f.trim(); break; }
                        flags += script[i++];
                    }
                    cmd.re = re;
                    cmd.rep = rep;
                    cmd.flags = flags;
                    break;
                }
                case 'y': {
                    const delim = script[i++];
                    cmd.from = readDelimited(delim).replace(/\\n/g, '\n');
                    cmd.to = readDelimited(delim).replace(/\\n/g, '\n');
                    if (cmd.from.length !== cmd.to.length) throw new Error("strings for `y' command are different lengths");
                    break;
                }
                case 'a': case 'i': case 'c': {
                    if (script[i] === '\\') { i++; if (script[i] === '\n') i++; }
                    skipWs();
                    let text = '';
                    while (i < n && script[i] !== '\n') {
                        if (script[i] === '\\' && script[i + 1] === '\n') { text += '\n'; i += 2; continue; }
                        if (script[i] === '\\' && i + 1 < n) { text += script[i + 1] === 't' ? '\t' : script[i + 1]; i += 2; continue; }
                        text += script[i++];
                    }
                    cmd.text = text;
                    break;
                }
                case 'r': case 'w': {
                    skipWs();
                    let f = '';
                    while (i < n && script[i] !== '\n' && script[i] !== ';') f += script[i++];
                    cmd.file = f.trim();
                    break;
                }
                case 'q': case 'Q': case 'l': case '=': case 'd': case 'D': case 'p': case 'P': case 'n': case 'N': case 'g': case 'G': case 'h': case 'H': case 'x': case '{': case 'z':
                    if ((c === 'q' || c === 'Q')) { const m = /^\s*(\d+)/.exec(script.slice(i)); if (m) { cmd.code = +m[1]; i += m[0].length; } }
                    break;
                case 'b': case 't': case 'T': case ':': {
                    skipWs();
                    let label = '';
                    while (i < n && script[i] !== '\n' && script[i] !== ';') label += script[i++];
                    cmd.label = label.trim();
                    break;
                }
                case '#': while (i < n && script[i] !== '\n') i++; continue;
                default:
                    throw new Error('-e expression #1, char ' + i + ": unknown command: `" + c + "'");
            }
            cmds.push(cmd);
        }
        // compile regexes for s
        for (const c of cmds) {
            if (c.cmd === 's') {
                const g = c.flags.includes('g');
                const ci = c.flags.includes('i') || c.flags.includes('I');
                c.regex = U.buildRegex(c.re, { extended, ignoreCase: ci, global: true });
                c.global = g;
                const nm = /(\d+)/.exec(c.flags);
                c.nth = nm ? parseInt(nm[1], 10) : 1;
                c.print = c.flags.includes('p');
            }
        }
        // resolve blocks and labels
        const stack = [];
        cmds.forEach((c, idx) => {
            if (c.cmd === '{') stack.push(idx);
            else if (c.cmd === '}') { const open = stack.pop(); if (open === undefined) throw new Error("unexpected `}'"); cmds[open].end = idx; }
        });
        if (stack.length) throw new Error("unmatched `{'");
        return cmds;
    }
    function sedReplacement(rep, m) {
        let out = '';
        let caseMode = null, oneShot = null;
        const apply = (s) => {
            if (oneShot) { const f = oneShot; oneShot = null; s = (f === 'u' ? s.charAt(0).toUpperCase() : s.charAt(0).toLowerCase()) + s.slice(1); }
            if (caseMode === 'U') return s.toUpperCase();
            if (caseMode === 'L') return s.toLowerCase();
            return s;
        };
        for (let i = 0; i < rep.length; i++) {
            const c = rep[i];
            if (c === '\\' && i + 1 < rep.length) {
                const d = rep[++i];
                if (/\d/.test(d)) out += apply(m[+d] || '');
                else if (d === 'n') out += '\n';
                else if (d === 't') out += '\t';
                else if (d === '&') out += '&';
                else if (d === 'U' || d === 'L') caseMode = d;
                else if (d === 'E') caseMode = null;
                else if (d === 'u' || d === 'l') oneShot = d;
                else out += d;
                continue;
            }
            if (c === '&') { out += apply(m[0]); continue; }
            out += apply(c);
        }
        return out;
    }
    R('sed', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'nEriszu', args: 'ef', multi: ['e', 'f'], long: { quiet: 'n', silent: 'n', 'regexp-extended': 'E', 'in-place': 'i?', expression: 'e=', file: 'f=', separate: 's', 'null-data': 'z' } });
        if (error) return usageError(ctx, error);
        const ops = operands.slice();
        let script;
        if (opts.e || opts.f) {
            const parts = [];
            if (opts.e) parts.push(...opts.e);
            if (opts.f) for (const f of opts.f) parts.push(ctx.fs.readFile(ctx.resolve(f)));
            script = parts.join('\n');
        } else {
            if (!ops.length) return ctx.fail('Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...', 1);
            script = ops.shift();
        }
        // handle -i given as bundled e.g. -i.bak
        let inPlace = opts.i;
        let suffix = typeof inPlace === 'string' ? inPlace : '';
        let cmds;
        try { cmds = parseSedScript(script, opts.E || opts.r); }
        catch (e) { return ctx.fail('-e expression #1, char ' + script.length + ': ' + e.message, 1); }
        const quiet = !!opts.n || /^#n\n/.test(script);
        const fs = ctx.fs;
        let exitCode = 0;
        const runStream = (text, outFn, isLastFile) => {
            const lines = splitLines(text);
            const trailingNl = text.endsWith('\n') || text === '';
            let hold = '';
            let quit = false;
            const rangeActive = new Map();
            let lastSub = false;
            for (let ln = 0; ln < lines.length && !quit; ln++) {
                let ps = lines[ln];
                let lineNo = ln + 1;
                const isLast = () => ln === lines.length - 1 && isLastFile;
                let appendQueue = [];
                let deleted = false;
                let autoPrint = !quiet;
                const matchAddr = (a) => {
                    if (!a) return true;
                    if (a.type === 'line') return lineNo === a.n;
                    if (a.type === 'last') return isLast();
                    if (a.type === 'step') return a.step ? lineNo >= a.first && (lineNo - a.first) % a.step === 0 : lineNo === a.first;
                    if (a.type === 're') return a.re ? a.re.test(ps) : false;
                    return false;
                };
                const selected = (c, idx) => {
                    let r;
                    if (!c.a1) r = true;
                    else if (!c.a2) r = matchAddr(c.a1);
                    else {
                        const st = rangeActive.get(idx);
                        if (st) {
                            let end = false;
                            if (c.a2.type === 'line') end = lineNo >= c.a2.n;
                            else if (c.a2.type === 'rel') end = lineNo >= st.start + c.a2.n;
                            else end = matchAddr(c.a2);
                            if (end) rangeActive.delete(idx);
                            r = true;
                        } else if (matchAddr(c.a1)) {
                            r = true;
                            const immediateEnd = (c.a2.type === 'line' && c.a2.n <= lineNo) || (c.a2.type === 'rel' && c.a2.n === 0);
                            if (!immediateEnd) rangeActive.set(idx, { start: lineNo });
                        } else r = false;
                    }
                    return c.negate ? !r : r;
                };
                let pc = 0;
                let restartCycle = false;
                while (pc < cmds.length) {
                    const c = cmds[pc];
                    if (c.cmd === '}') { pc++; continue; }
                    if (!selected(c, pc)) {
                        if (c.cmd === '{') { pc = c.end + 1; continue; }
                        pc++;
                        continue;
                    }
                    switch (c.cmd) {
                        case '{': break;
                        case 's': {
                            let count = 0;
                            let did = false;
                            const re = new RegExp(c.regex.source, c.regex.flags);
                            ps = ps.replace(re, (...m) => {
                                const groups = m.slice(0, -2).filter((x) => typeof x !== 'object' || x === undefined);
                                count++;
                                if (c.global ? count >= c.nth : count === c.nth) { did = true; return sedReplacement(c.rep, groups); }
                                return groups[0];
                            });
                            if (did) {
                                lastSub = true;
                                if (c.print) outFn(ps + '\n');
                                if (c.wfile) { try { fs.writeFile(ctx.resolve(c.wfile), ps + '\n', { append: true }); } catch (e) { /* ignore */ } }
                            }
                            break;
                        }
                        case 'y': {
                            let s = '';
                            for (const ch of ps) { const k = c.from.indexOf(ch); s += k === -1 ? ch : c.to[k]; }
                            ps = s;
                            break;
                        }
                        case 'p': outFn(ps + '\n'); break;
                        case 'P': outFn(ps.split('\n')[0] + '\n'); break;
                        case 'd': deleted = true; pc = cmds.length; continue;
                        case 'D': {
                            const nl = ps.indexOf('\n');
                            if (nl === -1) { deleted = true; pc = cmds.length; continue; }
                            ps = ps.slice(nl + 1);
                            restartCycle = true; pc = 0; continue;
                        }
                        case 'n':
                            if (autoPrint) outFn(ps + '\n');
                            if (ln + 1 < lines.length) { ln++; lineNo = ln + 1; ps = lines[ln]; }
                            else { quit = true; autoPrint = false; pc = cmds.length; continue; }
                            break;
                        case 'N':
                            if (ln + 1 < lines.length) { ln++; lineNo = ln + 1; ps += '\n' + lines[ln]; }
                            else { quit = true; pc = cmds.length; continue; }
                            break;
                        case 'a': appendQueue.push(c.text + '\n'); break;
                        case 'i': outFn(c.text + '\n'); break;
                        case 'c':
                            if (!c.a2 || !rangeActive.has(pc)) outFn(c.text + '\n');
                            deleted = true; pc = cmds.length; continue;
                        case '=': outFn(lineNo + '\n'); break;
                        case 'l': outFn(ps.replace(/\\/g, '\\\\').replace(/\t/g, '\\t') + '$\n'); break;
                        case 'r': try { appendQueue.push(fs.readFile(ctx.resolve(c.file))); } catch (e) { /* missing file ignored */ } break;
                        case 'w': try { fs.writeFile(ctx.resolve(c.file), ps + '\n', { append: true }); } catch (e) { /* ignore */ } break;
                        case 'h': hold = ps; break;
                        case 'H': hold += '\n' + ps; break;
                        case 'g': ps = hold; break;
                        case 'G': ps += '\n' + hold; break;
                        case 'x': { const t = ps; ps = hold; hold = t; break; }
                        case 'z': ps = ''; break;
                        case 'q': quit = true; exitCode = c.code || 0; pc = cmds.length; continue;
                        case 'Q': quit = true; exitCode = c.code || 0; autoPrint = false; pc = cmds.length; continue;
                        case ':': break;
                        case 'b': case 't': case 'T': {
                            const jump = c.cmd === 'b' || (c.cmd === 't' && lastSub) || (c.cmd === 'T' && !lastSub);
                            if (c.cmd !== 'b') lastSub = false;
                            if (jump) {
                                if (!c.label) { pc = cmds.length; continue; }
                                const target = cmds.findIndex((x) => x.cmd === ':' && x.label === c.label);
                                if (target === -1) throw new Error("can't find label for jump to `" + c.label + "'");
                                pc = target + 1;
                                continue;
                            }
                            break;
                        }
                    }
                    pc++;
                }
                void restartCycle;
                if (!deleted && autoPrint) outFn(ps + (ln < lines.length - 1 || trailingNl || !isLastFile ? '\n' : ''));
                for (const a of appendQueue) outFn(a);
                lastSub = false;
            }
            return quit;
        };
        if (inPlace) {
            if (!ops.length) return ctx.fail('no input files', 1);
            for (const f of ops) {
                const p = ctx.resolve(f);
                let text;
                try { text = fs.readFile(p); } catch (e) { ctx.err("sed: can't read " + f + ': ' + e.message + '\n'); exitCode = 2; continue; }
                let out = '';
                try { runStream(text, (s) => { out += s; }, true); }
                catch (e) { return ctx.fail('-e expression #1: ' + e.message, 1); }
                if (suffix) fs.writeFile(p + suffix, text);
                fs.writeFile(p, out);
            }
            return exitCode;
        }
        const inputs = readInputs(ctx, ops);
        if (opts.s) {
            for (const inp of inputs) { if (runStream(inp.content, (s) => ctx.out(s), true)) break; }
        } else {
            const all = inputs.map((x) => (x.content === '' || x.content.endsWith('\n') ? x.content : x.content + '\n')).join('');
            const last = inputs.length ? inputs[inputs.length - 1].content : '';
            const text = last.endsWith('\n') || last === '' ? all : all.slice(0, -1);
            try { runStream(text, (s) => ctx.out(s), true); }
            catch (e) { return ctx.fail('-e expression #1: ' + e.message, 1); }
        }
        return inputs.failed ? 2 : exitCode;
    });

    // ---------- sort ----------
    function parseHumanNum(s) {
        const m = /^\s*(-?[\d.]+)\s*([KMGTPE]?)/i.exec(s);
        if (!m) return 0;
        return parseFloat(m[1]) * Math.pow(1024, ' KMGTPE'.indexOf((m[2] || ' ').toUpperCase()));
    }
    function leadingNum(s) {
        const m = /^\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/.exec(s);
        return m ? parseFloat(m[1]) : 0;
    }
    function versionCmp(a, b) {
        const re = /(\d+|\D+)/g;
        const pa = a.match(re) || [], pb = b.match(re) || [];
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const x = pa[i], y = pb[i];
            if (x === undefined) return -1;
            if (y === undefined) return 1;
            if (/^\d/.test(x) && /^\d/.test(y)) { const d = parseInt(x, 10) - parseInt(y, 10); if (d) return d; }
            else if (x !== y) return x < y ? -1 : 1;
        }
        return 0;
    }
    const MONTH_IDX = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    R('sort', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, {
            flags: 'rnufbhVRMdgcsC', args: 'ktoS', multi: ['k'],
            long: { reverse: 'r', 'numeric-sort': 'n', unique: 'u', 'ignore-case': 'f', 'human-numeric-sort': 'h', 'version-sort': 'V', 'random-sort': 'R', 'month-sort': 'M', key: 'k=', 'field-separator': 't=', output: 'o=', check: 'c', stable: 's', 'general-numeric-sort': 'g', 'ignore-leading-blanks': 'b', 'dictionary-order': 'd' }
        });
        if (error) return usageError(ctx, error);
        const inputs = readInputs(ctx, operands);
        if (inputs.failed) return 2;
        let lines = [];
        for (const inp of inputs) lines.push(...splitLines(inp.content));
        const collate = LA.makeCollator(ctx.sh);
        const sep = opts.t;
        const splitFields = (line) => {
            if (sep !== undefined) return line.split(sep);
            // fields include leading blanks
            const f = [];
            const re = /\s*\S+/g;
            let m;
            while ((m = re.exec(line)) !== null) f.push(m[0]);
            return f.length ? f : [''];
        };
        const keys = (opts.k || []).map((k) => {
            const m = /^(\d+)(?:\.(\d+))?([a-zA-Z]*)(?:,(\d+)(?:\.(\d+))?([a-zA-Z]*))?$/.exec(k);
            if (!m) throw new Error('invalid key');
            return { start: +m[1], startChar: m[2] ? +m[2] : 0, end: m[4] ? +m[4] : null, endChar: m[5] ? +m[5] : 0, flags: (m[3] || '') + (m[6] || '') };
        });
        const keyText = (line, k) => {
            const f = splitFields(line);
            const end = k.end || f.length;
            let parts = f.slice(k.start - 1, end);
            let s = parts.join(sep !== undefined ? sep : '');
            if (k.startChar) s = s.slice(k.startChar - 1);
            if (k.flags.includes('b') || opts.b || (sep === undefined)) s = s.replace(/^\s+/, '');
            return s;
        };
        const cmpWith = (a, b, flags) => {
            const has = (c) => flags.includes(c) || (!/[nhVMgRf]/.test(flags) && opts[c]);
            if (has('n')) { const d = leadingNum(a) - leadingNum(b); if (d) return d; return 0; }
            if (has('g')) { const d = (parseFloat(a) || 0) - (parseFloat(b) || 0); if (d) return d; return 0; }
            if (has('h')) { const d = parseHumanNum(a) - parseHumanNum(b); if (d) return d; return 0; }
            if (has('V')) return versionCmp(a, b);
            if (has('M')) { const d = (MONTH_IDX[a.trim().slice(0, 3).toLowerCase()] || 0) - (MONTH_IDX[b.trim().slice(0, 3).toLowerCase()] || 0); if (d) return d; return 0; }
            if (has('d')) { a = a.replace(/[^A-Za-z0-9\s]/g, ''); b = b.replace(/[^A-Za-z0-9\s]/g, ''); }
            if (has('f')) { a = a.toLowerCase(); b = b.toLowerCase(); }
            return collate(a, b);
        };
        const globalFlags = ['n', 'h', 'V', 'M', 'g', 'f', 'd'].filter((c) => opts[c]).join('');
        const compare = (a, b) => {
            if (keys.length) {
                for (const k of keys) {
                    const flags = k.flags.replace(/[rb]/g, '') || globalFlags;
                    let d = cmpWith(keyText(a, k), keyText(b, k), flags);
                    if (k.flags.includes('r')) d = -d;
                    if (d) return d;
                }
                if (opts.s || opts.u) return 0;
                return collate(a, b);
            }
            const d = cmpWith(a, b, globalFlags);
            if (d || opts.s) return d;
            if (opts.u && globalFlags) return 0;
            return globalFlags ? collate(a, b) : 0;
        };
        if (opts.c || opts.C) {
            for (let i = 1; i < lines.length; i++) {
                const d = compare(lines[i - 1], lines[i]) * (opts.r ? -1 : 1);
                if (d > 0 || (opts.u && d === 0)) { if (!opts.C) ctx.err('sort: -:' + (i + 1) + ': disorder: ' + lines[i] + '\n'); return 1; }
            }
            return 0;
        }
        if (opts.R) {
            const seed = U.hashString(String(Date.now()));
            const rnd = U.mulberry32(seed);
            const hashes = new Map();
            lines.forEach((l) => { if (!hashes.has(l)) hashes.set(l, rnd()); });
            lines.sort((a, b) => hashes.get(a) - hashes.get(b));
        } else {
            lines = lines.map((l, i) => ({ l, i })).sort((x, y) => {
                let d = compare(x.l, y.l);
                if (opts.r) d = -d;
                return d || x.i - y.i;
            }).map((x) => x.l);
        }
        if (opts.u) {
            const out = [];
            for (const l of lines) if (!out.length || compare(out[out.length - 1], l) !== 0) out.push(l);
            lines = out;
        }
        const text = joinLines(lines);
        if (opts.o) ctx.fs.writeFile(ctx.resolve(opts.o), text);
        else ctx.out(text);
        return 0;
    });

    R('uniq', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'cdDuiz', args: 'fsw', long: { count: 'c', repeated: 'd', 'all-repeated': 'D', unique: 'u', 'ignore-case': 'i', 'skip-fields': 'f=', 'skip-chars': 's=', 'check-chars': 'w=' } });
        if (error) return usageError(ctx, error);
        const inputs = readInputs(ctx, operands.slice(0, 1));
        if (inputs.failed) return 1;
        const lines = splitLines(inputs[0].content);
        const key = (l) => {
            let s = l;
            if (opts.f) s = s.replace(new RegExp('^(\\s*\\S+){' + parseInt(opts.f, 10) + '}'), '');
            if (opts.s) s = s.slice(parseInt(opts.s, 10));
            if (opts.w) s = s.slice(0, parseInt(opts.w, 10));
            return opts.i ? s.toLowerCase() : s;
        };
        const groups = [];
        for (const l of lines) {
            const last = groups[groups.length - 1];
            if (last && key(last.lines[0]) === key(l)) last.lines.push(l);
            else groups.push({ lines: [l] });
        }
        let out = '';
        for (const g of groups) {
            const c = g.lines.length;
            if (opts.d && c < 2) continue;
            if (opts.u && c > 1) continue;
            if (opts.D) { if (c > 1) out += g.lines.join('\n') + '\n'; continue; }
            out += (opts.c ? String(c).padStart(7) + ' ' : '') + g.lines[0] + '\n';
        }
        if (operands[1]) ctx.fs.writeFile(ctx.resolve(operands[1]), out);
        else ctx.out(out);
        return 0;
    });

    R('wc', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'lwcmL', long: { lines: 'l', words: 'w', bytes: 'c', chars: 'm', 'max-line-length': 'L' } });
        if (error) return usageError(ctx, error);
        const inputs = readInputs(ctx, operands);
        const any = opts.l || opts.w || opts.c || opts.m || opts.L;
        const show = { l: any ? opts.l : true, w: any ? opts.w : true, m: opts.m, c: any ? opts.c : true, L: opts.L };
        const rows = [];
        const tot = { l: 0, w: 0, c: 0, m: 0, L: 0 };
        for (const inp of inputs) {
            const t = inp.content;
            const r = {
                l: (t.match(/\n/g) || []).length,
                w: (t.match(/\S+/g) || []).length,
                c: VFS.utf8Length(t),
                m: Array.from(t).length,
                L: Math.max(0, ...t.split('\n').map((x) => x.replace(/\t/g, '        ').length))
            };
            for (const k of Object.keys(tot)) tot[k] = k === 'L' ? Math.max(tot[k], r[k]) : tot[k] + r[k];
            rows.push({ r, name: inp.name === '-' && !operands.length ? '' : inp.name });
        }
        if (rows.length > 1) rows.push({ r: tot, name: 'total' });
        const order = ['l', 'w', 'm', 'c', 'L'].filter((k) => show[k]);
        const single = order.length === 1 && rows.length === 1;
        const fromStdin = !operands.length;
        let width = 1;
        if (!single) {
            const maxV = Math.max(...rows.map((x) => Math.max(...order.map((k) => x.r[k]))));
            width = Math.max(String(maxV).length, fromStdin ? 7 : 1);
            if (!fromStdin && rows.length > 0) width = Math.max(width, String(Math.max(...rows.map((x) => x.r.c))).length);
        }
        for (const row of rows) {
            const nums = order.map((k) => String(row.r[k]).padStart(width));
            ctx.outln(nums.join(' ') + (row.name ? ' ' + row.name : ''));
        }
        return inputs.failed ? 1 : 0;
    });

    function headTail(ctx, isTail) {
        const args = ctx.args.map((a, i, arr) => {
            const prev = arr[i - 1];
            if (prev === '-n' || prev === '-c' || prev === '--lines' || prev === '--bytes') return a;
            return /^-\d+$/.test(a) ? '-n' + a.slice(1) : /^\+\d+$/.test(a) && isTail ? '-n+' + a.slice(1) : a;
        });
        const { opts, operands, error } = getopt(args, { flags: 'qvfFz', args: 'nc', long: { lines: 'n=', bytes: 'c=', quiet: 'q', silent: 'q', verbose: 'v', follow: 'f' } });
        if (error) return usageError(ctx, error);
        const inputs = readInputs(ctx, operands);
        const multi = (inputs.length > 1 && !opts.q) || opts.v;
        let first = true;
        for (const inp of inputs) {
            if (multi) { ctx.out((first ? '' : '\n') + '==> ' + (inp.name === '-' ? 'standard input' : inp.name) + ' <==\n'); }
            first = false;
            const t = inp.content;
            if (opts.c !== undefined) {
                const spec = String(opts.c);
                const n = parseInt(spec.replace(/^[+-]/, ''), 10) * (/[kK]$/.test(spec) ? 1024 : 1);
                if (isTail) ctx.out(spec.startsWith('+') ? t.slice(n - 1) : t.slice(-n || t.length));
                else ctx.out(spec.startsWith('-') ? t.slice(0, Math.max(0, t.length - n)) : t.slice(0, n));
                continue;
            }
            const spec = opts.n !== undefined ? String(opts.n) : '10';
            if (!/^[+-]?\d+$/.test(spec)) return ctx.fail("invalid number of lines: '" + spec + "'");
            const n = parseInt(spec.replace(/^[+-]/, ''), 10);
            const lines = t.split('\n');
            const endsNl = t.endsWith('\n');
            if (endsNl) lines.pop();
            let sel;
            if (isTail) sel = spec.startsWith('+') ? lines.slice(Math.max(0, n - 1)) : (n === 0 ? [] : lines.slice(-n));
            else sel = spec.startsWith('-') ? lines.slice(0, Math.max(0, lines.length - n)) : lines.slice(0, n);
            if (!sel.length) continue;
            const includesLast = isTail ? true : sel.length === lines.length;
            ctx.out(sel.join('\n') + (includesLast && !endsNl ? '' : '\n'));
        }
        return inputs.failed ? 1 : 0;
    }
    R('head', (ctx) => headTail(ctx, false));
    R('tail', (ctx) => headTail(ctx, true));

    // ---------- cut ----------
    function parseRanges(spec) {
        const ranges = [];
        for (const part of spec.split(',')) {
            const m = /^(\d*)(-?)(\d*)$/.exec(part);
            if (!m || (!m[1] && !m[3])) throw new Error('invalid field range');
            const a = m[1] ? parseInt(m[1], 10) : 1;
            const b = m[2] ? (m[3] ? parseInt(m[3], 10) : Infinity) : a;
            if (a === 0) throw new Error('fields and positions are numbered from 1');
            ranges.push([a, b]);
        }
        return ranges;
    }
    R('cut', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'snz', args: 'dfcb', long: { delimiter: 'd=', fields: 'f=', characters: 'c=', bytes: 'b=', 'only-delimited': 's', complement: 'complement', 'output-delimiter': 'od=' } });
        if (error) return usageError(ctx, error);
        if (!opts.f && !opts.c && !opts.b) return usageError(ctx, 'you must specify a list of bytes, characters, or fields');
        let ranges;
        try { ranges = parseRanges(opts.f || opts.c || opts.b); } catch (e) { return usageError(ctx, e.message); }
        const inRange = (i) => { const r = ranges.some(([a, b]) => i >= a && i <= b); return opts.complement ? !r : r; };
        const delim = opts.d !== undefined ? opts.d : '\t';
        if (opts.f && delim.length !== 1) return usageError(ctx, 'the delimiter must be a single character');
        const outDelim = opts.od !== undefined ? opts.od : delim;
        const inputs = readInputs(ctx, operands);
        for (const inp of inputs) {
            for (const line of splitLines(inp.content)) {
                if (opts.f) {
                    if (!line.includes(delim)) { if (!opts.s) ctx.outln(line); continue; }
                    const fields = line.split(delim);
                    ctx.outln(fields.filter((_, i) => inRange(i + 1)).join(outDelim));
                } else {
                    const chars = Array.from(line);
                    ctx.outln(chars.filter((_, i) => inRange(i + 1)).join(opts.od !== undefined ? '' : ''));
                }
            }
        }
        return inputs.failed ? 1 : 0;
    });

    // ---------- tr ----------
    function expandTrSet(s) {
        const out = [];
        let i = 0;
        const classes = {
            alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', digit: '0123456789', alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', space: ' \t\n\r\v\f', blank: ' \t', punct: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
            xdigit: '0123456789ABCDEFabcdef', cntrl: Array.from({ length: 32 }, (_, k) => String.fromCharCode(k)).join('') + '\x7f'
        };
        const readChar = () => {
            if (s[i] === '\\' && i + 1 < s.length) {
                const d = s[i + 1];
                i += 2;
                const esc = { n: '\n', t: '\t', r: '\r', '\\': '\\', a: '\x07', b: '\b', f: '\f', v: '\v' }[d];
                if (esc !== undefined) return esc;
                if (/[0-7]/.test(d)) { let o = d; while (o.length < 3 && /[0-7]/.test(s[i])) o += s[i++]; return String.fromCharCode(parseInt(o, 8)); }
                return d;
            }
            return s[i++];
        };
        while (i < s.length) {
            if (s[i] === '[' && s[i + 1] === ':') {
                const e = s.indexOf(':]', i);
                if (e !== -1 && classes[s.slice(i + 2, e)]) { out.push(...classes[s.slice(i + 2, e)]); i = e + 2; continue; }
            }
            if (s[i] === '[' && /^\[.\*\d*\]/.test(s.slice(i))) {
                const m = /^\[(.)\*(\d*)\]/.exec(s.slice(i));
                out.push({ repeat: m[1], count: m[2] ? parseInt(m[2], 10) : 0 });
                i += m[0].length;
                continue;
            }
            const c = readChar();
            if (s[i] === '-' && i + 1 < s.length) {
                i++;
                const e = readChar();
                for (let k = c.charCodeAt(0); k <= e.charCodeAt(0); k++) out.push(String.fromCharCode(k));
                continue;
            }
            out.push(c);
        }
        return out;
    }
    R('tr', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'cCdst', long: { complement: 'c', delete: 'd', 'squeeze-repeats': 's', truncate: 't' } });
        if (error) return usageError(ctx, error);
        if (!operands.length) return usageError(ctx, 'missing operand');
        const complement = opts.c || opts.C;
        let set1 = expandTrSet(operands[0]).filter((x) => typeof x === 'string');
        let set2raw = operands[1] !== undefined ? expandTrSet(operands[1]) : [];
        const input = ctx.stdin.readAll();
        const inSet1 = (ch) => (complement ? !set1.includes(ch) : set1.includes(ch));
        let set2 = [];
        for (const x of set2raw) {
            if (typeof x === 'string') set2.push(x);
            else { const cnt = x.count || Math.max(0, set1.length - set2raw.filter((y) => typeof y === 'string').length); for (let k = 0; k < cnt; k++) set2.push(x.repeat); }
        }
        let out = '';
        if (opts.d) {
            for (const ch of input) if (!inSet1(ch)) out += ch;
            if (opts.s && set2.length) out = squeeze(out, (ch) => set2.includes(ch));
            ctx.out(out);
            return 0;
        }
        if (!set2.length) {
            if (opts.s) { ctx.out(squeeze(input, inSet1)); return 0; }
            return usageError(ctx, "missing operand after '" + operands[0] + "'\nTwo strings must be given when translating.");
        }
        if (opts.t) set1 = set1.slice(0, set2.length);
        const last = set2[set2.length - 1];
        for (const ch of input) {
            if (complement) { out += set1.includes(ch) ? ch : last; continue; }
            const k = set1.lastIndexOf(ch);
            out += k === -1 ? ch : (k < set2.length ? set2[k] : last);
        }
        if (opts.s) out = squeeze(out, (ch) => set2.includes(ch));
        ctx.out(out);
        return 0;
        function squeeze(s, pred) {
            let r = '';
            for (const ch of s) { if (r.length && r[r.length - 1] === ch && pred(ch)) continue; r += ch; }
            return r;
        }
    });

    R('rev', (ctx) => {
        const inputs = readInputs(ctx, ctx.args);
        for (const inp of inputs) for (const l of splitLines(inp.content)) ctx.outln(Array.from(l).reverse().join(''));
        return inputs.failed ? 1 : 0;
    });

    R('nl', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'p', args: 'bswvinh', long: { 'body-numbering': 'b=', 'number-separator': 's=', 'number-width': 'w=' } });
        const style = opts.b || 't';
        const sep = opts.s !== undefined ? opts.s : '\t';
        const width = opts.w ? parseInt(opts.w, 10) : 6;
        let n = opts.v ? parseInt(opts.v, 10) : 1;
        const inc = opts.i ? parseInt(opts.i, 10) : 1;
        const inputs = readInputs(ctx, operands);
        for (const inp of inputs) {
            for (const l of splitLines(inp.content)) {
                const number = style === 'a' || (style === 't' && l.trim() !== '') || (style.startsWith('p') && new RegExp(style.slice(1)).test(l));
                if (number) {
                    let num = String(n);
                    if (opts.n === 'rz') num = num.padStart(width, '0');
                    else if (opts.n === 'ln') num = num.padEnd(width);
                    else num = num.padStart(width);
                    ctx.outln(num + sep + l);
                    n += inc;
                } else ctx.outln(' '.repeat(width) + (style === 'a' ? sep : ' ') + l);
            }
        }
        return 0;
    });

    R('tee', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'ai', long: { append: 'a' } });
        const input = ctx.stdin.readAll();
        let status = 0;
        for (const f of operands) {
            try { ctx.fs.writeFile(ctx.resolve(f), input, { append: !!opts.a }); }
            catch (e) { ctx.err('tee: ' + f + ': ' + e.message + '\n'); status = 1; }
        }
        ctx.out(input);
        return status;
    });

    R('paste', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'sz', args: 'd', long: { delimiters: 'd=', serial: 's' } });
        const delims = opts.d !== undefined ? LA.shellUtil.unescapeC(opts.d) || '' : '\t';
        const files = operands.length ? operands : ['-'];
        let stdinUsed = null;
        const contents = files.map((f) => {
            if (f === '-') { if (stdinUsed === null) stdinUsed = splitLines(ctx.stdin.readAll()); return stdinUsed; }
            try { return splitLines(ctx.fs.readFile(ctx.resolve(f))); }
            catch (e) { ctx.err('paste: ' + f + ': ' + e.message + '\n'); return []; }
        });
        const d = (i) => (delims.length ? delims[i % delims.length] : '');
        if (opts.s) {
            for (const c of contents) ctx.outln(c.reduce((acc, l, i) => (i ? acc + d(i - 1) + l : l), ''));
            return 0;
        }
        if (files.filter((f) => f === '-').length > 1) {
            // paste - - : consume stdin lines round robin
            const lines = stdinUsed || [];
            const per = files.length;
            for (let i = 0; i < lines.length; i += per) {
                let row = '';
                for (let k = 0; k < per; k++) row += (k ? d(k - 1) : '') + (lines[i + k] !== undefined ? lines[i + k] : '');
                ctx.outln(row);
            }
            return 0;
        }
        const max = Math.max(0, ...contents.map((c) => c.length));
        for (let i = 0; i < max; i++) {
            let row = '';
            contents.forEach((c, k) => { row += (k ? d(k - 1) : '') + (c[i] !== undefined ? c[i] : ''); });
            ctx.outln(row);
        }
        return 0;
    });

    R('comm', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: '123i' });
        if (operands.length !== 2) return usageError(ctx, operands.length ? "missing operand after '" + operands[0] + "'" : 'missing operand');
        const read = (f) => (f === '-' ? splitLines(ctx.stdin.readAll()) : splitLines(ctx.fs.readFile(ctx.resolve(f))));
        let a, b;
        try { a = read(operands[0]); b = read(operands[1]); } catch (e) { return ctx.fail(e.message); }
        let i = 0, j = 0;
        const col = (n, s) => {
            if (opts[String(n)]) return;
            let pre = '';
            for (let k = 1; k < n; k++) if (!opts[String(k)]) pre += '\t';
            ctx.outln(pre + s);
        };
        const cmp = (x, y) => (opts.i ? x.toLowerCase().localeCompare(y.toLowerCase()) : x < y ? -1 : x > y ? 1 : 0);
        while (i < a.length || j < b.length) {
            if (j >= b.length || (i < a.length && cmp(a[i], b[j]) < 0)) col(1, a[i++]);
            else if (i >= a.length || cmp(a[i], b[j]) > 0) col(2, b[j++]);
            else { col(3, a[i]); i++; j++; }
        }
        return 0;
    });

    // ---------- diff ----------
    function lcsDiff(a, b) {
        const n = a.length, m = b.length;
        const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        const ops = [];
        let i = 0, j = 0;
        while (i < n && j < m) {
            if (a[i] === b[j]) { ops.push({ t: '=', a: i, b: j }); i++; j++; }
            else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: '-', a: i }); i++; }
            else { ops.push({ t: '+', b: j }); j++; }
        }
        while (i < n) ops.push({ t: '-', a: i++ });
        while (j < m) ops.push({ t: '+', b: j++ });
        // compaction: slide change runs upward so adjacent hunks merge (like GNU diff)
        let changed = true;
        while (changed) {
            changed = false;
            for (let k = 1; k < ops.length; k++) {
                if (ops[k].t === '=' ) continue;
                const t = ops[k].t;
                let e = k;
                while (e + 1 < ops.length && ops[e + 1].t === t) e++;
                const before = ops[k - 1];
                if (before.t === '=' && k - 2 >= 0 && ops[k - 2].t !== '=') {
                    const seqA = t === '-' ? a : b;
                    const key = t === '-' ? 'a' : 'b';
                    if (seqA[before[key]] === seqA[ops[e][key]]) {
                        // shift the run up by one: the '=' moves to the end of the run
                        const runIdx = ops.slice(k, e + 1).map((o) => o[key]);
                        const eq = { t: '=', a: before.a + (t === '-' ? runIdx.length : 0), b: before.b + (t === '+' ? runIdx.length : 0) };
                        const newRun = [before[key]].concat(runIdx.slice(0, -1)).map((x) => (t === '-' ? { t, a: x } : { t, b: x }));
                        ops.splice(k - 1, e - k + 2, ...newRun, eq);
                        changed = true;
                        break;
                    }
                }
                k = e;
            }
        }
        return ops;
    }
    function hunks(ops) {
        const out = [];
        let cur = null;
        ops.forEach((o, idx) => {
            if (o.t === '=') { if (cur) { out.push(cur); cur = null; } return; }
            if (!cur) cur = { start: idx, del: [], add: [] };
            if (o.t === '-') cur.del.push(o.a); else cur.add.push(o.b);
            cur.end = idx;
        });
        if (cur) out.push(cur);
        return out;
    }
    R('diff', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'uqsiwBrNyc', args: 'U', long: { unified: 'U?', brief: 'q', 'ignore-case': 'i', 'ignore-all-space': 'w', 'side-by-side': 'y', recursive: 'r', color: 'color?', 'report-identical-files': 's' } });
        if (error) return usageError(ctx, error);
        if (operands.length !== 2) return ctx.fail(operands.length ? "missing operand after '" + operands[0] + "'" : 'missing operand', 2);
        const fs = ctx.fs;
        const read = (f) => {
            if (f === '-') return ctx.stdin.readAll();
            const p = ctx.resolve(f);
            const n = fs.get(p);
            if (!n) throw new Error(f + ': No such file or directory');
            if (n.type === 'dir') return { dir: p };
            return fs.readFile(p);
        };
        let A, B;
        try { A = read(operands[0]); B = read(operands[1]); } catch (e) { return ctx.fail(e.message, 2); }
        if (typeof A === 'object' || typeof B === 'object') {
            if (typeof A === 'object' && typeof B === 'object') {
                const la = fs.list(A.dir), lb = fs.list(B.dir);
                let differ = 0;
                for (const nm of Array.from(new Set(la.concat(lb))).sort()) {
                    if (!la.includes(nm)) { ctx.outln('Only in ' + operands[1] + ': ' + nm); differ = 1; continue; }
                    if (!lb.includes(nm)) { ctx.outln('Only in ' + operands[0] + ': ' + nm); differ = 1; continue; }
                    const na = fs.get(A.dir + '/' + nm), nb = fs.get(B.dir + '/' + nm);
                    if (na.type === 'file' && nb.type === 'file' && na.content !== nb.content) { ctx.outln('diff ' + operands[0] + '/' + nm + ' ' + operands[1] + '/' + nm); differ = 1; }
                }
                return differ;
            }
            const dirSide = typeof A === 'object' ? A.dir : B.dir;
            const fileName = typeof A === 'object' ? operands[1] : operands[0];
            const inner = dirSide + '/' + VFS.basename(fileName);
            if (!fs.isFile(inner)) return ctx.fail(inner + ': No such file or directory', 2);
            if (typeof A === 'object') A = fs.readFile(inner); else B = fs.readFile(inner);
        }
        const norm = (l) => { if (opts.i) l = l.toLowerCase(); if (opts.w) l = l.replace(/\s+/g, ''); return l; };
        const la = splitLines(A), lb = splitLines(B);
        const na = la.map(norm), nb = lb.map(norm);
        const ops = lcsDiff(na, nb);
        const hs = hunks(ops);
        if (!hs.length) { if (opts.s) ctx.outln('Files ' + operands[0] + ' and ' + operands[1] + ' are identical'); return 0; }
        if (opts.q) { ctx.outln('Files ' + operands[0] + ' and ' + operands[1] + ' differ'); return 1; }
        const color = opts.color === 'always' || (opts.color !== undefined && opts.color !== 'never' && ctx.tty);
        const red = (s) => (color ? '\x1b[31m' + s + '\x1b[0m' : s), green = (s) => (color ? '\x1b[32m' + s + '\x1b[0m' : s), cyan = (s) => (color ? '\x1b[36m' + s + '\x1b[0m' : s);
        if (opts.y) {
            const w = 30;
            for (const o of ops) {
                if (o.t === '=') ctx.outln(la[o.a].slice(0, w).padEnd(w) + '   ' + lb[o.b]);
                else if (o.t === '-') ctx.outln(la[o.a].slice(0, w).padEnd(w) + ' < ');
                else ctx.outln(''.padEnd(w) + ' > ' + lb[o.b]);
            }
            return 1;
        }
        if (opts.u !== undefined || opts.U !== undefined) {
            const ctxN = opts.U !== undefined && opts.U !== true ? parseInt(opts.U, 10) : 3;
            ctx.outln(color ? '\x1b[1m--- ' + operands[0] + '\x1b[0m' : '--- ' + operands[0]);
            ctx.outln(color ? '\x1b[1m+++ ' + operands[1] + '\x1b[0m' : '+++ ' + operands[1]);
            // group hunks with context
            let k = 0;
            while (k < hs.length) {
                let startOp = Math.max(0, hs[k].start - ctxN);
                let endOp = Math.min(ops.length - 1, hs[k].end + ctxN);
                let j = k;
                while (j + 1 < hs.length && hs[j + 1].start - ctxN <= endOp + 1) { j++; endOp = Math.min(ops.length - 1, hs[j].end + ctxN); }
                const slice = ops.slice(startOp, endOp + 1);
                const aStart = slice.find((o) => o.a !== undefined);
                const bStart = slice.find((o) => o.b !== undefined);
                const aCount = slice.filter((o) => o.t !== '+').length;
                const bCount = slice.filter((o) => o.t !== '-').length;
                const aS = aStart ? aStart.a + 1 : 0, bS = bStart ? bStart.b + 1 : 0;
                ctx.outln(cyan('@@ -' + (aCount === 1 ? aS : aS + ',' + aCount) + ' +' + (bCount === 1 ? bS : bS + ',' + bCount) + ' @@'));
                for (const o of slice) {
                    if (o.t === '=') ctx.outln(' ' + la[o.a]);
                    else if (o.t === '-') ctx.outln(red('-' + la[o.a]));
                    else ctx.outln(green('+' + lb[o.b]));
                }
                k = j + 1;
            }
            return 1;
        }
        const range = (arr) => (arr.length === 1 ? String(arr[0] + 1) : (arr[0] + 1) + ',' + (arr[arr.length - 1] + 1));
        for (const h of hs) {
            // compute anchor lines
            const before = ops.slice(0, h.start);
            const aBefore = before.filter((o) => o.t !== '+').length;
            const bBefore = before.filter((o) => o.t !== '-').length;
            if (h.del.length && h.add.length) ctx.outln(range(h.del) + 'c' + range(h.add));
            else if (h.del.length) ctx.outln(range(h.del) + 'd' + bBefore);
            else ctx.outln(aBefore + 'a' + range(h.add));
            for (const i of h.del) ctx.outln(red('< ' + la[i]));
            if (h.del.length && h.add.length) ctx.outln('---');
            for (const j of h.add) ctx.outln(green('> ' + lb[j]));
        }
        return 1;
    });
    R('cmp', (ctx) => {
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        const silent = ctx.args.includes('-s');
        if (ops.length < 2) return usageError(ctx, 'missing operand');
        let a, b;
        try { a = ctx.fs.readFile(ctx.resolve(ops[0])); b = ctx.fs.readFile(ctx.resolve(ops[1])); } catch (e) { return ctx.fail(e.message, 2); }
        if (a === b) return 0;
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        if (!silent) {
            if (i >= a.length || i >= b.length) ctx.err('cmp: EOF on ' + (i >= a.length ? ops[0] : ops[1]) + ' after byte ' + i + '\n');
            else ctx.outln(ops[0] + ' ' + ops[1] + ' differ: byte ' + (i + 1) + ', line ' + (a.slice(0, i).split('\n').length));
        }
        return 1;
    });

    R('column', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'tnex', args: 'sco', long: { table: 't', separator: 's=', 'output-separator': 'o=' } });
        const inputs = readInputs(ctx, operands);
        const lines = [];
        for (const i of inputs) lines.push(...splitLines(i.content));
        if (opts.t) {
            const sep = opts.s;
            const rows = lines.filter((l) => l.trim() !== '').map((l) => (sep ? l.split(new RegExp('[' + LA.shellUtil.escapeRe(sep) + ']+')) : l.trim().split(/\s+/)));
            const widths = [];
            for (const r of rows) r.forEach((c, k) => { widths[k] = Math.max(widths[k] || 0, c.length); });
            const osep = opts.o !== undefined ? opts.o : '  ';
            for (const r of rows) ctx.outln(r.map((c, k) => (k === r.length - 1 ? c : c.padEnd(widths[k]))).join(osep));
            return 0;
        }
        ctx.out(U.columnize(lines.filter((l) => l !== ''), opts.c ? parseInt(opts.c, 10) : ctx.sh.columns));
        return 0;
    });

    R('fold', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'sb', args: 'w', long: { width: 'w=', spaces: 's' } });
        const w = opts.w ? parseInt(opts.w, 10) : 80;
        const inputs = readInputs(ctx, operands);
        for (const i of inputs) {
            for (const line of splitLines(i.content)) {
                let l = line;
                if (!l.length) { ctx.outln(''); continue; }
                while (l.length > w) {
                    let cut = w;
                    if (opts.s) { const sp = l.lastIndexOf(' ', w - 1); if (sp > 0) cut = sp + 1; }
                    ctx.outln(l.slice(0, cut));
                    l = l.slice(cut);
                }
                ctx.outln(l);
            }
        }
        return 0;
    });
    R('fmt', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { args: 'w', flags: 'su', long: { width: 'w=' } });
        const w = opts.w ? parseInt(opts.w, 10) : 75;
        const inputs = readInputs(ctx, operands);
        const text = inputs.map((i) => i.content).join('');
        for (const para of text.split(/\n\s*\n/)) {
            const words = para.split(/\s+/).filter(Boolean);
            let line = '';
            for (const word of words) {
                if (line && (line + ' ' + word).length > w) { ctx.outln(line); line = word; }
                else line = line ? line + ' ' + word : word;
            }
            if (line) ctx.outln(line);
            if (para !== text.split(/\n\s*\n/).slice(-1)[0]) ctx.outln('');
        }
        return 0;
    });
    R('expand', (ctx) => {
        const t = ctx.args.includes('-t') ? parseInt(ctx.args[ctx.args.indexOf('-t') + 1], 10) : 8;
        const inputs = readInputs(ctx, ctx.args.filter((a, i) => !a.startsWith('-') && ctx.args[i - 1] !== '-t'));
        for (const i of inputs) for (const l of splitLines(i.content)) {
            let out = '';
            for (const ch of l) { if (ch === '\t') { const n = t - (out.length % t); out += ' '.repeat(n); } else out += ch; }
            ctx.outln(out);
        }
        return 0;
    });
    R('unexpand', (ctx) => {
        const inputs = readInputs(ctx, ctx.args.filter((a) => !a.startsWith('-')));
        for (const i of inputs) for (const l of splitLines(i.content)) ctx.outln(l.replace(/^( {8})+/, (m) => '\t'.repeat(m.length / 8)));
        return 0;
    });

    // ---------- generators ----------
    R('seq', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'w', args: 'sf', negativeNumbers: true, long: { separator: 's=', 'equal-width': 'w', format: 'f=' } });
        if (error) return usageError(ctx, error);
        if (!operands.length) return usageError(ctx, 'missing operand');
        for (const o of operands) if (isNaN(parseFloat(o))) return usageError(ctx, "invalid floating point argument: '" + o + "'");
        let first = 1, inc = 1, last;
        if (operands.length === 1) last = parseFloat(operands[0]);
        else if (operands.length === 2) { first = parseFloat(operands[0]); last = parseFloat(operands[1]); }
        else { first = parseFloat(operands[0]); inc = parseFloat(operands[1]); last = parseFloat(operands[2]); }
        if (inc === 0) return ctx.fail("invalid Zero increment value: '0'");
        const decimals = Math.max(...operands.map((o) => (o.includes('.') ? o.split('.')[1].length : 0)));
        const sep = opts.s !== undefined ? LA.shellUtil.unescapeC(opts.s) : '\n';
        const vals = [];
        for (let k = 0, v = first; inc > 0 ? v <= last + 1e-9 : v >= last - 1e-9; k++, v = first + k * inc) {
            if (vals.length > 100000) break;
            vals.push(v);
        }
        const width = opts.w ? Math.max(...vals.map((v) => v.toFixed(decimals).length)) : 0;
        const fmt = (v) => {
            if (opts.f) return formatPrintf(opts.f, [v]);
            let s = v.toFixed(decimals);
            if (width) { const neg = s.startsWith('-'); s = (neg ? '-' : '') + s.replace('-', '').padStart(width - (neg ? 1 : 0), '0'); }
            return s;
        };
        if (vals.length) ctx.out(vals.map(fmt).join(sep) + '\n');
        return 0;
    });

    R('yes', (ctx) => {
        const s = ctx.args.length ? ctx.args.join(' ') : 'y';
        // bounded: a real `yes` never ends, the sandbox stops after 1000 lines
        ctx.out((s + '\n').repeat(ctx.io.piped ? 10000 : 1000));
        return 0;
    });

    R('shuf', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'er', args: 'niz', long: { 'head-count': 'n=', 'input-range': 'i=', echo: 'e', repeat: 'r' } });
        let items;
        if (opts.e) items = operands.slice();
        else if (opts.i) { const [a, b] = opts.i.split('-').map(Number); items = []; for (let k = a; k <= b && items.length < 100000; k++) items.push(String(k)); }
        else { const inputs = readInputs(ctx, operands.slice(0, 1)); items = splitLines(inputs[0] ? inputs[0].content : ''); }
        for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
        if (opts.n) items = items.slice(0, parseInt(opts.n, 10));
        ctx.out(joinLines(items));
        return 0;
    });

    // ---------- xargs ----------
    R('xargs', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: '0rtpx', args: 'nIdLP', stopAtFirst: true, long: { 'max-args': 'n=', null: '0', 'no-run-if-empty': 'r', verbose: 't', delimiter: 'd=', 'replace': 'I=' } });
        if (error) return usageError(ctx, error);
        const cmd = operands.length ? operands : ['echo'];
        const input = ctx.stdin.readAll();
        let items;
        if (opts['0']) items = input.split('\0').filter((x) => x !== '');
        else if (opts.d !== undefined) items = input.split(LA.shellUtil.unescapeC(opts.d)).filter((x, i, arr) => !(i === arr.length - 1 && x.replace(/\n$/, '') === ''));
        else if (opts.I || opts.L) items = splitLines(input).filter((l) => l.trim() !== '');
        else {
            items = [];
            const re = /"([^"]*)"|'([^']*)'|((?:\\.|[^\s'"])+)/g;
            let m;
            while ((m = re.exec(input)) !== null) items.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3].replace(/\\(.)/g, '$1'));
        }
        if (!items.length && (opts.r || opts.I)) return 0;
        let status = 0;
        const run = (argv) => {
            if (opts.t) ctx.err(argv.join(' ') + '\n');
            const c = ctx.exec(argv);
            if (c === 127) { status = 127; return false; }
            if (c !== 0) status = 123;
            return true;
        };
        if (opts.I) {
            for (const it of items) if (!run(cmd.map((a) => a.split(opts.I).join(it.trim())))) break;
            return status;
        }
        const n = opts.n ? parseInt(opts.n, 10) : opts.L ? parseInt(opts.L, 10) : items.length || 1;
        if (!items.length) { run(cmd); return status; }
        for (let i = 0; i < items.length; i += n) if (!run(cmd.concat(items.slice(i, i + n)))) break;
        return status;
    });

    // ---------- pagers ----------
    function pager(ctx) {
        const { operands } = getopt(ctx.args, { flags: 'NRSFXrsiEemq', long: {} });
        const inputs = readInputs(ctx, operands);
        if (inputs.failed && !inputs.length) return 1;
        const text = inputs.map((i) => i.content).join('');
        if (ctx.tty && ctx.sh.ui && ctx.sh.ui.openPager) {
            ctx.sh.ui.openPager({ text, title: operands[0] || '', numbers: ctx.args.includes('-N') });
            return inputs.failed ? 1 : 0;
        }
        ctx.out(text);
        return inputs.failed ? 1 : 0;
    }
    R('less', pager);
    R('more', pager);
    R('most', pager, { hidden: true });
    R('pg', pager, { hidden: true });

    // ---------- calculators ----------
    function bcEval(src, state) {
        state.vars = state.vars || {};
        state.scale = state.scale || 0;
        const out = [];
        const stmts = src.split(/[\n;]/);
        for (let stmt of stmts) {
            stmt = stmt.replace(/#.*$/, '').trim();
            if (!stmt || stmt === 'quit') continue;
            let m;
            if ((m = /^scale\s*=\s*(\d+)$/.exec(stmt))) { state.scale = parseInt(m[1], 10); continue; }
            if ((m = /^([a-z_][a-z0-9_]*)\s*=\s*(.+)$/.exec(stmt)) && m[1] !== 'scale') { state.vars[m[1]] = evalExpr(m[2]); continue; }
            if ((m = /^print\s+(.*)$/.exec(stmt))) { out.push(m[1].replace(/^"|"$/g, '').replace(/\\n/g, '\n')); continue; }
            const v = evalExpr(stmt);
            out.push(fmt(v));
        }
        return out.join('\n') + (out.length ? '\n' : '');
        function fmt(v) {
            if (state.scale === 0) return String(Math.trunc(v));
            let s = v.toFixed(state.scale);
            if (Math.abs(v) < 1 && v !== 0) s = s.replace(/^(-?)0\./, '$1.');
            return s;
        }
        function evalExpr(e) {
            let i = 0;
            const toks = e.match(/\d*\.\d+|\d+|[a-z_][a-z0-9_]*\(|[a-z_][a-z0-9_]*|\*\*|\^|[-+*/%()]|,|<=|>=|==|!=|<|>/g) || [];
            const peek = () => toks[i];
            const next = () => toks[i++];
            function primary() {
                const t = next();
                if (t === undefined) throw new Error('syntax error');
                if (t === '(') { const v = add(); next(); return v; }
                if (t === '-') return -power();
                if (/^[a-z_][a-z0-9_]*\($/.test(t)) {
                    const fn = t.slice(0, -1);
                    const arg = add(); next();
                    const fns = { sqrt: Math.sqrt, s: Math.sin, c: Math.cos, a: Math.atan, l: Math.log, e: Math.exp, length: (x) => String(Math.trunc(Math.abs(x))).length };
                    if (!fns[fn]) throw new Error('undefined function ' + fn);
                    return fns[fn](arg);
                }
                if (/^[a-z_]/.test(t)) return t === 'scale' ? state.scale : (state.vars[t] || 0);
                return parseFloat(t);
            }
            function power() {
                const b = primary();
                if (peek() === '^' || peek() === '**') { next(); return Math.pow(b, power()); }
                return b;
            }
            function mul() {
                let v = power();
                while (peek() === '*' || peek() === '/' || peek() === '%') {
                    const op = next(); const r = power();
                    if (op === '*') v *= r;
                    else if (op === '/') { if (r === 0) throw new Error('Runtime error (func=(main), adr=5): Divide by zero'); v = v / r; if (state.scale === 0) v = Math.trunc(v); else v = Math.trunc(v * Math.pow(10, state.scale)) / Math.pow(10, state.scale); }
                    else v = v % r;
                }
                return v;
            }
            function add() {
                let v = mul();
                while (peek() === '+' || peek() === '-') { const op = next(); const r = mul(); v = op === '+' ? v + r : v - r; }
                while (['<', '>', '<=', '>=', '==', '!='].includes(peek())) {
                    const op = next(); const r = mul();
                    v = { '<': v < r, '>': v > r, '<=': v <= r, '>=': v >= r, '==': v === r, '!=': v !== r }[op] ? 1 : 0;
                }
                return v;
            }
            return add();
        }
    }
    R('bc', (ctx) => {
        const mathlib = ctx.args.includes('-l');
        const files = ctx.args.filter((a) => !a.startsWith('-'));
        const src = files.length ? readInputs(ctx, files).map((i) => i.content).join('\n') : ctx.stdin.readAll();
        const state = { scale: mathlib ? 20 : 0 };
        try { ctx.out(bcEval(src, state)); }
        catch (e) { ctx.err('(standard_in) 1: ' + e.message + '\n'); return 1; }
        return 0;
    });

    R('expr', (ctx) => {
        const a = ctx.args;
        let i = 0;
        const isInt = (s) => /^-?\d+$/.test(s);
        function primary() {
            const t = a[i++];
            if (t === '(') { const v = orE(); i++; return v; }
            if (t === 'length') return String(a[i++].length);
            if (t === 'substr') { const s = a[i++], p = +a[i++], l = +a[i++]; return s.substr(p - 1, l); }
            if (t === 'index') { const s = a[i++], chars = a[i++]; let r = 0; for (let k = 0; k < s.length; k++) if (chars.includes(s[k])) { r = k + 1; break; } return String(r); }
            if (t === 'match') { const s = a[i++], re = a[i++]; const m = new RegExp('^' + U.posixToJs(re, false)).exec(s); return m ? (m[1] !== undefined ? m[1] : String(m[0].length)) : '0'; }
            if (t === undefined) throw new Error('syntax error: missing argument after ‘' + a[i - 2] + '’');
            return t;
        }
        function matchE() {
            let v = primary();
            while (a[i] === ':') { i++; const re = a[i++]; const m = new RegExp('^' + U.posixToJs(re, false)).exec(v); v = m ? (m[1] !== undefined ? m[1] : String(m[0].length)) : (/\\\(/.test(re) ? '' : '0'); }
            return v;
        }
        function mulE() {
            let v = matchE();
            while (['*', '/', '%'].includes(a[i])) {
                const op = a[i++]; const r = matchE();
                if (!isInt(v) || !isInt(r)) throw new Error('non-integer argument');
                if ((op === '/' || op === '%') && +r === 0) throw new Error('division by zero');
                v = String(op === '*' ? +v * +r : op === '/' ? Math.trunc(+v / +r) : +v % +r);
            }
            return v;
        }
        function addE() {
            let v = mulE();
            while (a[i] === '+' || a[i] === '-') {
                const op = a[i++]; const r = mulE();
                if (!isInt(v) || !isInt(r)) throw new Error('non-integer argument');
                v = String(op === '+' ? +v + +r : +v - +r);
            }
            return v;
        }
        function cmpE() {
            let v = addE();
            while (['<', '<=', '=', '==', '!=', '>=', '>'].includes(a[i])) {
                const op = a[i++]; const r = addE();
                const x = isInt(v) && isInt(r) ? +v : v, y = isInt(v) && isInt(r) ? +r : r;
                v = ({ '<': x < y, '<=': x <= y, '=': x === y, '==': x === y, '!=': x !== y, '>=': x >= y, '>': x > y }[op]) ? '1' : '0';
            }
            return v;
        }
        function andE() { let v = cmpE(); while (a[i] === '&') { i++; const r = cmpE(); v = (v !== '' && v !== '0' && r !== '' && r !== '0') ? v : '0'; } return v; }
        function orE() { let v = andE(); while (a[i] === '|') { i++; const r = andE(); v = (v !== '' && v !== '0') ? v : (r !== '' && r !== '0' ? r : '0'); } return v; }
        if (!a.length) return ctx.fail('missing operand', 2);
        let v;
        try { v = orE(); if (i < a.length) throw new Error("syntax error: unexpected argument ‘" + a[i] + "’"); }
        catch (e) { return ctx.fail(e.message, 2); }
        ctx.outln(v);
        return v === '' || v === '0' ? 1 : 0;
    });

    R('factor', (ctx) => {
        const nums = ctx.args.length ? ctx.args : splitLines(ctx.stdin.readAll()).join(' ').split(/\s+/).filter(Boolean);
        for (const s of nums) {
            if (!/^\d+$/.test(s)) { ctx.err("factor: ‘" + s + "’ is not a valid positive integer\n"); continue; }
            let n = parseInt(s, 10);
            const f = [];
            for (let p = 2; p * p <= n; p++) while (n % p === 0) { f.push(p); n /= p; }
            if (n > 1) f.push(n);
            ctx.outln(s + ':' + (f.length ? ' ' + f.join(' ') : ''));
        }
        return 0;
    });

    // ---------- date & cal ----------
    R('date', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'uIR', args: 'dr', long: { date: 'd=', utc: 'u', universal: 'u', 'iso-8601': 'I', rfc: 'R', reference: 'r=', 'rfc-email': 'R' } });
        if (error) return usageError(ctx, error);
        let d = new Date();
        if (opts.d) {
            const t = LA.parseDateString(opts.d);
            if (t === null) return ctx.fail("invalid date ‘" + opts.d + "’");
            d = new Date(t);
        }
        if (opts.r) { const n = ctx.fs.get(ctx.resolve(opts.r)); if (!n) return ctx.fail(opts.r + ': No such file or directory'); d = new Date(n.mtime); }
        const fmtArg = operands.find((o) => o.startsWith('+'));
        if (operands.some((o) => !o.startsWith('+'))) {
            if (ctx.sh.user !== 'root') return ctx.fail('cannot set date: Operation not permitted');
            return 0;
        }
        if (fmtArg) ctx.outln(U.strftime(fmtArg.slice(1), d));
        else if (opts.I) ctx.outln(U.strftime('%F', d));
        else if (opts.R) ctx.outln(U.strftime('%a, %d %b %Y %T %z', d));
        else ctx.outln(U.defaultDate(d));
        return 0;
    });

    R('cal', (ctx) => {
        const nums = ctx.args.filter((a) => /^\d+$/.test(a)).map(Number);
        const now = new Date();
        let month = now.getMonth(), year = now.getFullYear();
        const showYear = nums.length === 1 && !ctx.args.includes('-m');
        if (nums.length === 2) { month = nums[0] - 1; year = nums[1]; }
        else if (nums.length === 1) year = nums[0];
        const render = (m, y, highlight) => {
            const lines = [];
            const title = U.FULL_MONTHS[m] + ' ' + y;
            lines.push(' '.repeat(Math.floor((20 - title.length) / 2)) + title);
            lines.push('Su Mo Tu We Th Fr Sa');
            const first = new Date(y, m, 1).getDay();
            const days = new Date(y, m + 1, 0).getDate();
            let line = '   '.repeat(first);
            for (let dd = 1; dd <= days; dd++) {
                let s = String(dd).padStart(2);
                if (highlight && dd === now.getDate() && m === now.getMonth() && y === now.getFullYear() && ctx.tty) s = '\x1b[7m' + s + '\x1b[27m';
                line += s;
                if ((first + dd) % 7 === 0) { lines.push(line); line = ''; } else line += ' ';
            }
            if (line.trim()) lines.push(line.trimEnd());
            while (lines.length < 8) lines.push('');
            return lines;
        };
        if (showYear) {
            ctx.outln(String(year).padStart(32));
            ctx.outln('');
            for (let q = 0; q < 12; q += 3) {
                const blocks = [render(q, year), render(q + 1, year), render(q + 2, year)].map((b) => b.map((l) => U.stripAnsi(l)));
                blocks.forEach((b) => { b[0] = b[0].replace(/\s*\d{4}$/, '').trim(); b[0] = ' '.repeat(Math.floor((20 - b[0].length) / 2)) + b[0]; });
                for (let r = 0; r < 8; r++) ctx.outln(blocks.map((b) => (b[r] || '').padEnd(20)).join('  ').trimEnd());
            }
            return 0;
        }
        for (const l of render(month, year, true)) ctx.outln(l.length ? l.padEnd(20) : '');
        return 0;
    });

    R('jq', (ctx) => {
        const args = ctx.args.filter((a) => !a.startsWith('-'));
        const raw = ctx.args.includes('-r');
        const compact = ctx.args.includes('-c');
        const filter = args[0] || '.';
        const inputs = readInputs(ctx, args.slice(1));
        for (const inp of inputs) {
            let data;
            try { data = JSON.parse(inp.content); } catch (e) { return ctx.fail('error (at <stdin>:1): Cannot parse JSON', 2); }
            let results;
            try { results = jqApply(filter, data); } catch (e) { return ctx.fail('error: ' + e.message, 5); }
            for (const r of results) {
                if (raw && typeof r === 'string') ctx.outln(r);
                else ctx.outln(compact ? JSON.stringify(r) : JSON.stringify(r, null, 2));
            }
        }
        return 0;
    }, { pkg: 'jq' });
    function jqApply(filter, data) {
        filter = filter.trim();
        if (filter.includes('|')) {
            const parts = filter.split('|');
            let cur = [data];
            for (const p of parts) cur = cur.flatMap((d) => jqApply(p, d));
            return cur;
        }
        if (filter === '.') return [data];
        if (filter === 'keys') return [Object.keys(data).sort()];
        if (filter === 'length') return [Array.isArray(data) || typeof data === 'string' ? data.length : Object.keys(data || {}).length];
        let cur = [data];
        const re = /\.([A-Za-z_][\w]*)|\[(\d*)\]|\.\[\]|\.(?=\[)/g;
        let m;
        let pos = 0;
        while ((m = re.exec(filter)) !== null) {
            if (m.index !== pos) throw new Error('syntax error in filter');
            pos = re.lastIndex;
            if (m[1] !== undefined) cur = cur.map((d) => (d == null ? null : d[m[1]]));
            else if (m[0] === '.[]' || m[2] === '') cur = cur.flatMap((d) => (Array.isArray(d) ? d : Object.values(d || {})));
            else if (m[2] !== undefined) cur = cur.map((d) => (Array.isArray(d) ? d[+m[2]] : null));
        }
        if (pos !== filter.length) throw new Error('syntax error in filter');
        return cur.map((x) => (x === undefined ? null : x));
    }
})();
