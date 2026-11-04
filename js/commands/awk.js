// Linux Arsenal - awk interpreter (POSIX awk subset with common gawk extensions)
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const U = LA.util;

    const KEYWORDS = new Set(['BEGIN', 'END', 'function', 'func', 'if', 'else', 'while', 'for', 'do', 'break', 'continue', 'next', 'nextfile', 'exit', 'return', 'delete', 'in', 'getline', 'print', 'printf']);
    const BUILTINS = new Set(['length', 'substr', 'index', 'split', 'sub', 'gsub', 'match', 'sprintf', 'sin', 'cos', 'atan2', 'exp', 'log', 'sqrt', 'int', 'rand', 'srand', 'tolower', 'toupper', 'system', 'close', 'fflush', 'systime', 'strftime', 'gensub', 'asort', 'asorti']);

    class AwkError extends Error {}
    class NextSig {}
    class ExitSig { constructor(c) { this.code = c; } }
    class ReturnSig { constructor(v) { this.v = v; } }
    class BreakSig {}
    class ContSig {}

    class AwkArray { constructor() { this.m = new Map(); } }

    // ---------------- lexer ----------------
    function lex(src) {
        const toks = [];
        let i = 0;
        const n = src.length;
        const prevAllowsDiv = () => {
            const t = toks[toks.length - 1];
            if (!t) return false;
            return t.t === 'num' || t.t === 'str' || t.t === 'name' || t.t === 'builtin' && false || (t.t === 'op' && (t.v === ')' || t.v === ']' || t.v === '$' || t.v === '++' || t.v === '--')) || (t.t === 'kw' && t.v === 'getline');
        };
        while (i < n) {
            const c = src[i];
            if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
            if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
            if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
            if (c === '\n') { toks.push({ t: 'nl' }); i++; continue; }
            if (c === '"') {
                let s = '';
                i++;
                while (i < n && src[i] !== '"') {
                    if (src[i] === '\\' && i + 1 < n) {
                        const d = src[i + 1];
                        const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', '/': '/', a: '\x07', b: '\b', f: '\f', v: '\v' };
                        if (map[d] !== undefined) { s += map[d]; i += 2; continue; }
                        if (/[0-7]/.test(d)) { let o = ''; i++; while (o.length < 3 && /[0-7]/.test(src[i])) o += src[i++]; s += String.fromCharCode(parseInt(o, 8)); continue; }
                        s += '\\' + d; i += 2; continue;
                    }
                    s += src[i++];
                }
                if (i >= n) throw new AwkError('unterminated string');
                i++;
                toks.push({ t: 'str', v: s });
                continue;
            }
            if (c === '/' && !prevAllowsDiv()) {
                let s = '';
                i++;
                let inBracket = false;
                while (i < n && (src[i] !== '/' || inBracket)) {
                    if (src[i] === '\\' && i + 1 < n) { s += src[i] + src[i + 1]; i += 2; continue; }
                    if (src[i] === '[') inBracket = true;
                    else if (src[i] === ']' && inBracket && s[s.length - 1] !== '[') inBracket = false;
                    if (src[i] === '\n') throw new AwkError('unterminated regexp');
                    s += src[i++];
                }
                i++;
                toks.push({ t: 're', v: s });
                continue;
            }
            let m;
            const rest = src.slice(i);
            if ((m = /^(?:\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?|0[xX][0-9a-fA-F]+)/.exec(rest))) {
                toks.push({ t: 'num', v: Number(m[0]) });
                i += m[0].length;
                continue;
            }
            if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest))) {
                const w = m[0];
                i += w.length;
                if (KEYWORDS.has(w)) toks.push({ t: 'kw', v: w === 'func' ? 'function' : w });
                else if (BUILTINS.has(w)) toks.push({ t: 'builtin', v: w });
                else if (src[i] === '(') toks.push({ t: 'funcname', v: w });
                else toks.push({ t: 'name', v: w });
                continue;
            }
            const ops = ['**=', '&&', '||', '==', '<=', '>=', '!=', '++', '--', '+=', '-=', '*=', '/=', '%=', '^=', '>>', '!~', '**', '{', '}', '(', ')', '[', ']', ';', ',', '+', '-', '*', '/', '%', '^', '!', '>', '<', '|', '?', ':', '~', '$', '='];
            const op = ops.find((o) => src.startsWith(o, i));
            if (!op) throw new AwkError('syntax error at source line 1: unexpected character `' + c + "'");
            toks.push({ t: 'op', v: op === '**' ? '^' : op === '**=' ? '^=' : op });
            i += op.length;
        }
        toks.push({ t: 'eof' });
        return toks;
    }

    // ---------------- parser ----------------
    function parse(src) {
        const toks = lex(src);
        let p = 0;
        const peek = (o) => toks[p + (o || 0)];
        const next = () => toks[p++];
        const isOp = (v, o) => { const t = peek(o); return t.t === 'op' && t.v === v; };
        const isKw = (v) => peek().t === 'kw' && peek().v === v;
        const expectOp = (v) => { if (!isOp(v)) throw new AwkError('syntax error: expected `' + v + "' near `" + (peek().v || peek().t) + "'"); p++; };
        const skipNl = () => { while (peek().t === 'nl') p++; };
        const skipTerms = () => { while (peek().t === 'nl' || isOp(';')) p++; };

        const program = { begin: [], end: [], rules: [], funcs: Object.create(null) };
        skipTerms();
        while (peek().t !== 'eof') {
            if (isKw('BEGIN')) { p++; skipNl(); program.begin.push(block()); }
            else if (isKw('END')) { p++; skipNl(); program.end.push(block()); }
            else if (isKw('function')) {
                p++;
                const nm = next();
                if (nm.t !== 'name' && nm.t !== 'funcname') throw new AwkError('syntax error in function definition');
                expectOp('(');
                const params = [];
                while (!isOp(')')) { const t = next(); if (t.t !== 'name') throw new AwkError('bad parameter'); params.push(t.v); if (isOp(',')) { p++; skipNl(); } }
                p++;
                skipNl();
                program.funcs[nm.v] = { params, body: block() };
            } else {
                let pattern = null, pattern2 = null;
                if (!isOp('{')) {
                    pattern = expr();
                    if (isOp(',')) { p++; skipNl(); pattern2 = expr(); }
                }
                const action = isOp('{') ? block() : null;
                program.rules.push({ pattern, pattern2, action, inRange: false });
            }
            skipTerms();
        }
        return program;

        function block() {
            expectOp('{');
            const stmts = [];
            skipTerms();
            while (!isOp('}')) {
                if (peek().t === 'eof') throw new AwkError('syntax error: unexpected end of program, missing }');
                stmts.push(statement());
                skipTerms();
            }
            p++;
            return { type: 'block', stmts };
        }
        function simpleOrBlock() {
            skipNl();
            if (isOp(';')) { p++; return { type: 'block', stmts: [] }; }
            return statement();
        }
        function endStmt() {
            if (isOp(';') || peek().t === 'nl') { p++; return; }
            if (isOp('}') || peek().t === 'eof') return;
            throw new AwkError("syntax error near `" + (peek().v !== undefined ? peek().v : peek().t) + "'");
        }
        function statement() {
            const t = peek();
            if (isOp('{')) return block();
            if (t.t === 'kw') {
                switch (t.v) {
                    case 'if': {
                        p++; expectOp('('); const cond = expr(); expectOp(')');
                        const then = simpleOrBlock();
                        const save = p;
                        skipTerms();
                        if (isKw('else')) { p++; const els = simpleOrBlock(); return { type: 'if', cond, then, els }; }
                        p = save;
                        return { type: 'if', cond, then, els: null };
                    }
                    case 'while': { p++; expectOp('('); const cond = expr(); expectOp(')'); if (isOp(';')) { p++; return { type: 'while', cond, body: { type: 'block', stmts: [] } }; } return { type: 'while', cond, body: simpleOrBlock() }; }
                    case 'do': { p++; const body = simpleOrBlock(); skipTerms(); if (!isKw('while')) throw new AwkError('syntax error: expected while'); p++; expectOp('('); const cond = expr(); expectOp(')'); endStmt(); return { type: 'do', body, cond }; }
                    case 'for': {
                        p++; expectOp('(');
                        if (peek().t === 'name' && peek(1).t === 'kw' && peek(1).v === 'in' && (isOp(')', 3) || false)) {
                            const v = next().v; p++; const arr = next().v; expectOp(')');
                            return { type: 'forin', v, arr, body: simpleOrBlock() };
                        }
                        if (isOp('(') && peek(1).t === 'name' && peek(2).t === 'kw' && peek(2).v === 'in') {
                            // for ((a) in arr) unusual; fallthrough
                        }
                        const init = isOp(';') ? null : simpleStatement();
                        expectOp(';'); skipNl();
                        const cond = isOp(';') ? null : expr();
                        expectOp(';'); skipNl();
                        const step = isOp(')') ? null : simpleStatement();
                        expectOp(')');
                        if (isOp(';')) { p++; return { type: 'for', init, cond, step, body: { type: 'block', stmts: [] } }; }
                        return { type: 'for', init, cond, step, body: simpleOrBlock() };
                    }
                    case 'break': p++; endStmt(); return { type: 'break' };
                    case 'continue': p++; endStmt(); return { type: 'continue' };
                    case 'next': p++; endStmt(); return { type: 'next' };
                    case 'nextfile': p++; endStmt(); return { type: 'next' };
                    case 'exit': { p++; let e = null; if (!isOp(';') && peek().t !== 'nl' && !isOp('}') && peek().t !== 'eof') e = expr(); endStmt(); return { type: 'exit', e }; }
                    case 'return': { p++; let e = null; if (!isOp(';') && peek().t !== 'nl' && !isOp('}')) e = expr(); endStmt(); return { type: 'return', e }; }
                    case 'delete': {
                        p++;
                        const nm = next().v;
                        let idx = null;
                        if (isOp('[')) { p++; idx = exprList(); expectOp(']'); }
                        endStmt();
                        return { type: 'delete', name: nm, idx };
                    }
                }
            }
            const s = simpleStatement();
            endStmt();
            return s;
        }
        function simpleStatement() {
            if (isKw('print') || isKw('printf')) {
                const kind = next().v;
                let args = [];
                if (!isOp(';') && peek().t !== 'nl' && !isOp('}') && !isOp('>') && !isOp('>>') && !isOp('|')) {
                    if (isOp('(')) {
                        // could be print (a,b) or print (a)(b) ...
                        const save = p;
                        p++;
                        let grouped = null;
                        try {
                            const list = [expr(true)];
                            while (isOp(',')) { p++; skipNl(); list.push(expr(true)); }
                            expectOp(')');
                            if (isOp(';') || peek().t === 'nl' || isOp('}') || isOp('>') || isOp('>>') || isOp('|') || peek().t === 'eof') grouped = list;
                        } catch (e) { grouped = null; }
                        if (grouped) args = grouped;
                        else { p = save; args = printArgs(); }
                    } else args = printArgs();
                }
                let redir = null;
                if (isOp('>') || isOp('>>') || isOp('|')) { const op = next().v; redir = { op, target: concatExpr(true) }; }
                return { type: kind, args, redir };
            }
            return { type: 'expr', e: expr() };
        }
        function printArgs() {
            const list = [expr(true)];
            while (isOp(',')) { p++; skipNl(); list.push(expr(true)); }
            return list;
        }
        function exprList() {
            const list = [expr()];
            while (isOp(',')) { p++; skipNl(); list.push(expr()); }
            return list;
        }
        // noGt: inside print, '>' is redirection
        function expr(noGt) { return ternary(noGt); }
        function ternary(noGt) {
            const c = orExpr(noGt);
            if (isOp('?')) { p++; skipNl(); const a = ternary(noGt); skipNl(); expectOp(':'); skipNl(); const b = ternary(noGt); return { type: 'cond', c, a, b }; }
            if (peek().t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '^='].includes(peek().v) && isLvalue(c)) {
                const op = next().v; skipNl();
                const v = ternary(noGt);
                return { type: 'assign', op, target: c, v };
            }
            return c;
        }
        function isLvalue(n) { return n.type === 'var' || n.type === 'field' || n.type === 'index'; }
        function orExpr(noGt) {
            let l = andExpr(noGt);
            while (isOp('||')) { p++; skipNl(); l = { type: 'or', l, r: andExpr(noGt) }; }
            return l;
        }
        function andExpr(noGt) {
            let l = inExpr(noGt);
            while (isOp('&&')) { p++; skipNl(); l = { type: 'and', l, r: inExpr(noGt) }; }
            return l;
        }
        function inExpr(noGt) {
            let l = matchExpr(noGt);
            while (isKw('in')) { p++; const arr = next().v; l = { type: 'in', keys: [l], arr }; }
            return l;
        }
        function matchExpr(noGt) {
            let l = cmpExpr(noGt);
            while (isOp('~') || isOp('!~')) { const op = next().v; const r = cmpExpr(noGt); l = { type: 'match', neg: op === '!~', l, r }; }
            return l;
        }
        function cmpExpr(noGt) {
            const l = concatExpr(noGt);
            const t = peek();
            if (t.t === 'op' && ['<', '<=', '==', '!=', '>=', '>'].includes(t.v) && !(noGt && t.v === '>')) {
                p++;
                const r = concatExpr(noGt);
                return { type: 'cmp', op: t.v, l, r };
            }
            if (t.t === 'op' && t.v === '|' && peek(1).t === 'kw' && peek(1).v === 'getline') {
                p += 2;
                let v = null;
                if (peek().t === 'name' || isOp('$')) v = primaryLvalue();
                return { type: 'getline', cmd: l, v };
            }
            return l;
        }
        function startsPrimary(t) {
            if (t.t === 'num' || t.t === 'str' || t.t === 're' || t.t === 'name' || t.t === 'funcname' || t.t === 'builtin') return true;
            if (t.t === 'op' && (t.v === '$' || t.v === '(' || t.v === '!' || t.v === '++' || t.v === '--' || t.v === '-' || t.v === '+')) return true;
            if (t.t === 'kw' && t.v === 'getline') return false;
            return false;
        }
        function concatExpr(noGt) {
            let l = additive();
            for (;;) {
                const t = peek();
                if (!startsPrimary(t) || (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '!'))) break;
                if (t.t === 'kw' && t.v === 'in') break;
                const r = additive();
                l = { type: 'concat', l, r };
            }
            void noGt;
            return l;
        }
        function additive() {
            let l = mul();
            while (isOp('+') || isOp('-')) { const op = next().v; l = { type: 'bin', op, l, r: mul() }; }
            return l;
        }
        function mul() {
            let l = unary();
            while (isOp('*') || isOp('/') || isOp('%')) { const op = next().v; l = { type: 'bin', op, l, r: unary() }; }
            return l;
        }
        function unary() {
            if (isOp('!')) { p++; return { type: 'not', e: unary() }; }
            if (isOp('-')) { p++; return { type: 'neg', e: unary() }; }
            if (isOp('+')) { p++; return { type: 'pos', e: unary() }; }
            return power();
        }
        function power() {
            const b = postfix();
            if (isOp('^')) { p++; const e = unaryNoPow(); return { type: 'bin', op: '^', l: b, r: e }; }
            return b;
        }
        function unaryNoPow() {
            if (isOp('-')) { p++; return { type: 'neg', e: unaryNoPow() }; }
            if (isOp('+')) { p++; return unaryNoPow(); }
            if (isOp('!')) { p++; return { type: 'not', e: unaryNoPow() }; }
            return power();
        }
        function postfix() {
            if (isOp('++') || isOp('--')) { const op = next().v; const t = primaryLvalue(); return { type: 'preinc', op, t }; }
            const e = primary();
            if ((isOp('++') || isOp('--')) && isLvalue(e)) { const op = next().v; return { type: 'postinc', op, t: e }; }
            return e;
        }
        function primaryLvalue() {
            const e = primary();
            if (!isLvalue(e)) throw new AwkError('syntax error: invalid lvalue');
            return e;
        }
        function primary() {
            const t = next();
            switch (t.t) {
                case 'num': return { type: 'num', v: t.v };
                case 'str': return { type: 'str', v: t.v };
                case 're': return { type: 're', v: t.v };
                case 'name': {
                    if (isOp('[')) { p++; const idx = exprList(); expectOp(']'); return { type: 'index', name: t.v, idx }; }
                    return { type: 'var', name: t.v };
                }
                case 'funcname': {
                    expectOp('(');
                    const args = [];
                    skipNl();
                    while (!isOp(')')) { args.push(expr()); skipNl(); if (isOp(',')) { p++; skipNl(); } }
                    p++;
                    return { type: 'call', name: t.v, args };
                }
                case 'builtin': {
                    const args = [];
                    if (isOp('(')) {
                        p++;
                        skipNl();
                        while (!isOp(')')) { args.push(expr()); skipNl(); if (isOp(',')) { p++; skipNl(); } }
                        p++;
                    } else if (t.v !== 'length') throw new AwkError('syntax error: ' + t.v + ' requires arguments');
                    return { type: 'builtin', name: t.v, args };
                }
                case 'kw':
                    if (t.v === 'getline') {
                        let v = null, file = null;
                        if (peek().t === 'name' || isOp('$')) v = primaryLvalue();
                        if (isOp('<')) { p++; file = primary(); }
                        return { type: 'getline', v, file };
                    }
                    break;
                case 'op':
                    if (t.v === '$') { const e = isOp('++') || isOp('--') ? postfix() : primary(); return { type: 'field', e }; }
                    if (t.v === '(') {
                        const e = expr();
                        if (isOp(',')) {
                            // (a, b) in arr
                            const keys = [e];
                            while (isOp(',')) { p++; keys.push(expr()); }
                            expectOp(')');
                            if (!isKw('in')) throw new AwkError('syntax error');
                            p++;
                            return { type: 'in', keys, arr: next().v };
                        }
                        expectOp(')');
                        return { type: 'group', e };
                    }
                    if (t.v === '-') return { type: 'neg', e: unary() };
                    if (t.v === '!') return { type: 'not', e: unary() };
            }
            throw new AwkError("syntax error at source line 1 near `" + (t.v !== undefined ? t.v : t.t) + "'");
        }
    }

    // ---------------- interpreter ----------------
    const NUMRE = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\s*$/;
    function toNum(v) {
        if (typeof v === 'number') return v;
        if (v instanceof AwkArray) return 0;
        if (v === undefined || v === null) return 0;
        const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/.exec(String(v));
        if (m) return parseFloat(m[1]);
        if (/^\s*[-+]?0[xX][0-9a-fA-F]+/.test(v)) return 0;
        if (/^\s*[-+]?(inf|nan)/i.test(v)) return /nan/i.test(v) ? NaN : (String(v).trim()[0] === '-' ? -Infinity : Infinity);
        return 0;
    }
    function numToStr(n, fmt) {
        if (Number.isInteger(n)) return String(n);
        if (!isFinite(n)) return isNaN(n) ? 'nan' : (n < 0 ? '-inf' : 'inf');
        return U.formatPrintf(fmt || '%.6g', [n]);
    }

    function run(programSrc, opts) {
        const prog = parse(programSrc);
        const out = opts.out;
        const sh = opts.sh;
        const globals = new Map();
        const setG = (k, v) => globals.set(k, v);
        setG('FS', opts.FS !== undefined ? opts.FS : ' ');
        setG('OFS', ' ');
        setG('ORS', '\n');
        setG('RS', '\n');
        setG('NR', 0);
        setG('NF', 0);
        setG('FNR', 0);
        setG('FILENAME', '');
        setG('SUBSEP', '\x1c');
        setG('CONVFMT', '%.6g');
        setG('OFMT', '%.6g');
        setG('RSTART', 0);
        setG('RLENGTH', -1);
        const ENV = new AwkArray();
        for (const [k, v] of Object.entries(opts.env || {})) ENV.m.set(k, v);
        setG('ENVIRON', ENV);
        const ARGV = new AwkArray();
        ARGV.m.set('0', 'awk');
        (opts.files || []).forEach((f, i) => ARGV.m.set(String(i + 1), f));
        setG('ARGV', ARGV);
        setG('ARGC', (opts.files || []).length + 1);
        for (const [k, v] of opts.vars || []) setG(k, v);

        let fields = [''];
        let nf = 0;
        let fieldsDirty = false;
        let record = '';
        const frames = [];
        const outputs = new Map();
        const regexCache = new Map();
        let rng = U.mulberry32(0);
        let seed = 0;
        let exitCode = 0;
        let steps = 0;

        function getVarMap(name) {
            if (frames.length) {
                const f = frames[frames.length - 1];
                if (f.has(name)) return f;
            }
            return globals;
        }
        function getVar(name) {
            if (name === 'NF') { if (fieldsDirty) splitRecord(); return nf; }
            const m = getVarMap(name);
            const v = m.get(name);
            return v === undefined ? '' : v;
        }
        function setVar(name, v) {
            if (name === 'NF') { if (fieldsDirty) splitRecord(); setNF(toNum(v)); return; }
            getVarMap(name).set(name, v);
        }
        function getArray(name) {
            const m = getVarMap(name);
            let v = m.get(name);
            if (!(v instanceof AwkArray)) {
                if (v !== undefined && v !== '') throw new AwkError("can't use scalar `" + name + "' as array");
                v = new AwkArray();
                m.set(name, v);
            }
            return v;
        }
        function toStr(v) {
            if (typeof v === 'number') return numToStr(v, globals.get('CONVFMT'));
            if (v instanceof AwkArray) throw new AwkError("attempt to use array in a scalar context");
            return v === undefined || v === null ? '' : String(v);
        }
        function outStr(v) {
            if (typeof v === 'number') return numToStr(v, globals.get('OFMT'));
            return toStr(v);
        }
        function truthy(v) {
            if (typeof v === 'number') return v !== 0;
            if (v instanceof AwkArray) return v.m.size > 0;
            const s = String(v);
            if (v && v.strnum) return toNum(s) !== 0;
            return s !== '';
        }
        function looksNum(v) { return typeof v === 'number' || (typeof v === 'string' && NUMRE.test(v)); }
        function regex(src) {
            let r = regexCache.get(src);
            if (!r) {
                try { r = new RegExp(U.posixToJs(src, true)); }
                catch (e) { throw new AwkError('invalid regex: ' + src); }
                regexCache.set(src, r);
            }
            return r;
        }
        function toRegex(node) {
            if (node.type === 're') return regex(node.v);
            return regex(toStr(evaluate(node)));
        }

        function splitRecord() {
            fieldsDirty = false;
            const fs = toStr(globals.get('FS'));
            const s = record;
            let parts;
            if (fs === ' ') parts = s.trim() === '' ? [] : s.trim().split(/[ \t\n]+/);
            else if (s === '') parts = [];
            else if (fs.length === 1 && fs !== '\\') parts = s.split(fs === '\t' ? '\t' : fs);
            else if (fs === '') parts = Array.from(s);
            else parts = s.split(regex(fs));
            fields = [s].concat(parts);
            nf = parts.length;
        }
        function setRecord(s) {
            record = s;
            fieldsDirty = true;
        }
        function getField(i) {
            if (i < 0) throw new AwkError('trying to access out of range field ' + i);
            if (i === 0) return strnum(record);
            if (fieldsDirty) splitRecord();
            return i <= nf ? strnum(fields[i]) : '';
        }
        function strnum(s) { return s; }
        function rebuild() {
            const ofs = toStr(globals.get('OFS'));
            record = fields.slice(1, nf + 1).map((x) => (x === undefined ? '' : x)).join(ofs);
            fields[0] = record;
        }
        function setField(i, v) {
            if (i === 0) { setRecord(toStr(v)); return; }
            if (fieldsDirty) splitRecord();
            while (nf < i) { nf++; fields[nf] = ''; }
            fields[i] = toStr(v);
            rebuild();
        }
        function setNF(n) {
            n = Math.trunc(n);
            if (n > nf) for (let k = nf + 1; k <= n; k++) fields[k] = '';
            nf = n;
            fields.length = n + 1;
            rebuild();
        }

        const lv = (node) => {
            switch (node.type) {
                case 'var': return { get: () => getVar(node.name), set: (v) => setVar(node.name, v) };
                case 'field': { const i = Math.trunc(toNum(evaluate(node.e))); return { get: () => getField(i), set: (v) => setField(i, v) }; }
                case 'index': {
                    const arr = getArray(node.name);
                    const key = subscript(node.idx);
                    return { get: () => { if (!arr.m.has(key)) arr.m.set(key, ''); return arr.m.get(key); }, set: (v) => arr.m.set(key, v) };
                }
                case 'group': return lv(node.e);
            }
            throw new AwkError('invalid assignment target');
        };
        function subscript(idx) { return idx.map((e) => toStr(evaluate(e))).join(toStr(globals.get('SUBSEP'))); }

        function compare(op, a, b) {
            let r;
            if (looksNum(a) && looksNum(b) && !(a && a.isStrConst) && !(b && b.isStrConst)) {
                const x = toNum(a), y = toNum(b);
                r = x < y ? -1 : x > y ? 1 : 0;
            } else {
                const x = toStr(a), y = toStr(b);
                r = x < y ? -1 : x > y ? 1 : 0;
            }
            switch (op) {
                case '<': return r < 0 ? 1 : 0;
                case '<=': return r <= 0 ? 1 : 0;
                case '==': return r === 0 ? 1 : 0;
                case '!=': return r !== 0 ? 1 : 0;
                case '>=': return r >= 0 ? 1 : 0;
                case '>': return r > 0 ? 1 : 0;
            }
            return 0;
        }

        function substitute(reNode, repl, targetNode, global, which) {
            const re = toRegex(reNode);
            const target = targetNode ? lv(targetNode) : { get: () => getField(0), set: (v) => setField(0, v) };
            const s = toStr(target.get());
            const r = toStr(repl);
            let count = 0;
            const g = new RegExp(re.source, 'g');
            let res = '';
            let last = 0;
            let m;
            let k = 0;
            while ((m = g.exec(s)) !== null) {
                k++;
                const hit = which ? k === which : true;
                if (hit) {
                    res += s.slice(last, m.index);
                    let rep = '';
                    for (let i = 0; i < r.length; i++) {
                        if (r[i] === '\\' && r[i + 1] === '&') { rep += '&'; i++; continue; }
                        if (r[i] === '\\' && r[i + 1] === '\\') { rep += '\\'; i++; continue; }
                        if (r[i] === '\\' && which !== undefined && /\d/.test(r[i + 1])) { rep += m[+r[i + 1]] || ''; i++; continue; }
                        if (r[i] === '&') { rep += m[0]; continue; }
                        rep += r[i];
                    }
                    res += rep;
                    last = m.index + m[0].length;
                    count++;
                    if (!global) break;
                }
                if (m[0] === '') {
                    if (g.lastIndex < s.length && hit) res += s[g.lastIndex];
                    if (hit) last = g.lastIndex + 1;
                    g.lastIndex++;
                }
            }
            if (count) { res += s.slice(last); target.set(res); }
            return count;
        }

        function callBuiltin(name, args) {
            const ev = (i) => evaluate(args[i]);
            switch (name) {
                case 'length': {
                    if (!args.length) return Array.from(toStr(getField(0))).length;
                    if (args[0].type === 'var') { const v = getVar(args[0].name); if (v instanceof AwkArray) return v.m.size; }
                    return Array.from(toStr(ev(0))).length;
                }
                case 'substr': {
                    const s = Array.from(toStr(ev(0)));
                    let m = toNum(ev(1));
                    m = Math.round(m);
                    let n = args.length > 2 ? Math.round(toNum(ev(2))) : Infinity;
                    let start = m, end = n === Infinity ? Infinity : m + n;
                    if (start < 1) start = 1;
                    if (end > s.length + 1) end = s.length + 1;
                    if (end <= start) return '';
                    return s.slice(start - 1, end - 1).join('');
                }
                case 'index': { const s = toStr(ev(0)), t = toStr(ev(1)); return s.indexOf(t) + 1; }
                case 'split': {
                    const s = toStr(ev(0));
                    const arr = getArray(args[1].name);
                    arr.m.clear();
                    let parts;
                    let sep = args.length > 2 ? (args[2].type === 're' ? { re: regex(args[2].v) } : toStr(ev(2))) : toStr(globals.get('FS'));
                    if (typeof sep === 'object') parts = s === '' ? [] : s.split(sep.re);
                    else if (sep === ' ') parts = s.trim() === '' ? [] : s.trim().split(/[ \t\n]+/);
                    else if (sep === '') parts = Array.from(s);
                    else if (sep.length === 1) parts = s === '' ? [] : s.split(sep);
                    else parts = s === '' ? [] : s.split(regex(sep));
                    parts.forEach((x, i) => arr.m.set(String(i + 1), x));
                    if (args.length > 3) { const seps = getArray(args[3].name); seps.m.clear(); }
                    return parts.length;
                }
                case 'sub': return substitute(args[0], ev(1), args[2], false);
                case 'gsub': return substitute(args[0], ev(1), args[2], true);
                case 'gensub': {
                    const re = toRegex(args[0]);
                    const repl = toStr(ev(1));
                    const how = toStr(ev(2));
                    const target = args.length > 3 ? toStr(ev(3)) : toStr(getField(0));
                    const global = /^[gG]/.test(how);
                    const which = global ? 0 : Math.max(1, Math.trunc(toNum(how)) || 1);
                    let k = 0;
                    return target.replace(new RegExp(re.source, 'g'), (...m) => {
                        k++;
                        if (!global && k !== which) return m[0];
                        return repl.replace(/\\(\d)|&|\\&/g, (x, d) => (x === '\\&' ? '&' : x === '&' ? m[0] : (d === '0' ? m[0] : (m[+d] || ''))));
                    });
                }
                case 'match': {
                    const s = toStr(ev(0));
                    const re = toRegex(args[1]);
                    const m = re.exec(s);
                    if (args.length > 2) {
                        const arr = getArray(args[2].name);
                        arr.m.clear();
                        if (m) m.forEach((g, i) => { if (g !== undefined) arr.m.set(String(i), g); });
                    }
                    if (!m) { globals.set('RSTART', 0); globals.set('RLENGTH', -1); return 0; }
                    globals.set('RSTART', m.index + 1);
                    globals.set('RLENGTH', m[0].length);
                    return m.index + 1;
                }
                case 'sprintf': { const vals = args.map((a) => evaluate(a)); return U.formatPrintf(toStr(vals[0]), vals.slice(1).map((v) => (typeof v === 'number' ? v : toStr(v)))); }
                case 'sin': return Math.sin(toNum(ev(0)));
                case 'cos': return Math.cos(toNum(ev(0)));
                case 'atan2': return Math.atan2(toNum(ev(0)), toNum(ev(1)));
                case 'exp': return Math.exp(toNum(ev(0)));
                case 'log': return Math.log(toNum(ev(0)));
                case 'sqrt': return Math.sqrt(toNum(ev(0)));
                case 'int': return Math.trunc(toNum(ev(0)));
                case 'rand': return rng();
                case 'srand': { const prev = seed; seed = args.length ? toNum(ev(0)) : Math.floor(Date.now() / 1000); rng = U.mulberry32(seed); return prev; }
                case 'tolower': return toStr(ev(0)).toLowerCase();
                case 'toupper': return toStr(ev(0)).toUpperCase();
                case 'systime': return Math.floor(Date.now() / 1000);
                case 'strftime': { const f = args.length ? toStr(ev(0)) : '%a %b %e %H:%M:%S %Z %Y'; const t = args.length > 1 ? toNum(ev(1)) * 1000 : Date.now(); return U.strftime(f, new Date(t)); }
                case 'system': {
                    flushAll();
                    if (!sh) return 0;
                    return sh.execNode(LA.shellUtil.parse(toStr(ev(0)), sh), opts.io);
                }
                case 'close': {
                    const k = toStr(ev(0));
                    const o = outputs.get(k);
                    if (o) { flushOne(k, o); outputs.delete(k); }
                    return 0;
                }
                case 'fflush': return 0;
                case 'asort': case 'asorti': {
                    const src = getArray(args[0].name);
                    const vals = name === 'asort' ? Array.from(src.m.values()) : Array.from(src.m.keys());
                    vals.sort((a, b) => (looksNum(a) && looksNum(b) ? toNum(a) - toNum(b) : toStr(a) < toStr(b) ? -1 : toStr(a) > toStr(b) ? 1 : 0));
                    const dest = args.length > 1 ? getArray(args[1].name) : src;
                    dest.m.clear();
                    vals.forEach((v, i) => dest.m.set(String(i + 1), v));
                    return vals.length;
                }
            }
            throw new AwkError('function ' + name + ' not defined');
        }

        function callUser(name, argNodes) {
            const fn = prog.funcs[name];
            if (!fn) throw new AwkError('function `' + name + "' not defined");
            if (frames.length > 200) throw new AwkError('function call nesting too deep');
            const frame = new Map();
            fn.params.forEach((pname, i) => {
                const a = argNodes[i];
                if (!a) { frame.set(pname, ''); return; }
                if (a.type === 'var') {
                    const cur = getVarMap(a.name).get(a.name);
                    if (cur instanceof AwkArray) { frame.set(pname, cur); return; }
                    if (cur === undefined && usesAsArray(fn.body, pname)) { const arr = getArray(a.name); frame.set(pname, arr); return; }
                }
                frame.set(pname, evaluate(a));
            });
            frames.push(frame);
            try { exec(fn.body); return ''; }
            catch (e) { if (e instanceof ReturnSig) return e.v; throw e; }
            finally { frames.pop(); }
        }
        function usesAsArray(node, name) {
            let found = false;
            const visit = (n) => {
                if (!n || typeof n !== 'object' || found) return;
                if ((n.type === 'index' || n.type === 'delete' || n.type === 'forin') && (n.name === name || n.arr === name)) { found = true; return; }
                if (n.type === 'in' && n.arr === name) { found = true; return; }
                if (n.type === 'builtin' && n.name === 'split' && n.args[1] && n.args[1].name === name) { found = true; return; }
                for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v); }
            };
            visit(node);
            return found;
        }

        function evaluate(node) {
            if (++steps > 2000000) throw new AwkError('program exceeded sandbox step limit');
            switch (node.type) {
                case 'num': return node.v;
                case 'str': { const s = node.v; return s; }
                case 're': return regex(node.v).test(toStr(getField(0))) ? 1 : 0;
                case 'var': {
                    const v = getVar(node.name);
                    return v;
                }
                case 'field': return getField(Math.trunc(toNum(evaluate(node.e))));
                case 'index': {
                    const arr = getArray(node.name);
                    const k = subscript(node.idx);
                    if (!arr.m.has(k)) arr.m.set(k, '');
                    return arr.m.get(k);
                }
                case 'group': return evaluate(node.e);
                case 'assign': {
                    const target = lv(node.target);
                    let v = evaluate(node.v);
                    if (v instanceof AwkArray) throw new AwkError('attempt to use array in scalar context');
                    if (node.op !== '=') {
                        const cur = toNum(target.get());
                        const r = toNum(v);
                        switch (node.op) {
                            case '+=': v = cur + r; break;
                            case '-=': v = cur - r; break;
                            case '*=': v = cur * r; break;
                            case '/=': if (r === 0) throw new AwkError('division by zero in /='); v = cur / r; break;
                            case '%=': if (r === 0) throw new AwkError('division by zero in %='); v = cur % r; break;
                            case '^=': v = Math.pow(cur, r); break;
                        }
                    }
                    target.set(v);
                    return v;
                }
                case 'cond': return truthy(evaluate(node.c)) ? evaluate(node.a) : evaluate(node.b);
                case 'or': return truthy(evaluate(node.l)) || truthy(evaluate(node.r)) ? 1 : 0;
                case 'and': return truthy(evaluate(node.l)) && truthy(evaluate(node.r)) ? 1 : 0;
                case 'in': {
                    const arr = getArray(node.arr);
                    const k = node.keys.map((e) => toStr(evaluate(e))).join(toStr(globals.get('SUBSEP')));
                    return arr.m.has(k) ? 1 : 0;
                }
                case 'match': {
                    const s = toStr(evaluate(node.l));
                    const re = toRegex(node.r);
                    const r = re.test(s);
                    return (node.neg ? !r : r) ? 1 : 0;
                }
                case 'cmp': {
                    const a = evaluate(node.l), b = evaluate(node.r);
                    const aConst = node.l.type === 'str', bConst = node.r.type === 'str';
                    if (aConst || bConst) {
                        const x = toStr(a), y = toStr(b);
                        const r = x < y ? -1 : x > y ? 1 : 0;
                        return { '<': r < 0, '<=': r <= 0, '==': r === 0, '!=': r !== 0, '>=': r >= 0, '>': r > 0 }[node.op] ? 1 : 0;
                    }
                    return compare(node.op, a, b);
                }
                case 'concat': return toStr(evaluate(node.l)) + toStr(evaluate(node.r));
                case 'bin': {
                    const a = toNum(evaluate(node.l)), b = toNum(evaluate(node.r));
                    switch (node.op) {
                        case '+': return a + b;
                        case '-': return a - b;
                        case '*': return a * b;
                        case '/': if (b === 0) throw new AwkError('division by zero'); return a / b;
                        case '%': if (b === 0) throw new AwkError('division by zero in %'); return a % b;
                        case '^': return Math.pow(a, b);
                    }
                    return 0;
                }
                case 'not': return truthy(evaluate(node.e)) ? 0 : 1;
                case 'neg': return -toNum(evaluate(node.e));
                case 'pos': return toNum(evaluate(node.e));
                case 'preinc': { const t = lv(node.t); const v = toNum(t.get()) + (node.op === '++' ? 1 : -1); t.set(v); return v; }
                case 'postinc': { const t = lv(node.t); const old = toNum(t.get()); t.set(old + (node.op === '++' ? 1 : -1)); return old; }
                case 'builtin': return callBuiltin(node.name, node.args);
                case 'call': return callUser(node.name, node.args);
                case 'getline': return doGetline(node);
            }
            throw new AwkError('cannot evaluate ' + node.type);
        }

        // input handling
        const inputs = opts.inputs; // [{name, content}]
        let inIdx = -1;
        let curLines = null;
        let curPos = 0;
        const fileReaders = new Map();
        function splitRecords(content) {
            const rs = toStr(globals.get('RS'));
            if (rs === '\n') { const l = content.split('\n'); if (l[l.length - 1] === '') l.pop(); return l; }
            if (rs === '') return content.split(/\n\n+/).map((x) => x.replace(/^\n+|\n+$/g, '')).filter((x) => x !== '');
            const parts = rs.length === 1 ? content.split(rs) : content.split(regex(rs));
            if (parts[parts.length - 1] === '' || parts[parts.length - 1] === '\n') parts.pop();
            return parts;
        }
        function nextRecord() {
            for (;;) {
                if (curLines && curPos < curLines.length) return curLines[curPos++];
                inIdx++;
                if (inIdx >= inputs.length) return null;
                const inp = inputs[inIdx];
                if (inp.assign) { const eq = inp.assign.indexOf('='); globals.set(inp.assign.slice(0, eq), LA.shellUtil.unescapeC(inp.assign.slice(eq + 1))); curLines = null; continue; }
                globals.set('FILENAME', inp.name === '-' ? '' : inp.name);
                globals.set('FNR', 0);
                curLines = splitRecords(inp.content);
                curPos = 0;
            }
        }
        function doGetline(node) {
            let line;
            if (node.cmd) {
                const cmd = toStr(evaluate(node.cmd));
                let r = fileReaders.get('|' + cmd);
                if (!r) {
                    let text = '';
                    if (sh) { const res = sh.exec(cmd); text = res.stdout; }
                    r = { lines: splitRecords(text), pos: 0 };
                    fileReaders.set('|' + cmd, r);
                }
                if (r.pos >= r.lines.length) return 0;
                line = r.lines[r.pos++];
            } else if (node.file) {
                const fname = toStr(evaluate(node.file));
                let r = fileReaders.get(fname);
                if (!r) {
                    let text;
                    try { text = fname === '-' || fname === '/dev/stdin' ? '' : sh.fs.readFile(sh.resolve(fname)); }
                    catch (e) { return -1; }
                    r = { lines: splitRecords(text), pos: 0 };
                    fileReaders.set(fname, r);
                }
                if (r.pos >= r.lines.length) return 0;
                line = r.lines[r.pos++];
            } else {
                line = nextRecord();
                if (line === null) return 0;
                globals.set('NR', toNum(globals.get('NR')) + 1);
                globals.set('FNR', toNum(globals.get('FNR')) + 1);
            }
            if (node.v) lv(node.v).set(line);
            else { setRecord(line); }
            if (node.file && !node.v) globals.set('NR', toNum(globals.get('NR')));
            return 1;
        }

        function writeOut(s, redir) {
            if (!redir) { out(s); return; }
            const target = toStr(evaluate(redir.target));
            let o = outputs.get(target);
            if (!o) {
                o = { op: redir.op, buf: '' };
                outputs.set(target, o);
                if (redir.op === '>' && target !== '/dev/stdout' && target !== '/dev/stderr' && target !== '-') {
                    try { sh.fs.writeFile(sh.resolve(target), ''); } catch (e) { throw new AwkError("can't redirect to `" + target + "' (" + e.message + ')'); }
                }
            }
            if (target === '/dev/stdout' || target === '-') { out(s); return; }
            if (target === '/dev/stderr') { opts.err(s); return; }
            if (o.op === '|') { o.buf += s; return; }
            try { sh.fs.writeFile(sh.resolve(target), s, { append: true }); } catch (e) { throw new AwkError("can't redirect to `" + target + "'"); }
        }
        function flushOne(target, o) {
            if (o.op === '|' && sh) {
                sh.run(target, { stdin: o.buf, stdout: { write: (x) => out(x) }, stderr: { write: (x) => opts.err(x) } });
                o.buf = '';
            }
        }
        function flushAll() { for (const [k, o] of outputs) flushOne(k, o); }

        function exec(node) {
            if (++steps > 2000000) throw new AwkError('program exceeded sandbox step limit');
            switch (node.type) {
                case 'block': for (const s of node.stmts) exec(s); return;
                case 'expr': evaluate(node.e); return;
                case 'print': {
                    const s = node.args.length ? node.args.map((a) => outStr(evaluate(a))).join(toStr(globals.get('OFS'))) : toStr(getField(0));
                    writeOut(s + toStr(globals.get('ORS')), node.redir);
                    return;
                }
                case 'printf': {
                    if (!node.args.length) throw new AwkError('printf: no format');
                    const vals = node.args.map((a) => evaluate(a));
                    writeOut(U.formatPrintf(toStr(vals[0]), vals.slice(1).map((v) => (typeof v === 'number' ? v : toStr(v)))), node.redir);
                    return;
                }
                case 'if': if (truthy(evaluate(node.cond))) exec(node.then); else if (node.els) exec(node.els); return;
                case 'while':
                    while (truthy(evaluate(node.cond))) {
                        try { exec(node.body); } catch (e) { if (e instanceof BreakSig) break; if (e instanceof ContSig) continue; throw e; }
                    }
                    return;
                case 'do':
                    do {
                        try { exec(node.body); } catch (e) { if (e instanceof BreakSig) break; if (e instanceof ContSig) continue; throw e; }
                    } while (truthy(evaluate(node.cond)));
                    return;
                case 'for':
                    if (node.init) exec(node.init);
                    while (!node.cond || truthy(evaluate(node.cond))) {
                        try { exec(node.body); } catch (e) { if (e instanceof BreakSig) break; if (!(e instanceof ContSig)) throw e; }
                        if (node.step) exec(node.step);
                    }
                    return;
                case 'forin': {
                    const arr = getArray(node.arr);
                    const keys = Array.from(arr.m.keys());
                    // gawk iterates in an unspecified order; sort numerically when possible for stable, readable output
                    if (keys.every((k) => /^-?\d+$/.test(k))) keys.sort((a, b) => a - b);
                    for (const k of keys) {
                        if (!arr.m.has(k)) continue;
                        setVar(node.v, k);
                        try { exec(node.body); } catch (e) { if (e instanceof BreakSig) break; if (e instanceof ContSig) continue; throw e; }
                    }
                    return;
                }
                case 'break': throw new BreakSig();
                case 'continue': throw new ContSig();
                case 'next': throw new NextSig();
                case 'exit': throw new ExitSig(node.e ? Math.trunc(toNum(evaluate(node.e))) : exitCode);
                case 'return': throw new ReturnSig(node.e ? evaluate(node.e) : '');
                case 'delete': {
                    const arr = getArray(node.name);
                    if (node.idx) arr.m.delete(subscript(node.idx)); else arr.m.clear();
                    return;
                }
            }
            throw new AwkError('cannot execute ' + node.type);
        }

        let exiting = false;
        try {
            for (const b of prog.begin) exec(b);
        } catch (e) {
            if (e instanceof ExitSig) { exitCode = e.code; exiting = true; }
            else if (e instanceof NextSig) throw new AwkError('`next\' used in BEGIN action');
            else throw e;
        }
        const needInput = prog.rules.length || prog.end.length;
        if (!exiting && needInput) {
            try {
                for (;;) {
                    const line = nextRecord();
                    if (line === null) break;
                    globals.set('NR', toNum(globals.get('NR')) + 1);
                    globals.set('FNR', toNum(globals.get('FNR')) + 1);
                    setRecord(line);
                    try {
                        for (const rule of prog.rules) {
                            let match;
                            if (rule.pattern2) {
                                if (rule.inRange) {
                                    match = true;
                                    if (truthy(evaluate(rule.pattern2))) rule.inRange = false;
                                } else if (truthy(evaluate(rule.pattern))) {
                                    match = true;
                                    rule.inRange = !truthy(evaluate(rule.pattern2));
                                } else match = false;
                            } else match = !rule.pattern || truthy(evaluate(rule.pattern));
                            if (!match) continue;
                            if (rule.action) exec(rule.action);
                            else out(toStr(getField(0)) + toStr(globals.get('ORS')));
                        }
                    } catch (e) { if (!(e instanceof NextSig)) throw e; }
                }
            } catch (e) {
                if (e instanceof ExitSig) { exitCode = e.code; }
                else throw e;
            }
        }
        try {
            for (const b of prog.end) exec(b);
        } catch (e) {
            if (e instanceof ExitSig) exitCode = e.code;
            else throw e;
        }
        flushAll();
        return exitCode;
    }

    LA.util.register('awk', (ctx) => {
        const args = ctx.args.slice();
        let FS;
        const vars = [];
        let progSrc = null;
        const progFiles = [];
        let i = 0;
        for (; i < args.length; i++) {
            const a = args[i];
            if (a === '--') { i++; break; }
            if (a === '-F') { FS = args[++i]; continue; }
            if (a.startsWith('-F')) { FS = a.slice(2); continue; }
            if (a === '-v') { const kv = args[++i] || ''; const eq = kv.indexOf('='); if (eq < 1) return ctx.fail("`" + kv + "' argument to `-v' not in `var=value' form", 2); vars.push([kv.slice(0, eq), LA.shellUtil.unescapeC(kv.slice(eq + 1))]); continue; }
            if (a.startsWith('-v')) { const kv = a.slice(2); const eq = kv.indexOf('='); vars.push([kv.slice(0, eq), kv.slice(eq + 1)]); continue; }
            if (a === '-f') { progFiles.push(args[++i]); continue; }
            if (a === '--version' || a === '-V') { ctx.outln('GNU Awk 5.2.1, API 3.2, PMA Avon 8-g1, (GNU MPFR 4.2.0, GNU MP 6.2.1)'); return 0; }
            if (a.startsWith('-') && a.length > 1) return ctx.fail("option `" + a + "' not recognized", 2);
            break;
        }
        if (FS !== undefined) FS = FS === 't' ? '\t' : LA.shellUtil.unescapeC(FS);
        if (progFiles.length) {
            try { progSrc = progFiles.map((f) => ctx.fs.readFile(ctx.resolve(f))).join('\n'); }
            catch (e) { return ctx.fail("fatal: can't open source file `" + progFiles[0] + "' for reading: No such file or directory", 2); }
        } else {
            if (i >= args.length) { ctx.err('usage: awk [POSIX or GNU style options] -f progfile [--] file ...\nusage: awk [POSIX or GNU style options] [--] \'program\' file ...\n'); return 2; }
            progSrc = args[i++];
        }
        const operands = args.slice(i);
        const inputs = [];
        let failed = false;
        const fileArgs = [];
        if (!operands.filter((o) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(o)).length) inputs.push({ name: '-', content: ctx.stdin.readAll() });
        for (const op of operands) {
            if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(op)) { inputs.push({ assign: op }); continue; }
            fileArgs.push(op);
            if (op === '-') { inputs.push({ name: '-', content: ctx.stdin.readAll() }); continue; }
            try { inputs.push({ name: op, content: ctx.fs.readFile(ctx.resolve(op)) }); }
            catch (e) { ctx.err("awk: fatal: cannot open file `" + op + "' for reading: " + e.message + '\n'); failed = true; return 2; }
        }
        try {
            return run(progSrc, {
                FS, vars, inputs, files: fileArgs, sh: ctx.sh, io: ctx.io, env: ctx.sh.envObject(),
                out: (s) => ctx.out(s), err: (s) => ctx.err(s)
            }) || (failed ? 2 : 0);
        } catch (e) {
            if (e instanceof AwkError) { ctx.err('awk: ' + (/^(syntax|fatal)/.test(e.message) ? '' : 'fatal: ') + e.message + '\n'); return 2; }
            throw e;
        }
    });
    LA.commands.gawk = LA.commands.awk;
    LA.commands.mawk = LA.commands.awk;
    LA.commands.nawk = LA.commands.awk;
    LA.awk = { run, parse };
})();
