// Linux Arsenal - shell builtins
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const { getopt, usageError, formatPrintf, register } = LA.util;
    const { BreakSignal, ContinueSignal, ReturnSignal, ExitSignal } = LA.signals;
    const { quoteArg, unescapeC, globMatch, evalArith } = LA.shellUtil;
    const VFS = LA.VFS;

    const B = (name, fn, meta) => register(name, fn, Object.assign({ builtin: true }, meta || {}));

    B(':', () => 0);
    B('true', () => 0);
    B('false', () => 1);

    B('cd', (ctx) => {
        const sh = ctx.sh;
        let args = ctx.args.filter((a) => a !== '-L' && a !== '-P');
        if (args.length > 1) return ctx.fail('too many arguments');
        let target = args[0];
        let print = false;
        if (target === undefined || target === '') target = sh.home;
        else if (target === '-') { target = sh.getVar('OLDPWD') || sh.cwd; print = true; }
        let path = sh.resolve(target);
        // CDPATH support for relative names
        if (!target.startsWith('/') && !target.startsWith('.') && !sh.fs.exists(path) && sh.getVar('CDPATH')) {
            for (const d of sh.getVar('CDPATH').split(':')) {
                const cand = VFS.normalize(target, d || '.', sh.home);
                if (sh.fs.isDir(cand)) { path = cand; print = true; break; }
            }
        }
        let node;
        try { node = sh.fs.get(path); } catch (e) { return ctx.fail(target + ': ' + e.message); }
        if (!node) return ctx.fail(target + ': No such file or directory');
        if (node.type !== 'dir') return ctx.fail(target + ': Not a directory');
        if (!sh.fs.can(node, 'x')) return ctx.fail(target + ': Permission denied');
        sh.setVar('OLDPWD', sh.cwd);
        sh.cwd = path;
        sh.setVar('PWD', path);
        if (print) ctx.outln(path);
        return 0;
    });

    B('pwd', (ctx) => {
        if (ctx.args.includes('-P')) {
            try { ctx.outln(ctx.fs.realpath(ctx.sh.cwd)); return 0; } catch (e) { /* fall through */ }
        }
        ctx.outln(ctx.sh.cwd);
        return 0;
    });

    B('echo', (ctx) => {
        let args = ctx.args;
        let newline = true, escapes = false;
        while (args.length && /^-[neE]+$/.test(args[0])) {
            for (const c of args[0].slice(1)) {
                if (c === 'n') newline = false;
                if (c === 'e') escapes = true;
                if (c === 'E') escapes = false;
            }
            args = args.slice(1);
        }
        let s = args.join(' ');
        if (escapes) {
            const cut = s.indexOf('\\c');
            if (cut !== -1) { s = s.slice(0, cut); newline = false; }
            s = unescapeC(s.replace(/\\0([0-7]{1,3})/g, (m, o) => String.fromCharCode(parseInt(o, 8))));
        }
        ctx.out(s + (newline ? '\n' : ''));
        return 0;
    });

    B('printf', (ctx) => {
        let args = ctx.args.slice();
        let varName = null;
        if (args[0] === '-v') { varName = args[1]; args = args.slice(2); }
        if (args[0] === '--') args = args.slice(1);
        if (!args.length) return usageError(ctx, 'usage: printf [-v var] format [arguments]');
        let status = 0;
        const s = formatPrintf(args[0], args.slice(1), {
            escapes: true, repeat: true,
            onInvalid: (v) => { ctx.err('printf: ' + v + ': invalid number\n'); status = 1; }
        });
        if (varName) ctx.sh.setVar(varName, s); else ctx.out(s);
        return status;
    });

    B('export', (ctx) => {
        const sh = ctx.sh;
        let args = ctx.args;
        if (!args.length || args[0] === '-p') {
            const names = Array.from(sh.vars.keys()).filter((k) => sh.vars.get(k).exported).sort();
            for (const k of names) ctx.outln('declare -x ' + k + '="' + sh.vars.get(k).value.replace(/(["\\$`])/g, '\\$1') + '"');
            return 0;
        }
        let unexport = false;
        if (args[0] === '-n') { unexport = true; args = args.slice(1); }
        for (const a of args) {
            const eq = a.indexOf('=');
            if (eq === -1) {
                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(a)) { ctx.err("bash: export: `" + a + "': not a valid identifier\n"); return 1; }
                if (unexport) { const v = sh.vars.get(a); if (v) v.exported = false; }
                else sh.exportVar(a);
            } else {
                const name = a.slice(0, eq);
                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) { ctx.err("bash: export: `" + a + "': not a valid identifier\n"); return 1; }
                sh.setVar(name, a.slice(eq + 1), { exported: !unexport });
                if (!unexport) sh.vars.get(name).exported = true;
            }
        }
        return 0;
    });

    B('unset', (ctx) => {
        let args = ctx.args;
        let fn = false;
        if (args[0] === '-f') { fn = true; args = args.slice(1); }
        else if (args[0] === '-v') args = args.slice(1);
        for (const a of args) {
            if (fn) delete ctx.sh.functions[a];
            else if (ctx.sh.readonlyVars && ctx.sh.readonlyVars.has(a)) { ctx.err('bash: unset: ' + a + ': cannot unset: readonly variable\n'); return 1; }
            else { ctx.sh.unsetVar(a); if (!ctx.sh.vars.has(a)) delete ctx.sh.functions[a]; }
        }
        return 0;
    });

    B('readonly', (ctx) => {
        const sh = ctx.sh;
        sh.readonlyVars = sh.readonlyVars || new Set();
        if (!ctx.args.length || ctx.args[0] === '-p') {
            for (const k of Array.from(sh.readonlyVars).sort()) ctx.outln('declare -r ' + k + '="' + (sh.getVar(k) || '') + '"');
            return 0;
        }
        for (const a of ctx.args) {
            const eq = a.indexOf('=');
            const name = eq === -1 ? a : a.slice(0, eq);
            if (eq !== -1) sh.setVar(name, a.slice(eq + 1));
            sh.readonlyVars.add(name);
        }
        return 0;
    });

    function declare(ctx) {
        const sh = ctx.sh;
        let args = ctx.args.slice();
        const flags = new Set();
        while (args.length && /^[-+][a-zA-Z]+$/.test(args[0])) { for (const c of args[0].slice(1)) flags.add(c); args.shift(); }
        if (flags.has('f') || flags.has('F')) {
            const names = args.length ? args : Object.keys(sh.functions).sort();
            for (const nm of names) {
                if (!sh.functions[nm]) return 1;
                ctx.outln(flags.has('F') ? 'declare -f ' + nm : nm + ' () \n{ ... \n}');
            }
            return 0;
        }
        if (!args.length) {
            for (const k of Array.from(sh.vars.keys()).sort()) ctx.outln(k + '=' + quoteArg(sh.vars.get(k).value));
            return 0;
        }
        if (flags.has('p')) {
            for (const a of args) {
                const v = sh.vars.get(a);
                if (!v) { ctx.err('bash: declare: ' + a + ': not found\n'); return 1; }
                ctx.outln('declare ' + (v.exported ? '-x' : '--') + ' ' + a + '="' + v.value + '"');
            }
            return 0;
        }
        for (const a of args) {
            const eq = a.indexOf('=');
            const name = eq === -1 ? a : a.slice(0, eq);
            let value = eq === -1 ? (sh.getVar(name) || '') : a.slice(eq + 1);
            if (flags.has('i')) { try { value = String(evalArith(value || '0', sh)); } catch (e) { value = '0'; } }
            if (flags.has('l')) value = value.toLowerCase();
            if (flags.has('u')) value = value.toUpperCase();
            if (ctx.name === 'local' && sh.localStack.length) {
                const scope = sh.localStack[sh.localStack.length - 1];
                if (!scope.has(name)) scope.set(name, sh.vars.get(name) ? Object.assign({}, sh.vars.get(name)) : null);
            }
            sh.vars.set(name, { value, exported: flags.has('x') || (sh.vars.get(name) && sh.vars.get(name).exported) || false });
            if (flags.has('r')) { sh.readonlyVars = sh.readonlyVars || new Set(); sh.readonlyVars.add(name); }
        }
        return 0;
    }
    B('declare', declare);
    B('typeset', declare);
    B('local', (ctx) => {
        if (!ctx.sh.localStack.length) return ctx.fail('can only be used in a function');
        return declare(ctx);
    });

    B('set', (ctx) => {
        const sh = ctx.sh;
        const args = ctx.args;
        if (!args.length) {
            for (const k of Array.from(sh.vars.keys()).sort()) ctx.outln(k + '=' + quoteArg(sh.vars.get(k).value));
            return 0;
        }
        const optMap = { e: 'errexit', x: 'xtrace', u: 'nounset', C: 'noclobber', f: 'noglob' };
        for (let i = 0; i < args.length; i++) {
            const a = args[i];
            if (a === '--') { sh.positional = args.slice(i + 1); return 0; }
            if (a === '-o' || a === '+o') {
                const name = args[++i];
                if (!name) {
                    for (const k of ['errexit', 'noclobber', 'nounset', 'pipefail', 'xtrace']) ctx.outln(k.padEnd(15) + (sh.options[k] ? 'on' : 'off'));
                    return 0;
                }
                sh.options[name] = a === '-o';
                continue;
            }
            if (/^[-+][a-zA-Z]+$/.test(a)) {
                for (const c of a.slice(1)) { if (optMap[c]) sh.options[optMap[c]] = a[0] === '-'; }
                continue;
            }
            sh.positional = args.slice(i);
            return 0;
        }
        return 0;
    });

    B('shift', (ctx) => {
        const n = ctx.args.length ? parseInt(ctx.args[0], 10) : 1;
        if (isNaN(n) || n < 0) return ctx.fail(ctx.args[0] + ': numeric argument required');
        if (n > ctx.sh.positional.length) return 1;
        ctx.sh.positional = ctx.sh.positional.slice(n);
        return 0;
    });

    B('alias', (ctx) => {
        const sh = ctx.sh;
        let args = ctx.args.filter((a) => a !== '-p');
        if (!args.length) {
            for (const k of Object.keys(sh.aliases).sort()) ctx.outln('alias ' + k + "='" + sh.aliases[k].replace(/'/g, "'\\''") + "'");
            return 0;
        }
        let status = 0;
        for (const a of args) {
            const eq = a.indexOf('=');
            if (eq === -1) {
                if (sh.aliases[a] !== undefined) ctx.outln('alias ' + a + "='" + sh.aliases[a] + "'");
                else { ctx.err('bash: alias: ' + a + ': not found\n'); status = 1; }
            } else {
                const name = a.slice(0, eq);
                if (!/^[^\s\/$`=|&;()<>'"]+$/.test(name)) { ctx.err("bash: alias: `" + name + "': invalid alias name\n"); status = 1; continue; }
                sh.aliases[name] = a.slice(eq + 1);
            }
        }
        return status;
    });

    B('unalias', (ctx) => {
        if (ctx.args[0] === '-a') { ctx.sh.aliases = Object.create(null); return 0; }
        let status = 0;
        for (const a of ctx.args) {
            if (ctx.sh.aliases[a] === undefined) { ctx.err('bash: unalias: ' + a + ': not found\n'); status = 1; }
            else delete ctx.sh.aliases[a];
        }
        return status;
    });

    B('source', (ctx) => {
        if (!ctx.args.length) return ctx.fail('filename argument required\nsource: usage: source filename [arguments]', 2);
        try { return ctx.sh.source(ctx.args[0], ctx.args.slice(1), ctx.io); }
        catch (e) { if (e.code) return ctx.fail(ctx.args[0] + ': ' + e.message); throw e; }
    });
    LA.commands['.'] = LA.commands.source;

    B('eval', (ctx) => {
        const src = ctx.args.join(' ');
        if (!src.trim()) return 0;
        return ctx.run(src);
    });

    B('exec', (ctx) => {
        if (!ctx.args.length) return 0;
        const code = ctx.exec(ctx.args);
        throw new ExitSignal(code);
    });

    B('exit', (ctx) => {
        const sh = ctx.sh;
        const code = ctx.args.length ? (parseInt(ctx.args[0], 10) & 255) : sh.lastStatus;
        if (sh.userStack.length && !sh.inScript) {
            // leaving a su / sudo -i session
            const prev = sh.userStack.pop();
            sh.restoreUserSession(prev);
            if (ctx.tty) ctx.outln('logout');
            return code;
        }
        throw new ExitSignal(code);
    });
    LA.commands.logout = LA.commands.exit;

    B('return', (ctx) => {
        const code = ctx.args.length ? (parseInt(ctx.args[0], 10) & 255) : ctx.sh.lastStatus;
        throw new ReturnSignal(code);
    });
    B('break', (ctx) => { throw new BreakSignal(parseInt(ctx.args[0] || '1', 10) || 1); });
    B('continue', (ctx) => { throw new ContinueSignal(parseInt(ctx.args[0] || '1', 10) || 1); });

    B('read', (ctx) => {
        const sh = ctx.sh;
        const { opts, operands, error } = getopt(ctx.args, { flags: 'rse', args: 'pdnta', long: {} });
        if (error) return usageError(ctx, error);
        if (opts.p && ctx.io.ttyErr) ctx.io.ttyErr.write(opts.p);
        let line;
        if (opts.n) {
            const s = ctx.stdin.text.slice(ctx.stdin.pos, ctx.stdin.pos + parseInt(opts.n, 10));
            ctx.stdin.pos += s.length;
            line = s.length ? s : null;
        } else if (opts.d !== undefined) {
            const t = ctx.stdin.text, start = ctx.stdin.pos;
            if (start >= t.length) line = null;
            else {
                const e = t.indexOf(opts.d || '\0', start);
                line = e === -1 ? t.slice(start) : t.slice(start, e);
                ctx.stdin.pos = e === -1 ? t.length : e + 1;
            }
        } else {
            line = ctx.stdin.readLine();
            // backslash-newline continuation without -r
            while (line !== null && !opts.r && line.endsWith('\\')) {
                const nxt = ctx.stdin.readLine();
                line = line.slice(0, -1) + (nxt === null ? '' : nxt);
                if (nxt === null) break;
            }
        }
        const names = operands.length ? operands : ['REPLY'];
        if (line === null) { for (const nm of names) sh.setVar(nm, ''); return 1; }
        if (!opts.r) line = line.replace(/\\(.)/g, '$1');
        if (opts.a) {
            const ifsA = sh.getVar('IFS');
            const parts = line.split(new RegExp('[' + LA.shellUtil.escapeRe(ifsA === undefined ? ' \t\n' : ifsA) + ']+')).filter((x) => x !== '');
            sh.setArray(opts.a, parts);
            return 0;
        }
        if (names.length === 1 && names[0] === 'REPLY' && !operands.length) { sh.setVar('REPLY', line); return 0; }
        const ifs = sh.getVar('IFS');
        const ifsChars = ifs === undefined ? ' \t\n' : ifs;
        const ws = ifsChars.replace(/[^ \t\n]/g, '');
        const nonWs = ifsChars.replace(/[ \t\n]/g, '');
        let rest = line;
        if (ws) rest = rest.replace(new RegExp('^[' + ws.replace(/\t/, '\\t').replace(/\n/, '\\n') + ']+'), '');
        for (let k = 0; k < names.length; k++) {
            if (k === names.length - 1) {
                let v = rest;
                if (ws) v = v.replace(new RegExp('[' + ws.replace(/\t/, '\\t').replace(/\n/, '\\n') + ']+$'), '');
                sh.setVar(names[k], v);
                break;
            }
            let idx = -1;
            for (let j = 0; j < rest.length; j++) if (ifsChars.includes(rest[j])) { idx = j; break; }
            if (idx === -1) { sh.setVar(names[k], rest); rest = ''; continue; }
            sh.setVar(names[k], rest.slice(0, idx));
            rest = rest.slice(idx);
            // consume one non-ws delimiter plus surrounding whitespace
            let j = 0;
            while (j < rest.length && ws.includes(rest[j])) j++;
            if (j < rest.length && nonWs.includes(rest[j])) j++;
            while (j < rest.length && ws.includes(rest[j])) j++;
            rest = rest.slice(j);
        }
        return 0;
    });

    // ---------- test / [ ----------
    function testEval(args, ctx) {
        const fs = ctx.fs;
        let i = 0;
        const fileTest = (op, f) => {
            let node = null;
            try { node = fs.get(ctx.resolve(f), { follow: op !== '-L' && op !== '-h' }); } catch (e) { node = null; }
            switch (op) {
                case '-e': case '-a': return !!node;
                case '-f': return !!node && node.type === 'file';
                case '-d': return !!node && node.type === 'dir';
                case '-L': case '-h': return !!node && node.type === 'link';
                case '-r': return !!node && fs.can(node, 'r');
                case '-w': return !!node && fs.can(node, 'w');
                case '-x': return !!node && (node.type === 'dir' ? fs.can(node, 'x') : fs.can(node, 'x'));
                case '-s': return !!node && fs.size(node) > 0;
                case '-c': return !!node && node.type === 'dev';
                case '-b': case '-p': case '-S': return false;
                case '-u': return !!node && (node.mode & 0o4000) !== 0;
                case '-g': return !!node && (node.mode & 0o2000) !== 0;
                case '-k': return !!node && (node.mode & 0o1000) !== 0;
                case '-O': return !!node && node.owner === ctx.sh.user;
                case '-G': return !!node && fs.user.groups.includes(node.group);
            }
            return false;
        };
        const UNARY_FILE = ['-e', '-a', '-f', '-d', '-L', '-h', '-r', '-w', '-x', '-s', '-c', '-b', '-p', '-S', '-u', '-g', '-k', '-O', '-G'];
        const num = (s) => {
            if (!/^\s*-?\d+\s*$/.test(s)) throw new Error(s + ': integer expression expected');
            return parseInt(s, 10);
        };
        function primary() {
            const a = args[i];
            if (a === undefined) throw new Error('argument expected');
            if (a === '!') { i++; return !primary(); }
            if (a === '(') {
                i++;
                const v = orExpr();
                if (args[i] !== ')') throw new Error("')' expected");
                i++;
                return v;
            }
            const b = args[i + 1];
            // binary
            if (b !== undefined && args.length - i >= 3) {
                const c = args[i + 2];
                switch (b) {
                    case '=': case '==': i += 3; return ctx.doubleBracket ? globMatch(c, a) : a === c;
                    case '!=': i += 3; return ctx.doubleBracket ? !globMatch(c, a) : a !== c;
                    case '<': i += 3; return a < c;
                    case '>': i += 3; return a > c;
                    case '=~': i += 3; try { return new RegExp(c).test(a); } catch (e) { return false; }
                    case '-eq': i += 3; return num(a) === num(c);
                    case '-ne': i += 3; return num(a) !== num(c);
                    case '-lt': i += 3; return num(a) < num(c);
                    case '-le': i += 3; return num(a) <= num(c);
                    case '-gt': i += 3; return num(a) > num(c);
                    case '-ge': i += 3; return num(a) >= num(c);
                    case '-nt': case '-ot': {
                        i += 3;
                        const n1 = fs.get(ctx.resolve(a)), n2 = fs.get(ctx.resolve(c));
                        if (!n1 || !n2) return b === '-nt' ? !!n1 : !!n2;
                        return b === '-nt' ? n1.mtime > n2.mtime : n1.mtime < n2.mtime;
                    }
                    case '-ef': { i += 3; try { return fs.realpath(ctx.resolve(a)) === fs.realpath(ctx.resolve(c)); } catch (e) { return false; } }
                }
            }
            if (UNARY_FILE.includes(a) && b !== undefined) { i += 2; return fileTest(a, b); }
            if (a === '-z' && b !== undefined) { i += 2; return b === ''; }
            if (a === '-n' && b !== undefined) { i += 2; return b !== ''; }
            if (a === '-v' && b !== undefined) { i += 2; return ctx.sh.getVar(b) !== undefined; }
            if (a === '-t') { i += 2; return false; }
            i++;
            return a !== '';
        }
        function andExpr() {
            let v = primary();
            while (args[i] === '-a' || args[i] === '&&') { i++; const r = primary(); v = v && r; }
            return v;
        }
        function orExpr() {
            let v = andExpr();
            while (args[i] === '-o' || args[i] === '||') { i++; const r = andExpr(); v = v || r; }
            return v;
        }
        if (!args.length) return false;
        const v = orExpr();
        if (i < args.length) throw new Error(args[i] + ': unexpected argument');
        return v;
    }
    function testCmd(ctx) {
        let args = ctx.args.slice();
        if (ctx.name === '[') {
            if (args[args.length - 1] !== ']') return ctx.fail("missing `]'", 2);
            args.pop();
        }
        if (ctx.name === '[[') {
            if (args[args.length - 1] !== ']]') return ctx.fail("missing `]]'", 2);
            args.pop();
            ctx.doubleBracket = true;
        }
        try { return testEval(args, ctx) ? 0 : 1; }
        catch (e) { ctx.err('bash: ' + ctx.name + ': ' + e.message + '\n'); return 2; }
    }
    B('test', testCmd);
    B('[', testCmd);
    B('[[', testCmd);

    B('let', (ctx) => {
        if (!ctx.args.length) return ctx.fail('expression expected');
        let v = 0;
        try { for (const a of ctx.args) v = evalArith(a, ctx.sh); }
        catch (e) { return ctx.fail(e.message); }
        return v !== 0 ? 0 : 1;
    });

    B('type', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'tapP' });
        let status = 0;
        for (const name of operands) {
            const sh = ctx.sh;
            const kinds = [];
            if (sh.aliases[name] !== undefined) kinds.push(['alias', name + " is aliased to `" + sh.aliases[name] + "'"]);
            if (['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'function', 'in', '{', '}', '!', '[['].includes(name) && name !== '[[') kinds.push(['keyword', name + ' is a shell keyword']);
            if (sh.functions[name]) kinds.push(['function', name + ' is a function']);
            const cmd = sh.commands[name];
            if (cmd && cmd.builtin) kinds.push(['builtin', name + ' is a shell builtin']);
            const found = sh.lookupCommand(name);
            if (found && found.kind === 'path') kinds.push(['file', name + ' is ' + found.path]);
            if (!kinds.length) { if (!opts.t) ctx.err('bash: type: ' + name + ': not found\n'); status = 1; continue; }
            const list = opts.a ? kinds : [kinds[0]];
            for (const [k, msg] of list) {
                if (opts.t) ctx.outln(k);
                else if (opts.p || opts.P) { if (k === 'file') ctx.outln(msg.split(' is ')[1]); }
                else ctx.outln(msg);
            }
        }
        return status;
    });

    B('command', (ctx) => {
        let args = ctx.args.slice();
        let mode = null;
        while (args[0] && /^-[vVp]+$/.test(args[0])) { if (args[0].includes('v')) mode = 'v'; if (args[0].includes('V')) mode = 'V'; args.shift(); }
        if (!args.length) return 0;
        const sh = ctx.sh;
        if (mode) {
            let status = 0;
            for (const name of args) {
                if (sh.aliases[name] !== undefined) { ctx.outln(mode === 'v' ? 'alias ' + name + "='" + sh.aliases[name] + "'" : name + " is aliased to `" + sh.aliases[name] + "'"); continue; }
                const f = sh.lookupCommand(name);
                if (!f) { status = 1; if (mode === 'V') ctx.err('bash: command: ' + name + ': not found\n'); continue; }
                if (f.kind === 'path') ctx.outln(mode === 'v' ? f.path : name + ' is ' + f.path);
                else ctx.outln(mode === 'v' ? name : name + ' is a shell ' + f.kind);
            }
            return status;
        }
        // bypass functions
        const saved = sh.functions[args[0]];
        if (saved) delete sh.functions[args[0]];
        try { return ctx.exec(args); }
        finally { if (saved) sh.functions[args[0]] = saved; }
    });

    B('builtin', (ctx) => {
        if (!ctx.args.length) return 0;
        const cmd = ctx.sh.commands[ctx.args[0]];
        if (!cmd || !cmd.builtin) return ctx.fail(ctx.args[0] + ': not a shell builtin');
        return ctx.sh.callCommand(cmd, ctx.args, ctx.io);
    });

    B('history', (ctx) => {
        const sh = ctx.sh;
        const args = ctx.args;
        if (args[0] === '-c') { sh.history.length = 0; if (sh.onHistoryClear) sh.onHistoryClear(); return 0; }
        if (args[0] === '-d') {
            const n = parseInt(args[1], 10);
            if (!n || n > sh.history.length) return ctx.fail(args[1] + ': history position out of range');
            sh.history.splice(n - 1, 1);
            return 0;
        }
        let list = sh.history.map((h, i) => [i + 1, h]);
        if (args[0] && /^\d+$/.test(args[0])) list = list.slice(-parseInt(args[0], 10));
        for (const [i, h] of list) ctx.outln(String(i).padStart(5, ' ') + '  ' + h);
        return 0;
    });

    B('jobs', (ctx) => {
        const sh = ctx.sh;
        const live = sh.system.processes ? sh.system.processes.filter((p) => p.job) : [];
        sh.jobs.forEach((j) => {
            const alive = sh.system.isAlive ? sh.system.isAlive(j.pid) : false;
            const state = alive ? 'Running' : 'Done';
            ctx.outln('[' + j.id + ']' + (j === sh.jobs[sh.jobs.length - 1] ? '+' : '-') + '  ' + (ctx.args.includes('-l') ? j.pid + ' ' : '') + state.padEnd(24) + j.cmd + (alive ? ' &' : ''));
        });
        void live;
        // remove finished jobs after reporting
        sh.jobs = sh.jobs.filter((j) => sh.system.isAlive && sh.system.isAlive(j.pid));
        return 0;
    });
    B('fg', (ctx) => {
        const sh = ctx.sh;
        const job = sh.jobs[sh.jobs.length - 1];
        if (!job) return ctx.fail('current: no such job');
        ctx.outln(job.cmd);
        if (sh.system.killProcess) sh.system.killProcess(job.pid);
        sh.jobs.pop();
        return 0;
    });
    B('bg', (ctx) => {
        const job = ctx.sh.jobs[ctx.sh.jobs.length - 1];
        if (!job) return ctx.fail('current: no such job');
        ctx.outln('[' + job.id + ']+ ' + job.cmd + ' &');
        return 0;
    });
    B('wait', () => 0);
    B('disown', (ctx) => { ctx.sh.jobs.pop(); return 0; });

    B('pushd', (ctx) => {
        const sh = ctx.sh;
        const dir = ctx.args[0];
        if (!dir) {
            if (!sh.dirStack.length) return ctx.fail('no other directory');
            const top = sh.dirStack.shift();
            sh.dirStack.unshift(sh.cwd);
            sh.cwd = top; sh.setVar('PWD', top);
        } else {
            const path = sh.resolve(dir);
            if (!sh.fs.isDir(path)) return ctx.fail(dir + ': No such file or directory');
            sh.dirStack.unshift(sh.cwd);
            sh.setVar('OLDPWD', sh.cwd);
            sh.cwd = path; sh.setVar('PWD', path);
        }
        ctx.outln([sh.cwd].concat(sh.dirStack).map((d) => tilde(sh, d)).join(' '));
        return 0;
    });
    B('popd', (ctx) => {
        const sh = ctx.sh;
        if (!sh.dirStack.length) return ctx.fail('directory stack empty');
        const d = sh.dirStack.shift();
        sh.setVar('OLDPWD', sh.cwd);
        sh.cwd = d; sh.setVar('PWD', d);
        ctx.outln([sh.cwd].concat(sh.dirStack).map((x) => tilde(sh, x)).join(' '));
        return 0;
    });
    B('dirs', (ctx) => {
        const sh = ctx.sh;
        if (ctx.args.includes('-c')) { sh.dirStack = []; return 0; }
        if (ctx.args.includes('-v')) { [sh.cwd].concat(sh.dirStack).forEach((d, i) => ctx.outln(' ' + i + '  ' + tilde(sh, d))); return 0; }
        ctx.outln([sh.cwd].concat(sh.dirStack).map((d) => tilde(sh, d)).join(' '));
        return 0;
    });
    function tilde(sh, d) { const h = sh.home; return d === h ? '~' : d.startsWith(h + '/') ? '~' + d.slice(h.length) : d; }

    B('umask', (ctx) => {
        const sh = ctx.sh;
        if (!ctx.args.length) { ctx.outln((sh.umask || '0022')); return 0; }
        if (ctx.args[0] === '-S') { ctx.outln('u=rwx,g=rx,o=rx'); return 0; }
        if (!/^[0-7]{3,4}$/.test(ctx.args[0])) return ctx.fail(ctx.args[0] + ': octal number out of range');
        sh.umask = ctx.args[0].padStart(4, '0');
        return 0;
    });

    B('trap', () => 0);
    B('hash', (ctx) => { if (!ctx.args.length) ctx.outln('hash: hash table empty'); return 0; });
    B('ulimit', (ctx) => { ctx.outln(ctx.args.includes('-a') ? 'core file size          (blocks, -c) 0\nfile size               (blocks, -f) unlimited\nopen files                      (-n) 1024\nmax user processes              (-u) 63432\nstack size              (kbytes, -s) 8192' : 'unlimited'); return 0; });
    B('times', (ctx) => { ctx.outln('0m0.012s 0m0.004s\n0m0.000s 0m0.000s'); return 0; });
    B('shopt', (ctx) => { if (!ctx.args.length) ctx.outln('autocd         \toff\ncdspell        \toff\ndotglob        \toff\nextglob        \toff\nglobstar       \toff\nhistappend     \ton\nnullglob       \toff'); return 0; });
    B('enable', (ctx) => { for (const k of Object.keys(LA.commands).filter((k) => LA.commands[k].builtin).sort()) ctx.outln('enable ' + k); return 0; });
    B('caller', () => 1);
    B('suspend', (ctx) => ctx.fail('cannot suspend a login shell'));

    B('getopts', (ctx) => {
        const sh = ctx.sh;
        const optstring = ctx.args[0];
        const name = ctx.args[1];
        const params = ctx.args.length > 2 ? ctx.args.slice(2) : sh.positional;
        let optind = parseInt(sh.getVar('OPTIND') || '1', 10);
        let sub = sh._getoptsSub || 0;
        const arg = params[optind - 1];
        if (!optstring || !name) return ctx.fail('usage: getopts optstring name [arg ...]', 2);
        if (arg === undefined || !arg.startsWith('-') || arg === '-') { sh.setVar(name, '?'); return 1; }
        if (arg === '--') { sh.setVar('OPTIND', String(optind + 1)); sh.setVar(name, '?'); return 1; }
        const c = arg[1 + sub];
        const idx = optstring.indexOf(c);
        const advance = () => { if (2 + sub >= arg.length) { optind++; sub = 0; } else sub++; };
        if (idx === -1 || c === ':') {
            sh.setVar(name, '?');
            if (optstring[0] !== ':') ctx.err('bash: illegal option -- ' + c + '\n');
            else sh.setVar('OPTARG', c);
            advance();
        } else if (optstring[idx + 1] === ':') {
            let val = arg.slice(2 + sub);
            if (!val) { val = params[optind]; optind++; }
            optind++; sub = 0;
            if (val === undefined) { sh.setVar(name, optstring[0] === ':' ? ':' : '?'); if (optstring[0] !== ':') ctx.err('bash: option requires an argument -- ' + c + '\n'); }
            else { sh.setVar(name, c); sh.setVar('OPTARG', val); }
        } else {
            sh.setVar(name, c);
            advance();
        }
        sh._getoptsSub = sub;
        sh.setVar('OPTIND', String(optind));
        return 0;
    });

    B('clear', (ctx) => { ctx.out('\x1b[H\x1b[2J\x1b[3J'); return 0; });
    B('reset', (ctx) => { ctx.out('\x1b[H\x1b[2J\x1b[3J'); return 0; });
    B('tput', (ctx) => {
        const a = ctx.args;
        const map = { clear: '\x1b[H\x1b[2J', bold: '\x1b[1m', sgr0: '\x1b[0m', smul: '\x1b[4m', rmul: '\x1b[24m', rev: '\x1b[7m', cols: String(ctx.sh.columns) + '\n', lines: String(ctx.sh.rows) + '\n', colors: '256\n' };
        if (a[0] === 'setaf' || a[0] === 'setab') { ctx.out('\x1b[' + (a[0] === 'setaf' ? 30 : 40) + (parseInt(a[1], 10) % 8) + 'm'); return 0; }
        if (map[a[0]] === undefined) return ctx.fail('unknown terminfo capability \'' + (a[0] || '') + "'", 4);
        ctx.out(map[a[0]]);
        return 0;
    });

    B('sleep', (ctx) => {
        if (!ctx.args.length) return usageError(ctx, 'missing operand');
        for (const a of ctx.args) if (!/^\d+(\.\d+)?[smhd]?$/.test(a)) return usageError(ctx, "invalid time interval '" + a + "'");
        return 0;
    }, { builtin: false });

    B('time', (ctx) => {
        if (!ctx.args.length) { ctx.err('\nreal\t0m0.000s\nuser\t0m0.000s\nsys\t0m0.000s\n'); return 0; }
        const start = Date.now();
        const code = ctx.exec(ctx.args);
        const ms = Math.max(1, Date.now() - start);
        const fmt = (x) => '0m' + (x / 1000).toFixed(3) + 's';
        ctx.err('\nreal\t' + fmt(ms + 2) + '\nuser\t' + fmt(Math.ceil(ms * 0.6)) + '\nsys\t' + fmt(Math.ceil(ms * 0.2)) + '\n');
        return code;
    });

    B('help', (ctx) => {
        if (ctx.args.length) {
            const h = LA.docs && LA.docs.helpText(ctx.args[0]);
            if (h) { ctx.out(h); return 0; }
            return ctx.fail("no help topics match `" + ctx.args[0] + "'.  Try `man " + ctx.args[0] + "'.");
        }
        ctx.out(LA.docs ? LA.docs.overview() : 'help\n');
        return 0;
    });

    // kill is a builtin in bash (handles job specs)
    B('kill', (ctx) => {
        const sys = ctx.sh.system;
        let args = ctx.args.slice();
        if (args[0] === '-l' || args[0] === '-L') {
            ctx.outln(' 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 4) SIGILL\t 5) SIGTRAP\n 6) SIGABRT\t 7) SIGBUS\t 8) SIGFPE\t 9) SIGKILL\t10) SIGUSR1\n11) SIGSEGV\t12) SIGUSR2\t13) SIGPIPE\t14) SIGALRM\t15) SIGTERM\n17) SIGCHLD\t18) SIGCONT\t19) SIGSTOP\t20) SIGTSTP');
            return 0;
        }
        let signal = 'TERM';
        if (args[0] === '-s' || args[0] === '-n') { signal = args[1]; args = args.slice(2); }
        else if (args[0] && /^-\w+$/.test(args[0])) { signal = args[0].slice(1); args = args.slice(1); }
        if (!args.length) return usageError(ctx, 'usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ...');
        let status = 0;
        for (const a of args) {
            let pid;
            if (a.startsWith('%')) {
                const job = ctx.sh.jobs.find((j) => String(j.id) === a.slice(1)) || ctx.sh.jobs[ctx.sh.jobs.length - 1];
                if (!job) { ctx.err('bash: kill: ' + a + ': no such job\n'); status = 1; continue; }
                pid = job.pid;
            } else if (/^\d+$/.test(a)) pid = parseInt(a, 10);
            else { ctx.err('bash: kill: ' + a + ': arguments must be process or job IDs\n'); status = 1; continue; }
            const r = sys.signalProcess ? sys.signalProcess(pid, signal, ctx.sh.user) : 'ESRCH';
            if (r === 'ESRCH') { ctx.err('bash: kill: (' + pid + ') - No such process\n'); status = 1; }
            else if (r === 'EPERM') { ctx.err('bash: kill: (' + pid + ') - Operation not permitted\n'); status = 1; }
        }
        return status;
    });
})();
