// Linux Arsenal - helpers shared by command implementations
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});

    // getopt-style parser.
    // spec: { flags: 'abc', args: 'nk', long: { all: 'a', lines: 'n=' , color: 'color?' }, numeric: bool, stopAtFirst: bool }
    function getopt(argv, spec) {
        spec = spec || {};
        const flags = spec.flags || '';
        const withArg = spec.args || '';
        const long = spec.long || {};
        const opts = {};
        const operands = [];
        let error = null;
        for (let i = 0; i < argv.length; i++) {
            const a = argv[i];
            if (a === '--') { operands.push(...argv.slice(i + 1)); break; }
            if (a.startsWith('--') && a.length > 2) {
                const eq = a.indexOf('=');
                const name = eq === -1 ? a.slice(2) : a.slice(2, eq);
                let key = long[name];
                if (key === undefined) {
                    // allow unique prefix
                    const cands = Object.keys(long).filter((k) => k.startsWith(name));
                    if (cands.length === 1) key = long[cands[0]];
                }
                if (key === undefined) { error = "unrecognized option '" + a + "'"; break; }
                if (key.endsWith('=')) {
                    const k = key.slice(0, -1);
                    let val;
                    if (eq !== -1) val = a.slice(eq + 1);
                    else if (i + 1 < argv.length) val = argv[++i];
                    else { error = "option '" + a + "' requires an argument"; break; }
                    setOpt(opts, k, val, spec);
                } else if (key.endsWith('?')) {
                    opts[key.slice(0, -1)] = eq === -1 ? true : a.slice(eq + 1);
                } else {
                    opts[key] = eq === -1 ? true : a.slice(eq + 1);
                }
                continue;
            }
            if (a.startsWith('-') && a.length > 1 && !(spec.negativeNumbers && /^-\d/.test(a))) {
                if (spec.numeric && /^-\d+$/.test(a)) { opts.num = a.slice(1); continue; }
                for (let j = 1; j < a.length; j++) {
                    const c = a[j];
                    if (withArg.includes(c)) {
                        let val = a.slice(j + 1);
                        if (!val) {
                            if (i + 1 < argv.length) val = argv[++i];
                            else { error = "option requires an argument -- '" + c + "'"; break; }
                        }
                        setOpt(opts, c, val, spec);
                        break;
                    } else if (flags.includes(c)) {
                        opts[c] = (opts[c] === true || typeof opts[c] === 'number') ? (typeof opts[c] === 'number' ? opts[c] + 1 : 2) : true;
                    } else {
                        error = "invalid option -- '" + c + "'";
                        break;
                    }
                }
                if (error) break;
                continue;
            }
            operands.push(a);
            if (spec.stopAtFirst) { operands.push(...argv.slice(i + 1)); break; }
        }
        return { opts, operands, error };
    }
    function setOpt(opts, k, val, spec) {
        if (spec.multi && spec.multi.includes(k)) (opts[k] = opts[k] || []).push(val);
        else opts[k] = val;
    }

    function usageError(ctx, msg) {
        ctx.err(ctx.name + ': ' + msg + "\nTry '" + ctx.name + " --help' for more information.\n");
        return msg && msg.indexOf('invalid') !== -1 ? 2 : 1;
    }

    // Read the given files (or stdin when none / '-'). Returns [{name, content}] and writes errors.
    function readInputs(ctx, files, opts) {
        const results = [];
        let failed = false;
        if (!files.length) files = ['-'];
        for (const f of files) {
            if (f === '-') { results.push({ name: opts && opts.stdinName || '-', content: ctx.stdin.readAll() }); continue; }
            const p = ctx.resolve(f);
            try {
                const node = ctx.fs.get(p);
                if (!node) throw new LA.FsError('ENOENT', f);
                if (node.type === 'dir') throw new LA.FsError('EISDIR', f);
                results.push({ name: f, content: ctx.fs.readFile(p) });
            } catch (e) {
                if (!e.code) throw e;
                ctx.err(ctx.name + ': ' + f + ': ' + e.message + '\n');
                failed = true;
            }
        }
        results.failed = failed;
        return results;
    }

    function splitLines(text) {
        if (text === '') return [];
        const lines = text.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    }
    function joinLines(lines) { return lines.length ? lines.join('\n') + '\n' : ''; }

    function humanSize(bytes, si) {
        const base = si ? 1000 : 1024;
        const units = ['', 'K', 'M', 'G', 'T', 'P'];
        if (bytes < base) return String(bytes);
        let v = bytes, i = 0;
        while (v >= base && i < units.length - 1) { v /= base; i++; }
        return (v < 10 ? (Math.ceil(v * 10) / 10).toFixed(1) : String(Math.ceil(v))) + units[i];
    }

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    function p2(n) { return n < 10 ? '0' + n : String(n); }
    function lsDate(ms) {
        const d = new Date(ms);
        const sixMonths = 1000 * 60 * 60 * 24 * 182;
        const recent = Math.abs(Date.now() - ms) < sixMonths;
        const day = String(d.getDate()).padStart(2, ' ');
        return MONTHS[d.getMonth()] + ' ' + day + ' ' + (recent ? p2(d.getHours()) + ':' + p2(d.getMinutes()) : ' ' + d.getFullYear());
    }
    function isoDate(ms) {
        const d = new Date(ms);
        return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    }
    function tzOffset(d) {
        const off = -d.getTimezoneOffset();
        const sign = off >= 0 ? '+' : '-';
        const a = Math.abs(off);
        return sign + p2(Math.floor(a / 60)) + p2(a % 60);
    }
    function tzName() { return 'UTC'; }
    function strftime(fmt, d) {
        let out = '';
        for (let i = 0; i < fmt.length; i++) {
            const c = fmt[i];
            if (c !== '%') { out += c; continue; }
            let f = fmt[++i];
            let noPad = false;
            if (f === '-') { noPad = true; f = fmt[++i]; }
            const pad = (n) => (noPad ? String(n) : p2(n));
            switch (f) {
                case 'Y': out += d.getFullYear(); break;
                case 'y': out += p2(d.getFullYear() % 100); break;
                case 'm': out += pad(d.getMonth() + 1); break;
                case 'd': out += pad(d.getDate()); break;
                case 'e': out += String(d.getDate()).padStart(2, ' '); break;
                case 'H': out += pad(d.getHours()); break;
                case 'I': out += pad(d.getHours() % 12 || 12); break;
                case 'M': out += pad(d.getMinutes()); break;
                case 'S': out += pad(d.getSeconds()); break;
                case 'N': out += String(d.getMilliseconds() * 1000000).padStart(9, '0'); break;
                case 'p': out += d.getHours() < 12 ? 'AM' : 'PM'; break;
                case 'P': out += d.getHours() < 12 ? 'am' : 'pm'; break;
                case 'a': out += DAYS[d.getDay()]; break;
                case 'A': out += FULL_DAYS[d.getDay()]; break;
                case 'b': case 'h': out += MONTHS[d.getMonth()]; break;
                case 'B': out += FULL_MONTHS[d.getMonth()]; break;
                case 'j': out += String(Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)).padStart(3, '0'); break;
                case 'u': out += d.getDay() || 7; break;
                case 'w': out += d.getDay(); break;
                case 's': out += Math.floor(d.getTime() / 1000); break;
                case 'Z': out += tzName(); break;
                case 'z': out += tzOffset(d); break;
                case 'F': out += d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); break;
                case 'T': out += p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); break;
                case 'R': out += p2(d.getHours()) + ':' + p2(d.getMinutes()); break;
                case 'D': out += p2(d.getMonth() + 1) + '/' + p2(d.getDate()) + '/' + p2(d.getFullYear() % 100); break;
                case 'c': out += DAYS[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, ' ') + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + ' ' + d.getFullYear(); break;
                case 'x': out += p2(d.getMonth() + 1) + '/' + p2(d.getDate()) + '/' + p2(d.getFullYear() % 100); break;
                case 'X': out += p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); break;
                case 'n': out += '\n'; break;
                case 't': out += '\t'; break;
                case 'U': { const start = new Date(d.getFullYear(), 0, 1); out += p2(Math.floor(((d - start) / 86400000 + start.getDay()) / 7)); break; }
                case 'V': { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); out += p2(Math.ceil(((t - y0) / 86400000 + 1) / 7)); break; }
                case '%': out += '%'; break;
                default: out += '%' + (f || '');
            }
        }
        return out;
    }
    function defaultDate(d) {
        // Like GNU date default: "Wed Nov  4 09:50:00 UTC 2026"
        return DAYS[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, ' ') + ' ' +
            p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + ' ' + tzName() + ' ' + d.getFullYear();
    }

    // ---------- ANSI ----------
    const C = {
        reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', ul: '\x1b[4m', inv: '\x1b[7m',
        red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m', gray: '\x1b[90m',
        bred: '\x1b[1;31m', bgreen: '\x1b[1;32m', byellow: '\x1b[1;33m', bblue: '\x1b[1;34m', bmagenta: '\x1b[1;35m', bcyan: '\x1b[1;36m', bwhite: '\x1b[1;37m'
    };
    function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*\x07/g, ''); }

    // ---------- POSIX regex -> JS ----------
    function posixToJs(pattern, extended) {
        let out = '';
        let i = 0;
        const n = pattern.length;
        let atStart = true;
        while (i < n) {
            const c = pattern[i];
            if (c === '[') {
                // bracket expression
                let j = i + 1;
                let body = '';
                if (pattern[j] === '^') { body += '^'; j++; }
                if (pattern[j] === ']') { body += '\\]'; j++; }
                while (j < n && pattern[j] !== ']') {
                    if (pattern[j] === '[' && pattern[j + 1] === ':') {
                        const e = pattern.indexOf(':]', j + 2);
                        if (e !== -1) {
                            const cls = pattern.slice(j + 2, e);
                            body += LA.shellUtil.POSIX_CLASSES[cls] || '';
                            j = e + 2;
                            continue;
                        }
                    }
                    if (pattern[j] === '\\') { body += '\\\\'; j++; continue; }
                    if (pattern[j] === '[' ) { body += '\\['; j++; continue; }
                    body += pattern[j++];
                }
                if (j >= n) { out += '\\['; i++; continue; }
                out += '[' + body + ']';
                i = j + 1;
                atStart = false;
                continue;
            }
            if (c === '\\' && i + 1 < n) {
                const d = pattern[i + 1];
                i += 2;
                if (!extended && '(){}|+?'.includes(d)) { out += d; atStart = d === '(' || d === '|'; continue; }
                if (d === '<' || d === '>') { out += '\\b'; continue; }
                if (/[wWsSbB1-9]/.test(d)) { out += '\\' + d; atStart = false; continue; }
                if (d === 'n') { out += '\\n'; continue; }
                if (d === 't') { out += '\\t'; continue; }
                out += /[A-Za-z0-9]/.test(d) ? d : '\\' + d;
                atStart = false;
                continue;
            }
            if (!extended && '(){}|+?'.includes(c)) { out += '\\' + c; i++; atStart = false; continue; }
            if (c === '*' && atStart) { out += '\\*'; i++; atStart = false; continue; }
            if (extended && c === '{' && !/^\{\d+(,\d*)?\}/.test(pattern.slice(i))) { out += '\\{'; i++; continue; }
            if (c === '/') { out += '\\/'; i++; continue; }
            out += c;
            atStart = (c === '^' && atStart) || (extended && (c === '(' || c === '|'));
            i++;
        }
        return out;
    }
    function buildRegex(pattern, opts) {
        opts = opts || {};
        let src;
        if (opts.fixed) src = LA.shellUtil.escapeRe(pattern);
        else src = posixToJs(pattern, opts.extended);
        if (opts.word) src = '(?<![A-Za-z0-9_])(?:' + src + ')(?![A-Za-z0-9_])';
        if (opts.line) src = '^(?:' + src + ')$';
        return new RegExp(src, (opts.ignoreCase ? 'i' : '') + (opts.global ? 'g' : ''));
    }

    // ---------- columns (ls style) ----------
    function columnize(items, width, displayLen) {
        displayLen = displayLen || ((s) => stripAnsi(s).length);
        if (!items.length) return '';
        const lens = items.map(displayLen);
        const total = lens.reduce((a, b) => a + b + 2, 0);
        if (total <= width) return items.join('  ') + '\n';
        for (let cols = Math.min(items.length, Math.floor(width / 3)); cols >= 1; cols--) {
            const rows = Math.ceil(items.length / cols);
            const colW = [];
            for (let c = 0; c < cols; c++) {
                let w = 0;
                for (let r = 0; r < rows; r++) { const k = c * rows + r; if (k < items.length) w = Math.max(w, lens[k]); }
                colW.push(w);
            }
            const tw = colW.reduce((a, b) => a + b, 0) + (cols - 1) * 2;
            if (tw <= width || cols === 1) {
                let out = '';
                for (let r = 0; r < rows; r++) {
                    let line = '';
                    for (let c = 0; c < cols; c++) {
                        const k = c * rows + r;
                        if (k >= items.length) continue;
                        const isLast = c === cols - 1 || (c + 1) * rows + r >= items.length;
                        line += items[k] + (isLast ? '' : ' '.repeat(colW[c] - lens[k] + 2));
                    }
                    out += line + '\n';
                }
                return out;
            }
        }
        return items.join('\n') + '\n';
    }

    function parseMode(spec, current, isDir) {
        if (/^[0-7]{1,4}$/.test(spec)) return parseInt(spec, 8);
        let mode = current;
        for (const clause of spec.split(',')) {
            const m = /^([ugoa]*)([+\-=])([rwxXst]*)$/.exec(clause);
            if (!m) return null;
            let who = m[1] || 'a';
            if (who.includes('a')) who = 'ugo';
            let bits = 0;
            for (const p of m[3]) {
                for (const w of who) {
                    const shift = w === 'u' ? 6 : w === 'g' ? 3 : 0;
                    if (p === 'r') bits |= 4 << shift;
                    if (p === 'w') bits |= 2 << shift;
                    if (p === 'x' || (p === 'X' && (isDir || current & 0o111))) bits |= 1 << shift;
                    if (p === 's' && w === 'u') bits |= 0o4000;
                    if (p === 's' && w === 'g') bits |= 0o2000;
                    if (p === 't') bits |= 0o1000;
                }
            }
            if (m[2] === '+') mode |= bits;
            else if (m[2] === '-') mode &= ~bits;
            else {
                let mask = 0;
                for (const w of who) mask |= 7 << (w === 'u' ? 6 : w === 'g' ? 3 : 0);
                mode = (mode & ~mask) | bits;
            }
        }
        return mode;
    }

    // seeded RNG used for deterministic simulations
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function hashString(s) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    function register(name, fn, meta) {
        const entry = Object.assign({ fn }, meta || {});
        LA.commands[name] = entry;
        return entry;
    }

    // printf-style formatting used by printf and awk
    function formatPrintf(fmt, args, opts) {
        opts = opts || {};
        let ai = 0;
        let out = '';
        const next = () => (ai < args.length ? args[ai++] : undefined);
        const toNum = (v) => {
            if (v === undefined) return 0;
            if (typeof v === 'number') return v;
            const s = String(v).trim();
            if (/^'./.test(s) || /^"./.test(s)) return s.charCodeAt(1);
            const n = parseFloat(s);
            if (isNaN(n)) { if (opts.onInvalid) opts.onInvalid(s); return 0; }
            if (/^0x/i.test(s)) return parseInt(s, 16);
            return n;
        };
        let consumedAny = false;
        do {
            const startAi = ai;
            for (let i = 0; i < fmt.length; i++) {
                const c = fmt[i];
                if (c === '\\' && opts.escapes) {
                    const r = /^\\(x[0-9a-fA-F]{1,2}|[0-7]{1,3}|.)/.exec(fmt.slice(i));
                    out += LA.shellUtil.unescapeC(r[0]);
                    i += r[0].length - 1;
                    continue;
                }
                if (c !== '%') { out += c; continue; }
                const m = /^%([-+ #0]*)(\*|\d+)?(?:\.(\*|\d+))?([hlLqjzt]*)([diouxXeEfFgGcsb%])/.exec(fmt.slice(i));
                if (!m) { out += c; continue; }
                i += m[0].length - 1;
                let [, fl, width, prec, , conv] = m;
                if (conv === '%') { out += '%'; continue; }
                if (width === '*') width = String(toNum(next()));
                if (prec === '*') prec = String(toNum(next()));
                const arg = next();
                let s;
                switch (conv) {
                    case 'd': case 'i': {
                        const v = Math.trunc(toNum(arg));
                        s = String(Math.abs(v));
                        if (prec !== undefined) s = s.padStart(parseInt(prec, 10), '0');
                        s = (v < 0 ? '-' : fl.includes('+') ? '+' : fl.includes(' ') ? ' ' : '') + s;
                        break;
                    }
                    case 'o': s = (Math.trunc(toNum(arg)) >>> 0).toString(8); if (fl.includes('#')) s = '0' + s; break;
                    case 'u': s = String(Math.trunc(toNum(arg)) >>> 0); break;
                    case 'x': s = (Math.trunc(toNum(arg)) >>> 0).toString(16); if (fl.includes('#') && s !== '0') s = '0x' + s; break;
                    case 'X': s = (Math.trunc(toNum(arg)) >>> 0).toString(16).toUpperCase(); if (fl.includes('#') && s !== '0') s = '0X' + s; break;
                    case 'f': case 'F': {
                        const v = toNum(arg);
                        s = Math.abs(v).toFixed(prec === undefined ? 6 : parseInt(prec, 10));
                        s = (v < 0 || Object.is(v, -0) && false ? '-' : fl.includes('+') ? '+' : fl.includes(' ') ? ' ' : '') + s;
                        break;
                    }
                    case 'e': case 'E': {
                        const v = toNum(arg);
                        s = v.toExponential(prec === undefined ? 6 : parseInt(prec, 10)).replace(/e([+-])(\d)$/, 'e$10$2');
                        if (conv === 'E') s = s.toUpperCase();
                        if (fl.includes('+') && v >= 0) s = '+' + s;
                        break;
                    }
                    case 'g': case 'G': {
                        const v = toNum(arg);
                        const p = prec === undefined ? 6 : Math.max(1, parseInt(prec, 10));
                        if (v === 0) { s = '0'; break; }
                        const exp = Math.floor(Math.log10(Math.abs(v)));
                        if (exp < -4 || exp >= p) {
                            s = v.toExponential(p - 1);
                            if (!fl.includes('#')) s = s.replace(/\.?0+e/, 'e');
                            s = s.replace(/e([+-])(\d)$/, 'e$10$2');
                        } else {
                            s = v.toFixed(Math.max(0, p - 1 - exp));
                            if (!fl.includes('#') && s.includes('.')) s = s.replace(/\.?0+$/, '');
                        }
                        if (conv === 'G') s = s.toUpperCase();
                        break;
                    }
                    case 'c': s = arg === undefined ? '' : (typeof arg === 'number' ? String.fromCharCode(arg) : String(arg).charAt(0)); break;
                    case 'b': s = LA.shellUtil.unescapeC(arg === undefined ? '' : String(arg)); break;
                    case 's': default:
                        s = arg === undefined ? '' : String(arg);
                        if (prec !== undefined) s = s.slice(0, parseInt(prec, 10));
                }
                if (width !== undefined) {
                    const w = parseInt(width, 10);
                    if (s.length < w) {
                        if (fl.includes('-')) s = s.padEnd(w, ' ');
                        else if (fl.includes('0') && 'diouxXeEfFgG'.includes(conv) && prec === undefined) {
                            const sign = /^[+\- ]/.test(s) ? s[0] : '';
                            s = sign + s.slice(sign.length).padStart(w - sign.length, '0');
                        } else s = s.padStart(w, ' ');
                    }
                }
                out += s;
                consumedAny = true;
            }
            if (!opts.repeat || ai === startAi || ai >= args.length) break;
        } while (ai < args.length && consumedAny);
        return out;
    }

    LA.util = {
        getopt, usageError, readInputs, splitLines, joinLines, humanSize, lsDate, isoDate, strftime, defaultDate,
        C, stripAnsi, posixToJs, buildRegex, columnize, parseMode, mulberry32, hashString, register, formatPrintf,
        MONTHS, DAYS, FULL_MONTHS, FULL_DAYS, p2, tzOffset
    };
})();
