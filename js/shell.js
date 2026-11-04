// Linux Arsenal - Bash-compatible shell engine
// Tokenizer -> parser (AST) -> expander -> executor. Runs entirely against the virtual filesystem.
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const VFS = LA.VFS;

    // ------------------------------------------------------------------ errors / signals
    class ShellSyntaxError extends Error {
        constructor(msg, incomplete) { super(msg); this.incomplete = !!incomplete; }
    }
    class BreakSignal { constructor(n) { this.n = n; } }
    class ContinueSignal { constructor(n) { this.n = n; } }
    class ReturnSignal { constructor(code) { this.code = code; } }
    class ExitSignal { constructor(code) { this.code = code; } }
    class LimitError extends Error {}

    // ------------------------------------------------------------------ io
    class Input {
        constructor(text) { this.text = text == null ? '' : String(text); this.pos = 0; }
        readAll() { const s = this.text.slice(this.pos); this.pos = this.text.length; return s; }
        readLine() {
            if (this.pos >= this.text.length) return null;
            let nl = this.text.indexOf('\n', this.pos);
            let line;
            if (nl === -1) { line = this.text.slice(this.pos); this.pos = this.text.length; }
            else { line = this.text.slice(this.pos, nl); this.pos = nl + 1; }
            return line;
        }
        get eof() { return this.pos >= this.text.length; }
    }
    const EMPTY_INPUT = () => new Input('');

    class CollectWriter {
        constructor(limit) { this.buf = []; this.size = 0; this.limit = limit || 8 * 1024 * 1024; }
        write(s) {
            if (!s) return;
            s = String(s);
            this.size += s.length;
            if (this.size > this.limit) throw new LimitError('output limit exceeded');
            this.buf.push(s);
        }
        toString() { return this.buf.join(''); }
    }
    class NullWriter { write() {} }
    class FnWriter { constructor(fn) { this.fn = fn; } write(s) { if (s) this.fn(String(s)); } }

    // ------------------------------------------------------------------ lexer
    const RESERVED = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case', 'esac', '{', '}', '!', 'function', 'select']);
    const OPS = ['&&', '||', ';;', '|&', '|', '&', ';', '(', ')'];
    const REDIRS = ['<<<', '<<-', '&>>', '<<', '>>', '>&', '<&', '&>', '>|', '<>', '>', '<'];

    function isWordBreak(c) {
        return c === undefined || c === ' ' || c === '\t' || c === '\n' || c === '|' || c === '&' || c === ';' || c === '(' || c === ')' || c === '<' || c === '>';
    }

    function lex(src) {
        const tokens = [];
        let i = 0;
        const n = src.length;
        const pendingHeredocs = [];

        // returns index just past the closing char for a balanced $( ... ) / ${ ... } / `...`
        function scanBalanced(start, open, close) {
            let depth = 0;
            let j = start;
            while (j < n) {
                const c = src[j];
                if (c === '\\') { j += 2; continue; }
                if (c === "'" && open !== '{') {
                    const e = src.indexOf("'", j + 1);
                    if (e === -1) throw new ShellSyntaxError('unexpected EOF while looking for matching `\'\'', true);
                    j = e + 1; continue;
                }
                if (c === '"') { j = scanDouble(j + 1); continue; }
                if (c === '`' && open !== '`') { j = scanBacktick(j + 1); continue; }
                if (c === open) depth++;
                else if (c === close) { depth--; if (depth === 0) return j + 1; }
                j++;
            }
            throw new ShellSyntaxError('unexpected EOF while looking for matching `' + close + "'", true);
        }
        function scanBacktick(j) {
            while (j < n) {
                if (src[j] === '\\') { j += 2; continue; }
                if (src[j] === '`') return j + 1;
                j++;
            }
            throw new ShellSyntaxError('unexpected EOF while looking for matching ``\'', true);
        }
        function scanDouble(j) { // j after opening quote; returns index after closing quote
            while (j < n) {
                const c = src[j];
                if (c === '\\') { j += 2; continue; }
                if (c === '"') return j + 1;
                if (c === '$' && src[j + 1] === '(') { j = scanBalanced(j + 1, '(', ')'); continue; }
                if (c === '$' && src[j + 1] === '{') { j = scanBalanced(j + 1, '{', '}'); continue; }
                if (c === '`') { j = scanBacktick(j + 1); continue; }
                j++;
            }
            throw new ShellSyntaxError('unexpected EOF while looking for matching `"\'', true);
        }

        function readHeredocBodies() {
            // i points just after a newline
            while (pendingHeredocs.length) {
                const hd = pendingHeredocs.shift();
                const lines = [];
                let found = false;
                while (i <= n) {
                    if (i >= n) break;
                    let nl = src.indexOf('\n', i);
                    if (nl === -1) nl = n;
                    let line = src.slice(i, nl);
                    i = nl + 1;
                    const cmp = hd.strip ? line.replace(/^\t+/, '') : line;
                    if (cmp === hd.delim) { found = true; break; }
                    lines.push(hd.strip ? line.replace(/^\t+/, '') : line);
                }
                if (!found) throw new ShellSyntaxError('here-document delimited by end-of-file (wanted `' + hd.delim + "')", true);
                hd.token.body = lines.length ? lines.join('\n') + '\n' : '';
            }
        }

        while (i < n) {
            const c = src[i];
            if (c === ' ' || c === '\t') { i++; continue; }
            if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
            if (c === '\n') {
                tokens.push({ type: 'NL' });
                i++;
                if (pendingHeredocs.length) readHeredocBodies();
                continue;
            }
            if (c === '#') {
                while (i < n && src[i] !== '\n') i++;
                continue;
            }
            // arithmetic command (( ... ))
            if (c === '(' && src[i + 1] === '(') {
                const prev = tokens[tokens.length - 1];
                const atCmdStart = !prev || prev.type === 'NL' || (prev.type === 'OP' && prev.value !== ')') ||
                    (prev.type === 'WORD' && (prev.value === 'then' || prev.value === 'do' || prev.value === 'else' || prev.value === '{' || prev.value === '!' || prev.value === 'for'));
                if (atCmdStart) {
                    let depth = 0, j = i;
                    for (; j < n; j++) {
                        if (src[j] === '(') depth++;
                        else if (src[j] === ')') { depth--; if (depth === 0) break; }
                    }
                    if (j >= n) throw new ShellSyntaxError('unexpected EOF while looking for matching `))\'', true);
                    const inner = src.slice(i + 2, j - 1);
                    if (src[j - 1] === ')') {
                        tokens.push({ type: 'ARITH', value: inner });
                        i = j + 1;
                        continue;
                    }
                }
            }
            // fd-prefixed redirect: 2> 2>> 1>&2 etc.
            const fdm = /^(\d+)(?=[<>])/.exec(src.slice(i, i + 4));
            if (fdm) {
                const rest = src.slice(i + fdm[1].length);
                const op = REDIRS.find((r) => rest.startsWith(r) && r[0] !== '&');
                if (op) {
                    i += fdm[1].length + op.length;
                    pushRedir(op, parseInt(fdm[1], 10));
                    continue;
                }
            }
            if ((c === '<' || c === '>') && src[i + 1] === '(') {
                // process substitution <(cmd) becomes a word
                const e = scanBalanced(i + 1, '(', ')');
                tokens.push({ type: 'WORD', value: src.slice(i, e) });
                i = e;
                continue;
            }
            const redir = REDIRS.find((r) => src.startsWith(r, i));
            if (redir) {
                i += redir.length;
                pushRedir(redir, null);
                continue;
            }
            const op = OPS.find((o) => src.startsWith(o, i));
            if (op) {
                tokens.push({ type: 'OP', value: op });
                i += op.length;
                continue;
            }
            // word
            let start = i;
            let raw = '';
            while (i < n && !isWordBreak(src[i])) {
                const ch = src[i];
                if (ch === '\\') {
                    if (src[i + 1] === '\n') { i += 2; continue; }
                    if (i + 1 >= n) { raw += '\\'; i++; continue; }
                    raw += src.slice(i, i + 2); i += 2; continue;
                }
                if (ch === "'") {
                    const e = src.indexOf("'", i + 1);
                    if (e === -1) throw new ShellSyntaxError("unexpected EOF while looking for matching `''", true);
                    raw += src.slice(i, e + 1); i = e + 1; continue;
                }
                if (ch === '"') { const e = scanDouble(i + 1); raw += src.slice(i, e); i = e; continue; }
                if (ch === '`') { const e = scanBacktick(i + 1); raw += src.slice(i, e); i = e; continue; }
                if (ch === '$' && src[i + 1] === '(') { const e = scanBalanced(i + 1, '(', ')'); raw += src.slice(i, e); i = e; continue; }
                if (ch === '$' && src[i + 1] === '{') { const e = scanBalanced(i + 1, '{', '}'); raw += src.slice(i, e); i = e; continue; }
                raw += ch; i++;
                // array assignment name=( ... )
                if (src[i] === '(' && /^[A-Za-z_][A-Za-z0-9_]*\+?=$/.test(raw)) {
                    const e = scanBalanced(i, '(', ')');
                    raw += src.slice(i, e);
                    i = e;
                }
            }
            if (i === start) { raw = src[i]; i++; }
            tokens.push({ type: 'WORD', value: raw });
        }
        if (pendingHeredocs.length) throw new ShellSyntaxError('here-document delimited by end-of-file', true);
        tokens.push({ type: 'EOF' });
        return tokens;

        function pushRedir(op, fd) {
            const tok = { type: 'REDIR', op, fd };
            tokens.push(tok);
            if (op === '<<' || op === '<<-') {
                // read delimiter word now
                while (src[i] === ' ' || src[i] === '\t') i++;
                let delimRaw = '';
                while (i < n && !isWordBreak(src[i])) {
                    if (src[i] === "'") { const e = src.indexOf("'", i + 1); if (e === -1) throw new ShellSyntaxError('bad here-doc', true); delimRaw += src.slice(i, e + 1); i = e + 1; continue; }
                    if (src[i] === '"') { const e = src.indexOf('"', i + 1); if (e === -1) throw new ShellSyntaxError('bad here-doc', true); delimRaw += src.slice(i, e + 1); i = e + 1; continue; }
                    delimRaw += src[i++];
                }
                if (!delimRaw) throw new ShellSyntaxError("syntax error near unexpected token `newline'");
                const quoted = /['"\\]/.test(delimRaw);
                const delim = delimRaw.replace(/['"\\]/g, '');
                tok.heredoc = true;
                tok.quoted = quoted;
                tok.delim = delim;
                pendingHeredocs.push({ delim, strip: op === '<<-', token: tok });
            }
        }
    }

    // ------------------------------------------------------------------ parser
    class Parser {
        constructor(tokens, shell) {
            this.t = tokens;
            this.p = 0;
            this.shell = shell;
            this.aliasDepth = 0;
        }
        peek(o) { return this.t[this.p + (o || 0)]; }
        next() { return this.t[this.p++]; }
        isOp(v, o) { const t = this.peek(o); return t && t.type === 'OP' && t.value === v; }
        isWord(v, o) { const t = this.peek(o); return t && t.type === 'WORD' && t.value === v; }
        eof() { return this.peek().type === 'EOF'; }
        skipNL() { while (this.peek().type === 'NL') this.p++; }
        unexpected(tok) {
            tok = tok || this.peek();
            if (tok.type === 'EOF') throw new ShellSyntaxError('syntax error: unexpected end of file', true);
            const v = tok.type === 'NL' ? 'newline' : tok.value || tok.op;
            throw new ShellSyntaxError("syntax error near unexpected token `" + v + "'");
        }
        expectWord(v) {
            this.skipNL();
            const t = this.peek();
            if (t.type === 'EOF') throw new ShellSyntaxError('syntax error: unexpected end of file', true);
            if (!(t.type === 'WORD' && t.value === v)) this.unexpected(t);
            this.p++;
        }

        parseProgram() {
            const list = this.parseList([]);
            this.skipNL();
            if (!this.eof()) this.unexpected();
            return list;
        }

        // terminators: reserved words that end a list (then, fi, done ...)
        parseList(terms, closeOp) {
            const items = [];
            for (;;) {
                this.skipNL();
                const t = this.peek();
                if (t.type === 'EOF') break;
                if (t.type === 'WORD' && terms.includes(t.value)) break;
                if (t.type === 'OP' && (t.value === ')' || t.value === ';;')) break;
                const node = this.parseAndOr();
                let sep = ';';
                const s = this.peek();
                if (s.type === 'OP' && (s.value === ';' || s.value === '&')) { sep = s.value; this.p++; }
                else if (s.type === 'NL') { this.p++; }
                else if (s.type === 'EOF') { items.push({ node, sep }); break; }
                else if (!(s.type === 'WORD' && terms.includes(s.value)) && !(s.type === 'OP' && (s.value === ')' || s.value === ';;'))) {
                    this.unexpected(s);
                }
                items.push({ node, sep });
            }
            return { type: 'list', items };
        }

        parseAndOr() {
            const first = this.parsePipeline();
            const rest = [];
            while (this.isOp('&&') || this.isOp('||')) {
                const op = this.next().value;
                this.skipNL();
                if (this.eof()) throw new ShellSyntaxError('syntax error: unexpected end of file', true);
                rest.push({ op, node: this.parsePipeline() });
            }
            return rest.length ? { type: 'andor', first, rest } : first;
        }

        parsePipeline() {
            let bang = false;
            if (this.isWord('!')) { this.p++; bang = true; }
            const cmds = [this.parseCommand()];
            while (this.isOp('|') || this.isOp('|&')) {
                const op = this.next().value;
                if (op === '|&') cmds[cmds.length - 1].redirs.push({ op: '>&', fd: 2, target: '1' });
                this.skipNL();
                if (this.eof()) throw new ShellSyntaxError('syntax error: unexpected end of file', true);
                cmds.push(this.parseCommand());
            }
            if (cmds.length === 1 && !bang) return cmds[0];
            return { type: 'pipeline', cmds, bang };
        }

        parseCommand() {
            const t = this.peek();
            let node;
            if (t.type === 'WORD') {
                switch (t.value) {
                    case 'if': node = this.parseIf(); break;
                    case 'for': node = this.parseFor(); break;
                    case 'while': case 'until': node = this.parseWhile(); break;
                    case 'case': node = this.parseCase(); break;
                    case '{': {
                        this.p++;
                        const body = this.parseList(['}']);
                        this.expectWord('}');
                        node = { type: 'group', body, redirs: [] };
                        break;
                    }
                    case 'function': {
                        this.p++;
                        const name = this.next();
                        if (!name || name.type !== 'WORD') this.unexpected(name);
                        if (this.isOp('(') && this.isOp(')', 1)) this.p += 2;
                        this.skipNL();
                        node = { type: 'funcdef', name: name.value, body: this.parseCommand(), redirs: [] };
                        return node;
                    }
                    case 'then': case 'elif': case 'else': case 'fi': case 'do': case 'done': case 'esac': case '}': case 'in':
                        this.unexpected(t);
                        break;
                    default:
                        if (this.isOp('(', 1) && this.isOp(')', 2) && /^[A-Za-z_][\w.:-]*$/.test(t.value)) {
                            this.p += 3;
                            this.skipNL();
                            return { type: 'funcdef', name: t.value, body: this.parseCommand(), redirs: [] };
                        }
                        return this.parseSimple();
                }
            } else if (t.type === 'OP' && t.value === '(') {
                this.p++;
                const body = this.parseList([]);
                this.skipNL();
                if (this.eof()) throw new ShellSyntaxError('syntax error: unexpected end of file', true);
                if (!this.isOp(')')) this.unexpected();
                this.p++;
                node = { type: 'subshell', body, redirs: [] };
            } else if (t.type === 'ARITH') {
                this.p++;
                node = { type: 'arith', expr: t.value, redirs: [] };
            } else if (t.type === 'REDIR') {
                return this.parseSimple();
            } else {
                this.unexpected(t);
            }
            // trailing redirections for compound commands
            while (this.peek().type === 'REDIR') node.redirs.push(this.parseRedir());
            return node;
        }

        parseRedir() {
            const r = this.next();
            if (r.heredoc) return { op: r.op, fd: r.fd, heredoc: true, quoted: r.quoted, get body() { return r.body; } };
            const target = this.peek();
            if (target.type !== 'WORD') this.unexpected(target);
            this.p++;
            return { op: r.op, fd: r.fd, target: target.value };
        }

        parseSimple() {
            const assigns = [];
            const words = [];
            const redirs = [];
            for (;;) {
                const t = this.peek();
                if (t.type === 'REDIR') { redirs.push(this.parseRedir()); continue; }
                if (t.type !== 'WORD') break;
                if (!words.length && /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/.test(t.value)) {
                    assigns.push(t.value); this.p++; continue;
                }
                if (!words.length && this.shell && this.aliasDepth < 10) {
                    const alias = this.shell.aliases[t.value];
                    if (alias !== undefined && !this.expandingAliases?.has(t.value)) {
                        // splice alias tokens in place of the word
                        const aliasTokens = lex(alias).filter((x) => x.type !== 'EOF');
                        this.t.splice(this.p, 1, ...aliasTokens);
                        this.aliasDepth++;
                        this.expandingAliases = this.expandingAliases || new Set();
                        this.expandingAliases.add(t.value);
                        if (!aliasTokens.length) continue;
                        const f = this.peek();
                        if (f.type === 'WORD' && ['if', 'for', 'while', 'until', 'case', '{'].includes(f.value)) {
                            return this.parseCommand();
                        }
                        continue;
                    }
                }
                words.push(t.value); this.p++;
            }
            this.expandingAliases = null;
            this.aliasDepth = 0;
            if (!assigns.length && !words.length && !redirs.length) this.unexpected();
            return { type: 'simple', assigns, words, redirs };
        }

        parseIf() {
            this.p++; // if
            const clauses = [];
            let elseBody = null;
            const cond = this.parseList(['then']);
            this.expectWord('then');
            const body = this.parseList(['elif', 'else', 'fi']);
            clauses.push({ cond, body });
            for (;;) {
                this.skipNL();
                const t = this.peek();
                if (t.type === 'EOF') throw new ShellSyntaxError('syntax error: unexpected end of file', true);
                if (this.isWord('elif')) {
                    this.p++;
                    const c = this.parseList(['then']);
                    this.expectWord('then');
                    const b = this.parseList(['elif', 'else', 'fi']);
                    clauses.push({ cond: c, body: b });
                } else if (this.isWord('else')) {
                    this.p++;
                    elseBody = this.parseList(['fi']);
                } else if (this.isWord('fi')) {
                    this.p++;
                    break;
                } else this.unexpected(t);
            }
            return { type: 'if', clauses, elseBody, redirs: [] };
        }

        parseFor() {
            this.p++; // for
            if (this.peek().type === 'ARITH') {
                // for (( init; cond; step ))
                const expr = this.next().value;
                const parts = expr.split(';');
                if (this.isOp(';')) this.p++;
                this.skipNL();
                const body = this.parseDoGroup();
                return { type: 'cfor', init: parts[0] || '', cond: parts[1] || '', step: parts[2] || '', body, redirs: [] };
            }
            const v = this.next();
            if (!v || v.type !== 'WORD') this.unexpected(v);
            let items = null;
            this.skipNLIfThen();
            if (this.isWord('in')) {
                this.p++;
                items = [];
                while (this.peek().type === 'WORD') items.push(this.next().value);
            }
            if (this.isOp(';')) this.p++;
            this.skipNL();
            const body = this.parseDoGroup();
            return { type: 'for', name: v.value, items, body, redirs: [] };
        }
        skipNLIfThen() { while (this.peek().type === 'NL' && this.peek(1).type === 'WORD' && (this.peek(1).value === 'in' || this.peek(1).value === 'do')) this.p++; }

        parseDoGroup() {
            this.expectWord('do');
            const body = this.parseList(['done']);
            this.expectWord('done');
            return body;
        }

        parseWhile() {
            const until = this.next().value === 'until';
            const cond = this.parseList(['do']);
            const body = this.parseDoGroup();
            return { type: 'while', until, cond, body, redirs: [] };
        }

        parseCase() {
            this.p++;
            const w = this.next();
            if (!w || w.type !== 'WORD') this.unexpected(w);
            this.skipNL();
            this.expectWord('in');
            const items = [];
            for (;;) {
                this.skipNL();
                if (this.isWord('esac')) { this.p++; break; }
                if (this.eof()) throw new ShellSyntaxError('syntax error: unexpected end of file', true);
                if (this.isOp('(')) this.p++;
                const patterns = [];
                for (;;) {
                    const p = this.next();
                    if (!p || p.type !== 'WORD') this.unexpected(p);
                    patterns.push(p.value);
                    if (this.isOp('|')) { this.p++; continue; }
                    break;
                }
                if (!this.isOp(')')) this.unexpected();
                this.p++;
                const body = this.parseList(['esac']);
                items.push({ patterns, body });
                if (this.isOp(';;')) { this.p++; continue; }
                this.skipNL();
                if (this.isWord('esac')) { this.p++; break; }
                if (this.eof()) throw new ShellSyntaxError('syntax error: unexpected end of file', true);
            }
            return { type: 'case', word: w.value, items, redirs: [] };
        }
    }

    function parse(src, shell) {
        return new Parser(lex(src), shell).parseProgram();
    }

    // ------------------------------------------------------------------ glob helpers
    function globToRegexSource(pat, opts) {
        // pat may contain backslash escapes for literal chars
        let re = '';
        for (let i = 0; i < pat.length; i++) {
            const c = pat[i];
            if (c === '\\' && i + 1 < pat.length) { re += escapeRe(pat[++i]); continue; }
            if (c === '*') { re += opts && opts.pathname ? '[^/]*' : '[\\s\\S]*'; continue; }
            if (c === '?') { re += opts && opts.pathname ? '[^/]' : '[\\s\\S]'; continue; }
            if (c === '[') {
                let j = i + 1;
                if (pat[j] === '!' || pat[j] === '^') j++;
                if (pat[j] === ']') j++;
                while (j < pat.length && pat[j] !== ']') j++;
                if (j >= pat.length) { re += '\\['; continue; }
                let body = pat.slice(i + 1, j);
                if (body[0] === '!') body = '^' + body.slice(1);
                body = body.replace(/\[:(\w+):\]/g, (m, cls) => POSIX_CLASSES[cls] || m).replace(/\\(?!\w)/g, '\\\\');
                re += '[' + body + ']';
                i = j;
                continue;
            }
            re += escapeRe(c);
        }
        return re;
    }
    const POSIX_CLASSES = {
        alpha: 'A-Za-z', digit: '0-9', alnum: 'A-Za-z0-9', upper: 'A-Z', lower: 'a-z', space: '\\s',
        blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f', word: '\\w', cntrl: '\\x00-\\x1f', print: ' -~', graph: '!-~'
    };
    function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
    function globMatch(pattern, str, opts) {
        try { return new RegExp('^' + globToRegexSource(pattern, opts) + '$', opts && opts.nocase ? 'i' : '').test(str); }
        catch (e) { return pattern === str; }
    }
    function hasGlobChars(s) {
        for (let i = 0; i < s.length; i++) {
            if (s[i] === '\\') { i++; continue; }
            if (s[i] === '*' || s[i] === '?' || s[i] === '[') return true;
        }
        return false;
    }
    function unescapeGlob(s) { return s.replace(/\\(.)/g, '$1'); }

    // ------------------------------------------------------------------ brace expansion
    function braceExpand(word) {
        // find first top-level unquoted {...} containing , or ..
        let depth = 0, start = -1, q = null;
        for (let i = 0; i < word.length; i++) {
            const c = word[i];
            if (q) { if (c === q) q = null; else if (c === '\\' && q === '"') i++; continue; }
            if (c === '\\') { i++; continue; }
            if (c === "'" || c === '"') { q = c; continue; }
            if (c === '$' && word[i + 1] === '{') { // skip parameter expansion
                let d = 0;
                for (; i < word.length; i++) { if (word[i] === '{') d++; else if (word[i] === '}') { d--; if (!d) break; } }
                continue;
            }
            if (c === '{') { if (depth === 0) start = i; depth++; }
            else if (c === '}' && depth > 0) {
                depth--;
                if (depth === 0 && start >= 0) {
                    const inner = word.slice(start + 1, i);
                    const pre = word.slice(0, start), post = word.slice(i + 1);
                    const parts = splitTopLevelCommas(inner);
                    let alts = null;
                    if (parts.length > 1) alts = parts;
                    else {
                        const m = /^(-?\d+|[A-Za-z])\.\.(-?\d+|[A-Za-z])(?:\.\.(-?\d+))?$/.exec(inner);
                        if (m) alts = rangeSeq(m[1], m[2], m[3]);
                    }
                    if (alts) {
                        const out = [];
                        for (const a of alts) for (const r of braceExpand(pre + a + post)) out.push(r);
                        return out;
                    }
                    start = -1;
                }
            }
        }
        return [word];
    }
    function splitTopLevelCommas(s) {
        const parts = [];
        let depth = 0, cur = '', q = null;
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (q) { cur += c; if (c === q) q = null; continue; }
            if (c === "'" || c === '"') { q = c; cur += c; continue; }
            if (c === '\\') { cur += c + (s[i + 1] || ''); i++; continue; }
            if (c === '{') depth++;
            if (c === '}') depth--;
            if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
            cur += c;
        }
        parts.push(cur);
        return parts;
    }
    function rangeSeq(a, b, step) {
        const isNum = /^-?\d+$/.test(a) && /^-?\d+$/.test(b);
        let s = Math.abs(parseInt(step || '1', 10)) || 1;
        const out = [];
        if (isNum) {
            const x = parseInt(a, 10), y = parseInt(b, 10);
            const width = (a.replace('-', '').startsWith('0') && a.length > 1) || (b.replace('-', '').startsWith('0') && b.length > 1) ? Math.max(a.length, b.length) : 0;
            if (x <= y) for (let k = x; k <= y && out.length < 100000; k += s) out.push(pad(k, width));
            else for (let k = x; k >= y && out.length < 100000; k -= s) out.push(pad(k, width));
        } else {
            const x = a.charCodeAt(0), y = b.charCodeAt(0);
            if (x <= y) for (let k = x; k <= y; k += s) out.push(String.fromCharCode(k));
            else for (let k = x; k >= y; k -= s) out.push(String.fromCharCode(k));
        }
        return out;
        function pad(k, w) { const neg = k < 0; let str = String(Math.abs(k)); while (str.length < w - (neg ? 1 : 0)) str = '0' + str; return (neg ? '-' : '') + str; }
    }

    // ------------------------------------------------------------------ arithmetic
    function evalArith(expr, shell) {
        const src = String(expr);
        let i = 0;
        const toks = [];
        while (i < src.length) {
            const c = src[i];
            if (/\s/.test(c)) { i++; continue; }
            let m;
            const rest = src.slice(i);
            if ((m = /^(0[xX][0-9a-fA-F]+|\d+#[0-9a-zA-Z]+|\d+)/.exec(rest))) { toks.push({ t: 'n', v: m[1] }); i += m[1].length; continue; }
            if ((m = /^\$?\{?([A-Za-z_][A-Za-z0-9_]*)\}?/.exec(rest))) { toks.push({ t: 'id', v: m[1] }); i += m[0].length; continue; }
            if ((m = /^\$(\d|#|\?)/.exec(rest))) { toks.push({ t: 'n', v: String(shell.getVar(m[1]) || 0) }); i += m[0].length; continue; }
            const ops = ['**=', '<<=', '>>=', '&&', '||', '==', '!=', '<=', '>=', '<<', '>>', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**',
                '+', '-', '*', '/', '%', '<', '>', '=', '!', '~', '&', '|', '^', '(', ')', '?', ':', ','];
            const op = ops.find((o) => src.startsWith(o, i));
            if (!op) throw new Error('syntax error: invalid arithmetic operator (error token is "' + rest + '")');
            toks.push({ t: 'op', v: op });
            i += op.length;
        }
        let p = 0;
        const peek = () => toks[p];
        const isOp = (v) => toks[p] && toks[p].t === 'op' && toks[p].v === v;
        const num = (s) => {
            if (/^0[xX]/.test(s)) return parseInt(s, 16);
            if (/^\d+#/.test(s)) { const [b, d] = s.split('#'); return parseInt(d, parseInt(b, 10)); }
            if (/^0\d+$/.test(s)) return parseInt(s, 8);
            return parseInt(s, 10);
        };
        const getv = (name) => {
            const v = shell.getVar(name);
            if (v === undefined || v === '') return 0;
            if (/^-?\d+$/.test(String(v).trim())) return parseInt(v, 10);
            try { return evalArith(v, shell); } catch (e) { return 0; }
        };
        const setv = (name, val) => { shell.setVar(name, String(val)); return val; };
        const int = (x) => (x | 0) === x ? x : Math.trunc(x);

        function primary() {
            const t = peek();
            if (!t) throw new Error('syntax error: operand expected');
            if (t.t === 'n') { p++; return { v: num(t.v) }; }
            if (t.t === 'id') {
                p++;
                if (isOp('++') || isOp('--')) { const o = toks[p++].v; const old = getv(t.v); setv(t.v, old + (o === '++' ? 1 : -1)); return { v: old }; }
                return { v: getv(t.v), name: t.v };
            }
            if (isOp('(')) { p++; const v = comma(); if (!isOp(')')) throw new Error("syntax error: missing ')'"); p++; return { v }; }
            throw new Error('syntax error: operand expected (error token is "' + (t.v || '') + '")');
        }
        function unary() {
            if (isOp('++') || isOp('--')) {
                const o = toks[p++].v; const t = peek();
                if (!t || t.t !== 'id') throw new Error('syntax error');
                p++;
                return { v: setv(t.v, getv(t.v) + (o === '++' ? 1 : -1)) };
            }
            if (isOp('-')) { p++; return { v: -unary().v }; }
            if (isOp('+')) { p++; return { v: +unary().v }; }
            if (isOp('!')) { p++; return { v: unary().v ? 0 : 1 }; }
            if (isOp('~')) { p++; return { v: ~unary().v }; }
            return primary();
        }
        function power() {
            const base = unary();
            if (isOp('**')) { p++; const e = power(); return { v: Math.pow(base.v, e.v) }; }
            return base;
        }
        const BIN = [
            ['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']
        ];
        function binary(level) {
            if (level >= BIN.length) return power();
            let left = binary(level + 1);
            while (peek() && peek().t === 'op' && BIN[level].includes(peek().v)) {
                const op = toks[p++].v;
                if (op === '&&' && !left.v) { skipTo(level + 1); left = { v: 0 }; continue; }
                if (op === '||' && left.v) { skipTo(level + 1); left = { v: 1 }; continue; }
                const right = binary(level + 1);
                const a = left.v, b = right.v;
                let v;
                switch (op) {
                    case '||': v = a || b ? 1 : 0; break;
                    case '&&': v = a && b ? 1 : 0; break;
                    case '|': v = a | b; break;
                    case '^': v = a ^ b; break;
                    case '&': v = a & b; break;
                    case '==': v = a === b ? 1 : 0; break;
                    case '!=': v = a !== b ? 1 : 0; break;
                    case '<': v = a < b ? 1 : 0; break;
                    case '>': v = a > b ? 1 : 0; break;
                    case '<=': v = a <= b ? 1 : 0; break;
                    case '>=': v = a >= b ? 1 : 0; break;
                    case '<<': v = a << b; break;
                    case '>>': v = a >> b; break;
                    case '+': v = a + b; break;
                    case '-': v = a - b; break;
                    case '*': v = a * b; break;
                    case '/': if (b === 0) throw new Error('division by 0 (error token is "' + b + '")'); v = int(a / b); break;
                    case '%': if (b === 0) throw new Error('division by 0 (error token is "' + b + '")'); v = a % b; break;
                }
                left = { v };
            }
            return left;
        }
        function skipTo(level) {
            // evaluate-and-discard right operand without side effects is complex; just evaluate it
            binary(level);
        }
        function ternary() {
            const c = binary(0);
            if (isOp('?')) {
                p++;
                const a = assign();
                if (!isOp(':')) throw new Error("syntax error: expected ':'");
                p++;
                const b = assign();
                return { v: c.v ? a.v : b.v };
            }
            return c;
        }
        function assign() {
            const t = peek(), o = toks[p + 1];
            if (t && t.t === 'id' && o && o.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '|=', '^=', '**='].includes(o.v)) {
                p += 2;
                const r = assign().v;
                const cur = getv(t.v);
                let v;
                switch (o.v) {
                    case '=': v = r; break;
                    case '+=': v = cur + r; break;
                    case '-=': v = cur - r; break;
                    case '*=': v = cur * r; break;
                    case '/=': if (!r) throw new Error('division by 0'); v = int(cur / r); break;
                    case '%=': if (!r) throw new Error('division by 0'); v = cur % r; break;
                    case '<<=': v = cur << r; break;
                    case '>>=': v = cur >> r; break;
                    case '&=': v = cur & r; break;
                    case '|=': v = cur | r; break;
                    case '^=': v = cur ^ r; break;
                    case '**=': v = Math.pow(cur, r); break;
                }
                return { v: setv(t.v, v) };
            }
            return ternary();
        }
        function comma() {
            let v = assign();
            while (isOp(',')) { p++; v = assign(); }
            return v.v;
        }
        if (!toks.length) return 0;
        const result = comma();
        if (p < toks.length) throw new Error('syntax error in expression (error token is "' + toks.slice(p).map((x) => x.v).join(' ') + '")');
        return int(result);
    }

    // ------------------------------------------------------------------ shell
    let pidCounter = 4000;

    class Shell {
        constructor(opts) {
            opts = opts || {};
            this.fs = opts.fs || new VFS();
            this.system = opts.system || (LA.createSystemState ? LA.createSystemState() : {});
            this.user = opts.user || 'user';
            this.hostname = opts.hostname || 'linux-arsenal';
            this.vars = new Map();
            this.aliases = Object.create(null);
            this.functions = Object.create(null);
            this.positional = [];
            this.lastStatus = 0;
            this.pid = ++pidCounter;
            this.lastBgPid = '';
            this.history = [];
            this.options = { xtrace: false, errexit: false, noclobber: false, pipefail: false };
            this.jobs = [];
            this.dirStack = [];
            this.localStack = [];
            this.userStack = [];
            this.ui = opts.ui || null;
            this.columns = 80;
            this.rows = 24;
            this.startTime = Date.now();
            this.steps = 0;
            this.maxSteps = opts.maxSteps || 200000;
            this.execLog = [];
            this.commands = LA.commands || {};
            const home = this.user === 'root' ? '/root' : '/home/' + this.user;
            this.cwd = opts.cwd || home;
            this.initVars(home);
            this.applyUser();
        }

        initVars(home) {
            const set = (k, v) => this.vars.set(k, { value: v, exported: true });
            set('HOME', home);
            set('USER', this.user);
            set('LOGNAME', this.user);
            set('SHELL', '/bin/bash');
            set('PATH', '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin');
            set('PWD', this.cwd);
            set('OLDPWD', this.cwd);
            set('TERM', 'xterm-256color');
            set('LANG', 'en_US.UTF-8');
            set('HOSTNAME', this.hostname);
            set('SHLVL', '1');
            set('EDITOR', 'nano');
            set('PAGER', 'less');
            this.vars.set('PS1', { value: '\\[\\e[1;32m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ ', exported: false });
            this.vars.set('PS2', { value: '> ', exported: false });
            this.vars.set('IFS', { value: ' \t\n', exported: false });
        }

        applyUser() {
            const groups = this.system.groupsOf ? this.system.groupsOf(this.user) : [this.user];
            this.fs.user = { name: this.user, groups };
        }

        get home() { return this.getVar('HOME') || '/'; }

        // ---------- variables ----------
        getVar(name) {
            switch (name) {
                case '?': return String(this.lastStatus);
                case '$': return String(this.pid);
                case '!': return String(this.lastBgPid);
                case '#': return String(this.positional.length);
                case '0': return 'bash';
                case '@': case '*': return this.positional.join(' ');
                case 'RANDOM': return String(Math.floor(Math.random() * 32768));
                case 'SECONDS': return String(Math.floor((Date.now() - this.startTime) / 1000));
                case 'UID': case 'EUID': return String(this.system.uidOf ? this.system.uidOf(this.user) : 1000);
                case 'PPID': return String(this.pid - 1);
                case 'COLUMNS': return String(this.columns);
                case 'LINES': return String(this.rows);
            }
            if (/^\d+$/.test(name)) return this.positional[parseInt(name, 10) - 1];
            const v = this.vars.get(name);
            return v ? v.value : undefined;
        }
        setVar(name, value, opts) {
            if (this.readonlyVars && this.readonlyVars.has(name)) throw new Error(name + ': readonly variable');
            const existing = this.vars.get(name);
            const exported = (opts && opts.exported) || (existing && existing.exported) || false;
            if (existing && existing.array) { const arr = existing.array.slice(); arr[0] = String(value); this.vars.set(name, { value: String(value), exported, array: arr }); }
            else this.vars.set(name, { value: String(value), exported });
            if (name === 'PWD') this.cwd = String(value);
        }
        unsetVar(name) {
            const m = /^([A-Za-z_][A-Za-z0-9_]*)\[(.*)\]$/.exec(name);
            if (m) { const arr = this.getArray(m[1]).slice(); delete arr[parseInt(m[2], 10)]; this.setArray(m[1], arr); return; }
            this.vars.delete(name);
        }
        getArray(name) {
            const v = this.vars.get(name);
            if (!v) return [];
            if (v.array) return v.array;
            return [v.value];
        }
        setArray(name, arr) {
            const existing = this.vars.get(name);
            this.vars.set(name, { value: arr[0] === undefined ? '' : arr[0], exported: existing ? existing.exported : false, array: arr });
        }
        exportVar(name) {
            const v = this.vars.get(name);
            if (v) v.exported = true; else this.vars.set(name, { value: '', exported: true, unsetExport: true });
        }
        envObject() {
            const env = {};
            for (const [k, v] of this.vars) if (v.exported && !v.unsetExport) env[k] = v.value;
            env.PWD = this.cwd;
            return env;
        }

        resolve(path) { return VFS.normalize(path, this.cwd, this.home); }

        // ---------- prompt ----------
        promptString(which) {
            const ps = this.getVar(which || 'PS1') || '';
            const home = this.home;
            let w = this.cwd;
            if (w === home) w = '~'; else if (home !== '/' && w.startsWith(home + '/')) w = '~' + w.slice(home.length);
            const now = new Date();
            let out = '';
            for (let i = 0; i < ps.length; i++) {
                const c = ps[i];
                if (c !== '\\') { out += c; continue; }
                const d = ps[++i];
                switch (d) {
                    case 'u': out += this.user; break;
                    case 'h': out += this.hostname.split('.')[0]; break;
                    case 'H': out += this.hostname; break;
                    case 'w': out += w; break;
                    case 'W': out += this.cwd === home ? '~' : (this.cwd === '/' ? '/' : VFS.basename(this.cwd)); break;
                    case '$': out += this.user === 'root' ? '#' : '$'; break;
                    case 'n': out += '\n'; break;
                    case 't': out += now.toTimeString().slice(0, 8); break;
                    case 'T': out += now.toTimeString().slice(0, 8); break;
                    case 'd': out += now.toDateString().slice(0, 10); break;
                    case '@': out += now.toLocaleTimeString(); break;
                    case 's': out += 'bash'; break;
                    case 'v': case 'V': out += '5.2'; break;
                    case '!': out += String(this.history.length + 1); break;
                    case '#': out += String(this.history.length + 1); break;
                    case '[': case ']': break;
                    case 'e': out += '\x1b'; break;
                    case '0': if (ps.slice(i, i + 3) === '033') { out += '\x1b'; i += 2; } else out += '\\0'; break;
                    case 'a': out += '\x07'; break;
                    case '\\': out += '\\'; break;
                    default: out += '\\' + (d || '');
                }
            }
            return out;
        }

        // ---------- history expansion (!!, !n, !str, !$, ^a^b) ----------
        expandHistory(line) {
            const hist = this.history;
            if (!hist.length || (line.indexOf('!') === -1 && line[0] !== '^')) return { line, changed: false };
            if (line[0] === '^') {
                const m = /^\^([^^]*)\^([^^]*)\^?(.*)$/.exec(line);
                if (m) {
                    const prev = hist[hist.length - 1];
                    if (prev.indexOf(m[1]) === -1) throw new Error(':s' + m[1] + ': substitution failed');
                    return { line: prev.replace(m[1], m[2]) + m[3], changed: true };
                }
            }
            let out = '', changed = false, q = null;
            for (let i = 0; i < line.length; i++) {
                const c = line[i];
                if (c === "'" && q !== '"') { q = q ? null : "'"; out += c; continue; }
                if (c === '"' && q !== "'") { q = q ? null : '"'; out += c; continue; }
                if (c === '\\') { out += c + (line[i + 1] || ''); i++; continue; }
                if (c !== '!' || q === "'") { out += c; continue; }
                const rest = line.slice(i + 1);
                let m;
                if (rest[0] === '!') { out += hist[hist.length - 1]; i += 1; changed = true; continue; }
                if (rest[0] === '$') { const last = hist[hist.length - 1].trim().split(/\s+/); out += last[last.length - 1]; i += 1; changed = true; continue; }
                if ((m = /^-?\d+/.exec(rest))) {
                    const nnum = parseInt(m[0], 10);
                    const idx = nnum < 0 ? hist.length + nnum : nnum - 1;
                    if (idx < 0 || idx >= hist.length) throw new Error('!' + m[0] + ': event not found');
                    out += hist[idx]; i += m[0].length; changed = true; continue;
                }
                if ((m = /^[A-Za-z_.\/][^\s;|&]*/.exec(rest))) {
                    let found = null;
                    for (let k = hist.length - 1; k >= 0; k--) if (hist[k].startsWith(m[0])) { found = hist[k]; break; }
                    if (found === null) throw new Error('!' + m[0] + ': event not found');
                    out += found; i += m[0].length; changed = true; continue;
                }
                out += c;
            }
            return { line: out, changed };
        }

        // ---------- public API ----------
        // Run source text. `io` = { stdout: writer, stderr: writer, stdin?: string, tty?: bool }
        run(src, io) {
            io = io || {};
            const ctx = {
                stdin: io.stdin instanceof Input ? io.stdin : new Input(io.stdin || ''),
                stdout: io.stdout || new NullWriter(),
                stderr: io.stderr || io.stdout || new NullWriter(),
                tty: !!io.tty,
                ttyOut: io.tty ? io.stdout : null,
                ttyErr: io.tty ? (io.stderr || io.stdout) : null
            };
            this.steps = 0;
            this.execLog = [];
            let ast;
            try {
                ast = parse(src, this);
            } catch (e) {
                if (e instanceof ShellSyntaxError) {
                    if (e.incomplete && io.allowIncomplete) throw e;
                    ctx.stderr.write('bash: ' + e.message + '\n');
                    this.lastStatus = 2;
                    return 2;
                }
                throw e;
            }
            try {
                this.lastStatus = this.execNode(ast, ctx);
            } catch (e) {
                if (e instanceof ExitSignal) { this.lastStatus = e.code; this.exitRequested = true; }
                else if (e instanceof ReturnSignal) { this.lastStatus = e.code; }
                else if (e instanceof BreakSignal || e instanceof ContinueSignal) { /* ignore at top level */ }
                else if (e instanceof LimitError) { ctx.stderr.write('bash: ' + e.message + ' (sandbox safety limit)\n'); this.lastStatus = 130; }
                else { ctx.stderr.write('bash: ' + (e && e.message ? e.message : String(e)) + '\n'); this.lastStatus = 1; }
            }
            return this.lastStatus;
        }

        // Convenience for tests / internal use: run and capture output.
        exec(src, opts) {
            opts = opts || {};
            const out = new CollectWriter();
            const err = new CollectWriter();
            const code = this.run(src, { stdout: out, stderr: opts.mergeErr ? out : err, stdin: opts.stdin, tty: !!opts.tty });
            return { stdout: out.toString(), stderr: opts.mergeErr ? '' : err.toString(), code };
        }

        isIncomplete(src) {
            try { parse(src, null); return false; }
            catch (e) { return e instanceof ShellSyntaxError && e.incomplete; }
        }

        tick() {
            if (++this.steps > this.maxSteps) throw new LimitError('execution step limit reached (possible infinite loop)');
        }

        // ---------- executor ----------
        execNode(node, io) {
            switch (node.type) {
                case 'list': return this.execList(node, io);
                case 'andor': return this.execAndOr(node, io);
                case 'pipeline': return this.execPipeline(node, io);
                case 'simple': return this.execSimple(node, io);
                default: return this.withRedirs(node.redirs, io, (rio) => this.execCompound(node, rio));
            }
        }

        execList(node, io) {
            let status = this.lastStatus;
            for (const item of node.items) {
                if (item.sep === '&') {
                    status = this.runBackground(item.node, io);
                } else {
                    status = this.execNode(item.node, io);
                }
                this.lastStatus = status;
                if (this.options.errexit && status !== 0 && item.node.type !== 'andor') throw new ExitSignal(status);
            }
            return status;
        }

        runBackground(node, io) {
            const jobId = this.jobs.length + 1;
            const pid = ++pidCounter;
            this.lastBgPid = pid;
            const text = this.nodeToText(node);
            const sleepMatch = /^sleep\s+(\d+)/.exec(text);
            if (io.ttyErr) io.ttyErr.write('[' + jobId + '] ' + pid + '\n');
            if (sleepMatch && this.system.addProcess) {
                // long-running background job stays alive in the process table
                this.system.addProcess({ pid, user: this.user, cmd: text, until: Date.now() + parseInt(sleepMatch[1], 10) * 1000 });
                this.jobs.push({ id: jobId, pid, cmd: text, state: 'Running' });
                return 0;
            }
            const sub = this.snapshot();
            let status;
            try { status = this.execNode(node, io); } finally { this.restore(sub); }
            this.jobs.push({ id: jobId, pid, cmd: text, state: 'Done', status });
            return 0;
        }

        nodeToText(node) {
            if (node.type === 'simple') return node.assigns.concat(node.words).join(' ');
            if (node.type === 'pipeline') return node.cmds.map((c) => this.nodeToText(c)).join(' | ');
            if (node.type === 'andor') return [this.nodeToText(node.first)].concat(node.rest.map((r) => r.op + ' ' + this.nodeToText(r.node))).join(' ');
            return node.type;
        }

        execAndOr(node, io) {
            let status = this.execNode(node.first, io);
            this.lastStatus = status;
            for (const r of node.rest) {
                if ((r.op === '&&' && status === 0) || (r.op === '||' && status !== 0)) {
                    status = this.execNode(r.node, io);
                    this.lastStatus = status;
                }
            }
            return status;
        }

        execPipeline(node, io) {
            const n = node.cmds.length;
            const prevActive = this.activePipeline;
            this.activePipeline = node.cmds.map((c) => this.nodeToText(c).replace(/['"]/g, ''));
            try { return this.execPipelineInner(node, io, n); }
            finally { this.activePipeline = prevActive; }
        }

        execPipelineInner(node, io, n) {
            let input = io.stdin;
            let status = 0;
            const statuses = [];
            for (let k = 0; k < n; k++) {
                const last = k === n - 1;
                const out = last ? io.stdout : new CollectWriter();
                const stageIo = { stdin: input, stdout: out, stderr: io.stderr, tty: last ? io.tty : false, ttyOut: io.ttyOut, ttyErr: io.ttyErr, piped: !last };
                if (n > 1) {
                    const snap = this.snapshot();
                    try { status = this.execNode(node.cmds[k], stageIo); }
                    catch (e) { if (e instanceof ExitSignal) status = e.code; else throw e; }
                    finally { this.restore(snap); }
                } else {
                    status = this.execNode(node.cmds[k], stageIo);
                }
                statuses.push(status);
                if (!last) input = new Input(out.toString());
            }
            if (this.options.pipefail) status = statuses.reduce((a, s) => (s !== 0 ? s : a), 0);
            this.pipeStatus = statuses;
            if (node.bang) status = status === 0 ? 1 : 0;
            return status;
        }

        snapshot() {
            return {
                cwd: this.cwd,
                vars: new Map(Array.from(this.vars, ([k, v]) => [k, Object.assign({}, v)])),
                aliases: Object.assign(Object.create(null), this.aliases),
                functions: Object.assign(Object.create(null), this.functions),
                positional: this.positional.slice(),
                options: Object.assign({}, this.options),
                user: this.user
            };
        }
        restore(s) {
            this.cwd = s.cwd;
            this.vars = s.vars;
            this.aliases = s.aliases;
            this.functions = s.functions;
            this.positional = s.positional;
            this.options = s.options;
            if (this.user !== s.user) { this.user = s.user; this.applyUser(); }
        }

        execCompound(node, io) {
            switch (node.type) {
                case 'group': return this.execNode(node.body, io);
                case 'subshell': {
                    const snap = this.snapshot();
                    try { return this.execNode(node.body, io); }
                    catch (e) { if (e instanceof ExitSignal) return e.code; throw e; }
                    finally { this.restore(snap); }
                }
                case 'if': {
                    for (const cl of node.clauses) {
                        const c = this.execNode(cl.cond, io);
                        if (c === 0) return this.execNode(cl.body, io);
                    }
                    if (node.elseBody) return this.execNode(node.elseBody, io);
                    return 0;
                }
                case 'for': {
                    let items;
                    if (node.items === null) items = this.positional.slice();
                    else { items = []; for (const w of node.items) items.push(...this.expandWord(w, io)); }
                    let status = 0;
                    for (const it of items) {
                        this.tick();
                        this.setVar(node.name, it);
                        try { status = this.execNode(node.body, io); }
                        catch (e) {
                            if (e instanceof BreakSignal) { if (e.n > 1) { e.n--; throw e; } break; }
                            if (e instanceof ContinueSignal) { if (e.n > 1) { e.n--; throw e; } continue; }
                            throw e;
                        }
                    }
                    return status;
                }
                case 'cfor': {
                    let status = 0;
                    if (node.init.trim()) evalArith(this.expandString(node.init, io), this);
                    for (;;) {
                        this.tick();
                        if (node.cond.trim() && !evalArith(this.expandString(node.cond, io), this)) break;
                        try { status = this.execNode(node.body, io); }
                        catch (e) {
                            if (e instanceof BreakSignal) { if (e.n > 1) { e.n--; throw e; } break; }
                            if (!(e instanceof ContinueSignal)) throw e;
                            if (e.n > 1) { e.n--; throw e; }
                        }
                        if (node.step.trim()) evalArith(this.expandString(node.step, io), this);
                    }
                    return status;
                }
                case 'while': {
                    let status = 0;
                    for (;;) {
                        this.tick();
                        const c = this.execNode(node.cond, io);
                        if (node.until ? c === 0 : c !== 0) break;
                        try { status = this.execNode(node.body, io); }
                        catch (e) {
                            if (e instanceof BreakSignal) { if (e.n > 1) { e.n--; throw e; } break; }
                            if (e instanceof ContinueSignal) { if (e.n > 1) { e.n--; throw e; } continue; }
                            throw e;
                        }
                    }
                    return status;
                }
                case 'case': {
                    const word = this.expandWord(node.word, io, { split: false, glob: false }).join(' ');
                    for (const item of node.items) {
                        for (const pat of item.patterns) {
                            const p = this.expandPattern(pat, io);
                            if (globMatch(p, word)) return this.execNode(item.body, io);
                        }
                    }
                    return 0;
                }
                case 'funcdef': {
                    this.functions[node.name] = node.body;
                    return 0;
                }
                case 'arith': {
                    try {
                        const v = evalArith(this.expandString(node.expr, io), this);
                        return v !== 0 ? 0 : 1;
                    } catch (e) {
                        io.stderr.write('bash: ((: ' + node.expr + ': ' + e.message + '\n');
                        return 1;
                    }
                }
            }
            throw new Error('unknown node ' + node.type);
        }

        // apply redirections, run fn(newIo), then flush
        withRedirs(redirs, io, fn) {
            if (!redirs || !redirs.length) return fn(io);
            const rio = Object.assign({}, io);
            const fds = { 0: io.stdin, 1: io.stdout, 2: io.stderr };
            let ttyLost = false;
            for (const r of redirs) {
                let fd = r.fd;
                try {
                    if (r.heredoc) {
                        let body = r.body || '';
                        if (!r.quoted) body = this.expandHeredoc(body, io);
                        fds[fd == null ? 0 : fd] = new Input(body);
                        continue;
                    }
                    const target = this.expandWord(r.target, io, { split: false, glob: false });
                    if (target.length !== 1 || (target[0] === '' && r.op !== '>&' && r.op !== '<&')) {
                        throw new Error(r.target + ': ambiguous redirect');
                    }
                    const t = target[0];
                    switch (r.op) {
                        case '<': {
                            const p = this.resolve(t);
                            fds[fd == null ? 0 : fd] = new Input(this.fs.readFile(p));
                            break;
                        }
                        case '<<<': fds[fd == null ? 0 : fd] = new Input(t + '\n'); break;
                        case '>': case '>|': case '>>': case '&>': case '&>>': {
                            const append = r.op === '>>' || r.op === '&>>';
                            const w = this.openFileWriter(t, append, r.op === '>' && this.options.noclobber);
                            if (r.op === '&>' || r.op === '&>>') { fds[1] = w; fds[2] = w; ttyLost = true; }
                            else { fds[fd == null ? 1 : fd] = w; if ((fd == null ? 1 : fd) === 1) ttyLost = true; }
                            break;
                        }
                        case '>&': case '<&': {
                            const src = fd == null ? (r.op === '>&' ? 1 : 0) : fd;
                            if (t === '-') { fds[src] = new NullWriter(); break; }
                            if (/^\d+$/.test(t)) {
                                if (!(t in fds)) throw new Error(t + ': Bad file descriptor');
                                fds[src] = fds[t];
                                if (src === 1 && t !== '1') ttyLost = fds[1] !== io.stdout;
                            } else {
                                const w = this.openFileWriter(t, false);
                                fds[1] = w; fds[2] = w; ttyLost = true;
                            }
                            break;
                        }
                        case '<>': fds[fd == null ? 0 : fd] = new Input(this.fs.exists(this.resolve(t)) ? this.fs.readFile(this.resolve(t)) : ''); break;
                    }
                } catch (e) {
                    const msg = e.code ? (r.target + ': ' + e.message) : e.message;
                    io.stderr.write('bash: ' + msg + '\n');
                    return 1;
                }
            }
            rio.stdin = fds[0];
            rio.stdout = fds[1];
            rio.stderr = fds[2];
            if (ttyLost || rio.stdout !== io.stdout) rio.tty = rio.stdout === io.ttyOut && !!io.ttyOut;
            return fn(rio);
        }

        openFileWriter(target, append, noclobber) {
            const path = this.resolve(target);
            if (path === '/dev/null') return new NullWriter();
            if (path === '/dev/stdout' || path === '/dev/tty') return null;
            const fs = this.fs;
            const existing = fs.get(path);
            if (existing && existing.type === 'dir') throw new LA.FsError('EISDIR', target);
            if (noclobber && existing) throw new Error(target + ': cannot overwrite existing file');
            if (!append || !existing) fs.writeFile(path, '');
            else if (!fs.can(existing, 'w')) throw new LA.FsError('EACCES', target);
            return { write: (s) => { if (s) fs.writeFile(path, String(s), { append: true }); }, isFile: true };
        }

        // ---------- simple command ----------
        execSimple(node, io) {
            this.tick();
            this.cmdSubstStatus = null;
            let argv = [];
            for (const w of node.words) {
                const fields = this.expandWord(w, io);
                for (const f of fields) argv.push(f);
            }
            const assigns = node.assigns.map((a) => {
                const eq = a.indexOf('=');
                const append = a[eq - 1] === '+';
                const name = a.slice(0, append ? eq - 1 : eq);
                const valRaw = a.slice(eq + 1);
                let value, array = null;
                if (valRaw.startsWith('(') && valRaw.endsWith(')')) {
                    array = [];
                    for (const t of lex(valRaw.slice(1, -1))) if (t.type === 'WORD') array.push(...this.expandWord(t.value, io));
                    value = array[0] || '';
                } else value = this.expandWord(valRaw, io, { split: false, glob: false, assign: true }).join(' ');
                return { name, value, append, array };
            });
            if (!argv.length) {
                for (const a of assigns) {
                    try {
                        const m = /^([A-Za-z_][A-Za-z0-9_]*)\[(.*)\]$/.exec(a.name);
                        if (a.array) {
                            const prev = a.append ? this.getArray(a.name) : [];
                            this.setArray(a.name, prev.concat(a.array));
                        } else if (m) {
                            const arr = this.getArray(m[1]).slice();
                            const idx = evalArith(this.expandString(m[2], io) || '0', this);
                            arr[idx] = a.append ? (arr[idx] || '') + a.value : a.value;
                            this.setArray(m[1], arr);
                        } else this.setVar(a.name, a.append ? (this.getVar(a.name) || '') + a.value : a.value);
                    }
                    catch (e) { io.stderr.write('bash: ' + e.message + '\n'); return 1; }
                }
                const r = this.withRedirs(node.redirs, io, () => 0);
                if (r !== 0) return r;
                return this.cmdSubstStatus != null ? this.cmdSubstStatus : 0;
            }
            if (this.options.xtrace) io.stderr.write('+ ' + argv.map(quoteArg).join(' ') + '\n');
            // temp env assignments
            let saved = null;
            if (assigns.length) {
                saved = assigns.map((a) => ({ name: a.name, prev: this.vars.get(a.name) }));
                for (const a of assigns) this.vars.set(a.name, { value: a.value, exported: true });
            }
            try {
                return this.withRedirs(node.redirs, io, (rio) => this.execArgv(argv, rio));
            } finally {
                if (saved) for (const s of saved) { if (s.prev) this.vars.set(s.name, s.prev); else this.vars.delete(s.name); }
            }
        }

        // Look up a command name: returns {kind, fn|body|path}
        lookupCommand(name) {
            if (this.functions[name]) return { kind: 'function', body: this.functions[name] };
            const cmd = this.commands[name];
            if (cmd && cmd.builtin) return { kind: 'builtin', cmd };
            if (name.includes('/')) return { kind: 'path', path: this.resolve(name) };
            const pathVar = this.getVar('PATH') || '';
            for (const dir of pathVar.split(':')) {
                if (!dir) continue;
                const p = VFS.normalize(dir + '/' + name, this.cwd, this.home);
                let node = null;
                try { node = this.fs.get(p); } catch (e) { node = null; }
                if (node && node.type === 'file' && (node.mode & 0o111)) return { kind: 'path', path: p, node };
            }
            return null;
        }

        execArgv(argv, io) {
            const name = argv[0];
            this.execLog.push(argv.slice());
            const found = this.lookupCommand(name);
            if (!found) return this.commandNotFound(name, io);
            if (found.kind === 'function') return this.callFunction(found.body, argv, io);
            if (found.kind === 'builtin') return this.callCommand(found.cmd, argv, io);
            // path
            let node;
            try { node = this.fs.get(found.path); } catch (e) { node = null; }
            if (!node) {
                if (name.includes('/')) { io.stderr.write('bash: ' + name + ': No such file or directory\n'); return 127; }
                return this.commandNotFound(name, io);
            }
            if (node.type === 'dir') { io.stderr.write('bash: ' + name + ': Is a directory\n'); return 126; }
            if (!this.fs.can(node, 'x') || !this.fs.can(node, 'r') && !String(node.content).startsWith('#!LA')) {
                io.stderr.write('bash: ' + name + ': Permission denied\n');
                return 126;
            }
            const content = node.content || '';
            const m = /^#!LA-BUILTIN (\S+)/.exec(content);
            if (m) {
                const cmd = this.commands[m[1]];
                if (cmd) return this.callCommand(cmd, argv, io);
                return this.commandNotFound(name, io);
            }
            return this.runScript(content, argv, io);
        }

        commandNotFound(name, io) {
            const cmd = this.commands[name];
            if (cmd && cmd.pkg) {
                io.stderr.write("Command '" + name + "' not found, but can be installed with:\n\nsudo apt install " + cmd.pkg + '\n\n');
                return 127;
            }
            const suggestion = this.suggestCommand(name);
            io.stderr.write(name + ': command not found' + (suggestion ? "\nDid you mean '" + suggestion + "'?" : '') + '\n');
            return 127;
        }

        suggestCommand(name) {
            if (name.length < 2) return null;
            let best = null, bestD = 3;
            for (const k of Object.keys(this.commands)) {
                if (this.commands[k].hidden) continue;
                const d = levenshtein(name, k);
                if (d < bestD || (d === bestD && best && k.length < best.length)) { bestD = d; best = k; }
            }
            return bestD <= (name.length > 4 ? 2 : 1) ? best : null;
        }

        runScript(content, argv, io) {
            const snap = this.snapshot();
            // scripts get a fresh non-exported variable scope
            const exported = new Map();
            for (const [k, v] of this.vars) if (v.exported) exported.set(k, Object.assign({}, v));
            for (const k of ['PS1', 'PS2', 'IFS']) if (this.vars.get(k)) exported.set(k, this.vars.get(k));
            this.vars = exported;
            this.positional = argv.slice(1);
            this.functions = Object.create(null);
            this.aliases = Object.create(null);
            let status = 0;
            try {
                let ast;
                try { ast = parse(content, this); }
                catch (e) { io.stderr.write(argv[0] + ': ' + e.message + '\n'); return 2; }
                status = this.execNode(ast, io);
            } catch (e) {
                if (e instanceof ExitSignal) status = e.code;
                else if (e instanceof ReturnSignal) status = e.code;
                else throw e;
            } finally {
                this.restore(snap);
            }
            return status;
        }

        source(path, args, io) {
            const content = this.fs.readFile(this.resolve(path));
            const savedPos = this.positional;
            if (args && args.length) this.positional = args;
            try {
                const ast = parse(content, this);
                return this.execNode(ast, io);
            } catch (e) {
                if (e instanceof ReturnSignal) return e.code;
                if (e instanceof ShellSyntaxError) { io.stderr.write(path + ': ' + e.message + '\n'); return 2; }
                throw e;
            } finally {
                if (args && args.length) this.positional = savedPos;
            }
        }

        callFunction(body, argv, io) {
            const savedPos = this.positional;
            this.positional = argv.slice(1);
            this.localStack.push(new Map());
            try { return this.execNode(body, io); }
            catch (e) { if (e instanceof ReturnSignal) return e.code; throw e; }
            finally {
                const locals = this.localStack.pop();
                for (const [k, prev] of locals) { if (prev) this.vars.set(k, prev); else this.vars.delete(k); }
                this.positional = savedPos;
            }
        }

        callCommand(cmd, argv, io) {
            const self = this;
            const name = argv[0].split('/').pop();
            const ctx = {
                name,
                argv,
                args: argv.slice(1),
                sh: this,
                fs: this.fs,
                stdin: io.stdin || EMPTY_INPUT(),
                stdout: io.stdout,
                stderr: io.stderr,
                tty: !!io.tty,
                io,
                out(s) { io.stdout.write(s); },
                outln(s) { io.stdout.write((s == null ? '' : s) + '\n'); },
                err(s) { io.stderr.write(s); },
                fail(msg, code) { io.stderr.write(name + ': ' + msg + '\n'); return code == null ? 1 : code; },
                resolve(p) { return self.resolve(p); },
                fsError(e, path) {
                    if (e && e.code) { io.stderr.write(name + ': ' + (path != null ? path + ': ' : '') + e.message + '\n'); return 1; }
                    throw e;
                },
                exec(subArgv, subIo) { return self.execArgv(subArgv, subIo || io); },
                run(src, subIo) { return self.execNode(parse(src, self), subIo || io); }
            };
            try {
                if (argv.indexOf('--help') > 0 && !cmd.ownHelp && LA.docs && LA.docs.helpText) {
                    const h = LA.docs.helpText(name);
                    if (h) { io.stdout.write(h); return 0; }
                }
                const r = cmd.fn(ctx);
                return typeof r === 'number' ? r : 0;
            } catch (e) {
                if (e instanceof BreakSignal || e instanceof ContinueSignal || e instanceof ReturnSignal || e instanceof ExitSignal || e instanceof LimitError) throw e;
                if (e && e.code && e instanceof LA.FsError) { io.stderr.write(name + ': ' + (e.path ? e.path + ': ' : '') + e.message + '\n'); return 1; }
                io.stderr.write(name + ': ' + (e && e.message ? e.message : String(e)) + '\n');
                return 1;
            }
        }

        // ---------- expansion ----------
        expandPattern(raw, io) {
            // like expandWord but returns a glob pattern with quoted chars escaped
            const segs = this.expandSegments(raw, io, { split: false });
            return segs.map((s) => s.quoted ? s.text.replace(/[*?[\]\\]/g, '\\$&') : s.text).join('');
        }

        expandString(raw, io) {
            // expand $vars/$(..) in a string as if inside double quotes
            return this.expandSegments('"' + raw.replace(/(["\\])/g, '\\$1').replace(/\\\$/g, '$') + '"', io, {}).map((s) => s.text).join('');
        }

        expandHeredoc(body, io) {
            let out = '';
            for (let i = 0; i < body.length; i++) {
                const c = body[i];
                if (c === '\\' && (body[i + 1] === '$' || body[i + 1] === '`' || body[i + 1] === '\\')) { out += body[i + 1]; i++; continue; }
                if (c === '\\' && body[i + 1] === '\n') { i++; continue; }
                if (c === '$' || c === '`') {
                    const r = this.expandDollar(body, i, io, true);
                    out += r.text; i = r.end - 1; continue;
                }
                out += c;
            }
            return out;
        }

        expandWord(raw, io, opts) {
            opts = opts || {};
            const words = opts.noBrace ? [raw] : braceExpand(raw);
            const out = [];
            for (const w of words) {
                const segs = this.expandSegments(w, io, opts);
                // field splitting
                const fields = [];
                let cur = null; // {text, pattern, quoted}
                const ensure = () => { if (!cur) cur = { text: '', pattern: '', quoted: false, globbable: false }; return cur; };
                for (const s of segs) {
                    if (s.split && opts.split !== false) {
                        const ifs = this.getVar('IFS');
                        const ifsChars = ifs === undefined ? ' \t\n' : ifs;
                        if (!ifsChars) { const c = ensure(); c.text += s.text; c.pattern += escGlob(s.text, !opts.noGlobInVars); continue; }
                        const re = new RegExp('[' + escapeRe(ifsChars) + ']+');
                        const pieces = s.text.split(re);
                        const leading = s.text.length && ifsChars.includes(s.text[0]);
                        pieces.forEach((p, idx) => {
                            if (idx > 0 || leading) { if (cur) fields.push(cur); cur = null; }
                            if (p !== '') { const c = ensure(); c.text += p; c.pattern += p; if (hasGlobChars(p)) c.globbable = true; }
                        });
                        if (s.text.length && ifsChars.includes(s.text[s.text.length - 1])) { if (cur) fields.push(cur); cur = null; }
                        continue;
                    }
                    if (s.fieldBreak) { if (cur) fields.push(cur); cur = null; continue; }
                    const c = ensure();
                    c.text += s.text;
                    if (s.quoted) { c.quoted = true; c.pattern += escGlob(s.text); }
                    else { c.pattern += s.text; if (hasGlobChars(s.text)) c.globbable = true; }
                }
                if (cur) fields.push(cur);
                for (const f of fields) {
                    if (!f.quoted && f.text === '' && !f.keep) continue;
                    if (opts.glob !== false && f.globbable) {
                        const matches = this.glob(f.pattern);
                        if (matches.length) { out.push(...matches); continue; }
                        out.push(unescapeGlob(f.pattern));
                        continue;
                    }
                    out.push(f.text);
                }
            }
            if (opts.split === false && !out.length) return [''];
            return out;

            function escGlob(t) { return t.replace(/[*?[\]\\]/g, '\\$&'); }
        }

        // Returns array of segments {text, quoted, split}
        expandSegments(raw, io, opts) {
            const segs = [];
            let i = 0;
            const n = raw.length;
            // tilde expansion
            if (raw[0] === '~') {
                const m = /^~([A-Za-z0-9_-]*)(?=\/|$|:)/.exec(raw);
                if (m) {
                    let home = null;
                    if (m[1] === '') home = this.home;
                    else if (m[1] === '+') home = this.cwd;
                    else if (m[1] === '-') home = this.getVar('OLDPWD');
                    else if (this.system.homeOf) home = this.system.homeOf(m[1]);
                    if (home) { segs.push({ text: home, quoted: true }); i = m[0].length; }
                }
            }
            let lit = '';
            const flush = () => { if (lit) { segs.push({ text: lit, quoted: false }); lit = ''; } };
            while (i < n) {
                const c = raw[i];
                if (c === '\\') {
                    flush();
                    if (i + 1 < n) segs.push({ text: raw[i + 1], quoted: true });
                    i += 2;
                    continue;
                }
                if (c === "'") {
                    flush();
                    const e = raw.indexOf("'", i + 1);
                    segs.push({ text: raw.slice(i + 1, e === -1 ? n : e), quoted: true });
                    i = e === -1 ? n : e + 1;
                    continue;
                }
                if (c === '$' && raw[i + 1] === "'") {
                    // ANSI-C quoting
                    flush();
                    let j = i + 2, s = '';
                    while (j < n && raw[j] !== "'") {
                        if (raw[j] === '\\' && j + 1 < n) { s += raw.slice(j, j + 2); j += 2; continue; }
                        s += raw[j++];
                    }
                    segs.push({ text: unescapeC(s), quoted: true });
                    i = j + 1;
                    continue;
                }
                if (c === '"') {
                    flush();
                    let j = i + 1;
                    let text = '';
                    let any = false;
                    while (j < n && raw[j] !== '"') {
                        const d = raw[j];
                        if (d === '\\' && j + 1 < n && '$`"\\\n'.includes(raw[j + 1])) {
                            if (raw[j + 1] !== '\n') text += raw[j + 1];
                            j += 2; continue;
                        }
                        if (d === '$' || d === '`') {
                            if (raw.slice(j, j + 4) === '$@"' || raw.slice(j, j + 3) === '$@' && raw[j + 2] === '"' || raw.slice(j, j + 5) === '${@}') {
                                // "$@" -> separate fields
                                const len = raw.slice(j, j + 4) === '${@}' ? 4 : 2;
                                if (text) { segs.push({ text, quoted: true }); text = ''; }
                                this.positional.forEach((p, idx) => {
                                    if (idx > 0) segs.push({ fieldBreak: true });
                                    segs.push({ text: p, quoted: true });
                                });
                                any = true;
                                j += len;
                                continue;
                            }
                            if (/^\$\{!?[A-Za-z_][A-Za-z0-9_]*\[@\]\}/.test(raw.slice(j))) {
                                const r = this.expandDollar(raw, j, io, false);
                                if (r.fields) {
                                    if (text) { segs.push({ text, quoted: true }); text = ''; }
                                    r.fields.forEach((f, idx) => { if (idx > 0) segs.push({ fieldBreak: true }); segs.push({ text: f, quoted: true }); });
                                    any = true;
                                    j = r.end;
                                    continue;
                                }
                            }
                            const r = this.expandDollar(raw, j, io, true);
                            text += r.text;
                            j = r.end;
                            continue;
                        }
                        text += d;
                        j++;
                    }
                    segs.push({ text, quoted: true });
                    void any;
                    i = j + 1;
                    continue;
                }
                if ((c === '<' || c === '>') && raw[i + 1] === '(' && i === 0) {
                    flush();
                    let depth = 0, j = i + 1;
                    for (; j < n; j++) { if (raw[j] === '(') depth++; else if (raw[j] === ')') { depth--; if (depth === 0) break; } }
                    const inner = raw.slice(i + 2, j);
                    const outText = this.commandSubst(inner, io, true);
                    this.psubCounter = (this.psubCounter || 0) + 1;
                    const p = '/tmp/.psub-' + this.pid + '-' + this.psubCounter;
                    const saved = this.fs.user;
                    this.fs.user = { name: 'root', groups: ['root'] };
                    try { const nd = this.fs.writeFile(p, outText); nd.mode = 0o644; } finally { this.fs.user = saved; }
                    segs.push({ text: p, quoted: true });
                    i = j + 1;
                    continue;
                }
                if (c === '$' || c === '`') {
                    const r = this.expandDollar(raw, i, io, false);
                    if (r.literal) { lit += r.text; i = r.end; continue; }
                    flush();
                    if (r.fields) {
                        r.fields.forEach((f, idx) => { if (idx > 0) segs.push({ fieldBreak: true }); segs.push({ text: f, quoted: false, split: true }); });
                    } else segs.push({ text: r.text, quoted: false, split: !opts.assign });
                    i = r.end;
                    continue;
                }
                lit += c;
                i++;
            }
            flush();
            return segs;
        }

        // expand $... or `...` starting at index i. returns {text, end}
        expandDollar(raw, i, io, inQuotes) {
            const n = raw.length;
            if (raw[i] === '`') {
                let j = i + 1, inner = '';
                while (j < n && raw[j] !== '`') {
                    if (raw[j] === '\\' && '$`\\'.includes(raw[j + 1])) { inner += raw[j + 1]; j += 2; continue; }
                    inner += raw[j++];
                }
                return { text: this.commandSubst(inner, io), end: j + 1 };
            }
            const next = raw[i + 1];
            if (next === '(' && raw[i + 2] === '(') {
                // arithmetic $(( ))
                let depth = 0, j = i + 1;
                for (; j < n; j++) {
                    if (raw[j] === '(') depth++;
                    else if (raw[j] === ')') { depth--; if (depth === 0) break; }
                }
                const inner = raw.slice(i + 3, j - 1);
                const expanded = this.expandString(inner, io);
                let v;
                try { v = evalArith(expanded, this); }
                catch (e) { throw new Error(expanded.trim() + ': ' + e.message); }
                return { text: String(v), end: j + 1 };
            }
            if (next === '(') {
                let depth = 0, j = i + 1, q = null;
                for (; j < n; j++) {
                    const ch = raw[j];
                    if (q) { if (ch === q) q = null; else if (ch === '\\' && q === '"') j++; continue; }
                    if (ch === "'" || ch === '"') { q = ch; continue; }
                    if (ch === '\\') { j++; continue; }
                    if (ch === '(') depth++;
                    else if (ch === ')') { depth--; if (depth === 0) break; }
                }
                return { text: this.commandSubst(raw.slice(i + 2, j), io), end: j + 1 };
            }
            if (next === '{') {
                let depth = 0, j = i + 1;
                for (; j < n; j++) {
                    if (raw[j] === '{') depth++;
                    else if (raw[j] === '}') { depth--; if (depth === 0) break; }
                }
                const inner = raw.slice(i + 2, j);
                const r = this.paramExpand(inner, io);
                if (Array.isArray(r) && !inQuotes) return { fields: r, end: j + 1 };
                return { text: Array.isArray(r) ? r.join(' ') : r, end: j + 1 };
            }
            let m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(raw.slice(i + 1));
            if (m) {
                const v = this.getVar(m[0]);
                if (v === undefined && this.options.nounset) throw new Error(m[0] + ': unbound variable');
                return { text: v === undefined ? '' : v, end: i + 1 + m[0].length };
            }
            if (next && /[0-9?$#!@*\-]/.test(next)) {
                if ((next === '@' || next === '*') && !inQuotes) return { fields: this.positional.slice(), end: i + 2 };
                if (next === '-') return { text: 'himBH', end: i + 2 };
                return { text: this.getVar(next) || '', end: i + 2 };
            }
            return { text: '$', end: i + 1, literal: true };
        }

        paramExpand(inner, io) {
            let m;
            if (inner === '#') return String(this.positional.length);
            if ((m = /^(#?)(!?)([A-Za-z_][A-Za-z0-9_]*)\[(.+)\]$/.exec(inner))) {
                const arr = this.getArray(m[3]);
                const dense = Object.keys(arr).map(Number).sort((a, b) => a - b);
                if (m[4] === '@' || m[4] === '*') {
                    if (m[1]) return String(dense.length);
                    if (m[2]) return dense.map(String);
                    return dense.map((k) => arr[k]);
                }
                const idx = evalArith(this.expandString(m[4], io), this);
                const v = arr[idx < 0 ? arr.length + idx : idx];
                if (m[1]) return String((v || '').length);
                return v === undefined ? '' : v;
            }
            if ((m = /^#([A-Za-z_][A-Za-z0-9_]*|\d+|@|\*)$/.exec(inner))) {
                if (m[1] === '@' || m[1] === '*') return String(this.positional.length);
                return String((this.getVar(m[1]) || '').length);
            }
            if (inner === '@' || inner === '*') return this.positional.slice();
            if ((m = /^!([A-Za-z_][A-Za-z0-9_]*)$/.exec(inner))) { const ref = this.getVar(m[1]); return ref ? this.getVar(ref) || '' : ''; }
            m = /^([A-Za-z_][A-Za-z0-9_]*|\d+|[?$!#@*])(.*)$/s.exec(inner);
            if (!m) throw new Error('${' + inner + '}: bad substitution');
            const name = m[1];
            const rest = m[2];
            const val = this.getVar(name);
            const isSet = val !== undefined;
            const isNull = !isSet || val === '';
            const word = (s) => this.expandWord(s, io, { split: false, glob: false }).join(' ');
            if (rest === '') {
                if (!isSet && this.options.nounset) throw new Error(name + ': unbound variable');
                return val || '';
            }
            let op;
            if ((op = /^(:?[-=+?])(.*)$/s.exec(rest))) {
                const colon = op[1][0] === ':';
                const kind = op[1].slice(-1);
                const cond = colon ? isNull : !isSet;
                switch (kind) {
                    case '-': return cond ? word(op[2]) : val;
                    case '=': if (cond) { const v = word(op[2]); this.setVar(name, v); return v; } return val;
                    case '+': return cond ? '' : word(op[2]);
                    case '?': if (cond) throw new Error(name + ': ' + (op[2] ? word(op[2]) : 'parameter null or not set')); return val;
                }
            }
            const v = val || '';
            if ((op = /^(##?|%%?)(.*)$/s.exec(rest))) {
                const pat = this.expandPattern(op[2], io);
                const longest = op[1].length === 2;
                if (op[1][0] === '#') {
                    if (longest) { for (let k = v.length; k >= 0; k--) if (globMatch(pat, v.slice(0, k))) return v.slice(k); }
                    else { for (let k = 0; k <= v.length; k++) if (globMatch(pat, v.slice(0, k))) return v.slice(k); }
                } else {
                    if (longest) { for (let k = 0; k <= v.length; k++) if (globMatch(pat, v.slice(k))) return v.slice(0, k); }
                    else { for (let k = v.length; k >= 0; k--) if (globMatch(pat, v.slice(k))) return v.slice(0, k); }
                }
                return v;
            }
            if ((op = /^\/(\/|#|%)?([^/]*)(?:\/(.*))?$/s.exec(rest))) {
                const mode = op[1] || '';
                const pat = this.expandPattern(op[2], io);
                const rep = op[3] !== undefined ? word(op[3]) : '';
                let src = globToRegexSource(pat, {});
                // make * non-greedy? bash is greedy (longest match)
                if (mode === '#') src = '^' + src;
                if (mode === '%') src = src + '$';
                try { return v.replace(new RegExp(src, mode === '/' ? 'g' : ''), () => rep); } catch (e) { return v; }
            }
            if ((op = /^:\s*(-?\d+)(?::\s*(-?\d+))?$/.exec(rest)) || (op = /^:\s*\(?(-?\d+)\)?(?::(-?\d+))?$/.exec(rest)) || (op = /^:([^:]+)(?::(.+))?$/.exec(rest))) {
                let off = evalArith(op[1], this);
                if (off < 0) off = Math.max(0, v.length + off);
                if (op[2] === undefined) return v.slice(off);
                let len = evalArith(op[2], this);
                if (len < 0) return v.slice(off, Math.max(off, v.length + len));
                return v.substr(off, len);
            }
            if (rest === '^^') return v.toUpperCase();
            if (rest === ',,') return v.toLowerCase();
            if (rest === '^') return v.charAt(0).toUpperCase() + v.slice(1);
            if (rest === ',') return v.charAt(0).toLowerCase() + v.slice(1);
            if (rest === '@Q') return quoteArg(v);
            throw new Error('${' + inner + '}: bad substitution');
        }

        commandSubst(src, io, keepNewlines) {
            const out = new CollectWriter();
            const snap = this.snapshot();
            let status = 0;
            try {
                const ast = parse(src, this);
                status = this.execNode(ast, { stdin: EMPTY_INPUT(), stdout: out, stderr: io.stderr, tty: false, ttyOut: io.ttyOut, ttyErr: io.ttyErr });
            } catch (e) {
                if (e instanceof ExitSignal) status = e.code;
                else if (e instanceof ShellSyntaxError) { io.stderr.write('bash: command substitution: ' + e.message + '\n'); status = 2; }
                else throw e;
            } finally {
                this.restore(snap);
            }
            this.cmdSubstStatus = status;
            this.lastStatus = status;
            return keepNewlines ? out.toString() : out.toString().replace(/\n+$/, '');
        }

        glob(pattern) {
            const absolute = pattern.startsWith('/');
            const parts = pattern.split('/').filter((p, idx) => p !== '' || idx === 0);
            let bases = [absolute ? '/' : ''];
            const segs = absolute ? parts.slice(1) : parts;
            for (let k = 0; k < segs.length; k++) {
                const seg = segs[k];
                const last = k === segs.length - 1;
                const next = [];
                for (const b of bases) {
                    const dirPath = this.resolve(b || '.');
                    if (!hasGlobChars(seg)) {
                        const lit = unescapeGlob(seg);
                        const cand = b === '' ? lit : (b.endsWith('/') ? b + lit : b + '/' + lit);
                        if (seg === '' && last) { next.push(b.endsWith('/') ? b : b + '/'); continue; }
                        if (this.fs.exists(this.resolve(cand))) next.push(cand);
                        continue;
                    }
                    let names;
                    try { names = this.fs.list(dirPath); } catch (e) { continue; }
                    const re = new RegExp('^' + globToRegexSource(seg, { pathname: true }) + '$');
                    for (const nm of names) {
                        if (nm.startsWith('.') && !seg.startsWith('.') && !seg.startsWith('\\.')) continue;
                        if (!re.test(nm)) continue;
                        const cand = b === '' ? nm : (b.endsWith('/') ? b + nm : b + '/' + nm);
                        if (!last && !this.fs.isDir(this.resolve(cand))) continue;
                        next.push(cand);
                    }
                }
                bases = next;
                if (!bases.length) break;
            }
            return bases.filter((b) => b !== '' && b !== '/' || absolute && segs.length === 0).sort();
        }
    }

    function unescapeC(s) {
        return s.replace(/\\(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|[0-7]{1,3}|.)/g, (m, e) => {
            switch (e[0]) {
                case 'n': return '\n';
                case 't': return '\t';
                case 'r': return '\r';
                case 'a': return '\x07';
                case 'b': return '\b';
                case 'e': case 'E': return '\x1b';
                case 'f': return '\f';
                case 'v': return '\v';
                case '\\': return '\\';
                case "'": return "'";
                case '"': return '"';
                case 'x': return String.fromCharCode(parseInt(e.slice(1), 16));
                case 'u': return String.fromCharCode(parseInt(e.slice(1), 16));
                default:
                    if (/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8));
                    return '\\' + e;
            }
        });
    }

    function quoteArg(s) {
        if (s === '') return "''";
        if (/^[A-Za-z0-9_\/.,:=+@%^-]+$/.test(s)) return s;
        return "'" + s.replace(/'/g, "'\\''") + "'";
    }

    function levenshtein(a, b) {
        if (Math.abs(a.length - b.length) > 3) return 99;
        const dp = [];
        for (let i = 0; i <= a.length; i++) { dp[i] = [i]; }
        for (let j = 0; j <= b.length; j++) dp[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
            }
        }
        return dp[a.length][b.length];
    }

    // Split a command line into words for tab completion (rough, quote-aware)
    function splitForCompletion(line) {
        const words = [];
        let cur = '', q = null, start = 0, cmdPos = true;
        const positions = [];
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (q) { if (c === q) q = null; else cur += c; continue; }
            if (c === "'" || c === '"') { q = c; continue; }
            if (c === '\\' && i + 1 < line.length) { cur += line[++i]; continue; }
            if (c === ' ' || c === '\t') { if (cur || words.length) { if (cur) { words.push(cur); positions.push({ start, cmdPos }); cmdPos = false; } } cur = ''; start = i + 1; continue; }
            if ('|;&('.includes(c)) { if (cur) { words.push(cur); positions.push({ start, cmdPos }); } cur = ''; start = i + 1; cmdPos = true; continue; }
            if (!cur) start = i;
            cur += c;
        }
        return { words, positions, current: cur, currentStart: start, currentIsCmd: cmdPos, inQuote: q };
    }

    LA.Shell = Shell;
    LA.Input = Input;
    LA.CollectWriter = CollectWriter;
    LA.NullWriter = NullWriter;
    LA.FnWriter = FnWriter;
    LA.ShellSyntaxError = ShellSyntaxError;
    LA.signals = { BreakSignal, ContinueSignal, ReturnSignal, ExitSignal, LimitError };
    LA.shellUtil = { lex, parse, globMatch, globToRegexSource, hasGlobChars, braceExpand, evalArith, unescapeC, quoteArg, escapeRe, levenshtein, splitForCompletion, POSIX_CLASSES };
    LA.commands = LA.commands || {};
    if (typeof module !== 'undefined' && module.exports) module.exports = Shell;
})();
